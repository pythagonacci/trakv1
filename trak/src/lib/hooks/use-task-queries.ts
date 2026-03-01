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

const taskKeys = {
  items: (blockId: string) => ["taskItems", blockId] as const,
  references: (taskId: string) => ["taskReferences", taskId] as const,
  subtaskReferences: (subtaskId: string) => ["subtaskReferences", subtaskId] as const,
};

export function useTaskItems(
  blockId: string,
  options?: { enabled?: boolean; publicToken?: string }
) {
  const publicToken = options?.publicToken;

  return useQuery({
    queryKey: publicToken
      ? [...taskKeys.items(blockId), "public", publicToken]
      : taskKeys.items(blockId),
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
      return result.data as TaskBlockBundle;
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
      const optimistic: TaskItemView = {
        id: `optimistic-${Date.now()}`,
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
    onSuccess: () => {
      if (subtaskId) qc.invalidateQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
    },
  });
}

export function useDeleteSubtaskReference(subtaskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteSubtaskReference(referenceId),
    onSuccess: () => {
      if (subtaskId) qc.invalidateQueries({ queryKey: taskKeys.subtaskReferences(subtaskId) });
    },
  });
}

export function useCreateTaskReference(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTaskReference,
    onSuccess: () => {
      if (taskId) qc.invalidateQueries({ queryKey: taskKeys.references(taskId) });
    },
  });
}

export function useDeleteTaskReference(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteTaskReference(referenceId),
    onSuccess: () => {
      if (taskId) qc.invalidateQueries({ queryKey: taskKeys.references(taskId) });
    },
  });
}
