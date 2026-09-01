-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration 003: Expenses & Payments
--
-- Modules:
--   - Expense categories
--   - Expenses
--   - Expense documents
--   - Payments
--
-- WORKFLOW:
--
-- EMPLOYEE
--     |
--     | Submit expense
--     v
-- SUBMITTED
--     |
--     | ACCOUNTS verifies
--     v
-- PENDING_OWNER_APPROVAL
--     |
--     | OWNER approves
--     v
-- PAYMENT_PENDING
--     |
--     | ACCOUNTS records payment
--     v
-- PAID
--
-- REJECTIONS:
--
-- ACCOUNTS -> REJECTED_BY_ACCOUNTS
-- OWNER    -> REJECTED_BY_OWNER
--
-- SECURITY:
--
--   RLS is enabled in Migration 004.
--   Expense workflow RPC functions are defined in Migration 004.
--   Direct INSERT/UPDATE/DELETE access is denied through RLS.
-- =============================================================================


-- =============================================================================
-- EXPENSE CATEGORIES
-- =============================================================================


CREATE TABLE public.expense_categories (

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


CREATE TRIGGER expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- EXPENSES
--
-- submitted_by references the employee who submitted the expense.
--
-- Reviewers (accounts_reviewed_by, owner_reviewed_by) reference
-- profiles because ACCOUNTS and OWNER are application users who
-- may not have employee records of their own.
-- =============================================================================


CREATE TABLE public.expenses (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    -- -------------------------------------------------------------------------
    -- Human-readable expense identifier.
    --
    -- Example: EXP-20260831-0001
    --
    -- Generated automatically by create_expense() via
    -- generate_expense_number() in Migration 004.
    -- -------------------------------------------------------------------------

    expense_number TEXT NOT NULL UNIQUE,


    -- -------------------------------------------------------------------------
    -- Employee submitting the expense.
    -- -------------------------------------------------------------------------

    submitted_by UUID NOT NULL
        REFERENCES public.employees(id)
        ON DELETE RESTRICT,


    -- -------------------------------------------------------------------------
    -- Expense details.
    -- -------------------------------------------------------------------------

    category_id UUID NOT NULL
        REFERENCES public.expense_categories(id)
        ON DELETE RESTRICT,

    vendor_name TEXT NOT NULL,

    invoice_number TEXT,

    description TEXT NOT NULL,

    amount NUMERIC(12, 2) NOT NULL
        CHECK (amount > 0),

    currency CHAR(3) NOT NULL
        DEFAULT 'INR',

    expense_date DATE NOT NULL,


    -- -------------------------------------------------------------------------
    -- Submission timestamp.
    --
    -- NULL while DRAFT.
    -- -------------------------------------------------------------------------

    submitted_at TIMESTAMPTZ,


    -- -------------------------------------------------------------------------
    -- Workflow status.
    -- -------------------------------------------------------------------------

    status public.expense_status NOT NULL
        DEFAULT 'DRAFT',


    -- -------------------------------------------------------------------------
    -- ACCOUNTS review.
    -- -------------------------------------------------------------------------

    accounts_reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    accounts_reviewed_at TIMESTAMPTZ,

    accounts_remarks TEXT,


    -- -------------------------------------------------------------------------
    -- OWNER review.
    -- -------------------------------------------------------------------------

    owner_reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    owner_reviewed_at TIMESTAMPTZ,

    owner_remarks TEXT,


    -- -------------------------------------------------------------------------
    -- Rejection reason.
    -- -------------------------------------------------------------------------

    rejection_reason TEXT,


    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    -- -------------------------------------------------------------------------
    -- Currency must always be exactly three characters (ISO 4217).
    -- -------------------------------------------------------------------------

    CONSTRAINT expense_currency_length
    CHECK (
        CHAR_LENGTH(currency) = 3
    )

);


CREATE TRIGGER expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- EXPENSE INDEXES
-- =============================================================================


-- Employee expense history.

CREATE INDEX idx_expenses_submitted_by
ON public.expenses(submitted_by);


-- Filter by workflow status.

CREATE INDEX idx_expenses_status
ON public.expenses(status);


-- Filter by category.

CREATE INDEX idx_expenses_category
ON public.expenses(category_id);


-- Date range queries.

CREATE INDEX idx_expenses_date
ON public.expenses(
    expense_date DESC
);


-- Duplicate detection: same employee, vendor, amount, date.

CREATE INDEX idx_expense_duplicate_detection
ON public.expenses (

    submitted_by,

    vendor_name,

    amount,

    expense_date

);


-- =============================================================================
-- EXPENSE DOCUMENTS
--
-- Actual files are stored in Supabase Storage.
--
-- This table stores document metadata only.
--
-- One expense may have multiple documents.
--
-- Examples:
--
-- Receipt
-- Invoice
-- Supporting document
-- =============================================================================


CREATE TABLE public.expense_documents (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    expense_id UUID NOT NULL
        REFERENCES public.expenses(id)
        ON DELETE CASCADE,


    -- Path inside Supabase Storage.

    storage_path TEXT NOT NULL,


    original_file_name TEXT NOT NULL,

    mime_type TEXT NOT NULL,

    file_size BIGINT NOT NULL
        CHECK (file_size > 0),


    -- Profile of the user who uploaded the document.

    uploaded_by UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,


    uploaded_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE INDEX idx_expense_documents_expense
ON public.expense_documents(expense_id);


-- =============================================================================
-- PAYMENTS
--
-- V1 rules:
--
--   One expense -> one payment.
--   Partial payments are not supported.
--   Payment is recorded only after OWNER approval.
--   Payment amount equals the approved expense amount exactly.
--
-- The UNIQUE constraint on expense_id enforces one-payment-per-expense
-- at the schema level, independently of application logic.
-- =============================================================================


CREATE TABLE public.payments (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),


    expense_id UUID NOT NULL UNIQUE
        REFERENCES public.expenses(id)
        ON DELETE RESTRICT,


    -- Auto-generated internal payment identifier.
    -- Example: PAY-20260831-0001

    payment_reference TEXT NOT NULL UNIQUE,


    payment_amount NUMERIC(12, 2) NOT NULL
        CHECK (payment_amount > 0),


    payment_date DATE NOT NULL
        DEFAULT CURRENT_DATE,


    payment_method public.payment_method NOT NULL,


    -- External bank/UPI/cheque reference number.

    transaction_reference TEXT,


    -- Profile of the ACCOUNTS user recording the payment.

    recorded_by UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,


    notes TEXT,


    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TRIGGER payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PAYMENT INDEXES
-- =============================================================================


CREATE INDEX idx_payments_date
ON public.payments(
    payment_date DESC
);


CREATE INDEX idx_payments_recorded_by
ON public.payments(recorded_by);


-- =============================================================================
-- SEED DATA: EXPENSE CATEGORIES
-- =============================================================================


INSERT INTO public.expense_categories (

    name,
    description

)

VALUES

(
    'Travel',
    'Business travel expenses'
),

(
    'Fuel',
    'Fuel and transportation expenses'
),

(
    'Office Supplies',
    'Office materials and supplies'
),

(
    'Equipment',
    'Business equipment and tools'
),

(
    'Meals',
    'Authorized business meals'
),

(
    'Maintenance',
    'Maintenance and repair expenses'
),

(
    'Utilities',
    'Electricity, internet and utility expenses'
),

(
    'Miscellaneous',
    'Other valid business expenses'
)

ON CONFLICT (name)
DO NOTHING;


-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================