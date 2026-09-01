-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration 004: Security, RLS, and Application Functions
--
-- Modules:
--   - Row Level Security (RLS) — enabled on all 10 application tables
--   - RLS policies for all roles (OWNER, ACCOUNTS, EMPLOYEE)
--   - Expense number / payment reference generators
--   - Canonical expense workflow RPC functions
--   - GRANT EXECUTE for all frontend-callable RPCs
--
-- SECURITY ARCHITECTURE:
--
--   get_my_role() is defined in Migration 001 as SECURITY DEFINER.
--   It reads public.profiles directly, bypassing RLS on that table.
--   This prevents infinite recursion when profiles RLS policies
--   themselves need to call get_my_role().
--
--   All workflow state transitions occur exclusively through
--   SECURITY DEFINER RPC functions defined in this migration.
--
--   RLS default-deny: when RLS is enabled and no applicable policy
--   exists for an operation, PostgreSQL denies by default.
--   Therefore, tables with only SELECT policies implicitly deny
--   all INSERT / UPDATE / DELETE from the client.
-- =============================================================================


-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
--
-- Enable on all 10 application tables.
-- Policies follow immediately below.
-- =============================================================================


ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.designations
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employees
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_records
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_correction_requests
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.expense_categories
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.expenses
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.expense_documents
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments
ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- RLS POLICIES: PROFILES
--
-- SELECT:
--   Each user can read their own profile.
--   OWNER can read all profiles (needed for user management UI).
--
-- INSERT:
--   No policy — denied by default.
--   Profile creation is handled exclusively by the
--   on_auth_user_created trigger (SECURITY DEFINER).
--   This trigger always sets role = 'EMPLOYEE'.
--
-- UPDATE / DELETE:
--   No policies — denied by default.
--   This prevents the critical privilege escalation attack:
--
--     UPDATE public.profiles SET role = 'OWNER' WHERE id = auth.uid();
--
--   Any profile updates must go through SECURITY DEFINER RPCs
--   that explicitly exclude the role column.
-- =============================================================================


CREATE POLICY "Users read own profile"

ON public.profiles

FOR SELECT

TO authenticated

USING (
    id = auth.uid()
);


CREATE POLICY "Owner reads all profiles"

ON public.profiles

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: DEPARTMENTS
--
-- SELECT:
--   All authenticated users can read departments.
--   Required for dropdown menus when creating/editing employees.
--
-- INSERT / UPDATE / DELETE:
--   OWNER only. All other roles denied by default.
-- =============================================================================


CREATE POLICY "Authenticated users read departments"

ON public.departments

FOR SELECT

TO authenticated

USING (TRUE);


CREATE POLICY "Owner manages departments"

ON public.departments

FOR ALL

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
)

WITH CHECK (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: DESIGNATIONS
--
-- SELECT:
--   All authenticated users can read designations.
--   Required for dropdown menus when creating/editing employees.
--
-- INSERT / UPDATE / DELETE:
--   OWNER only. All other roles denied by default.
-- =============================================================================


CREATE POLICY "Authenticated users read designations"

ON public.designations

FOR SELECT

TO authenticated

USING (TRUE);


CREATE POLICY "Owner manages designations"

ON public.designations

FOR ALL

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
)

WITH CHECK (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: EMPLOYEES
--
-- SELECT:
--   EMPLOYEE can read their own employee record.
--   OWNER can read all employee records.
--   ACCOUNTS can read all employee records (required for
--   accounting workflows: identifying payees, verifying submitter).
--
-- INSERT / UPDATE / DELETE:
--   OWNER only. Pragmatic V1 decision: no employee management
--   RPCs have been defined yet, so the OWNER is granted direct
--   write access. EMPLOYEE and ACCOUNTS are denied by default.
-- =============================================================================


CREATE POLICY "Employee reads own record"

ON public.employees

FOR SELECT

TO authenticated

USING (
    user_id = auth.uid()
);


CREATE POLICY "Privileged roles read all employees"

ON public.employees

FOR SELECT

TO authenticated

USING (
    public.get_my_role() IN ('OWNER', 'ACCOUNTS')
);


CREATE POLICY "Owner manages employees"

ON public.employees

FOR ALL

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
)

