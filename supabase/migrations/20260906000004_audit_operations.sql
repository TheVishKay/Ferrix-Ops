-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Add Audit Logging to Operations (V1 Fix)
-- =============================================================================

-- =============================================================================
-- EXPENSES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- submit_expense
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
    v_actor_role  public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

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

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'EXPENSE_SUBMITTED',
        'expense',
        p_expense_id,
        jsonb_build_object('status', 'DRAFT'),
        jsonb_build_object('status', 'SUBMITTED')
    );

    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- review_expense_accounts
-- -----------------------------------------------------------------------------
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
    v_actor_role public.app_role;
    v_old_status TEXT;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Only ACCOUNTS can perform this review
    IF v_actor_role != 'ACCOUNTS' THEN
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

    v_old_status := v_expense.status;

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

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'EXPENSE_REVIEWED',
        'expense',
        p_expense_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', v_expense.status, 'decision', p_decision)
    );

    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- review_expense_owner
-- -----------------------------------------------------------------------------
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
    v_actor_role public.app_role;
    v_old_status TEXT;
    v_decision TEXT;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Only OWNER can perform this review.
    IF v_actor_role != 'OWNER' THEN
        RAISE EXCEPTION 'Only OWNER can approve expenses';
    END IF;

    -- Lock expense.
    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    v_old_status := v_expense.status;

    -- Only PENDING_OWNER_APPROVAL expenses can be reviewed here.
    IF v_expense.status != 'PENDING_OWNER_APPROVAL' THEN
        RAISE EXCEPTION 'Expense is not awaiting owner approval';
    END IF;

    IF p_approve THEN
        v_decision := 'APPROVE';
        UPDATE public.expenses
        SET
            status              = 'PAYMENT_PENDING',
            owner_reviewed_by   = auth.uid(),
            owner_reviewed_at   = CURRENT_TIMESTAMP,
            owner_remarks       = NULLIF(TRIM(p_remarks), ''),
            rejection_reason    = NULL
        WHERE id = p_expense_id;
    ELSE
        v_decision := 'REJECT';
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

    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'EXPENSE_APPROVED',
        'expense',
        p_expense_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', v_expense.status, 'decision', v_decision)
    );

    RETURN v_expense;
END;
$$;

-- -----------------------------------------------------------------------------
-- record_payment
-- -----------------------------------------------------------------------------
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
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Only ACCOUNTS can record payments.
    IF v_actor_role != 'ACCOUNTS' THEN
        RAISE EXCEPTION 'Only ACCOUNTS can record payments';
    END IF;

    -- Lock expense.
    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_expense IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    -- Payment requires prior OWNER approval.
    IF v_expense.status != 'PAYMENT_PENDING' THEN
        RAISE EXCEPTION 'Expense is not awaiting payment';
    END IF;

    -- Extra protection against duplicate payments.
    IF EXISTS (
        SELECT 1 FROM public.payments WHERE expense_id = p_expense_id
    ) THEN
        RAISE EXCEPTION 'Payment already exists for this expense';
    END IF;

    -- Create payment record.
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
    RETURNING * INTO v_payment;

    -- Mark expense PAID.
    UPDATE public.expenses
    SET status = 'PAID'
    WHERE id = p_expense_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'EXPENSE_PAYMENT_RECORDED',
        'expense',
        p_expense_id,
        jsonb_build_object('status', 'PAYMENT_PENDING'),
        jsonb_build_object('status', 'PAID', 'payment_id', v_payment.id)
    );

    RETURN v_payment;
END;
$$;

-- =============================================================================
-- ATTENDANCE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- check_in
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in()
RETURNS public.attendance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_id UUID;
    v_record public.attendance_records;
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Find the active employee linked to the authenticated user.
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid() AND employment_status = 'ACTIVE';

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;

    -- Create today's attendance.
    INSERT INTO public.attendance_records (
        employee_id,
        attendance_date,
        check_in_at,
        check_out_at,
        status,
        source
    )
    VALUES (
        v_employee_id,
        CURRENT_DATE,
        CURRENT_TIMESTAMP,
        NULL,
        'INCOMPLETE',
        'SELF'
    )
    RETURNING * INTO v_record;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'CHECK_IN',
        'attendance',
        v_record.id,
        NULL,
        jsonb_build_object('status', v_record.status)
    );

    RETURN v_record;
