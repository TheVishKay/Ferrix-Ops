-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration 010: Leave Management
-- =============================================================================

-- =============================================================================
-- ENUM: leave_status
-- =============================================================================

CREATE TYPE public.leave_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);

-- =============================================================================
-- TABLE: leave_requests
-- =============================================================================

CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    employee_id UUID NOT NULL
        REFERENCES public.employees(id)
        ON DELETE RESTRICT,
        
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    reason TEXT,
    
    status public.leave_status NOT NULL
        DEFAULT 'PENDING',
        
    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,
        
    reviewed_at TIMESTAMPTZ,
    
    owner_remarks TEXT,
    
    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
        
    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
        
    CONSTRAINT leave_start_before_end
        CHECK (start_date <= end_date)
);

CREATE TRIGGER leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_leave_requests_employee
ON public.leave_requests(employee_id);

CREATE INDEX idx_leave_requests_status
ON public.leave_requests(status);

CREATE INDEX idx_leave_requests_dates
ON public.leave_requests(start_date DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
    employee_id IN (
        SELECT id
        FROM public.employees
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Owner views all leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
    public.get_my_role() = 'OWNER'
);

-- =============================================================================
-- RPC: submit_leave_request
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_leave_request(
    p_start_date DATE,
    p_end_date DATE,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_id UUID;
    v_request public.leave_requests;
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;
    
    -- Find active employee
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid() AND employment_status = 'ACTIVE';

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Active employee record not found';
    END IF;

    IF p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Start date must be on or before end date';
    END IF;

    -- Insert leave request
    INSERT INTO public.leave_requests (
        employee_id,
        start_date,
        end_date,
        reason,
        status
    ) VALUES (
        v_employee_id,
        p_start_date,
        p_end_date,
        NULLIF(TRIM(p_reason), ''),
        'PENDING'
    ) RETURNING * INTO v_request;

    -- Audit Log
    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'LEAVE_REQUESTED',
        'leave_request',
        v_request.id,
        NULL,
        jsonb_build_object('status', 'PENDING', 'start_date', p_start_date, 'end_date', p_end_date)
    );

    RETURN v_request;
END;
$$;

-- =============================================================================
-- RPC: cancel_pending_leave
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_pending_leave(
    p_leave_id UUID
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_id UUID;
    v_request public.leave_requests;
    v_actor_role public.app_role;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Get employee ID
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid();

    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    -- Lock request
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Leave request not found';
    END IF;

    -- Employee check
    IF v_request.employee_id != v_employee_id THEN
        RAISE EXCEPTION 'Cannot cancel another employee''s leave request';
    END IF;

    -- Status check
    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING leave requests can be cancelled';
    END IF;

    -- Cancel request
    UPDATE public.leave_requests
    SET status = 'CANCELLED'
    WHERE id = p_leave_id
    RETURNING * INTO v_request;

    -- Audit log
    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'LEAVE_CANCELLED',
        'leave_request',
        p_leave_id,
        jsonb_build_object('status', 'PENDING'),
        jsonb_build_object('status', 'CANCELLED')
    );

    RETURN v_request;
END;
$$;

-- =============================================================================
-- RPC: review_leave_request
-- =============================================================================

CREATE OR REPLACE FUNCTION public.review_leave_request(
    p_leave_id UUID,
    p_approve BOOLEAN,
    p_remarks TEXT DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    v_request public.leave_requests;
    v_decision TEXT;
    v_curr_date DATE;
    v_existing_status public.attendance_status;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    -- Role check
    IF v_actor_role != 'OWNER' THEN
        RAISE EXCEPTION 'Only OWNER can review leave requests';
    END IF;

    -- Lock request
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Leave request not found';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'Leave request is not PENDING';
    END IF;

    IF NOT p_approve THEN
        v_decision := 'REJECT';
        UPDATE public.leave_requests
        SET
            status = 'REJECTED',
            reviewed_by = auth.uid(),
            reviewed_at = CURRENT_TIMESTAMP,
            owner_remarks = NULLIF(TRIM(p_remarks), '')
        WHERE id = p_leave_id;
    ELSE
        v_decision := 'APPROVE';
        
        -- PRE-FLIGHT VALIDATION: Check for attendance conflicts first
        FOR v_curr_date IN 
            SELECT generate_series(v_request.start_date::timestamp, v_request.end_date::timestamp, '1 day'::interval)::date
        LOOP
            SELECT status INTO v_existing_status FROM public.attendance_records
            WHERE employee_id = v_request.employee_id AND attendance_date = v_curr_date;
            
            IF FOUND THEN
                IF v_existing_status IN ('PRESENT', 'HALF_DAY', 'INCOMPLETE') THEN
                    RAISE EXCEPTION 'Attendance conflict on %: status is %', v_curr_date, v_existing_status;
                END IF;
            END IF;
        END LOOP;

        -- APPLY ATTENDANCE: Safe to proceed without breaking atomicity
        FOR v_curr_date IN 
            SELECT generate_series(v_request.start_date::timestamp, v_request.end_date::timestamp, '1 day'::interval)::date
        LOOP
            SELECT status INTO v_existing_status FROM public.attendance_records
            WHERE employee_id = v_request.employee_id AND attendance_date = v_curr_date;
            
            IF NOT FOUND THEN
                INSERT INTO public.attendance_records (
                    employee_id,
                    attendance_date,
                    status,
                    source
                ) VALUES (
                    v_request.employee_id,
                    v_curr_date,
                    'LEAVE',
                    'MANUAL'
                );
            ELSIF v_existing_status = 'ABSENT' THEN
                UPDATE public.attendance_records
                SET status = 'LEAVE', source = 'MANUAL'
                WHERE employee_id = v_request.employee_id AND attendance_date = v_curr_date;
            END IF;
        END LOOP;
        
        -- Update leave request
        UPDATE public.leave_requests
        SET
            status = 'APPROVED',
            reviewed_by = auth.uid(),
            reviewed_at = CURRENT_TIMESTAMP,
            owner_remarks = NULLIF(TRIM(p_remarks), '')
        WHERE id = p_leave_id;
    END IF;

    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_leave_id;

    -- Audit log
    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        CASE WHEN p_approve THEN 'LEAVE_APPROVED' ELSE 'LEAVE_REJECTED' END,
        'leave_request',
        p_leave_id,
        jsonb_build_object('status', 'PENDING'),
        jsonb_build_object('status', v_request.status, 'decision', v_decision)
    );

    RETURN v_request;
END;
$$;

-- =============================================================================
-- EXECUTION GRANTS
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.submit_leave_request(DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(DATE, DATE, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_pending_leave(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_pending_leave(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_leave_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_leave_request(UUID, BOOLEAN, TEXT) TO authenticated;
