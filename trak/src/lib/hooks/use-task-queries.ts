import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
  reorderTaskItems,
  setTaskSyncModeForBlock,
} from "@/app/actions/tasks/item-actions";
import { createTaskSubtask, updateTaskSubtask, deleteTaskSubtask, reorderSubtasks } from "@/app/actions/tasks/subtask-actions";
import { createTaskComment, updateTaskComment, deleteTaskComment } from "@/app/actions/tasks/comment-actions";
import { setTaskTags } from "@/app/actions/tasks/tag-actions";
import { setTaskAssignees } from "@/app/actions/tasks/assignee-actions";
import { createTaskReference, deleteTaskReference, listTaskReferenceSummaries } from "@/app/actions/tasks/reference-actions";
import {
  createSubtaskReference,
  deleteSubtaskReference,
  listSubtaskReferenceSummaries,
} from "@/app/actions/tasks/subtask-reference-actions";
import type { TaskItemView, TaskBlockBundle } from "@/app/actions/tasks/query-actions";
import { queryKeys } from "@/lib/react-query/query-client";
import type { TaskItem, TaskSubtask } from "@/types/task";
import {
  buildClientPerfHeaders,
  getCurrentPerfNavigationId,
  logClientInvalidation,
  logClientPerf,
} from "@/lib/perf/perf-trace";

const taskKeys = {
  items: (blockId: string) => ["taskItems", blockId] as const,
  references: (taskId: string) => ["taskReferences", taskId] as const,
  subtaskReferences: (subtaskId: string) => ["subtaskReferences", subtaskId] as const,
};

function invalidateWithPerf(
  qc: ReturnType<typeof useQueryClient>,
  scope: string,
  filters: Parameters<ReturnType<typeof useQueryClient>["invalidateQueries"]>[0]
) {
  const safeFilters = filters ?? {};
  logClientInvalidation(scope, Array.isArray(safeFilters.queryKey) ? safeFilters.queryKey : ["unknown"]);
  return qc.invalidateQueries(safeFilters);
}

let optimisticSequence = 0;

