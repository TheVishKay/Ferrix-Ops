import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MoreHorizontal,
  Search,
  WalletCards,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EmptyState } from "@/components/shared";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/constants/roles";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

import ExpenseFormDialog from "@/components/expenses/ExpenseFormDialog";
import ExpenseDetailsDialog from "@/components/expenses/ExpenseDetailsDialog";
import ExpenseReviewDialog from "@/components/expenses/ExpenseReviewDialog";
import PaymentRecordDialog from "@/components/expenses/PaymentRecordDialog";

const toneClass = (t) => `hr-tone-${t}`;

const statusToneMap = {
  DRAFT: "slate",
  SUBMITTED: "cyan",
  RETURNED_FOR_CORRECTION: "amber",
  PENDING_OWNER_APPROVAL: "amber",
  PAYMENT_PENDING: "violet",
  PAID: "lime",
  REJECTED_BY_ACCOUNTS: "coral",
  REJECTED_BY_OWNER: "coral",
};

const statusLabel = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED_FOR_CORRECTION: "Returned for Correction",
  PENDING_OWNER_APPROVAL: "Pending Owner Approval",
  PAYMENT_PENDING: "Payment Pending",
  PAID: "Paid",
  REJECTED_BY_ACCOUNTS: "Rejected by Accounts",
  REJECTED_BY_OWNER: "Rejected by Owner",
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

