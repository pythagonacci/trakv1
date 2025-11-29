"use client";

import { useState, useTransition } from "react";
import { Plus, CheckCircle2, Circle, Clock, MoreHorizontal, Trash2 } from "lucide-react";
import { createStandaloneTask, updateStandaloneTask, deleteStandaloneTask, type StandaloneTask } from "@/app/actions/standalone-task";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/app/dashboard/theme-context";
import ConfirmDialog from "@/app/dashboard/projects/confirm-dialog";
import Toast from "@/app/dashboard/projects/toast";

interface TasksListProps {
  initialTasks: StandaloneTask[];
  workspaceId: string;
}

export default function TasksList({ initialTasks, workspaceId }: TasksListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isPending, startTransition] = useTransition();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<StandaloneTask | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { theme } = useTheme();

  const handleCreateTask = async () => {
    setIsCreating(true);
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: StandaloneTask = {
      id: tempId,
      workspace_id: workspaceId,
      text: "",
      status: "todo",
      priority: "none",
      assignees: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks([optimisticTask, ...tasks]);
    setEditingTaskId(tempId);
    setEditingText("");

    const result = await createStandaloneTask(workspaceId, { text: "" });

    if (result.error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setToast({ message: result.error, type: "error" });
      setIsCreating(false);
    } else if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === tempId ? result.data! : t)));
      setIsCreating(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<StandaloneTask>) => {
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );

    const result = await updateStandaloneTask(taskId, updates);

    if (result.error) {
      setTasks(previousTasks);
      setToast({ message: result.error, type: "error" });
    } else {
      if (result.data) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? result.data! : t))
        );
      }
    }
  };

  const handleDeleteTask = async (task: StandaloneTask) => {
    setDeletingTask(task);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;

    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));

    const result = await deleteStandaloneTask(deletingTask.id);

    if (result.error) {
      setTasks(previousTasks);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({ message: "Task deleted successfully", type: "success" });
    }

    setDeleteConfirmOpen(false);
    setDeletingTask(null);
  };

  const handleTextBlur = async (taskId: string) => {
    if (editingText.trim()) {
      await handleUpdateTask(taskId, { text: editingText.trim() });
    }
    setEditingTaskId(null);
    setEditingText("");
  };

  const handleTextKeyDown = async (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleTextBlur(taskId);
    } else if (e.key === "Escape") {
      setEditingTaskId(null);
      setEditingText("");
    }
  };

  const toggleTaskStatus = async (task: StandaloneTask) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await handleUpdateTask(task.id, { status: newStatus });
  };

  const getPriorityColor = (priority?: string) => {
    if (theme === "brutalist") {
      switch (priority) {
        case "urgent": return "text-white bg-[#dc2626]/70";
        case "high": return "text-white bg-[#f97316]/60";
        case "medium": return "text-white bg-[#3b82f6]/60";
        case "low": return "text-white bg-[#6b7280]/60";
        default: return "";
      }
    } else {
      switch (priority) {
        case "urgent": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
        case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
        case "medium": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
        case "low": return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300";
        default: return "";
      }
    }
  };

  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    date.setHours(0, 0, 0, 0);
    if (date.getTime() === today.getTime()) return "Today";
    if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const incompleteTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Tasks</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Manage your miscellaneous tasks.</p>
        </div>
        <Button onClick={handleCreateTask} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      {tasks.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface)]">
          <Circle className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            No tasks yet
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] text-center max-w-md mb-4">
            Create your first task to get started.
          </p>
          <Button onClick={handleCreateTask} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Incomplete Tasks */}
          {incompleteTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                Incomplete ({incompleteTasks.length})
              </h3>
              <div className="space-y-1">
                {incompleteTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isEditing={editingTaskId === task.id}
                    editingText={editingText}
                    onEditingTextChange={setEditingText}
                    onStartEdit={() => {
                      setEditingTaskId(task.id);
                      setEditingText(task.text);
                    }}
                    onBlur={() => handleTextBlur(task.id)}
                    onKeyDown={(e) => handleTextKeyDown(e, task.id)}
                    onToggleStatus={() => toggleTaskStatus(task)}
                    onDelete={() => handleDeleteTask(task)}
                    getPriorityColor={getPriorityColor}
                    formatDueDate={formatDueDate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                Completed ({completedTasks.length})
              </h3>
              <div className="space-y-1">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isEditing={editingTaskId === task.id}
                    editingText={editingText}
                    onEditingTextChange={setEditingText}
                    onStartEdit={() => {
                      setEditingTaskId(task.id);
                      setEditingText(task.text);
                    }}
                    onBlur={() => handleTextBlur(task.id)}
                    onKeyDown={(e) => handleTextKeyDown(e, task.id)}
                    onToggleStatus={() => toggleTaskStatus(task)}
                    onDelete={() => handleDeleteTask(task)}
                    getPriorityColor={getPriorityColor}
                    formatDueDate={formatDueDate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingTask(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${deletingTask?.text || "this task"}"? This action cannot be undone.`}
        confirmText="Delete Task"
        confirmButtonVariant="danger"
        isLoading={false}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}

interface TaskItemProps {
  task: StandaloneTask;
  isEditing: boolean;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onStartEdit: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  getPriorityColor: (priority?: string) => string;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
}

function TaskItem({
  task,
  isEditing,
  editingText,
  onEditingTextChange,
  onStartEdit,
  onBlur,
  onKeyDown,
  onToggleStatus,
  onDelete,
  getPriorityColor,
  formatDueDate,
}: TaskItemProps) {
  const isDone = task.status === "done";
  const dueDateText = formatDueDate(task.dueDate, task.dueTime);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors",
        isDone && "opacity-60"
      )}
    >
      <button
        onClick={onToggleStatus}
        className="flex-shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editingText}
            onChange={(e) => onEditingTextChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent border-none outline-none text-sm text-[var(--foreground)]"
            autoFocus
          />
        ) : (
          <button
            onClick={onStartEdit}
            className={cn(
              "text-sm text-left w-full",
              isDone ? "text-[var(--muted-foreground)] line-through" : "text-[var(--foreground)]"
            )}
          >
            {task.text || "Untitled task"}
          </button>
        )}

        {(task.priority && task.priority !== "none") || dueDateText ? (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.priority && task.priority !== "none" && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", getPriorityColor(task.priority))}>
                {task.priority}
              </span>
            )}
            {dueDateText && (
              <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dueDateText}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDelete} className="text-red-500">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

