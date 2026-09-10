import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock3,
  Sparkles,
  Users,
  WalletCards,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileEdit,
  Banknote,
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
  const [actions, setActions] = useState([]);

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
        let newActions = [];

        // Fetch user's employee record if they are an employee (useful for personal queries)
        let empId = null;
        if (role === ROLES.EMPLOYEE) {
          const { data: empData } = await supabase
            .from("employees")
            .select("id")
            .eq("user_id", user.id)
            .single();
          empId = empData?.id;
        }

        // ==========================================
        // OWNER QUERIES
        // ==========================================
        if (role === ROLES.OWNER) {
          const [empRes, attRes, correctionsRes, expRes] = await Promise.all([
            supabase
              .from("employees")
              .select("*", { count: "exact", head: true })
              .eq("employment_status", "ACTIVE"),
            supabase
              .from("attendance_records")
              .select("*", { count: "exact", head: true })
              .eq("attendance_date", todayStr),
            supabase
              .from("attendance_correction_requests")
              .select("*", { count: "exact", head: true })
              .eq("status", "PENDING"),
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("status", "PENDING_OWNER_APPROVAL"),
          ]);

          fetchedMetrics = {
            activeEmployees: empRes.count || 0,
            todayCheckins: attRes.count || 0,
            pendingApprovals: expRes.count || 0,
          };

          if (correctionsRes.count > 0) {
            newActions.push({
              title: "Attendance Corrections",
              helper: `${correctionsRes.count} request(s) await your review`,
              tone: "amber",
              icon: Clock3,
              to: "/attendance",
            });
          }

          if (expRes.count > 0) {
            newActions.push({
              title: "Bills Awaiting Approval",
              helper: `${expRes.count} bill(s) require owner approval`,
              tone: "coral",
              icon: WalletCards,
              to: "/bills",
            });
          }
        }

        // ==========================================
        // ACCOUNTS QUERIES
        // ==========================================
        if (role === ROLES.ACCOUNTS) {
          const [verifyRes, paymentRes] = await Promise.all([
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("status", "SUBMITTED"),
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("status", "PAYMENT_PENDING"),
          ]);

          fetchedMetrics = {
            pendingVerification: verifyRes.count || 0,
            pendingPayment: paymentRes.count || 0,
          };

          if (verifyRes.count > 0) {
            newActions.push({
              title: "Bills to Verify",
              helper: `${verifyRes.count} bill(s) await initial accounts verification`,
              tone: "amber",
              icon: WalletCards,
              to: "/bills",
            });
          }

          if (paymentRes.count > 0) {
            newActions.push({
              title: "Bills to Pay",
              helper: `${paymentRes.count} approved bill(s) await payment processing`,
              tone: "lime",
              icon: Banknote,
              to: "/bills",
            });
          }
        }

        // ==========================================
        // EMPLOYEE QUERIES
        // ==========================================
        if (role === ROLES.EMPLOYEE && empId) {
          const [attRes, returnedExpRes, totalExpRes] = await Promise.all([
            supabase
              .from("attendance_records")
              .select("status, check_in_at")
              .eq("attendance_date", todayStr)
              .eq("employee_id", empId)
              .maybeSingle(),
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("status", "RETURNED_FOR_CORRECTION")
              .eq("submitted_by", empId),
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("submitted_by", empId),
          ]);

          fetchedMetrics = {
            todayAttendance: attRes.data || null,
            myBills: totalExpRes.count || 0,
          };

          if (returnedExpRes.count > 0) {
            newActions.push({
              title: "Returned Bills",
              helper: `${returnedExpRes.count} of your bills were returned and need correction`,
              tone: "coral",
              icon: FileEdit,
              to: "/bills",
            });
          }

          if (!attRes.data) {
            newActions.push({
              title: "Mark Attendance",
              helper: "You have not checked in today",
              tone: "cyan",
              icon: Clock3,
              to: "/attendance",
            });
          }
        }

        if (mounted) {
          setMetrics(fetchedMetrics);
          setActions(newActions);
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

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Role-Aware Metric Summary */}
      <section
        className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
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
              label="Checked In Today"
              value={metrics?.todayCheckins}
              icon={CheckCircle2}
              tone="lime"
              to="/attendance"
              onNavigate={navigate}
            />
            <MetricCard
              label="Pending Bill Approvals"
              value={metrics?.pendingApprovals ?? 0}
              icon={WalletCards}
              tone="coral"
              to="/bills"
              onNavigate={navigate}
            />
          </>
        )}

        {profile?.role === ROLES.ACCOUNTS && (
          <>
            <MetricCard
              label="Bills to Verify"
              value={metrics?.pendingVerification ?? 0}
              icon={WalletCards}
              tone="amber"
              to="/bills"
              onNavigate={navigate}
            />
            <MetricCard
              label="Bills to Pay"
              value={metrics?.pendingPayment ?? 0}
              icon={Banknote}
              tone="lime"
              to="/bills"
              onNavigate={navigate}
            />
          </>
        )}

        {profile?.role === ROLES.EMPLOYEE && (
          <>
            <MetricCard
              label="Today's Status"
              value={metrics?.todayAttendance ? "Checked In" : "Not Checked In"}
              icon={metrics?.todayAttendance ? CheckCircle2 : Clock3}
              tone={metrics?.todayAttendance ? "lime" : "amber"}
              to="/attendance"
              onNavigate={navigate}
              isTextValue
            />
            <MetricCard
              label="My Expense Claims"
              value={metrics?.myBills ?? 0}
              icon={WalletCards}
              tone="cyan"
              to="/bills"
              onNavigate={navigate}
            />
          </>
        )}
      </section>

      {/* Action Center */}
      <section className="hr-card">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-amber">!</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Action Center
            </h2>
          </div>
          <Badge className="hr-soft-badge hr-tone-amber">
            <span className="hr-mini-dot" />
            {actions.length} require(s) attention
          </Badge>
        </div>
        <div className="mt-5">
          {actions.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              You have no pending actions requiring your attention right now.
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <div
                    key={action.title}
                    className="hr-action-row flex items-center justify-between p-3 border rounded-lg bg-surface"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`hr-icon-box ${toneClass(action.tone)} shrink-0`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {action.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {action.helper}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      aria-label={`Action ${action.title}`}
                      onClick={() => navigate(action.to)}
                    >
                      Review
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <span className="hr-footer-mark hr-tone-coral" aria-hidden="true">
            <Sparkles className="size-3" />
          </span>
          LanternHR · Meridian Workforce Ltd.
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
        className={`font-display mt-4 truncate ${isTextValue ? "text-xl" : "text-[28px]"} font-black leading-none tracking-tight text-foreground`}
      >
        {value}
      </p>
      <p className="mt-2 truncate text-sm font-medium text-foreground">{label}</p>
    </button>
  );
}