export default function BillsExpenses() {
  const { user, profile } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Dialog States
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null); // For Edit

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsExpense, setDetailsExpense] = useState(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewExpense, setReviewExpense] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentExpense, setPaymentExpense] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, type: null, payload: null });
  const { toast } = useToast();

  const fetchExpenses = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [catRes, expRes] = await Promise.all([
        supabase.from("expense_categories").select("*").eq("is_active", true).order("name"),
        supabase
          .from("expenses")
          .select(
            `
          *,
          employees!expenses_submitted_by_fkey (
            id,
            first_name,
            last_name,
            employee_code,
            user_id
          )
        `,
          )
          .order("created_at", { ascending: false }),
      ]);

      if (catRes.error) throw catRes.error;
      if (expRes.error) throw expRes.error;

      setCategories(catRes.data || []);
      setExpenses(expRes.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load expenses.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user && profile) {
      fetchExpenses();
    }
  }, [user, profile, fetchExpenses]);

  // Derived state
  const mappedExpenses = useMemo(() => {
    return expenses.map((e) => {
      const emp = e.employees;
      const name = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
      const initials = emp
        ? `${emp.first_name[0] || ""}${emp.last_name[0] || ""}`.toUpperCase()
        : "?";
      const catName = categories.find((c) => c.id === e.category_id)?.name || "Unknown";
      return {
        ...e,
        submittedBy: name,
        submittedByInitials: initials,
        submittedByTone: getTone(emp?.employee_code || name),
        categoryName: catName,
        isOwn: emp?.user_id === user?.id,
      };
    });
  }, [expenses, categories, user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mappedExpenses.filter((e) => {
      const matchSearch =
        !q || `${e.submittedBy} ${e.vendor_name} ${e.expense_number}`.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchCategory = categoryFilter === "all" || e.category_id === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [search, statusFilter, categoryFilter, mappedExpenses]);

  // Metrics (on filtered)
  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const approvedSum = filtered
    .filter((e) => e.status === "PAYMENT_PENDING" || e.status === "PAID")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingSum = filtered
    .filter((e) => ["SUBMITTED", "PENDING_OWNER_APPROVAL"].includes(e.status))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const rejectedSum = filtered
    .filter((e) => e.status.startsWith("REJECTED"))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Chart Data (aggregated by category)
  const expenseChartData = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      if (!map[e.categoryName]) {
        map[e.categoryName] = 0;
      }
      map[e.categoryName] += Number(e.amount);
    });
    return Object.keys(map)
      .map((k, i) => {
        const tones = ["cyan", "violet", "amber", "lime", "coral", "slate"];
        return {
          name: k,
          value: map[k],
          tone: tones[i % tones.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const dt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  // Actions
  const handleSaveExpense = async (data) => {
    setActionLoading(true);
    setActionError(null);
    try {
      if (selectedExpense) {
        // Edit
        const { error: rpcErr } = await supabase.rpc("update_expense", {
          p_expense_id: selectedExpense.id,
          p_category_id: data.p_category_id,
          p_vendor_name: data.p_vendor_name,
          p_invoice_number: data.p_invoice_number || null,
          p_description: data.p_description,
          p_amount: data.p_amount,
          p_expense_date: data.p_expense_date,
          p_currency: data.p_currency,
        });
        if (rpcErr) throw rpcErr;
        setFormOpen(false);
        setSelectedExpense(null);
      } else {
        // Create
        const { data: newExpense, error: rpcErr } = await supabase.rpc("create_expense", {
          p_category_id: data.p_category_id,
          p_vendor_name: data.p_vendor_name,
          p_invoice_number: data.p_invoice_number || null,
          p_description: data.p_description,
          p_amount: data.p_amount,
          p_expense_date: data.p_expense_date,
          p_currency: data.p_currency,
        });
        if (rpcErr) throw rpcErr;
        // Keep the dialog open, transition to Edit mode by setting the created expense
        setSelectedExpense(newExpense);
      }
      await fetchExpenses();
      toast({
        title: "Success",
        description: selectedExpense
          ? "Expense updated successfully."
          : "Expense created successfully.",
        variant: "default",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to save expense.",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmSubmitExpense = (expense) => {
    setConfirmState({ isOpen: true, type: "SUBMIT", payload: expense });
  };

  const executeSubmitExpense = async (expense) => {
    setActionLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc("submit_expense", {
        p_expense_id: expense.id,
      });
      if (rpcErr) throw rpcErr;
      await fetchExpenses(true);
      toast({ title: "Success", description: "Expense submitted successfully." });
      setConfirmState({ isOpen: false, type: null, payload: null });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit expense.",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteExpense = (expense) => {
    setConfirmState({ isOpen: true, type: "DELETE", payload: expense });
  };

  const executeDeleteExpense = async (expense) => {
    setActionLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc("delete_draft_expense", {
        p_expense_id: expense.id,
      });
      if (rpcErr) throw rpcErr;
      await fetchExpenses(true);
      toast({ title: "Success", description: "Expense deleted successfully." });
      setConfirmState({ isOpen: false, type: null, payload: null });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete expense.",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (expenseId, decision, remarks) => {
    setActionLoading(true);
    setActionError(null);
    try {
      if (profile.role === ROLES.ACCOUNTS) {
        const { error: rpcErr } = await supabase.rpc("review_expense_accounts", {
          p_expense_id: expenseId,
          p_decision: decision, // 'APPROVE', 'REJECT', 'RETURN'
          p_remarks: remarks || null,
        });
        if (rpcErr) throw rpcErr;
      } else if (profile.role === ROLES.OWNER) {
        const { error: rpcErr } = await supabase.rpc("review_expense_owner", {
          p_expense_id: expenseId,
          p_approve: decision === "APPROVE",
          p_remarks: remarks || null,
        });
        if (rpcErr) throw rpcErr;
      }
      setReviewOpen(false);
      setReviewExpense(null);
      await fetchExpenses(true);
      toast({ title: "Success", description: "Expense review processed successfully." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to review expense.",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (expenseId, data) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("record_payment", {
        p_expense_id: expenseId,
        ...data,
      });
      if (rpcErr) throw rpcErr;
      setPaymentOpen(false);
      setPaymentExpense(null);
      await fetchExpenses(true);
      toast({ title: "Success", description: "Payment recorded successfully." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to record payment.",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getUniqueStatuses = () => {
    const s = new Set(mappedExpenses.map((e) => e.status));
    return Array.from(s).sort();
  };

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <p>{error}</p>
        </div>
      )}

      {/* Summary */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Expense summary">
        {[
          { label: "Total Shown", value: fmt(totalExpenses), tone: "cyan" },
          { label: "Approved / Paid", value: fmt(approvedSum), tone: "lime" },
          { label: "Pending Review", value: fmt(pendingSum), tone: "amber" },
          { label: "Rejected", value: fmt(rejectedSum), tone: "coral" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p
              className={`font-display text-xl font-black leading-none tracking-tight text-foreground`}
            >
              {loading ? "-" : s.value}
            </p>
            <p className={`mt-2 text-sm font-medium hr-tone-${s.tone}`}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Chart */}
      {expenseChartData.length > 0 && (
        <div className="hr-card">
          <div className="flex items-center gap-2 mb-5">
            <span className="hr-section-index hr-tone-violet">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Expenses by Category
            </h2>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expenseChartData}
                layout="vertical"
                margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--hr-line-soft)"
                  strokeDasharray="3 3"
                />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={98}
                  tick={{ fill: "var(--hr-muted)", fontSize: 10 }}
                />
                <Tooltip cursor={{ fill: "var(--hr-surface-muted)" }} formatter={(v) => fmt(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {expenseChartData.map((item) => (
                    <Cell key={item.name} fill={`var(--hr-${item.tone})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bills table */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-coral">02</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              All Expenses
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchExpenses(true)}
              disabled={loading || isRefreshing}
              title="Refresh"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            {profile?.role === ROLES.EMPLOYEE && (
              <Button
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                onClick={() => {
                  setSelectedExpense(null);
                  setActionError(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" /> New Expense
              </Button>
            )}
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search expenses"
                placeholder="Name, vendor, ID…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[155px] text-xs">
                <SelectValue placeholder="Category: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Category: All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                {getUniqueStatuses().map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px] relative">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Loading expenses...</p>
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
              <table className="hr-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Submitted By</th>
                    <th>Expense ID</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => (
                    <tr key={exp.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 rounded-xl">
                            <AvatarFallback
                              className={`hr-avatar ${toneClass(exp.submittedByTone)}`}
                            >
                              {exp.submittedByInitials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{exp.submittedBy}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {exp.expense_number}
                      </td>
                      <td className="text-xs">{exp.vendor_name}</td>
                      <td>{exp.categoryName}</td>
                      <td className="font-display font-bold text-foreground">{fmt(exp.amount)}</td>
                      <td className="text-xs">{dt(exp.expense_date)}</td>
                      <td>
                        <Badge
                          className={`hr-status-badge hr-tone-${statusToneMap[exp.status] ?? "cyan"}`}
                        >
                          <span className="hr-mini-dot" /> {statusLabel[exp.status] ?? exp.status}
                        </Badge>
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-9 min-w-9"
                              aria-label="More options"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setDetailsExpense(exp);
                                setDetailsOpen(true);
                              }}
                            >
                              View Details
                            </DropdownMenuItem>

                            {/* Employee Actions */}
                            {exp.isOwn &&
                              (exp.status === "DRAFT" ||
                                exp.status === "RETURNED_FOR_CORRECTION") && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedExpense(exp);
                                      setFormOpen(true);
                                    }}
                                  >
                                    {exp.status === "DRAFT" ? "Edit Draft" : "Edit Expense"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => confirmSubmitExpense(exp)}>
                                    {exp.status === "DRAFT" ? "Submit" : "Resubmit"}
                                  </DropdownMenuItem>
                                </>
                              )}
                            {exp.isOwn && exp.status === "DRAFT" && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => confirmDeleteExpense(exp)}
                              >
                                Delete Draft
                              </DropdownMenuItem>
                            )}

                            {/* Accounts Actions */}
                            {profile?.role === ROLES.ACCOUNTS && exp.status === "SUBMITTED" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setReviewExpense(exp);
                                  setActionError(null);
                                  setReviewOpen(true);
                                }}
                              >
                                Review (Accounts)
                              </DropdownMenuItem>
                            )}
                            {profile?.role === ROLES.ACCOUNTS &&
                              exp.status === "PAYMENT_PENDING" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setPaymentExpense(exp);
                                    setActionError(null);
                                    setPaymentOpen(true);
                                  }}
                                >
                                  Record Payment
                                </DropdownMenuItem>
                              )}

                            {/* Owner Actions */}
                            {profile?.role === ROLES.OWNER &&
                              exp.status === "PENDING_OWNER_APPROVAL" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setReviewExpense(exp);
                                    setActionError(null);
                                    setReviewOpen(true);
                                  }}
                                >
                                  Review (Owner)
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length === 0 && !loading && (
            <EmptyState
              icon={WalletCards}
              title="No expenses found"
              subtitle="Adjust your filters or create a new expense."
            />
          )}
        </div>
      </section>

      {/* Modals */}
      <ExpenseFormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        expense={selectedExpense}
        categories={categories}
        onSubmit={handleSaveExpense}
        loading={actionLoading}
        error={actionError}
      />

      <ExpenseDetailsDialog
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        expense={detailsExpense}
        categories={categories}
      />

      <ExpenseReviewDialog
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        expense={reviewExpense}
        role={profile?.role}
        categories={categories}
        onReview={handleReview}
        loading={actionLoading}
        error={actionError}
      />

      <PaymentRecordDialog
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        expense={paymentExpense}
        onSubmit={handleRecordPayment}
        loading={actionLoading}
        error={actionError}
      />

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen && !actionLoading)
            setConfirmState({ isOpen: false, type: null, payload: null });
        }}
        title={confirmState.type === "SUBMIT" ? "Submit Expense" : "Delete Draft"}
        description={
          confirmState.type === "SUBMIT"
            ? "Are you sure you want to submit this expense? No further edits will be possible unless it is returned for correction."
            : "Are you sure you want to delete this draft expense? All associated documents will also be deleted."
        }
        confirmText={confirmState.type === "SUBMIT" ? "Submit" : "Delete"}
        onConfirm={() => {
          if (confirmState.type === "SUBMIT") executeSubmitExpense(confirmState.payload);
          else if (confirmState.type === "DELETE") executeDeleteExpense(confirmState.payload);
        }}
        loading={actionLoading}
      />
    </main>
  );
}
