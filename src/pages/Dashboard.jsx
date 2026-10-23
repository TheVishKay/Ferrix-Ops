import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock3,
  Users,
  WalletCards,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileEdit,
  Banknote,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";

const toneClass = (tone) => `hr-tone-${tone}`;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [metrics, setMetrics] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [contextItems, setContextItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function fetchDashboardData() {
      if (!user || !profile) return;

      try {
        setLoading(true);
        setError(null);

        const role = profile.role;
        const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

        let fetchedMetrics = {};
        let fetchedActions = [];
        let fetchedContext = [];

        let empId = null;
        if (role === ROLES.EMPLOYEE) {
          const { data: empData } = await supabase
            .from("employees")
            .select("id")
            .eq("user_id", user.id)
            .single();
          empId = empData?.id;
        }

        const fmtCurrency = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

        // ==========================================
        // OWNER QUERIES
        // ==========================================
        if (role === ROLES.OWNER) {
          const [empRes, attRes, correctionsRes, expRes] = await Promise.all([
            supabase.from("employees").select("id").eq("employment_status", "ACTIVE"),
            supabase.from("attendance_records").select("id").eq("attendance_date", todayStr),
            supabase
              .from("attendance_correction_requests")
              .select(
                `
                id, request_type, status,
                employees!attendance_correction_requests_employee_id_fkey (first_name, last_name)
              `,
              )
              .eq("status", "PENDING")
              .order("created_at", { ascending: false }),
            supabase
              .from("expenses")
              .select(
                `
                id, amount, vendor_name,
                employees!expenses_submitted_by_fkey (first_name, last_name)
              `,
              )
              .eq("status", "PENDING_OWNER_APPROVAL")
              .order("created_at", { ascending: false }),
          ]);

          const totalActive = empRes.data?.length || 0;
          const totalPresent = attRes.data?.length || 0;
          const totalNotCheckedIn = Math.max(0, totalActive - totalPresent);

          const pendingExpData = expRes.data || [];
          const pendingExpSum = pendingExpData.reduce((sum, e) => sum + Number(e.amount), 0);

          fetchedMetrics = {
            activeEmployees: totalActive,
            todayPresent: totalPresent,
            todayNotCheckedIn: totalNotCheckedIn,
            pendingApprovalsValue: fmtCurrency(pendingExpSum),
          };

          const corrData = correctionsRes.data || [];
          corrData.forEach((c) => {
            const empName = c.employees
              ? `${c.employees.first_name} ${c.employees.last_name}`
              : "Unknown";
            fetchedActions.push({
              id: `corr-${c.id}`,
              title: `Attendance Correction: ${empName}`,
              description: `Awaiting your review for a ${c.request_type.toLowerCase().replace("_", " ")} request.`,
              tone: "amber",
              icon: Clock3,
              to: "/attendance",
            });
          });

          pendingExpData.forEach((e) => {
            const empName = e.employees
              ? `${e.employees.first_name} ${e.employees.last_name}`
              : "Unknown";
            fetchedActions.push({
              id: `exp-${e.id}`,
              title: `Approve Bill: ${empName}`,
              description: `${e.vendor_name} — ${fmtCurrency(e.amount)}`,
              tone: "coral",
              icon: WalletCards,
              to: "/bills",
            });
          });
        }

        // ==========================================
        // ACCOUNTS QUERIES
        // ==========================================
        if (role === ROLES.ACCOUNTS) {
          const [verifyRes, paymentRes] = await Promise.all([
            supabase
              .from("expenses")
              .select(
                `
                id, amount, vendor_name,
                employees!expenses_submitted_by_fkey (first_name, last_name)
              `,
              )
              .eq("status", "SUBMITTED")
              .order("created_at", { ascending: false }),
            supabase
              .from("expenses")
              .select(
                `
                id, amount, vendor_name,
                employees!expenses_submitted_by_fkey (first_name, last_name)
              `,
              )
              .eq("status", "PAYMENT_PENDING")
              .order("created_at", { ascending: false }),
          ]);

          const verifyData = verifyRes.data || [];
          const paymentData = paymentRes.data || [];

          const verifySum = verifyData.reduce((sum, e) => sum + Number(e.amount), 0);
          const paymentSum = paymentData.reduce((sum, e) => sum + Number(e.amount), 0);

          fetchedMetrics = {
            pendingVerificationValue: fmtCurrency(verifySum),
            pendingPaymentValue: fmtCurrency(paymentSum),
          };

          paymentData.forEach((e) => {
            const empName = e.employees
              ? `${e.employees.first_name} ${e.employees.last_name}`
              : "Unknown";
            fetchedActions.push({
              id: `pay-${e.id}`,
              title: `Pay Bill: ${e.vendor_name}`,
              description: `Approved expense for ${empName} — ${fmtCurrency(e.amount)}`,
              tone: "lime",
              icon: Banknote,
              to: "/bills",
            });
          });

          verifyData.forEach((e) => {
            const empName = e.employees
              ? `${e.employees.first_name} ${e.employees.last_name}`
              : "Unknown";
            fetchedActions.push({
              id: `ver-${e.id}`,
              title: `Verify Bill: ${empName}`,
              description: `${e.vendor_name} — ${fmtCurrency(e.amount)}`,
              tone: "amber",
              icon: WalletCards,
              to: "/bills",
            });
          });
        }

        // ==========================================
        // EMPLOYEE QUERIES
        // ==========================================
        if (role === ROLES.EMPLOYEE && empId) {
          const [attRes, returnedExpRes, recentCorrRes] = await Promise.all([
            supabase
              .from("attendance_records")
              .select("status, check_in_at, check_out_at")
              .eq("attendance_date", todayStr)
              .eq("employee_id", empId)
              .maybeSingle(),
            supabase
              .from("expenses")
              .select("id, amount, vendor_name")
              .eq("status", "RETURNED_FOR_CORRECTION")
              .eq("submitted_by", empId)
              .order("created_at", { ascending: false }),
            supabase
              .from("attendance_correction_requests")
              .select("id, request_type, status, review_remarks")
              .eq("employee_id", empId)
              .order("created_at", { ascending: false })
              .limit(3),
          ]);

          fetchedMetrics = {
            todayAttendance: attRes.data || null,
          };

          const returnedData = returnedExpRes.data || [];
          returnedData.forEach((e) => {
            fetchedActions.push({
              id: `ret-${e.id}`,
              title: `Returned Bill: ${e.vendor_name}`,
              description: `Needs correction — ${fmtCurrency(e.amount)}`,
              tone: "coral",
              icon: FileEdit,
              to: "/bills",
            });
          });

          if (!attRes.data) {
            fetchedActions.push({
              id: "mark-att",
              title: "Mark Attendance",
              description: "You have not checked in today.",
              tone: "cyan",
              icon: Clock3,
              to: "/attendance",
            });
          } else if (!attRes.data.check_out_at) {
            fetchedActions.push({
              id: "mark-out",
              title: "Check Out",
              description: "Don't forget to check out at the end of your shift.",
              tone: "cyan",
              icon: Clock3,
              to: "/attendance",
            });
          }

          const corrData = recentCorrRes.data || [];
          corrData.forEach((c) => {
            let tone = "slate";
            let statusText = "Pending";
            if (c.status === "APPROVED") {
              tone = "lime";
              statusText = "Approved";
            }
            if (c.status === "REJECTED") {
              tone = "coral";
              statusText = "Rejected";
            }

            fetchedContext.push({
              id: `corr-ctx-${c.id}`,
              title: `Correction Request: ${c.request_type.toLowerCase().replace("_", " ")}`,
              description:
                c.status === "REJECTED" && c.review_remarks
                  ? `Rejected: ${c.review_remarks}`
                  : statusText,
              tone: tone,
            });
          });
        }

        if (mounted) {
          setMetrics(fetchedMetrics);
          setActionItems(fetchedActions);
          setContextItems(fetchedContext);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError("Failed to load dashboard data. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchDashboardData();

    return () => {
      mounted = false;
    };
  }, [user, profile]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </main>
    );
  }

  const hasActions = actionItems.length > 0;
  const visibleActions = actionItems.slice(0, 5);
  const remainingActions = Math.max(0, actionItems.length - 5);

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* 1. OPERATIONAL OVERVIEW */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="hr-section-index hr-tone-violet">01</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Operational Overview
          </h2>
        </div>
        <div
          className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 md:grid-cols-4"
          aria-label="Overview summary"
        >
          {profile?.role === ROLES.OWNER && (
            <>
              <MetricCard
                label="Total Active Employees"
                value={metrics?.activeEmployees}
                icon={Users}
                tone="cyan"
                to="/employees"
                onNavigate={navigate}
              />
              <MetricCard
                label="Present Today"
                value={metrics?.todayPresent}
                icon={CheckCircle2}
                tone="lime"
                to="/attendance"
                onNavigate={navigate}
              />
              <MetricCard
                label="Not Checked In"
                value={metrics?.todayNotCheckedIn}
                icon={AlertCircle}
                tone="coral"
                to="/attendance"
                onNavigate={navigate}
              />
              <MetricCard
                label="Pending Approvals"
                value={metrics?.pendingApprovalsValue}
                icon={WalletCards}
                tone="amber"
                to="/bills"
                onNavigate={navigate}
                isTextValue
              />
            </>
          )}

          {profile?.role === ROLES.ACCOUNTS && (
            <>
              <MetricCard
                label="Bills to Verify"
                value={metrics?.pendingVerificationValue}
                icon={WalletCards}
                tone="amber"
                to="/bills"
                onNavigate={navigate}
                isTextValue
              />
              <MetricCard
                label="Bills to Pay"
                value={metrics?.pendingPaymentValue}
                icon={Banknote}
                tone="lime"
                to="/bills"
                onNavigate={navigate}
                isTextValue
              />
            </>
          )}

          {profile?.role === ROLES.EMPLOYEE && (
            <>
              <MetricCard
                label="Today's Status"
                value={
                  metrics?.todayAttendance
                    ? metrics.todayAttendance.check_out_at
                      ? "Checked Out"
                      : "Checked In"
                    : "Not Checked In"
                }
                icon={metrics?.todayAttendance ? CheckCircle2 : Clock3}
                tone={
                  metrics?.todayAttendance
                    ? metrics.todayAttendance.check_out_at
                      ? "slate"
                      : "lime"
                    : "amber"
                }
                to="/attendance"
                onNavigate={navigate}
                isTextValue
              />
            </>
          )}
        </div>
      </section>

      {/* 2. NEEDS MY ATTENTION */}
      <section className="hr-card bg-surface/50">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-amber">02</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Needs My Attention
            </h2>
          </div>
          {hasActions && (
            <Badge className="hr-soft-badge hr-tone-amber">
              <span className="hr-mini-dot" />
              {actionItems.length} Action{actionItems.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        <div className="mt-5">
          {!hasActions ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">All clear</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You have no items requiring your attention right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleActions.map((action) => {
                const Icon = action.icon;
                return (
                  <div
                    key={action.id}
                    className="hr-action-row flex items-center justify-between p-3 border rounded-lg bg-background shadow-sm hover:border-border transition-colors cursor-pointer"
                    onClick={() => navigate(action.to)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`hr-icon-box ${toneClass(action.tone)} shrink-0`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {action.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground ml-2"
                      aria-label={`Go to ${action.title}`}
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                );
              })}

              {remainingActions > 0 && (
                <div className="pt-2 text-center">
                  <Button
                    variant="link"
                    className="text-sm text-muted-foreground"
                    onClick={() => navigate(actionItems[0]?.to || "/")}
                  >
                    View {remainingActions} more item{remainingActions > 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. RECENT REQUESTS (Context for Employees) */}
      {profile?.role === ROLES.EMPLOYEE && contextItems.length > 0 && (
        <section className="hr-card bg-surface/30">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <span className="hr-section-index hr-tone-slate">03</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Recent Requests
            </h2>
          </div>
          <div className="mt-5 space-y-3">
            {contextItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 p-3 border rounded-lg bg-background/50"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <Badge className={`hr-status-badge hr-tone-${item.tone}`}>
                    {item.description}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <span className="hr-footer-mark hr-tone-coral" aria-hidden="true">
            <Sparkles className="size-3" />
          </span>
          ferrixOps · Manufacturing Operations
        </p>
        <p>© 2026 · System v1.0.4</p>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------
function MetricCard({ label, value, icon: Icon, tone, to, onNavigate, isTextValue = false }) {
  return (
    <button
      className="hr-card hr-metric-card text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
      onClick={() => onNavigate(to)}
      aria-label={`Go to ${label}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`hr-icon-box ${toneClass(tone)}`}>
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p
        className={`font-display mt-4 truncate ${isTextValue ? "text-[22px]" : "text-[28px]"} font-black leading-none tracking-tight text-foreground`}
      >
        {value}
      </p>
      <p className="mt-2 truncate text-sm font-medium text-foreground">{label}</p>
    </button>
  );
}
