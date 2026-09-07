-- Grant the minimum PostgreSQL privileges required by the
-- create-employee Edge Function and its compensating rollback.

GRANT SELECT, INSERT, DELETE
ON public.employees
TO service_role;

GRANT SELECT, INSERT, DELETE
ON public.employee_personal_info
TO service_role;

GRANT INSERT
ON public.audit_logs
TO service_role;
