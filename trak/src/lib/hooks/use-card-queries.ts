import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCard, deleteCard, updateCard } from "@/app/actions/cards/item-actions";
import { createCardComment, deleteCardComment, updateCardComment } from "@/app/actions/cards/comment-actions";
import type { CardCommentView, CardItemView, CardsBlockBundle } from "@/app/actions/cards/query-actions";
import type { CardItem, TextCardRow } from "@/types/card";
import type { EntityProperties } from "@/types/properties";

const cardKeys = {
  items: (blockId: string) => ["cardItems", blockId] as const,
};

let optimisticSequence = 0;

function createOptimisticId(prefix: string): string {
  optimisticSequence += 1;
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${optimisticSequence}`;
  return `${prefix}-${randomPart}`;
}

function isOptimisticCard(card: Pick<CardItemView, "id" | "clientKey">): boolean {
  return String(card.clientKey ?? card.id).startsWith("optimistic-card-");
}

function getCardViewClientKey(card: Pick<CardItemView, "id" | "clientKey">): string {
  return String(card.clientKey ?? card.id);
}

function dedupeCardViews(cards: CardItemView[]): CardItemView[] {
  const seen = new Set<string>();
  const deduped: CardItemView[] = [];
  for (const card of cards) {
    const key = getCardViewClientKey(card);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(card);
  }
  return deduped;
}

function createEmptyEntityProperties(cardId: string): EntityProperties {
  const now = new Date().toISOString();
  return {
    id: `optimistic-props-${cardId}`,
    entity_type: "card",
    entity_id: cardId,
    workspace_id: "",
    status: null,
    priority: null,
    assignee_id: null,
    assignee_ids: [],
    due_date: null,
    tags: [],
    priorities: [],
    statuses: [],
    assignees: [],
    due_dates: [],
    tag_fields: [],
    created_at: now,
    updated_at: now,
  };
}

function mergeCardEntityProperties(
  cardId: string,
  current: EntityProperties | undefined,
  updates: Partial<Parameters<typeof updateCard>[1]> | Partial<Parameters<typeof createCard>[0]>
): EntityProperties {
  const base = current ? { ...current } : createEmptyEntityProperties(cardId);

  if (updates.status !== undefined) {
    base.status = updates.status ?? null;
    base.statuses = updates.status
      ? [{ id: `${cardId}-status-default`, entity_type: "card", entity_id: cardId, workspace_id: "", field_name: "Status", field_type: "status", value: updates.status, created_at: base.created_at, updated_at: base.updated_at }]
      : [];
  }
  if (updates.statuses !== undefined) {
    base.statuses = (updates.statuses ?? [])
      .filter((entry): entry is { field_name: string; value: "todo" | "in_progress" | "blocked" | "done" } => entry.value !== null)
      .map((entry, index) => ({
        id: `${cardId}-status-${index}`,
        entity_type: "card" as const,
        entity_id: cardId,
        workspace_id: "",
        field_name: entry.field_name,
        field_type: "status" as const,
        value: entry.value,
        created_at: base.created_at,
        updated_at: base.updated_at,
      }));
    base.status = base.statuses[0]?.value ?? null;
  }
  if (updates.priority !== undefined) {
    base.priority = updates.priority ?? null;
    base.priorities = updates.priority
      ? [{ id: `${cardId}-priority-default`, entity_type: "card", entity_id: cardId, workspace_id: "", field_name: "Priority", field_type: "priority", value: updates.priority, created_at: base.created_at, updated_at: base.updated_at }]
      : [];
  }
  if (updates.priorities !== undefined) {
    base.priorities = (updates.priorities ?? [])
      .filter((entry): entry is { field_name: string; value: "low" | "medium" | "high" | "urgent" } => entry.value !== null)
      .map((entry, index) => ({
        id: `${cardId}-priority-${index}`,
        entity_type: "card" as const,
        entity_id: cardId,
        workspace_id: "",
        field_name: entry.field_name,
        field_type: "priority" as const,
        value: entry.value,
        created_at: base.created_at,
        updated_at: base.updated_at,
      }));
    base.priority = base.priorities[0]?.value ?? null;
  }
  if (updates.assigneeIds !== undefined) {
    base.assignee_ids = updates.assigneeIds ?? [];
    base.assignee_id = base.assignee_ids[0] ?? null;
    base.assignees = base.assignee_ids.length
      ? [{ id: `${cardId}-assignee-default`, entity_type: "card", entity_id: cardId, workspace_id: "", field_name: "Assignee", field_type: "assignee", value: base.assignee_ids, created_at: base.created_at, updated_at: base.updated_at }]
      : [];
  }
  if (updates.assignees !== undefined) {
    base.assignees = (updates.assignees ?? []).map((entry, index) => ({
      id: `${cardId}-assignee-${index}`,
      entity_type: "card" as const,
      entity_id: cardId,
      workspace_id: "",
      field_name: entry.field_name,
      field_type: "assignee" as const,
      value: entry.value ?? [],
      created_at: base.created_at,
      updated_at: base.updated_at,
    }));
    const firstField = base.assignees[0]?.value ?? [];
    base.assignee_ids = firstField;
    base.assignee_id = firstField[0] ?? null;
  }
  if (updates.dueDate !== undefined) {
    base.due_date = updates.dueDate ?? null;
    base.due_dates = updates.dueDate
      ? [{ id: `${cardId}-due-date-default`, entity_type: "card", entity_id: cardId, workspace_id: "", field_name: "Due Date", field_type: "due_date", value: updates.dueDate, created_at: base.created_at, updated_at: base.updated_at }]
      : [];
  }
  if (updates.dueDates !== undefined) {
    base.due_dates = (updates.dueDates ?? [])
      .filter((entry): entry is { field_name: string; value: { start: string | null; end: string | null } } => entry.value !== null)
      .map((entry, index) => ({
        id: `${cardId}-due-date-${index}`,
        entity_type: "card" as const,
        entity_id: cardId,
        workspace_id: "",
        field_name: entry.field_name,
        field_type: "due_date" as const,
        value: entry.value,
        created_at: base.created_at,
        updated_at: base.updated_at,
      }));
    base.due_date = base.due_dates[0]?.value ?? null;
  }
  if (updates.tags !== undefined) {
    base.tags = updates.tags;
  }

  base.updated_at = new Date().toISOString();
  return base;
}

function applyCardUpdates(card: CardItemView, updates: Partial<Parameters<typeof updateCard>[1]>): CardItemView {
  const next = { ...card };

  if (updates.title !== undefined) next.title = updates.title.trim() || "Untitled card";
  if (updates.notes !== undefined) next.notes = updates.notes ?? null;
  if (updates.assetFileId !== undefined) next.assetFileId = updates.assetFileId ?? null;
  if (updates.assetFileIds !== undefined) next.assetFileIds = updates.assetFileIds;
  if (updates.assetKind !== undefined) next.assetKind = updates.assetKind ?? null;
  if (updates.assetCaption !== undefined) next.assetCaption = updates.assetCaption ?? null;
  if (updates.width !== undefined) next.width = updates.width;
  if (updates.height !== undefined) next.height = updates.height;
  if (updates.textRows !== undefined) next.textRows = updates.textRows as TextCardRow[];
  if (updates.status !== undefined) next.statuses = updates.status ? [{ field_name: "Status", value: updates.status }] : [];
  if (updates.statuses !== undefined) next.statuses = updates.statuses ?? [];
  if (updates.priority !== undefined) next.priorities = updates.priority ? [{ field_name: "Priority", value: updates.priority }] : [];
  if (updates.priorities !== undefined) next.priorities = updates.priorities ?? [];
  if (updates.assigneeIds !== undefined) {
    next.assigneeId = updates.assigneeIds?.[0] ?? null;
    next.assignees = (updates.assigneeIds?.length ?? 0) > 0 ? [{ field_name: "Assignee", value: updates.assigneeIds ?? [] }] : [];
  }
  if (updates.assignees !== undefined) {
    next.assignees = updates.assignees ?? [];
    const firstIds = updates.assignees?.[0]?.value ?? [];
    next.assigneeId = firstIds[0] ?? null;
  }
  if (updates.dueDate !== undefined) {
    next.startDate = updates.dueDate?.start ?? null;
    next.dueDate = updates.dueDate?.end ?? updates.dueDate?.start ?? null;
    next.dueDates = updates.dueDate ? [{ field_name: "Due Date", value: updates.dueDate }] : [];
  }
  if (updates.dueDates !== undefined) {
    next.dueDates = updates.dueDates ?? [];
    const firstDueDate = updates.dueDates?.[0]?.value ?? null;
    next.startDate = firstDueDate?.start ?? null;
    next.dueDate = firstDueDate?.end ?? firstDueDate?.start ?? null;
  }
  if (updates.tags !== undefined) next.tags = updates.tags;
  next.updated_at = new Date().toISOString();

  return next;
}

function toCardItemView(card: CardItem): CardItemView {
  return {
    id: card.id,
    title: card.title,
    notes: card.notes,
    assetFileId: card.asset_file_id,
    assetFileIds: Array.isArray(card.asset_file_ids) && card.asset_file_ids.length > 0 ? card.asset_file_ids : undefined,
    assetKind: card.asset_kind,
    assetCaption: card.asset_caption,
    width: card.width === "full" ? "full" : "half",
    height: card.height === "compact" ? "compact" : "tall",
    textRows: Array.isArray(card.text_rows) ? card.text_rows : [],
    assigneeId: card.assignee_id,
    assigneeName: null,
    dueDate: card.due_date,
    startDate: card.start_date,
    statuses: Array.isArray(card.statuses) ? card.statuses : [],
    priorities: Array.isArray(card.priorities) ? card.priorities : [],
    assignees: Array.isArray(card.assignees) ? card.assignees : [],
    dueDates: Array.isArray(card.due_dates) ? card.due_dates : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    comments: [],
    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

export function useCards(blockId: string, options?: { enabled?: boolean }) {
  const qc = useQueryClient();
  const queryKey = cardKeys.items(blockId);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/card-blocks/${blockId}/items`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || ("error" in result && result.error)) {
        throw new Error(result?.error ?? "Failed to load cards");
      }
      const bundle = result.data as CardsBlockBundle;
      const previous = qc.getQueryData<CardsBlockBundle>(queryKey);
      const clientKeyByCardId = new Map(
        (previous?.cards ?? []).map((card) => [card.id, card.clientKey ?? card.id])
      );
      const serverCards = bundle.cards.map((card) => ({
        ...card,
        clientKey: clientKeyByCardId.get(card.id) ?? card.clientKey ?? card.id,
      }));
      const serverClientKeys = new Set(serverCards.map((card) => card.clientKey ?? card.id));
      const pendingOptimisticCards = (previous?.cards ?? []).filter(
        (card) => isOptimisticCard(card) && !serverClientKeys.has(card.clientKey ?? card.id)
      );
      const pendingOptimisticProps = Object.fromEntries(
        pendingOptimisticCards
          .map((card) => {
            const key = String(card.id);
            const props = previous?.entityPropertiesByCardId?.[key];
            return props ? [key, props] : null;
          })
          .filter((entry): entry is [string, EntityProperties] => entry !== null)
      );

      return {
        ...bundle,
        cards: dedupeCardViews([...serverCards, ...pendingOptimisticCards]),
        entityPropertiesByCardId: {
          ...bundle.entityPropertiesByCardId,
          ...pendingOptimisticProps,
        },
      } as CardsBlockBundle;
    },
    enabled: (options?.enabled ?? true) && Boolean(blockId),
  });
}

