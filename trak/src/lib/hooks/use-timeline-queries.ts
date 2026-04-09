"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { createTimelineEvent, updateTimelineEvent, deleteTimelineEvent, duplicateTimelineEvent, setTimelineEventBaseline } from "@/app/actions/timelines/event-actions";
import { createTimelineReference, updateTimelineReference, deleteTimelineReference, bulkImportTableRows, listTimelineReferenceSummaries } from "@/app/actions/timelines/reference-actions";
import { createTimelineDependency, deleteTimelineDependency, getTimelineDependencies } from "@/app/actions/timelines/dependency-actions";
import { getResolvedTimelineItems } from "@/app/actions/timelines/query-actions";
import { autoScheduleTimeline } from "@/app/actions/timelines/auto-schedule-actions";
import type { TimelineDependency, TimelineEvent, TimelineEventPriority, TimelineEventStatus, TimelineItem } from "@/types/timeline";
import { logClientInvalidation } from "@/lib/perf/perf-trace";

const timelineKeys = {
  items: (blockId: string) => ["timelineItems", blockId] as const,
  dependencies: (blockId: string) => ["timelineDependencies", blockId] as const,
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

type TimelineReferenceSummary = Extract<Awaited<ReturnType<typeof listTimelineReferenceSummaries>>, { data: unknown }> extends { data: infer T } ? T : never;

function sortTimelineItems(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
    return a.id.localeCompare(b.id);
  });
}

function mergeTimelineStatuses(
  existing: TimelineItem["statuses"],
  updates: { status?: string; statuses?: TimelineItem["statuses"] }
): TimelineItem["statuses"] {
  if (updates.statuses !== undefined) return updates.statuses;
  if (updates.status !== undefined) return [{ field_name: "Status", value: updates.status as TimelineEventStatus }];
  return existing;
}

function mergeTimelinePriorities(
  existing: TimelineItem["priorities"],
  updates: { priority?: string | null; priorities?: TimelineItem["priorities"] }
): TimelineItem["priorities"] {
  if (updates.priorities !== undefined) return updates.priorities;
  if (updates.priority !== undefined) {
    return updates.priority ? [{ field_name: "Priority", value: updates.priority as TimelineEventPriority }] : [];
  }
  return existing;
}

function buildTimelineAssignees(
  updates: Partial<{
    assignees: TimelineItem["assignees"];
    assigneeIds: string[];
    assigneeTeamIds: string[];
    assigneeId: string | null;
    assigneeTeamId: string | null;
  }>,
  existing: TimelineItem["assignees"]
): TimelineItem["assignees"] {
  if (updates.assignees !== undefined) return updates.assignees;

  if (updates.assigneeIds !== undefined || updates.assigneeTeamIds !== undefined) {
    const values = [
      ...((updates.assigneeIds ?? []).map((id) => ({ type: "user" as const, id }))),
      ...((updates.assigneeTeamIds ?? []).map((id) => ({ type: "team" as const, id }))),
    ];
    return values.length > 0 ? [{ field_name: "Assignee", value: values }] : [];
  }

  if (updates.assigneeId !== undefined || updates.assigneeTeamId !== undefined) {
    const values = [
      ...(updates.assigneeId ? [{ type: "user" as const, id: updates.assigneeId }] : []),
      ...(updates.assigneeTeamId ? [{ type: "team" as const, id: updates.assigneeTeamId }] : []),
    ];
    return values.length > 0 ? [{ field_name: "Assignee", value: values }] : [];
  }

  return existing;
}

function getPrimaryTimelineAssigneeIds(assignees: TimelineItem["assignees"]): {
  assignee_id: string | null;
  assignee_team_id: string | null;
} {
  for (const field of assignees ?? []) {
    const values = Array.isArray(field?.value) ? field.value : [];
    const firstUser = values.find((entry) => entry?.type === "user" && typeof entry.id === "string");
    const firstTeam = values.find((entry) => entry?.type === "team" && typeof entry.id === "string");
    if (firstUser?.id || firstTeam?.id) {
      return {
        assignee_id: firstUser?.id ?? null,
        assignee_team_id: firstTeam?.id ?? null,
      };
    }
  }

  return { assignee_id: null, assignee_team_id: null };
}

