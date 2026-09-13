import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Clock3,
  Search,
  Loader2,
  Play,
  Square,
  AlertCircle,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

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
import { ROLES } from "@/constants/roles";
import { useToast } from "@/components/ui/use-toast";
import AttendanceCorrectionModal from "@/components/attendance/AttendanceCorrectionModal";

// =============================================================================
// Constants / pure helpers
// =============================================================================

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

const formatDT = (iso) => (iso ? timeFormatter.format(new Date(iso)) : "—");
const formatDate = (d) => d || "—";

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// =============================================================================
// CorrectionReviewCard — OWNER review queue card (local component)
// =============================================================================

function CorrectionReviewCard({ request, remarks, onRemarksChange, onApprove, onReject, loading }) {
  const emp = request.employees;
  // attendance_records is the embedded original attendance data.
  // PostgREST embeds it under "attendance_records" per the FK table name.
  // request.status is the CORRECTION request status (PENDING/APPROVED/REJECTED).
  // request.attendance_records.status is the ORIGINAL attendance status.
  const ar = request.attendance_records;

  const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
  const initials = emp
    ? `${emp.first_name?.[0] ?? ""}${emp.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";
  const tone = getTone(emp?.employee_code ?? "");

  return (
    <div className="hr-review-card">
      {/* Employee header */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar className="size-9 rounded-xl shrink-0">
          <AvatarFallback className={`hr-avatar ${toneClass(tone)}`}>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm leading-tight">{empName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {emp?.employee_code ?? "—"}
            {" · Submitted "}
            {new Date(request.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <Badge className="hr-status-badge hr-tone-amber shrink-0">
          <span className="hr-mini-dot" /> Pending
        </Badge>
      </div>

      {/* Original vs Requested comparison */}
      <div className="hr-review-compare">
        <div className="hr-review-compare-col">
          <p className="hr-review-compare-heading">Original</p>
          <div className="hr-review-compare-row">
            <span className="key">Date</span>
            <span>{formatDate(ar?.attendance_date)}</span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">Status</span>
            <span>{ar?.status ? (displayStatus[ar.status] ?? ar.status) : "—"}</span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">In</span>
            <span>{formatDT(ar?.check_in_at)}</span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">Out</span>
            <span>{formatDT(ar?.check_out_at)}</span>
          </div>
        </div>

        <div className="hr-review-compare-col hr-review-compare-col--requested">
          <p className="hr-review-compare-heading">Requested</p>
          <div className="hr-review-compare-row">
            <span className="key">Status</span>
            <span>
              {request.requested_status ? (
                (displayStatus[request.requested_status] ?? request.requested_status)
              ) : (
                <span className="text-muted-foreground italic text-xs">no change</span>
              )}
            </span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">In</span>
            <span>
              {request.requested_check_in ? (
                formatDT(request.requested_check_in)
              ) : (
                <span className="text-muted-foreground italic text-xs">no change</span>
              )}
            </span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">Out</span>
            <span>
              {request.requested_check_out ? (
                formatDT(request.requested_check_out)
              ) : (
                <span className="text-muted-foreground italic text-xs">no change</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Reason
        </p>
        <p className="text-sm text-foreground">{request.reason}</p>
      </div>

      {/* Review remarks + actions */}
      <div className="flex flex-col gap-3">
        <textarea
          className="hr-correction-textarea"
          placeholder="Review remarks (optional)…"
          rows={2}
          value={remarks}
          disabled={loading}
          onChange={(e) => onRemarksChange(e.target.value)}
          aria-label="Review remarks"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={loading}
            className="gap-1.5 bg-[var(--hr-lime)] text-lime-950 hover:bg-[var(--hr-lime)]/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={loading}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Attendance component
// =============================================================================

export default function Attendance() {
  const { user, profile } = useAuth();

  // ---------------------------------------------------------------------------
  // Phase 3A state (preserved exactly)
  // ---------------------------------------------------------------------------

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterDate, setFilterDate] = useState(getTodayStr());

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employeeRecord, setEmployeeRecord] = useState(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Phase 3B state
  // ---------------------------------------------------------------------------

  // Employee: PENDING correction map — attendance_record_id → { id, status }
  const [correctionMap, setCorrectionMap] = useState({});

  // OWNER: enriched pending queue
  const [ownerQueue, setOwnerQueue] = useState([]);

  // Correction modal
  const [correctionModalRecord, setCorrectionModalRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    requestedStatus: "",
    requestedCheckIn: "",
    requestedCheckOut: "",
    reason: "",
  });
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState(null);

  const { toast } = useToast();

  // OWNER review state
  const [reviewLoadingId, setReviewLoadingId] = useState(null);
  // Per-request remarks: { [requestId]: string }
  const [reviewRemarks, setReviewRemarks] = useState({});

  // ---------------------------------------------------------------------------
  // fetchAttendance — returns the fetched records array so callers can chain
  // into fetchCorrectionData without relying on potentially stale state.
  // ---------------------------------------------------------------------------

  const fetchAttendance = useCallback(
    async (isRefresh = false, activeDate = filterDate) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const currentToday = getTodayStr();
        const datesToFetch =
          activeDate === currentToday ? [activeDate] : [activeDate, currentToday];

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
            .in("attendance_date", datesToFetch)
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

        return attRes.data;
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load attendance data.");
        return [];
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [user, filterDate],
  );

  // ---------------------------------------------------------------------------
  // fetchCorrectionData — role-aware, kept separate from attendance fetching.
  //
  // OWNER    → query full pending queue with employee + attendance_record context
  // EMPLOYEE → query own PENDING correction map for the supplied records
  // ACCOUNTS → intentionally no query (no SELECT policy on correction_requests)
  // ---------------------------------------------------------------------------

  const fetchCorrectionData = useCallback(
    async (records) => {
      if (!user || !profile) return;

      try {
        if (profile.role === ROLES.OWNER) {
          // PostgREST embeds related rows using the FK target table name:
          //   employee_id  →  employees
          //   attendance_record_id  →  attendance_records
          // Both FKs are defined in migration 002.
          const { data, error: qErr } = await supabase
            .from("attendance_correction_requests")
            .select(
              `
              id,
              requested_status,
              requested_check_in,
              requested_check_out,
              reason,
              status,
              created_at,
              employees (
                id,
                first_name,
                last_name,
                employee_code
              ),
              attendance_records (
                id,
                attendance_date,
                status,
                check_in_at,
                check_out_at
              )
            `,
            )
            .eq("status", "PENDING")
            .order("created_at", { ascending: true });

          if (qErr) {
            console.error("Failed to load owner correction queue:", qErr);
            return;
          }
          setOwnerQueue(data ?? []);
        } else if (profile.role === ROLES.EMPLOYEE) {
          // Guard: no records → nothing to query.
          if (!records || records.length === 0) {
            setCorrectionMap({});
            return;
          }

          const recordIds = records.map((r) => r.id);

          const { data, error: qErr } = await supabase
            .from("attendance_correction_requests")
            .select("id, attendance_record_id, status, review_remarks, created_at")
            .in("attendance_record_id", recordIds)
            .order("created_at", { ascending: false });

          if (qErr) {
            console.error("Failed to load employee correction data:", qErr);
            return;
          }

          const map = {};
          (data ?? []).forEach((req) => {
            if (!map[req.attendance_record_id]) {
              map[req.attendance_record_id] = {
                id: req.id,
                status: req.status,
                review_remarks: req.review_remarks,
              };
            }
          });
          setCorrectionMap(map);
        }
        // ACCOUNTS: no correction request query.
      } catch (err) {
        console.error("Unexpected error loading correction data:", err);
      }
    },
    [user, profile],
  );

  const refreshAll = useCallback(async () => {
    try {
      const records = await fetchAttendance(true);
      if (records) {
        await fetchCorrectionData(records);
      }
    } catch (err) {
      console.error(err);
    }
  }, [fetchAttendance, fetchCorrectionData]);

  // ---------------------------------------------------------------------------
  // Initial load — depends on both user and profile.role.
  //
  // Why profile.role in deps:
  //   AuthContext sets user synchronously when auth state changes, then
  //   fetches profile async. The effect runs first with profile=null
  //   (fetchCorrectionData skips), then runs again when profile loads,
  //   at which point the correct role-aware correction query executes.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const records = await fetchAttendance(false, filterDate);
      await fetchCorrectionData(records);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.role, filterDate]);

  // ---------------------------------------------------------------------------
  // Phase 3A computed values (preserved exactly)
  // ---------------------------------------------------------------------------

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
      if (r.attendance_date !== filterDate) return false;
      const matchSearch = !q || `${r.name} ${r.employeeId}`.toLowerCase().includes(q);
      const matchDept = dept === "all" || r.department === dept;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, dept, statusFilter, mappedRecords, filterDate]);

  const todayStr = useMemo(() => getTodayStr(), []);

  const todayRecord = useMemo(() => {
    if (!employeeRecord) return null;
    return mappedRecords.find(
      (r) => r.employees?.id === employeeRecord.id && r.attendance_date === todayStr,
    );
  }, [mappedRecords, employeeRecord, todayStr]);

  const canCheckIn = employeeRecord && !todayRecord;
  const canCheckOut = employeeRecord && todayRecord && todayRecord.status === "INCOMPLETE";

  // ---------------------------------------------------------------------------
  // Phase 3A handlers (preserved exactly)
  // ---------------------------------------------------------------------------

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc("check_in");
      if (rpcError) throw rpcError;
      await refreshAll();
      toast({ title: "Success", description: "Checked in successfully." });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to check in.");
      toast({
        title: "Error",
        description: err.message || "Failed to check in.",
        variant: "error",
      });
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
      await refreshAll();
      toast({ title: "Success", description: "Checked out successfully." });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to check out.");
      toast({
        title: "Error",
        description: err.message || "Failed to check out.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Phase 3B: correction modal lifecycle
  // ---------------------------------------------------------------------------

  const handleOpenCorrectionModal = (record) => {
    setCorrectionError(null);
    setCorrectionForm({
      requestedStatus: "",
      requestedCheckIn: "",
      requestedCheckOut: "",
      reason: "",
    });
    setCorrectionModalRecord(record);
  };

  const handleCloseModal = () => {
    if (correctionSubmitting) return;
    setCorrectionModalRecord(null);
    setCorrectionError(null);
  };

  const handleFormChange = (patch) => {
    setCorrectionForm((prev) => ({ ...prev, ...patch }));
  };

  // ---------------------------------------------------------------------------
  // Phase 3B: submit correction request
  //
  // RPC: request_attendance_correction(
  //   p_attendance_record_id, p_requested_status,
  //   p_requested_check_in, p_requested_check_out, p_reason
  // )
  // Argument names verified against migration 002 SQL.
  // No direct table mutation. RPC is the only workflow mutation entry point.
  // ---------------------------------------------------------------------------

  const handleSubmitCorrection = async (payload) => {
    if (!correctionModalRecord) return;
    try {
      setCorrectionSubmitting(true);
      setCorrectionError(null);

      const { error: rpcError } = await supabase.rpc("request_attendance_correction", {
        p_attendance_record_id: correctionModalRecord.id,
        p_requested_status: payload.p_requested_status,
        p_requested_check_in: payload.p_requested_check_in,
        p_requested_check_out: payload.p_requested_check_out,
        p_reason: payload.p_reason,
      });

      if (rpcError) {
        let msg = rpcError.message || "Failed to submit correction request.";

        // Translate known DB/constraint errors to user-friendly messages.
        if (
          msg.includes("unique_pending_correction_request") ||
          msg.toLowerCase().includes("unique constraint") ||
          msg.toLowerCase().includes("duplicate")
        ) {
          msg = "A correction request is already pending for this attendance record.";
        } else if (msg.includes("Cannot request correction for another")) {
          msg = "You can only request corrections for your own attendance records.";
        } else if (msg.includes("Correction reason is required")) {
          msg = "A reason is required to submit a correction request.";
        } else if (msg.includes("check-out time cannot be before")) {
          msg = "Check-out time cannot be before check-in time.";
        } else if (msg.includes("ABSENT or LEAVE status cannot include")) {
          msg = "Corrections for Absent or Leave status cannot include timestamps.";
        }

        setCorrectionError(msg);
        return; // keep modal open
      }

      // Success: close modal, refresh correction data only.
      // Attendance records are unchanged by the request RPC.
      setCorrectionModalRecord(null);
      setCorrectionError(null);
      await refreshAll();
      toast({ title: "Success", description: "Correction request submitted successfully." });
    } catch (err) {
      console.error(err);
      setCorrectionError(err.message || "Failed to submit correction request.");
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Phase 3B: OWNER reviews a correction request
  //
  // RPC: review_attendance_correction(p_request_id, p_approve, p_remarks)
  // Argument names verified against migration 002 SQL.
  // No direct table mutation. RPC is the only review mutation entry point.
  // ---------------------------------------------------------------------------

  const handleReviewCorrection = async (requestId, approve) => {
    try {
      setReviewLoadingId(requestId);

      const { error: rpcError } = await supabase.rpc("review_attendance_correction", {
        p_request_id: requestId,
        p_approve: approve,
        // Send null when no remarks — RPC signature: p_remarks TEXT DEFAULT NULL
        p_remarks: reviewRemarks[requestId]?.trim() || null,
      });

      if (rpcError) {
        let msg = rpcError.message || "Failed to review correction request.";
        if (msg.includes("already been reviewed")) {
          msg = "This request has already been reviewed.";
        } else if (msg.includes("Only OWNER")) {
          msg = "Only the Owner can review correction requests.";
        }
        // Preserve "Invalid correction: …" messages verbatim — they are informative.
        setError(msg);
        return;
      }

      // Clear remarks for this request.
      setReviewRemarks((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });

      await refreshAll();
      toast({
        title: "Success",
        description: approve
          ? "Correction approved successfully."
          : "Correction rejected successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to process review.",
        variant: "error",
      });
    } finally {
      setReviewLoadingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Summary counts
  // ---------------------------------------------------------------------------

  const totalRecords = filtered.length;
  const presentCount = filtered.filter((r) => r.status === "PRESENT").length;
  const incompleteCount = filtered.filter((r) => r.status === "INCOMPLETE").length;
  const absentLeaveCount = filtered.filter(
    (r) => r.status === "ABSENT" || r.status === "LEAVE",
  ).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Global error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <p>{error}</p>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Check-In / Check-Out action card (Phase 3A — unchanged)             */}
      {/* ------------------------------------------------------------------- */}
      {(canCheckIn || canCheckOut) && (
        <section className="hr-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Attendance Actions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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

      {/* ------------------------------------------------------------------- */}
      {/* Summary cards (Phase 3A — unchanged)                                */}
      {/* ------------------------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Attendance summary">
        {[
          { label: "Total", value: totalRecords, tone: "cyan" },
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

      {/* ------------------------------------------------------------------- */}
      {/* OWNER: Pending correction review queue                              */}
      {/* Rendered only for OWNER. Invisible to ACCOUNTS and EMPLOYEE.        */}
      {/* ACCOUNTS cannot query attendance_correction_requests (no RLS policy) */}
      {/* and therefore this section is not rendered for them.               */}
      {/* ------------------------------------------------------------------- */}
      {profile?.role === ROLES.OWNER && (
        <section className="hr-card p-0">
          <div className="flex items-center gap-2 border-b border-border p-5">
            <span className="hr-section-index hr-tone-violet">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Pending Correction Requests
            </h2>
            {ownerQueue.length > 0 && (
              <span className="ml-auto rounded-full bg-[var(--hr-amber)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--hr-amber)]">
                {ownerQueue.length} pending
              </span>
            )}
          </div>

          {ownerQueue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No pending requests"
              subtitle="All correction requests have been reviewed."
            />
          ) : (
            <div>
              {ownerQueue.map((req) => (
                <CorrectionReviewCard
                  key={req.id}
                  request={req}
                  remarks={reviewRemarks[req.id] ?? ""}
                  onRemarksChange={(val) =>
                    setReviewRemarks((prev) => ({ ...prev, [req.id]: val }))
                  }
                  onApprove={() => handleReviewCorrection(req.id, true)}
                  onReject={() => handleReviewCorrection(req.id, false)}
                  loading={reviewLoadingId === req.id}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Attendance log table                                                 */}
      {/* Phase 3A base preserved; Phase 3B adds the correction action column */}
      {/* ------------------------------------------------------------------- */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-coral">
              {profile?.role === ROLES.OWNER ? "02" : "01"}
            </span>
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
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 w-[135px] text-xs"
              disabled={loading}
              aria-label="Filter Date"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px] relative">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading attendance data...
              </p>
            </div>
          ) : (
            <div
              className={
                isRefreshing
                  ? "opacity-60 pointer-events-none transition-opacity duration-200"
                  : "transition-opacity duration-200"
              }
            >
              {isRefreshing && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm border border-border">
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing...
                </div>
              )}
              <table className="hr-table min-w-[900px]">
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
                    {/* Correction column header — only rendered when the current
                        user has an employee record and may have actionable rows */}
                    {employeeRecord && <th aria-label="Correction actions"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    // Is this row the current user's own attendance record?
                    const isOwnRow = !!employeeRecord && row.employees?.id === employeeRecord.id;

                    // What is the latest correction request for this record?
                    const latestCorrection = correctionMap[row.id];
                    const hasPending = latestCorrection?.status === "PENDING";

                    return (
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
                        <td className="font-mono text-xs text-muted-foreground">
                          {row.employeeId}
                        </td>
                        <td>{row.department}</td>
                        <td className="text-xs">{row.attendance_date}</td>
                        <td className="text-xs">{row.checkIn}</td>
                        <td className="text-xs">{row.checkOut}</td>
                        <td className="text-xs font-medium">{row.hours}</td>
                        <td>
                          <Badge
                            className={`hr-status-badge hr-tone-${statusToneMap[row.status] ?? "cyan"}`}
                          >
                            <span className="hr-mini-dot" />{" "}
                            {displayStatus[row.status] || row.status}
                          </Badge>
                        </td>

                        {/* Correction action cell */}
                        {employeeRecord && (
                          <td>
                            {isOwnRow && (
                              <div className="flex flex-col items-start gap-2">
                                {latestCorrection?.status === "PENDING" && (
                                  <button
                                    className="hr-correction-action-btn hr-correction-action-btn--pending"
                                    disabled
                                    aria-label="Correction request is pending review"
                                  >
                                    <Clock className="size-3" />
                                    Pending
                                  </button>
                                )}

                                {latestCorrection?.status === "APPROVED" && (
                                  <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-3.5" />
                                    Approved
                                  </div>
                                )}

                                {latestCorrection?.status === "REJECTED" && (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-destructive">
                                      <XCircle className="size-3.5" />
                                      Rejected
                                    </div>
                                    {latestCorrection.review_remarks && (
                                      <p
                                        className="text-[10px] text-muted-foreground leading-tight max-w-[140px] line-clamp-2"
                                        title={latestCorrection.review_remarks}
                                      >
                                        Reason: {latestCorrection.review_remarks}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {!hasPending && (
                                  <button
                                    className="hr-correction-action-btn hr-correction-action-btn--correct"
                                    onClick={() => handleOpenCorrectionModal(row)}
                                    disabled={loading || submitting}
                                    aria-label={`Request correction for ${row.attendance_date}`}
                                  >
                                    <Edit3 className="size-3" />
                                    Correct
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState
                  icon={Clock3}
                  title="No records found"
                  subtitle="No attendance records available for the current filters."
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Correction request modal — mounted only when a record is selected.
          Unmounting on close cleanly resets all dialog state. */}
      {correctionModalRecord && (
        <AttendanceCorrectionModal
          record={correctionModalRecord}
          form={correctionForm}
          onFormChange={handleFormChange}
          onClose={handleCloseModal}
          onSubmit={handleSubmitCorrection}
          submitting={correctionSubmitting}
          error={correctionError}
        />
      )}
    </main>
  );
}
