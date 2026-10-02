import { supabase } from "@/lib/supabase";

/**
 * Fetch tasks with joined employee details, ordered by position.
 */
export async function getTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      employee:assigned_to_id (
        id,
        first_name,
        last_name,
        designation:designation_id (
          name
        )
      )
    `,
    )
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return { error };
  }

  // Format data for the frontend
  const formattedTasks = data.map((task) => {
    const fullName = task.employee
      ? `${task.employee.first_name} ${task.employee.last_name}`
      : "Unassigned";
    const initials = task.employee
      ? `${task.employee.first_name[0]}${task.employee.last_name[0]}`
      : "?";
    const designationName = task.employee?.designation?.name || "No Designation";

    return {
      ...task,
      assignedToId: task.assigned_to_id,
      dueDate: task.due_date,
      assignedTo: fullName,
      assignedToInitials: initials,
      assignedToTone: "cyan", // Defaulting tone, can add logic if necessary
      designationName,
      tags: [], // Tags weren't in schema, can add them later or just provide empty array
    };
  });

  return { data: formattedTasks, error: null };
}

/**
 * Create a new task (OWNER only).
 * Invokes public.create_task RPC which calculates position server-side and logs TASK_CREATED audit event.
 */
export async function createTask(taskData) {
  const { data, error } = await supabase.rpc("create_task", {
    p_title: taskData.title,
    p_description: taskData.description || null,
    p_assigned_to_id: taskData.assignedToId,
    p_priority: taskData.priority || "MEDIUM",
    p_status: taskData.status || "CREATED",
    p_due_date: taskData.dueDate || null,
  });

  if (error) {
    console.error("Error creating task:", error);
    return { data: null, error };
  }
  return { data, error: null };
}

/**
 * Update an existing task (OWNER only).
 * Invokes public.update_task RPC which validates updates and logs TASK_UPDATED audit event.
 */
export async function updateTask(taskId, taskData) {
  const { data, error } = await supabase.rpc("update_task", {
    p_task_id: taskId,
    p_title: taskData.title,
    p_description: taskData.description || null,
    p_assigned_to_id: taskData.assignedToId,
    p_priority: taskData.priority || "MEDIUM",
    p_status: taskData.status || "CREATED",
    p_due_date: taskData.dueDate || null,
  });

  if (error) {
    console.error("Error updating task:", error);
    return { data: null, error };
  }
  return { data, error: null };
}

/**
 * Delete a task (OWNER only).
 * Invokes public.delete_task RPC which removes the task and logs TASK_DELETED audit event.
 */
export async function deleteTask(taskId) {
  const { error } = await supabase.rpc("delete_task", {
    p_task_id: taskId,
  });

  if (error) {
    console.error("Error deleting task:", error);
    return { error };
  }
  return { error: null };
}

/**
 * Update task status.
 * Invokes public.update_task_status RPC which enforces employee transition rules
 * and logs TASK_STATUS_UPDATED audit event.
 */
export async function updateTaskStatus(taskId, newStatus) {
  const { data, error } = await supabase.rpc("update_task_status", {
    p_task_id: taskId,
    p_new_status: newStatus,
  });

  if (error) {
    console.error("Error updating task status:", error);
    return { data: null, error };
  }
  return { data, error: null };
}

/**
 * Update task order positions.
 * `tasks` is an array of objects: { id: string, position: number }
 */
export async function updateTaskOrder(tasks) {
  const { error } = await supabase.rpc("update_task_positions", {
    p_tasks: tasks,
  });

  if (error) {
    console.error("Error updating task order:", error);
  }
  return { error };
}
