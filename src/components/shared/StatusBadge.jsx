import { Badge } from "@/components/ui/badge";

// Maps status strings to their tone colors
const statusToneMap = {
  // Attendance
  Present: "lime",
  Late: "amber",
  Absent: "coral",
  "On Leave": "violet",
  // Employee
  Active: "lime",
  Inactive: "coral",
  // Leave
  Pending: "amber",
  Approved: "lime",
  Rejected: "coral",
  // Tasks
  CREATED: "slate",
  ASSIGNED: "cyan",
  IN_PROGRESS: "amber",
  READY_FOR_REVIEW: "violet",
  RETURNED: "coral",
  COMPLETED: "lime",
  CANCELLED: "slate",
  // Expenses
  DRAFT: "slate",
  SUBMITTED: "cyan",
  UNDER_REVIEW: "amber",
  PAYMENT_PENDING: "violet",
  PAID: "lime",
};

const statusLabelMap = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  READY_FOR_REVIEW: "For Review",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  PAYMENT_PENDING: "Pmt. Pending",
  PAID: "Paid",
};

export default function StatusBadge({ status }) {
  const tone = statusToneMap[status] ?? "cyan";
  const label = statusLabelMap[status] ?? status;
  return (
    <Badge className={`hr-status-badge hr-tone-${tone}`}>
      <span className="hr-mini-dot" />
      {label}
    </Badge>
  );
}
