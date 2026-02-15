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
import { getTaskItemsByBlock } from "@/app/actions/tasks/query-actions";
import { createTaskReference, deleteTaskReference, listTaskReferenceSummaries } from "@/app/actions/tasks/reference-actions";
import {
  createSubtaskReference,
  deleteSubtaskReference,
  listSubtaskReferenceSummaries,
} from "@/app/actions/tasks/subtask-reference-actions";
import type { TaskItemView } from "@/app/actions/tasks/query-actions";

const taskKeys = {
  items: (blockId: string) => ["taskItems", blockId] as const,
  references: (taskId: string) => ["taskReferences", taskId] as const,
  subtaskReferences: (subtaskId: string) => ["subtaskReferences", subtaskId] as const,
};

export function useTaskItems(blockId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.items(blockId),
    queryFn: async () => {
      const result = await getTaskItemsByBlock(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data as TaskItemView[];
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createTaskItem>[0]) => createTaskItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
  });
}

export function useUpdateTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; updates: Parameters<typeof updateTaskItem>[1] }) =>
      updateTaskItem(input.taskId, input.updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
  });
}

export function useDeleteTaskItem(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTaskItem(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
    }),
    remove: useMutation({
      mutationFn: (subtaskId: string) => deleteTaskSubtask(subtaskId),
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
    }),
    reorder: useMutation({
      mutationFn: (input: { taskId: string; orderedSubtaskIds: string[] }) =>
        reorderSubtasks(input.taskId, input.orderedSubtaskIds),
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
      onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
  });
}

export function useTaskAssignees(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; assignees: Array<{ id?: string | null; name?: string | null }> }) =>
      setTaskAssignees(input.taskId, input.assignees),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
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
