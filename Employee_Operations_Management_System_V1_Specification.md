# Employee Operations Management System
## Detailed V1 Project Specification

**Project Version:** V1 Prototype  
**Status:** Active Development Specification  
**Primary Purpose:** Internal Employee Operations Management  
**Target Users:** Approximately 50 employees initially  
**Future Scalability:** Designed to support larger organizations

---

# 1. Project Overview

The Employee Operations Management System (EMS) is an internal web-based platform designed to centralize and digitize essential company operations.

The V1 system focuses on three core areas:

1. **Employee Management**
2. **Employee Attendance Management**
3. **Bills and Expense Management**

The system provides controlled access based on three user roles:

- Owner
- Accounts Department
- Employee

The primary objective is to replace fragmented manual processes, spreadsheets, informal communication, and poorly tracked financial records with a centralized and auditable system.

The system must work on desktop computers, laptops, tablets, and mobile devices.

---

# 2. Project Objectives

The system must allow the company to:

- Maintain a centralized employee directory.
- Store structured employee information.
- Manage employee employment status.
- Track employee attendance using reliable timestamps.
- Allow employees to check in and check out.
- Allow employees to view their attendance history.
- Allow attendance correction requests.
- Provide controlled access to financial and expense workflows.
- Allow employees to submit bills and expenses.
- Allow Accounts to verify submitted expenses.
- Allow the Owner to provide final approval.
- Allow Accounts to record completed payments.
- Maintain an audit trail for critical operations.
- Store invoices and receipts securely.
- Prevent unauthorized access to company data.
- Prevent employees from accessing other employees' private information.
- Provide a foundation for future modules.

---

# 3. V1 Scope

## 3.1 Employee Management

The system will provide:

- Employee directory.
- Employee profiles.
- Employee creation.
- Employee information management.
- Departments.
- Designations.
- Employment status management.
- Employee activation and deactivation.
- Controlled employee information visibility.

## 3.2 Attendance Management

The system will provide:

- Employee check-in.
- Employee check-out.
- Server-generated timestamps.
- Daily attendance records.
- Working duration calculation.
- Attendance history.
- Attendance status.
- Attendance correction requests.
- Attendance reports for authorized users.

## 3.3 Bills and Expense Management

The system will provide:

- Expense submission.
- Bill submission.
- Invoice and receipt uploads.
- Expense categorization.
- Accounts review.
- Expense verification.
- Return for correction.
- Owner approval.
- Rejection.
- Payment recording.
- Payment history.
- Duplicate detection support.
- Audit history.

---

# 4. Explicitly Out of Scope for V1

The following features are **not part of the current V1 implementation**:

- Task Management
- Facial Recognition
- GPS-Based Attendance
- Advanced Payroll
- Advanced Leave Management

These may be implemented in future versions.

---

# 5. User Roles

The system contains exactly three primary access levels:

```text
OWNER
ACCOUNTS
EMPLOYEE
```

The system must enforce permissions at:

1. Frontend level for user experience.
2. Backend/database level for security.

Hiding a button is **not sufficient security**.

---

# 6. Role Definitions

## 6.1 Owner

The Owner has the highest level of access.

Responsibilities include:

- Company-wide employee management.
- Company-wide attendance visibility.
- Reviewing attendance corrections.
- Reviewing verified expenses.
- Final approval or rejection of expenses.
- Viewing financial history.
- Viewing company reports.
- Viewing audit records.
- Managing departments and designations.

## 6.2 Accounts

The Accounts role is primarily responsible for financial operations.

Accounts can:

- View submitted bills and expenses.
- Review expenses.
- Verify bills.
- Detect suspicious expenses.
- Return bills for correction.
- Reject invalid bills.
- View employee information necessary for financial operations.
- Record payments.
- Maintain financial records.

Accounts cannot provide final Owner approval.

Accounts can only process payments after Owner approval.

## 6.3 Employee

Employees can:

- View their own profile.
- View their own attendance.
- Check in.
- Check out.
- View attendance history.
- Request attendance corrections.
- Submit bills and expenses.
- Upload receipts and invoices.
- View their submitted expense status.
- Correct and resubmit returned expenses.

Employees cannot:

