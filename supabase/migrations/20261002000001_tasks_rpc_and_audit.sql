-- =============================================================================
-- ferrixOps
-- Migration: Tasks RPCs and Audit Logging (Phase 1.1)
-- =============================================================================

-- =============================================================================
-- 1. RPC: update_task_status
--
-- Securely transitions task status with server-side validation and audit logging.
-- Employees can only transition their own assigned tasks across valid states:
--   ASSIGNED     -> IN_PROGRESS
--   IN_PROGRESS  -> READY_FOR_REVIEW
--   RETURNED     -> IN_PROGRESS
-- Owners can transition tasks to any valid status.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_task_status(
    p_task_id UUID,
    p_new_status TEXT
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    v_employee_id UUID;
    v_task public.tasks;
    v_old_status TEXT;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock and retrieve current task
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF v_task IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    v_old_status := v_task.status;

    -- Validate target status exists in valid status domain
    IF p_new_status NOT IN (
        'CREATED',
        'ASSIGNED',
        'IN_PROGRESS',
        'READY_FOR_REVIEW',
        'RETURNED',
        'COMPLETED',
        'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'Invalid task status: %', p_new_status;
    END IF;

    -- Enforce role-specific transition rules
    IF v_actor_role = 'OWNER' THEN
        -- Owners may transition tasks to any valid status
        NULL;
    ELSE
        -- Standard employee validation
        SELECT id INTO v_employee_id
        FROM public.employees
        WHERE user_id = auth.uid()
          AND employment_status = 'ACTIVE';

        IF v_employee_id IS NULL THEN
            RAISE EXCEPTION 'Active employee record not found for current user';
        END IF;

        IF v_task.assigned_to_id != v_employee_id THEN
            RAISE EXCEPTION 'You are not assigned to this task';
        END IF;

        -- Strictly enforce employee transitions:
        -- ASSIGNED    -> IN_PROGRESS
        -- IN_PROGRESS -> READY_FOR_REVIEW
        -- RETURNED    -> IN_PROGRESS
        IF NOT (
            (v_task.status = 'ASSIGNED' AND p_new_status = 'IN_PROGRESS') OR
            (v_task.status = 'IN_PROGRESS' AND p_new_status = 'READY_FOR_REVIEW') OR
            (v_task.status = 'RETURNED' AND p_new_status = 'IN_PROGRESS')
        ) THEN
            RAISE EXCEPTION 'Transition from % to % is not permitted for employees', v_task.status, p_new_status;
        END IF;
    END IF;

    -- Update status
    UPDATE public.tasks
    SET
        status = p_new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    -- Audit log
    PERFORM public.create_audit_log(
        auth.uid(),
        v_actor_role,
        'TASK_STATUS_UPDATED',
        'task',
        p_task_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', p_new_status)
    );

    RETURN v_task;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_task_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_task_status(UUID, TEXT) TO authenticated;


-- =============================================================================
-- 2. RPC: create_task
--
-- Owner-only task creation with server-side position calculation and atomic audit.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_task(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_assigned_to_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'MEDIUM',
    p_status TEXT DEFAULT 'CREATED',
    p_due_date DATE DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    v_position DOUBLE PRECISION;
    v_task public.tasks;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    IF v_actor_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Only owners can create tasks';
    END IF;

    IF p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
        RAISE EXCEPTION 'Task title is required';
    END IF;

    IF p_assigned_to_id IS NULL THEN
        RAISE EXCEPTION 'Assigned employee is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.employees WHERE id = p_assigned_to_id
    ) THEN
        RAISE EXCEPTION 'Assigned employee does not exist';
    END IF;

    IF p_priority NOT IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT') THEN
        RAISE EXCEPTION 'Invalid task priority: %', p_priority;
    END IF;

    IF p_status NOT IN (
        'CREATED',
        'ASSIGNED',
        'IN_PROGRESS',
        'READY_FOR_REVIEW',
        'RETURNED',
        'COMPLETED',
        'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'Invalid task status: %', p_status;
    END IF;

    -- Calculate next position atomically
    SELECT COALESCE(MAX(position), 0.0) + 1000.0
    INTO v_position
    FROM public.tasks;

    INSERT INTO public.tasks (
        title,
        description,
        assigned_to_id,
        priority,
        status,
        due_date,
        position,
        created_by
    )
    VALUES (
        TRIM(p_title),
        NULLIF(TRIM(p_description), ''),
        p_assigned_to_id,
        p_priority,
        p_status,
        p_due_date,
        v_position,
        auth.uid()
    )
    RETURNING * INTO v_task;

    PERFORM public.create_audit_log(
        auth.uid(),
        'OWNER'::public.app_role,
        'TASK_CREATED',
        'task',
        v_task.id,
        NULL,
        jsonb_build_object(
            'title', v_task.title,
            'description', v_task.description,
            'assigned_to_id', v_task.assigned_to_id,
            'priority', v_task.priority,
            'status', v_task.status,
            'due_date', v_task.due_date,
            'position', v_task.position
        )
    );

    RETURN v_task;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_task(TEXT, TEXT, UUID, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_task(TEXT, TEXT, UUID, TEXT, TEXT, DATE) TO authenticated;


-- =============================================================================
-- 3. RPC: update_task
--
-- Owner-only task update with full field validation and atomic audit logging.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_task(
    p_task_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_assigned_to_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'MEDIUM',
    p_status TEXT DEFAULT 'CREATED',
    p_due_date DATE DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    v_old_task public.tasks;
    v_updated_task public.tasks;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    IF v_actor_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Only owners can update tasks via this function';
    END IF;

    IF p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
        RAISE EXCEPTION 'Task title is required';
    END IF;

    IF p_assigned_to_id IS NULL THEN
        RAISE EXCEPTION 'Assigned employee is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.employees WHERE id = p_assigned_to_id
    ) THEN
        RAISE EXCEPTION 'Assigned employee does not exist';
    END IF;

    IF p_priority NOT IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT') THEN
        RAISE EXCEPTION 'Invalid task priority: %', p_priority;
    END IF;

    IF p_status NOT IN (
        'CREATED',
        'ASSIGNED',
        'IN_PROGRESS',
        'READY_FOR_REVIEW',
        'RETURNED',
        'COMPLETED',
        'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'Invalid task status: %', p_status;
    END IF;

    SELECT * INTO v_old_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF v_old_task IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    UPDATE public.tasks
    SET
        title = TRIM(p_title),
        description = NULLIF(TRIM(p_description), ''),
        assigned_to_id = p_assigned_to_id,
        priority = p_priority,
        status = p_status,
        due_date = p_due_date,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_task_id
    RETURNING * INTO v_updated_task;

    PERFORM public.create_audit_log(
        auth.uid(),
        'OWNER'::public.app_role,
        'TASK_UPDATED',
        'task',
        p_task_id,
        jsonb_build_object(
            'title', v_old_task.title,
            'description', v_old_task.description,
            'assigned_to_id', v_old_task.assigned_to_id,
            'priority', v_old_task.priority,
            'status', v_old_task.status,
            'due_date', v_old_task.due_date
        ),
        jsonb_build_object(
            'title', v_updated_task.title,
            'description', v_updated_task.description,
            'assigned_to_id', v_updated_task.assigned_to_id,
            'priority', v_updated_task.priority,
            'status', v_updated_task.status,
            'due_date', v_updated_task.due_date
        )
    );

    RETURN v_updated_task;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_task(UUID, TEXT, TEXT, UUID, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_task(UUID, TEXT, TEXT, UUID, TEXT, TEXT, DATE) TO authenticated;


-- =============================================================================
-- 4. RPC: delete_task
--
-- Owner-only task deletion with atomic audit logging.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_task(
    p_task_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    v_old_task public.tasks;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    IF v_actor_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Only owners can delete tasks';
    END IF;

    SELECT * INTO v_old_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF v_old_task IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    DELETE FROM public.tasks
    WHERE id = p_task_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        'OWNER'::public.app_role,
        'TASK_DELETED',
        'task',
        p_task_id,
        jsonb_build_object(
            'title', v_old_task.title,
            'description', v_old_task.description,
            'assigned_to_id', v_old_task.assigned_to_id,
            'priority', v_old_task.priority,
            'status', v_old_task.status,
            'due_date', v_old_task.due_date
        ),
        NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_task(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_task(UUID) TO authenticated;
