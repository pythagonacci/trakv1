import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCard, deleteCard, updateCard } from "@/app/actions/cards/item-actions";
import { createCardComment, deleteCardComment, updateCardComment } from "@/app/actions/cards/comment-actions";
import type { CardsBlockBundle } from "@/app/actions/cards/query-actions";

const cardKeys = {
  items: (blockId: string) => ["cardItems", blockId] as const,
};

export function useCards(blockId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cardKeys.items(blockId),
    queryFn: async () => {
      const response = await fetch(`/api/card-blocks/${blockId}/items`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || ("error" in result && result.error)) {
        throw new Error(result?.error ?? "Failed to load cards");
      }
      return result.data as CardsBlockBundle;
    },
    enabled: (options?.enabled ?? true) && Boolean(blockId),
  });
}

export function useCreateCard(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createCard>[0]) => createCard(input),
    onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
  });
}

export function useUpdateCard(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; updates: Parameters<typeof updateCard>[1] }) =>
      updateCard(input.cardId, input.updates),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cardKeys.items(blockId) });
      qc.invalidateQueries({ queryKey: ["tableRows"] });
      qc.invalidateQueries({ queryKey: ["tableBootstrap"] });
    },
  });
}

export function useDeleteCard(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => deleteCard(cardId),
    onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
  });
}

export function useCardComments(blockId: string) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: createCardComment,
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
    update: useMutation({
      mutationFn: (input: { commentId: string; updates: Parameters<typeof updateCardComment>[1] }) =>
        updateCardComment(input.commentId, input.updates),
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
    remove: useMutation({
      mutationFn: (commentId: string) => deleteCardComment(commentId),
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
  };
}
