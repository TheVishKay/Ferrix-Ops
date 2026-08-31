import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Sparkles,
  SlidersHorizontal,
  Search,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  attendanceRecords,
  attendanceChartData,
  expenseChartData,
  activityItems,
} from "@/data/mockData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toneClass = (tone) => `hr-tone-${tone}`;

// ---------------------------------------------------------------------------
// Dashboard page — uses AppLayout (Sidebar + Header injected by parent)
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("This Week");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");

  const filteredRows = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return attendanceRecords.filter((row) => {
      const matchesSearch =
        !search || `${row.name} ${row.employeeId}`.toLowerCase().includes(search);
      const matchesDepartment = department === "all" || row.department === department;
      const matchesStatus = status === "all" || row.status === status;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [department, employeeSearch, status]);

  const chartData = attendanceChartData[range] ?? attendanceChartData["This Week"];

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <SummaryCards onNavigate={navigate} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AttendanceOverview range={range} onRangeChange={setRange} chartData={chartData} />
        <PendingActions onNavigate={navigate} />
      </section>

      <AttendanceTable
        rows={filteredRows}
        employeeSearch={employeeSearch}
        onEmployeeSearchChange={setEmployeeSearch}
        department={department}
        onDepartmentChange={setDepartment}
        status={status}
        onStatusChange={setStatus}
        onViewAll={() => navigate("/attendance")}
      />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ExpenseOverview />
        <RecentActivity />
        <QuickActions onNavigate={navigate} />
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
// Summary Cards
// ---------------------------------------------------------------------------
function SummaryCards({ onNavigate }) {
  const cards = [
    {
      label: "Total Employees",
      value: "48",
      helper: "Across 6 departments",
      trend: "+2 this month",
      icon: Users,
      tone: "cyan",
      to: "/employees",
    },
    {
      label: "Present Today",
      value: "41",
      helper: "85.4% of workforce",
      trend: "On track",
      icon: Check,
      tone: "lime",
      to: "/attendance",
    },
    {
      label: "Absent Today",
      value: "3",
      helper: "2 need a follow-up",
      trend: "6.2% of workforce",
      icon: X,
      tone: "coral",
      to: "/attendance",
    },
    {
      label: "On Leave",
      value: "4",
      helper: "1 returns tomorrow",
      trend: "8.3% of workforce",
      icon: CalendarDays,
      tone: "amber",
      to: "/leave-management",
    },
    {
      label: "Pending Bills",
      value: "7",
      helper: "Awaiting approval",
      trend: "Needs review",
      icon: WalletCards,
      tone: "coral",
      to: "/bills",
    },
    {
      label: "Monthly Expenses",
      value: "₹2,48,500",
      helper: "Compared with ₹2,38,700",
      trend: "+4.1%",
      icon: CircleDollarSign,
      tone: "amber",
      to: "/bills",
    },
  ];

  return (
    <section
      className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      aria-label="Workforce summary"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.label}
            className="hr-card hr-metric-card text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
            onClick={() => onNavigate(card.to)}
            aria-label={`Go to ${card.label}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`hr-icon-box ${toneClass(card.tone)}`}>
                <Icon className="size-[18px]" />
              </div>
              <Badge className={`hr-soft-badge ${toneClass(card.tone)}`}>
                <span className="hr-mini-dot" />
                {card.trend}
              </Badge>
            </div>
            <p className="font-display mt-4 truncate text-[28px] font-black leading-none tracking-tight text-foreground">
              {card.value}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground">{card.label}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{card.helper}</p>
          </button>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Attendance Overview
// ---------------------------------------------------------------------------
function AttendanceOverview({ range, onRangeChange, chartData }) {
  return (
    <div className="hr-card min-w-0 xl:col-span-2">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-cyan">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Attendance Overview
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Legend tone="lime" label="Present" />
            <Legend tone="coral" label="Absent" />
            <Legend tone="amber" label="Leave" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="hr-segmented" role="group" aria-label="Attendance range">
            {["This Week", "This Month", "Custom"].map((item) => (
              <Button
                key={item}
                variant="ghost"
                size="sm"
                className={range === item ? "hr-segment-active" : ""}
                onClick={() => onRangeChange(item)}
              >
                {item}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarDays className="size-3.5" />
            <span className="hidden sm:inline">02–08 Jun 2026</span>
            <span className="sm:hidden">Jun 02–08</span>
          </Button>
        </div>
      </div>
      <div className="mt-6 h-60 w-full" aria-label={`${range} attendance chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barGap={5}
            margin={{ top: 6, right: 4, left: -20, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--hr-line-soft)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--hr-muted)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--hr-muted)", fontSize: 10 }}
            />
            <Tooltip cursor={{ fill: "var(--hr-surface-muted)" }} />
            <Bar dataKey="present" stackId="a" fill="var(--hr-lime)" radius={[0, 0, 3, 3]} />
            <Bar dataKey="leave" stackId="a" fill="var(--hr-amber)" />
            <Bar dataKey="absent" stackId="a" fill="var(--hr-coral)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ tone, label }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`hr-dot ${toneClass(tone)}`} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pending Actions
// ---------------------------------------------------------------------------
function PendingActions({ onNavigate }) {
  const actions = [
    {
      title: "Leave Requests Pending",
      helper: "4 awaiting decision",
      count: "4",
      tone: "amber",
      icon: CalendarDays,
      to: "/leave-management",
    },
    {
      title: "Bills Awaiting Approval",
      helper: "7 in the queue",
      count: "7",
      tone: "coral",
      icon: WalletCards,
      to: "/bills",
    },
    {
      title: "Attendance Corrections",
      helper: "2 flagged for edit",
      count: "2",
      tone: "cyan",
      icon: Clock3,
      to: "/attendance",
    },
    {
      title: "Employee Documents",
      helper: "3 pending upload",
      count: "3",
      tone: "violet",
      icon: FileCheck2,
      to: "/employees",
    },
  ];

  return (
    <div className="hr-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="hr-section-index hr-tone-amber">02</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Pending Actions
          </h2>
        </div>
        <Badge className="hr-soft-badge hr-tone-amber">
          <span className="hr-mini-dot" />
          16 open
        </Badge>
      </div>
      <div className="mt-5 space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.title} className="hr-action-row">
              <div className={`hr-icon-box ${toneClass(action.tone)}`}>
                <Icon className="size-[17px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{action.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.helper}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label={`Review ${action.title}`}
                onClick={() => onNavigate(action.to)}
              >
                Review
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance Table
// ---------------------------------------------------------------------------
function AttendanceTable({
  rows,
  employeeSearch,
  onEmployeeSearchChange,
  department,
  onDepartmentChange,
  status,
  onStatusChange,
  onViewAll,
}) {
  return (
    <section className="hr-card p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="hr-section-index hr-tone-coral">03</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Today&apos;s Attendance
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="hr-table-search">
            <Search className="size-3.5 text-muted-foreground" />
            <Input
              value={employeeSearch}
              onChange={(event) => onEmployeeSearchChange(event.target.value)}
              aria-label="Search attendance"
              placeholder="Search…"
              className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
            />
          </label>
          <Select value={department} onValueChange={onDepartmentChange}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Department: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Department: All</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Operations">Operations</SelectItem>
              <SelectItem value="Human Resources">Human Resources</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9 w-[125px] text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="Present">Present</SelectItem>
              <SelectItem value="Late">Late</SelectItem>
              <SelectItem value="Absent">Absent</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewAll}>
            View All <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="hr-table min-w-[760px]">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Department</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 rounded-xl">
                      <AvatarFallback className={`hr-avatar ${toneClass(row.tone)}`}>
                        {row.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{row.name}</span>
                  </div>
                </td>
                <td className="font-mono text-xs text-muted-foreground">{row.employeeId}</td>
                <td>{row.department}</td>
                <td>{row.checkIn}</td>
                <td>{row.checkOut}</td>
                <td>{row.hours}</td>
                <td>
                  <AttStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No attendance records match these filters.
          </p>
        )}
      </div>
    </section>
  );
}

function AttStatusBadge({ status }) {
  const tone = { Present: "lime", Late: "amber", Absent: "coral", "On Leave": "violet" };
  return (
    <Badge className={`hr-status-badge ${toneClass(tone[status] || "cyan")}`}>
      <span className="hr-mini-dot" />
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Expense Overview
// ---------------------------------------------------------------------------
function ExpenseOverview() {
  return (
    <div className="hr-card min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="hr-section-index hr-tone-violet">04</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Expense Overview
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-9 min-w-9"
          aria-label="Expense overview options"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ExpenseStat label="This Month" value="₹2,48,500" tone="cyan" />
        <ExpenseStat label="Approved" value="₹1,84,200" tone="lime" />
        <ExpenseStat label="Pending" value="₹47,300" tone="amber" />
        <ExpenseStat label="Rejected" value="₹17,000" tone="coral" />
      </div>
      <div className="mt-5 h-48 w-full" aria-label="Expenses by category chart">
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
              formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
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
  );
}

function ExpenseStat({ label, value, tone }) {
  return (
    <div className={`hr-expense-stat ${toneClass(tone)}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display mt-1 truncate text-lg font-black tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------
function RecentActivity() {
  return (
    <div className="hr-card min-w-0">
      <div className="flex items-center gap-2">
        <span className="hr-section-index hr-tone-cyan">05</span>
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Recent Activity
        </h2>
      </div>
      <div className="mt-5 space-y-4">
        {activityItems.map((item, index) => (
          <div key={item.text} className="flex gap-3">
            <Avatar className="size-9 shrink-0 rounded-xl">
              <AvatarFallback className={`hr-avatar ${toneClass(item.tone)}`}>
                {item.initials}
              </AvatarFallback>
            </Avatar>
            <div
              className={`min-w-0 flex-1 ${index < activityItems.length - 1 ? "border-b border-border pb-4" : ""}`}
            >
              <p className="text-sm leading-5 text-muted-foreground">{item.text}</p>
              <p className="mt-1 text-xs text-muted-foreground/75">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------
function QuickActions({ onNavigate }) {
  const actions = [
    { label: "Add Employee", helper: "New hire onboarding", icon: UserPlus, tone: "coral", to: "/employees" },
    { label: "Mark Attendance", helper: "Log today's presence", icon: Clock3, tone: "cyan", to: "/attendance" },
    { label: "Review Bills", helper: "7 awaiting approval", icon: WalletCards, tone: "amber", to: "/bills" },
    { label: "Review Leave", helper: "4 requests pending", icon: CalendarDays, tone: "lime", to: "/leave-management" },
  ];

  return (
    <div className="hr-card min-w-0">
      <div className="flex items-center gap-2">
        <span className="hr-section-index hr-tone-coral">06</span>
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Quick Actions
        </h2>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant="outline"
              className={`hr-quick-action ${toneClass(action.tone)}`}
              onClick={() => onNavigate(action.to)}
            >
              <Icon className="size-5" />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {action.label}
                </span>
                <span className="mt-1 block truncate text-[11px] font-normal text-muted-foreground">
                  {action.helper}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