export function useCreateCard(blockId: string) {
  const qc = useQueryClient();
  type CreateCardInput = Parameters<typeof createCard>[0] & { clientKey?: string };
  return useMutation({
    mutationFn: ({ clientKey: _clientKey, ...input }: CreateCardInput) => createCard(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
      const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
      const tempId = input.clientKey ?? createOptimisticId("optimistic-card");
      const now = new Date().toISOString();
      const optimisticCard: CardItemView = {
        id: tempId,
        clientKey: tempId,
        title: input.title?.trim() || "Untitled card",
        notes: input.notes ?? null,
        assetFileId: input.assetFileId ?? (input.assetFileIds?.[0] ?? null),
        assetFileIds: input.assetFileIds,
        assetKind: input.assetKind ?? null,
        assetCaption: input.assetCaption ?? null,
        width: input.width ?? "half",
        height: input.height ?? "tall",
        textRows: input.textRows ?? [],
        assigneeId: input.assigneeIds?.[0] ?? null,
        assigneeName: null,
        dueDate: input.dueDate?.end ?? input.dueDate?.start ?? null,
        startDate: input.dueDate?.start ?? null,
        statuses: input.statuses ?? (input.status ? [{ field_name: "Status", value: input.status }] : []),
        priorities: input.priorities ?? (input.priority ? [{ field_name: "Priority", value: input.priority }] : []),
        assignees: input.assignees ?? ((input.assigneeIds?.length ?? 0) > 0 ? [{ field_name: "Assignee", value: input.assigneeIds ?? [] }] : []),
        dueDates: input.dueDates ?? (input.dueDate ? [{ field_name: "Due Date", value: input.dueDate }] : []),
        tags: input.tags ?? [],
        comments: [],
        created_at: now,
        updated_at: now,
      };

      qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => ({
        cards: dedupeCardViews([...(current?.cards ?? []), optimisticCard]),
        entityPropertiesByCardId: {
          ...(current?.entityPropertiesByCardId ?? {}),
          [tempId]: mergeCardEntityProperties(tempId, undefined, input),
        },
      }));

      return { previous, tempId };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(cardKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, _input, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
        return;
      }

      if (context?.tempId) {
        qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
          if (!current) return current;
          const { [context.tempId]: optimisticProps, ...restProps } = current.entityPropertiesByCardId;
          const matchingCards = current.cards.filter(
            (card) => card.id === context.tempId || card.clientKey === context.tempId
          );
          const nextCard = {
            ...toCardItemView(result.data),
            title: matchingCards[matchingCards.length - 1]?.title ?? toCardItemView(result.data).title,
            notes: matchingCards[matchingCards.length - 1]?.notes ?? toCardItemView(result.data).notes,
            clientKey:
              matchingCards[matchingCards.length - 1]?.clientKey
              ?? context.tempId
              ?? result.data.id,
          };
          const cards: CardItemView[] = [];
          let inserted = false;
          for (const card of current.cards) {
            if (card.id === context.tempId || card.clientKey === context.tempId) {
              if (!inserted) {
                cards.push(nextCard);
                inserted = true;
              }
              continue;
            }
            cards.push(card);
          }
          if (!inserted) {
            cards.push(nextCard);
          }
          return {
            cards: dedupeCardViews(cards),
            entityPropertiesByCardId: optimisticProps
              ? { ...restProps, [result.data.id]: { ...optimisticProps, entity_id: result.data.id } }
              : restProps,
          };
        });
      }
    },
  });
}

