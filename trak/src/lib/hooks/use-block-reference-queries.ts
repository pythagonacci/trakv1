import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBlockReference,
  deleteBlockReference,
  listBlockReferences,
  listBlockReferenceSummaries,
  type BlockReferenceType,
} from "@/app/actions/blocks/block-reference-actions";

const blockReferenceKeys = {
  list: (blockId: string) => ["blockReferences", blockId] as const,
  summaries: (blockId: string) => ["blockReferenceSummaries", blockId] as const,
};

export function useBlockReferences(blockId?: string) {
  return useQuery({
    queryKey: blockId ? blockReferenceKeys.list(blockId) : ["blockReferences", "none"],
    queryFn: async () => {
      if (!blockId) return [];
      const result = await listBlockReferences(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!blockId,
  });
}

export function useBlockReferenceSummaries(blockId?: string) {
  return useQuery({
    queryKey: blockId ? blockReferenceKeys.summaries(blockId) : ["blockReferenceSummaries", "none"],
    queryFn: async () => {
      if (!blockId) return [];
      const result = await listBlockReferenceSummaries(blockId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!blockId,
  });
}

export function useCreateBlockReference(blockId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      blockId: string;
      referenceType: BlockReferenceType;
      referenceId: string;
      tableId?: string | null;
    }) => createBlockReference(input),
    onSuccess: (_data, variables) => {
      if (variables.blockId) {
        qc.invalidateQueries({ queryKey: blockReferenceKeys.list(variables.blockId) });
        qc.invalidateQueries({ queryKey: blockReferenceKeys.summaries(variables.blockId) });
      }
    },
  });
}

export function useDeleteBlockReference(blockId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) => deleteBlockReference(referenceId),
    onSuccess: () => {
      if (blockId) {
        qc.invalidateQueries({ queryKey: blockReferenceKeys.list(blockId) });
        qc.invalidateQueries({ queryKey: blockReferenceKeys.summaries(blockId) });
      }
    },
  });
}
