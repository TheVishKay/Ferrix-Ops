import { useMemo, useState, useEffect } from "react";
import { MoreHorizontal, Search, UserPlus, Users, Loader2 } from "lucide-react";

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

import { EmptyState } from "@/components/shared";
import { supabase } from "@/lib/supabase";

const toneClass = (t) => `hr-tone-${t}`;

const getTone = (str) => {
  const tones = ["cyan", "coral", "amber", "violet", "lime"];
  if (!str) return "cyan";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tones[Math.abs(hash) % tones.length];
};

const statusTone = { ACTIVE: "lime", INACTIVE: "coral", EXITED: "amber" };
const displayStatus = { ACTIVE: "Active", INACTIVE: "Inactive", EXITED: "Exited" };

export default function Employees() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [employeesData, setEmployeesData] = useState([]);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [deptRes, empRes] = await Promise.all([
          supabase.from("departments").select("id, name").order("name"),
          supabase
            .from("employees")
            .select(
              `
            id,
            employee_code,
            first_name,
            last_name,
            company_email,
            joining_date,
            employment_status,
            departments ( name ),
            designations ( name )
          `,
            )
            .order("created_at", { ascending: false }),
        ]);

        if (deptRes.error) throw new Error("Failed to fetch departments.");
        if (empRes.error) throw new Error("Failed to fetch employees.");

        if (mounted) {
          setDepartmentsData(deptRes.data || []);
          setEmployeesData(empRes.data || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "An unexpected error occurred while fetching data.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const mappedEmployees = useMemo(() => {
    return employeesData.map((emp) => {
      const name = `${emp.first_name} ${emp.last_name}`;
      const initials = `${emp.first_name[0] || ""}${emp.last_name[0] || ""}`.toUpperCase();
      const departmentName = emp.departments?.name || "Unknown";
      const designationName = emp.designations?.name || "Unknown";

      return {
        ...emp,
        name,
        initials,
        departmentName,
        designationName,
        tone: getTone(emp.employee_code),
      };
    });
  }, [employeesData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mappedEmployees.filter((e) => {
      const matchSearch =
        !q || `${e.name} ${e.employee_code} ${e.company_email}`.toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || e.departmentName === deptFilter;
      const matchStatus = statusFilter === "all" || e.employment_status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, deptFilter, statusFilter, mappedEmployees]);

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Stats bar */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Employee summary">
        {[
          { label: "Total Employees", value: employeesData.length, tone: "cyan" },
          {
            label: "Active",
            value: employeesData.filter((e) => e.employment_status === "ACTIVE").length,
            tone: "lime",
          },
          {
            label: "Inactive / Exited",
            value: employeesData.filter((e) => e.employment_status !== "ACTIVE").length,
            tone: "coral",
          },
          { label: "Departments", value: departmentsData.length, tone: "violet" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p className="font-display text-[32px] font-black leading-none tracking-tight text-foreground">
              {loading ? "-" : s.value}
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
                placeholder="Name, Code, email…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                disabled={loading || !!error}
              />
            </label>
            <Select value={deptFilter} onValueChange={setDeptFilter} disabled={loading || !!error}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <SelectValue placeholder="Department: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Department: All</SelectItem>
                {departmentsData.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              disabled={loading || !!error}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="EXITED">Exited</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" className="gap-1.5" disabled>
              <UserPlus className="size-3.5" /> Add Employee
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading employee directory...
              </p>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-2 text-center px-4">
              <div className="hr-icon-box hr-tone-coral mb-2 size-12">
                <Users className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Could not load employees</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <>
              <table className="hr-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Joining Date</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
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
                      <td className="font-mono text-xs text-muted-foreground">
                        {emp.employee_code}
                      </td>
                      <td>{emp.departmentName}</td>
                      <td>{emp.designationName}</td>
                      <td className="text-xs">{emp.company_email}</td>
                      <td className="text-xs">{emp.joining_date}</td>
                      <td>
                        <Badge
                          className={`hr-status-badge hr-tone-${statusTone[emp.employment_status] ?? "cyan"}`}
                        >
                          <span className="hr-mini-dot" />
                          {displayStatus[emp.employment_status] || emp.employment_status}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-9 min-w-9"
                          aria-label={`Options for ${emp.name}`}
                          disabled
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
            </>
          )}
        </div>
      </section>
    </main>
  );
}
