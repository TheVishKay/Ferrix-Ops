import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExpenseDocuments from "./ExpenseDocuments";

export default function ExpenseReviewDialog({
  isOpen,
  onClose,
  expense,
  categories,
  role,
  onReview,
  loading,
  error,
}) {
  const [remarks, setRemarks] = useState("");

  if (!isOpen || !expense) return null;

  const categoryName = categories.find((c) => c.id === expense.category_id)?.name || "Unknown";
  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const dt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const handleAction = (decision) => {
    onReview(expense.id, decision, remarks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background w-full max-w-3xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">Review Expense</h2>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {expense.expense_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
            disabled={loading}
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          {/* Expense Details Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-muted/10 p-4 rounded-lg border border-border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Amount
              </p>
              <p className="font-display font-bold text-foreground">
                {fmt(expense.amount)} {expense.currency}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Date
              </p>
              <p className="text-sm font-medium text-foreground">{dt(expense.expense_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Category
              </p>
              <p className="text-sm text-foreground">{categoryName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Vendor
              </p>
              <p className="text-sm text-foreground">{expense.vendor_name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="text-sm text-foreground">{expense.description}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Invoice Number
              </p>
              <p className="text-sm text-foreground">{expense.invoice_number || "—"}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <ExpenseDocuments
              expenseId={expense.id}
              expenseStatus={expense.status}
              readOnly={true}
            />
          </div>

          {/* Review Actions Form */}
          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Review Remarks</h3>
            <textarea
              className="w-full min-h-[80px] p-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add remarks or rejection reason (required for Reject/Return)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex flex-wrap justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          {role === "ACCOUNTS" && (
            <>
              <Button
                variant="outline"
                className="border-[var(--hr-amber)]/50 text-[var(--hr-amber)] hover:bg-[var(--hr-amber)]/10"
                disabled={loading || !remarks.trim()}
                onClick={() => handleAction("RETURN")}
              >
                {loading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 size-4" />
                )}
                Return for Correction
              </Button>
            </>
          )}

          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={loading || !remarks.trim()}
            onClick={() => handleAction("REJECT")}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 size-4" />
            )}
            Reject
          </Button>

          <Button
            className="bg-[var(--hr-lime)] text-lime-950 hover:bg-[var(--hr-lime)]/90"
            disabled={loading}
            onClick={() => handleAction("APPROVE")}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
