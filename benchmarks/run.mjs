import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpus, totalmem, platform, release, tmpdir } from "node:os";
import { mkdtemp, mkdir, readFile, writeFile, readdir, cp, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import net from "node:net";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  CANDIDATE_MIGRATION,
  compare,
  digest,
  expensePath,
  fixture,
  normalize,
  oracle,
  schedule,
  summarize,
  uuid,
} from "./lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "node_modules/.bin/supabase");
const execute = promisify(execFile);
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => shutdown.abort(new Error(`Benchmark interrupted by ${signal}`)));
}
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const flags = process.argv.slice(2);
const full = flags.includes("--full");
if (flags.some((flag) => !["--full", "--smoke"].includes(flag)))
  throw new Error("Use --smoke or --full; remote targets are intentionally unsupported");
if (full && flags.includes("--smoke")) throw new Error("Select one benchmark mode");
const config = {
  mode: full ? "full" : "smoke",
  rows: full ? 10000 : 1000,
  clients: full ? 20 : 2,
  repeats: full ? 5 : 1,
  seconds: full ? 300 : 3,
  warmupSeconds: full ? 30 : 1,
  thinkMs: full ? 200 : 20,
  role: "OWNER",
  minimumSamples: full ? 2000 : 1,
};
const output = join(
  ROOT,
  "benchmarks/results",
  `${new Date().toISOString().replaceAll(":", "-")}-${randomBytes(3).toString("hex")}`,
);
const projectId = `ferrixopsbench${randomBytes(5).toString("hex")}`;
let workdir;
let db;
let started = false;
let dockerEnvironment;
let candidateSql;
let baselinePolicies;
let baselineAcl;
const runs = [];

async function command(binary, args) {
  try {
    const result = await execute(binary, args, {
      cwd: ROOT,
      env: dockerEnvironment || process.env,
      signal: args[0] === "stop" ? undefined : shutdown.signal,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 20 * 60 * 1000,
    });
    return result.stdout;
  } catch (error) {
    // CLI status/start may contain local credentials. Never echo its raw stdout.
    const stderr = String(error.stderr || "")
      .replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted-token]")
      .replace(/(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/g, "[redacted-key]");
    throw new Error(
      `${binary.split("/").at(-1)} ${args[0]} failed (${error.code}): ${stderr.slice(-5000)}`,
    );
  }
}

async function cli(...args) {
  return command(CLI, [...args, "--workdir", workdir]);
}

