# FerrixOps local setup and testing

Follow the [README quick start](../README.md#run-locally) with Docker running. The CLI starts a local stack from [the Supabase configuration](../supabase/config.toml) and applies the migrations on a fresh database. The default API is `http://127.0.0.1:54321`. Use the URL and publishable or anon key from `npx supabase status` in the Vite variables from [the example config](../.env.example). Keep service-role keys server-side.

If you already have a local Supabase project on the default ports, use a separate checkout with a unique `project_id` and unused ports in its local config. Check that Studio, the database, and the app all point at that stack before creating demo records.

## Seed a synthetic expense demo

1. Open the local Studio URL from `npx supabase status`. In **Authentication → Users**, create and confirm `employee@ferrixops.example`, `accounts@ferrixops.example`, and `owner@ferrixops.example` with local-only passwords. The Auth trigger creates their profile rows with the Employee role.
2. Run the SQL below in **SQL Editor** on the disposable local stack. It assigns the reviewer roles and creates the employee record used by the expense submission RPC. The migrations already seed the **Equipment** category.

```sql
UPDATE public.profiles SET role = 'OWNER'
WHERE email = 'owner@ferrixops.example';

UPDATE public.profiles SET role = 'ACCOUNTS'
WHERE email = 'accounts@ferrixops.example';

INSERT INTO public.departments (name) VALUES ('Demo Operations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.designations (name) VALUES ('Demo Operator')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.employees (
    user_id, employee_code, first_name, last_name,
    company_email, department_id, designation_id, joining_date
)
SELECT p.id, 'DEMO-001', 'Casey', 'Operator',
       p.email, d.id, j.id, CURRENT_DATE
FROM public.profiles p
CROSS JOIN public.departments d
CROSS JOIN public.designations j
WHERE p.email = 'employee@ferrixops.example'
  AND d.name = 'Demo Operations'
  AND j.name = 'Demo Operator'
ON CONFLICT (user_id) DO NOTHING;
```

3. Start Vite and follow the [expense walkthrough](WALKTHROUGH.md#follow-one-expense-from-draft-to-paid). Sign out between roles or open separate browser profiles. After **Save Draft**, close the form to use the row's **Submit** action.

### Capture a workflow screenshot

After Owner approval, sign in as Accounts and open **Record Payment** on the synthetic claim. Capture the payment form with the approved amount visible, or capture the expense list after recording payment with the **Paid** status visible. Use a desktop viewport and keep other tabs, real names, credentials, and browser developer tools outside the frame.

## Checks

```bash
npm run lint
npm run build
npm run preview
npm run bench:unit
npm run test:db
```

The [CI workflow](../.github/workflows/ci.yml) runs lint, build, and benchmark unit checks separately from the task database regression suite. The database suite needs Python 3 and local PostgreSQL binaries (`initdb`, `pg_ctl`, and `psql`) with `pgcrypto`. Run it as a normal user. Use `PG_BIN="$(pg_config --bindir)" npm run test:db` to point it at another installation. It creates and removes its own cluster and loads a minimal Auth fixture. Its coverage is limited to the task subsystem.

Use `npm run build -- --manifest` to inspect route chunks and dependencies in `dist/.vite/manifest.json`. The isolated expense API benchmark has a separate [smoke and full-run guide](../benchmarks/README.md).

## Deployment notes

For a staging release, apply the migrations in order to the intended Supabase project and configure Auth site and redirect URLs, sign-up behavior, and the first Owner account. Deploy the [employee provisioning](../supabase/functions/create-employee/index.ts) and [status management](../supabase/functions/update-employee-status/index.ts) Edge Functions with server-side credentials. Verify the private expense-document bucket, metadata policies, and signed downloads.

Build the frontend with the staging API URL and publishable key, serve `dist/`, and rewrite client routes to `/index.html`. Exercise the Owner, Accounts, and Employee flows and record the release revision. The [October implementation review](ferrixOps_REVIEW_2026-10-23.md) and [engineering roadmap](ferrixOps_RESUME_ROADMAP.md) track gaps including placeholder general reports, deferred payroll, document hardening, and stale task-order handling. The [phase completion log](Phase_4_Bills_Expenses_Completion_Log.md) records earlier expense implementation work.
