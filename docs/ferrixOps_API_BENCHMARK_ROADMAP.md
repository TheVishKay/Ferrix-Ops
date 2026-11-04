# ferrixOps: roadmap for a defensible API-performance resume claim

Status: methodology and implementation plan; no resume-grade API-latency improvement has been established.

The initial expense-only automation is now implemented in [the benchmark harness](../benchmarks/README.md). It uses Node HTTP requests and a monotonic clock rather than the originally proposed k6 runner. Smoke mode verifies real local Auth/RLS, the full migration chain, deterministic fixtures and paired baseline/optimized policy variants. The full five-pair protocol is available separately; dashboard and multi-workflow load experiments below remain future work.

## 1. Objective and claim boundary

Produce a repeatable result of this form without needing a factory deployment:

> Optimized PostgreSQL-backed expense queries, reducing p95 API latency from **[A] ms to [B] ms ([X]%)** on **[N] synthetic expense records** under **[C] concurrent virtual clients** in a **[local/staging]** benchmark.

The main experiment should isolate one useful operation: retrieving a filtered, correctly ordered expense page through the real Supabase HTTP API with real authenticated roles and RLS. A second experiment can measure dashboard data retrieval after consolidating four requests into one RPC.

Do not promise a percentage before measuring. If indexing does not improve the workload, report that finding and investigate the actual bottleneck. A correct negative result is preferable to a misleading optimization claim.

This roadmap does not authorize deploying to a factory or loading real employee data. All fixtures are synthetic. A local Supabase stack is sufficient; hosted staging is an optional, separately labeled replication experiment.

## 2. Current repository evidence

Planning baseline: `509cf88`, the checked-out commit when this plan was written. Record the actual future baseline and optimized commits when implementing.

| Area                | Current implementation                                                                                                                                                                                      | Opportunity                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Expenses            | `src/pages/BillsExpenses.jsx` fetches categories and an expense response with joined employee fields, ordered by `created_at`. Filtering and totals happen in the browser. There is no explicit pagination. | Extract a service, introduce a complete paginated contract, then measure query/index improvements with equivalent outputs. |
| Owner dashboard     | `src/pages/Dashboard.jsx` issues four parallel data requests for active employees, daily attendance, pending corrections and pending expenses. Counts and sums are computed in JavaScript.                  | One authorized RPC returning accurate aggregates and action queues; measure the complete retrieval flow.                   |
| Leave               | `src/services/leaveService.js` fetches ordered request lists without explicit pagination.                                                                                                                   | Follow-up endpoint after the expense benchmark is sound.                                                                   |
| Tasks               | `src/services/taskService.js` fetches the task board without explicit pagination. Existing tests cover transactional mutations rather than HTTP performance.                                                | Separate future board-loading or write-concurrency experiment. Do not force table pagination into board semantics.         |
| Indexes             | Expenses already have separate status, submitter, category and date indexes.                                                                                                                                | Profile existing plans before considering composite indexes.                                                               |
| Test infrastructure | `scripts/test_task_database.py` uses PostgreSQL and a minimal auth fixture.                                                                                                                                 | Retain for task regressions; it is not an HTTP, real-JWT or complete-Supabase benchmark harness.                           |

Unpaginated calls can still be capped by the API. Record the configured response-row maximum. A fast, truncated response must never be accepted as a correct baseline.

## 3. Separate the experiments

### Experiment A — primary resume claim: equivalent expense-page requests

Both variants must implement this same contract:

- Authenticated role and employee identity are identical for a matched request.
- Same explicit response projection, employee join, status/date filters and page size of 50.
- Same ordering: `created_at DESC, id DESC`; `id` resolves timestamp ties.
- Same keyset cursor, representing the last `(created_at, id)` pair.
- Same error behavior and RLS visibility; exact counts are excluded unless both implementations provide and time them.
- Same first/middle/deep-page request schedule and fixture.

First implement the contract using existing schema/indexes. This is the **normalized baseline**, not a claim that the old application already had this endpoint. Then optimize the query/indexes without changing the contract. This supports an API-latency comparison.

### Experiment B — product improvement: first useful expense page

Compare the original application retrieval/filtering strategy with the new paginated strategy. Include the same filter result and the same first 50 visible items in the observable task; preserve access to the remaining matching records through pagination.

