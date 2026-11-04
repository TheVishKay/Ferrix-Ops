import assert from "node:assert/strict";
import test from "node:test";
import {
  compare,
  digest,
  expensePath,
  fixture,
  normalize,
  oracle,
  percentile,
  schedule,
  summarize,
} from "./lib.mjs";

const data = fixture(1000);

test("fixture is reproducible, has tied timestamps and uncorrelated ownership/status", () => {
  assert.equal(fixture(1000).hash, data.hash);
  assert.notEqual(fixture(1001).hash, data.hash);
  assert.equal(new Set(data.expenses.map((r) => r.id)).size, 1000);
  assert.ok(new Set(data.expenses.map((r) => r.created_at)).size < 1000);
  assert.ok(
    new Set(
      data.expenses.filter((r) => r.submitted_by === data.employees[2].id).map((r) => r.status),
    ).size > 1,
  );
});

test("golden visibility includes own drafts for ACCOUNTS, excludes peer drafts and all missing-profile rows", () => {
  const account = data.employees[1];
  const rows = oracle(data, account, {}, true);
  assert.ok(rows.some((r) => r.status === "DRAFT" && r.submitted_by === account.id));
  assert.ok(!rows.some((r) => r.status === "DRAFT" && r.submitted_by !== account.id));
  assert.ok(
    oracle(data, data.employees[2], {}, true).every((r) => r.submitted_by === data.employees[2].id),
  );
  assert.deepEqual(oracle(data, { role: null, id: "missing" }, {}, true), []);
});

test("cursor traversal neither drops nor duplicates tied-timestamp records", () => {
  const actor = data.employees[0];
  const ids = [];
  let cursor;
  for (let i = 0; i < 25; i++) {
    const page = oracle(data, actor, { cursor });
    if (!page.length) break;
    ids.push(...page.map((r) => r.id));
    cursor = { id: page.at(-1).id, created_at: page.at(-1).created_at };
  }
  assert.deepEqual(
    ids,
    data.expenses.map((r) => r.id),
  );
});

test("request builder rejects malformed filters and constructs both date bounds and tie-break cursor", () => {
  assert.throws(() => expensePath({ status: "PAID,or(true)" }));
  assert.throws(() => expensePath({ cursor: { id: "bad", created_at: "bad" } }));
  assert.throws(() => expensePath({ limit: 1001 }));
  const cursor = { id: data.expenses[0].id, created_at: data.expenses[0].created_at };
  const params = new URL(
    "http://localhost" + expensePath({ cursor, from: "2024-01-01", to: "2024-12-31" }),
  ).searchParams;
  assert.equal(params.get("order"), "created_at.desc,id.desc");
  assert.equal(params.get("limit"), "50");
  assert.deepEqual(params.getAll("expense_date"), ["gte.2024-01-01", "lte.2024-12-31"]);
  assert.ok(params.get("or").includes(`id.lt.${cursor.id}`));
});

test("normalization makes PostgreSQL timestamp/decimal representations comparable", () => {
  const row = data.expenses[0];
  assert.equal(
    digest(
      normalize([
        { ...row, amount: String(row.amount), created_at: row.created_at.replace("Z", "+00:00") },
      ]),
    ),
    digest(normalize([row])),
  );
  assert.equal(schedule(data, data.employees[0]).length, 9);
});

test("metrics retain failed attempts in latency, distinguish successful throughput, and handle empty samples", () => {
  const summary = summarize(
    [
      { ms: 10, ok: true, bytes: 50, query: "first" },
      { ms: 1000, ok: false, bytes: 0, query: "first" },
    ],
    2,
  );
  assert.equal(summary.failures, 1);
  assert.equal(summary.successful_ops_per_second, 0.5);
  assert.ok(summary.p95_ms > summary.success_p95_ms);
  assert.equal(percentile([], 0.95), null);
});

test("claim gate rejects smoke results, failure/saturation, undersampling and unfavorable pairs", () => {
  const runs = Array.from({ length: 5 }, (_, i) =>
    ["baseline", "candidate"].map((variant) => ({
      pair: i + 1,
      variant,
      metrics: { p95_ms: variant === "baseline" ? 100 : 50, failures: 0, successes: 2500 },
      runtime: { cpu_fraction: 0.1, event_loop_p95_ms: 10 },
    })),
  ).flat();
  const options = { repeats: 5, minimumSamples: 2000, claimMode: true };
  assert.equal(compare(runs, options).reduction_percent, 50);
  assert.equal(compare(runs, options).candidate_for_manual_review, true);
  assert.equal(compare(runs, { ...options, dirty: true }).candidate_for_manual_review, false);
  assert.equal(compare(runs, { ...options, claimMode: false }).candidate_for_manual_review, false);
  const bad = structuredClone(runs);
  bad[1].metrics.failures = 1;
  bad[1].metrics.successes = 1;
  bad[1].runtime.cpu_fraction = 0.9;
  bad[1].metrics.p95_ms = 200;
  const result = compare(bad, options);
  assert.equal(result.candidate_for_manual_review, false);
  assert.ok(result.reasons.length >= 4);
});
