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
import type { TaskItem } from "@/types/task";

const taskKeys = {
  items: (blockId: string) => ["taskItems", blockId] as const,
  references: (taskId: string) => ["taskReferences", taskId] as const,
  subtaskReferences: (subtaskId: string) => ["subtaskReferences", subtaskId] as const,
};

type TaskReferenceSummary = Extract<Awaited<ReturnType<typeof listTaskReferenceSummaries>>, { data: unknown }> extends { data: infer T } ? T : never;
type SubtaskReferenceSummary = Extract<Awaited<ReturnType<typeof listSubtaskReferenceSummaries>>, { data: unknown }> extends { data: infer T } ? T : never;

function isOptimisticTask(task: Pick<TaskItemView, "id" | "clientKey">): boolean {
  return String(task.clientKey ?? task.id).startsWith("optimistic-");
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

      const response = await fetch(url, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || ("error" in result && result.error)) {
        throw new Error(result?.error ?? "Failed to load tasks");
      }
      const bundle = result.data as TaskBlockBundle;
      const previous = qc.getQueryData<TaskBlockBundle>(queryKey);
      const clientKeyByTaskId = new Map(
        (previous?.tasks ?? []).map((task) => [task.id, task.clientKey ?? task.id])
      );
      const serverTasks = bundle.tasks.map((task) => ({
        ...task,
        clientKey: clientKeyByTaskId.get(task.id) ?? task.clientKey ?? task.id,
      }));
      const serverClientKeys = new Set(serverTasks.map((task) => task.clientKey ?? task.id));
      const pendingOptimisticTasks = (previous?.tasks ?? []).filter(
        (task) => isOptimisticTask(task) && !serverClientKeys.has(task.clientKey ?? task.id)
      );

      return {
        ...bundle,
        tasks: [...serverTasks, ...pendingOptimisticTasks],
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
      const optimisticId = `optimistic-${Date.now()}`;
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
          tasks: [...base.tasks, optimistic],
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
        const optimisticIndex = base.tasks.findIndex(
          (task) => task.id === ctx?.optimisticId || task.clientKey === ctx?.optimisticId
        );
        const previousTask = optimisticIndex >= 0 ? base.tasks[optimisticIndex] : undefined;
        const nextTask: TaskItemView = {
          ...toTaskItemView(result.data),
          clientKey: previousTask?.clientKey ?? ctx?.optimisticId ?? result.data.id,
        };

        if (optimisticIndex === -1) {
          return {
            ...base,
            tasks: [...base.tasks, nextTask],
          };
        }

        const tasks = [...base.tasks];
        tasks[optimisticIndex] = nextTask;
        return {
          ...base,
          tasks,
        };
      });
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.items(blockId) });
      // Source-linked table rows: when task is updated, derived rows are synced server-side; refetch tables so UI updates
      qc.invalidateQueries({ queryKey: ["tableRows"] });
      qc.invalidateQueries({ queryKey: ["tableBootstrap"] });
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
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
  });
}

export function useReorderTaskItems(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderTaskItems(blockId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
  });
}

export function useSetTaskSyncModeForBlock(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "snapshot" | "live") =>
      setTaskSyncModeForBlock({ taskBlockId: blockId, mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
        const optimisticSubtask: { id: string; text: string; description?: string | null; completed: boolean } = {
          id: `optimistic-subtask-${Date.now()}`,
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
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) qc.setQueryData(taskKeys.items(blockId), ctx.previous);
      },
      onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
    }),
    update: useMutation({
      mutationFn: (input: { subtaskId: string; updates: Parameters<typeof updateTaskSubtask>[1] }) =>
        updateTaskSubtask(input.subtaskId, input.updates),
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: taskKeys.items(blockId) });
        const previous = qc.getQueryData<TaskBlockBundle>(taskKeys.items(blockId));
        if (previous) {
          qc.setQueryData<TaskBlockBundle>(taskKeys.items(blockId), {
            ...previous,
            tasks: previous.tasks.map((t) => ({
              ...t,
              subtasks: t.subtasks?.map((s) => s.id === input.subtaskId ? { ...s, ...input.updates } : s),
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
      onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
          id: `optimistic-comment-${Date.now()}`,
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
      onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
        id: `optimistic-subtask-ref-${Date.now()}`,
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
      if (subtaskId) qc.invalidateQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
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
      if (subtaskId) qc.invalidateQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
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
        id: `optimistic-task-ref-${Date.now()}`,
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
      if (taskId) qc.invalidateQueries({ queryKey: taskKeys.references(taskId) });
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
      if (taskId) qc.invalidateQueries({ queryKey: taskKeys.references(taskId) });
    },
  });
}