function createOptimisticId(prefix: string): string {
  optimisticSequence += 1;
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${optimisticSequence}`;
  return `${prefix}-${randomPart}`;
}

function getTaskViewClientKey(task: Pick<TaskItemView, "id" | "clientKey">): string {
  return String(task.clientKey ?? task.id);
}

function dedupeTaskViews(tasks: TaskItemView[]): TaskItemView[] {
  const seen = new Set<string>();
  const deduped: TaskItemView[] = [];
  for (const task of tasks) {
    const key = getTaskViewClientKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(task);
  }
  return deduped;
}

type TaskReferenceSummary = Extract<Awaited<ReturnType<typeof listTaskReferenceSummaries>>, { data: unknown }> extends { data: infer T } ? T : never;
type SubtaskReferenceSummary = Extract<Awaited<ReturnType<typeof listSubtaskReferenceSummaries>>, { data: unknown }> extends { data: infer T } ? T : never;

function isOptimisticTask(task: Pick<TaskItemView, "id" | "clientKey">): boolean {
  return String(task.clientKey ?? task.id).startsWith("optimistic-");
}

function isOptimisticSubtask(subtask: NonNullable<TaskItemView["subtasks"]>[number]): boolean {
  return String(subtask.clientKey ?? subtask.id).startsWith("optimistic-subtask-");
}

function toTaskSubtaskView(subtask: TaskSubtask): NonNullable<TaskItemView["subtasks"]>[number] {
  return {
    id: subtask.id,
    text: subtask.title,
    description: subtask.description ?? undefined,
    completed: subtask.completed,
  };
}

function toTaskItemView(task: TaskItem): TaskItemView {
  return {
    id: task.id,
    text: task.title,
    statuses: (task.statuses ?? [])
      .filter((status): status is { field_name: string; value: "todo" | "in_progress" | "blocked" | "done" } => Boolean(status.value))
      .map((status) => ({
        field_name: status.field_name,
        value: status.value,
      })),
    priorities: task.priorities ?? [],
    sourceTaskId: task.source_task_id ?? null,
    sourceEntityType: task.source_entity_type ?? null,
    sourceEntityId: task.source_entity_id ?? null,
    sourceSyncMode: task.source_sync_mode ?? "live",
    dueDate: task.due_date ?? undefined,
    dueTime: task.due_time ?? undefined,
    dueTimeEnd: task.due_time_end ?? undefined,
    startDate: task.start_date ?? undefined,
    description: task.description ?? undefined,
    recurring: {
      enabled: Boolean(task.recurring_enabled),
      frequency: task.recurring_frequency ?? null,
      interval: task.recurring_interval ?? null,
    },
    hideIcons: task.hide_icons,
    subtasks: [],
    comments: [],
  };
}

export function useTaskItems(
  blockId: string,
  options?: { enabled?: boolean; publicToken?: string }
) {
  const qc = useQueryClient();
  const publicToken = options?.publicToken;
  const queryKey = publicToken
    ? [...taskKeys.items(blockId), "public", publicToken]
    : taskKeys.items(blockId);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const basePath = publicToken ? "/api/client-task-blocks" : "/api/task-blocks";
      const url = publicToken
        ? `${basePath}/${blockId}/items?publicToken=${encodeURIComponent(publicToken)}`
        : `${basePath}/${blockId}/items`;
      const navigationId = getCurrentPerfNavigationId();
      logClientPerf(
        `[PERF] client useTaskItems nav=${navigationId ?? "none"} blockId=${blockId} public=${Boolean(publicToken)}`
      );

      const response = await fetch(url, {
        cache: "no-store",
        headers: publicToken
          ? undefined
          : buildClientPerfHeaders({
              navigationId,
              source: "useTaskItems",
            }),
      });
      const result = await response.json();
      if (!response.ok || ("error" in result && result.error)) {
        throw new Error(result?.error ?? "Failed to load tasks");
      }
      const bundle = result.data as TaskBlockBundle;
      const previous = qc.getQueryData<TaskBlockBundle>(queryKey);
      const clientKeyByTaskId = new Map(
        (previous?.tasks ?? []).map((task) => [task.id, getTaskViewClientKey(task)])
      );
      const previousTasksById = new Map(
        (previous?.tasks ?? []).map((task) => [task.id, task])
      );
      const serverTasks = bundle.tasks.map((task) => ({
        ...task,
        clientKey: clientKeyByTaskId.get(task.id) ?? task.clientKey ?? task.id,
        subtasks: (() => {
          const previousTask = previousTasksById.get(task.id);
          const previousSubtasks = previousTask?.subtasks ?? [];
          const clientKeyBySubtaskId = new Map(previousSubtasks.map((subtask) => [subtask.id, String(subtask.clientKey ?? subtask.id)]));
          const serverSubtasks = (task.subtasks ?? []).map((subtask) => ({
            ...subtask,
            clientKey: clientKeyBySubtaskId.get(subtask.id) ?? subtask.clientKey ?? subtask.id,
          }));
          const serverSubtaskClientKeys = new Set(
            serverSubtasks.map((subtask) => subtask.clientKey ?? subtask.id)
          );
          const pendingOptimisticSubtasks = previousSubtasks.filter(
            (subtask) => isOptimisticSubtask(subtask) && !serverSubtaskClientKeys.has(subtask.clientKey ?? subtask.id)
          );
          return [...serverSubtasks, ...pendingOptimisticSubtasks];
        })(),
      }));
      const serverClientKeys = new Set(serverTasks.map((task) => task.clientKey ?? task.id));
      const pendingOptimisticTasks = (previous?.tasks ?? []).filter(
        (task) => isOptimisticTask(task) && !serverClientKeys.has(task.clientKey ?? task.id)
      );

      return {
        ...bundle,
        tasks: dedupeTaskViews([...serverTasks, ...pendingOptimisticTasks]),
      } as TaskBlockBundle;
    },
    enabled: (options?.enabled ?? true) && Boolean(blockId),
  });
}

export function useCreateTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createTaskItem>[0]) => createTaskItem(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
      const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
      const optimisticId = createOptimisticId("optimistic");
      const optimistic: TaskItemView = {
        id: optimisticId,
        clientKey: optimisticId,
        text: input.title ?? "New task",
        statuses: [{ field_name: "Status", value: input.status ?? "todo" }],
        priorities: [],
        subtasks: [],
        comments: [],
      };
      qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (old) => {
        const base: TaskBlockBundle = old ?? { tasks: [], entityPropertiesByTaskId: {} };
        return {
          ...base,
          tasks: dedupeTaskViews([...base.tasks, optimistic]),
        };
      });
      return { previous, optimisticId };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      }
    },
    onSuccess: (result, _input, ctx) => {
      if ("error" in result) {
        if (ctx?.previous !== undefined) {
          qc.setQueryData(taskKeys.items(blockId), ctx.previous);
        }
        return;
      }

      qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (current) => {
        const base: TaskBlockBundle = current ?? { tasks: [], entityPropertiesByTaskId: {} };
        const matchingTasks = base.tasks.filter(
          (task) => task.id === ctx?.optimisticId || task.clientKey === ctx?.optimisticId
        );
        const previousTask = matchingTasks[matchingTasks.length - 1];
        const serverTask = toTaskItemView(result.data);
        const nextTask: TaskItemView = {
          ...serverTask,
          text: previousTask?.text ?? serverTask.text,
          description: previousTask?.description ?? serverTask.description,
          clientKey: previousTask?.clientKey ?? ctx?.optimisticId ?? result.data.id,
        };
        const tasks: TaskItemView[] = [];
        let inserted = false;
        for (const task of base.tasks) {
          if (task.id === ctx?.optimisticId || task.clientKey === ctx?.optimisticId) {
            if (!inserted) {
              tasks.push(nextTask);
              inserted = true;
            }
            continue;
          }
          tasks.push(task);
        }
        if (!inserted) {
          tasks.push(nextTask);
        }
        return {
          ...base,
          tasks: dedupeTaskViews(tasks),
        };
      });
    },
    onSettled: () => {
      invalidateWithPerf(qc, "useCreateTaskItem.taskItems", { queryKey: ["taskItems"] });
      invalidateWithPerf(qc, "useCreateTaskItem.chartLiveData", { queryKey: queryKeys.chartLiveData() });
    },
  });
}

export function useUpdateTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; updates: Parameters<typeof updateTaskItem>[1] }) =>
      updateTaskItem(input.taskId, input.updates),
    onMutate: async ({ taskId, updates }) => {
      await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
      const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
      qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === taskId
              ? {
                ...t,
                ...(updates.title !== undefined ? { text: updates.title } : {}),
                ...(updates.status !== undefined
                  ? { statuses: [{ field_name: "Status", value: updates.status }] }
                  : {}),
                ...(updates.description !== undefined ? { description: updates.description ?? undefined } : {}),
              }
              : t
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      }
    },
    onSuccess: (result, input, ctx) => {
      if ("error" in result) {
        if (ctx?.previous !== undefined) {
          qc.setQueryData(taskKeys.items(blockId), ctx.previous);
        }
        return;
      }

      qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (current) => {
        if (!current) return current;
        return {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== input.taskId) return task;
            const serverTask = toTaskItemView(result.data);
            return {
              ...task,
              ...serverTask,
              clientKey: task.clientKey ?? task.id,
              subtasks: task.subtasks ?? serverTask.subtasks ?? [],
              comments: task.comments ?? serverTask.comments ?? [],
            };
          }),
        };
      });
    },
    onSettled: () => {
      // Source-linked table rows: when task is updated, derived rows are synced server-side; refetch tables so UI updates
      invalidateWithPerf(qc, "useUpdateTaskItem.taskItems", { queryKey: ["taskItems"] });
      invalidateWithPerf(qc, "useUpdateTaskItem.timelineItems", { queryKey: ["timelineItems"] });
      invalidateWithPerf(qc, "useUpdateTaskItem.chartLiveData", { queryKey: queryKeys.chartLiveData() });
      invalidateWithPerf(qc, "useUpdateTaskItem.tableRows", { queryKey: ["tableRows"] });
      invalidateWithPerf(qc, "useUpdateTaskItem.tableBootstrap", { queryKey: ["tableBootstrap"] });
    },
  });
}

export function useDeleteTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTaskItem(taskId),
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
      const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
      qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.filter((t) => t.id !== taskId),
        };
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      }
    },
    onSettled: () => {
      invalidateWithPerf(qc, "useDeleteTaskItem.taskItems", { queryKey: ["taskItems"] });
      invalidateWithPerf(qc, "useDeleteTaskItem.chartLiveData", { queryKey: queryKeys.chartLiveData() });
    },
  });
}

export function useReorderTaskItems(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderTaskItems(blockId, orderedIds),
    onSuccess: () => invalidateWithPerf(qc, "useReorderTaskItems.taskItems", { queryKey: taskKeys.items(blockId) }),
  });
}

export function useSetTaskSyncModeForBlock(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "snapshot" | "live") =>
      setTaskSyncModeForBlock({ taskBlockId: blockId, mode }),
    onSuccess: () => invalidateWithPerf(qc, "useSetTaskSyncModeForBlock.taskItems", { queryKey: taskKeys.items(blockId) }),
  });
}

export function useTaskSubtasks(blockId: string) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: createTaskSubtask,
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        const tempId = createOptimisticId("optimistic-subtask");
        const optimisticSubtask: NonNullable<TaskItemView["subtasks"]>[number] = {
          id: tempId,
          clientKey: tempId,
          text: input.title,
          description: input.description ?? null,
          completed: Boolean(input.completed),
        };
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) =>
              t.id === input.taskId
                ? { ...t, subtasks: [...(t.subtasks ?? []), optimisticSubtask] }
                : t
            ),
          });
        }
        return { previous, tempId, taskId: input.taskId };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSuccess: (result, _input, ctx) => {
        if ("error" in result) {
          if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
          return;
        }
        qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (current) => {
          if (!current) return current;
          return {
            ...current,
            tasks: current.tasks.map((task) => {
              if (task.id !== ctx?.taskId) return task;
              const subtasks = task.subtasks ?? [];
              const matchingSubtasks = subtasks.filter(
                (subtask) => subtask.id === ctx?.tempId || subtask.clientKey === ctx?.tempId
              );
              const previousSubtask = matchingSubtasks[matchingSubtasks.length - 1];
              const nextSubtask = {
                ...toTaskSubtaskView(result.data),
                clientKey: previousSubtask?.clientKey ?? ctx?.tempId ?? result.data.id,
              };
              const nextSubtasks: NonNullable<TaskItemView["subtasks"]> = [];
              let inserted = false;
              for (const subtask of subtasks) {
                if (subtask.id === ctx?.tempId || subtask.clientKey === ctx?.tempId) {
                  if (!inserted) {
                    nextSubtasks.push(nextSubtask);
                    inserted = true;
                  }
                  continue;
                }
                nextSubtasks.push(subtask);
              }
              if (!inserted) {
                nextSubtasks.push(nextSubtask);
              }
              return { ...task, subtasks: nextSubtasks };
            }),
          };
        });
      },
    }),
    update: useMutation({
      mutationFn: (input: { subtaskId: string; updates: Parameters<typeof updateTaskSubtask>[1] }) =>
        updateTaskSubtask(input.subtaskId, input.updates),
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        const optimisticSubtaskUpdates: Partial<NonNullable<TaskItemView["subtasks"]>[number]> = {
          ...(input.updates.title !== undefined ? { text: input.updates.title } : {}),
          ...(input.updates.description !== undefined ? { description: input.updates.description ?? undefined } : {}),
          ...(input.updates.completed !== undefined ? { completed: Boolean(input.updates.completed) } : {}),
        };
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => ({
              ...t,
              subtasks: t.subtasks?.map((s) => s.id === input.subtaskId ? { ...s, ...optimisticSubtaskUpdates } : s),
            })),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSuccess: (result, input, ctx) => {
        if ("error" in result) {
          if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
          return;
        }
        qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), (current) => {
          if (!current) return current;
          return {
            ...current,
            tasks: current.tasks.map((task) => ({
              ...task,
              subtasks: task.subtasks?.map((subtask) =>
                subtask.id === input.subtaskId
                  ? {
                    ...toTaskSubtaskView(result.data),
                    clientKey: subtask.clientKey ?? subtask.id,
                  }
                  : subtask
              ),
            })),
          };
        });
      },
    }),
    remove: useMutation({
      mutationFn: (subtaskId: string) => deleteTaskSubtask(subtaskId),
      onMutate: async (subtaskId) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => ({
              ...t,
              subtasks: t.subtasks?.filter((s) => s.id !== subtaskId),
            })),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSettled: () => invalidateWithPerf(qc, "useTaskSubtasks.remove", { queryKey: taskKeys.items(blockId) }),
    }),
    reorder: useMutation({
      mutationFn: (input: { taskId: string; orderedSubtaskIds: string[] }) =>
        reorderSubtasks(input.taskId, input.orderedSubtaskIds),
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => {
              if (t.id !== input.taskId) return t;
              const subtaskMap = new Map(t.subtasks?.map(s => [s.id, s]) || []);
              const newSubtasks = input.orderedSubtaskIds.map(id => subtaskMap.get(id)).filter(Boolean) as typeof t.subtasks;
              return { ...t, subtasks: newSubtasks };
            }),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
    }),
  };
}

export function useTaskComments(blockId: string) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: createTaskComment,
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        const optimisticComment = {
          id: createOptimisticId("optimistic-comment"),
          author: "You",
          text: input.text,
          timestamp: new Date().toISOString(),
          parentId: input.parentId ?? null,
        };
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) =>
              t.id === input.taskId
                ? { ...t, comments: [...(t.comments ?? []), optimisticComment] }
                : t
            ),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSettled: () => invalidateWithPerf(qc, "useTaskComments.create", { queryKey: taskKeys.items(blockId) }),
    }),
    update: useMutation({
      mutationFn: (input: { commentId: string; updates: Parameters<typeof updateTaskComment>[1] }) =>
        updateTaskComment(input.commentId, input.updates),
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => ({
              ...t,
              comments: t.comments?.map((c) => c.id === input.commentId ? { ...c, ...input.updates } : c),
            })),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
    }),
    remove: useMutation({
      mutationFn: deleteTaskComment,
      onMutate: async (commentId) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => ({
              ...t,
              comments: t.comments?.filter((c) => c.id !== commentId),
            })),
          });
        }
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSettled: () => invalidateWithPerf(qc, "useTaskComments.remove", { queryKey: taskKeys.items(blockId) }),
    }),
  };
}

export function useTaskTags(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; tags: string[] }) => setTaskTags(input.taskId, input.tags),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
      const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
      if (previous) {
        qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
          ...previous,
          tasks: previous.tasks.map((t) => t.id === input.taskId ? { ...t, tags: input.tags } : t),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
    },
    onSettled: () => invalidateWithPerf(qc, "useTaskTags.taskItems", { queryKey: ["taskItems"] }),
  });
}

export function useTaskAssignees(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; assignees: Array<{ id?: string | null; name?: string | null }> }) =>
      setTaskAssignees(input.taskId, input.assignees),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
      const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
      if (previous) {
        qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
          ...previous,
          tasks: previous.tasks.map((t) => t.id === input.taskId ? { ...t, assignees: input.assignees.map(a => a.name || a.id).filter(Boolean) as string[] } : t),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
    },
    onSettled: () => invalidateWithPerf(qc, "useTaskAssignees.taskItems", { queryKey: ["taskItems"] }),
  });
}

export function useTaskReferences(taskId?: string) {
  return useQuery({
    queryKey: taskId ? taskKeys.references(taskId) : ["taskReferences", "none"],
    queryFn: async () => {
      if (!taskId) return [];
      const result = await listTaskReferenceSummaries(taskId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!taskId,
  });
}

export function useSubtaskReferences(subtaskId?: string) {
  return useQuery({
    queryKey: subtaskId ? taskKeys.subtaskReferences(subtaskId) : ["subtaskReferences", "none"],
    queryFn: async () => {
      if (!subtaskId) return [];
      const result = await listSubtaskReferenceSummaries(subtaskId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!subtaskId,
  });
}

export function useCreateSubtaskReference(subtaskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSubtaskReference,
    onMutate: async (input) => {
      if (!subtaskId) return { previous: undefined };
      await qc.cancelQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
      const previous = qc.getQueryData<SubtaskReferenceSummary>(taskKeys.subtaskReferences(subtaskId));
      const optimistic = {
          id: createOptimisticId("optimistic-subtask-ref"),
        workspace_id: "",
        subtask_id: input.subtaskId,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        table_id: input.tableId ?? null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: input.referenceId,
      };
      qc.setQueryData<SubtaskReferenceSummary>(taskKeys.subtaskReferences(subtaskId), (current) => [
        optimistic,
        ...((current ?? []) as SubtaskReferenceSummary),
      ] as SubtaskReferenceSummary);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (subtaskId && ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.subtaskReferences(subtaskId), ctx.previous);
      }
    },
    onSuccess: () => {
      if (subtaskId) invalidateWithPerf(qc, "useCreateSubtaskReference.references", { queryKey: taskKeys.subtaskReferences(subtaskId) });
    },
  });
}

export function useDeleteSubtaskReference(subtaskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteSubtaskReference(referenceId),
    onMutate: async (referenceId) => {
      if (!subtaskId) return { previous: undefined };
      await qc.cancelQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
      const previous = qc.getQueryData<SubtaskReferenceSummary>(taskKeys.subtaskReferences(subtaskId));
      qc.setQueryData<SubtaskReferenceSummary>(taskKeys.subtaskReferences(subtaskId), (current) => {
        const refs = (current ?? []) as SubtaskReferenceSummary;
        return refs.filter((ref) => ref.id !== referenceId) as SubtaskReferenceSummary;
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (subtaskId && ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.subtaskReferences(subtaskId), ctx.previous);
      }
    },
    onSuccess: () => {
      if (subtaskId) invalidateWithPerf(qc, "useDeleteSubtaskReference.references", { queryKey: taskKeys.subtaskReferences(subtaskId) });
    },
  });
}

export function useCreateTaskReference(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTaskReference,
    onMutate: async (input) => {
      if (!taskId) return { previous: undefined };
      await qc.cancelQueries({ queryKey: taskKeys.references(taskId) });
      const previous = qc.getQueryData<TaskReferenceSummary>(taskKeys.references(taskId));
      const optimistic = {
          id: createOptimisticId("optimistic-task-ref"),
        workspace_id: "",
        task_id: input.taskId,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        table_id: input.tableId ?? null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: input.referenceId,
      };
      qc.setQueryData<TaskReferenceSummary>(taskKeys.references(taskId), (current) => [
        optimistic,
        ...((current ?? []) as TaskReferenceSummary),
      ] as TaskReferenceSummary);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (taskId && ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.references(taskId), ctx.previous);
      }
    },
    onSuccess: () => {
      if (taskId) invalidateWithPerf(qc, "useCreateTaskReference.references", { queryKey: taskKeys.references(taskId) });
    },
  });
}

export function useDeleteTaskReference(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteTaskReference(referenceId),
    onMutate: async (referenceId) => {
      if (!taskId) return { previous: undefined };
      await qc.cancelQueries({ queryKey: taskKeys.references(taskId) });
      const previous = qc.getQueryData<TaskReferenceSummary>(taskKeys.references(taskId));
      qc.setQueryData<TaskReferenceSummary>(taskKeys.references(taskId), (current) => {
        const refs = (current ?? []) as TaskReferenceSummary;
        return refs.filter((ref) => ref.id !== referenceId) as TaskReferenceSummary;
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (taskId && ctx?.previous !== undefined) {
        qc.setQueryData(taskKeys.references(taskId), ctx.previous);
      }
    },
    onSuccess: () => {
      if (taskId) invalidateWithPerf(qc, "useDeleteTaskReference.references", { queryKey: taskKeys.references(taskId) });
    },
  });
}
