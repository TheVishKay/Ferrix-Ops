-- =============================================================================
-- ferrixOps
-- Migration: Expense Documents Security and Storage Infrastructure
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Metadata/Storage Consistency Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM public.expense_documents 
        WHERE storage_path NOT LIKE (expense_id::TEXT || '/%')
    ) THEN
        RAISE EXCEPTION 'Cannot apply check constraint: existing expense_documents violate path rule.';
    END IF;
END $$;

ALTER TABLE public.expense_documents 
ADD CONSTRAINT expense_documents_path_check 
CHECK (storage_path LIKE (expense_id::TEXT || '/%'));

-- -----------------------------------------------------------------------------
-- 2. Drop Obsolete Permissive RLS Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employees upload documents for own expenses" ON public.expense_documents;
DROP POLICY IF EXISTS "Privileged users upload expense documents" ON public.expense_documents;
DROP POLICY IF EXISTS "Employees delete own documents from draft expenses" ON public.expense_documents;
DROP POLICY IF EXISTS "Owner deletes expense documents" ON public.expense_documents;

-- -----------------------------------------------------------------------------
-- 3. Create Strict RLS Policies for Document Metadata
-- -----------------------------------------------------------------------------
CREATE POLICY "Employees upload documents for own expenses"
ON public.expense_documents
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.expenses e
        JOIN public.employees emp ON emp.id = e.submitted_by
        WHERE e.id = expense_id
        AND emp.user_id = auth.uid()
        AND e.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION')
    )
);

CREATE POLICY "Employees delete own documents"
ON public.expense_documents
FOR DELETE
TO authenticated
USING (
    uploaded_by = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.expenses e
        JOIN public.employees emp ON emp.id = e.submitted_by
        WHERE e.id = expense_id
        AND emp.user_id = auth.uid()
        AND e.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION')
    )
);

CREATE POLICY "Owner deletes expense documents"
ON public.expense_documents
FOR DELETE
TO authenticated
USING (
    public.get_my_role() = 'OWNER'
);

-- -----------------------------------------------------------------------------
-- 4. Storage Infrastructure (Buckets & Policies)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-documents', 'expense-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage object path validation safe cast (preventing cast errors):
-- We use a regex check to ensure the first path segment is a UUID before casting.

CREATE POLICY "Users read accessible expense documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'expense-documents'
    AND (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    AND EXISTS (
        SELECT 1
        FROM public.expenses e
        WHERE e.id = (split_part(name, '/', 1))::uuid
        AND (
            e.submitted_by IN (
                SELECT id
                FROM public.employees
                WHERE user_id = auth.uid()
            )
            OR public.get_my_role() IN ('OWNER', 'ACCOUNTS')
        )
    )
);

CREATE POLICY "Employees upload documents for own expenses"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'expense-documents'
    AND (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    AND EXISTS (
        SELECT 1
        FROM public.expenses e
        JOIN public.employees emp ON emp.id = e.submitted_by
        WHERE e.id = (split_part(name, '/', 1))::uuid
        AND emp.user_id = auth.uid()
        AND e.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION')
    )
);

CREATE POLICY "Employees delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'expense-documents'
    AND (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    AND EXISTS (
        SELECT 1
        FROM public.expenses e
        JOIN public.employees emp ON emp.id = e.submitted_by
        WHERE e.id = (split_part(name, '/', 1))::uuid
        AND emp.user_id = auth.uid()
        AND e.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION')
    )
);

CREATE POLICY "Owner deletes expense documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'expense-documents'
    AND public.get_my_role() = 'OWNER'
);
