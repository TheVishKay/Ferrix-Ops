-- -----------------------------------------------------------------------------
-- Employee Management RPCs (Phase 5)
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
END;
$$;


-- -----------------------------------------------------------------------------
-- Attendance Correction Security Patch
-- -----------------------------------------------------------------------------
-- Patches the existing function to enforce employment_status = 'ACTIVE'

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
BEGIN

    -- Find authenticated employee and ensure they are ACTIVE
    SELECT id
    INTO v_employee_id
    FROM public.employees
    WHERE user_id = auth.uid()
    AND employment_status = 'ACTIVE';

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;

    -- Find the employee that owns the attendance record.
    SELECT employee_id
    INTO v_record_employee_id
    FROM public.attendance_records
    WHERE id = p_attendance_record_id;

    IF v_record_employee_id IS NULL THEN
        RAISE EXCEPTION 'Attendance record not found';
    END IF;

    -- Security: Only the employee who owns the record can request a correction.
    IF v_employee_id != v_record_employee_id THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Insert the correction request.
    INSERT INTO public.attendance_correction_requests (
        attendance_record_id,
        requested_status,
        requested_check_in,
        requested_check_out,
        reason
    )
    VALUES (
        p_attendance_record_id,
        p_requested_status,
        p_requested_check_in,
        p_requested_check_out,
        p_reason
    )
    RETURNING * INTO v_request;

    RETURN v_request;
END;
$$;
