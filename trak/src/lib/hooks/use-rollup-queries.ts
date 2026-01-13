import { useMutation, useQueryClient } from '@tanstack/react-query';
import { computeRollupValue } from '@/app/actions/tables/rollups';

export function useComputeRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { rowId: string; fieldId: string }) =>
      computeRollupValue(params.rowId, params.fieldId),
    onSuccess: (_, variables) => {
      // Invalidate table rows query to refresh display
      queryClient.invalidateQueries({ queryKey: ['table-rows'] });
    },
  });
}