Report response bytes, HTTP requests and time to the first useful page. The original strategy must retrieve enough pages to compute correct results; retain its literal as-is behavior as a diagnostic if it truncates. Label corrected-reference behavior separately.

This experiment changes retrieval strategy. It can support a payload/page-readiness claim, but must not be presented as a same-query database speedup. If the API now returns fewer rows, say so.

### Experiment C — dashboard retrieval: four requests versus one RPC

Define the required output before coding: active employee count, daily attendance metric, pending expense total and action items. Document the intended attendance semantics instead of silently changing existing behavior.

Both variants must return equal totals and the same deterministically ordered action items. Choose either the complete action set for both or a documented first-20-items contract for both; if changing to a bounded queue, expose a total and navigation to the rest. The baseline may retrieve extra rows before constructing that output, and its bytes count must include them.

Time one complete operation: execute the baseline's four requests in parallel and normalize their responses; compare with the RPC and the same normalization contract. Do not add the four request durations or average them and compare that number with the RPC duration.

The request-count change would be 4 → 1, or 75% fewer application data requests for this OWNER flow, excluding Auth/profile traffic. It would not imply 75% lower latency. Label its latency metric **dashboard data-retrieval duration**, not individual endpoint latency.

## 4. Proposed repository deliverables

All files below are planned; this roadmap does not create or execute them.

```text
benchmarks/
  README.md                       # single reproducible procedure
  fixtures/
    manifest.json                 # seed, fixed dates, distributions, expected counts
  seed/
    seed.mjs                      # synthetic Auth accounts and relational data
    verify.sql                    # counts, invariants, scope and expected totals
  k6/
    expenses.js                   # normalized-baseline/optimized HTTP workload
    dashboard.js                  # complete parallel-query/RPC workload
    correctness.js                # roles, pagination and aggregate assertions
  scripts/
    run-pair.mjs                   # fresh environment, run ordering, metadata
    summarize.mjs                 # per-run metrics, comparison and validation
    redact.mjs                    # strip credentials/identifying metadata
  results/
    .gitkeep                      # summaries/manifests; avoid huge raw dumps
docs/
  ferrixOps_API_BENCHMARK_RESULTS.md
src/services/
  expenseService.js                # extracted query contract
  dashboardService.js              # dashboard contract
supabase/migrations/
  <new_version>_expense_query_indexes.sql
  <new_version>_dashboard_metrics_rpc.sql
```

Use additive schema migrations. For each variant retain an exact migration manifest; optimized indexes must not remain in the baseline database. Use a fresh local stack/isolated databases sequentially, not the user's live linked database. Reproduce from a separate checkout or explicit migration manifests rather than resetting the user's working tree.

## 5. Milestones and exit criteria

### Milestone 1 — establish the environment and comparable contracts

1. Select a local Supabase stack with Auth, PostgREST and PostgreSQL. Keep the database version aligned with `supabase/config.toml` where feasible; record any difference.
2. Pin and record Supabase CLI/container images, PostgreSQL, k6, Node, OS and machine resources. Record container CPU/RAM limits and whether generator and server share a machine.
3. Apply the full baseline migration chain, including required Storage/auth dependencies. Run existing task regressions separately.
4. Record API row limits, database settings, connection pool limits, HTTP compression and connection reuse configuration.
5. Extract the expense query from the page and implement the normalized contract with existing indexes. Add the frontend pagination/filter integration as a separate change.
6. Preserve the original retrieval adapter for Experiment B and the four-request dashboard adapter for Experiment C.

**Exit:** both benchmark contracts are written, role expectations are explicit, and the baseline works through HTTP with a real access token. Database-only SQL timing cannot substitute for this gate.

### Milestone 2 — seed deterministic, representative datasets

Use a fixed PRNG seed, such as `20261025`, stable synthetic identifiers and a fixed reference date. Store a manifest with counts and a digest of sorted fixture data. Do not make results depend on the day the script runs.

| Fixture | Purpose                      | Employees | Attendance | Expenses | Tasks   | Leave requests |
| ------- | ---------------------------- | --------- | ---------- | -------- | ------- | -------------- |
| S       | Small-workforce sanity check | 50        | 18,250     | 1,000    | 2,000   | 250            |
| M       | Primary benchmark            | 50        | 36,500     | 10,000   | 20,000  | 1,000          |
| L       | Optional data-growth stress  | 50        | 36,500     | 100,000  | 100,000 | 5,000          |