WITH CHECK (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: ATTENDANCE RECORDS
--
-- SELECT:
--   EMPLOYEE can view their own attendance records only.
--   OWNER can view all attendance records.
--   ACCOUNTS can view all attendance records (required for
--   payroll and salary computation workflows).
--
-- INSERT / UPDATE / DELETE:
--   No policies — denied by default for all roles.
--   All attendance mutations go through SECURITY DEFINER RPCs:
--     check_in()                       — employee self-service
--     check_out()                      — employee self-service
--     review_attendance_correction()   — OWNER only
--
--   This prevents direct manipulation such as:
--     UPDATE attendance_records SET status = 'PRESENT' WHERE ...
-- =============================================================================


CREATE POLICY "Employee views own attendance"

ON public.attendance_records

FOR SELECT

TO authenticated

USING (

    employee_id IN (

        SELECT id

        FROM public.employees

        WHERE user_id = auth.uid()

    )

);


CREATE POLICY "Owner views all attendance"

ON public.attendance_records

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


CREATE POLICY "Accounts views all attendance"

ON public.attendance_records

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'ACCOUNTS'
);


-- =============================================================================
-- RLS POLICIES: ATTENDANCE CORRECTION REQUESTS
--
-- SELECT:
--   EMPLOYEE can view their own correction requests.
--   OWNER can view all correction requests (for review workflow).
--   ACCOUNTS has no access to correction requests.
--
-- INSERT / UPDATE / DELETE:
--   No policies — denied by default for all roles.
--   All correction mutations go through SECURITY DEFINER RPCs:
--     request_attendance_correction()  — employee initiates
--     review_attendance_correction()   — OWNER approves/rejects
--
--   This prevents self-approval attacks such as:
--     UPDATE attendance_correction_requests
--     SET status = 'APPROVED' WHERE id = '<own_request_id>';
-- =============================================================================


CREATE POLICY "Employee views own correction requests"

ON public.attendance_correction_requests

FOR SELECT

TO authenticated

USING (

    employee_id IN (

        SELECT id

        FROM public.employees

        WHERE user_id = auth.uid()

    )

);


CREATE POLICY "Owner views all correction requests"

ON public.attendance_correction_requests

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: EXPENSE CATEGORIES
--
-- SELECT:
--   All authenticated users can read active categories.
--   Required for expense creation dropdown.
--
-- INSERT / UPDATE / DELETE:
--   OWNER only. All other roles denied by default.
-- =============================================================================


CREATE POLICY "Authenticated users read expense categories"

ON public.expense_categories

FOR SELECT

TO authenticated

USING (TRUE);


CREATE POLICY "Owner manages expense categories"

ON public.expense_categories

FOR ALL

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
)