- View other employees' private information.
- View company-wide attendance.
- Approve expenses.
- Record payments.
- View other employees' expenses.
- Access audit logs.

---

# 7. Permission Matrix

| Feature | Owner | Accounts | Employee |
|---|---|---|---|
| View all employees | Full | Limited | No |
| View own profile | Yes | Yes | Yes |
| Create employee | Yes | No | No |
| Edit employee | Yes | No | Limited own profile |
| Deactivate employee | Yes | No | No |
| Manage departments | Yes | No | No |
| Manage designations | Yes | No | No |
| View all attendance | Yes | No | No |
| View own attendance | Yes | Yes | Yes |
| Check in | Optional | Yes | Yes |
| Check out | Optional | Yes | Yes |
| Request attendance correction | Yes | Yes | Yes |
| Approve attendance correction | Yes | No | No |
| Submit bill | Yes | Yes | Yes |
| View all bills | Yes | Yes | No |
| View own bills | Yes | Yes | Yes |
| Review bills | Yes | Yes | No |
| Verify bills | Yes | Yes | No |
| Return bill for correction | Yes | Yes | No |
| Reject bill | Yes | Yes | No |
| Final approval | Yes | No | No |
| Record payment | View | Yes | No |
| View payment history | Yes | Yes | Own only |
| View audit logs | Yes | Limited financial audit | No |

---

# 8. Employee Management Module

The Employee Management module provides a centralized record of all employees.

It should replace scattered information stored across:

- Spreadsheets.
- Documents.
- Informal records.
- Personal files.

---

# 9. Employee Directory

The Owner must be able to view a directory of employees.

The directory should support:

- Search by employee name.
- Search by employee ID.
- Department filtering.
- Designation filtering.
- Employment status filtering.

Example fields:

```text
Employee Name
Employee ID
Department
Designation
Company Email
Employment Status
Joining Date
```

---

# 10. Employee Profile

Each employee must have an individual profile.

## 10.1 Basic Information

```text
Employee ID
Full Name
Profile Photo
Company Email
Phone Number
Department
Designation
Joining Date
Employment Status
```

## 10.2 Personal Information

```text
Date of Birth
Personal Phone Number
Personal Email
Address
Emergency Contact
```

Sensitive information must have restricted access.

Accounts should not automatically receive access to private employee information.

## 10.3 Employment Information

```text
Employee ID
Department
Designation
Joining Date
Employment Status
Employment Type
```

Possible statuses:

```text
ACTIVE
INACTIVE
RESIGNED
TERMINATED
```

Employee records should generally not be permanently deleted.

Historical records must remain preserved.

---

# 11. Departments and Designations

The Owner should manage departments and designations.

Example departments:

```text
Accounts
Sales
Operations
Human Resources
Management
Technical
```

Example designations:

```text
Accountant
Sales Executive
Manager
Supervisor
Operations Executive
```

---

# 12. Employee Lifecycle

```text
Employee Created
        ↓
ACTIVE
        ↓
INACTIVE / RESIGNED / TERMINATED
```

Historical attendance and expense records must remain preserved.

---

# 13. Attendance Management

## 13.1 Attendance Method

V1 attendance uses:

> **Server-generated timestamp-based attendance.**

The employee performs:

```text
CHECK IN
```

The system records the authoritative server timestamp.

Later:

```text
CHECK OUT
```

The system records the server timestamp.

The frontend must not be trusted as the authoritative source of attendance time.

---

# 14. Check-In

The system records:

```text
Employee ID
Attendance Date
Check-In Timestamp
Created Timestamp
```

The system should prevent duplicate check-ins.

---

# 15. Check-Out

The system records:

```text
Check-Out Timestamp
```

Working duration is calculated as:

```text
Check-Out Time
-
Check-In Time
```

---

# 16. Attendance Status

Basic statuses:

```text
PRESENT
ABSENT
INCOMPLETE
CORRECTED
```

### Present

```text
Check-In exists
Check-Out exists
```

### Incomplete

```text
Check-In exists
Check-Out missing
```

### Absent

Attendance is missing for an expected working day.

---

# 17. Attendance Views

Employees may view only their own attendance:

