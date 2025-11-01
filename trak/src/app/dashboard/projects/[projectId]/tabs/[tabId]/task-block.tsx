"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, User, Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

type TaskStatus = "todo" | "in-progress" | "done";

interface Task {
  id: string | number;
  text: string;
  status: TaskStatus;
  assignee?: string;
  dueDate?: string;
}

interface TaskBlockProps {
  block: Block;
  onUpdate?: () => void;
}

export default function TaskBlock({ block, onUpdate }: TaskBlockProps) {
  const content = (block.content || {}) as { title?: string; tasks?: Task[] };
  const title = content.title || "New Task List";
  const tasks = content.tasks || [];

  const toggleTask = async (taskId: string | number) => {
    const newTasks = tasks.map((t: Task) => {
      if (t.id === taskId) {
        // Cycle: todo -> in-progress -> done -> todo
        if (t.status === "todo") return { ...t, status: "in-progress" as TaskStatus };
        if (t.status === "in-progress") return { ...t, status: "done" as TaskStatus };
        return { ...t, status: "todo" as TaskStatus };
      }
      return t;
    });

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const addTask = async () => {
    const newTask: Task = {
      id: Date.now(),
      text: "New task",
      status: "todo",
    };
    const newTasks = [...tasks, newTask];

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    if (status === "done") {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />;
    }
    if (status === "in-progress") {
      return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-500" />;
    }
    return <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />;
  };

  return (
    <div className="p-5">
      <div className="font-semibold text-neutral-900 dark:text-white mb-4">{title}</div>
      <div className="space-y-3">
        {tasks.map((task: Task) => (
          <div key={task.id} className="flex items-start gap-3">
            <button
              onClick={() => toggleTask(task.id)}
              className="mt-px shrink-0"
              aria-label={`Toggle task: ${task.text}`}
            >
              {getStatusIcon(task.status)}
            </button>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm leading-snug",
                  task.status === "done"
                    ? "line-through text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-900 dark:text-white"
                )}
              >
                {task.text}
              </div>
              {(task.assignee || task.dueDate) && (
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                  {task.assignee && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {task.assignee}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {task.dueDate}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={addTask}
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 mt-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>
    </div>
  );
}