WITH CHECK (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: EXPENSES
--
-- SELECT:
--   EMPLOYEE can view all of their own expenses (all statuses,
--   including DRAFT — the employee created them and they are
--   private work-in-progress until submitted).
--
--   ACCOUNTS can view expenses with status != DRAFT.
--   DRAFTs are private to the employee. ACCOUNTS only needs
--   visibility once an expense enters the review workflow
--   (SUBMITTED and beyond).
--
--   OWNER can view all expenses at all statuses.
--
-- INSERT / UPDATE / DELETE:
--   No policies — denied by default for all roles.
--   All expense mutations go through SECURITY DEFINER RPCs.
--   This prevents:
--     UPDATE expenses SET status = 'PAID' WHERE id = '...';
-- =============================================================================


CREATE POLICY "Employees view own expenses"

ON public.expenses

FOR SELECT

TO authenticated

USING (

    submitted_by IN (

        SELECT id

        FROM public.employees

        WHERE user_id = auth.uid()

    )

);


CREATE POLICY "Accounts view submitted expenses"

ON public.expenses

FOR SELECT

TO authenticated

USING (

    public.get_my_role() = 'ACCOUNTS'

    AND status != 'DRAFT'

);


CREATE POLICY "Owner views all expenses"

ON public.expenses

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: EXPENSE DOCUMENTS
--
-- SELECT:
--   Users can view documents for expenses they are permitted to see.
--   The expense visibility rules (above) govern indirectly.
--
-- INSERT:
--   EMPLOYEE can upload documents for their own expenses
--   (any workflow status — additional docs may be needed after
--   submission if accounts/owner requests them).
--   OWNER and ACCOUNTS can upload documents for any expense
--   they can see (e.g., adding audit documentation).
--   The uploaded_by column must always equal auth.uid().
--
-- UPDATE:
--   No policies — denied by default. Documents are immutable
--   once uploaded (replace by delete + re-upload).
--
-- DELETE:
--   EMPLOYEE can delete their own uploaded documents,
--   but only while the expense is still in DRAFT status.
--   OWNER can delete any document.
-- =============================================================================


CREATE POLICY "Users view accessible expense documents"

ON public.expense_documents

FOR SELECT

TO authenticated

USING (

    EXISTS (

        SELECT 1

        FROM public.expenses e

        WHERE e.id = expense_id

        AND (

            e.submitted_by IN (

                SELECT id

                FROM public.employees

                WHERE user_id = auth.uid()

            )

            OR public.get_my_role() IN ('OWNER', 'ACCOUNTS')

        )

    )

);


CREATE POLICY "Employees upload documents for own expenses"

ON public.expense_documents

FOR INSERT

TO authenticated

WITH CHECK (

    uploaded_by = auth.uid()

    AND EXISTS (

        SELECT 1

        FROM public.expenses e

        JOIN public.employees emp

        ON emp.id = e.submitted_by

        WHERE e.id = expense_id

        AND emp.user_id = auth.uid()

    )

);


CREATE POLICY "Privileged users upload expense documents"

ON public.expense_documents

FOR INSERT

TO authenticated

WITH CHECK (

    uploaded_by = auth.uid()

    AND public.get_my_role() IN ('OWNER', 'ACCOUNTS')

);


CREATE POLICY "Employees delete own documents from draft expenses"

ON public.expense_documents

FOR DELETE

TO authenticated

USING (

    uploaded_by = auth.uid()

    AND EXISTS (

        SELECT 1

        FROM public.expenses e

        JOIN public.employees emp

        ON emp.id = e.submitted_by

        WHERE e.id = expense_id

        AND emp.user_id = auth.uid()

        AND e.status = 'DRAFT'

    )

);


CREATE POLICY "Owner deletes expense documents"

ON public.expense_documents

FOR DELETE

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


-- =============================================================================
-- RLS POLICIES: PAYMENTS
--
-- SELECT:
--   ACCOUNTS and OWNER can view all payments.
--   EMPLOYEE can view payments for their own expenses only.
--
-- INSERT / UPDATE / DELETE:
--   No policies — denied by default for all roles.
--   Payment creation goes through record_payment() (ACCOUNTS-only).
-- =============================================================================


CREATE POLICY "Accounts view payments"

ON public.payments

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'ACCOUNTS'
);


CREATE POLICY "Owner views payments"

ON public.payments

FOR SELECT

TO authenticated

USING (
    public.get_my_role() = 'OWNER'
);


CREATE POLICY "Employees view own expense payments"

ON public.payments

FOR SELECT

TO authenticated

USING (

    EXISTS (

        SELECT 1

        FROM public.expenses e

        JOIN public.employees emp

        ON emp.id = e.submitted_by

        WHERE e.id = expense_id

        AND emp.user_id = auth.uid()

    )

);


-- =============================================================================
-- EXPENSE NUMBER GENERATOR
--
-- Example output: EXP-20260901-0001
--
-- Implementation note:
--   Uses COUNT()+1 for simplicity. For a ~40-user internal system
--   this is acceptable. The UNIQUE constraint on expense_number is
--   the integrity backstop if two requests race simultaneously
--   (the second will receive a unique constraint error rather than
--   silently producing a duplicate).
-- =============================================================================


CREATE OR REPLACE FUNCTION public.generate_expense_number()

RETURNS TEXT

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_prefix TEXT;

    v_count  INTEGER;

BEGIN

    v_prefix :=
        'EXP-'
        || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')
        || '-';

    SELECT COUNT(*) + 1

    INTO v_count

    FROM public.expenses

    WHERE expense_number LIKE v_prefix || '%';

    RETURN
        v_prefix
        || LPAD(v_count::TEXT, 4, '0');

END;

$$;


-- =============================================================================
-- PAYMENT REFERENCE GENERATOR
--
-- Example output: PAY-20260901-0001
-- =============================================================================


CREATE OR REPLACE FUNCTION public.generate_payment_reference()

RETURNS TEXT

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_prefix TEXT;

    v_count  INTEGER;

BEGIN

    v_prefix :=
        'PAY-'
        || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')
        || '-';

    SELECT COUNT(*) + 1

    INTO v_count

    FROM public.payments

    WHERE payment_reference LIKE v_prefix || '%';

    RETURN
        v_prefix
        || LPAD(v_count::TEXT, 4, '0');