function toTimelineItem(event: TimelineEvent): TimelineItem {
  return {
    id: event.id,
    type: "event",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    statuses: event.statuses ?? [],
    priorities: event.priorities ?? [],
    assignees: event.assignees ?? [],
    assignee_id: event.assignee_id,
    assignee_team_id: event.assignee_team_id ?? null,
    parent_event_id: event.parent_event_id ?? null,
    source_entity_type: event.source_entity_type ?? null,
    source_entity_id: event.source_entity_id ?? null,
    source_sync_mode: event.source_sync_mode ?? null,
    progress: event.progress,
    color: event.color,
    is_milestone: event.is_milestone,
    notes: event.notes ?? null,
    baseline_start: event.baseline_start ?? null,
    baseline_end: event.baseline_end ?? null,
    display_order: event.display_order,
  };
}

function patchTimelineItem(
  item: TimelineItem,
  updates: Partial<Parameters<typeof updateTimelineEvent>[1]>
): TimelineItem {
  const assignees = buildTimelineAssignees(
    {
      assignees: updates.assignees,
      assigneeIds: updates.assigneeIds,
      assigneeTeamIds: updates.assigneeTeamIds,
      assigneeId: updates.assigneeId,
      assigneeTeamId: updates.assigneeTeamId,
    },
    item.assignees ?? []
  );
  const assigneeCompat = getPrimaryTimelineAssigneeIds(assignees);

  return {
    ...item,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.startDate !== undefined ? { start_date: updates.startDate } : {}),
    ...(updates.endDate !== undefined ? { end_date: updates.endDate } : {}),
    statuses: mergeTimelineStatuses(item.statuses ?? [], {
      status: updates.status,
      statuses: updates.statuses as TimelineItem["statuses"] | undefined,
    }) ?? [],
    priorities: mergeTimelinePriorities(item.priorities ?? [], {
      priority: updates.priority,
      priorities: updates.priorities as TimelineItem["priorities"] | undefined,
    }) ?? [],
    assignees,
    assignee_id: assigneeCompat.assignee_id,
    assignee_team_id: assigneeCompat.assignee_team_id,
    ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    ...(updates.color !== undefined ? { color: updates.color } : {}),
    ...(updates.isMilestone !== undefined ? { is_milestone: updates.isMilestone } : {}),
    ...(updates.baselineStart !== undefined ? { baseline_start: updates.baselineStart } : {}),
    ...(updates.baselineEnd !== undefined ? { baseline_end: updates.baselineEnd } : {}),
    ...(updates.displayOrder !== undefined ? { display_order: updates.displayOrder } : {}),
    ...(updates.sourceSyncMode !== undefined ? { source_sync_mode: updates.sourceSyncMode } : {}),
  };
}