These counts are experimental design, not adoption. Attendance counts represent synthetic daily records and do not imply every day is a working day. Large expense/task fixtures are growth/stress cases, not a claim of typical factory activity. In the resume report the endpoint's expense count, not a sum of unrelated rows.

Seed requirements:

- Provision synthetic Auth users; assign roles through trusted fixture tooling. Keep administrative credentials confined to setup.
- Include OWNER, ACCOUNTS and at least 20 EMPLOYEE identities so 20 clients can use distinct tokens. Role-specific experiments remain separate.
- Spread expense timestamps over a fixed two-year interval. Include repeated `created_at` values to test cursor ties and skewed distribution across employees/categories.
- Create status distributions that include pending, approved/payment-pending, paid, draft, returned and rejected records using actual schema values. Record exact frequencies; choose valid financial fields and relationships.
- Include inactive staff for visibility/business-rule checks, without breaking the 50-employee total.
- Supply valid linked payment/audit data where required by invariants. Mark direct bulk fixture insertion as setup rather than claiming it exercises provisioning workflows.
- Include known empty queries, high-cardinality results and low-selectivity status filters. Predeclare query weights rather than selecting the filter with the best improvement afterward.
- Use `.example`/`.test` addresses and synthetic receipts only. No factory data is necessary.
- Verify unique attendance days, positive monetary values, foreign keys, role counts and expected per-employee visibility. Run `ANALYZE` after seeding for both variants.

**Exit:** reseeding produces the same data digest and counts; a reference oracle yields the expected page IDs and dashboard totals.

### Milestone 3 — implement the correctness gate and load harness

Before any timed run, assert:

- Exact ordered IDs and relevant values agree between variants and the reference oracle.
- Cursor traversal covers the expected matching set with no gaps/duplicates, including timestamp ties and empty/end pages.
- RLS allows an employee's own rows and rejects/filters peer access as designed. OWNER and ACCOUNTS visibility matches business policy.
- Dashboard totals use the full matching set, even when action queues are bounded. Financial sums use decimal-safe comparison.
- A 200 response with the wrong body, an empty unintended dataset or a truncated result is a failure.

Use k6 over the HTTP API with normal publishable credentials and preauthenticated access tokens. Never benchmark as service_role or database superuser. Sign in outside the measured region; verify token lifetime is sufficient for the run. If a token expires or refresh is needed during a timed scenario, invalidate that run instead of silently omitting its latency.

Tags should identify variant, operation, role, fixture, concurrency and query class. Do not put access tokens, passwords, employee identifiers or unbounded cursor values into metric tags or result artifacts.

**Exit:** smoke scenarios and all equivalence/authorization assertions pass on both variants. Authentication success is verified separately, without counting Auth time as business-endpoint latency.

### Milestone 4 — capture and freeze the baseline

Primary workload: fixture M, expense page size 50, OWNER role, 20 constant virtual clients. This is a stress benchmark for an internal app, not evidence of 20 real users or 20 requests simultaneously in flight.

Each virtual client repeatedly executes one expense-page operation then waits 200 ms outside its timed operation. Use a deterministic, versioned request schedule containing first and non-first pages, status/date filters and skewed employees. Precompute variant-equivalent cursor boundaries from fixture data. Keep weights identical; compare per-query-class results as well as the aggregate.

Run protocol:

1. Finish setup and correctness checks; ensure no other benchmark variant is running.
2. Warm up for 30 seconds in a separate phase excluded from measurements.
3. Measure for five minutes. Keep connection reuse, think time and workload logic identical.
4. Save HTTP metrics, semantic failure counts, sample counts, query plans and environment metadata.
5. Repeat as part of five matched before/after pairs, alternating or randomizing pair order. Use the same snapshot and equal warmup before each run.
6. If a run has fewer than 2,000 successful samples, increase measured duration for **both** variants in that comparison and rerun. This is a sampling floor, not a guarantee of precise p99 estimates.
7. Perform smaller 1- and 5-client confirmation cases. A 50-client stress case and fixture L are optional follow-ups after the primary result is reproducible.

