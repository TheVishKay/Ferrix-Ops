import { supabase } from "../lib/supabase";

export const fetchMyLeaveRequests = async () => {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      `
      id,
      start_date,
      end_date,
      reason,
      status,
      owner_remarks,
      created_at,
      reviewed_at
    `,
    )
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data;
};

export const fetchAllLeaveRequests = async () => {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      `
      id,
      start_date,
      end_date,
      reason,
      status,
      owner_remarks,
      created_at,
      reviewed_at,
      employee_id,
      employees (
        id,
        first_name,
        last_name,
        employee_code
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const submitLeaveRequest = async ({ startDate, endDate, reason }) => {
  const { data, error } = await supabase.rpc("submit_leave_request", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_reason: reason,
  });

  if (error) throw error;
  return data;
};

export const reviewLeaveRequest = async (leaveId, approve, remarks = null) => {
  const { data, error } = await supabase.rpc("review_leave_request", {
    p_leave_id: leaveId,
    p_approve: approve,
    p_remarks: remarks,
  });

  if (error) throw error;
  return data;
};

export const cancelPendingLeave = async (leaveId) => {
  const { data, error } = await supabase.rpc("cancel_pending_leave", {
    p_leave_id: leaveId,
  });

  if (error) throw error;
  return data;
};
