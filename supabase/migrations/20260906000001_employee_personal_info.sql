-- -----------------------------------------------------------------------------
-- Employee Personal Info (Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE public.employee_personal_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE RESTRICT,
    date_of_birth DATE NOT NULL,
    personal_phone TEXT NOT NULL,
    personal_email TEXT NOT NULL,
    address TEXT NOT NULL,
    emergency_contact TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE TRIGGER set_employee_personal_info_updated_at
BEFORE UPDATE ON public.employee_personal_info
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.employee_personal_info ENABLE ROW LEVEL SECURITY;

-- OWNER gets full access
CREATE POLICY "Owner manages employee personal info"
ON public.employee_personal_info
FOR ALL
TO authenticated
USING (public.get_my_role() = 'OWNER')
WITH CHECK (public.get_my_role() = 'OWNER');

-- EMPLOYEE gets read/update on own record
CREATE POLICY "Employee views own personal info"
ON public.employee_personal_info
FOR SELECT
TO authenticated
USING (
    employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Employee updates own personal info"
ON public.employee_personal_info
FOR UPDATE
TO authenticated
USING (
    employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
);