export function useTimelineItems(blockId: string) {
  return useQuery({
    queryKey: timelineKeys.items(blockId),
    queryFn: async () => {
      const result = await getResolvedTimelineItems(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(blockId),
  });
}

export function useTimelineDependencies(blockId: string) {
  return useQuery({
    queryKey: timelineKeys.dependencies(blockId),
    queryFn: async () => {
      const result = await getTimelineDependencies(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(blockId),
  });
}

export function useTimelineReferences(eventId?: string) {
  return useQuery({
    queryKey: ["timelineReferences", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const result = await listTimelineReferenceSummaries(eventId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(eventId),
  });
}

export function useCreateTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTimelineEvent,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: timelineKeys.items(blockId) });
      const previous = qc.getQueryData<TimelineItem[]>(timelineKeys.items(blockId));
      const tempId = createOptimisticId("optimistic-timeline");
      const optimisticAssignees = buildTimelineAssignees(
        {
          assignees: input.assignees as TimelineItem["assignees"] | undefined,
          assigneeIds: input.assigneeIds,
          assigneeTeamIds: input.assigneeTeamIds,
          assigneeId: input.assigneeId,
          assigneeTeamId: input.assigneeTeamId ?? null,
        },
        []
      );
      const assigneeCompat = getPrimaryTimelineAssigneeIds(optimisticAssignees);
      const optimisticItem: TimelineItem = {
        id: tempId,
        type: "event",
        title: input.title,
        start_date: input.startDate,
        end_date: input.endDate,
        statuses: mergeTimelineStatuses([], {
          status: input.status,
          statuses: input.statuses as TimelineItem["statuses"] | undefined,
        }) ?? [{ field_name: "Status", value: "todo" }],
        priorities: mergeTimelinePriorities([], {
          priority: input.priority ?? undefined,
          priorities: input.priorities as TimelineItem["priorities"] | undefined,
        }) ?? [],
        assignees: optimisticAssignees,
        assignee_id: assigneeCompat.assignee_id,
        assignee_team_id: assigneeCompat.assignee_team_id,
        parent_event_id: input.parentEventId ?? null,
        source_entity_type: input.sourceEntityType ?? null,
        source_entity_id: input.sourceEntityId ?? null,
        source_sync_mode: input.sourceSyncMode ?? null,
        progress: input.progress ?? 0,
        color: input.color ?? null,
        is_milestone: input.isMilestone ?? false,
        notes: input.notes ?? null,
        baseline_start: input.baselineStart ?? null,
        baseline_end: input.baselineEnd ?? null,
        display_order:
          input.displayOrder ??
          ((previous?.reduce((max, item) => Math.max(max, item.display_order), -1) ?? -1) + 1),
      };

      qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
        sortTimelineItems([...(current ?? []), optimisticItem])
      );

      return { previous, tempId };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, _input, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(timelineKeys.items(blockId), context.previous);
        }
      } else if (context?.tempId) {
        qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
          sortTimelineItems(
            (current ?? []).map((item) => (item.id === context.tempId ? toTimelineItem(result.data) : item))
          )
        );
      }

      // Invalidate entity properties for the newly created event
      if ("data" in result && result.data?.id) {
        invalidateWithPerf(qc, "useCreateTimelineEvent.entityProperties", {
          queryKey: queryKeys.entityProperties("timeline_event", result.data.id),
        });
      }
    },
  });
}

export function useUpdateTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventId: string; updates: Parameters<typeof updateTimelineEvent>[1] }) =>
      updateTimelineEvent(input.eventId, input.updates),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: timelineKeys.items(blockId) });
      const previous = qc.getQueryData<TimelineItem[]>(timelineKeys.items(blockId));
      qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
        sortTimelineItems(
          (current ?? []).map((item) =>
            item.id === input.eventId ? patchTimelineItem(item, input.updates) : item
          )
        )
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, variables, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(timelineKeys.items(blockId), context.previous);
        }
      } else {
        qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
          sortTimelineItems(
            (current ?? []).map((item) =>
              item.id === variables.eventId ? toTimelineItem(result.data) : item
            )
          )
        );
      }

      // Invalidate entity properties to refresh the Properties section
      invalidateWithPerf(qc, "useUpdateTimelineEvent.entityProperties", {
        queryKey: queryKeys.entityProperties("timeline_event", variables.eventId),
      });
      // Source-linked table rows: when timeline event is updated, derived rows are synced server-side; refetch tables
      invalidateWithPerf(qc, "useUpdateTimelineEvent.tableRows", { queryKey: ["tableRows"] });
      invalidateWithPerf(qc, "useUpdateTimelineEvent.tableBootstrap", { queryKey: ["tableBootstrap"] });
    },
  });
}

