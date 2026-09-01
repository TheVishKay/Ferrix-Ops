-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration 001: Core Identity & Employee Management
--
-- Modules:
--   - Shared enums
--   - Common database functions
--   - Authentication profiles
--   - Automatic profile creation
--   - Departments
--   - Designations
--   - Employees
--
-- SECURITY:
--   - RLS is enabled in Migration 004.
--   - Policies are intentionally separated from table creation.
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- ENUMS
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Application roles
-- -----------------------------------------------------------------------------

CREATE TYPE public.app_role AS ENUM (
    'OWNER',
    'ACCOUNTS',
    'EMPLOYEE'
);


-- -----------------------------------------------------------------------------
-- Employee employment status
-- -----------------------------------------------------------------------------

CREATE TYPE public.employment_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'EXITED'
);


-- -----------------------------------------------------------------------------
-- Employee employment type
-- -----------------------------------------------------------------------------

CREATE TYPE public.employment_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERN'
);


-- -----------------------------------------------------------------------------
-- Attendance status
--
-- Defined here because it is a shared application type.
-- Attendance tables are created in Migration 002.
-- -----------------------------------------------------------------------------

CREATE TYPE public.attendance_status AS ENUM (
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'LEAVE',
    'INCOMPLETE'
);


-- -----------------------------------------------------------------------------
-- Attendance record source
-- -----------------------------------------------------------------------------

CREATE TYPE public.attendance_source AS ENUM (
    'SELF',
    'MANUAL',
    'CORRECTED'
);


-- -----------------------------------------------------------------------------
-- Attendance correction request status
-- -----------------------------------------------------------------------------

CREATE TYPE public.correction_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


-- -----------------------------------------------------------------------------
-- Expense workflow status
--
-- Expense tables are created in Migration 003.
-- -----------------------------------------------------------------------------

CREATE TYPE public.expense_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'PENDING_OWNER_APPROVAL',
    'PAYMENT_PENDING',
    'PAID',
    'REJECTED_BY_ACCOUNTS',
    'REJECTED_BY_OWNER'
);


-- -----------------------------------------------------------------------------
-- Payment methods
-- -----------------------------------------------------------------------------

CREATE TYPE public.payment_method AS ENUM (
    'BANK_TRANSFER',
    'UPI',
    'CHEQUE',
    'CASH',
    'OTHER'
);


-- =============================================================================
-- COMMON FUNCTIONS
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Automatically updates the updated_at column.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- Returns the application role of the currently authenticated user.
--
-- SECURITY DEFINER:
--
--   This function executes as the function owner (postgres), which bypasses
--   RLS on public.profiles. This is intentional and critical:
--
--   RLS policies on most tables call get_my_role() to check access.
--   If get_my_role() were subject to profiles RLS, and profiles RLS
--   also called get_my_role(), we would have infinite recursion.
--
--   SECURITY DEFINER breaks the cycle safely.
--
-- SET search_path = '':
--
--   Prevents search_path injection attacks.
--
-- Defined here (Migration 001) so it is available without
-- forward dependencies in Migrations 002, 003, and 004.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_role()

RETURNS public.app_role

LANGUAGE sql

STABLE

SECURITY DEFINER

SET search_path = ''

AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid();
$$;


-- =============================================================================
-- PROFILES
--
-- Each authenticated Supabase user has one application profile.
--
-- auth.users
--      |
--      | 1 : 1
--      v
-- public.profiles
--
-- IMPORTANT:
--
-- A profile represents application identity.
--
-- An employee record represents employment information.
--
-- Therefore:
--
-- Every employee has a profile.
-- But a profile may temporarily exist without an employee record.
-- =============================================================================


CREATE TABLE public.profiles (

    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    email TEXT NOT NULL,

    full_name TEXT,

    avatar_url TEXT,

    role public.app_role NOT NULL
        DEFAULT 'EMPLOYEE',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- AUTOMATIC PROFILE CREATION
--
-- Whenever a user is created in Supabase Auth,
-- automatically create a corresponding profile.
--
-- SECURITY NOTE:
--
-- Every new user defaults to EMPLOYEE.
--
-- OWNER and ACCOUNTS roles must be assigned separately.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role
    )

    VALUES (
        NEW.id,

        NEW.email,

        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.email
        ),

        NEW.raw_user_meta_data ->> 'avatar_url',

        'EMPLOYEE'
    );

    RETURN NEW;

