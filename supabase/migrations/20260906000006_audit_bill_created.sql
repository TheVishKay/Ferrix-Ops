-- =============================================================================
-- ferrixOps
-- Migration: Add audit logging for "Bill Created" (create_expense)
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
    RETURNING * INTO v_expense;

    -- -------------------------------------------------------------------------
    -- Audit Logging
    -- -------------------------------------------------------------------------
    PERFORM public.create_audit_log(
        auth.uid(),
        public.get_my_role(),
        'EXPENSE_CREATED',
        'expense',
        v_expense.id,
        NULL,
        jsonb_build_object(
            'expense_number', v_expense.expense_number,
            'amount', v_expense.amount,
            'currency', v_expense.currency,
            'status', v_expense.status
        )
    );

    RETURN v_expense;
END;
$$;
