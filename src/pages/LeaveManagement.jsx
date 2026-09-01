import { useMemo, useState } from "react";
import { CalendarDays, Check, Search, X } from "lucide-react";

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

import { leaveRequests } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;
const statusToneMap = { Pending: "amber", Approved: "lime", Rejected: "coral" };

export default function LeaveManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  // Local state to allow approve/reject actions in the UI
  const [localStatuses, setLocalStatuses] = useState({});

  const getStatus = (req) => localStatuses[req.id] ?? req.status;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaveRequests.filter((r) => {
      const currentStatus = localStatuses[r.id] ?? r.status;
      const matchSearch = !q || r.name.toLowerCase().includes(q);
      const matchStatus = status === "all" || currentStatus === status;
      const matchType = type === "all" || r.type === type;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, status, type, localStatuses]);

  const approve = (id) => setLocalStatuses((prev) => ({ ...prev, [id]: "Approved" }));
  const reject = (id) => setLocalStatuses((prev) => ({ ...prev, [id]: "Rejected" }));

  const pending = leaveRequests.filter(
    (r) => (localStatuses[r.id] ?? r.status) === "Pending",
  ).length;
  const approved = leaveRequests.filter(
    (r) => (localStatuses[r.id] ?? r.status) === "Approved",
  ).length;
  const rejected = leaveRequests.filter(
    (r) => (localStatuses[r.id] ?? r.status) === "Rejected",
  ).length;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Summary */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Leave summary">
        {[
          { label: "Total Requests", value: leaveRequests.length, tone: "cyan" },
          { label: "Pending", value: pending, tone: "amber" },
          { label: "Approved", value: approved, tone: "lime" },
          { label: "Rejected", value: rejected, tone: "coral" },
        ].map((s) => (
          <div key={s.label} className="hr-card hr-metric-card">
            <p
              className={`font-display text-[32px] font-black leading-none tracking-tight hr-tone-${s.tone}`}
            >
              {s.value}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Leave requests table */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-amber">01</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Leave Requests
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search leave requests"
                placeholder="Search…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue placeholder="Type: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                <SelectItem value="Annual Leave">Annual Leave</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[125px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="hr-table min-w-[820px]">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave ID</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Applied On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const currentStatus = getStatus(req);
                const isPending = currentStatus === "Pending";
                return (
                  <tr key={req.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 rounded-xl">
                          <AvatarFallback className={`hr-avatar ${toneClass(req.tone)}`}>
                            {req.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{req.name}</p>
                          <p className="text-[11px] text-muted-foreground">{req.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{req.id}</td>
                    <td>{req.type}</td>
                    <td className="text-xs">{req.from}</td>
                    <td className="text-xs">{req.to}</td>
                    <td>
                      <Badge className="hr-status-badge hr-tone-cyan">
                        <span className="hr-mini-dot" /> {req.days}d
                      </Badge>
                    </td>
                    <td className="text-xs">{req.appliedOn}</td>
                    <td>
                      <Badge
                        className={`hr-status-badge hr-tone-${statusToneMap[currentStatus] ?? "cyan"}`}
                      >
                        <span className="hr-mini-dot" /> {currentStatus}
                      </Badge>
                    </td>
                    <td>
                      {isPending ? (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                            onClick={() => approve(req.id)}
                            aria-label={`Approve ${req.name}'s leave`}
                          >
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                            onClick={() => reject(req.id)}
                            aria-label={`Reject ${req.name}'s leave`}
                          >
                            <X className="size-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No requests found"
              subtitle="Adjust your filters."
            />
          )}
        </div>
      </section>
    </main>
  );
}