END;
$$;


CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- DEPARTMENTS
--
-- Examples:
--
--   Management
--   Accounts
--   Sales
--   Operations
-- =============================================================================


CREATE TABLE public.departments (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name TEXT NOT NULL UNIQUE,

    description TEXT,

    is_active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TRIGGER departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- DESIGNATIONS
--
-- Examples:
--
--   Director
--   Accountant
--   Manager
--   Executive
-- =============================================================================


CREATE TABLE public.designations (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name TEXT NOT NULL UNIQUE,

    description TEXT,

    is_active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TRIGGER designations_updated_at
BEFORE UPDATE ON public.designations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- EMPLOYEES
--
-- Profiles:
--     Application identity and role.
--
-- Employees:
--     Employment-specific information.
--
-- Each employee is linked to exactly one profile.
--
-- This system is intended only for the approximately 40
-- educated/smartphone-using staff members who use the application.
-- =============================================================================


CREATE TABLE public.employees (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    -- -------------------------------------------------------------------------
    -- Auth/Profile relationship
    -- -------------------------------------------------------------------------

    user_id UUID NOT NULL UNIQUE
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,


    -- -------------------------------------------------------------------------
    -- Employee identity
    -- -------------------------------------------------------------------------

    employee_code TEXT NOT NULL UNIQUE,

    first_name TEXT NOT NULL,

    last_name TEXT NOT NULL,

    company_email TEXT NOT NULL UNIQUE,

    phone_number TEXT,


    -- -------------------------------------------------------------------------
    -- Organizational information
    -- -------------------------------------------------------------------------

    department_id UUID NOT NULL
        REFERENCES public.departments(id)
        ON DELETE RESTRICT,

    designation_id UUID NOT NULL
        REFERENCES public.designations(id)
        ON DELETE RESTRICT,


    -- -------------------------------------------------------------------------
    -- Employment information
    -- -------------------------------------------------------------------------

    joining_date DATE NOT NULL,

    employment_status public.employment_status NOT NULL
        DEFAULT 'ACTIVE',

    employment_type public.employment_type NOT NULL
        DEFAULT 'FULL_TIME',


    -- -------------------------------------------------------------------------
    -- Timestamps
    -- -------------------------------------------------------------------------

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TRIGGER employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- EMPLOYEE INDEXES
-- =============================================================================


-- Lookup employee from authenticated user.

CREATE INDEX idx_employees_user_id
ON public.employees(user_id);


-- Lookup by employee code.

CREATE INDEX idx_employees_employee_code
ON public.employees(employee_code);


-- Filter employees by department.

CREATE INDEX idx_employees_department
ON public.employees(department_id);


-- Filter employees by designation.

CREATE INDEX idx_employees_designation
ON public.employees(designation_id);


-- Filter employees by employment status.

CREATE INDEX idx_employees_status
ON public.employees(employment_status);


-- =============================================================================
-- SEED DATA: DEPARTMENTS
-- =============================================================================


INSERT INTO public.departments (
    name,
    description
)

VALUES

(
    'Management',
    'Company leadership and management'
),

(
    'Accounts',
    'Finance and accounting'
),

(
    'Sales',
    'Sales and customer operations'
),

(
    'Operations',
    'Business operations'
),

(
    'Technical',
    'Technical and engineering operations'
)

ON CONFLICT (name)
DO NOTHING;


-- =============================================================================
-- SEED DATA: DESIGNATIONS
-- =============================================================================


INSERT INTO public.designations (
    name,
    description
)

VALUES

(
    'Director',
    'Company owner or senior leadership'
),

(
    'Accountant',
    'Finance and accounting'
),

(
    'Manager',
    'Department manager'
),

(
    'Executive',
    'Business or operational employee'
),

(
    'Engineer',
    'Technical employee'
)

ON CONFLICT (name)
DO NOTHING;


-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================