END;

$$;


-- =============================================================================
-- FUNCTION: CREATE EXPENSE
--
-- Called by: EMPLOYEE, ACCOUNTS, OWNER
-- (Any authenticated user with an active employee record.)
--
-- The caller may only create an expense for themselves.
-- The expense number is generated automatically.
-- Future-dated expenses are rejected.
-- New expense starts as DRAFT.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.create_expense(

    p_category_id    UUID,

    p_vendor_name    TEXT,

    p_invoice_number TEXT,

    p_description    TEXT,

    p_amount         NUMERIC,

    p_expense_date   DATE,

    p_currency       CHAR(3) DEFAULT 'INR'

)

RETURNS public.expenses

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_expense     public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Validate amount.
    -- -------------------------------------------------------------------------

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;


    -- -------------------------------------------------------------------------
    -- Validate expense date.
    -- Future-dated expenses are not permitted.
    -- -------------------------------------------------------------------------

    IF p_expense_date IS NULL THEN
        RAISE EXCEPTION 'Expense date is required';
    END IF;

    IF p_expense_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Expense date cannot be in the future';
    END IF;


    -- -------------------------------------------------------------------------
    -- Find the active employee record for the authenticated user.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid()

    AND employment_status = 'ACTIVE';


    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Validate required text fields.
    -- -------------------------------------------------------------------------

    IF p_vendor_name IS NULL OR LENGTH(TRIM(p_vendor_name)) = 0 THEN
        RAISE EXCEPTION 'Vendor name is required';
    END IF;

    IF p_description IS NULL OR LENGTH(TRIM(p_description)) = 0 THEN
        RAISE EXCEPTION 'Expense description is required';
    END IF;


    -- -------------------------------------------------------------------------
    -- Verify category exists and is active.
    -- -------------------------------------------------------------------------

    IF NOT EXISTS (

        SELECT 1

        FROM public.expense_categories

        WHERE id = p_category_id

        AND is_active = TRUE

    ) THEN
        RAISE EXCEPTION 'Invalid or inactive expense category';
    END IF;


    -- -------------------------------------------------------------------------
    -- Insert draft expense.
    -- -------------------------------------------------------------------------

    INSERT INTO public.expenses (

        expense_number,
        submitted_by,
        category_id,
        vendor_name,
        invoice_number,
        description,
        amount,
        currency,
        expense_date,
        status

    )

    VALUES (

        public.generate_expense_number(),

        v_employee_id,

        p_category_id,

        TRIM(p_vendor_name),

        NULLIF(TRIM(p_invoice_number), ''),

        TRIM(p_description),

        p_amount,

        UPPER(p_currency),

        p_expense_date,

        'DRAFT'

    )

    RETURNING *

    INTO v_expense;


    RETURN v_expense;

END;

$$;


-- =============================================================================
-- FUNCTION: SUBMIT EXPENSE
--
-- Called by: EMPLOYEE (or any user with an active employee record)
--
-- Only the employee who created the expense may submit it.
--
-- DRAFT
--   |
--   v
-- SUBMITTED
-- =============================================================================


CREATE OR REPLACE FUNCTION public.submit_expense(

    p_expense_id UUID

)

RETURNS public.expenses

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_expense     public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Find the employee record for the authenticated user.
    --
    -- NULL guard: if the caller has no employee record (e.g. an OWNER
    -- or ACCOUNTS user who has a profile but no employee record), the
    -- ownership check below (submitted_by != NULL) would evaluate to
    -- NULL and silently pass. Explicit NULL guard prevents this bypass.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid();


    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense to prevent concurrent state changes.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Ownership check.
    -- -------------------------------------------------------------------------

    IF v_expense.submitted_by != v_employee_id THEN
        RAISE EXCEPTION 'Cannot submit another employee expense';
    END IF;


    -- -------------------------------------------------------------------------
    -- Status check — only DRAFT may be submitted.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT expenses can be submitted';
    END IF;


    -- -------------------------------------------------------------------------
    -- Transition to SUBMITTED.
    -- -------------------------------------------------------------------------

    UPDATE public.expenses

    SET

        status       = 'SUBMITTED',

        submitted_at = CURRENT_TIMESTAMP

    WHERE id = p_expense_id

    RETURNING *

    INTO v_expense;


    RETURN v_expense;

END;

$$;


