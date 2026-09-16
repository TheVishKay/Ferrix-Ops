import { useMemo, useState } from "react";
import { CheckSquare, Search } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
import { supabase } from "@/lib/supabase";

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
  const [localTasks, setLocalTasks] = useState(tasks);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const draggedTask = localTasks.find((t) => t.id === draggableId);
    if (!draggedTask) return;

    const newStatus = destination.droppableId;

    if (source.droppableId !== newStatus) {
      // Optimistic update
      setLocalTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)),
      );

      try {
        // Persist the new status using the existing task service/backend if already present.
        // In the absence of a dedicated taskService, we interact with Supabase directly.
        // If the 'tasks' table doesn't exist yet (as it's a deferred feature), this will gracefully fail
        // without breaking the UI, but handles persistence where the backend table is present.
        await supabase.from("tasks").update({ status: newStatus }).eq("id", draggableId);
      } catch (error) {
        console.error("Failed to persist task status update:", error);
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localTasks.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.assignedTo}`.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [search, statusFilter, priorityFilter, localTasks]);

  const countByStatus = (s) => localTasks.filter((t) => t.status === s).length;

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
        <div className="overflow-x-auto p-5">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 min-w-[860px] pb-4">
              {taskStatuses.map((status) => {
                const columnTasks = filtered.filter((t) => t.status === status);
                return (
                  <div
                    key={status}
                    className="flex flex-col flex-1 min-w-[280px] bg-muted/30 rounded-xl p-3 border border-border"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-display text-sm font-semibold text-foreground">
                        {statusLabel[status]}
                      </h3>
                      <span className="flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold rounded-full size-5">
                        {columnTasks.length}
                      </span>
                    </div>
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-3 min-h-[150px] transition-colors rounded-lg ${
                            snapshot.isDraggingOver ? "bg-muted/50" : ""
                          }`}
                        >
                          {columnTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`hr-card p-4 text-left transition-shadow ${
                                    snapshot.isDragging
                                      ? "shadow-lg ring-1 ring-primary/20"
                                      : "shadow-sm hover:shadow-md"
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <Badge
                                      className={`hr-status-badge ${toneClass(priorityToneMap[task.priority] ?? "cyan")}`}
                                    >
                                      <span className="hr-mini-dot" /> {task.priority}
                                    </Badge>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      {task.id}
                                    </span>
                                  </div>
                                  <h4 className="font-medium text-sm text-foreground mb-1 line-clamp-2">
                                    {task.title}
                                  </h4>
                                  <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">
                                    {task.description}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {task.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-block rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="size-6 rounded-md">
                                        <AvatarFallback
                                          className={`hr-avatar text-[9px] ${toneClass(task.assignedToTone)}`}
                                        >
                                          {task.assignedToInitials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-[11px] font-medium text-foreground">
                                        {task.assignedTo}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {task.dueDate}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>

          {filtered.length === 0 && (
            <div className="py-12">
              <EmptyState
                icon={CheckSquare}
                title="No tasks found"
                subtitle="Adjust your filters."
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
