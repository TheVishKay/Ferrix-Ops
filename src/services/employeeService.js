import { supabase } from "@/lib/supabase";

export const employeeService = {
  // Edge Function: create-employee
  async createEmployee(employeeData) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (!token) throw new Error("No active session");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(employeeData),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to provision employee");
    }

    return result;
  },

  // Edge Function: update-employee-status
  async updateEmployeeStatus(employeeId, newStatus) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (!token) throw new Error("No active session");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-employee-status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employee_id: employeeId, new_status: newStatus }),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to update employment status");
    }

    return result;
  },

  // RPC: update_employee_role
  async updateEmployeeRole(userId, newRole) {
    const { error } = await supabase.rpc("update_employee_role", {
      p_user_id: userId,
      p_new_role: newRole,
    });

    if (error) throw error;
  },

  // Core update via RLS
  async updateEmployeeCore(employeeId, data) {
    const { error } = await supabase.from("employees").update(data).eq("id", employeeId);

    if (error) throw error;
  },

  // Personal info update via RLS
  async updatePersonalInfo(employeeId, data) {
    const { error } = await supabase
      .from("employee_personal_info")
      .update(data)
      .eq("employee_id", employeeId);

    if (error) throw error;
  },

  async getEmployeePersonalInfo(employeeId) {
    const { data, error } = await supabase
      .from("employee_personal_info")
      .select("*")
      .eq("employee_id", employeeId)
      .single();

    if (error) throw error;
    return data;
  },

  // Department Management
  async getDepartments() {
    const { data, error } = await supabase.from("departments").select("*").order("name");
    if (error) throw error;
    return data;
  },

  async createDepartment(data) {
    const { error } = await supabase.from("departments").insert(data);
    if (error) throw error;
  },

  async updateDepartment(id, data) {
    const { error } = await supabase.from("departments").update(data).eq("id", id);
    if (error) throw error;
  },

  // Designation Management
  async getDesignations() {
    const { data, error } = await supabase.from("designations").select("*").order("name");
    if (error) throw error;
    return data;
  },

  async createDesignation(data) {
    const { error } = await supabase.from("designations").insert(data);
    if (error) throw error;
  },

  async updateDesignation(id, data) {
    const { error } = await supabase.from("designations").update(data).eq("id", id);
    if (error) throw error;
  },

  async getEmployeeById(employeeId) {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        *,
        profiles ( role, avatar_url, email ),
        departments ( id, name ),
        designations ( id, name )
      `,
      )
      .eq("id", employeeId)
      .single();

    if (error) throw error;
    return data;
  },
};

// Added for task fetching
export async function getEmployees() {
  const { data, error } = await supabase.from("employees").select("*");
  if (error) {
    console.error("Error fetching employees:", error);
    return { error };
  }
  return { data, error: null };
}