-- =============================================================================
-- FUNCTION: UPDATE DRAFT EXPENSE
--
-- Called by: EMPLOYEE (or any user with an active employee record)
--
-- An employee may edit only their own DRAFT expense.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.update_draft_expense(

    p_expense_id     UUID,

    p_category_id    UUID,

    p_vendor_name    TEXT,

    p_invoice_number TEXT,

    p_description    TEXT,

    p_amount         NUMERIC,

    p_expense_date   DATE,

    p_currency       CHAR(3)

)

RETURNS public.expenses

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_expense     public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Validate amount.
    -- -------------------------------------------------------------------------

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;


    -- -------------------------------------------------------------------------
    -- Validate expense date.
    -- -------------------------------------------------------------------------

    IF p_expense_date IS NULL THEN
        RAISE EXCEPTION 'Expense date is required';
    END IF;

    IF p_expense_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Expense date cannot be in the future';
    END IF;


    -- -------------------------------------------------------------------------
    -- Find the employee record for the authenticated user.
    --
    -- NULL guard: prevents ownership bypass for authenticated users
    -- who have a profile but no employee record (e.g. OWNER/ACCOUNTS).
    -- Without this guard, NULL != submitted_by evaluates to NULL
    -- (not TRUE), causing the IF branch to be silently skipped.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid();


    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Ownership check.
    -- -------------------------------------------------------------------------

    IF v_expense.submitted_by != v_employee_id THEN
        RAISE EXCEPTION 'Cannot modify another employee expense';
    END IF;


    -- -------------------------------------------------------------------------
    -- Status check — only DRAFT may be modified.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT expenses can be modified';
    END IF;


    -- -------------------------------------------------------------------------
    -- Validate required text fields.
    -- -------------------------------------------------------------------------

    IF p_vendor_name IS NULL OR LENGTH(TRIM(p_vendor_name)) = 0 THEN
        RAISE EXCEPTION 'Vendor name is required';
    END IF;

    IF p_description IS NULL OR LENGTH(TRIM(p_description)) = 0 THEN
        RAISE EXCEPTION 'Expense description is required';
    END IF;


    -- -------------------------------------------------------------------------
    -- Verify category exists and is active.
    -- -------------------------------------------------------------------------

    IF NOT EXISTS (

        SELECT 1

        FROM public.expense_categories

        WHERE id = p_category_id

        AND is_active = TRUE

    ) THEN
        RAISE EXCEPTION 'Invalid or inactive expense category';
    END IF;


    -- -------------------------------------------------------------------------
    -- Apply update.
    -- -------------------------------------------------------------------------

    UPDATE public.expenses

    SET

        category_id    = p_category_id,

        vendor_name    = TRIM(p_vendor_name),

        invoice_number = NULLIF(TRIM(p_invoice_number), ''),

        description    = TRIM(p_description),

        amount         = p_amount,

        currency       = UPPER(p_currency),

        expense_date   = p_expense_date

    WHERE id = p_expense_id

    RETURNING *

    INTO v_expense;


    RETURN v_expense;

END;

$$;


-- =============================================================================
-- FUNCTION: DELETE DRAFT EXPENSE
--
-- Called by: EMPLOYEE (or any user with an active employee record)
--
-- An employee may delete only their own DRAFT expense.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.delete_draft_expense(

    p_expense_id UUID

)

RETURNS VOID

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_expense     public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Find the employee record for the authenticated user.
    --
    -- NULL guard: same rationale as update_draft_expense().
    -- Without this guard, an OWNER or ACCOUNTS user with no employee
    -- record could delete any employee's DRAFT expense.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid();


    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Ownership check.
    -- -------------------------------------------------------------------------

    IF v_expense.submitted_by != v_employee_id THEN
        RAISE EXCEPTION 'Cannot delete another employee expense';
    END IF;


    -- -------------------------------------------------------------------------
    -- Status check — only DRAFT may be deleted.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT expenses can be deleted';
    END IF;


    -- -------------------------------------------------------------------------
    -- Delete. Cascade removes any associated expense_documents.
    -- -------------------------------------------------------------------------

    DELETE FROM public.expenses

    WHERE id = p_expense_id;

END;

$$;


