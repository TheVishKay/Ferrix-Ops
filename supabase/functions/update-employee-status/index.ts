import { createClient } from "@supabase/supabase-js";

const getCorsHeaders = (req: Request) => {
  const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsStr
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.get("Origin");

  let allowedOrigin = "";
  if (allowedOrigins.includes("*")) {
    allowedOrigin = "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  } else if (allowedOrigins.length > 0) {
    allowedOrigin = allowedOrigins[0]; // Fallback to the first allowed origin
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 2. Verify OWNER role
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "OWNER") {
      return new Response(JSON.stringify({ error: "Forbidden: Only OWNER can update status" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { employee_id, new_status } = await req.json();

    if (!employee_id || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Ensure valid status
    if (!["ACTIVE", "INACTIVE", "EXITED"].includes(new_status)) {
      return new Response(JSON.stringify({ error: "Invalid employment status" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 3. Resolve target Auth User ID
    const { data: targetEmployee, error: targetError } = await adminClient
      .from("employees")
      .select("user_id, employment_status")
      .eq("id", employee_id)
      .single();

    if (targetError || !targetEmployee) {
      return new Response(JSON.stringify({ error: "Target employee not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const targetUserId = targetEmployee.user_id;

    // 4. Update Auth state if necessary
    if (new_status === "EXITED") {
      // Suspend/ban Auth access (876000 hours = 100 years)
      const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h",
      });
      if (banError) throw banError;
    } else if (targetEmployee.employment_status === "EXITED" && new_status !== "EXITED") {
      // Lift the ban if transitioning away from EXITED
      const { error: liftBanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (liftBanError) throw liftBanError;
    }

    // 5. Update Employee status in Database
    // NOTE: Auth state (banned) and Database state (employment_status) are managed across two disparate systems.
    // This function does NOT execute atomically. If the DB update fails after the Auth state is modified,
    // the system attempts a compensating rollback, but this rollback could theoretically fail, leaving the states out of sync.
    const { error: dbUpdateError } = await adminClient
      .from("employees")
      .update({ employment_status: new_status })
      .eq("id", employee_id);

    if (dbUpdateError) {
      // Rollback Auth ban state if DB update fails to keep them in sync
      console.error("Failed to update DB, rolling back Auth ban state");
      if (new_status === "EXITED") {
        await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
      } else if (targetEmployee.employment_status === "EXITED") {
        await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
      }
      throw dbUpdateError;
    }

    // Log Audit Event
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: profile.role,
      action: "EMPLOYMENT_STATUS_UPDATED",
      entity_type: "employee",
      entity_id: employee_id,
      previous_data: { employment_status: targetEmployee.employment_status },
      new_data: { employment_status: new_status },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Update Employee Status Edge Function Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
