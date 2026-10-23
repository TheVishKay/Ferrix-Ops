-- ferrixOps: close null-role reorder bypass and serialize position allocation.
-- Additive migration; do not rewrite migrations already deployed.
BEGIN;

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

    -- Shared with reorder: serialize allocation even when the board is empty.
    -- Reserved advisory lock namespace: ferrixOps task board (74123, 1).
    PERFORM pg_catalog.pg_advisory_xact_lock(74123, 1);

    -- Allocate after acquiring the transaction-scoped board lock.
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


CREATE OR REPLACE FUNCTION public.update_task_positions(p_tasks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task RECORD;
    v_previous_position DOUBLE PRECISION;
BEGIN
    IF public.get_my_role() IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Only owners can reorder tasks';
    END IF;

    IF p_tasks IS NULL OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Task positions must be a JSON array';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_tasks) AS item
        WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
           OR item->>'id' IS NULL
           OR jsonb_typeof(item->'position') IS DISTINCT FROM 'number'
    ) THEN
        RAISE EXCEPTION 'Each task requires an id and a numeric position';
    END IF;

    IF (SELECT count(*) FROM jsonb_array_elements(p_tasks)) <>
       (SELECT count(DISTINCT (item->>'id')::UUID) FROM jsonb_array_elements(p_tasks) AS item) THEN
        RAISE EXCEPTION 'Duplicate task ids are not allowed';
    END IF;

    -- Same lock/order as create_task; serialize before taking any row locks.
    PERFORM pg_catalog.pg_advisory_xact_lock(74123, 1);

    FOR v_task IN
        SELECT (item->>'id')::UUID AS id,
               (item->>'position')::DOUBLE PRECISION AS position
        FROM jsonb_array_elements(p_tasks) AS item
        ORDER BY (item->>'id')::UUID
    LOOP
        -- JSON numbers may overflow float8; PostgreSQL rejects those casts.
        SELECT position INTO v_previous_position
        FROM public.tasks WHERE id = v_task.id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Task not found: %', v_task.id;
        END IF;

        UPDATE public.tasks SET position = v_task.position WHERE id = v_task.id;
        PERFORM public.create_audit_log(
            auth.uid(), 'OWNER'::public.app_role, 'TASK_REORDERED', 'task', v_task.id,
            jsonb_build_object('position', v_previous_position),
            jsonb_build_object('position', v_task.position)
        );
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_task_positions(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_task_positions(JSONB) TO authenticated;

-- Task writes must go through audited RPCs, including on installations with
-- broader table defaults. SELECT stays available under existing RLS policies.
REVOKE INSERT, UPDATE, DELETE ON public.tasks FROM PUBLIC, anon, authenticated;

COMMIT;