-- =============================================================================
-- FUNCTION: ACCOUNTS REVIEW EXPENSE
--
-- Called by: ACCOUNTS only
--
-- APPROVE:
--   SUBMITTED -> PENDING_OWNER_APPROVAL
--
-- REJECT:
--   SUBMITTED -> REJECTED_BY_ACCOUNTS
--   Rejection reason is required.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.review_expense_accounts(

    p_expense_id UUID,

    p_approve    BOOLEAN,

    p_remarks    TEXT DEFAULT NULL

)

RETURNS public.expenses

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_expense public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Only ACCOUNTS can perform this review.
    -- -------------------------------------------------------------------------

    IF public.get_my_role() != 'ACCOUNTS' THEN
        RAISE EXCEPTION 'Only ACCOUNTS can review expenses';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Only SUBMITTED expenses can be reviewed by ACCOUNTS.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'SUBMITTED' THEN
        RAISE EXCEPTION 'Expense is not awaiting accounts review';
    END IF;


    -- =========================================================================
    -- APPROVE
    -- =========================================================================

    IF p_approve THEN


        UPDATE public.expenses

        SET

            status               = 'PENDING_OWNER_APPROVAL',

            accounts_reviewed_by = auth.uid(),

            accounts_reviewed_at = CURRENT_TIMESTAMP,

            accounts_remarks     = NULLIF(TRIM(p_remarks), ''),

            rejection_reason     = NULL

        WHERE id = p_expense_id;


    -- =========================================================================
    -- REJECT
    -- =========================================================================

    ELSE


        IF NULLIF(TRIM(p_remarks), '') IS NULL THEN
            RAISE EXCEPTION 'Rejection reason is required';
        END IF;


        UPDATE public.expenses

        SET

            status               = 'REJECTED_BY_ACCOUNTS',

            accounts_reviewed_by = auth.uid(),

            accounts_reviewed_at = CURRENT_TIMESTAMP,

            accounts_remarks     = TRIM(p_remarks),

            rejection_reason     = TRIM(p_remarks)

        WHERE id = p_expense_id;


    END IF;


    -- -------------------------------------------------------------------------
    -- Return updated expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id;


    RETURN v_expense;

END;

$$;


-- =============================================================================
-- FUNCTION: OWNER REVIEW EXPENSE
--
-- Called by: OWNER only
--
-- APPROVE:
--   PENDING_OWNER_APPROVAL -> PAYMENT_PENDING
--
-- REJECT:
--   PENDING_OWNER_APPROVAL -> REJECTED_BY_OWNER
--   Rejection reason is required.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.review_expense_owner(

    p_expense_id UUID,

    p_approve    BOOLEAN,

    p_remarks    TEXT DEFAULT NULL

)

RETURNS public.expenses

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_expense public.expenses;

BEGIN


    -- -------------------------------------------------------------------------
    -- Only OWNER can perform this review.
    -- -------------------------------------------------------------------------

    IF public.get_my_role() != 'OWNER' THEN
        RAISE EXCEPTION 'Only OWNER can approve expenses';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Only PENDING_OWNER_APPROVAL expenses can be reviewed here.
    -- The OWNER cannot skip the ACCOUNTS review stage.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'PENDING_OWNER_APPROVAL' THEN
        RAISE EXCEPTION 'Expense is not awaiting owner approval';
    END IF;


    -- =========================================================================
    -- APPROVE
    -- =========================================================================

    IF p_approve THEN


        UPDATE public.expenses

        SET

            status              = 'PAYMENT_PENDING',

            owner_reviewed_by   = auth.uid(),

            owner_reviewed_at   = CURRENT_TIMESTAMP,

            owner_remarks       = NULLIF(TRIM(p_remarks), ''),

            rejection_reason    = NULL

        WHERE id = p_expense_id;


    -- =========================================================================
    -- REJECT
    -- =========================================================================

    ELSE


        IF NULLIF(TRIM(p_remarks), '') IS NULL THEN
            RAISE EXCEPTION 'Rejection reason is required';
        END IF;


        UPDATE public.expenses

        SET

            status              = 'REJECTED_BY_OWNER',

            owner_reviewed_by   = auth.uid(),

            owner_reviewed_at   = CURRENT_TIMESTAMP,

            owner_remarks       = TRIM(p_remarks),

            rejection_reason    = TRIM(p_remarks)

        WHERE id = p_expense_id;


    END IF;


    -- -------------------------------------------------------------------------
    -- Return updated expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id;


    RETURN v_expense;

END;

$$;


