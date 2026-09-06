-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Audit Logging (V1 Fix)
-- =============================================================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    actor_role public.app_role NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: entity_id is TEXT to support both UUIDs and potentially other identifiers if needed.
-- But we can cast to UUID if necessary. UUID is preferred. I will make entity_id UUID.

ALTER TABLE public.audit_logs ALTER COLUMN entity_id TYPE UUID USING entity_id::UUID;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- OWNER can read all
CREATE POLICY "Owner views all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'OWNER');

-- ACCOUNTS can read financial audit logs
CREATE POLICY "Accounts views financial audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    public.get_my_role() = 'ACCOUNTS'
    AND entity_type IN ('expense', 'expense_document', 'payment')
);

-- Standard Users cannot INSERT, UPDATE, DELETE (deny by default)

-- =============================================================================
-- FUNCTION: create_audit_log
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_actor_id UUID,
    p_actor_role public.app_role,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_previous_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        previous_data,
        new_data
    )
    VALUES (
        p_actor_id,
        p_actor_role,
        p_action,
        p_entity_type,
        p_entity_id,
        p_previous_data,
        p_new_data
    );
END;
$$;

-- Revoke execute from public to ensure it's only called internally by other 
-- trusted SECURITY DEFINER functions or the service_role key.
REVOKE EXECUTE ON FUNCTION public.create_audit_log(UUID, public.app_role, TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC;
