# Automated local expense API benchmark

No factory deployment, active users, hosted Supabase project or production data is required. The runner creates a **new temporary local Supabase project** for each invocation and removes that project's containers/volumes afterward. Docker Desktop must be running.

The [completed five-pair study](../docs/ferrixOps_API_BENCHMARK_RESULTS.md) and [retained evidence](evidence/2026-11-04-policy-initplan/) report the observed 65.8% mixed-workload p95 reduction and the query classes that regressed.

## Commands

Use Node 22+ and install the committed dependency lock:

```bash
npm ci
npm run bench:unit
npm run bench:smoke
# Once smoke succeeds, on a quiet machine:
npm run bench:full
```

Supabase CLI and the PostgreSQL setup client are pinned development dependencies. The load generator is Node's built-in HTTP fetch implementation with a monotonic `performance.now()` clock. Unlike the initial roadmap's k6 proposal, this implementation needs no separate k6 installation. The metric is **complete HTTP response duration including connection establishment when needed**, not k6's established-connection `http_req_duration`.

First startup downloads the official local-stack container images using a temporary Docker client configuration for anonymous public-image pulls. It does not consult stored registry credentials or modify your Docker settings. Only the generated loopback API/database addresses are accepted. The runner never reads `.env`, links a hosted project, runs `db push`, or resets the regular local project. The isolated baseline migration chain includes the application's Storage policies; the selected optimization migration is intentionally withheld until the candidate phase. Optional UI/analytics/edge services are excluded from startup. Administrative credentials are used only for synthetic setup and remain in memory.

| Setting                       | Smoke                                      | Full                                        |
| ----------------------------- | ------------------------------------------ | ------------------------------------------- |
| Synthetic expense rows        | 1,000                                      | 10,000                                      |
| Synthetic employees           | 50                                         | 50                                          |
| Primary measured role         | OWNER                                      | OWNER                                       |
| Concurrent virtual clients    | 2                                          | 20                                          |
| Warmup per run                | 1 second                                   | 30 seconds                                  |
| Measurement per run           | 3 seconds                                  | 5 minutes                                   |
| Think time between operations | 20 ms                                      | 200 ms                                      |
| Matched pairs                 | 1                                          | 5                                           |
| Expected measured duration    | About 8 seconds, plus startup/setup/checks | About 55 minutes, plus startup/setup/checks |

Virtual clients are concurrent loops, not actual users or a guarantee of that many in-flight requests. OWNER load clients intentionally share one authenticated synthetic OWNER; correctness tests separately authenticate ACCOUNTS, two EMPLOYEEs, a missing-profile user and anonymous/invalid-token callers. Distinct per-client EMPLOYEE load is a future extension, not current coverage.

## What is compared

Both variants execute the **same normalized benchmark query** through PostgREST:

- An explicit expense/employee projection and page size of 50.
- Stable `created_at DESC, id DESC` sorting and keyset pagination.
- Three filter classes (all, paid, submitted/date-window), each with first/middle/deep pages; the schedule and expected responses are generated from the same deterministic fixture.
- Real Auth access tokens and existing RLS policies; no service-role key in measured requests.

**Baseline:** original expense SELECT policies. **Candidate:** the actual `20261104000001_optimize_expense_read_policies.sql` migration, which wraps the identity-only `get_my_role()` calls in scalar subqueries in the OWNER/ACCOUNTS read policies. PostgreSQL can evaluate these once per statement rather than repeatedly per scanned row. The status/ownership predicates, roles, commands and grants are preserved; no indexes are added. Original policy expressions are restored before every baseline phase. The runner also asserts that policy counts/commands/roles, unrelated expressions, table grants and RLS enablement remain unchanged. Pair order alternates to reduce ordering bias.

This is not a benchmark of the original unpaginated browser screen, and the normalized query has not replaced that screen. The dashboard, write concurrency, task-board loading, browser rendering, arrival-rate scenarios and hosted performance are outside this first implementation. Expense data is synthetic and bulk-seeded; creation workflows are not exercised by the seed.

Before timing each variant, the runner verifies ordered response values, complete pagination, empty results, employee isolation, ACCOUNTS own-draft semantics, missing-profile access and anonymous/invalid-token behavior against an independent fixture oracle. Correctness checks must succeed for the load phase to run. Every measured response is also checked against its expected digest.

