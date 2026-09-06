# Phase 4 — Bills & Expenses Completion Log

## 1. Executive Summary

Phase 4 successfully implemented the complete Bills & Expenses operational domain. The project evolved from a static frontend mock to a fully integrated, database-backed workflow engine. It establishes end-to-end expense management, covering drafting, document storage, review routing, payment records, and security-hardened API boundaries.

## 2. Scope

The Bills & Expenses domain governs how employees request reimbursement or corporate spending approval. It mandates strict metadata tracking (vendor, category, amount, currency, invoice), required document attachment (receipts, bills), and a multi-tiered approval hierarchy (Accounts & Owner) before concluding in a formalized payment record.

## 3. Original State

Before Phase 4, the Bills & Expenses module was a pure frontend UI mock (`mockData.js`). It completely lacked backend integration. Specifically:

- No database tables for expenses or payments.
- No Supabase Storage bucket for documents.
- No role-based access control (RLS) enforcement.
- Hard rejection only (no ability to return to the employee for correction).
- Unreachable document upload component functionality.

## 4. Phase 4A — Backend Architecture Alignment

This phase focused on migrating the operational model into PostgreSQL:

- **Enum changes**: Extended `expense_status` with `RETURNED_FOR_CORRECTION`.
- **RPC changes**: Introduced `create_expense`, `update_expense`, `submit_expense`, `review_expense_accounts`, `review_expense_owner`, and `record_payment`.
- **Decision-based review model**: Refactored Accounts review to utilize a `p_decision` parameter ('APPROVE', 'REJECT', 'RETURN') rather than a simple boolean.
- **Storage Infrastructure**: Created the `expense-documents` private Supabase bucket.
- **Path Integrity**: Enforced storage path structure `<expense_id>/<uuid>-<filename>` using a database `CHECK` constraint on `expense_documents.storage_path`.
- **RLS**: Implemented robust row-level security ensuring employees only view and mutate their own records.

## 5. Database State Machine

**Creation & Correction Flow:**
`DRAFT` → `SUBMITTED` → `RETURNED_FOR_CORRECTION` → (edited by employee) → `SUBMITTED`

**Approval & Payment Flow:**
`SUBMITTED` → `PENDING_OWNER_APPROVAL` (if Accounts approves) → `PAYMENT_PENDING` (if Owner approves) → `PAID` (recorded by Accounts)

**Rejection Flow:**
`SUBMITTED` → `REJECTED_BY_ACCOUNTS` (Terminal)
`PENDING_OWNER_APPROVAL` → `REJECTED_BY_OWNER` (Terminal)

## 6. Supabase Storage Architecture

- **Bucket name**: `expense-documents`
- **Privacy**: `public = false` (private bucket)
- **Path format**: `<expense_id>/<uuid>-<filename>`
- **Upload architecture**: Frontend generates UUIDs and uploads directly to the Storage bucket, subsequently inserting metadata rows into the `public.expense_documents` table.
- **Metadata architecture**: Table tracks original filename, size, mime type, upload timestamp, and the owning employee.
- **RLS**: Authenticated users only.
- **Integrity constraint**: `storage_path LIKE (expense_id::TEXT || '/%')`

## 7. Security Model

- **Employee permissions**: Read/write access restricted specifically to records mapping to their own `user_id`.
- **Accounts permissions**: Can read non-DRAFT expenses, approve/reject/return them, and record payments.
- **Owner permissions**: Broad read access, can approve/reject items escalated to `PENDING_OWNER_APPROVAL`.
- **Draft privacy**: Enforced strict rules preventing anyone but the owning Employee from viewing `DRAFT` expenses.
- **ACCOUNTS document disclosure bug**: Identified a flaw where Accounts users could access documents attached to `DRAFT` expenses through RLS.
- **Final fix**: Patched via `20260904000004_fix_accounts_document_visibility.sql` by adding `e.status != 'DRAFT'` logic to the Accounts RLS policies on both the database and the storage bucket.

## 8. Phase 4B — Frontend Implementation

- **BillsExpenses.jsx**: Central dashboard containing the data table, filtering, metrics charting, and action dropdown logic.
- **ExpenseFormDialog**: Handles Create and Edit operations for employees.
- **ExpenseDocuments**: Handles file upload, metadata insertion, and cleanup/deletion logic using the Supabase Storage client.
- **ExpenseDetailsDialog**: Displays a comprehensive, read-only view of a specific expense including documents, review feedback, and payment information.
- **ExpenseReviewDialog**: Provides UI for Accounts and Owner roles to inject remarks and execute decisions (Approve, Reject, Return).
- **PaymentRecordDialog**: Form enabling Accounts to record reference numbers and finalize an expense to `PAID`.

