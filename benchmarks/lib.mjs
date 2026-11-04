import { createHash } from "node:crypto";

export const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_OWNER_APPROVAL",
  "PAYMENT_PENDING",
  "PAID",
  "REJECTED_BY_ACCOUNTS",
  "REJECTED_BY_OWNER",
];
export const PROJECTION =
  "id,expense_number,submitted_by,category_id,vendor_name,amount,currency,expense_date,status,created_at,employee:employees!expenses_submitted_by_fkey(id,first_name,last_name,employee_code)";
export const CANDIDATE_INDEXES = [
  "CREATE INDEX bench_expenses_status_created ON public.expenses (status, created_at DESC, id DESC)",
  "CREATE INDEX bench_expenses_owner_created ON public.expenses (submitted_by, created_at DESC, id DESC)",
];

export function digest(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

export function uuid(kind, n) {
  const hex = digest([20261025, kind, n]).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function fixture(count) {
  if (!Number.isInteger(count) || count < 100 || count > 100000)
    throw new Error("Expense rows must be 100–100000");
  let state = 20261025;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const employees = Array.from({ length: 50 }, (_, i) => ({
    id: uuid("employee", i),
    email: `bench${i}@ferrixops.example`,
    first_name: "Synthetic",
    last_name: `Employee${i}`,
    employee_code: `BENCH${i}`,
    role: i === 0 ? "OWNER" : i === 1 ? "ACCOUNTS" : "EMPLOYEE",
  }));
  const categories = Array.from({ length: 5 }, (_, i) => ({
    id: uuid("category", i),
    name: `Synthetic category ${i}`,
  }));
  const expenses = Array.from({ length: count }, (_, i) => {
    const employee = employees[Math.floor(random() < 0.6 ? random() * 10 : random() * 50)];
    const group = Math.floor(i / 4); // Deliberate timestamp ties.
    const created_at = new Date(
      Date.UTC(2024, 0, 1) + (group % 730) * 86400000 + Math.floor(group / 730) * 60000,
    ).toISOString();
    return {
      id: uuid("expense", i),
      expense_number: `BENCH-${String(i).padStart(7, "0")}`,
      submitted_by: employee.id,
      category_id: categories[Math.floor(random() * 5)].id,
      vendor_name: `Synthetic vendor ${Math.floor(random() * 20)}`,
      amount: Math.floor(10000 + random() * 990000) / 100,
      currency: "INR",
      expense_date: created_at.slice(0, 10),
      status: STATUSES[Math.floor(random() * STATUSES.length)],
      created_at,
      employee: {
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        employee_code: employee.employee_code,
      },
    };
  });
  expenses.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  return { employees, categories, expenses, hash: digest({ employees, categories, expenses }) };
}

export function oracle(data, actor, query, all = false) {
  const visible = data.expenses.filter((row) => {
    const allowed =
      actor.role === "OWNER" ||
      row.submitted_by === actor.id ||
      (actor.role === "ACCOUNTS" && row.status !== "DRAFT");
    return (
      allowed &&
      (!query.status || row.status === query.status) &&
      (!query.from || row.expense_date >= query.from) &&
      (!query.to || row.expense_date <= query.to) &&
      (!query.employee || row.submitted_by === query.employee) &&
      (!query.cursor ||
        row.created_at < query.cursor.created_at ||
        (row.created_at === query.cursor.created_at && row.id < query.cursor.id))
    );
  });
  return all ? visible : visible.slice(0, query.limit ?? 50);
}

export function expensePath(query = {}) {
  const limit = query.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("Page size must be 1–50");
  if (query.status && !STATUSES.includes(query.status)) throw new Error("Invalid status");
  for (const key of ["from", "to"]) {
    if (query[key] && !/^\d{4}-\d{2}-\d{2}$/.test(query[key])) throw new Error("Invalid date");
  }
  const validUuid = (value) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
  if (query.employee && !validUuid(query.employee)) throw new Error("Invalid employee");
  const params = new URLSearchParams({
    select: PROJECTION,
    order: "created_at.desc,id.desc",
    limit: String(limit),
  });
  if (query.status) params.set("status", `eq.${query.status}`);
  if (query.from) params.append("expense_date", `gte.${query.from}`);
  if (query.to) params.append("expense_date", `lte.${query.to}`);
  if (query.employee) params.set("submitted_by", `eq.${query.employee}`);
  if (query.cursor) {
    const { created_at, id } = query.cursor;
    if (!validUuid(id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(created_at))
      throw new Error("Invalid cursor");
    params.set("or", `(created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id}))`);
  }
  return `/rest/v1/expenses?${params}`;
}

export function normalize(rows) {
  if (!Array.isArray(rows)) throw new Error("Expected an expense array");
  return rows.map((r) => ({
    id: r.id,
    expense_number: r.expense_number,
    submitted_by: r.submitted_by,
    category_id: r.category_id,
    vendor_name: r.vendor_name,
    amount: Number(r.amount),
    currency: r.currency,
    expense_date: r.expense_date,
    status: r.status,
    created_at: new Date(r.created_at).toISOString(),
    employee: r.employee && {
      id: r.employee.id,
      first_name: r.employee.first_name,
      last_name: r.employee.last_name,
      employee_code: r.employee.employee_code,
    },
  }));
}

export function schedule(data, actor) {
  const queries = [
    { name: "all", query: {} },
    { name: "paid", query: { status: "PAID" } },
    {
      name: "submitted-window",
      query: { status: "SUBMITTED", from: "2024-06-01", to: "2025-06-01" },
    },
  ];
  return queries.flatMap(({ name, query }) => {
    const rows = oracle(data, actor, query, true);
    const positions = [null, Math.floor(rows.length / 2) - 1, Math.max(0, rows.length - 51)];
    return positions.map((position, index) => {
      const cursor =
        position === null || !rows[position]
          ? undefined
          : { id: rows[position].id, created_at: rows[position].created_at };
      const q = { ...query, cursor };
      return {
        name: `${name}-${["first", "middle", "deep"][index]}`,
        path: expensePath(q),
        hash: digest(normalize(oracle(data, actor, q))),
      };
    });
  });
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}

export function summarize(samples, seconds) {
  const successes = samples.filter((s) => s.ok);
  return {
    attempts: samples.length,
    successes: successes.length,
    failures: samples.length - successes.length,
    p50_ms: percentile(
      samples.map((s) => s.ms),
      0.5,
    ),
    p95_ms: percentile(
      samples.map((s) => s.ms),
      0.95,
    ),
    success_p95_ms: percentile(
      successes.map((s) => s.ms),
      0.95,
    ),
    successful_ops_per_second: successes.length / seconds,
    mean_body_bytes: successes.length
      ? successes.reduce((sum, s) => sum + s.bytes, 0) / successes.length
      : null,
    by_query: Object.fromEntries(
      [...new Set(samples.map((s) => s.query))].map((name) => [
        name,
        {
          samples: samples.filter((s) => s.query === name).length,
          p95_ms: percentile(
            samples.filter((s) => s.query === name).map((s) => s.ms),
            0.95,
          ),
        },
      ]),
    ),
  };
}

export function compare(runs, { repeats, minimumSamples, claimMode, dirty = false }) {
  const before = runs.filter((r) => r.variant === "baseline");
  const after = runs.filter((r) => r.variant === "candidate");
  const a = percentile(
    before.map((r) => r.metrics.p95_ms),
    0.5,
  );
  const b = percentile(
    after.map((r) => r.metrics.p95_ms),
    0.5,
  );
  const reasons = [];
  if (dirty)
    reasons.push(
      "Source working tree was uncommitted; pin a reproducible commit before a claim run",
    );
  if (!claimMode) reasons.push("Smoke/diagnostic configuration, not the full benchmark protocol");
  if (before.length !== repeats || after.length !== repeats || repeats < 5)
    reasons.push("Five paired repetitions required");
  if (runs.some((r) => r.metrics.failures)) reasons.push("HTTP or semantic failures occurred");
  if (runs.some((r) => r.metrics.successes < minimumSamples))
    reasons.push("Insufficient successful samples in one or more runs");
  if (runs.some((r) => r.runtime.cpu_fraction >= 0.8 || r.runtime.event_loop_p95_ms > 50))
    reasons.push("Load-generator saturation warning");
  if (!(b > 0 && a > b)) reasons.push("Candidate did not improve median run-level p95");
  const pairs = before.map((r) => ({
    pair: r.pair,
    baseline_ms: r.metrics.p95_ms,
    candidate_ms: after.find((aRun) => aRun.pair === r.pair)?.metrics.p95_ms,
  }));
  if (pairs.some((p) => p.candidate_ms > p.baseline_ms * 1.05))
    reasons.push("One or more pairs regressed by over 5%; investigate variation");
  return {
    median_baseline_p95_ms: a,
    median_candidate_p95_ms: b,
    reduction_percent: a > 0 && b !== null ? ((a - b) / a) * 100 : null,
    candidate_for_manual_review: reasons.length === 0,
    reasons,
    pairs,
  };
}