async function freePort() {
  const server = net.createServer();
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

async function seed(data, admin) {
  const password = `${randomBytes(24).toString("hex")}Aa1!`;
  const actors = [];
  for (const employee of data.employees) {
    shutdown.signal.throwIfAborted();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: employee.email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Synthetic user creation failed: ${error.message}`);
    await db.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [
      employee.role,
      created.user.id,
    ]);
    actors.push({ ...employee, userId: created.user.id, password });
  }
  await db.query("INSERT INTO public.departments(id,name) VALUES ($1,'Benchmark only')", [
    uuid("department", 0),
  ]);
  await db.query("INSERT INTO public.designations(id,name) VALUES ($1,'Benchmark only')", [
    uuid("designation", 0),
  ]);
  for (const actor of actors) {
    await db.query(
      `INSERT INTO public.employees(id,user_id,employee_code,first_name,last_name,company_email,
      department_id,designation_id,joining_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'2023-01-01')`,
      [
        actor.id,
        actor.userId,
        actor.employee_code,
        actor.first_name,
        actor.last_name,
        actor.email,
        uuid("department", 0),
        uuid("designation", 0),
      ],
    );
  }
  for (const category of data.categories)
    await db.query("INSERT INTO public.expense_categories(id,name) VALUES ($1,$2)", [
      category.id,
      category.name,
    ]);
  await db.query("BEGIN");
  try {
    for (let i = 0; i < data.expenses.length; i += 1000) {
      await db.query(
        `INSERT INTO public.expenses(id,expense_number,submitted_by,category_id,vendor_name,description,
        amount,currency,expense_date,status,created_at,updated_at)
        SELECT id,expense_number,submitted_by,category_id,vendor_name,'Synthetic benchmark fixture',
        amount,currency,expense_date,status::public.expense_status,created_at,created_at
        FROM jsonb_to_recordset($1::jsonb) AS r(id uuid,expense_number text,submitted_by uuid,category_id uuid,
        vendor_name text,amount numeric,currency char(3),expense_date date,status text,created_at timestamptz)`,
        [JSON.stringify(data.expenses.slice(i, i + 1000))],
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const { data: missing, error } = await admin.auth.admin.createUser({
    email: "missing@ferrixops.example",
    password,
    email_confirm: true,
  });
  if (error) throw new Error("Missing-profile fixture creation failed");
  await db.query("DELETE FROM public.profiles WHERE id = $1", [missing.user.id]);
  const missingActor = {
    id: uuid("no-employee", 0),
    email: "missing@ferrixops.example",
    password,
    userId: missing.user.id,
    role: null,
  };
  await db.query("ANALYZE");
  const stored =
    await db.query(`SELECT e.id,e.expense_number,e.submitted_by,e.category_id,e.vendor_name,e.amount,
    e.currency,e.expense_date::text,e.status,e.created_at,
    jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'employee_code',p.employee_code) employee
    FROM public.expenses e JOIN public.employees p ON p.id=e.submitted_by ORDER BY e.created_at DESC,e.id DESC`);
  assert.equal(
    digest(normalize(stored.rows)),
    digest(normalize(data.expenses)),
    "Stored fixture differs from golden data",
  );
  return { actors, missingActor };
}

async function login(url, key, actor) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  });
  if (error) throw new Error(`Synthetic ${actor.role || "missing-profile"} login failed`);
  if (
    data.session.expires_at * 1000 <
    Date.now() + (config.seconds + config.warmupSeconds + 60) * 1000
  )
    throw new Error("Token lifetime is insufficient");
  return data.session.access_token;
}

async function http(url, key, token, path) {
  const begin = performance.now();
  try {
    const response = await fetch(url + path, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Accept-Encoding": "identity",
      },
      signal: AbortSignal.any([AbortSignal.timeout(10000), shutdown.signal]),
      redirect: "error",
    });
    const body = new Uint8Array(await response.arrayBuffer());
    const ms = performance.now() - begin;
    // Parsing and correctness comparison occur outside the measured HTTP interval.
    let rows;
    try {
      rows = JSON.parse(new TextDecoder().decode(body));
    } catch {
      rows = null;
    }
    return { status: response.status, ms, bytes: body.byteLength, rows };
  } catch {
    return { status: 0, ms: performance.now() - begin, bytes: 0, rows: null };
  }
}

async function correctness(url, key, data, actors, missingActor) {
  let checks = 0;
  for (const actor of actors.slice(0, 4)) {
    const token = await login(url, key, actor);
    for (const entry of schedule(data, actor)) {
      const response = await http(url, key, token, entry.path);
      assert.equal(response.status, 200, "Expense HTTP request failed");
      assert.equal(
        digest(normalize(response.rows)),
        entry.hash,
        `Wrong page for ${actor.role}/${entry.name}`,
      );
      checks++;
    }
    let cursor;
    const collected = [];
    for (let page = 0; page < Math.ceil(data.expenses.length / 50) + 2; page++) {
      const response = await http(url, key, token, expensePath({ cursor }));
      assert.equal(response.status, 200);
      const rows = normalize(response.rows);
      collected.push(...rows);
      if (!rows.length) break;
      cursor = { id: rows.at(-1).id, created_at: rows.at(-1).created_at };
    }
    assert.equal(
      digest(collected),
      digest(normalize(oracle(data, actor, {}, true))),
      "Pagination lost/duplicated records",
    );
    checks++;
    const empty = await http(url, key, token, expensePath({ from: "2030-01-01" }));
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.rows, []);
    checks++;
    if (actor.role === "EMPLOYEE") {
      const peer = await http(url, key, token, expensePath({ employee: actors[0].id }));
      assert.equal(peer.status, 200);
      assert.deepEqual(peer.rows, []);
      checks++;
    }
  }
  const missingToken = await login(url, key, missingActor);
  const missing = await http(url, key, missingToken, expensePath());
  assert.equal(missing.status, 200);
  assert.deepEqual(missing.rows, []);
  checks++;
  const anon = await http(url, key, key, expensePath());
  assert.ok(
    [401, 403].includes(anon.status) ||
      (anon.status === 200 && Array.isArray(anon.rows) && anon.rows.length === 0),
  );
  checks++;
  const invalid = await http(url, key, "invalid-token", expensePath());
  assert.equal(invalid.status, 401);
  checks++;
  return checks;
}

async function load(url, key, token, entries, seconds) {
  const samples = [];
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  const cpu = process.cpuUsage();
  const start = performance.now();
  const end = start + seconds * 1000;
  const progress =
    seconds >= 60
      ? setInterval(() => {
          const elapsed = (performance.now() - start) / 1000;
          console.log(
            `Measured ${Math.min(elapsed, seconds).toFixed(0)}/${seconds}s: ${samples.length} responses, ${samples.filter((s) => !s.ok).length} failures`,
          );
        }, 30000)
      : null;
  try {
    await Promise.all(
      Array.from({ length: config.clients }, async (_, client) => {
        let iteration = 0;
        while (performance.now() < end && !shutdown.signal.aborted) {
          const entry = entries[(iteration++ + client) % entries.length];
          const result = await http(url, key, token, entry.path);
          let ok = false;
          try {
            ok = result.status === 200 && digest(normalize(result.rows)) === entry.hash;
          } catch {
            /* Count malformed bodies as failures. */
          }
          samples.push({
            query: entry.name,
            status: result.status,
            ms: result.ms,
            bytes: result.bytes,
            ok,
          });
          await pause(config.thinkMs);
        }
      }),
    );
  } finally {
    if (progress) clearInterval(progress);
  }
  const elapsed = (performance.now() - start) / 1000;
  const used = process.cpuUsage(cpu);
  delay.disable();
  shutdown.signal.throwIfAborted();
  return {
    samples,
    elapsed,
    runtime: {
      cpu_fraction: (used.user + used.system) / (elapsed * 1000000),
      event_loop_p95_ms: delay.percentile(95) / 1000000,
    },
  };
}

async function setVariant(variant) {
  const targets = new Set(["Accounts view submitted expenses", "Owner views all expenses"]);
  for (const policy of baselinePolicies.filter((p) => targets.has(p.policyname))) {
    const name = '"' + policy.policyname.replaceAll('"', '""') + '"';
    await db.query(`ALTER POLICY ${name} ON public.expenses USING (${policy.qual})`);
  }
  if (variant === "candidate") await db.query(candidateSql);
  const policies = (
    await db.query(
      "SELECT policyname,cmd,roles::text,permissive,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='expenses' ORDER BY policyname",
    )
  ).rows;
  assert.equal(policies.length, baselinePolicies.length, "Policy count changed");
  for (const [index, policy] of policies.entries()) {
    const original = baselinePolicies[index];
    for (const field of ["policyname", "cmd", "roles", "permissive", "with_check"])
      assert.deepEqual(policy[field], original[field], `Policy ${field} changed`);
    if (variant === "baseline" || !targets.has(policy.policyname))
      assert.equal(policy.qual, original.qual, "Unrelated policy changed");
  }
  const acl = (
    await db.query(
      "SELECT relrowsecurity,relacl::text FROM pg_class WHERE oid='public.expenses'::regclass",
    )
  ).rows[0];
  assert.deepEqual(acl, baselineAcl, "Table grants or RLS enablement changed");
  await db.query("ANALYZE public.expenses");
  const indexes = (
    await db.query(
      "SELECT indexname,indexdef,pg_relation_size(indexname::regclass)::text bytes FROM pg_indexes WHERE schemaname='public' AND tablename='expenses' ORDER BY indexname",
    )
  ).rows;
  return { indexes, policies };
}

async function plan(actor) {
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL ROLE authenticated");
    await db.query(
      "SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
      [actor.userId, JSON.stringify({ sub: actor.userId, role: "authenticated" })],
    );
    return (
      await db.query(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,created_at,status FROM public.expenses WHERE status='PAID' ORDER BY created_at DESC,id DESC LIMIT 50",
      )
    ).rows;
  } finally {
    await db.query("ROLLBACK");
  }
}

function markdown(result) {
  return (
    `# ferrixOps expense API benchmark\n\nMode: **${config.mode}**. Local synthetic fixture: **${config.rows} expenses, 50 employees**.\n\n` +
    `This compares an equivalent 50-row HTTP contract before/after statement-level role-helper evaluation in two SELECT policies. Indexes, grants and visibility rules are unchanged. It is not a before/after measurement of the original unpaginated UI.\n\n` +
    `Timing: Node monotonic clock from fetch start through full response-body consumption, including connection setup if needed; JSON parsing and assertions are outside the timed interval. HTTP compression requested as identity.\n\n` +
    `| Pair | Variant | Attempts | Failures | p50 ms | p95 ms | Successful ops/s | Mean body bytes |\n|---|---|---|---|---|---|---|---|\n` +
    runs
      .map(
        (r) =>
          `| ${r.pair} | ${r.variant} | ${r.metrics.attempts} | ${r.metrics.failures} | ${r.metrics.p50_ms?.toFixed(2)} | ${r.metrics.p95_ms?.toFixed(2)} | ${r.metrics.successful_ops_per_second.toFixed(2)} | ${r.metrics.mean_body_bytes?.toFixed(0)} |`,
      )
      .join("\n") +
    `\n\nMedian run-level p95: ${result.median_baseline_p95_ms?.toFixed(2)} → ${result.median_candidate_p95_ms?.toFixed(2)} ms. Observed difference: ${result.reduction_percent?.toFixed(2)}%.\n\n` +
    `**${result.candidate_for_manual_review ? "Candidate result for manual methodology/resource review; not automatically a resume claim." : "No resume latency claim approved by the automated gate."}**\n\n` +
    result.reasons.map((reason) => `- ${reason}\n`).join("") +
    `\nAll runs, query-class distributions, sample counts, environment/migration manifests and scrubbed raw samples are retained next to this report. Same-machine Docker contention and closed-loop throughput changes still require interpretation. Representative SQL plans are diagnostics, not the exact PostgREST embedding plan.\n`
  );
}