END;
$$;

-- -----------------------------------------------------------------------------
-- check_out
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_out()
RETURNS public.attendance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_id UUID;
    v_record public.attendance_records;
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Find the active employee.
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid() AND employment_status = 'ACTIVE';

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;

    -- Complete today's attendance.
    UPDATE public.attendance_records
    SET
        check_out_at = CURRENT_TIMESTAMP,
        status = 'PRESENT',
        source = 'SELF'
    WHERE
        employee_id = v_employee_id
        AND attendance_date = CURRENT_DATE
        AND status = 'INCOMPLETE'
    RETURNING * INTO v_record;

    IF v_record IS NULL THEN
        RAISE EXCEPTION 'No incomplete attendance record found for today';
    END IF;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'CHECK_OUT',
        'attendance',
        v_record.id,
        jsonb_build_object('status', 'INCOMPLETE'),
        jsonb_build_object('status', 'PRESENT')
    );

    RETURN v_record;
END;
$$;

-- -----------------------------------------------------------------------------
-- request_attendance_correction
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_attendance_correction(
    p_attendance_record_id UUID,
    p_requested_status public.attendance_status,
    p_requested_check_in TIMESTAMPTZ,
    p_requested_check_out TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS public.attendance_correction_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_id UUID;
    v_record_employee_id UUID;
    v_request public.attendance_correction_requests;
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Find authenticated employee and ensure they are ACTIVE
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid() AND employment_status = 'ACTIVE';

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;

    -- Find the employee that owns the attendance record.
    SELECT employee_id INTO v_record_employee_id FROM public.attendance_records
    WHERE id = p_attendance_record_id;

    IF v_record_employee_id IS NULL THEN
        RAISE EXCEPTION 'Attendance record not found';
    END IF;

    -- Security: Only the employee who owns the record can request a correction.
    IF v_employee_id != v_record_employee_id THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Correction reason is required';
    END IF;

    -- Pre-flight validation
    IF p_requested_status IN ('ABSENT', 'LEAVE') AND (p_requested_check_in IS NOT NULL OR p_requested_check_out IS NOT NULL) THEN
        RAISE EXCEPTION 'Corrections for ABSENT or LEAVE status cannot include check-in or check-out times';
    END IF;

    IF p_requested_check_in IS NOT NULL AND p_requested_check_out IS NOT NULL AND p_requested_check_out < p_requested_check_in THEN
        RAISE EXCEPTION 'Requested check-out time cannot be before requested check-in time';
    END IF;

    -- Insert the correction request.
    INSERT INTO public.attendance_correction_requests (
        attendance_record_id,
        employee_id,
        requested_status,
        requested_check_in,
        requested_check_out,
        reason
    )
    VALUES (
        p_attendance_record_id,
        v_employee_id,
        p_requested_status,
        p_requested_check_in,
        p_requested_check_out,
        TRIM(p_reason)
    )
    RETURNING * INTO v_request;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'ATTENDANCE_CORRECTION_REQUESTED',
        'attendance_correction',
        v_request.id,
        NULL,
        jsonb_build_object('attendance_record_id', p_attendance_record_id, 'status', v_request.status)
    );

    RETURN v_request;
END;
$$;

-- -----------------------------------------------------------------------------
-- review_attendance_correction
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_attendance_correction(
    p_request_id UUID,
    p_approve BOOLEAN,
    p_remarks TEXT DEFAULT NULL
)
RETURNS public.attendance_correction_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.app_role;
    v_request public.attendance_correction_requests;
    v_final_status public.attendance_status;
    v_final_check_in TIMESTAMPTZ;
    v_final_check_out TIMESTAMPTZ;