export function useUpdateCard(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; updates: Parameters<typeof updateCard>[1] }) =>
      updateCard(input.cardId, input.updates),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
      const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
      qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
        if (!current) return current;
        return {
          cards: current.cards.map((card) =>
            card.id === input.cardId ? applyCardUpdates(card, input.updates) : card
          ),
          entityPropertiesByCardId: {
            ...current.entityPropertiesByCardId,
            [input.cardId]: mergeCardEntityProperties(
              input.cardId,
              current.entityPropertiesByCardId[input.cardId],
              input.updates
            ),
          },
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(cardKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, input, context) => {
      if ("error" in result) {
        if (context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
        return;
      }

      qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
        if (!current) return current;
        return {
          cards: current.cards.map((card) =>
            card.id === input.cardId
              ? {
                  ...card,
                  ...toCardItemView(result.data),
                  clientKey: card.clientKey ?? card.id,
                  comments: card.comments ?? [],
                }
              : card
          ),
          entityPropertiesByCardId: {
            ...current.entityPropertiesByCardId,
            [input.cardId]: mergeCardEntityProperties(
              input.cardId,
              current.entityPropertiesByCardId[input.cardId],
              input.updates
            ),
          },
        };
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tableRows"] });
      qc.invalidateQueries({ queryKey: ["tableBootstrap"] });
    },
  });
}