-- =============================================================================
-- FUNCTION: RECORD PAYMENT
--
-- Called by: ACCOUNTS only
--
-- PAYMENT_PENDING -> PAID
--
-- Design decisions:
--
--   Payment amount is read directly from the approved expense record,
--   not supplied by the caller. This prevents the caller from recording
--   a payment for a different amount than what was approved.
--
--   The payment reference is auto-generated — no caller input required.
--
--   The UNIQUE constraint on payments.expense_id is the schema-level
--   backstop against duplicate payments, independent of this function.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.record_payment(

    p_expense_id            UUID,

    p_payment_method        public.payment_method,

    p_transaction_reference TEXT DEFAULT NULL,

    p_payment_date          DATE DEFAULT CURRENT_DATE,

    p_notes                 TEXT DEFAULT NULL

)

RETURNS public.payments

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_expense public.expenses;

    v_payment public.payments;

BEGIN


    -- -------------------------------------------------------------------------
    -- Only ACCOUNTS can record payments.
    -- -------------------------------------------------------------------------

    IF public.get_my_role() != 'ACCOUNTS' THEN
        RAISE EXCEPTION 'Only ACCOUNTS can record payments';
    END IF;


    -- -------------------------------------------------------------------------
    -- Lock expense.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_expense

    FROM public.expenses

    WHERE id = p_expense_id

    FOR UPDATE;


    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;


    -- -------------------------------------------------------------------------
    -- Payment requires prior OWNER approval.
    -- -------------------------------------------------------------------------

    IF v_expense.status != 'PAYMENT_PENDING' THEN
        RAISE EXCEPTION 'Expense is not awaiting payment';
    END IF;


    -- -------------------------------------------------------------------------
    -- Extra protection against duplicate payments.
    -- The UNIQUE constraint on expense_id is the schema-level backstop.
    -- -------------------------------------------------------------------------

    IF EXISTS (

        SELECT 1

        FROM public.payments

        WHERE expense_id = p_expense_id

    ) THEN
        RAISE EXCEPTION 'Payment already exists for this expense';
    END IF;


    -- -------------------------------------------------------------------------
    -- Create payment record.
    -- Amount is read from the expense — caller cannot manipulate it.
    -- -------------------------------------------------------------------------

    INSERT INTO public.payments (

        expense_id,
        payment_reference,
        payment_amount,
        payment_date,
        payment_method,
        transaction_reference,
        recorded_by,
        notes

    )

    VALUES (

        p_expense_id,

        public.generate_payment_reference(),

        v_expense.amount,

        COALESCE(p_payment_date, CURRENT_DATE),

        p_payment_method,

        NULLIF(TRIM(p_transaction_reference), ''),

        auth.uid(),

        NULLIF(TRIM(p_notes), '')

    )

    RETURNING *

    INTO v_payment;


    -- -------------------------------------------------------------------------
    -- Mark expense PAID.
    -- -------------------------------------------------------------------------

    UPDATE public.expenses

    SET status = 'PAID'

    WHERE id = p_expense_id;


    RETURN v_payment;

END;

$$;


-- =============================================================================
-- GRANT EXECUTE
--
-- Grant EXECUTE to the authenticated role so that Supabase can call
-- these functions as RPCs from the frontend.
--
-- Internal generator functions (generate_expense_number,
-- generate_payment_reference) are called only by other SECURITY DEFINER
-- functions and are intentionally NOT granted to authenticated.
-- =============================================================================


-- get_my_role: frontend may legitimately call this to determine UI access.

GRANT EXECUTE ON FUNCTION public.get_my_role()
TO authenticated;


-- Attendance RPCs (defined in Migration 002).

GRANT EXECUTE ON FUNCTION public.check_in()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_out()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_attendance_correction(
    UUID,
    public.attendance_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_attendance_correction(
    UUID,
    BOOLEAN,
    TEXT
)
TO authenticated;


-- Expense RPCs (defined in this migration).

GRANT EXECUTE ON FUNCTION public.create_expense(
    UUID,
    TEXT,
    TEXT,
    TEXT,
    NUMERIC,
    DATE,
    CHAR
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.submit_expense(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_draft_expense(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    NUMERIC,
    DATE,
    CHAR
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_draft_expense(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_expense_accounts(
    UUID,
    BOOLEAN,
    TEXT
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_expense_owner(
    UUID,
    BOOLEAN,
    TEXT
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_payment(
    UUID,
    public.payment_method,
    TEXT,
    DATE,
    TEXT
)
TO authenticated;


-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================