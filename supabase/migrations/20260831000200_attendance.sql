-- =============================================================================
-- ferrixOps
-- Migration 002: Attendance Management
--
-- Modules:
--   - Attendance records
--   - Check-in / Check-out
--   - Manual attendance support
--   - Attendance correction requests
--   - Correction approval/rejection
--
-- ASSUMPTIONS:
--   - One attendance record per employee per day.
--   - V1 does not support overnight shifts.
--   - Employees can check themselves in/out.
--   - Manual attendance can be recorded by authorized users.
--   - Employees can request corrections.
--   - OWNER reviews attendance corrections.
--
-- SECURITY:
--   - RLS policies are created in Migration 004.
--   - Direct attendance mutations are intentionally avoided
--     by the frontend.
--   - Secure RPC functions handle employee check-in/out
--     and correction workflows.
-- =============================================================================


-- =============================================================================
-- ATTENDANCE RECORDS
--
-- Status rules:
--
-- PRESENT / HALF_DAY
--     check_in_at  -> required
--     check_out_at -> required
--
-- INCOMPLETE
--     check_in_at  -> required
--     check_out_at -> NULL
--
-- ABSENT / LEAVE
--     check_in_at  -> NULL
--     check_out_at -> NULL
-- =============================================================================


CREATE TABLE public.attendance_records (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    -- Employee whose attendance this record belongs to.

    employee_id UUID NOT NULL
        REFERENCES public.employees(id)
        ON DELETE RESTRICT,


    -- Calendar day this attendance belongs to.

    attendance_date DATE NOT NULL,


    -- Actual check-in time.

    check_in_at TIMESTAMPTZ,


    -- Actual check-out time.

    check_out_at TIMESTAMPTZ,


    -- Daily attendance status.

    status public.attendance_status NOT NULL,


    -- How the record was created or last corrected.

    source public.attendance_source NOT NULL
        DEFAULT 'SELF',


    -- Optional remarks.

    notes TEXT,


    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    -- -------------------------------------------------------------------------
    -- Exactly one attendance record per employee per calendar day.
    -- -------------------------------------------------------------------------

    CONSTRAINT unique_employee_attendance_day

    UNIQUE (
        employee_id,
        attendance_date
    ),


    -- -------------------------------------------------------------------------
    -- Check-out cannot occur before check-in.
    -- -------------------------------------------------------------------------

    CONSTRAINT attendance_checkout_after_checkin

    CHECK (

        check_out_at IS NULL

        OR (

            check_in_at IS NOT NULL

            AND check_out_at >= check_in_at

        )

    ),


    -- -------------------------------------------------------------------------
    -- Status and timestamps must remain logically consistent.
    -- -------------------------------------------------------------------------

    CONSTRAINT attendance_status_consistency

    CHECK (

        (

            status IN ('PRESENT', 'HALF_DAY')

            AND check_in_at IS NOT NULL

            AND check_out_at IS NOT NULL

        )

        OR

        (

            status = 'INCOMPLETE'

            AND check_in_at IS NOT NULL

            AND check_out_at IS NULL

        )

        OR

        (

            status IN ('ABSENT', 'LEAVE')

            AND check_in_at IS NULL

            AND check_out_at IS NULL

        )

    )

);


CREATE TRIGGER attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- ATTENDANCE INDEXES
-- =============================================================================


-- Employee attendance history.

CREATE INDEX idx_attendance_employee_date
ON public.attendance_records (
    employee_id,
    attendance_date DESC
);


-- Daily company attendance.

CREATE INDEX idx_attendance_date
ON public.attendance_records (
    attendance_date DESC
);


-- Filter by attendance status.

CREATE INDEX idx_attendance_status
ON public.attendance_records(status);


-- =============================================================================
-- ATTENDANCE CORRECTION REQUESTS
--
-- An employee can request a correction for an existing
-- attendance record.
--
-- Possible examples:
--
--   INCOMPLETE -> PRESENT
--
--   ABSENT -> PRESENT
--
--   PRESENT -> HALF_DAY
--
--   Incorrect check-in time
--
--   Incorrect check-out time
--
-- Only one PENDING correction request is allowed
-- for an attendance record at a time.
-- =============================================================================