async function main() {
  await mkdir(output, { recursive: true });
  await command("docker", ["info", "--format", "{{.ServerVersion}}"]);
  workdir = await mkdtemp(join(tmpdir(), "ferrixops-benchmark-"));
  const engineHost = (
    await command("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"])
  ).trim();
  assert.ok(
    engineHost.startsWith("unix://"),
    "Only a local Unix-socket Docker engine is supported",
  );
  const dockerConfig = join(workdir, "docker-client");
  await mkdir(dockerConfig);
  await writeFile(join(dockerConfig, "config.json"), JSON.stringify({ auths: {} }), {
    mode: 0o600,
  });
  // Public images require no login. Do not consult or modify registry credentials.
  dockerEnvironment = { ...process.env, DOCKER_CONFIG: dockerConfig, DOCKER_HOST: engineHost };
  const supabase = join(workdir, "supabase");
  await mkdir(supabase);
  const ports = [await freePort(), await freePort(), await freePort()];
  let toml = await readFile(join(ROOT, "benchmarks/supabase/config.toml"), "utf8");
  toml = toml
    .replace("replaced-by-runner", projectId)
    .replaceAll("55321", String(ports[0]))
    .replaceAll("55322", String(ports[1]))
    .replaceAll("55320", String(ports[2]));
  await writeFile(join(supabase, "config.toml"), toml);
  candidateSql = await readFile(join(ROOT, "supabase/migrations", CANDIDATE_MIGRATION), "utf8");
  await cp(join(ROOT, "supabase/migrations"), join(supabase, "migrations"), {
    recursive: true,
    filter: (path) => basename(path) !== CANDIDATE_MIGRATION,
  });
  const migrations = await Promise.all(
    (await readdir(join(supabase, "migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map(async (name) => ({
        name,
        sha256: digest(await readFile(join(supabase, "migrations", name), "utf8")),
      })),
  );
  const git = (await command("git", ["rev-parse", "HEAD"])).trim();
  const dirty = Boolean((await command("git", ["status", "--porcelain"])).trim());
  console.log(`Starting isolated Supabase (${config.mode}); first run downloads container images.`);
  started = true; // Also clean up a partially started project if initialization fails.
  const progress = setInterval(() => console.log("Local benchmark stack is starting…"), 30000);
  try {
    await cli(
      "start",
      "-x",
      "studio,imgproxy,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta",
    );
  } finally {
    clearInterval(progress);
  }
  const status = JSON.parse(await cli("status", "-o", "json"));
  const url = status.API_URL;
  const key = status.ANON_KEY || status.PUBLISHABLE_KEY;
  const serviceKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  const expectedOrigin = `http://127.0.0.1:${ports[0]}`;
  assert.equal(new URL(url).origin, expectedOrigin, "Refusing a non-generated API target");
  const databaseUrl = new URL(status.DB_URL);
  assert.equal(databaseUrl.hostname, "127.0.0.1");
  assert.equal(databaseUrl.port, String(ports[1]));
  assert.ok(key && serviceKey, "CLI did not return local API keys");
  db = new pg.Client({ connectionString: databaseUrl.toString() });
  await db.connect();
  baselinePolicies = (
    await db.query(
      "SELECT policyname,cmd,roles::text,permissive,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='expenses' ORDER BY policyname",
    )
  ).rows;
  baselineAcl = (
    await db.query(
      "SELECT relrowsecurity,relacl::text FROM pg_class WHERE oid='public.expenses'::regclass",
    )
  ).rows[0];
  assert.equal(
    baselinePolicies.filter(
      (p) =>
        ["Accounts view submitted expenses", "Owner views all expenses"].includes(p.policyname) &&
        p.cmd === "SELECT",
    ).length,
    2,
  );
  assert.equal(baselineAcl.relrowsecurity, true);
  const data = fixture(config.rows);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log(`Seeding ${config.rows} synthetic expenses and 50 test identities…`);
  const { actors, missingActor } = await seed(data, admin);
  const version = (await db.query("SHOW server_version")).rows[0].server_version;
  const containerIds = (
    await command("docker", ["ps", "--filter", `name=_${projectId}`, "--format", "{{.ID}}"])
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const containerFormat =
    '{"name":{{json .Name}},"image":{{json .Config.Image}},"image_id":{{json .Image}},"memory_limit_bytes":{{json .HostConfig.Memory}},"nano_cpus":{{json .HostConfig.NanoCpus}}}';
  const containers = containerIds.length
    ? (await command("docker", ["inspect", "--format", containerFormat, ...containerIds]))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  const dockerResources = JSON.parse(
    await command("docker", [
      "info",
      "--format",
      '{"cpus":{{.NCPU}},"memory_bytes":{{.MemTotal}}}',
    ]),
  );
  const sourceFiles = [
    "benchmarks/run.mjs",
    "benchmarks/lib.mjs",
    "benchmarks/supabase/config.toml",
    "package-lock.json",
    `supabase/migrations/${CANDIDATE_MIGRATION}`,
  ];
  const manifest = {
    config,
    git,
    dirty,
    fixture_sha256: data.hash,
    migrations,
    source: await Promise.all(
      sourceFiles.map(async (file) => ({
        file,
        sha256: digest(await readFile(join(ROOT, file), "utf8")),
      })),
    ),
    environment: {
      os: platform(),
      release: release(),
      node: process.version,
      cpu: cpus()[0]?.model,
      logical_cpus: cpus().length,
      memory_bytes: totalmem(),
      postgres: version,
      supabase: (await command(CLI, ["--version"])).trim(),
      docker: (await command("docker", ["info", "--format", "{{.ServerVersion}}"])).trim(),
      docker_resources: dockerResources,
      containers,
    },
    metric:
      "Node performance.now: request start to complete body; identity encoding; JSON validation excluded",
    fixture_scope:
      "50 employees, 5 categories and synthetic expenses; attendance/tasks/leave intentionally not seeded in this focused experiment",
    optimization: {
      migration: CANDIDATE_MIGRATION,
      sha256: digest(candidateSql),
      description:
        "Uncorrelated role-helper subqueries in two existing SELECT policies; same grants, indexes and row visibility",
    },
    role: config.role,
    credentials_saved: false,
  };
  await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (let pair = 1; pair <= config.repeats; pair++) {
    const order = pair % 2 ? ["baseline", "candidate"] : ["candidate", "baseline"];
    for (const variant of order) {
      const { indexes, policies } = await setVariant(variant);
      console.log(`Pair ${pair}/${config.repeats}, ${variant}: correctness gate…`);
      const checks = await correctness(url, key, data, actors, missingActor);
      const token = await login(url, key, actors[0]);
      const entries = schedule(data, actors[0]);
      const diagnosticPlan = await plan(actors[0]);
      await load(url, key, token, entries, config.warmupSeconds);
      console.log(
        `Pair ${pair}/${config.repeats}, ${variant}: ${config.seconds}s at ${config.clients} virtual clients…`,
      );
      const measured = await load(url, key, token, entries, config.seconds);
      const record = {
        pair,
        variant,
        correctness_checks: checks,
        indexes,
        policies,
        metrics: summarize(measured.samples, measured.elapsed),
        runtime: measured.runtime,
        actual_seconds: measured.elapsed,
        diagnostic_plan: diagnosticPlan,
      };
      runs.push(record);
      const prefix = `${pair}-${variant}`;
      await writeFile(join(output, `${prefix}.json`), JSON.stringify(record, null, 2));
      await writeFile(
        join(output, `${prefix}.samples.ndjson.gz`),
        gzipSync(measured.samples.map((s) => JSON.stringify(s)).join("\n")),
      );
      console.log(
        `${variant}: ${record.metrics.attempts} attempts; ${record.metrics.failures} failures; p95 ${record.metrics.p95_ms.toFixed(2)} ms`,
      );
    }
  }
  const result = compare(runs, {
    repeats: config.repeats,
    minimumSamples: config.minimumSamples,
    claimMode: full,
    dirty,
  });
  await writeFile(join(output, "comparison.json"), JSON.stringify(result, null, 2));
  await writeFile(join(output, "report.md"), markdown(result));
  console.log(`Report: ${join(output, "report.md")}`);
  if (runs.some((r) => r.metrics.failures))
    throw new Error("Measured HTTP/semantic failures occurred; see report");
  if (full && !result.candidate_for_manual_review)
    console.log(
      "Full protocol completed; claim gate did not pass. Retain the negative/diagnostic result.",
    );
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;
  console.error(`Benchmark stopped: ${error.message}`);
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "aborted.json"),
    JSON.stringify(
      { status: "aborted", error: error.message, completed_runs: runs.length },
      null,
      2,
    ),
  );
} finally {
  if (db) await db.end().catch(() => {});
  if (started && workdir) {
    console.log("Stopping only this run's temporary Supabase project…");
    try {
      await cli("stop", "--no-backup");
      await rm(workdir, { recursive: true, force: true });
    } catch {
      process.exitCode = 1;
      console.error(
        `Cleanup needs attention for benchmark project ${projectId}; workdir retained at ${workdir}`,
      );
    }
  } else if (workdir) await rm(workdir, { recursive: true, force: true });
}
