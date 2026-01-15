"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Calendar as CalendarIcon, Clock, Folder, Layers, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createBlock } from "@/app/actions/block";
import { createTaskItem } from "@/app/actions/tasks/item-actions";

interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTime?: string;
  workspaceId: string;
  onEventAdded?: () => void;
}

  interface Project {
    id: string;
    name: string;
    tabs?: Array<{
      id: string;
      name: string;
      children?: Array<any>;
    }>;
  }

export default function AddEventDialog({
  open,
  onClose,
  initialDate,
  initialTime,
  workspaceId,
  onEventAdded,
}: AddEventDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ? initialDate.toISOString().split("T")[0] : "");
  const [time, setTime] = useState(initialTime || "");
  const [projectId, setProjectId] = useState<string>("");
  const [tabId, setTabId] = useState<string>("");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low" | "none">("none");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    if (open && workspaceId) {
      fetchProjects();
    }
  }, [open, workspaceId]);

  // Reset form when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      if (initialDate) {
        setDate(initialDate.toISOString().split("T")[0]);
      }
      if (initialTime) {
        setTime(initialTime);
      }
    }
  }, [open, initialDate, initialTime]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`/api/projects`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  // Flatten tabs for display
  const flattenTabs = (tabs: Array<{ id: string; name: string; children?: Array<any> }>): Array<{ id: string; name: string }> => {
    const result: Array<{ id: string; name: string }> = [];
    const go = (tabList: Array<any>) => {
      tabList.forEach((tab) => {
        result.push({ id: tab.id, name: tab.name });
        if (tab.children && tab.children.length > 0) {
          go(tab.children);
        }
      });
    };
    go(tabs);
    return result;
  };

  const selectedProject = projects.find((p) => p.id === projectId);
  const availableTabs = selectedProject?.tabs ? flattenTabs(selectedProject.tabs) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!date) {
      setError("Date is required");
      return;
    }

    if (!projectId || !tabId) {
      setError("Please select a project and tab");
      return;
    }

    setLoading(true);

    try {
      // Create a task block and attach a task item with the due date/time
      const result = await createBlock({
        tabId: tabId,
        type: "task",
        content: {
          title: "Tasks",
          hideIcons: false,
        },
        position: 0,
        column: 0,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.data?.id) {
        const taskResult = await createTaskItem({
          taskBlockId: result.data.id,
          title: title.trim(),
          status: "todo",
          dueDate: date,
          dueTime: time || undefined,
          priority: priority !== "none" ? priority : undefined,
        });
        if ("error" in taskResult) {
          setError(taskResult.error);
          setLoading(false);
          return;
        }
      }

      // Success - close dialog and refresh
      setTitle("");
      setDate("");
      setTime("");
      setProjectId("");
      setTabId("");
      setPriority("none");
      setError(null);
      
      onEventAdded?.();
      onClose();
      
      // Optionally navigate to the task
      if (result.data?.id) {
        // Refresh the calendar
        router.refresh();
      }
    } catch (err) {
      setError("Failed to create event. Please try again.");
      console.error("Error creating event:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle("");
      setDate("");
      setTime("");
      setProjectId("");
      setTabId("");
      setPriority("none");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[var(--foreground)]">
            New Event
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--muted-foreground)] mt-1">
            Create a task with date and time
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setTabId(""); // Reset tab when project changes
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              required
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tab Selection */}
          {availableTabs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Tab
              </label>
              <select
                value={tabId}
                onChange={(e) => setTabId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                required
              >
                <option value="">Select tab</option>
                {availableTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border)] -mx-6 px-6 pb-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
