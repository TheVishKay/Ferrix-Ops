import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock3, Search } from "lucide-react";

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

import { attendanceRecords, attendanceChartData, departments } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;
const statusToneMap = { Present: "lime", Late: "amber", Absent: "coral", "On Leave": "violet" };

export default function Attendance() {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("This Week");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendanceRecords.filter((r) => {
      const matchSearch = !q || `${r.name} ${r.employeeId}`.toLowerCase().includes(q);
      const matchDept = dept === "all" || r.department === dept;
      const matchStatus = status === "all" || r.status === status;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, dept, status]);

  const chartData = attendanceChartData[range] ?? attendanceChartData["This Week"];
  const totalToday = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === "Present").length;
  const lateCount = attendanceRecords.filter((r) => r.status === "Late").length;
  const absentCount = attendanceRecords.filter((r) => r.status === "Absent").length;
  const leaveCount = attendanceRecords.filter((r) => r.status === "On Leave").length;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Summary cards */}
      <section
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        aria-label="Today's attendance summary"
      >
        {[
          { label: "Total Today", value: totalToday, tone: "cyan" },
          { label: "Present", value: presentCount, tone: "lime" },
          { label: "Late", value: lateCount, tone: "amber" },
          { label: "Absent / Leave", value: absentCount + leaveCount, tone: "coral" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p className="font-display text-[32px] font-black leading-none tracking-tight text-foreground">
              {s.value}
            </p>
            <p className={`mt-2 text-sm font-medium hr-tone-${s.tone}`}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Chart */}
      <div className="hr-card">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="hr-section-index hr-tone-cyan">01</span>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Attendance Overview
              </h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {[
                ["lime", "Present"],
                ["coral", "Absent"],
                ["amber", "Leave"],
              ].map(([tone, label]) => (
                <span key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`hr-dot hr-tone-${tone}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="hr-segmented" role="group" aria-label="Range">
            {["This Week", "This Month", "Custom"].map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                className={range === r ? "hr-segment-active" : ""}
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-6 h-64 w-full">
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

      {/* Attendance table */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-coral">02</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Today&apos;s Log
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search attendance"
                placeholder="Search…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[155px] text-xs">
                <SelectValue placeholder="Department: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Department: All</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
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
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="size-3.5" /> Jun 4, 2026
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="hr-table min-w-[760px]">
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Department</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
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
                    <Badge
                      className={`hr-status-badge hr-tone-${statusToneMap[row.status] ?? "cyan"}`}
                    >
                      <span className="hr-mini-dot" /> {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={Clock3} title="No records found" subtitle="Adjust your filters." />
          )}
        </div>
      </section>
    </main>
  );
}
