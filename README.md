# Employee Operations Management System V1

The Employee Operations Management System V1 is a role-based internal application designed to streamline core HR and administrative workflows. 

This repository implements the V1 specification, which includes:
- Employee Management
- Attendance Management
- Bills / Expenses (with document attachments and multi-stage review)
- A role-aware Dashboard
- End-to-end security and auditability via Supabase Auth and Row Level Security (RLS)

*Note: This is an internal tool. Certain advanced modules (Leave, Tasks, etc.) are intentionally deferred for future phases.*

## 1. Roles & Permissions

The system operates strictly on a three-tier role architecture.

- **OWNER**: The global administrator. Has unrestricted access to view all employees, approve/reject expenses, resolve attendance corrections, manage organizational structure (Departments/Designations), and provision new employees.
- **ACCOUNTS**: The financial administrator. Can view all expenses, return expenses for correction to employees, and mark approved expenses as paid. Can also view the employee directory.
- **EMPLOYEE**: The standard user. Can only view and edit their own personal information, check in/out for attendance, submit attendance corrections, and submit their own expenses.

## 2. Technology Stack

- **Frontend**: React, Vite, React Router
- **Styling/UI**: Tailwind CSS, Radix UI (accessible primitives)
- **Backend / Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Serverless Compute**: Supabase Edge Functions (Deno)

## 3. Local Development

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+ recommended)
- Supabase CLI (if running the backend locally or deploying Edge Functions)

### Setup Commands
```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run ESLint to verify code quality
npm run lint

# Create the production build
npm run build
```

## 4. Environment Variables

The frontend requires two non-sensitive environment variables to connect to the Supabase backend. Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Note**: Server-side secrets for Edge Functions must be configured via the Supabase CLI, not in the frontend `.env`.

## 5. Supabase Setup & Configuration

To set up the V1 backend infrastructure, you must configure a Supabase project:

1. **Create the Project**: Create a new Supabase project in the Supabase Dashboard.
2. **Apply Migrations**: The database schema, RLS policies, and Storage buckets are defined declaratively. Run all migrations in the `supabase/migrations` folder using the Supabase CLI:
   `supabase db push` or apply them manually in order.
3. **Configure Auth**: 
   - Enable the **Email** provider.
   - Configure your **Site URL** and **Redirect URLs** in the Supabase Auth settings to match your production domain.
4. **Storage Requirements**: The migration creates a private bucket called `expense-documents`. RLS policies strictly control read/write access.
5. **Edge Functions**: Deploy the serverless functions (`create-employee` and `update-employee-status`) via the Supabase CLI:
   `supabase functions deploy`
   You must set the required secrets for the functions to operate:
   `supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...`
6. **First OWNER Bootstrap**: Since only an OWNER can provision other employees, you must manually create the first `OWNER` user record directly in the database (`profiles` table) after they sign up via the Supabase Dashboard.

## 6. Database Architecture

The PostgreSQL schema relies on the following core tables:
- `profiles`: Links Supabase Auth UUIDs to application roles.
- `employees`: Core employment data (department, designation, status, employee code).
- `employee_personal_info`: Sensitive PII isolated for stricter access control.
- `departments` & `designations`: Organizational taxonomy.
- `attendance_records`: Daily check-in/check-out timestamps and status.
- `attendance_correction_requests`: Formal requests by employees to amend historical attendance.
- `expenses`: Financial claims submitted by employees.
- `expense_documents`: File metadata mapping to objects in Supabase Storage.
- `audit_logs`: Immutable ledger of sensitive system events (e.g., employee creation).

## 7. Employee Provisioning Workflow

The system uses a strict provisioning flow to ensure security:
1. **OWNER** submits the new employee form.
2. The `create-employee` Edge Function is invoked.
3. The function provisions a Supabase Auth user via the Admin API.
4. The function inserts the `profile`, `employee`, and `employee_personal_info` records.
5. An `audit_log` entry is recorded.
6. **Compensating Rollback**: If database insertion fails after Auth creation, the function attempts to delete the newly created Auth user to prevent orphaned accounts.

## 8. Expense Workflow

Expenses progress through strict statuses:
- **DRAFT**: Employee is preparing the claim. Can upload/delete documents.
- **PENDING_REVIEW**: Submitted for OWNER approval.
- **RETURNED_FOR_CORRECTION**: ACCOUNTS requires the employee to fix the claim. (Employee can edit/upload documents again).
- **REJECTED**: OWNER denied the claim. Terminal state.
- **APPROVED**: OWNER approved the claim. Awaiting ACCOUNTS payment.
- **PAID**: ACCOUNTS completed payment. Terminal state.

Documents are strictly tied to expenses and secured via RLS to ensure only authorized users (the submitter, ACCOUNTS, and OWNER) can read them.

## 9. Attendance Management

- **Check-in / Check-out**: Handled via secure RPC calls (`check_in`, `check_out`) that use the server timestamp, preventing client-side spoofing.
- **Correction Requests**: If an employee forgets to check out or needs to amend a past record, they submit a correction request.
- **Review**: The OWNER reviews the request. If approved, the underlying `attendance_records` row is securely updated via a backend RPC.

## 10. Security Architecture

- **Supabase Auth**: Manages JWTs, sessions, and secure login.
- **Row Level Security (RLS)**: Every table has strict RLS policies. The application never trusts the client.
- **Edge Functions & RPCs**: Privileged operations (like updating another user's attendance or provisioning accounts) are restricted to backend Edge Functions or `SECURITY DEFINER` RPCs, keeping the `service_role` key safely out of the frontend.
- **Private Storage**: `expense-documents` is a private bucket. Files are accessed via short-lived signed URLs.

## 11. Deployment Requirements

**Hosting Provider: TO BE FINALIZED**

The application is a standard React Vite Single Page Application (SPA). To deploy it to a static host:

1. Build the application using `npm run build`.
2. The output will be generated in the `dist/` directory.
3. **SPA Fallback Required**: You must configure your host to rewrite all unhandled routes (e.g., `/*`) to `/index.html` to support React Router client-side routing. *(Provider-specific configuration files like `vercel.json` or `_redirects` will be added once the host is finalized.)*
4. Provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your host's environment variable settings.

## 12. Deferred V1 Functionality

The following modules are visible in the UI for future-proofing but are intentionally **not functional** in the V1 operational release:
- Tasks / Workflows
- Leave Management
- Notifications
- Production KPIs & Complex Analytics
- Payroll & Inventory ERP

## 13. Known Accepted V1 Risks

The following technical compromises have been audited and accepted for V1:
1. **Non-atomic Auth/DB Provisioning**: Creating an Auth user and their DB records is not a true atomic distributed transaction. A runtime crash between the two steps could leave an orphaned Auth user. A compensating rollback is implemented to mitigate this.
2. **Client-Provided MIME Metadata**: The frontend determines MIME types for uploaded documents (jpeg/png/pdf) without deep content inspection on the backend.
3. **Orphaned Storage Objects**: If an expense document's database metadata deletion succeeds but the subsequent Storage API delete call fails due to a hard interruption, an orphaned file may remain in the bucket.
4. **Malformed UUID Casting**: Passing a non-UUID string to a UUID route parameter triggers a safe generic error rather than an auth bypass.
5. **Auth Ban Duration**: The default Supabase Auth ban duration of 876000h (100 years) is accepted as standard behavior for disabling access.
