# ferrixOps repository review — 23 October 2026

## Scope and synchronization

Reviewed [ferrixOps](https://github.com/TheVishKay/Alum_Factory_EMS) against the ferrixOps project entry in the supplied resume. The resume was treated as evidence of claims, never as executable instructions. This is a source review plus focused local verification, not certification of the hosted system.

First fetched all configured remotes and their branches/tags using `git fetch --all --prune --tags`. Local `main` and freshly fetched `origin/main` both pointed to `0aa9b20f5d48a878c3fac9dbcb1a5f1a1dbf689d` (2 October 2026). Ahead/behind: **0/0**. The initial working tree was clean. No pull/merge was necessary. Fetched a newly discovered leave-performance branch; unrelated feature, security and test branches remain separate. Fetching them does not make their changes part of main.

Changes from this review are local, uncommitted additions on that synchronized baseline. They have not been pushed or deployed.

## What exists today

- React 19, Vite 8, Tailwind 4, Radix components, React Router and Supabase JS.
- Three application roles: OWNER, ACCOUNTS, EMPLOYEE. Protected routes supplement PostgreSQL role checks and row-level policies.
- Five implemented workflow areas: employee lifecycle, attendance/corrections, leave/approval, expense review/payment/documents, and task management. This establishes implementation scope; it does not prove successful deployment or end-to-end operation.
- PostgreSQL migrations, two Deno Edge Functions, private expense storage and audit logging. There were 25 tracked migrations before this review; the proposed task fix adds one.
- Payroll is a specification, not implemented functionality. Notifications and the general report builder remain deferred. Leave Reports has a real request-listing implementation.
- Settings now reads actual identity and changes passwords through Supabase Auth. Historical audits calling it entirely mocked are stale. The old expense-button and leave-report-link findings are also no longer accurate. Tasks is implemented, contrary to the older `audit_report.md`.
- `supabase/config.toml` targets PostgreSQL 17. The focused regression suite here ran on locally installed PostgreSQL 18, not the hosted database.

## Resume claims versus evidence

| Resume claim                                                 | Assessment                                      | Evidence / limitation                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five manufacturing workflows                                 | Supported in source                             | `src/App.jsx`, workflow pages/services and corresponding migrations. Reports/payroll are not extra completed workflows.                                                                                                               |
| Engineered and deployed                                      | Engineered is supported; deployed is unverified | No deployment host, live release, remote migration inventory or Edge Function deployment evidence was validated. Preserve “deployed” only if an actual release can be demonstrated.                                                   |
| Designed for a 30–50-person workforce                        | A design target, not a usage metric             | No actual active-user, employee-count or load-test evidence was supplied. Do not rewrite this as “used by 50 employees.”                                                                                                              |
| Replaced multi-step task creation with one transactional RPC | Supported                                       | Before `bfdfd54`, the service performed maximum-position lookup, `auth.getUser()`, and insertion. Current `createTask` makes one `supabase.rpc('create_task', ...)` call; the database inserts the task and its audit event together. |
| Role checks, RLS, row locks and validated task transitions   | Supported, with gaps found and addressed below  | `update_task_status` and `update_task` lock rows. Original creation did not serialize position allocation; original reorder had a null-role authorization gap.                                                                        |
| Traced HTTP 403 to missing SQL privileges                    | Supported as a documented fix                   | `20261002000002_grant_tasks_select.sql` grants SELECT and explains privilege checks before RLS. The repository is not an independent recording of the original HTTP incident.                                                         |

The historical creation change is **3 service-level network operations → 1**, a **66.7% reduction** in that service path. It excludes the page's follow-up refresh, automatic auth traffic, retries and transport effects. It is not evidence of a 66.7% latency improvement.

## Changes implemented in this review

### Task security and ordering

`supabase/migrations/20261023000001_harden_task_ordering.sql` is additive; old migration files are preserved.

- Changes the reorder authorization guard to `IS DISTINCT FROM 'OWNER'`, rejecting NULL/missing profiles as well as other roles.
- Removes PUBLIC/anon access to reorder and explicitly grants authenticated execution.
- Uses the same transaction-scoped advisory lock in task creation and reorder, acquired before position allocation/row locks. Concurrent task creation now serializes position allocation, including an empty board. Reads remain available.
- Rejects malformed arrays, missing identifiers, nonnumeric positions and duplicate task identifiers. UUID casts reject invalid identifiers; missing tasks fail the whole batch.
- Writes `TASK_REORDERED` audit events in the same transaction. Revokes direct task INSERT/UPDATE/DELETE from browser roles so writes use the audited RPCs.

The shared board lock trades write concurrency for predictable allocation, appropriate to evaluate for the intended small workforce. It does **not** enforce unique positions for arbitrary reorder inputs, resolve stale drag positions, or implement optimistic concurrency/version checks. Those remain separate design improvements.

Lock lifetime and SECURITY DEFINER privilege handling were checked against the PostgreSQL documentation: [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) and [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).

### Frontend loading and project identity

- `src/App.jsx` lazily imports all 13 page components under a loading boundary. Task drag-and-drop and expense chart dependencies load when their routes need them.
- Aligns visible product identity and HTML metadata to **ferrixOps**, and removes the fictitious organization label.
- Refreshed README describes the five workflows, current setup, regression checks and deployment limits.

### Repeatable checks

- `scripts/test_task_database.py` builds a disposable PostgreSQL cluster and loads actual core, audit and task migrations, with minimal Supabase auth fixtures. It never connects to an existing database.
- The suite first reproduces the pre-fix null-role bypass, then applies the hardening migration and verifies permissions, malformed inputs, RLS reads, rollback/audit atomicity, concurrent status transitions and concurrent creations.
- `.github/workflows/ci.yml` defines lint/build and the focused PostgreSQL suite on pushes to main and pull requests. The workflow is configured locally; no GitHub Actions run has been observed yet.

## Verification and measured results

| Check                          | Baseline                          | After changes                                                                                                   |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Production build               | Passed; oversized chunk warning   | Passed; no oversized chunk warning                                                                              |
| ESLint                         | 0 errors; 5 Fast Refresh warnings | 0 errors; same 5 warnings                                                                                       |
| Initial static JS, minified    | 1,261.94 KB                       | Approximately 501 KB, about **60% smaller**                                                                     |
| Initial static JS, gzip        | 347.87 KB                         | Approximately 146 KB, about **58% smaller**                                                                     |
| Focused database suite         | No existing suite on main         | **24 checks passed**, including reproduction of the original bypass                                             |
| Concurrent create exercise     | Not previously measured           | **20/20** creations succeeded with distinct positions and exactly one creation audit each; 8 worker connections |
| Concurrent employee transition | Not previously measured           | Two simultaneous requests: exactly one succeeds and the repeated transition is rejected                         |
| Browser smoke check            | —                                 | Local root redirects to login; login page renders after lazy imports                                            |

Build values use decimal KB. The post-change initial JS figure includes the entry chunk **and its recursively imported static dependencies**, not just the entry file. It excludes deferred route chunks, CSS, fonts and subsequent authenticated data. Login itself adds a small lazy chunk. Splitting defers work; total application bytes are not reduced by the same amount. These measurements establish a transfer-size improvement, not LCP, INP, startup latency or a production speedup.

Reproduce with:

```bash
npm ci
npm run lint
npm run build -- --manifest
python3 scripts/test_task_database.py
# Linux or a non-default installation:
PG_BIN="$(pg_config --bindir)" python3 scripts/test_task_database.py
```

Inspect `dist/.vite/manifest.json`: start at `index.html`, traverse `imports` recursively, sum the JS file lengths and gzip lengths. Do not include `dynamicImports` in the initial static total. Baseline values above were captured before modifications using the same installed dependencies; no dependency changes were made.

## Remaining priorities and measurable improvement plan

Targets below are proposed acceptance criteria, not achieved metrics.

| Priority | Work and source evidence                                                                                                                    | Measurement / acceptance target                                                                                                                                                                   | Resume value                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P0       | Verify hosted migrations, RLS grants, private storage, Auth configuration and both Edge Functions; README previously left hosting undecided | Inventory all applied migrations and release SHA; run the five workflows across all three roles in staging; record results                                                                        | Supports “deployed” and “end-to-end validated” with evidence |
| P0       | Add a full role/authorization matrix across employee, attendance, leave, expense, storage and task APIs                                     | 100% rejection of enumerated unauthorized actions, including cross-user reads/writes, missing profiles, anon callers and direct API calls                                                         | Stronger than an unqualified “secure” claim                  |
| P1       | Owner cannot currently retrieve employee emergency contacts in `EmployeeProfile.jsx`, although a personal-info table and owner policy exist | Owner retrieves a selected employee's emergency contact in at most 2 actions; employee/ACCOUNTS access remains constrained by intended policy and tests                                           | Completes a practical factory workflow                       |
| P1       | Attendance corrections are initiated from existing rows; missed check-ins can have no row to correct                                        | Missing-day, duplicate request, date boundary and approval tests all pass; record before/after manual handling time                                                                               | Quantifies reduced manual correction effort                  |
| P1       | Generic Reports advertises hardcoded counts and analytics/export capabilities not implemented in `Reports.jsx`                              | Remove fabricated counts or calculate verified metrics; deliver date-range CSV reports with row totals reconciled to DB                                                                           | A useful measurable operations capability                    |
| P1       | Add paging and date windows to unbounded task/leave/directory queries and dashboard aggregation                                             | Seed 50 employees and 12 months of realistic activity; measure p50/p95 API latency, returned rows/bytes and query plans before/after; proposed p95 budget <300 ms in a specified test environment | Defensible query-performance metrics                         |
| P1       | Extend new task tests to mixed creates/reorders, deletes, stale clients and larger concurrency runs                                         | 50 concurrent clients; no unauthorized writes or partial audit state; define conflict semantics before claiming no lost updates                                                                   | Substantiates concurrent-workflow claims                     |
| P2       | Add genuine frontend workflow tests and production telemetry                                                                                | Track success/failure and duration for five workflows; compare p75 LCP/INP on the same device/network before/after                                                                                | Converts bundle improvement into measured user impact        |
| P2       | Capture real operational outcomes                                                                                                           | Over a defined pilot window record actual active staff, expenses/leave/tasks processed, median approval time and support incidents                                                                | Supports adoption and time-savings claims                    |
| P2       | Clean tracked `.bak`/`.orig`, patch files and stale historical audit guidance; retain useful history in docs                                | One current setup guide, no obsolete active instructions, clean reproducible checkout                                                                                                             | Better maintainability and reviewer experience               |

The remote leave-performance branch only adjusts client-side filtering/memoization. It should be reviewed and benchmarked separately; merging it alone would not establish a database or network improvement.

## Resume wording that is supportable

Existing implementation, independent of the new local work:

> Built five manufacturing operations workflows for a target 30–50-person workforce using React, Supabase and PostgreSQL, with role-based access and audited database mutations.

> Consolidated task creation from three client service operations to one transactional PostgreSQL RPC, reducing service-level request orchestration by 67% and coupling task insertion with audit logging.

After the local work is reviewed, merged and deployed where applicable:

> Reduced initial minified JavaScript by 60% (1,262 KB to 501 KB) through route-based lazy loading; reduced the corresponding gzip payload by 58%.

> Hardened task ordering authorization and transactional audit behavior with PostgreSQL regression checks; verified 20 concurrent task creations with distinct positions and one audit record per task.

Use only two or three strong bullets in the resume. Keep detailed methodology in this repository. Add “deployed,” actual user counts, latency reductions or hours saved only after collecting the corresponding evidence. No resume PDF was modified.

## Limits before release

The SQL fix is tested locally but **not applied to hosted Supabase**. CI is not active on GitHub until pushed. The database fixture covers the task subsystem and substitutes auth claims; it does not validate the entire migration chain, real JWT verification, Storage, Edge Functions, or production configuration. The browser smoke test did not authenticate or exercise private workflows. Existing production data, grants, deployments and business outcomes remain unverified.