Capture and freeze an initial baseline series before optimization. Commit/tag the benchmark harness and baseline adapter so they can be reproduced; do not overwrite those outputs after tuning. Once the optimized variant exists, execute the final five matched pairs by rerunning the frozen baseline and optimized variant in alternating/randomized order on equivalent isolated snapshots. The initial series is diagnostic evidence; the final paired series supplies the headline comparison.

**Exit:** baseline samples are valid and repeatable, with a recorded baseline commit and no correctness failures. If baseline performance already satisfies the use case, retain that finding rather than manufacture a larger problem.

### Milestone 5 — optimize one mechanism at a time

Inspect the actual authenticated query plans with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` and equivalent role/claims. A superuser plan without RLS is not the plan the user experiences. If SQL-level profiling substitutes claims, state that diagnostic limitation; the headline remains the HTTP measurement.

Look for sort spills, unnecessary columns, row-estimate errors, excessive scans and expensive RLS/join work. `EXPLAIN ANALYZE` executes the query; use it on isolated data, and do not mix its instrumentation time into the load-run latency.

Optimization sequence:

1. Keep the same output contract while removing accidental redundant query work.
2. Evaluate composite indexes matching the observed filters and ordering. Possible candidates—not instructions to blindly add them—include `(status, created_at DESC, id DESC)` for status-sorted OWNER views and `(submitted_by, created_at DESC, id DESC)` for ownership-scoped views.
3. Add only indexes demonstrated useful by plans and measurements. Record index size and representative insertion/update overhead as tradeoffs.
4. For dashboard retrieval, move full-set counts/sums into a role-checked RPC and return only the declared action-item contract. Preserve authorization and complete totals.
5. Treat caching, if later justified, as a separate experiment with explicit hit/miss and freshness semantics. A cached optimized response cannot be compared silently with an uncached baseline.

After each substantive change rerun correctness tests, inspect plans and perform a short diagnostic. Run the full matched benchmark on the final candidate; do not repeatedly tune against and publish only a favorable single run.

**Exit:** results show what improved and why, with equivalent behavior and the costs of the change disclosed.

### Milestone 6 — summarize and validate the result

Record these metrics separately:

| Metric                       | Definition / reporting rule                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expense API latency          | k6 `http_req_duration`, with p50/p95 and sample count, tagged by endpoint/query/role. It includes sending, waiting and receiving; initial connection establishment is separate. Call this established-connection HTTP API latency. |
| Complete dashboard retrieval | A dedicated group/custom trend spanning its full parallel-request or RPC flow and normalized output. Keep sleep/login outside the timed group.                                                                                     |
| Throughput                   | Successful logical operations per second, plus HTTP requests per second; the two differ for the dashboard.                                                                                                                         |
| Errors                       | HTTP failure rate and semantic failure rate, reported separately. Failed/time-out requests are retained in failure counts and all-attempt latency metrics; successful-only percentiles are additional, clearly labeled.            |
| Payload                      | Response-body bytes per logical operation, with compression/encoding stated; separately report wire-transfer metrics if available. Do not divide connection/header overhead into a JSON-size claim.                                |
| Query evidence               | Execution plans, rows scanned/returned, shared-buffer hits/reads and index size, gathered outside timed load phases.                                                                                                               |
| Resource limits              | Generator/server CPU and memory, connection utilization and saturation observations. If the load generator saturates, the result is invalid for server-capacity conclusions.                                                       |

Do not combine different endpoints, roles, fixtures or concurrency levels into one headline percentile. For each matched condition publish all five before/after p95 values and use the median of those run-level p95 values for the summary comparison. State this aggregation convention. Do not average p95 values and describe that average as a percentile of all requests.

Calculate the summary reduction as:

```text
A = median(the five baseline run p95 values)
B = median(the five optimized run p95 values)
reduction_percent = (A - B) / A * 100
```

Publish per-pair reductions and variation as well. A median improvement is not enough if several runs regress materially; investigate unstable results before writing a resume claim. Do not imply statistical significance merely because five runs were performed.

Constant-client tests are closed-loop: a faster variant can issue more operations in the same time. Keep the achieved throughput alongside latency. As a follow-up, use an arrival-rate scenario at a preselected sustainable offered rate for both variants, recording dropped iterations and errors. This distinguishes fixed-concurrency behavior from equal-arrival-rate behavior; do not call them the same experiment.

**Exit:** a reviewer can recompute the headline, see unfavorable runs, and reproduce the result without hidden inputs.

### Milestone 7 — publish the case study and claim

Create `docs/ferrixOps_API_BENCHMARK_RESULTS.md` containing:

1. Problem and exact user-visible operation.
2. Baseline/optimized commits and migration manifests.
3. Fixture manifest, exact expense count, generator seed and data digest.
4. Hardware, runtime/database/API versions, topology and all run settings.
5. Correctness and authorization results.
6. A before/after table for each matched condition and a plot showing all repeated runs.
7. Query-plan explanation and resource/index/write-cost tradeoffs.
8. Raw artifact locations, reproduction instructions and known limitations.
9. The precise resume bullet the evidence supports.

Example result table — placeholders only:

| Operation                      | Role  | Expense rows | Clients | Baseline p95 | Optimized p95 | Reduction | Successful ops/s | Failures       | Repeats |
| ------------------------------ | ----- | ------------ | ------- | ------------ | ------------- | --------- | ---------------- | -------------- | ------- |
| Filtered expense page, 50 rows | OWNER | 10,000       | 20      | A ms         | B ms          | X%        | before / after   | before / after | 5 pairs |

Headline release gate:

- Same semantics, fixture, role, projection and workload schedule.
- No semantic/authorization failures; HTTP errors/timeouts are disclosed and do not conceal a regression.
- Primary result repeated under the predeclared condition, with sampling floor met.
- No generator saturation, baseline index contamination or missing pagination data.
- All raw measurements and comparison scripts retained locally; only scrubbed, safe artifacts published.
- Local result labeled local. Synthetic rows/virtual clients never called real adoption.

If only the database execution time improves, claim **query execution time**, not API latency. If only Experiment B improves, claim **first-page retrieval/payload**, not a like-for-like query speedup. If the dashboard improves, use its complete-flow label. If latency does not improve reliably, request count, bytes transferred or verified correctness may still be useful outcomes.

## 6. Suggested work packages

| Package | Focus                                              | Completion evidence                                                      |
| ------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| 1       | HTTP-capable local environment, fixture and oracle | Reproducible setup, fixture digests and correct real-role requests       |
| 2       | Baseline service contract and benchmark harness    | Normalized endpoint, complete correctness gate, frozen repeated baseline |
| 3       | Query/index optimization                           | Additive migration, plans and before/after matched runs                  |
| 4       | Dashboard aggregation                              | Equivalent RPC/parallel-flow outputs and separately labeled results      |
| 5       | Case study and regression protection               | Published methodology, scrubbed artifacts and measured resume bullet     |

Do not block the primary expense result on completing dashboard, leave, notifications or a factory pilot. One rigorously measured endpoint is enough for a credible first claim. Extend to EMPLOYEE/ACCOUNTS and other endpoints only after the baseline method works; report those results separately.

CI should enforce fixture/contract correctness and optionally collect small trend samples on a controlled runner. Shared hosted-runner timings are not a reliable strict latency gate. Establish run-to-run variation before setting regression tolerances; never put benchmark account credentials into committed outputs.

## 7. Resume wording after completion

Primary result:

> Reduced p95 expense-list API latency from **[A] to [B] ms ([X]%)** through **[measured optimization]**, benchmarked against **[N] synthetic expenses** with **[C] concurrent virtual clients** in a local Supabase environment.

Dashboard result, separately:

> Consolidated owner-dashboard retrieval from **four requests to one PostgreSQL RPC**, reducing data-retrieval p95 by **[X]%** while preserving aggregate accuracy and role-based access.

The case study should explain that reported p95 values summarize five repeated runs. The resume need not contain the whole procedure, but every number must trace to the saved artifacts. Neither result establishes factory deployment, business hours saved or production throughput.

## 8. Primary technical references

- [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization): query-pattern and index investigation.
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html): execution-plan inspection and instrumentation caveats.
- [k6 constant VUs](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/): fixed virtual-client execution model.
- [k6 built-in metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/): duration, failure, byte and iteration metric definitions.
