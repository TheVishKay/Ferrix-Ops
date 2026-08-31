import { useMemo, useState } from "react";
import { Cell, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MoreHorizontal, Search, WalletCards } from "lucide-react";

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

import { expenses, expenseChartData, expenseStatuses, expenseCategories } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;

const statusToneMap = {
  DRAFT: "slate",
  SUBMITTED: "cyan",
  UNDER_REVIEW: "amber",
  APPROVED: "lime",
  REJECTED: "coral",
  PAYMENT_PENDING: "violet",
  PAID: "lime",
};

const statusLabel = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAYMENT_PENDING: "Pmt. Pending",
  PAID: "Paid",
};

export default function BillsExpenses() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchSearch = !q || `${e.submittedBy} ${e.vendor} ${e.id}`.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchCategory = categoryFilter === "all" || e.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [search, statusFilter, categoryFilter]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID");
  const approvedSum = approved.reduce((sum, e) => sum + e.amount, 0);
  const pendingSum = expenses
    .filter((e) => ["SUBMITTED", "UNDER_REVIEW"].includes(e.status))
    .reduce((sum, e) => sum + e.amount, 0);
  const rejectedSum = expenses
    .filter((e) => e.status === "REJECTED")
    .reduce((sum, e) => sum + e.amount, 0);

  const fmt = (n) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Summary */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Expense summary">
        {[
          { label: "Total This Month", value: fmt(totalExpenses), tone: "cyan" },
          { label: "Approved / Paid", value: fmt(approvedSum), tone: "lime" },
          { label: "Pending Review", value: fmt(pendingSum), tone: "amber" },
          { label: "Rejected", value: fmt(rejectedSum), tone: "coral" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p className={`font-display text-xl font-black leading-none tracking-tight text-foreground`}>
              {s.value}
            </p>
            <p className={`mt-2 text-sm font-medium hr-tone-${s.tone}`}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Chart */}
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
              <CartesianGrid horizontal={false} stroke="var(--hr-line-soft)" strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={98}
                tick={{ fill: "var(--hr-muted)", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "var(--hr-surface-muted)" }}
                formatter={(v) => fmt(v)}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                {expenseChartData.map((item) => (
                  <Cell key={item.name} fill={`var(--hr-${item.tone})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search expenses"
                placeholder="Name, vendor…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[155px] text-xs">
                <SelectValue placeholder="Category: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Category: All</SelectItem>
                {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                {expenseStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
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
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 rounded-xl">
                        <AvatarFallback className={`hr-avatar ${toneClass(exp.submittedByTone)}`}>
                          {exp.submittedByInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{exp.submittedBy}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{exp.id}</td>
                  <td className="text-xs">{exp.vendor}</td>
                  <td>{exp.category}</td>
                  <td className="font-display font-bold text-foreground">{fmt(exp.amount)}</td>
                  <td className="text-xs">{exp.date}</td>
                  <td>
                    <Badge className={`hr-status-badge hr-tone-${statusToneMap[exp.status] ?? "cyan"}`}>
                      <span className="hr-mini-dot" /> {statusLabel[exp.status] ?? exp.status}
                    </Badge>
                  </td>
                  <td>
                    <Button variant="ghost" size="icon" className="min-h-9 min-w-9" aria-label="More options">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={WalletCards} title="No expenses found" subtitle="Adjust your filters." />
          )}
        </div>
      </section>
    </main>
  );
}
