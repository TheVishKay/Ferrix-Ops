import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";
import { useToast } from "@/components/ui/use-toast";
import { EmptyState } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Loader2, CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";
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

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);
      if (profile.role === ROLES.EMPLOYEE) {
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
  }, [profile]);

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

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      setSubmitting(true);
      setError(null);
      await cancelPendingLeave(id);
      toast({ title: "Success", description: "Leave request cancelled." });
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to cancel leave request.");
    } finally {
      setSubmitting(false);
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

  if (!profile) return null;

  if (profile.role === ROLES.ACCOUNTS) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-4 py-5">
        <EmptyState
          icon={CalendarDays}
          title="Access Denied"
          subtitle="Accounts role does not have access to Leave Management."
        />
      </main>
    );
  }

  const pendingQueue = requests.filter((r) => r.status === "PENDING");
  const historyQueue = requests.filter((r) => r.status !== "PENDING");

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {profile.role === ROLES.EMPLOYEE && (
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
            <div className="overflow-x-auto min-h-[300px] relative">
              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave requests"
                  subtitle="You haven't requested any leaves yet."
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
                    {requests.map((r) => (
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
                              onClick={() => handleCancel(r.id)}
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
            <div className="overflow-x-auto min-h-[300px] relative">
              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyQueue.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave history"
                  subtitle="No reviewed leave requests yet."
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
    </main>
  );
}
