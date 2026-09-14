import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, UserX, AlertCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";
import { employeeService } from "@/services/employeeService";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";

const toneClass = (t) => `hr-tone-${t}`;

const getTone = (str) => {
  const tones = ["cyan", "coral", "amber", "violet", "lime"];
  if (!str) return "cyan";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tones[Math.abs(hash) % tones.length];
};

const statusTone = { ACTIVE: "lime", INACTIVE: "coral", EXITED: "amber" };
const displayStatus = { ACTIVE: "Active", INACTIVE: "Inactive", EXITED: "Exited" };

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[200px_1fr] sm:gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});

function EmployeeAttendanceTab({ employeeId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("this_month");

  useEffect(() => {
    let mounted = true;
    async function fetchAttendance() {
      try {
        setLoading(true);
        setError(null);
        let query = supabase
          .from("attendance_records")
          .select("*")
          .eq("employee_id", employeeId)
          .order("attendance_date", { ascending: false });

        const now = new Date();
        if (filter === "this_month") {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          query = query.gte("attendance_date", firstDay.toISOString().split("T")[0]);
        } else if (filter === "last_30") {
          const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          query = query.gte("attendance_date", last30.toISOString().split("T")[0]);
        }

        const { data, error: qError } = await query;
        if (qError) throw qError;
        if (mounted) setRecords(data);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Failed to load attendance history.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAttendance();
    return () => {
      mounted = false;
    };
  }, [employeeId, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Attendance History</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_30">Last 30 Days</SelectItem>
            <SelectItem value="all_time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="size-8 text-destructive mb-2 opacity-80" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No attendance records"
          description="No attendance history found for the selected period."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium border-b border-border">Date</th>
                  <th className="px-4 py-3 font-medium border-b border-border">Status</th>
                  <th className="px-4 py-3 font-medium border-b border-border">In</th>
                  <th className="px-4 py-3 font-medium border-b border-border">Out</th>
                  <th className="px-4 py-3 font-medium border-b border-border">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => {
                  let hoursStr = "—";
                  if (r.check_in_at && r.check_out_at) {
                    const diffMs =
                      new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const h = Math.floor(diffMins / 60);
                    const m = diffMins % 60;
                    hoursStr = `${h}h ${m.toString().padStart(2, "0")}m`;
                  }
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {r.attendance_date || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={`hr-status-badge hr-tone-${statusTone[r.status] ?? "cyan"}`}
                        >
                          <span className="hr-mini-dot" />
                          {displayStatus[r.status] || r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {r.check_in_at ? timeFormatter.format(new Date(r.check_in_at)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {r.check_out_at ? timeFormatter.format(new Date(r.check_out_at)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap font-medium">
                        {hoursStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeProfile() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState("employment");

  useEffect(() => {
    let mounted = true;

    async function fetchEmployee() {
      try {
        setLoading(true);
        setError(null);

        const data = await employeeService.getEmployeeById(employeeId);

        if (!data) {
          if (mounted) setError("Employee not found");
          return;
        }

        // Verify authorization for EMPLOYEE role
        if (profile?.role === ROLES.EMPLOYEE && data.user_id !== profile.id) {
          if (mounted) setUnauthorized(true);
          return;
        }

        if (mounted) setEmployee(data);
      } catch (err) {
        if (err.code === "PGRST116") {
          // Supabase specific error for "Results contain 0 rows" on .single()
          if (mounted) setError("Employee not found");
        } else {
          console.error(err);
          if (mounted) setError(err.message || "Failed to load employee details.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (employeeId && profile) {
      fetchEmployee();
    }

    return () => {
      mounted = false;
    };
  }, [employeeId, profile]);

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-100px)] flex-col items-center justify-center space-y-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Loading profile...</p>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="flex h-[calc(100vh-100px)] flex-col items-center justify-center space-y-4 text-center px-4">
        <div className="hr-icon-box hr-tone-coral mb-2 size-12">
          <AlertCircle className="size-5" />
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
          Access Denied
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          You do not have permission to view this employee's profile.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
          Return to Dashboard
        </Button>
      </main>
    );
  }

  if (error || !employee) {
    return (
      <main className="flex h-[calc(100vh-100px)] flex-col items-center justify-center space-y-4 text-center px-4">
        <div className="hr-icon-box hr-tone-coral mb-2 size-12">
          <UserX className="size-5" />
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
          {error || "Employee not found"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The employee profile you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/employees")}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Directory
        </Button>
      </main>
    );
  }

  const name = `${employee.first_name} ${employee.last_name}`;
  const initials =
    `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase();
  const tone = getTone(employee.employee_code);
  const departmentName = employee.departments?.name;
  const designationName = employee.designations?.name;
  const avatarUrl = employee.profiles?.avatar_url;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => navigate(profile?.role === ROLES.EMPLOYEE ? "/" : "/employees")}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          {profile?.role === ROLES.EMPLOYEE ? "Back to Dashboard" : "Back to Directory"}
        </Button>
      </div>

      <section className="hr-card p-0 overflow-hidden">
        {/* Profile Header */}
        <div className="bg-muted/30 border-b border-border p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <Avatar className="size-24 rounded-2xl ring-4 ring-background shadow-sm bg-background">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className="object-cover" />}
              <AvatarFallback className={`text-2xl hr-avatar ${toneClass(tone)}`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">
                    {name}
                  </h1>
                  <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded text-foreground">
                      {employee.employee_code}
                    </span>
                    <span>•</span>
                    <span>{designationName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={`hr-status-badge hr-tone-${statusTone[employee.employment_status] ?? "cyan"}`}
                  >
                    <span className="hr-mini-dot" />
                    {displayStatus[employee.employment_status] || employee.employment_status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-border px-6 sm:px-8 bg-muted/10 flex gap-6">
          <button
            onClick={() => setActiveTab("employment")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "employment"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Employment
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "attendance"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Attendance
          </button>
        </div>

        {/* Profile Details */}
        <div className="p-6 sm:p-8">
          {activeTab === "employment" && (
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Employment Details</h2>
              <div className="bg-background rounded-lg border border-border px-4 py-1">
                <DetailRow label="Company Email" value={employee.company_email} />
                <DetailRow label="Phone Number" value={employee.phone_number} />
                <DetailRow label="Department" value={departmentName} />
                <DetailRow label="Designation" value={designationName} />
                <DetailRow label="Joining Date" value={employee.joining_date} />
                <DetailRow
                  label="Employment Type"
                  value={
                    employee.employment_type === "FULL_TIME"
                      ? "Full Time"
                      : employee.employment_type === "PART_TIME"
                        ? "Part Time"
                        : employee.employment_type === "CONTRACT"
                          ? "Contract"
                          : employee.employment_type === "INTERN"
                            ? "Intern"
                            : employee.employment_type
                  }
                />
                <DetailRow
                  label="Status"
                  value={displayStatus[employee.employment_status] || employee.employment_status}
                />
              </div>
            </div>
          )}

          {activeTab === "attendance" && <EmployeeAttendanceTab employeeId={employeeId} />}
        </div>
      </section>
    </main>
  );
}
