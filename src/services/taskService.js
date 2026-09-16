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
 * Create a new task.
 */
export async function createTask(taskData) {
  // Get current max position to append to the end
  const { data: maxPositionData, error: maxError } = await supabase
    .from("tasks")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  if (maxError) {
    console.error("Error fetching max position:", maxError);
    return { error: maxError };
  }

  const maxPosition = maxPositionData?.[0]?.position ?? 0;
  const newPosition = maxPosition + 1000.0; // Spacing by 1000 for floating point

  const userRes = await supabase.auth.getUser();
  if (userRes.error) return { error: userRes.error };

  const insertData = {
    title: taskData.title,
    description: taskData.description,
    assigned_to_id: taskData.assignedToId,
    priority: taskData.priority,
    status: taskData.status,
    due_date: taskData.dueDate || null,
    position: newPosition,
    created_by: userRes.data.user.id,
  };

  const { data, error } = await supabase.from("tasks").insert([insertData]).select();
  if (error) {
    console.error("Error creating task:", error);
  }
  return { data, error };
}

/**
 * Update an existing task.
 */
export async function updateTask(taskId, taskData) {
  const updateData = {
    title: taskData.title,
    description: taskData.description,
    assigned_to_id: taskData.assignedToId,
    priority: taskData.priority,
    status: taskData.status,
    due_date: taskData.dueDate || null,
  };

  const { data, error } = await supabase.from("tasks").update(updateData).eq("id", taskId).select();

  if (error) {
    console.error("Error updating task:", error);
  }
  return { data, error };
}

/**
 * Delete a task.
 */
export async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    console.error("Error deleting task:", error);
  }
  return { error };
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
