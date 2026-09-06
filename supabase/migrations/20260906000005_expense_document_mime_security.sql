-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Add MIME type restrictions for expense documents
-- =============================================================================

-- Drop the existing insert policy on storage.objects
DROP POLICY IF EXISTS "Employees upload documents for own expenses" ON storage.objects;

-- Recreate it with the MIME type restriction
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
    AND (LOWER(metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'application/pdf'))
);

-- Note: We do not add an UPDATE policy, because users should DELETE and INSERT 
-- new documents, not UPDATE existing objects in place, which matches the existing 
-- architecture (default deny on UPDATE).
