import { useMemo, useState, useEffect } from "react";
import { CheckSquare, Search, ArrowDown, Edit2, Trash2, Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE_MAP,
  TASK_PRIORITY_TONE_MAP,
  ALLOWED_EMPLOYEE_TRANSITIONS,
} from "@/constants/tasks";
import { EmptyState } from "@/components/shared";
import { useAuth } from "@/contexts/AuthContext";
import * as taskService from "@/services/taskService";
import { getEmployees } from "@/services/employeeService";

const toneClass = (t) => `hr-tone-${t}`;

const statusToneMap = TASK_STATUS_TONE_MAP;
const statusLabel = TASK_STATUS_LABELS;
const priorityToneMap = TASK_PRIORITY_TONE_MAP;
const taskStatuses = TASK_STATUSES;
const taskPriorities = TASK_PRIORITIES;

export default function Tasks() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isOwner = profile?.role === "OWNER";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [localTasks, setLocalTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingStatusTaskId, setUpdatingStatusTaskId] = useState(null);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedToId: "",
    priority: "MEDIUM",
    status: "CREATED",
    dueDate: "",
  });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [tasksRes, empRes] = await Promise.all([taskService.getTasks(), getEmployees()]);
        if (tasksRes.error) throw tasksRes.error;
        if (empRes.error) throw empRes.error;

        setLocalTasks(tasksRes.data);
        setEmployees(empRes.data);
      } catch (err) {
        console.error("Error loading tasks page data:", err);
        setError("Failed to load tasks.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOpenTaskModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({ ...task });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: "",
        description: "",
        assignedToId: "",
        priority: "MEDIUM",
        status: "CREATED",
        dueDate: "",
      });
    }
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      toast({
        title: "Validation error",
        description: "Task title is required.",
        variant: "destructive",
      });
      return;
    }
    if (!taskForm.assignedToId) {
      toast({
        title: "Validation error",
        description: "Please assign the task to an employee.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTask) {
        const res = await taskService.updateTask(editingTask.id, taskForm);
        if (res.error) {
          toast({
            title: "Error updating task",
            description: res.error.message || "Failed to update task",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Task updated",
          description: `"${taskForm.title}" was updated successfully.`,
        });
      } else {
        const res = await taskService.createTask(taskForm);
        if (res.error) {
          toast({
            title: "Error creating task",
            description: res.error.message || "Failed to create task",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Task created",
          description: `"${taskForm.title}" was created successfully.`,
        });
      }
      setIsTaskModalOpen(false);

      // Refresh task list
      setIsLoading(true);
      const tasksRes = await taskService.getTasks();
      if (!tasksRes.error) {
        setLocalTasks(tasksRes.data);
      }
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Since we are dragging from a filtered list, source.index and destination.index
    // refer to the filtered array. We must find their actual indices in localTasks.
    const draggedItem = filtered[source.index];
    const dropTargetItem = filtered[destination.index];

    if (!draggedItem || !dropTargetItem) return;

    const sourceAbsoluteIndex = localTasks.findIndex((t) => t.id === draggedItem.id);
    const destinationAbsoluteIndex = localTasks.findIndex((t) => t.id === dropTargetItem.id);

    if (sourceAbsoluteIndex === -1 || destinationAbsoluteIndex === -1) return;

    if (source.droppableId === destination.droppableId) {
      const newTasks = Array.from(localTasks);

      const [reorderedItem] = newTasks.splice(sourceAbsoluteIndex, 1);
      newTasks.splice(destinationAbsoluteIndex, 0, reorderedItem);

      // Optimistically update UI
      setLocalTasks(newTasks);

      // Calculate new position
      // To keep it simple and safe for floats:
      // If we move it to the very start: new position is the first item's position - 1000
      // If we move it to the very end: new position is the last item's position + 1000
      // If we move it between two items: new position is (prev + next) / 2
      let newPosition = 0;
      if (destinationAbsoluteIndex === 0) {
        newPosition = (newTasks[1]?.position || 1000) - 1000;
      } else if (destinationAbsoluteIndex === newTasks.length - 1) {
        newPosition = (newTasks[newTasks.length - 2]?.position || 0) + 1000;
      } else {
        const prevPosition = newTasks[destinationAbsoluteIndex - 1].position;
        const nextPosition = newTasks[destinationAbsoluteIndex + 1].position;
        newPosition = (prevPosition + nextPosition) / 2;
      }

      reorderedItem.position = newPosition;

      // Persist to Supabase
      const res = await taskService.updateTaskOrder([
        { id: reorderedItem.id, position: newPosition },
      ]);
      if (res.error) {
        console.error("Failed to update order", res.error);
        // Revert on failure
        const revertTasks = Array.from(newTasks);
        revertTasks.splice(destinationAbsoluteIndex, 1);
        revertTasks.splice(sourceAbsoluteIndex, 0, reorderedItem);
        setLocalTasks(revertTasks);
      }
    }
  };

  const handleDeleteClick = (task) => {
    if (!isOwner) return;
    setTaskToDelete(task);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      const res = await taskService.deleteTask(taskToDelete.id);
      if (res.error) {
        toast({
          title: "Error deleting task",
          description: res.error.message || "Failed to delete task",
          variant: "destructive",
        });
        return;
      }
      setLocalTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      toast({
        title: "Task deleted",
        description: `"${taskToDelete.title}" has been deleted.`,
      });
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete task",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    setUpdatingStatusTaskId(taskId);
    try {
      const res = await taskService.updateTaskStatus(taskId, newStatus);
      if (res.error) {
        toast({
          title: "Status update failed",
          description: res.error.message || "Unable to update task status",
          variant: "destructive",
        });
        return;
      }
      // Update local task status
      setLocalTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      toast({
        title: "Status updated",
        description: `Task status changed to ${statusLabel[newStatus] || newStatus}.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatusTaskId(null);
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
          { label: "Total Tasks", value: localTasks.length, tone: "cyan" },
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
            {isOwner && (
              <Button variant="default" size="sm" onClick={() => handleOpenTaskModal()}>
                + New Task
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto p-5">
          {isLoading && (
            <div className="p-12 text-center text-muted-foreground">Loading tasks...</div>
          )}
          {error && <div className="p-12 text-center text-destructive">{error}</div>}

          {!isLoading && !error && (
            <>
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex flex-col items-center pb-4 max-w-3xl mx-auto">
                  <div className="flex flex-col w-full bg-muted/10 rounded-xl p-4 border border-border">
                    <Droppable droppableId="tasks-list">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-0 min-h-[150px] transition-colors rounded-lg ${
                            snapshot.isDraggingOver ? "bg-muted/50" : ""
                          }`}
                        >
                          {filtered.map((task, index) => {
                            const designation = task.designationName || "Employee";
                            return (
                              <Draggable
                                key={task.id}
                                draggableId={task.id}
                                index={index}
                                isDragDisabled={!isOwner}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex flex-col items-center w-full"
                                    style={{
                                      ...provided.draggableProps.style,
                                    }}
                                  >
                                    <div
                                      className={`hr-card p-5 text-left w-full transition-shadow relative group ${
                                        snapshot.isDragging
                                          ? "shadow-lg ring-2 ring-primary/30 z-50 bg-background"
                                          : "shadow-sm hover:shadow-md bg-background"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <Badge
                                            className={`hr-status-badge ${toneClass(statusToneMap[task.status] ?? "slate")}`}
                                          >
                                            <span className="hr-mini-dot" />{" "}
                                            {statusLabel[task.status]}
                                          </Badge>
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] border-border bg-muted/30 ${toneClass(priorityToneMap[task.priority] ?? "cyan")}`}
                                          >
                                            Priority: {task.priority}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-[11px] text-muted-foreground">
                                            {task.id}
                                          </span>
                                          {isOwner && (
                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleOpenTaskModal(task)}
                                              >
                                                <Edit2 className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDeleteClick(task)}
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <h4 className="font-medium text-base text-foreground mb-1.5">
                                        {task.title}
                                      </h4>
                                      <p className="text-sm text-muted-foreground mb-4">
                                        {task.description}
                                      </p>
                                      <div className="flex flex-wrap gap-2 mb-4">
                                        {task.tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className="inline-block rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                      <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="size-8 rounded-md">
                                            <AvatarFallback
                                              className={`hr-avatar text-xs ${toneClass(task.assignedToTone)}`}
                                            >
                                              {task.assignedToInitials}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium text-foreground leading-none">
                                              {task.assignedTo}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground mt-1">
                                              {designation}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                            Due Date
                                          </span>
                                          <span className="text-xs font-medium text-foreground">
                                            {task.dueDate || "—"}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Employee Workflow Action */}
                                      {!isOwner && ALLOWED_EMPLOYEE_TRANSITIONS[task.status] && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            Action required:
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={updatingStatusTaskId === task.id}
                                            onClick={() =>
                                              handleStatusUpdate(
                                                task.id,
                                                ALLOWED_EMPLOYEE_TRANSITIONS[task.status]
                                                  .nextStatus,
                                              )
                                            }
                                            className="h-7 text-xs font-medium border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
                                          >
                                            {updatingStatusTaskId === task.id && (
                                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                            )}
                                            {ALLOWED_EMPLOYEE_TRANSITIONS[task.status].label}
                                          </Button>
                                        </div>
                                      )}

                                      {/* Owner Quick Review Actions for READY_FOR_REVIEW */}
                                      {isOwner && task.status === "READY_FOR_REVIEW" && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center justify-between">
                                          <span className="text-xs font-medium text-amber-500">
                                            Review pending:
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={updatingStatusTaskId === task.id}
                                              onClick={() =>
                                                handleStatusUpdate(task.id, "RETURNED")
                                              }
                                              className="h-7 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                            >
                                              {updatingStatusTaskId === task.id && (
                                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                              )}
                                              Return
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              disabled={updatingStatusTaskId === task.id}
                                              onClick={() =>
                                                handleStatusUpdate(task.id, "COMPLETED")
                                              }
                                              className="h-7 text-xs"
                                            >
                                              {updatingStatusTaskId === task.id && (
                                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                              )}
                                              Approve & Complete
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {index < filtered.length - 1 && (
                                      <div className="flex flex-col items-center justify-center py-2 text-border">
                                        <div className="w-px h-4 bg-border"></div>
                                        <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                                        <div className="w-px h-4 bg-border"></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
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
            </>
          )}
        </div>
        {/* Task Form Modal */}
        <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Task title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Task description"
                />
              </div>
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select
                  value={taskForm.assignedToId || undefined}
                  onValueChange={(val) => setTaskForm({ ...taskForm, assignedToId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(
                        (emp) =>
                          emp.employment_status === "ACTIVE" || emp.id === taskForm.assignedToId,
                      )
                      .map((emp) => {
                        const name =
                          `${emp.first_name || ""} ${emp.last_name || ""}`.trim() ||
                          "Unnamed Employee";
                        const code = emp.employee_code ? ` (${emp.employee_code})` : "";
                        return (
                          <SelectItem key={emp.id} value={emp.id}>
                            {name}
                            {code}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={taskForm.priority || undefined}
                    onValueChange={(val) => setTaskForm({ ...taskForm, priority: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskPriorities.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={taskForm.status || undefined}
                    onValueChange={(val) => setTaskForm({ ...taskForm, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsTaskModalOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} onClick={handleSaveTask}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Task"
        description={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete Task"
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
      />
    </main>
  );
}
