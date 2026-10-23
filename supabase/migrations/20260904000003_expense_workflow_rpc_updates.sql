-- =============================================================================
-- ferrixOps
-- Migration: Expense Workflow RPC Updates
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Replace review_expense_accounts
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.review_expense_accounts(UUID, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.review_expense_accounts(
    p_expense_id UUID,
    p_decision TEXT,
    p_remarks TEXT DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_expense public.expenses;
BEGIN
    -- Only ACCOUNTS can perform this review
    IF public.get_my_role() != 'ACCOUNTS' THEN
        RAISE EXCEPTION 'Only ACCOUNTS can review expenses';
    END IF;

    -- Validate p_decision
    IF p_decision NOT IN ('APPROVE', 'REJECT', 'RETURN') THEN
        RAISE EXCEPTION 'Invalid review decision. Must be APPROVE, REJECT, or RETURN.';
    END IF;

    -- Lock expense
    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    -- State validation
    IF v_expense.status != 'SUBMITTED' THEN
        RAISE EXCEPTION 'Expense is not awaiting accounts review';
    END IF;

    IF p_decision = 'APPROVE' THEN
        UPDATE public.expenses
        SET
            status               = 'PENDING_OWNER_APPROVAL',
            accounts_reviewed_by = auth.uid(),
            accounts_reviewed_at = CURRENT_TIMESTAMP,
            accounts_remarks     = NULLIF(TRIM(p_remarks), ''),
            rejection_reason     = NULL
        WHERE id = p_expense_id;

    ELSIF p_decision = 'REJECT' THEN
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

    ELSIF p_decision = 'RETURN' THEN
        IF NULLIF(TRIM(p_remarks), '') IS NULL THEN
            RAISE EXCEPTION 'Return correction remarks are required';
        END IF;

        UPDATE public.expenses
        SET
            status               = 'RETURNED_FOR_CORRECTION',
            accounts_reviewed_by = auth.uid(),
            accounts_reviewed_at = CURRENT_TIMESTAMP,
            accounts_remarks     = TRIM(p_remarks),
            rejection_reason     = NULL
        WHERE id = p_expense_id;
    END IF;

    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;
    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Rename update_draft_expense to update_expense
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_draft_expense(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR);

CREATE OR REPLACE FUNCTION public.update_expense(
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
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;

    IF p_expense_date IS NULL THEN
        RAISE EXCEPTION 'Expense date is required';
    END IF;

    IF p_expense_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Expense date cannot be in the future';
    END IF;

    SELECT id INTO v_employee_id FROM public.employees WHERE user_id = auth.uid();

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    IF v_expense.submitted_by != v_employee_id THEN
        RAISE EXCEPTION 'Cannot modify another employee expense';
    END IF;

    -- Enforce editable state
    IF v_expense.status NOT IN ('DRAFT', 'RETURNED_FOR_CORRECTION') THEN
        RAISE EXCEPTION 'Only DRAFT or RETURNED_FOR_CORRECTION expenses can be modified';
    END IF;

    IF p_vendor_name IS NULL OR LENGTH(TRIM(p_vendor_name)) = 0 THEN
        RAISE EXCEPTION 'Vendor name is required';
    END IF;

    IF p_description IS NULL OR LENGTH(TRIM(p_description)) = 0 THEN
        RAISE EXCEPTION 'Expense description is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.expense_categories WHERE id = p_category_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive expense category';
    END IF;

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
    RETURNING * INTO v_expense;

    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Modify submit_expense
-- -----------------------------------------------------------------------------
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
    SELECT id INTO v_employee_id FROM public.employees WHERE user_id = auth.uid();

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    IF v_expense.submitted_by != v_employee_id THEN
        RAISE EXCEPTION 'Cannot submit another employee expense';
    END IF;

    -- Allow submission from DRAFT and RETURNED_FOR_CORRECTION
    IF v_expense.status NOT IN ('DRAFT', 'RETURNED_FOR_CORRECTION') THEN
        RAISE EXCEPTION 'Only DRAFT or RETURNED_FOR_CORRECTION expenses can be submitted';
    END IF;

    UPDATE public.expenses
    SET
        status       = 'SUBMITTED',
        submitted_at = CURRENT_TIMESTAMP
        -- Previous review metadata remains intact to document the last interaction.
    WHERE id = p_expense_id
    RETURNING * INTO v_expense;

    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Apply Execution Grants
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.review_expense_accounts(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_expense_accounts(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_expense(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_expense(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, CHAR) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_expense(UUID) TO authenticated;