```text
Date
Check-In
Check-Out
Working Hours
Status
```

The Owner may view company-wide attendance with:

- Employee search.
- Date filtering.
- Department filtering.
- Attendance status filtering.
- Individual employee history.

---

# 18. Attendance Correction Requests

Workflow:

```text
EMPLOYEE
    ↓
REQUEST CORRECTION
    ↓
OWNER REVIEW
    ↓
APPROVED / REJECTED
```

Correction request fields:

```text
Attendance Date
Requested Check-In
Requested Check-Out
Reason
```

Statuses:

```text
PENDING
APPROVED
REJECTED
```

Only the Owner can approve or reject corrections.

All corrections must be auditable.

---

# 19. Bills and Expense Management

The module should reduce risks such as:

- Fake invoices.
- Duplicate bills.
- Incorrect amounts.
- Unnecessary expenses.
- Missing receipts.
- Unauthorized payments.
- Untraceable transactions.

---

# 20. Expense Submission

A bill should include:

```text
Bill ID
Submitter
Expense Date
Amount
Category
Description
Vendor
Invoice / Receipt
Submission Date
Current Status
```

The system should allow:

```text
Save Draft
Submit Expense
```

---

# 21. Expense Categories

Example categories:

```text
Travel
Fuel
Office Supplies
Equipment
Meals
Maintenance
Utilities
Miscellaneous
```

The Owner may manage categories.

---

# 22. Receipt and Invoice Upload

Supported documents may include:

```text
PDF
JPG
JPEG
PNG
```

Files may include:

```text
Invoice
Receipt
Supporting Document
```

Files must be stored securely and must not be publicly accessible by default.

---

# 23. Billing Workflow

```text
EMPLOYEE
    │
    │ Submit Expense
    ▼
SUBMITTED
    │
    ▼
ACCOUNTS REVIEW
    │
    ├───────────────► RETURNED
    │                     │
    │                     ▼
    │                 EMPLOYEE
    │                     │
    │                     │ Correct Information
    │                     ▼
    │                 RESUBMITTED
    │
    ├───────────────► REJECTED
    │
    ▼
VERIFIED
    │
    ▼
OWNER REVIEW
    │
    ├───────────────► REJECTED
    │
    ▼
APPROVED
    │
    ▼
PAYMENT_PENDING
    │
    ▼
ACCOUNTS
    │
    │ Execute / Record Payment
    ▼
PAID
```

---

# 24. Bill Statuses

```text
DRAFT
SUBMITTED
UNDER_REVIEW
RETURNED
RESUBMITTED
VERIFIED
APPROVED
PAYMENT_PENDING
PAID
REJECTED
```

---

# 25. Accounts Review

Accounts should verify:

- Required information exists.
- Receipt or invoice exists when required.
- Amount appears reasonable.
- Expense category is correct.
- Expense appears legitimate.
- Duplicate transactions are not present.
- Vendor information is reasonable.

Accounts may:

```text
VERIFY
RETURN
REJECT
```

Accounts cannot provide final Owner approval.

---

# 26. Owner Approval

After Accounts verifies an expense:

```text
VERIFIED
```

The Owner may:

```text
APPROVE
REJECT
```

Owner approval is the final financial authorization.

---

# 27. Payment Recording

Only Accounts can record payments.

Payment can only occur after:

```text
APPROVED
```

Accounts may record:

```text
Payment Date
Payment Method
Payment Reference
Transaction Reference
Paid Amount
Payment Notes
```

The bill transitions:

```text
PAYMENT_PENDING
        ↓
PAID
```

---

# 28. Employee Bill View

Employees can only view their own expenses.

They should see:

```text
Bill ID
Amount
Category
Submission Date
Current Status
Rejection Reason
Payment Status
```

Employees cannot:

- View other employees' expenses.
- Approve expenses.
- Verify expenses.
- Record payments.

---

# 29. Duplicate Expense Detection

Basic duplicate detection may compare:

```text
Employee
Amount
Vendor
Expense Date
```

Example:

```text
Same Employee
+
Same Amount
+
Same Vendor
+
Similar Date
```

A duplicate flag does **not** automatically reject a bill.

It assists Accounts during review.

---