export function useDeleteTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteTimelineEvent(eventId),
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: timelineKeys.items(blockId) });
      const previous = qc.getQueryData<TimelineItem[]>(timelineKeys.items(blockId));
      qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
        (current ?? []).filter((item) => item.id !== eventId)
      );
      return { previous };
    },
    onError: (_error, _eventId, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, _eventId, context) => {
      if ("error" in result && context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSettled: () => {
      invalidateWithPerf(qc, "useDeleteTimelineEvent.items", { queryKey: timelineKeys.items(blockId) });
    }
  });
}

export function useDuplicateTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateTimelineEvent,
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: timelineKeys.items(blockId) });
      const previous = qc.getQueryData<TimelineItem[]>(timelineKeys.items(blockId));
      const source = (previous ?? []).find((item) => item.id === eventId);
      const tempId = createOptimisticId("optimistic-timeline-copy");

      if (source) {
        const optimisticCopy: TimelineItem = {
          ...source,
          id: tempId,
          title: `${source.title} (Copy)`,
          display_order: source.display_order + 1,
        };
        qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
          sortTimelineItems([...(current ?? []), optimisticCopy])
        );
      }

      return { previous, tempId };
    },
    onError: (_error, _eventId, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, _eventId, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(timelineKeys.items(blockId), context.previous);
        }
      } else if (context?.tempId) {
        qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
          sortTimelineItems(
            (current ?? []).map((item) => (item.id === context.tempId ? toTimelineItem(result.data) : item))
          )
        );
      }
    },
    onSettled: () => {
      invalidateWithPerf(qc, "useDuplicateTimelineEvent.items", { queryKey: timelineKeys.items(blockId) });
    }
  });
}

export function useSetTimelineEventBaseline(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventId: string; baseline: { start: string | null; end: string | null } }) =>
      setTimelineEventBaseline(input.eventId, input.baseline),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: timelineKeys.items(blockId) });
      const previous = qc.getQueryData<TimelineItem[]>(timelineKeys.items(blockId));
      qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
        (current ?? []).map((item) =>
          item.id === input.eventId
            ? { ...item, baseline_start: input.baseline.start, baseline_end: input.baseline.end }
            : item
        )
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, input, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(timelineKeys.items(blockId), context.previous);
        }
      } else {
        qc.setQueryData<TimelineItem[]>(timelineKeys.items(blockId), (current) =>
          (current ?? []).map((item) =>
            item.id === input.eventId ? toTimelineItem(result.data) : item
          )
        );
      }
    },
    onSettled: () => {
      invalidateWithPerf(qc, "useSetTimelineEventBaseline.items", { queryKey: timelineKeys.items(blockId) });
    }
  });
}

export function useCreateTimelineReference(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTimelineReference,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["timelineReferences", input.eventId] });
      const previous = qc.getQueryData<TimelineReferenceSummary>(["timelineReferences", input.eventId]);
      const optimistic = {
        id: createOptimisticId("optimistic-timeline-ref"),
        workspace_id: "",
        event_id: input.eventId,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        table_id: input.tableId ?? null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: input.referenceId,
      };
      qc.setQueryData<TimelineReferenceSummary>(["timelineReferences", input.eventId], (current) => [
        optimistic,
        ...((current ?? []) as TimelineReferenceSummary),
      ] as TimelineReferenceSummary);
      return { previous, eventId: input.eventId };
    },
    onError: (_error, _input, context) => {
      if (context?.eventId && context.previous !== undefined) {
        qc.setQueryData(["timelineReferences", context.eventId], context.previous);
      }
    },
    onSuccess: (_data, variables) => {
      invalidateWithPerf(qc, "useCreateTimelineReference.items", { queryKey: timelineKeys.items(blockId) });
      if (variables?.eventId) {
        invalidateWithPerf(qc, "useCreateTimelineReference.referencesByEvent", { queryKey: ["timelineReferences", variables.eventId] });
      } else {
        invalidateWithPerf(qc, "useCreateTimelineReference.references", { queryKey: ["timelineReferences"] });
      }
    },
  });
}