CREATE TABLE public.attendance_correction_requests (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    -- Original attendance record.

    attendance_record_id UUID NOT NULL
        REFERENCES public.attendance_records(id)
        ON DELETE RESTRICT,


    -- Employee requesting the correction.

    employee_id UUID NOT NULL
        REFERENCES public.employees(id)
        ON DELETE RESTRICT,


    -- -------------------------------------------------------------------------
    -- Requested changes.
    --
    -- NULL means:
    -- "Do not change this particular value."
    -- -------------------------------------------------------------------------

    requested_status public.attendance_status,

    requested_check_in TIMESTAMPTZ,

    requested_check_out TIMESTAMPTZ,


    -- Reason for the correction.

    reason TEXT NOT NULL,


    -- Workflow state.

    status public.correction_status NOT NULL
        DEFAULT 'PENDING',


    -- -------------------------------------------------------------------------
    -- Review information.
    -- -------------------------------------------------------------------------

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    reviewed_at TIMESTAMPTZ,

    review_remarks TEXT,


    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    -- -------------------------------------------------------------------------
    -- At least one requested change must exist.
    -- -------------------------------------------------------------------------

    CONSTRAINT correction_has_requested_change

    CHECK (

        requested_status IS NOT NULL

        OR requested_check_in IS NOT NULL

        OR requested_check_out IS NOT NULL

    )

);


CREATE TRIGGER attendance_correction_requests_updated_at
BEFORE UPDATE ON public.attendance_correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- ATTENDANCE CORRECTION INDEXES
-- =============================================================================


-- An attendance record may only have one active correction request.

CREATE UNIQUE INDEX unique_pending_correction_request
ON public.attendance_correction_requests (
    attendance_record_id
)
WHERE status = 'PENDING';


-- Employee correction history.

CREATE INDEX idx_correction_requests_employee
ON public.attendance_correction_requests(employee_id);


-- Pending/approved/rejected filtering.

CREATE INDEX idx_correction_requests_status
ON public.attendance_correction_requests(status);


-- =============================================================================
-- FUNCTION: CHECK IN
--
-- Called by:
--
--   EMPLOYEE
--
-- Behaviour:
--
--   1. Finds the authenticated user's employee record.
--   2. Ensures the employee is ACTIVE.
--   3. Creates today's attendance record.
--   4. Sets status to INCOMPLETE.
--
-- INCOMPLETE means:
--
--   Employee checked in,
--   but has not checked out yet.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.check_in()

RETURNS public.attendance_records

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_record public.attendance_records;

BEGIN


    -- -------------------------------------------------------------------------
    -- Find the active employee linked to the authenticated user.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid()

    AND employment_status = 'ACTIVE';


    IF v_employee_id IS NULL THEN

        RAISE EXCEPTION
            'Active employee record not found';

    END IF;


    -- -------------------------------------------------------------------------
    -- Create today's attendance.
    --
    -- The unique constraint prevents duplicate check-ins.
    -- -------------------------------------------------------------------------

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

    RETURNING *

    INTO v_record;


    RETURN v_record;

END;

$$;


-- =============================================================================
-- FUNCTION: CHECK OUT
--
-- Called by:
--
--   EMPLOYEE
--
-- Behaviour:
--
--   1. Finds the authenticated employee.
--   2. Finds today's INCOMPLETE record.
--   3. Records the check-out timestamp.
--   4. Changes status to PRESENT.
--
-- IMPORTANT:
--
-- Half-day is NOT automatically calculated in V1.
--
-- If required later, half-day rules can be based on
-- configurable working-hour policies.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.check_out()

RETURNS public.attendance_records

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

    v_employee_id UUID;

    v_record public.attendance_records;

BEGIN


    -- -------------------------------------------------------------------------
    -- Find the active employee.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid()

    AND employment_status = 'ACTIVE';


    IF v_employee_id IS NULL THEN

        RAISE EXCEPTION
            'Active employee record not found';

    END IF;


    -- -------------------------------------------------------------------------
    -- Complete today's attendance.
    -- -------------------------------------------------------------------------

    UPDATE public.attendance_records

    SET

        check_out_at = CURRENT_TIMESTAMP,

        status = 'PRESENT',

        source = 'SELF'

    WHERE

        employee_id = v_employee_id

        AND attendance_date = CURRENT_DATE

        AND status = 'INCOMPLETE'

    RETURNING *

    INTO v_record;


    IF v_record IS NULL THEN

        RAISE EXCEPTION
            'No incomplete attendance record found for today';

    END IF;


    RETURN v_record;