# 30. Suspicious Expense Detection

V1 should prioritize:

- Duplicate detection.
- Missing documentation detection.
- Manual review.

Advanced fraud detection is future scope.

---

# 31. Payment History

The Owner and Accounts may view:

```text
Bill
Employee
Amount
Payment Date
Payment Method
Transaction Reference
Payment Status
```

Employees may only view payment information related to their own expenses.

---

# 32. Audit Logging

Critical actions must be recorded.

Examples:

```text
Employee Created
Employee Updated
Employee Deactivated

Attendance Checked In
Attendance Checked Out
Attendance Correction Requested
Attendance Correction Approved
Attendance Correction Rejected

Bill Created
Bill Submitted
Bill Returned
Bill Resubmitted
Bill Verified
Bill Approved
Bill Rejected
Payment Recorded
```

An audit record should contain:

```text
Audit ID
Actor
Actor Role
Action
Entity Type
Entity ID
Timestamp
Previous Data
New Data
```

---

# 33. Security Requirements

## Authentication

Authentication will use:

```text
Supabase Auth
```

Users must not control their own roles from the frontend.

## Authorization

Authorization must be enforced through:

```text
Frontend
        +
Application Logic
        +
Database Security
```

Frontend restrictions alone are insufficient.

---

# 34. Role-Based Access Control

Roles:

```text
OWNER
ACCOUNTS
EMPLOYEE
```

Role information must be securely associated with authenticated users.

Supabase database policies remain the final security boundary.

---

# 35. Row Level Security

Supabase Row Level Security should be used.

### Employee

Can access:

```text
Own Profile
Own Attendance
Own Attendance Corrections
Own Expenses
Own Uploaded Documents
```

Cannot access:

```text
Other Employee Records
Other Employee Attendance
Other Employee Expenses
Company-Wide Financial Data
```

### Accounts

Can access:

```text
Expense Records
Financial Records
Required Employee Directory Information
Own Attendance
```

Cannot:

```text
Provide Final Owner Approval
Access Restricted Private Employee Information
Modify Unauthorized Employee Data
```

### Owner

Can access:

```text
Company Employees
Company Attendance
Expense Records
Financial Records
Audit Logs
```

---

# 36. File Storage

Supabase Storage may be used for:

```text
Invoices
Receipts
Expense Supporting Documents
```

Files must be private by default.

Access must be controlled through authorization.

The system should:

- Validate file types.
- Restrict unsupported formats.
- Associate files with records.
- Restrict unauthorized access.

Recommended formats:

```text
PDF
JPG
JPEG
PNG
```

---

# 37. Technical Architecture

```text
USER
 │
 ▼
React Application
 │
 ▼
React Router
 │
 ▼
Supabase Client
 │
 ├───────────────┐
 ▼               ▼
Supabase Auth    PostgreSQL
 │               │
 │               ▼
 │            Row Level Security
 │
 ▼
Authentication
```

File uploads:

```text
React Application
        │
        ▼
Supabase Storage
        │
        ▼
Private Documents
```

---

# 38. Technology Stack

## Frontend

```text
React
Vite
JavaScript
JSX
React Router
Tailwind CSS
```

## UI

```text
Radix UI / shadcn-derived components
Lucide React
```

## Charts

```text
Recharts
```

## Backend Platform

```text
Supabase
```

Supabase provides:

```text
PostgreSQL
Authentication
Storage
Row Level Security
```

## Deployment

```text
Frontend → Vercel
Database → Supabase
Authentication → Supabase Auth
File Storage → Supabase Storage
```

AWS is not required for V1.

---

# 39. Environment Variables

Example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
Database Password
Private API Keys
```

---

# 40. Database Design Principles

The database must be relational.

Core entities:

```text
Profiles
Employees
Departments
Designations

Attendance Records
Attendance Corrections

Expense Categories
Expenses
Expense Documents
Payments

Audit Logs
```

The schema must be designed carefully before implementation.

---

# 41. Proposed Core Relationships

```text
AUTH USERS
     │
     ▼
PROFILES
     │
     ▼
EMPLOYEES
```

Attendance:

```text
EMPLOYEE
    │
    ▼
