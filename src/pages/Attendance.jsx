import { useMemo, useState, useEffect } from "react";
import { CalendarDays, Clock3, Search, Loader2, Play, Square, AlertCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const toneClass = (t) => `hr-tone-${t}`;
const statusToneMap = {
  PRESENT: "lime",
  HALF_DAY: "amber",
  ABSENT: "coral",
  LEAVE: "violet",
  INCOMPLETE: "amber",
};

const displayStatus = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  LEAVE: "On Leave",
  INCOMPLETE: "Incomplete",
};

const getTone = (str) => {
  const tones = ["cyan", "coral", "amber", "violet", "lime"];
  if (!str) return "cyan";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tones[Math.abs(hash) % tones.length];
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});

export default function Attendance() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employeeRecord, setEmployeeRecord] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      const [deptRes, attRes] = await Promise.all([
        supabase.from("departments").select("name").order("name"),
        supabase
          .from("attendance_records")
          .select(
            `
          id,
          attendance_date,
          check_in_at,
          check_out_at,
          status,
          employees (
            id,
            employee_code,
            first_name,
            last_name,
            departments ( name )
          )
        `,
          )
          .order("attendance_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (deptRes.error) throw new Error("Failed to load departments");
      if (attRes.error) throw new Error("Failed to load attendance records");

      setDepartments(deptRes.data.map((d) => d.name));
      setAttendanceRecords(attRes.data);

      if (user) {
        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select("id, employment_status")
          .eq("user_id", user.id)
          .single();

        if (!empError && empData && empData.employment_status === "ACTIVE") {
          setEmployeeRecord(empData);
        } else {
          setEmployeeRecord(null);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mappedRecords = useMemo(() => {
    return attendanceRecords.map((r) => {
      const emp = r.employees;
      const name = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
      const initials = emp
        ? `${emp.first_name[0] || ""}${emp.last_name[0] || ""}`.toUpperCase()
        : "?";
      const department = emp?.departments?.name || "Unknown";
      const employeeId = emp?.employee_code || "Unknown";

      let hoursStr = "—";
      if (r.check_in_at && r.check_out_at) {
        const diffMs = new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        hoursStr = `${h}h ${m.toString().padStart(2, "0")}m`;
      }

      return {
        ...r,
        name,
        initials,
        department,
        employeeId,
        checkIn: r.check_in_at ? timeFormatter.format(new Date(r.check_in_at)) : "—",
        checkOut: r.check_out_at ? timeFormatter.format(new Date(r.check_out_at)) : "—",
        hours: hoursStr,
        tone: getTone(employeeId),
      };
    });
  }, [attendanceRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mappedRecords.filter((r) => {
      const matchSearch = !q || `${r.name} ${r.employeeId}`.toLowerCase().includes(q);
      const matchDept = dept === "all" || r.department === dept;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, dept, statusFilter, mappedRecords]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const todayRecord = useMemo(() => {
    if (!employeeRecord) return null;
    return mappedRecords.find(
      (r) => r.employees?.id === employeeRecord.id && r.attendance_date === todayStr,
    );
  }, [mappedRecords, employeeRecord, todayStr]);

  const canCheckIn = employeeRecord && !todayRecord;
  const canCheckOut = employeeRecord && todayRecord && todayRecord.status === "INCOMPLETE";

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc("check_in");
      if (rpcError) throw rpcError;
      await fetchAttendance();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to check in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc("check_out");
      if (rpcError) throw rpcError;
      await fetchAttendance();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to check out.");
    } finally {
      setSubmitting(false);
    }
  };

  const todayRecords = attendanceRecords.filter((r) => r.attendance_date === todayStr);
  const totalToday = todayRecords.length;
  const presentCount = todayRecords.filter((r) => r.status === "PRESENT").length;
  const incompleteCount = todayRecords.filter((r) => r.status === "INCOMPLETE").length;
  const absentLeaveCount = todayRecords.filter(
    (r) => r.status === "ABSENT" || r.status === "LEAVE",
  ).length;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <p>{error}</p>
        </div>
      )}

      {/* Action Card for Check-in / Check-out */}
      {(canCheckIn || canCheckOut) && (
        <section className="hr-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Attendance Actions
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {canCheckIn ? "You haven't checked in today." : "You are currently checked in."}
              </p>
            </div>
            <div>
              {canCheckIn && (
                <Button
                  onClick={handleCheckIn}
                  disabled={submitting || loading}
                  className="gap-2 bg-[var(--hr-lime)] text-lime-950 hover:bg-[var(--hr-lime)]/90"
                >
                  <Play className="size-4" /> Check In
                </Button>
              )}
              {canCheckOut && (
                <Button
                  onClick={handleCheckOut}
                  disabled={submitting || loading}
                  className="gap-2 bg-[var(--hr-amber)] text-amber-950 hover:bg-[var(--hr-amber)]/90"
                >
                  <Square className="size-4" /> Check Out
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Summary cards */}
      <section
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        aria-label="Today's attendance summary"
      >
        {[
          { label: "Total Today", value: totalToday, tone: "cyan" },
          { label: "Present", value: presentCount, tone: "lime" },
          { label: "Incomplete", value: incompleteCount, tone: "amber" },
          { label: "Absent / Leave", value: absentLeaveCount, tone: "coral" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p className="font-display text-[32px] font-black leading-none tracking-tight text-foreground">
              {loading ? "-" : s.value}
            </p>
            <p className={`mt-2 text-sm font-medium hr-tone-${s.tone}`}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Attendance table */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-coral">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Attendance Log
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search attendance"
                placeholder="Search…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                disabled={loading}
              />
            </label>
            <Select value={dept} onValueChange={setDept} disabled={loading}>
              <SelectTrigger className="h-9 w-[155px] text-xs">
                <SelectValue placeholder="Department: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Department: All</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
              <SelectTrigger className="h-9 w-[135px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="LEAVE">On Leave</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={loading}>
              <CalendarDays className="size-3.5" /> Filter Date
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading attendance data...
              </p>
            </div>
          ) : (
            <>
              <table className="hr-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>ID</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 rounded-xl">
                            <AvatarFallback className={`hr-avatar ${toneClass(row.tone)}`}>
                              {row.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{row.name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{row.employeeId}</td>
                      <td>{row.department}</td>
                      <td className="text-xs">{row.attendance_date}</td>
                      <td className="text-xs">{row.checkIn}</td>
                      <td className="text-xs">{row.checkOut}</td>
                      <td className="text-xs font-medium">{row.hours}</td>
                      <td>
                        <Badge
                          className={`hr-status-badge hr-tone-${statusToneMap[row.status] ?? "cyan"}`}
                        >
                          <span className="hr-mini-dot" /> {displayStatus[row.status] || row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState
                  icon={Clock3}
                  title="No records found"
                  subtitle="No attendance records available for the current filters."
                />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
