import { useState, useEffect } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PaymentRecordDialog({
  isOpen,
  onClose,
  expense,
  onSubmit,
  loading,
  error,
}) {
  const [formData, setFormData] = useState({
    p_payment_method: "",
    p_payment_date: "",
    p_transaction_reference: "",
    p_notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        p_payment_method: "",
        p_payment_date: new Date().toISOString().split("T")[0],
        p_transaction_reference: "",
        p_notes: "",
      });
    }
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(expense.id, {
      p_payment_method: formData.p_payment_method,
      p_payment_date: formData.p_payment_date,
      p_transaction_reference: formData.p_transaction_reference || null,
      p_notes: formData.p_notes || null,
    });
  };

  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">Record Payment</h2>
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

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          <div className="mb-6 bg-muted/20 p-4 rounded-lg text-center border border-border border-dashed">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Approved Amount
            </p>
            <p className="text-3xl font-display font-black text-foreground mt-1">
              {fmt(expense.amount)}{" "}
              <span className="text-lg text-muted-foreground">{expense.currency}</span>
            </p>
          </div>

          <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Payment Method *</label>
              <Select
                value={formData.p_payment_method}
                onValueChange={(val) => handleChange("p_payment_method", val)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Payment Date *</label>
              <Input
                required
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={formData.p_payment_date}
                onChange={(e) => handleChange("p_payment_date", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Transaction Reference</label>
              <Input
                placeholder="Optional external ref"
                value={formData.p_transaction_reference}
                onChange={(e) => handleChange("p_transaction_reference", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Notes</label>
              <textarea
                className="w-full min-h-[60px] p-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Optional notes..."
                value={formData.p_notes}
                onChange={(e) => handleChange("p_notes", e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={loading || !formData.p_payment_method || !formData.p_payment_date}
            className="bg-[var(--hr-lime)] text-lime-950 hover:bg-[var(--hr-lime)]/90"
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 size-4" />
            )}
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
