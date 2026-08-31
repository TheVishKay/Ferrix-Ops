import { useMemo, useState } from "react";
import { MoreHorizontal, Search, UserPlus, Users } from "lucide-react";

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

import { employees, departments } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;

const statusTone = { Active: "lime", Inactive: "coral", "On Leave": "amber" };

export default function Employees() {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchSearch = !q || `${e.name} ${e.id} ${e.email}`.toLowerCase().includes(q);
      const matchDept = dept === "all" || e.department === dept;
      const matchStatus = status === "all" || e.status === status;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, dept, status]);

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Stats bar */}
      <section
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        aria-label="Employee summary"
      >
        {[
          { label: "Total Employees", value: employees.length, tone: "cyan" },
          { label: "Active", value: employees.filter((e) => e.status === "Active").length, tone: "lime" },
          { label: "On Leave", value: employees.filter((e) => e.status === "On Leave").length, tone: "amber" },
          { label: "Departments", value: departments.length, tone: "violet" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p className="font-display text-[32px] font-black leading-none tracking-tight text-foreground">
              {s.value}
            </p>
            <p className={`mt-2 text-sm font-medium hr-tone-${s.tone}`}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Table card */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-cyan">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Employee Directory
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search employees"
                placeholder="Name, ID, email…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <SelectValue placeholder="Department: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Department: All</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" className="gap-1.5">
              <UserPlus className="size-3.5" /> Add Employee
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="hr-table min-w-[820px]">
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Email</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 rounded-xl">
                        <AvatarFallback className={`hr-avatar ${toneClass(emp.tone)}`}>
                          {emp.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{emp.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{emp.id}</td>
                  <td>{emp.department}</td>
                  <td>{emp.designation}</td>
                  <td className="text-xs">{emp.email}</td>
                  <td className="text-xs">{emp.joiningDate}</td>
                  <td>
                    <Badge className={`hr-status-badge hr-tone-${statusTone[emp.status] ?? "cyan"}`}>
                      <span className="hr-mini-dot" />
                      {emp.status}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-9 min-w-9"
                      aria-label={`Options for ${emp.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Users}
              title="No employees found"
              subtitle="Try adjusting your search or filters."
            />
          )}
        </div>
      </section>
    </main>
  );
}