ATTENDANCE RECORDS
```

Expenses:

```text
EMPLOYEE
    │
    ▼
EXPENSE
    │
    ├──────────► EXPENSE DOCUMENTS
    ├──────────► PAYMENT
    └──────────► AUDIT HISTORY
```

---

# 42. Frontend Architecture

Recommended structure:

```text
src/
├── components/
│   ├── layout/
│   ├── shared/
│   └── ui/
├── pages/
├── data/
├── services/
├── hooks/
├── lib/
│   └── supabase.js
├── App.jsx
└── main.jsx
```

---

# 43. Data Access Architecture

Recommended flow:

```text
PAGE
 │
 ▼
SERVICE
 │
 ▼
SUPABASE CLIENT
 │
 ▼
DATABASE
```

Possible services:

```text
employeeService.js
attendanceService.js
expenseService.js
```

---

# 44. Mobile Responsiveness

The application must support:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Mobile users must be able to:

- Check in.
- Check out.
- View attendance.
- View profile.
- Submit expenses.
- Upload receipts.
- View expense status.

---

# 45. Notifications

Basic notifications may include:

```text
Attendance Correction Approved
Attendance Correction Rejected

Expense Returned
Expense Verified
Expense Approved
Expense Rejected
Payment Recorded
```

Advanced real-time notifications are not required for the initial prototype.

---

# 46. Search and Filtering

## Employees

```text
Name
Employee ID
Department
Designation
Status
```

## Attendance

```text
Employee
Date
Department
Status
```

## Expenses

```text
Employee
Status
Category
Date Range
Amount Range
```

---

# 47. Reporting

V1 reporting should remain basic.

## Employee Reports

```text
Total Employees
Active Employees
Employees by Department
```

## Attendance Reports

```text
Present Employees
Incomplete Attendance
Attendance by Date
Individual Attendance History
```

## Expense Reports

```text
Total Expenses
Expenses by Category
Pending Expenses
Approved Expenses
Paid Expenses
Rejected Expenses
```

---

# 48. Development Principles

The project must prioritize:

```text
Correctness
Security
Maintainability
Auditability
Simplicity
```

Avoid:

```text
Unnecessary Microservices
Unnecessary AI Agents
Unnecessary Vector Databases
Unnecessary AWS Infrastructure
Unnecessary Backend Servers
```

Supabase should provide most backend infrastructure for V1.

---

# 49. Development Phases

## Phase 1 — Frontend Foundation

Status:

```text
COMPLETED / IN PROGRESS
```

Includes:

- React application.
- Vite.
- JSX conversion.
- Routing.
- Shared layout.
- Dashboard.
- Employee page.
- Attendance page.
- Bills page.
- Mock data.

## Phase 2 — Supabase Foundation

- Create Supabase project.
- Connect React application.
- Configure environment variables.
- Configure Supabase client.
- Verify secure connection.

## Phase 3 — Database Schema

Design and implement:

```text
Profiles
Employees
Departments
Designations

Attendance Records
Attendance Corrections

Expense Categories
Expenses
Expense Documents
Payments

Audit Logs
```

## Phase 4 — Authentication

Implement:

```text
Login
Logout
Session Management
Authenticated Routes
```

Roles:

```text
OWNER
ACCOUNTS
EMPLOYEE
```

## Phase 5 — Authorization

Implement:

- Role-based navigation.
- Role-based pages.
- Role-based actions.
- Supabase Row Level Security.
- Database access restrictions.

## Phase 6 — Employee Management

Implement:

```text
Employee Directory
Employee Creation
Employee Profile
Employee Editing
Departments
Designations
Employment Status
Employee Deactivation
```

## Phase 7 — Attendance

Implement:

```text
Check In
Check Out
Server Timestamps
Attendance History
Working Hours
Attendance Corrections
Owner Review
```

## Phase 8 — Bills and Expenses

Implement:

```text
Expense Creation
Drafts
Submission
Receipt Upload
Accounts Review
Verification
Return for Correction
Resubmission
Owner Approval
Rejection
Payment Recording
Payment History
Duplicate Detection
Audit Logging
```

## Phase 9 — Prototype Review

Demonstrate the completed V1 prototype to the company and collect feedback regarding:

```text
Employee Information Requirements
Attendance Workflow
Attendance Rules
Expense Categories
Financial Approval Workflow
Accounts Permissions
Reports
Required Future Features
```

## Phase 10 — Refinement

- Fix usability issues.
- Improve workflows.
- Improve permissions.
- Add missing required fields.
- Improve reports.
- Improve mobile experience.
- Fix security issues.

---

# 50. Future Scope — V2

V2 may include:

```text
Task Management
Leave Management
Advanced Attendance
Facial Recognition
GPS Attendance
Geofencing
Advanced Notifications
Advanced Reports
Payroll Integration
Advanced Fraud Detection
```

---

# 51. Task Management — Future Specification

Future Task Management may include:

```text
Task Creation
Task Assignment
Task Deadlines
Task Priorities
Task Status
Progress Updates
Proof Upload
Review
Return for Correction
Completion
```

Possible workflow:

```text
CREATED
    ↓