END;

$$;


-- =============================================================================
-- FUNCTION: REQUEST ATTENDANCE CORRECTION
--
-- Called by:
--
--   EMPLOYEE
--
-- Behaviour:
--
--   1. Finds authenticated employee.
--   2. Ensures the attendance record belongs to them.
--   3. Creates a correction request.
--
-- The actual attendance record is NOT changed here.
-- =============================================================================


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


    -- -------------------------------------------------------------------------
    -- Find authenticated employee.
    -- -------------------------------------------------------------------------

    SELECT id

    INTO v_employee_id

    FROM public.employees

    WHERE user_id = auth.uid();


    IF v_employee_id IS NULL THEN

        RAISE EXCEPTION
            'Employee record not found';

    END IF;


    -- -------------------------------------------------------------------------
    -- Find the employee that owns the attendance record.
    -- -------------------------------------------------------------------------

    SELECT employee_id

    INTO v_record_employee_id

    FROM public.attendance_records

    WHERE id = p_attendance_record_id;


    IF v_record_employee_id IS NULL THEN

        RAISE EXCEPTION
            'Attendance record not found';

    END IF;


    -- -------------------------------------------------------------------------
    -- Employees cannot request corrections
    -- for another employee.
    -- -------------------------------------------------------------------------

    IF v_record_employee_id != v_employee_id THEN

        RAISE EXCEPTION
            'Cannot request correction for another employee';

    END IF;


    -- -------------------------------------------------------------------------
    -- Validate reason.
    -- -------------------------------------------------------------------------

    IF p_reason IS NULL
    OR LENGTH(TRIM(p_reason)) = 0 THEN

        RAISE EXCEPTION
            'Correction reason is required';

    END IF;


    -- -------------------------------------------------------------------------
    -- Pre-flight validation of requested value combinations.
    --
    -- This catches obviously contradictory corrections early, before the
    -- request reaches the approval queue.
    --
    -- The full final-state validation (combining existing + requested values)
    -- is performed in review_attendance_correction() upon approval. Partial
    -- corrections (e.g. only changing the status, not timestamps) are valid
    -- at this stage because the final combination is only known at approval.
    -- -------------------------------------------------------------------------

    -- ABSENT and LEAVE cannot have any timestamps.

    IF p_requested_status IN ('ABSENT', 'LEAVE')
    AND (
        p_requested_check_in IS NOT NULL
        OR p_requested_check_out IS NOT NULL
    )
    THEN

        RAISE EXCEPTION
            'Corrections for ABSENT or LEAVE status cannot include check-in or check-out times';

    END IF;


    -- If both check-in and check-out times are explicitly requested,
    -- check-out must not be before check-in.

    IF p_requested_check_in IS NOT NULL
    AND p_requested_check_out IS NOT NULL
    AND p_requested_check_out < p_requested_check_in
    THEN

        RAISE EXCEPTION
            'Requested check-out time cannot be before requested check-in time';

    END IF;


    -- -------------------------------------------------------------------------
    -- Create request.
    --
    -- The partial unique index prevents multiple pending requests.
    -- -------------------------------------------------------------------------

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

    RETURNING *

    INTO v_request;


    RETURN v_request;

END;

$$;


