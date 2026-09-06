import { useState, useEffect } from "react";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ExpenseDocuments from "./ExpenseDocuments";

export default function ExpenseFormDialog({
  isOpen,
  onClose,
  onSubmit,
  expense,
  categories,
  loading,
  error,
}) {
  const [formData, setFormData] = useState({
    p_category_id: "",
    p_vendor_name: "",
    p_invoice_number: "",
    p_description: "",
    p_amount: "",
    p_expense_date: "",
    p_currency: "INR",
  });

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setFormData({
          p_category_id: expense.category_id || "",
          p_vendor_name: expense.vendor_name || "",
          p_invoice_number: expense.invoice_number || "",
          p_description: expense.description || "",
          p_amount: expense.amount ? expense.amount.toString() : "",
          p_expense_date: expense.expense_date || "",
          p_currency: expense.currency || "INR",
        });
      } else {
        setFormData({
          p_category_id: "",
          p_vendor_name: "",
          p_invoice_number: "",
          p_description: "",
          p_amount: "",
          p_expense_date: new Date().toISOString().split("T")[0],
          p_currency: "INR",
        });
      }
    }
  }, [isOpen, expense]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      p_amount: parseFloat(formData.p_amount),
    });
  };

  const isEdit = !!expense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold font-display text-foreground">
            {isEdit ? "Edit Expense" : "New Expense"}
          </h2>
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

          {isEdit &&
            (expense.accounts_remarks || expense.owner_remarks || expense.rejection_reason) && (
              <div className="mb-6 bg-muted/30 border border-border p-4 rounded-lg space-y-4">
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

          <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category *</label>
              <Select
                value={formData.p_category_id}
                onValueChange={(val) => handleChange("p_category_id", val)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Vendor Name *</label>
                <Input
                  required
                  placeholder="Vendor"
                  value={formData.p_vendor_name}
                  onChange={(e) => handleChange("p_vendor_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Invoice Number</label>
                <Input
                  placeholder="Optional"
                  value={formData.p_invoice_number}
                  onChange={(e) => handleChange("p_invoice_number", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description *</label>
              <Input
                required
                placeholder="Expense description"
                value={formData.p_description}
                onChange={(e) => handleChange("p_description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Amount *</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.p_amount}
                  onChange={(e) => handleChange("p_amount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Currency *</label>
                <Select
                  value={formData.p_currency}
                  onValueChange={(val) => handleChange("p_currency", val)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Expense Date *</label>
              <Input
                required
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={formData.p_expense_date}
                onChange={(e) => handleChange("p_expense_date", e.target.value)}
              />
            </div>
          </form>

          {isEdit ? (
            (expense.status === "DRAFT" || expense.status === "RETURNED_FOR_CORRECTION") && (
              <div className="mt-8 border-t border-border pt-6">
                <ExpenseDocuments expenseId={expense.id} expenseStatus={expense.status} />
              </div>
            )
          ) : (
            <div className="mt-8 border-t border-border pt-6">
              <h4 className="text-sm font-semibold text-foreground mb-4">Documents</h4>
              <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-md text-center border border-border border-dashed">
                Save the expense as a draft before uploading documents.
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/20 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {isEdit ? "Close" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="expense-form"
            disabled={
              loading ||
              !formData.p_category_id ||
              !formData.p_vendor_name ||
              !formData.p_description ||
              !formData.p_amount ||
              !formData.p_expense_date
            }
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </div>
    </div>
  );
}
