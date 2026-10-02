// =============================================================================
// EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
// Task Module Constants & Enums
// =============================================================================

export const TASK_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "RETURNED",
  "COMPLETED",
  "CANCELLED",
];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const TASK_STATUS_LABELS = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  READY_FOR_REVIEW: "For Review",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_TONE_MAP = {
  CREATED: "slate",
  ASSIGNED: "cyan",
  IN_PROGRESS: "amber",
  READY_FOR_REVIEW: "violet",
  RETURNED: "coral",
  COMPLETED: "lime",
  CANCELLED: "slate",
};

export const TASK_PRIORITY_TONE_MAP = {
  LOW: "slate",
  MEDIUM: "cyan",
  HIGH: "amber",
  URGENT: "coral",
};

/**
 * Permitted transitions for standard employees.
 * Employees cannot mark tasks as COMPLETED, CANCELLED, or CREATED.
 */
export const ALLOWED_EMPLOYEE_TRANSITIONS = {
  ASSIGNED: {
    nextStatus: "IN_PROGRESS",
    label: "Start Task",
  },
  IN_PROGRESS: {
    nextStatus: "READY_FOR_REVIEW",
    label: "Submit for Review",
  },
  RETURNED: {
    nextStatus: "IN_PROGRESS",
    label: "Resume Task",
  },
};

// Aliases for compatibility
export const taskStatuses = TASK_STATUSES;
export const taskPriorities = TASK_PRIORITIES;
export const statusLabel = TASK_STATUS_LABELS;
export const statusToneMap = TASK_STATUS_TONE_MAP;
export const priorityToneMap = TASK_PRIORITY_TONE_MAP;