-- =============================================================================
-- FUNCTION: REVIEW ATTENDANCE CORRECTION
--
-- Called by:
--
--   OWNER
--
-- Behaviour:
--
--   APPROVE:
--       1. Calculates the final attendance values.
--       2. Validates that the resulting record is valid.
--       3. Updates the attendance record.
--       4. Marks correction APPROVED.
--
--   REJECT:
--       1. Leaves attendance unchanged.
--       2. Marks correction REJECTED.
--
-- IMPORTANT:
--
-- We validate the FINAL attendance combination before updating.
--
-- This prevents invalid combinations such as:
--
--   PRESENT + NULL check-in
--
--   ABSENT + check-out time
--
--   check-out before check-in
-- =============================================================================


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


    -- -------------------------------------------------------------------------
    -- Only OWNER may review corrections.
    -- -------------------------------------------------------------------------

    SELECT public.get_my_role()

    INTO v_role;


    IF v_role IS DISTINCT FROM 'OWNER' THEN

        RAISE EXCEPTION
            'Only OWNER can review attendance corrections';

    END IF;


    -- -------------------------------------------------------------------------
    -- Lock correction request.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_request

    FROM public.attendance_correction_requests

    WHERE id = p_request_id

    FOR UPDATE;


    IF v_request IS NULL THEN

        RAISE EXCEPTION
            'Correction request not found';

    END IF;


    IF v_request.status != 'PENDING' THEN

        RAISE EXCEPTION
            'Correction request has already been reviewed';

    END IF;


    -- =========================================================================
    -- APPROVE
    -- =========================================================================

    IF p_approve THEN


        -- ---------------------------------------------------------------------
        -- Calculate final values.
        -- ---------------------------------------------------------------------

        SELECT

            COALESCE(
                v_request.requested_status,
                ar.status
            ),

            COALESCE(
                v_request.requested_check_in,
                ar.check_in_at
            ),

            COALESCE(
                v_request.requested_check_out,
                ar.check_out_at
            )

        INTO

            v_final_status,
            v_final_check_in,
            v_final_check_out

        FROM public.attendance_records ar

        WHERE ar.id = v_request.attendance_record_id;


        -- ---------------------------------------------------------------------
        -- Validate timestamp order.
        -- ---------------------------------------------------------------------

        IF v_final_check_out IS NOT NULL

        AND (

            v_final_check_in IS NULL

            OR v_final_check_out < v_final_check_in

        )

        THEN

            RAISE EXCEPTION
                'Invalid correction: check-out must occur after check-in';

        END IF;


        -- ---------------------------------------------------------------------
        -- Validate PRESENT / HALF_DAY.
        -- ---------------------------------------------------------------------

        IF v_final_status IN ('PRESENT', 'HALF_DAY')

        AND (

            v_final_check_in IS NULL

            OR v_final_check_out IS NULL

        )

        THEN

            RAISE EXCEPTION
                'Invalid correction: PRESENT and HALF_DAY require check-in and check-out';

        END IF;


        -- ---------------------------------------------------------------------
        -- Validate INCOMPLETE.
        -- ---------------------------------------------------------------------

        IF v_final_status = 'INCOMPLETE'

        AND (

            v_final_check_in IS NULL

            OR v_final_check_out IS NOT NULL

        )

        THEN

            RAISE EXCEPTION
                'Invalid correction: INCOMPLETE requires check-in and no check-out';

        END IF;


        -- ---------------------------------------------------------------------
        -- Validate ABSENT / LEAVE.
        -- ---------------------------------------------------------------------

        IF v_final_status IN ('ABSENT', 'LEAVE')

        AND (

            v_final_check_in IS NOT NULL

            OR v_final_check_out IS NOT NULL

        )

        THEN

            RAISE EXCEPTION
                'Invalid correction: ABSENT and LEAVE cannot contain check-in or check-out times';

        END IF;


        -- ---------------------------------------------------------------------
        -- Update attendance record.
        -- ---------------------------------------------------------------------

        UPDATE public.attendance_records

        SET

            status = v_final_status,

            check_in_at = v_final_check_in,

            check_out_at = v_final_check_out,

            source = 'CORRECTED'

        WHERE id = v_request.attendance_record_id;


        -- ---------------------------------------------------------------------
        -- Mark correction approved.
        -- ---------------------------------------------------------------------

        UPDATE public.attendance_correction_requests

        SET

            status = 'APPROVED',

            reviewed_by = auth.uid(),

            reviewed_at = CURRENT_TIMESTAMP,

            review_remarks = NULLIF(
                TRIM(p_remarks),
                ''
            )

        WHERE id = p_request_id;


    -- =========================================================================
    -- REJECT
    -- =========================================================================

    ELSE


        UPDATE public.attendance_correction_requests

        SET

            status = 'REJECTED',

            reviewed_by = auth.uid(),

            reviewed_at = CURRENT_TIMESTAMP,

            review_remarks = NULLIF(
                TRIM(p_remarks),
                ''
            )

        WHERE id = p_request_id;


    END IF;


    -- -------------------------------------------------------------------------
    -- Return the updated correction request.
    -- -------------------------------------------------------------------------

    SELECT *

    INTO v_request

    FROM public.attendance_correction_requests

    WHERE id = p_request_id;


    RETURN v_request;

END;

$$;


-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================