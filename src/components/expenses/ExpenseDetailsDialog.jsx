import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExpenseDocuments from "./ExpenseDocuments";
import { supabase } from "@/lib/supabase";

export default function ExpenseDetailsDialog({ isOpen, onClose, expense, categories }) {
  const [payment, setPayment] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    if (isOpen && expense?.status === "PAID") {
      const fetchPayment = async () => {
        setLoadingPayment(true);
        try {
          const { data, error } = await supabase
            .from("payments")
            .select("*")
            .eq("expense_id", expense.id)
            .single();
          if (!error && data) {
            setPayment(data);
          }
        } catch (e) {
          console.error("Failed to fetch payment:", e);
        } finally {
          setLoadingPayment(false);
        }
      };
      fetchPayment();
    } else {
      setPayment(null);
    }
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const categoryName = categories.find((c) => c.id === expense.category_id)?.name || "Unknown";

  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const dt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">Expense Details</h2>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {expense.expense_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </p>
              <Badge variant="outline" className="font-medium bg-muted/30">
                {expense.status.replace(/_/g, " ")}
              </Badge>
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Invoice Number
              </p>
              <p className="text-sm text-foreground">{expense.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="text-sm text-foreground">{expense.description}</p>
            </div>
          </div>

          {/* Workflow Remarks & Rejection Reasons */}
          {(expense.accounts_remarks || expense.owner_remarks || expense.rejection_reason) && (
            <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                Review Feedback
              </h3>

              {expense.rejection_reason && (
                <div>
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-foreground">{expense.rejection_reason}</p>
                </div>
              )}

              {expense.accounts_remarks && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Accounts Remarks
                  </p>
                  <p className="text-sm text-foreground">{expense.accounts_remarks}</p>
                </div>
              )}

              {expense.owner_remarks && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Owner Remarks
                  </p>
                  <p className="text-sm text-foreground">{expense.owner_remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment Details */}
          {expense.status === "PAID" && (
            <div className="bg-[var(--hr-lime)]/10 border border-[var(--hr-lime)]/20 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-lime-900 border-b border-[var(--hr-lime)]/20 pb-2">
                Payment Information
              </h3>
              {loadingPayment ? (
                <Loader2 className="size-4 animate-spin text-lime-700" />
              ) : payment ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide mb-1">
                      Reference
                    </p>
                    <p className="text-sm text-lime-950 font-mono">{payment.payment_reference}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide mb-1">
                      Method
                    </p>
                    <p className="text-sm text-lime-950">
                      {payment.payment_method.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide mb-1">
                      Date
                    </p>
                    <p className="text-sm text-lime-950">{dt(payment.payment_date)}</p>
                  </div>
                  {payment.transaction_reference && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide mb-1">
                        Transaction Ref
                      </p>
                      <p className="text-sm text-lime-950 font-mono">
                        {payment.transaction_reference}
                      </p>
                    </div>
                  )}
                  {payment.notes && (
                    <div className="col-span-2 sm:col-span-3 mt-1">
                      <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide mb-1">
                        Notes
                      </p>
                      <p className="text-sm text-lime-950">{payment.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Payment details not found.</p>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <ExpenseDocuments
              expenseId={expense.id}
              expenseStatus={expense.status}
              readOnly={true}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end shrink-0">
          <Button onClick={onClose} variant="default">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
