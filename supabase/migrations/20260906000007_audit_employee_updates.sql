-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Add audit logging for direct Employee updates
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trigger for public.employees
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_employee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role public.app_role;
    v_changed JSONB := '{}'::jsonb;
    v_previous JSONB := '{}'::jsonb;
BEGIN
    -- Ignore updates where only updated_at changed
    -- Compare meaningul fields
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        v_changed := jsonb_set(v_changed, '{department_id}', to_jsonb(NEW.department_id));
        v_previous := jsonb_set(v_previous, '{department_id}', to_jsonb(OLD.department_id));
    END IF;
    
    IF NEW.designation_id IS DISTINCT FROM OLD.designation_id THEN
        v_changed := jsonb_set(v_changed, '{designation_id}', to_jsonb(NEW.designation_id));
        v_previous := jsonb_set(v_previous, '{designation_id}', to_jsonb(OLD.designation_id));
    END IF;

    IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
        v_changed := jsonb_set(v_changed, '{employment_status}', to_jsonb(NEW.employment_status));
        v_previous := jsonb_set(v_previous, '{employment_status}', to_jsonb(OLD.employment_status));
    END IF;

    IF NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
        v_changed := jsonb_set(v_changed, '{employee_code}', to_jsonb(NEW.employee_code));
        v_previous := jsonb_set(v_previous, '{employee_code}', to_jsonb(OLD.employee_code));
    END IF;

    IF NEW.joining_date IS DISTINCT FROM OLD.joining_date THEN
        v_changed := jsonb_set(v_changed, '{joining_date}', to_jsonb(NEW.joining_date));
        v_previous := jsonb_set(v_previous, '{joining_date}', to_jsonb(OLD.joining_date));
    END IF;

    -- If no meaningful organizational fields changed, skip audit
    IF v_changed = '{}'::jsonb THEN
        RETURN NEW;
    END IF;

    -- Extract actor identity from JWT
    v_actor_id := auth.uid();

    -- Service-role operations (like the update-employee-status Edge Function) 
    -- execute without a JWT (auth.uid() is NULL).
    -- They manually insert their own audit logs.
    -- By requiring auth.uid() IS NOT NULL, we avoid duplicate logs and safely audit 
    -- only direct RLS-based updates from the frontend.
    IF v_actor_id IS NOT NULL THEN
        v_actor_role := public.get_my_role();
        PERFORM public.create_audit_log(
            v_actor_id,
            v_actor_role,
            'EMPLOYEE_UPDATED',
            'employee',
            NEW.id,
            v_previous,
            v_changed
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_employee_update ON public.employees;
CREATE TRIGGER audit_employee_update
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_employee_update();


-- -----------------------------------------------------------------------------
-- 2. Trigger for public.employee_personal_info
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_employee_personal_info_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role public.app_role;
    v_changed_fields TEXT[] := '{}';
    v_metadata JSONB := '{}'::jsonb;
BEGIN
    -- Detect which sensitive fields were changed, but DO NOT log the actual values.
    IF NEW.personal_phone IS DISTINCT FROM OLD.personal_phone THEN
        v_changed_fields := array_append(v_changed_fields, 'personal_phone');
    END IF;
    
    IF NEW.personal_email IS DISTINCT FROM OLD.personal_email THEN
        v_changed_fields := array_append(v_changed_fields, 'personal_email');
    END IF;
    
    IF NEW.address IS DISTINCT FROM OLD.address THEN
        v_changed_fields := array_append(v_changed_fields, 'address');
    END IF;
    
    IF NEW.emergency_contact IS DISTINCT FROM OLD.emergency_contact THEN
        v_changed_fields := array_append(v_changed_fields, 'emergency_contact');
    END IF;
    
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
        v_changed_fields := array_append(v_changed_fields, 'date_of_birth');
    END IF;

    -- If no sensitive fields changed, skip audit
    IF array_length(v_changed_fields, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Package into safe metadata JSON
    v_metadata := jsonb_build_object('changed_fields', to_jsonb(v_changed_fields));

    -- Extract actor identity from JWT
    v_actor_id := auth.uid();

    IF v_actor_id IS NOT NULL THEN
        v_actor_role := public.get_my_role();
        PERFORM public.create_audit_log(
            v_actor_id,
            v_actor_role,
            'EMPLOYEE_UPDATED',
            'employee',
            NEW.employee_id,
            NULL,       -- Do not store previous sensitive data
            v_metadata  -- Only store metadata of what changed
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_employee_personal_info_update ON public.employee_personal_info;
CREATE TRIGGER audit_employee_personal_info_update
AFTER UPDATE ON public.employee_personal_info
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_employee_personal_info_update();
