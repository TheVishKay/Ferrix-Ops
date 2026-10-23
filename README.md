# ferrixOps — Secure Manufacturing Operations Platform

ferrixOps is a React/Supabase internal operations application designed for a 30–50-person manufacturing workforce. Source: [ferrixOps on GitHub](https://github.com/TheVishKay/Alum_Factory_EMS).

Five workflows are implemented in source:

- Employee directory, organization structure and account provisioning/status lifecycle.
- Server-timestamped attendance and owner-reviewed correction requests.
- Leave submission, review and cancellation, including attendance integration.
- Expense submission, accounts/owner review, document attachments and payment records.
- Assigned tasks, validated status transitions, ordering and transactional audit logging.

Implementation does not establish hosted deployment or actual workforce adoption. See the [current review](docs/ferrixOps_REVIEW_2026-10-23.md) for evidence and release gaps, and the [measurable engineering roadmap](docs/ferrixOps_RESUME_ROADMAP.md) for prioritized improvements, benchmark targets and resume templates. Earlier `audit_report.md` and `ferrixOps_CURRENT_STATE_CONTEXT.md` are historical snapshots and contain superseded findings.

## Stack and roles

React 19, Vite 8, React Router, Tailwind CSS 4 and Radix UI; Supabase Auth, PostgreSQL, Storage and Deno Edge Functions. Local Supabase configuration targets PostgreSQL 17.

- **OWNER:** employee administration, approvals and task administration.
- **ACCOUNTS:** financial review/payment and permitted directory/operational access.
- **EMPLOYEE:** self-service attendance, leave, expenses and assigned tasks.

Protected routes provide navigation controls. Database RLS, privileges and RPC role checks enforce authorization independently of the UI. Service-role credentials belong only in server-side functions.

## Local setup

Use a supported Node version compatible with the pinned Vite dependency; CI selects Node 22. The existing package lock is committed.

```bash
npm ci
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.
npm run dev
```

The browser needs valid Supabase configuration to initialize. A publishable/anon key is a client identifier; never put a service-role key in a `VITE_` variable.

```bash
npm run lint
npm run build
npm run preview
```

Pages load through React lazy imports. To inspect production chunk sizes and static dependencies:

```bash
npm run build -- --manifest
# Inspect dist/.vite/manifest.json and its imports graph.
```

## Task database regression suite

Requires Python 3 and local PostgreSQL binaries, including `initdb`, `pg_ctl`, `psql` and the `pgcrypto` extension. Run as a normal user, not root.

```bash
npm run test:db
# For PostgreSQL outside the default macOS installation:
PG_BIN="$(pg_config --bindir)" npm run test:db
```

The runner creates a disposable cluster, loads real core/audit/task migrations and a minimal Supabase auth fixture, reproduces the old null-role reorder bypass, and tests the new fix. It checks authorization, input validation, RLS reads, transactional rollback/audit behavior and concurrent task creation/status transitions. It stops and removes the temporary cluster on completion. It never connects to your existing local or hosted database.

This is focused subsystem coverage, not a test of real JWT validation, every migration, Storage, Edge Functions or all five UI workflows. CI defines separate lint/build and task-database jobs; publishing the workflow and confirming a successful GitHub run remain release steps.

## Supabase and deployment

Use the Supabase CLI for a deliberately selected local/staging project before deploying:

1. Apply the migrations in `supabase/migrations` in order and verify their status. The latest proposed migration, `20261023000001_harden_task_ordering.sql`, is tested locally but has not been applied to hosted Supabase by this review.
2. Configure Supabase Auth site/redirect URLs, email/password policy and signup behavior for your internal application.
3. Bootstrap the first OWNER account through trusted administrative tooling; standard signups default to EMPLOYEE.
4. Deploy `create-employee` and `update-employee-status` Edge Functions with their required server-side environment configuration. Keep administrative secrets out of source and client bundles.
5. Verify the private `expense-documents` bucket and its metadata/storage policies. Downloads use signed URLs.
6. Deploy `dist/` to the selected static host, set the two frontend environment variables and rewrite client routes to `/index.html`.
7. Run OWNER, ACCOUNTS and EMPLOYEE acceptance/security checks in staging, then record the release commit and actual deployment evidence.

No hosting provider or live deployment has been independently verified here. Do not treat a successful frontend build as deployment validation.

## Current limits

- General Reports still contains hardcoded report counts and planned analytics; Leave Reports lists actual requests. Full report export/scheduling is deferred.
- Payroll is specified but not implemented. Notifications and appearance preferences are deferred; Settings does implement account identity and password updates.
- Owner emergency-contact visibility, missing-day attendance correction, pagination/date-window queries and cross-module integration tests need attention.
- Provisioning uses compensating Auth rollback rather than a distributed transaction. Document MIME metadata and storage-orphan cleanup need further hardening.
- The new ordering lock serializes create/reorder operations. Arbitrary reorder positions can still collide, and stale client conflict handling needs a defined policy.

The review distinguishes achieved measurements from proposed targets and provides resume wording that does not imply unmeasured adoption, latency improvements or production impact.
