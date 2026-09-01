import { useMemo, useState } from "react";
import { CheckSquare, Search } from "lucide-react";

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

import { tasks, taskStatuses, taskPriorities } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;

const statusToneMap = {
  CREATED: "slate",
  ASSIGNED: "cyan",
  IN_PROGRESS: "amber",
  READY_FOR_REVIEW: "violet",
  RETURNED: "coral",
  COMPLETED: "lime",
  CANCELLED: "slate",
};

const statusLabel = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  READY_FOR_REVIEW: "For Review",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const priorityToneMap = { LOW: "slate", MEDIUM: "cyan", HIGH: "amber", URGENT: "coral" };

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.assignedTo}`.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [search, statusFilter, priorityFilter]);

  const countByStatus = (s) => tasks.filter((t) => t.status === s).length;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Summary */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Task summary">
        {[
          { label: "Total Tasks", value: tasks.length, tone: "cyan" },
          { label: "In Progress", value: countByStatus("IN_PROGRESS"), tone: "amber" },
          { label: "For Review", value: countByStatus("READY_FOR_REVIEW"), tone: "violet" },
          { label: "Completed", value: countByStatus("COMPLETED"), tone: "lime" },
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

      {/* Status pipeline */}
      <div className="hr-card">
        <div className="flex items-center gap-2 mb-5">
          <span className="hr-section-index hr-tone-cyan">01</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Pipeline Overview
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {taskStatuses.map((s) => {
            const count = countByStatus(s);
            const tone = statusToneMap[s] ?? "slate";
            return (
              <div key={s} className={`hr-expense-stat ${toneClass(tone)} min-w-[100px] flex-1`}>
                <p className={`font-display text-2xl font-black ${toneClass(tone)}`}>{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{statusLabel[s]}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks table */}
      <section className="hr-card p-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="hr-section-index hr-tone-violet">02</span>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              All Tasks
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hr-table-search">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tasks"
                placeholder="Title, assignee…"
                className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[145px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                {taskStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-[135px] text-xs">
                <SelectValue placeholder="Priority: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Priority: All</SelectItem>
                {taskPriorities.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="default" size="sm">
              + New Task
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="hr-table min-w-[860px]">
            <thead>
              <tr>
                <th>Task</th>
                <th>ID</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Tags</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {task.description}
                      </p>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{task.id}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 rounded-lg">
                        <AvatarFallback
                          className={`hr-avatar text-[10px] ${toneClass(task.assignedToTone)}`}
                        >
                          {task.assignedToInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.assignedTo}</span>
                    </div>
                  </td>
                  <td>
                    <Badge
                      className={`hr-status-badge ${toneClass(priorityToneMap[task.priority] ?? "cyan")}`}
                    >
                      <span className="hr-mini-dot" /> {task.priority}
                    </Badge>
                  </td>
                  <td className="text-xs">{task.dueDate}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge
                      className={`hr-status-badge ${toneClass(statusToneMap[task.status] ?? "cyan")}`}
                    >
                      <span className="hr-mini-dot" /> {statusLabel[task.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={CheckSquare} title="No tasks found" subtitle="Adjust your filters." />
          )}
        </div>
      </section>
    </main>
  );
}