export function useDeleteCard(blockId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => deleteCard(cardId),
    onMutate: async (cardId) => {
      await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
      const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
      qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
        if (!current) return current;
        const restProps = { ...current.entityPropertiesByCardId };
        delete restProps[cardId];
        return {
          cards: current.cards.filter((card) => card.id !== cardId),
          entityPropertiesByCardId: restProps,
        };
      });
      return { previous };
    },
    onError: (_error, _cardId, context) => {
      if (context?.previous) {
        qc.setQueryData(cardKeys.items(blockId), context.previous);
      }
    },
    onSuccess: (result, _cardId, context) => {
      if ("error" in result && context?.previous) {
        qc.setQueryData(cardKeys.items(blockId), context.previous);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
  });
}

export function useCardComments(blockId: string) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: createCardComment,
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
        const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
        const tempId = createOptimisticId("optimistic-card-comment");
        const optimisticComment: CardCommentView = {
          id: tempId,
          author: "You",
          text: input.text,
          timestamp: new Date().toISOString(),
        };
        qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
          if (!current) return current;
          return {
            ...current,
            cards: current.cards.map((card) =>
              card.id === input.cardId
                ? { ...card, comments: [...(card.comments ?? []), optimisticComment] }
                : card
            ),
          };
        });
        return { previous };
      },
      onError: (_error, _input, context) => {
        if (context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSuccess: (result, _input, context) => {
        if ("error" in result && context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
    update: useMutation({
      mutationFn: (input: { commentId: string; updates: Parameters<typeof updateCardComment>[1] }) =>
        updateCardComment(input.commentId, input.updates),
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
        const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
        qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
          if (!current) return current;
          return {
            ...current,
            cards: current.cards.map((card) => ({
              ...card,
              comments: (card.comments ?? []).map((comment) =>
                comment.id === input.commentId
                  ? { ...comment, text: input.updates.text ?? comment.text }
                  : comment
              ),
            })),
          };
        });
        return { previous };
      },
      onError: (_error, _input, context) => {
        if (context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSuccess: (result, _input, context) => {
        if ("error" in result && context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
    remove: useMutation({
      mutationFn: (commentId: string) => deleteCardComment(commentId),
      onMutate: async (commentId) => {
        await qc.cancelQueries({ queryKey: cardKeys.items(blockId) });
        const previous = qc.getQueryData<CardsBlockBundle>(cardKeys.items(blockId));
        qc.setQueryData<CardsBlockBundle>(cardKeys.items(blockId), (current) => {
          if (!current) return current;
          return {
            ...current,
            cards: current.cards.map((card) => ({
              ...card,
              comments: (card.comments ?? []).filter((comment) => comment.id !== commentId),
            })),
          };
        });
        return { previous };
      },
      onError: (_error, _commentId, context) => {
        if (context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSuccess: (result, _commentId, context) => {
        if ("error" in result && context?.previous) {
          qc.setQueryData(cardKeys.items(blockId), context.previous);
        }
      },
      onSettled: () => qc.invalidateQueries({ queryKey: cardKeys.items(blockId) }),
    }),
  };
}