## 9. Phase 4C — Integration Audit and Fix

- **Document deletion consistency issue**: Frontend logic originally deleted the Storage object first, then the metadata. If Storage succeeded but DB failed, it created a phantom UI row leading to crashes.
- **Final deletion order**: Modified `ExpenseDocuments` to delete DB metadata first, update the React state to remove the item from the UI, and then attempt Storage cleanup as a best-effort trailing operation.
- **Orphaned Storage object tradeoff**: If metadata deletes but Storage cleanup fails, the file becomes an orphaned binary. This is an intentional tradeoff ensuring the database and UI remain strictly consistent.

## 10. Phase 4D — Document Upload Integration

- **Unreachable upload functionality**: `ExpenseDocuments` was originally only mounted in `ExpenseDetailsDialog` and `ExpenseReviewDialog` using `readOnly={true}`. The upload functionality was structurally inaccessible.
- **Integration into ExpenseFormDialog**: Refactored the form to seamlessly display `ExpenseDocuments` when editing.
- **Create → Save Draft → Upload flow**: Implemented a transition in `BillsExpenses.jsx` where upon saving a new draft, the `create_expense` RPC returns the new expense row. The frontend sets this row into state, swapping the dialog to Edit mode dynamically without closing it, surfacing the document upload controls instantly.
- **Returned-for-correction**: Added a prominent "Review Feedback" banner to the top of `ExpenseFormDialog` exposing Accounts/Owner remarks while the employee corrects their submission.

## 11. Final User Workflows

### Employee

Create Expense → Save Draft (Dialog stays open) → Upload Documents → Submit

### Accounts

Review Submitted Expense → Choose Approve / Reject / Return → Provide Remarks

### Employee Correction

Open Returned Expense → Read Accounts Remarks → Edit Fields / Upload new Documents → Resubmit

### Owner

Review Escalated Expense → Choose Approve / Reject → Provide Remarks

### Accounts Payment

Select Payment Pending Expense → Record Reference, Date, Method → Mark PAID

## 12. Files Created

- `supabase/migrations/20260831000300_expenses_and_payments.sql`
- `supabase/migrations/20260831000400_security_and_functions.sql`
- `supabase/migrations/20260904000001_add_returned_enum.sql`
- `supabase/migrations/20260904000002_expense_documents_security.sql`
- `supabase/migrations/20260904000003_expense_workflow_rpc_updates.sql`
- `supabase/migrations/20260904000004_fix_accounts_document_visibility.sql`
- `src/components/expenses/ExpenseFormDialog.jsx`
- `src/components/expenses/ExpenseDocuments.jsx`
- `src/components/expenses/ExpenseDetailsDialog.jsx`
- `src/components/expenses/ExpenseReviewDialog.jsx`
- `src/components/expenses/PaymentRecordDialog.jsx`

## 13. Files Modified

- `src/pages/BillsExpenses.jsx` (Extensively rewired from mock data to Supabase RPCs and dynamic form handling)

## 14. Database Migrations

- **20260831000300_expenses_and_payments.sql**: Schema definitions for `expense_categories`, `expenses`, and `payments`.
- **20260831000400_security_and_functions.sql**: Core RLS policies, trigger-based status auditing, and `SECURITY DEFINER` RPCs for workflow.
- **20260904000001_add_returned_enum.sql**: Altered `expense_status` to include `RETURNED_FOR_CORRECTION`.
- **20260904000002_expense_documents_security.sql**: Document metadata schema, path constraints, and baseline storage RLS.
- **20260904000003_expense_workflow_rpc_updates.sql**: Refactored `review_expense_accounts` to take enum decision logic.
- **20260904000004_fix_accounts_document_visibility.sql**: Patched ACCOUNTS RLS policies to prevent `DRAFT` document leaks.

## 15. Validation

- **Build status**: `npm run build` succeeds cleanly (305ms, no errors).
- **Lint status**: `npm run lint` yields zero errors (15 expected non-blocking warnings regarding unused React generic imports).
- **Runtime testing status**: Static verification completed. Structural verification of RPCs against frontend payloads confirms compatibility.

## 16. Known Technical Debt

- **Lack of immutable expense event history**: Rejections and remarks overwrite previous states rather than keeping an append-only audit log.
- **Storage orphan possibility**: Document deletion prioritizes metadata cleanup. Network failures during the trailing Storage `remove` call will leave unreferenced binary files in the bucket.

## 17. Final Status

COMPLETE WITH DOCUMENTED TECHNICAL DEBT
