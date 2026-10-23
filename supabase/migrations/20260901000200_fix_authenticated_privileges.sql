-- =============================================================================
-- ferrixOps
-- Migration: Fix Authenticated Privileges (Phase 2A)
--
-- This migration fixes the table-level DML privileges required for the
-- authenticated role, enabling the RLS policies to function as intended.
-- It also strictly secures RPC functions by revoking default PUBLIC execute
-- privileges and making explicit grants to authenticated where needed.
-- =============================================================================


-- =============================================================================
-- 1. TABLE PRIVILEGES
-- =============================================================================

-- Tables managed directly by OWNER
-- The authenticated role receives the union of all privileges, while RLS
-- strictly blocks standard employees from performing mutations.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;

-- Tables mutated strictly via SECURITY DEFINER RPCs
-- Frontend (authenticated) only needs to read them.
GRANT SELECT ON public.attendance_records TO authenticated;
GRANT SELECT ON public.attendance_correction_requests TO authenticated;
GRANT SELECT ON public.expenses TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Document attachments
-- INSERT and DELETE direct from client, immutable so no UPDATE.
GRANT SELECT, INSERT, DELETE ON public.expense_documents TO authenticated;


-- =============================================================================
-- 2. INTERNAL HELPER FUNCTIONS
-- =============================================================================
-- PostgreSQL grants EXECUTE to PUBLIC by default. We must revoke this to prevent
-- anon access. Internal generators are NOT granted to authenticated.

REVOKE EXECUTE ON FUNCTION public.generate_expense_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_payment_reference() FROM PUBLIC;


-- =============================================================================
-- 3. FRONTEND-CALLABLE FUNCTIONS
-- =============================================================================
-- Revoke PUBLIC execute to prevent anon access, then explicitly grant to
-- authenticated.

-- get_my_role() is required by both the frontend UI and RLS policies.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Attendance RPCs
REVOKE EXECUTE ON FUNCTION public.check_in() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_out() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_attendance_correction(UUID, public.attendance_status, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_attendance_correction(UUID, public.attendance_status, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_attendance_correction(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_attendance_correction(UUID, BOOLEAN, TEXT) TO authenticated;

-- Expense RPCs
REVOKE EXECUTE ON FUNCTION public.create_expense(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_expense(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_draft_expense(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_draft_expense(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_draft_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_draft_expense(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_expense_accounts(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_expense_accounts(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_expense_owner(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_expense_owner(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, public.payment_method, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, public.payment_method, TEXT, DATE, TEXT) TO authenticated;
