"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { createTimelineEvent, updateTimelineEvent, deleteTimelineEvent, duplicateTimelineEvent, setTimelineEventBaseline } from "@/app/actions/timelines/event-actions";
import { createTimelineReference, updateTimelineReference, deleteTimelineReference, bulkImportTableRows, listTimelineReferenceSummaries } from "@/app/actions/timelines/reference-actions";
import { createTimelineDependency, deleteTimelineDependency, getTimelineDependencies } from "@/app/actions/timelines/dependency-actions";
import { getResolvedTimelineItems } from "@/app/actions/timelines/query-actions";
import { autoScheduleTimeline } from "@/app/actions/timelines/auto-schedule-actions";
import type { TimelineDependency, TimelineEvent, TimelineItem } from "@/types/timeline";

const timelineKeys = {
  items: (blockId: string) => ["timelineItems", blockId] as const,
  dependencies: (blockId: string) => ["timelineDependencies", blockId] as const,
};

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
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
      // Invalidate entity properties for the newly created event
      if ("data" in result && result.data?.id) {
        qc.invalidateQueries({
          queryKey: queryKeys.entityPropertiesWithInheritance("timeline_event", result.data.id),
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
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
      // Invalidate entity properties to refresh the Properties section
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance("timeline_event", variables.eventId),
      });
    },
  });
}

export function useDeleteTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteTimelineEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useDuplicateTimelineEvent(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateTimelineEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useSetTimelineEventBaseline(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventId: string; baseline: { start: string | null; end: string | null } }) =>
      setTimelineEventBaseline(input.eventId, input.baseline),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useCreateTimelineReference(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTimelineReference,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
      if (variables?.eventId) {
        qc.invalidateQueries({ queryKey: ["timelineReferences", variables.eventId] });
      } else {
        qc.invalidateQueries({ queryKey: ["timelineReferences"] });
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
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useDeleteTimelineReference(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTimelineReference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
      qc.invalidateQueries({ queryKey: ["timelineReferences"] });
    },
  });
}

export function useBulkImportTimelineRows(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkImportTableRows,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export function useCreateTimelineDependency(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTimelineDependency,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.dependencies(blockId) });
    },
  });
}

export function useDeleteTimelineDependency(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) => deleteTimelineDependency(dependencyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.dependencies(blockId) });
    },
  });
}

export function useAutoScheduleTimeline(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => autoScheduleTimeline(blockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.items(blockId) });
    },
  });
}

export type { TimelineEvent, TimelineItem, TimelineDependency };
