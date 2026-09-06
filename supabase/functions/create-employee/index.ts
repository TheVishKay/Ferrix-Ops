import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify User
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify OWNER role
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "OWNER") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only OWNER can provision employees" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const {
      email,
      password,
      first_name,
      last_name,
      employee_code,
      department_id,
      designation_id,
      joining_date,
      employment_status,
      date_of_birth,
      personal_phone,
      personal_email,
      address,
      emergency_contact,
    } = body;

    // Explicit Validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (
      !first_name ||
      !last_name ||
      !employee_code ||
      !department_id ||
      !designation_id ||
      !joining_date
    ) {
      return new Response(JSON.stringify({ error: "Missing required core employee fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!date_of_birth || !personal_phone || !personal_email || !address || !emergency_contact) {
      return new Response(
        JSON.stringify({ error: "Missing required personal information fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fullName = `${first_name} ${last_name}`.trim();

    // 3. Create Auth User (triggers profiles creation)
    const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createAuthError) {
      throw createAuthError;
    }

    const newUserId = newAuthData.user.id;
    let employeeId = null;

    try {
      // 4. Create Employee record
      const { data: newEmployee, error: empError } = await adminClient
        .from("employees")
        .insert({
          user_id: newUserId,
          employee_code,
          first_name,
          last_name,
          company_email: email,
          department_id,
          designation_id,
          joining_date,
          employment_status: employment_status || "ACTIVE",
        })
        .select("id")
        .single();

      if (empError) throw empError;
      employeeId = newEmployee.id;

      // 5. Create Employee Personal Info
      const { error: piError } = await adminClient.from("employee_personal_info").insert({
        employee_id: employeeId,
        date_of_birth,
        personal_phone,
        personal_email,
        address,
        emergency_contact,
      });

      if (piError) throw piError;

      // Log Audit Event
      await adminClient.from("audit_logs").insert({
        actor_id: user.id,
        actor_role: profile.role,
        action: "EMPLOYEE_PROVISIONED",
        entity_type: "employee",
        entity_id: employeeId,
        new_data: { employee_code, employment_status: employment_status || "ACTIVE" },
      });

      return new Response(JSON.stringify({ success: true, employee_id: employeeId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerError) {
      // 6. Compensating Rollback
      console.error("Provisioning failed after Auth creation, rolling back:", innerError);

      let rollbackFailed = false;

      // Ensure cleanup handles dependent records before parent records.
      // Order: employee_personal_info -> employees -> Auth user.
      if (employeeId) {
        const { error: delPiError } = await adminClient
          .from("employee_personal_info")
          .delete()
          .eq("employee_id", employeeId);
        if (delPiError) {
          console.error("Rollback failed for employee_personal_info:", delPiError);
          rollbackFailed = true;
        }

        const { error: delEmpError } = await adminClient
          .from("employees")
          .delete()
          .eq("id", employeeId);
        if (delEmpError) {
          console.error("Rollback failed for employees:", delEmpError);
          rollbackFailed = true;
        }
      }

      const { error: delAuthError } = await adminClient.auth.admin.deleteUser(newUserId);
      if (delAuthError) {
        console.error("Rollback failed for Auth User:", delAuthError);
        rollbackFailed = true;
      }

      if (rollbackFailed) {
        console.error("CRITICAL: Compensating rollback failed for Auth User:", newUserId);
      }

      return new Response(
        JSON.stringify({ error: "Provisioning failed during record creation." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Create Employee Edge Function Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
