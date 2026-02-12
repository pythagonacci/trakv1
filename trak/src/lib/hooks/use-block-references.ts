"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBlockReference,
  deleteBlockReference,
  listBlockReferenceSummaries,
} from "@/app/actions/blocks/reference-actions";

const blockReferenceKeys = {
  references: (blockId: string) => ["blockReferences", blockId] as const,
};

export function useBlockReferences(blockId?: string) {
  return useQuery({
    queryKey: blockId ? blockReferenceKeys.references(blockId) : ["blockReferences", "none"],
    queryFn: async () => {
      if (!blockId) return [];
      const result = await listBlockReferenceSummaries(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(blockId),
  });
}

export function useCreateBlockReference(blockId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBlockReference,
    onSuccess: () => {
      if (blockId) qc.invalidateQueries({ queryKey: blockReferenceKeys.references(blockId) });
    },
  });
}

export function useDeleteBlockReference(blockId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteBlockReference(referenceId),
    onSuccess: () => {
      if (blockId) qc.invalidateQueries({ queryKey: blockReferenceKeys.references(blockId) });
    },
  });
}
