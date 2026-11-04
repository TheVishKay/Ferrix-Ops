-- ferrixOps: evaluate identity-only role helpers once per statement.
-- get_my_role() is STABLE and takes no row-dependent arguments. Scalar
-- subqueries let PostgreSQL use initPlans instead of repeated per-row calls.
-- Policy roles, commands, grants, ownership access and status rules stay intact.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security-performance
BEGIN;

ALTER POLICY "Accounts view submitted expenses" ON public.expenses
USING (
    (SELECT public.get_my_role()) = 'ACCOUNTS'::public.app_role
    AND status <> 'DRAFT'::public.expense_status
);

ALTER POLICY "Owner views all expenses" ON public.expenses
USING ((SELECT public.get_my_role()) = 'OWNER'::public.app_role);

COMMIT;