BEGIN
    -- Only OWNER may review corrections.
    SELECT public.get_my_role() INTO v_role;
    IF v_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Only OWNER can review attendance corrections';
    END IF;

    -- Lock correction request.
    SELECT * INTO v_request FROM public.attendance_correction_requests WHERE id = p_request_id FOR UPDATE;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Correction request not found';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'Correction request has already been reviewed';
    END IF;

    IF p_approve THEN
        -- Calculate final values.
        SELECT
            COALESCE(v_request.requested_status, ar.status),
            COALESCE(v_request.requested_check_in, ar.check_in_at),
            COALESCE(v_request.requested_check_out, ar.check_out_at)
        INTO
            v_final_status,
            v_final_check_in,
            v_final_check_out
        FROM public.attendance_records ar
        WHERE ar.id = v_request.attendance_record_id;

        -- Validate timestamp order.
        IF v_final_check_out IS NOT NULL AND (v_final_check_in IS NULL OR v_final_check_out < v_final_check_in) THEN
            RAISE EXCEPTION 'Invalid correction: check-out must occur after check-in';
        END IF;

        -- Validate PRESENT / HALF_DAY.
        IF v_final_status IN ('PRESENT', 'HALF_DAY') AND (v_final_check_in IS NULL OR v_final_check_out IS NULL) THEN
            RAISE EXCEPTION 'Invalid correction: PRESENT and HALF_DAY require check-in and check-out';
        END IF;

        -- Validate INCOMPLETE.
        IF v_final_status = 'INCOMPLETE' AND (v_final_check_in IS NULL OR v_final_check_out IS NOT NULL) THEN
            RAISE EXCEPTION 'Invalid correction: INCOMPLETE requires check-in and no check-out';
        END IF;

        -- Validate ABSENT / LEAVE.
        IF v_final_status IN ('ABSENT', 'LEAVE') AND (v_final_check_in IS NOT NULL OR v_final_check_out IS NOT NULL) THEN
            RAISE EXCEPTION 'Invalid correction: ABSENT and LEAVE cannot contain check-in or check-out times';
        END IF;

        -- Update attendance record.
        UPDATE public.attendance_records
        SET
            status = v_final_status,
            check_in_at = v_final_check_in,
            check_out_at = v_final_check_out,
            source = 'CORRECTED'
        WHERE id = v_request.attendance_record_id;

        -- Mark correction approved.
        UPDATE public.attendance_correction_requests
        SET
            status = 'APPROVED',
            reviewed_by = auth.uid(),
            reviewed_at = CURRENT_TIMESTAMP,
            review_remarks = NULLIF(TRIM(p_remarks), '')
        WHERE id = p_request_id;
    ELSE
        UPDATE public.attendance_correction_requests
        SET
            status = 'REJECTED',
            reviewed_by = auth.uid(),
            reviewed_at = CURRENT_TIMESTAMP,
            review_remarks = NULLIF(TRIM(p_remarks), '')
        WHERE id = p_request_id;
    END IF;

    -- Return the updated correction request.
    SELECT * INTO v_request FROM public.attendance_correction_requests WHERE id = p_request_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_role,
        'ATTENDANCE_CORRECTION_REVIEWED',
        'attendance_correction',
        p_request_id,
        jsonb_build_object('status', 'PENDING'),
        jsonb_build_object('status', v_request.status, 'decision', CASE WHEN p_approve THEN 'APPROVE' ELSE 'REJECT' END)
    );

    RETURN v_request;
END;
$$;

-- -----------------------------------------------------------------------------
-- update_employee_role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_employee_role(
    p_user_id UUID,
    p_new_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_role public.app_role;
    v_target_role public.app_role;
    v_owner_count INTEGER;
BEGIN
    -- 1. Verify caller is OWNER
    SELECT public.get_my_role() INTO v_caller_role;
    IF v_caller_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Reject self-role modification
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify own role';
    END IF;

    -- 3. Prevent 0 OWNERs (if demoting an owner)
    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
    IF v_target_role = 'OWNER' AND p_new_role != 'OWNER' THEN
        SELECT COUNT(*) INTO v_owner_count FROM public.profiles WHERE role = 'OWNER';
        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Cannot remove the last OWNER';
        END IF;
    END IF;

    -- 4. Update role
    UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        v_caller_role,
        'ROLE_CHANGED',
        'employee',
        p_user_id,
        jsonb_build_object('role', v_target_role),
        jsonb_build_object('role', p_new_role)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Execution Grants
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.submit_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_expense(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_expense_accounts(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_expense_accounts(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_expense_owner(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_expense_owner(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, public.payment_method, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, public.payment_method, TEXT, DATE, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_in() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_out() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_attendance_correction(UUID, public.attendance_status, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_attendance_correction(UUID, public.attendance_status, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_attendance_correction(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_attendance_correction(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_employee_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_role(UUID, public.app_role) TO authenticated;
