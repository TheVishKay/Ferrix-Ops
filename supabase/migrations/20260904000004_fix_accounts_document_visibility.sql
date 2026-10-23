-- =============================================================================
-- ferrixOps
-- Migration: Fix Accounts Document Visibility
--
-- This migration fixes an information disclosure vulnerability where ACCOUNTS
-- could view expense documents belonging to DRAFT expenses by bypassing the
-- expense table status check.
-- =============================================================================

-- 1. Drop existing vulnerable SELECT policies
DROP POLICY IF EXISTS "Users view accessible expense documents" ON public.expense_documents;
DROP POLICY IF EXISTS "Users read accessible expense documents" ON storage.objects;

-- 2. Recreate public.expense_documents SELECT policy
CREATE POLICY "Users view accessible expense documents"
ON public.expense_documents
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.expenses e
        WHERE e.id = expense_id
        AND (
            -- EMPLOYEE: Can view documents only for expenses they own
            e.submitted_by IN (
                SELECT id
                FROM public.employees
                WHERE user_id = auth.uid()
            )
            -- OWNER: Can view all expense documents
            OR public.get_my_role() = 'OWNER'
            -- ACCOUNTS: Can view documents only when parent expense is NOT DRAFT
            OR (public.get_my_role() = 'ACCOUNTS' AND e.status != 'DRAFT')
        )
    )
);

-- 3. Recreate storage.objects SELECT policy
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
            -- EMPLOYEE: Can view documents only for expenses they own
            e.submitted_by IN (
                SELECT id
                FROM public.employees
                WHERE user_id = auth.uid()
            )
            -- OWNER: Can view all expense documents
            OR public.get_my_role() = 'OWNER'
            -- ACCOUNTS: Can view documents only when parent expense is NOT DRAFT
            OR (public.get_my_role() = 'ACCOUNTS' AND e.status != 'DRAFT')
        )
    )
);
