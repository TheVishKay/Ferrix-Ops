import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";
import { useToast } from "@/components/ui/use-toast";
import { EmptyState } from "@/components/shared";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Loader2, CheckCircle2, XCircle, AlertCircle, X, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchMyLeaveRequests,
  fetchAllLeaveRequests,
  submitLeaveRequest,
  reviewLeaveRequest,
  cancelPendingLeave,
} from "@/services/leaveService";

const toneClass = (t) => `hr-tone-${t}`;

const statusToneMap = {
  PENDING: "amber",
  APPROVED: "lime",
  REJECTED: "coral",
  CANCELLED: "violet",
};

const displayStatus = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
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

function OwnerReviewCard({ request, remarks, onRemarksChange, onApprove, onReject, loading }) {
  const emp = request.employees;
  const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
  const initials = emp
    ? `${emp.first_name?.[0] ?? ""}${emp.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";
  const tone = getTone(emp?.employee_code ?? "");

  return (
    <div className="hr-review-card">
      <div className="flex items-start gap-3 mb-4">
        <Avatar className="size-9 rounded-xl shrink-0">
          <AvatarFallback className={`hr-avatar ${toneClass(tone)}`}>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm leading-tight">{empName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {emp?.employee_code ?? "—"}
            {" · Submitted "}
            {new Date(request.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge className="hr-status-badge hr-tone-amber shrink-0">
          <span className="hr-mini-dot" /> Pending
        </Badge>
      </div>

      <div className="hr-review-compare mb-4">
        <div className="hr-review-compare-col flex-1">
          <p className="hr-review-compare-heading">Request Details</p>
          <div className="hr-review-compare-row">
            <span className="key">Start Date</span>
            <span>{request.start_date}</span>
          </div>
          <div className="hr-review-compare-row">
            <span className="key">End Date</span>
            <span>{request.end_date}</span>
          </div>
          {request.reason && (
            <div className="hr-review-compare-row">
              <span className="key">Reason</span>
              <span>{request.reason}</span>
            </div>
          )}
        </div>
      </div>

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

export default function LeaveManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const canManageOwnLeave = profile?.role === ROLES.EMPLOYEE || profile?.role === ROLES.ACCOUNTS;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state
  const [requests, setRequests] = useState([]);

  // Employee form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Owner review state
  const [reviewLoadingId, setReviewLoadingId] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState({});

  // Cancel confirmation dialog
  const [cancelTargetId, setCancelTargetId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);
      if (canManageOwnLeave) {
        const data = await fetchMyLeaveRequests();
        setRequests(data || []);
      } else if (profile.role === ROLES.OWNER) {
        const data = await fetchAllLeaveRequests();
        setRequests(data || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [profile, canManageOwnLeave]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Start and End dates are required.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await submitLeaveRequest({ startDate, endDate, reason });
      setStartDate("");
      setEndDate("");
      setReason("");
      toast({ title: "Success", description: "Leave request submitted successfully." });
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTargetId) return;
    try {
      setSubmitting(true);
      setError(null);
      await cancelPendingLeave(cancelTargetId);
      toast({ title: "Success", description: "Leave request cancelled." });
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to cancel leave request.");
    } finally {
      setSubmitting(false);
      setCancelTargetId(null);
    }
  };

  const handleReview = async (id, approve) => {
    try {
      setReviewLoadingId(id);
      setError(null);
      await reviewLeaveRequest(id, approve, reviewRemarks[id]?.trim());
      setReviewRemarks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({
        title: "Success",
        description: approve ? "Leave request approved." : "Leave request rejected.",
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to review leave request.");
    } finally {
      setReviewLoadingId(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }

      // 2. Date Filter
      if (dateFilter !== "all") {
        const reqStart = new Date(r.start_date);
        const reqEnd = new Date(r.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === "today") {
          // Check if today falls between reqStart and reqEnd inclusive
          if (today < reqStart || today > reqEnd) return false;
        } else if (dateFilter === "thisWeek") {
          // Monday through Sunday
          const day = today.getDay(); // 0 is Sunday
          const diff = today.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(today.setDate(diff));
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          if (reqStart > endOfWeek || reqEnd < startOfWeek) return false;
        } else if (dateFilter === "last7days") {
          const startOf7Days = new Date(today);
          startOf7Days.setDate(today.getDate() - 6);
          const endOfToday = new Date(today);
          endOfToday.setHours(23, 59, 59, 999);
          if (reqStart > endOfToday || reqEnd < startOf7Days) return false;
        } else if (dateFilter === "thisMonth") {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          );
          if (reqStart > endOfMonth || reqEnd < startOfMonth) return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (profile?.role === ROLES.OWNER) {
          const emp = r.employees;
          if (!emp) return false;
          const matchName = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q);
          const matchCode = (emp.employee_code || "").toLowerCase().includes(q);
          const matchEmail = (emp.email || "").toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchEmail) return false;
        } else {
          // Employee/Accounts scope: search by reason
          if (!(r.reason || "").toLowerCase().includes(q)) return false;
        }
      }

      return true;
    });
  }, [requests, statusFilter, dateFilter, searchQuery, profile?.role]);

  const renderToolbar = (isOwner) => (
    <div className="flex flex-wrap items-center gap-2 p-5 border-b border-border w-full sm:w-auto">
      <label className="hr-table-search">
        <Search className="size-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isOwner ? "Search employee name, code, email..." : "Search by reason..."}
          className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
          disabled={loading}
        />
      </label>
      <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
        <SelectTrigger className="h-9 min-w-[120px] max-w-[160px] flex-1 text-xs">
          <SelectValue placeholder="Status: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status: All</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={dateFilter} onValueChange={setDateFilter} disabled={loading}>
        <SelectTrigger className="h-9 min-w-[120px] max-w-[160px] flex-1 text-xs">
          <SelectValue placeholder="Date: All Dates" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Date: All Dates</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="thisWeek">This Week</SelectItem>
          <SelectItem value="last7days">Last 7 Days</SelectItem>
          <SelectItem value="thisMonth">This Month</SelectItem>
        </SelectContent>
      </Select>
      {(searchQuery || statusFilter !== "all" || dateFilter !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchQuery("");
            setStatusFilter("all");
            setDateFilter("all");
          }}
          className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          disabled={loading}
        >
          <X className="size-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );

  if (!profile) return null;

  const pendingQueue = requests.filter((r) => r.status === "PENDING");
  const historyQueue = filteredRequests.filter((r) => r.status !== "PENDING");

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {canManageOwnLeave && (
        <>
          <section className="hr-card p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground mb-4">
              Request Leave
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Start Date</label>
                  <Input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submitting || loading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">End Date</label>
                  <Input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={submitting || loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Reason (Optional)</label>
                <textarea
                  className="hr-correction-textarea"
                  placeholder="Reason for leave..."
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting || loading}
                />
              </div>
              <Button type="submit" disabled={submitting || loading} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </form>
          </section>

          <section className="hr-card p-0">
            <div className="border-b border-border p-5">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                My Leave Requests
              </h2>
            </div>
            {renderToolbar(false)}
            <div className="overflow-x-auto min-h-[300px] relative">
              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave requests found"
                  subtitle="You haven't requested any leaves or none match your filters."
                />
              ) : (
                <table className="hr-table w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th>Dates</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Applied On</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium whitespace-nowrap text-xs text-foreground">
                          {r.start_date} to {r.end_date}
                        </td>
                        <td
                          className="max-w-[200px] truncate text-xs text-muted-foreground"
                          title={r.reason}
                        >
                          {r.reason || "—"}
                        </td>
                        <td>
                          <Badge className={`hr-status-badge hr-tone-${statusToneMap[r.status]}`}>
                            <span className="hr-mini-dot" /> {displayStatus[r.status]}
                          </Badge>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td
                          className="max-w-[150px] truncate text-xs text-muted-foreground"
                          title={r.owner_remarks}
                        >
                          {r.owner_remarks || "—"}
                        </td>
                        <td>
                          {r.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setCancelTargetId(r.id)}
                              disabled={submitting}
                            >
                              <X className="size-3 mr-1" /> Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {profile.role === ROLES.OWNER && (
        <>
          <section className="hr-card p-0">
            <div className="flex items-center gap-2 border-b border-border p-5">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Pending Leave Approvals
              </h2>
              {pendingQueue.length > 0 && (
                <span className="ml-auto rounded-full bg-[var(--hr-amber)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--hr-amber)]">
                  {pendingQueue.length} pending
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex h-64 flex-col items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingQueue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending requests"
                subtitle="All leave requests have been reviewed."
              />
            ) : (
              <div>
                {pendingQueue.map((req) => (
                  <OwnerReviewCard
                    key={req.id}
                    request={req}
                    remarks={reviewRemarks[req.id] ?? ""}
                    onRemarksChange={(val) =>
                      setReviewRemarks((prev) => ({ ...prev, [req.id]: val }))
                    }
                    onApprove={() => handleReview(req.id, true)}
                    onReject={() => handleReview(req.id, false)}
                    loading={reviewLoadingId === req.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="hr-card p-0">
            <div className="border-b border-border p-5">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Leave History
              </h2>
            </div>
            {renderToolbar(true)}
            <div className="overflow-x-auto min-h-[300px] relative">
              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyQueue.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave history found"
                  subtitle="No reviewed leave requests match your filters."
                />
              ) : (
                <table className="hr-table w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Dates</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Remarks</th>
                      <th>Reviewed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQueue.map((r) => {
                      const empName = r.employees
                        ? `${r.employees.first_name} ${r.employees.last_name}`
                        : "Unknown";
                      return (
                        <tr key={r.id}>
                          <td className="font-medium whitespace-nowrap text-xs text-foreground">
                            {empName}
                          </td>
                          <td className="text-xs text-muted-foreground whitespace-nowrap">
                            {r.start_date} to {r.end_date}
                          </td>
                          <td
                            className="max-w-[200px] truncate text-xs text-muted-foreground"
                            title={r.reason}
                          >
                            {r.reason || "—"}
                          </td>
                          <td>
                            <Badge className={`hr-status-badge hr-tone-${statusToneMap[r.status]}`}>
                              <span className="hr-mini-dot" /> {displayStatus[r.status]}
                            </Badge>
                          </td>
                          <td
                            className="max-w-[150px] truncate text-xs text-muted-foreground"
                            title={r.owner_remarks}
                          >
                            {r.owner_remarks || "—"}
                          </td>
                          <td className="text-xs text-muted-foreground">
                            {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog
        isOpen={!!cancelTargetId}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        title="Cancel Leave Request"
        description="Are you sure you want to cancel this leave request? This action cannot be undone."
        confirmText="Yes, Cancel Request"
        cancelText="Keep Request"
        loading={submitting}
        onConfirm={handleCancel}
      />
    </main>
  );
}