Fixture timestamps deliberately contain ties, statuses vary within employees and ownership is skewed. All fixture rows are verified after storage and `ANALYZE` runs for both variants. Only expense-related data is populated; this is not the multi-workflow fixture described as a future extension in the roadmap.

## Reports and raw evidence

Each invocation writes an ignored `benchmarks/results/<run-id>/` directory containing:

- `manifest.json`: fixture/source/migration hashes, versions, hardware, configuration and Git revision/dirty status. No passwords, tokens or API keys.
- `<pair>-<variant>.json`: correctness-check count, index definitions/sizes, CPU/event-loop observations, representative authenticated SQL plan, latency/throughput/bytes and per-query-class metrics.
- `<pair>-<variant>.samples.ndjson.gz`: scrubbed per-operation duration, status, correctness, query class and response-body byte count. No response bodies or credentials.
- `comparison.json` and `report.md`: every paired result, median run-level p95 and reasons the automated claim gate did not pass.
- `aborted.json` if setup, correctness, load or cleanup fails. Aborted output is not a benchmark result.

The response timer covers fetch start through body consumption and excludes JSON parsing/assertions. Body bytes use identity encoding requested by the client; this is not a total wire/header/TLS byte measure. Failed attempts remain in all-attempt latency and failure counts; successful-only p95 is separately labeled. Throughput uses actual wall time including final request drainage/think time. Closed-loop variants may achieve different request rates, which are disclosed.

Smoke mode is **never eligible for a resume latency claim**. Full mode requires a committed source tree, five pairs, at least 2,000 successes per run, zero measured HTTP/semantic failures, no flagged generator saturation, a positive median p95 improvement and no pair regression above 5%. Passing these checks means **candidate for human review**, not automatic proof of statistical significance or production capacity. Inspect CPU/memory contention, per-query results and run variation. Same-machine Docker tests include contention between generator and backend; do not generalize to hosted latency.

An initial index-only diagnostic at commit `b834566` produced no improvement and still used full scans with repeated role-helper evaluation. That exploratory run was intentionally stopped after one completed pair, retained as diagnostic evidence, and excluded from the confirmatory policy-optimization results.

Representative SQL plans are diagnostics with authenticated role/claims; they are not the exact PostgREST embedded-query plan. Existing database-only task checks remain separate. Full-stack startup can expose migration issues that the focused task fixture did not cover; such failures stop measurement rather than being bypassed.

Do not commit raw local CLI status, temporary project config or authentication output. Results are gitignored by default. Review generated reports before explicitly selecting artifacts for publication.

## Automation

Unit tests run with the frontend CI job. The manually dispatched **Expense API benchmark** workflow runs smoke or full mode on an ephemeral GitHub runner and uploads only the generated evidence directory. This is a repeatability check; shared-runner timing is not a strict production performance gate or a valid comparison with laptop runs. The full workflow is not scheduled automatically.

## Troubleshooting

- **Docker unavailable:** start the installed engine, then rerun. No hosted deployment is needed.
- **First startup is slow:** container downloads can take several minutes. The runner emits startup progress and has a bounded command timeout.
- **Migration or RLS failure:** keep the aborted report and fix/reproduce the cause before timing. Do not disable authorization to get a faster result.
- **No improvement:** retain the negative result. Inspect plans and workload selectivity; policy tuning is a candidate, not a guaranteed speedup.
- **Cleanup failure:** the runner prints only the temporary project ID/workdir. Run `npx supabase stop --no-backup --workdir <that-exact-workdir>` to stop that project. Do not use a global/all-project cleanup command.

For the larger methodology and future experiments, see the [benchmark roadmap](../docs/ferrixOps_API_BENCHMARK_ROADMAP.md).

## Verify retained evidence without Docker

```bash
python3 benchmarks/verify_results.py benchmarks/evidence/2026-11-04-policy-initplan/confirmatory
node benchmarks/plot-results.mjs benchmarks/evidence/2026-11-04-policy-initplan/confirmatory
```

The independent verifier uses Python standard-library code and the recorded Git history. The static SVG charts use the existing Recharts dependency; no plotting package installation is required.