ASSIGNED
    ↓
IN_PROGRESS
    ↓
SUBMITTED_FOR_REVIEW
    ↓
APPROVED
```

or:

```text
RETURNED
    ↓
IN_PROGRESS
```

Task Management is explicitly not part of V1.

---

# 52. Acceptance Criteria

V1 is functionally complete when:

## Employee Management

- Owner can create employees.
- Owner can view employees.
- Owner can edit employees.
- Owner can manage departments.
- Owner can manage designations.
- Employees can view their own profile.
- Employees cannot access unauthorized employee information.

## Attendance

- Employees can check in.
- Employees can check out.
- Timestamps are reliably recorded.
- Working duration is calculated.
- Employees can view attendance history.
- Employees can request corrections.
- Owner can approve corrections.
- Owner can reject corrections.
- Employees cannot view other employees' attendance.

## Bills

- Employees can create drafts.
- Employees can submit expenses.
- Employees can upload receipts.
- Accounts can review expenses.
- Accounts can return expenses.
- Employees can correct expenses.
- Employees can resubmit expenses.
- Accounts can verify expenses.
- Owner can approve expenses.
- Owner can reject expenses.
- Accounts can record payments.
- Employees can view their own expense status.
- Employees cannot access other employees' expenses.

## Security

- Authentication is implemented.
- Roles are implemented.
- Unauthorized access is blocked.
- Supabase Row Level Security is enabled.
- Sensitive documents are private.
- Service role keys are never exposed.
- Audit logs exist for critical operations.

---

# 53. Final V1 System Structure

```text
EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
│
├── AUTHENTICATION
│   ├── Owner
│   ├── Accounts
│   └── Employee
│
├── EMPLOYEE MANAGEMENT
│   ├── Employee Directory
│   ├── Employee Profiles
│   ├── Departments
│   ├── Designations
│   └── Employment Status
│
├── ATTENDANCE
│   ├── Check In
│   ├── Check Out
│   ├── Server Timestamps
│   ├── Working Hours
│   ├── Attendance History
│   └── Attendance Corrections
│
├── BILLS & EXPENSES
│   ├── Draft
│   ├── Submission
│   ├── Receipt Upload
│   ├── Accounts Review
│   ├── Return
│   ├── Verification
│   ├── Owner Approval
│   ├── Payment
│   └── History
│
├── SECURITY
│   ├── Authentication
│   ├── Authorization
│   ├── Row Level Security
│   └── Private Storage
│
└── AUDIT LOGGING
```

---

# 54. Final Guiding Principle

This project is not intended to become an unnecessarily complex enterprise platform during V1.

The objective is:

> **Build a reliable, secure, usable prototype that solves the company's immediate employee, attendance, and expense management problems.**

The system should establish:

```text
Correct workflows
        ↓
Secure access
        ↓
Reliable records
        ↓
Auditability
        ↓
Client feedback
        ↓
Future expansion
```

---

# V1 Summary

```text
EMPLOYEE MANAGEMENT     YES
ATTENDANCE MANAGEMENT   YES
BILLS & EXPENSES        YES

TASK MANAGEMENT         V2
FACIAL RECOGNITION      Future
GPS ATTENDANCE          Future
PAYROLL                 Future
```