export function useUpdateTimelineReference(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { referenceId: string; updates: Parameters<typeof updateTimelineReference>[1] }) =>
      updateTimelineReference(input.referenceId, input.updates),
    onSuccess: () => {
      invalidateWithPerf(qc, "useUpdateTimelineReference.items", { queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useDeleteTimelineReference(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTimelineReference,
    onMutate: async (referenceId) => {
      const queries = qc.getQueriesData<TimelineReferenceSummary>({ queryKey: ["timelineReferences"] });
      for (const [queryKey] of queries) {
        await qc.cancelQueries({ queryKey });
      }
      for (const [queryKey, data] of queries) {
        qc.setQueryData<TimelineReferenceSummary>(queryKey, () => {
          const refs = (data ?? []) as TimelineReferenceSummary;
          return refs.filter((ref) => ref.id !== referenceId) as TimelineReferenceSummary;
        });
      }
      return { previousQueries: queries };
    },
    onError: (_error, _referenceId, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        qc.setQueryData(queryKey, data);
      }
    },
    onSuccess: () => {
      invalidateWithPerf(qc, "useDeleteTimelineReference.items", { queryKey: timelineKeys.items(blockId) });
      invalidateWithPerf(qc, "useDeleteTimelineReference.references", { queryKey: ["timelineReferences"] });
    },
  });
}

export function useBulkImportTimelineRows(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkImportTableRows,
    onSuccess: () => {
      invalidateWithPerf(qc, "useBulkImportTimelineRows.items", { queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useCreateTimelineDependency(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTimelineDependency,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: timelineKeys.dependencies(blockId) });
      const previous = qc.getQueryData<TimelineDependency[]>(timelineKeys.dependencies(blockId));
      const optimistic: TimelineDependency = {
        id: createOptimisticId("optimistic-dependency"),
        timeline_block_id: input.timelineBlockId,
        workspace_id: "",
        from_id: input.fromId,
        to_id: input.toId,
        dependency_type: input.dependencyType,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<TimelineDependency[]>(timelineKeys.dependencies(blockId), (current) => [
        ...((current ?? [])),
        optimistic,
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.dependencies(blockId), context.previous);
      }
    },
    onSuccess: () => {
      invalidateWithPerf(qc, "useCreateTimelineDependency.dependencies", { queryKey: timelineKeys.dependencies(blockId) });
    },
  });
}

export function useDeleteTimelineDependency(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) => deleteTimelineDependency(dependencyId),
    onMutate: async (dependencyId) => {
      await qc.cancelQueries({ queryKey: timelineKeys.dependencies(blockId) });
      const previous = qc.getQueryData<TimelineDependency[]>(timelineKeys.dependencies(blockId));
      qc.setQueryData<TimelineDependency[]>(timelineKeys.dependencies(blockId), (current) =>
        (current ?? []).filter((dependency) => dependency.id !== dependencyId)
      );
      return { previous };
    },
    onError: (_error, _dependencyId, context) => {
      if (context?.previous) {
        qc.setQueryData(timelineKeys.dependencies(blockId), context.previous);
      }
    },
    onSuccess: () => {
      invalidateWithPerf(qc, "useDeleteTimelineDependency.dependencies", { queryKey: timelineKeys.dependencies(blockId) });
    },
  });
}

export function useAutoScheduleTimeline(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => autoScheduleTimeline(blockId),
    onSuccess: () => {
      invalidateWithPerf(qc, "useAutoScheduleTimeline.items", { queryKey: timelineKeys.items(blockId) });
    },
  });
}

export type { TimelineEvent, TimelineItem, TimelineDependency };
