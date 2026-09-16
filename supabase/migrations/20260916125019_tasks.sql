-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Tasks Module
-- =============================================================================

-- =============================================================================
-- TASKS TABLE
-- =============================================================================

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,

    description TEXT,

    assigned_to_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,

    priority TEXT NOT NULL DEFAULT 'MEDIUM',

    status TEXT NOT NULL DEFAULT 'CREATED',

    due_date DATE,

    position DOUBLE PRECISION NOT NULL,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to_id);
CREATE INDEX idx_tasks_position ON public.tasks(position);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- VIEW POLICIES
-- -----------------------------------------------------------------------------

-- Owners can view all tasks
CREATE POLICY "Owners can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'OWNER');

-- Employees and Accounts can view tasks assigned to them
CREATE POLICY "Employees can view assigned tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
    assigned_to_id IN (
        SELECT id
        FROM public.employees
        WHERE user_id = auth.uid()
    )
);

-- -----------------------------------------------------------------------------
-- MUTATION POLICIES (OWNER ONLY)
-- -----------------------------------------------------------------------------

-- Only Owners can create tasks
CREATE POLICY "Owners can insert tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.get_my_role() = 'OWNER');

-- Only Owners can update tasks
CREATE POLICY "Owners can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'OWNER');

-- Only Owners can delete tasks
CREATE POLICY "Owners can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.get_my_role() = 'OWNER');

-- =============================================================================
-- RPC: Update Task Positions
--
-- Efficiently update multiple positions for drag-and-drop.
-- Only available to OWNER.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_task_positions(
    p_tasks JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_role public.app_role;
    task_record RECORD;
BEGIN
    SELECT public.get_my_role() INTO v_actor_role;

    IF v_actor_role != 'OWNER' THEN
        RAISE EXCEPTION 'Only owners can reorder tasks';
    END IF;

    -- p_tasks is expected to be an array of objects: { "id": "uuid", "position": float }
    FOR task_record IN
        SELECT (value->>'id')::UUID AS id, (value->>'position')::DOUBLE PRECISION AS position
        FROM jsonb_array_elements(p_tasks)
    LOOP
        UPDATE public.tasks
        SET position = task_record.position, updated_at = CURRENT_TIMESTAMP
        WHERE id = task_record.id;
    END LOOP;
END;
$$;
