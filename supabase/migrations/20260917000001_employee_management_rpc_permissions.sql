-- -----------------------------------------------------------------------------
-- Employee Management RPC Execution Permissions
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.update_employee_role(UUID, public.app_role)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_employee_role(UUID, public.app_role)
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_attendance_correction(
    UUID,
    public.attendance_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_attendance_correction(
    UUID,
    public.attendance_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT
)
TO authenticated;
