import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linkRows, unlinkRows, getRelatedRows } from '@/app/actions/tables/relations';

export function useRelatedRows(rowId: string, fieldId: string) {
  return useQuery({
    queryKey: ['related-rows', rowId, fieldId],
    queryFn: () => getRelatedRows(rowId, fieldId),
    enabled: !!rowId && !!fieldId,
  });
}

export function useLinkRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      fromTableId: string;
      fromFieldId: string;
      fromRowId: string;
      toRowIds: string[];
    }) => linkRows(params.fromTableId, params.fromFieldId, params.fromRowId, params.toRowIds),
    onSuccess: (_, variables) => {
      // Invalidate related rows query
      queryClient.invalidateQueries({ queryKey: ['related-rows', variables.fromRowId, variables.fromFieldId] });
      // Invalidate table rows query
      queryClient.invalidateQueries({ queryKey: ['table-rows', variables.fromTableId] });
    },
  });
}

export function useUnlinkRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      fromRowId: string;
      fromFieldId: string;
      toRowIds: string[];
    }) => unlinkRows(params.fromRowId, params.fromFieldId, params.toRowIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['related-rows', variables.fromRowId, variables.fromFieldId] });
    },
  });
}