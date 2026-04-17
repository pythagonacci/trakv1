"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Block, updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { useBatchFileUrls } from "@/lib/hooks/use-tab-data";
import { useCardComments, useCards, useCreateCard, useDeleteCard, useUpdateCard } from "@/lib/hooks/use-card-queries";
import { useCardCountContext } from "./card-count-context";
import { useEntitiesProperties, useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { AssigneeBadge, DueDateBadge, PriorityBadge, PropertyMenu, StatusBadge, TagBadge } from "@/components/properties";
import { cn } from "@/lib/utils";
import type { DueDateRange, NamedField, Priority, Status } from "@/types/properties";
import {
  type CardHeight,
  type CardWidth,
  clampGridAssetMediaPx,
  clampGridColumns,
  MAX_GRID_ASSET_MEDIA_PX,
  MAX_GRID_COLUMNS,
  MIN_GRID_ASSET_MEDIA_PX,
  MIN_GRID_COLUMNS,
} from "@/types/card";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Image as ImageIcon,
  LayoutList,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Settings,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import type { CardsBlockBundle } from "@/app/actions/cards/query-actions";
import TextCardsBlock from "./text-cards-block";

interface CardsBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
}

type ViewMode = "grid" | "list";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatDate(value?: string | null) {
  if (!value) return "No date";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function getInitials(name?: string | null) {
  const safe = (name ?? "").trim();
  if (!safe) return "?";
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getCardClientKey(card: { id: string; clientKey?: string }) {
  return card.clientKey ?? card.id;
}

function isPersistedCardId(cardId: string | null | undefined) {
  return Boolean(cardId) && !String(cardId).startsWith("optimistic-card-");
}

function createOptimisticCardClientKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `optimistic-card-${crypto.randomUUID()}`
    : `optimistic-card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function UploadPlaceholder({ large = false, onClick }: { large?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f7f4f0] text-[#aaa] transition-colors hover:bg-[#f2ede7]"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-[#eee8e0]",
          large ? "h-11 w-11" : "h-8 w-8"
        )}
      >
        <Upload className={cn("text-[#999]", large ? "h-[18px] w-[18px]" : "h-[14px] w-[14px]")} strokeWidth={1.8} />
      </span>
      <span className={cn("font-medium", large ? "text-xs" : "text-[11px]")}>Upload asset</span>
    </button>
  );
}

function AssetLoadingPlaceholder({ large = false }: { large?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f7f4f0] text-[#aaa]">
      <Loader2 className={cn("animate-spin text-[#999]", large ? "h-5 w-5" : "h-4 w-4")} strokeWidth={1.8} />
      <span className={cn("font-medium", large ? "text-xs" : "text-[11px]")}>Loading asset</span>
    </div>
  );
}

function AssetUnavailablePlaceholder({
  large = false,
  onRetry,
  onReplace,
}: {
  large?: boolean;
  onRetry: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f7f4f0] px-4 text-center text-[#8e857c]">
      <ImageIcon className={cn("text-[#b5aca2]", large ? "h-5 w-5" : "h-4 w-4")} strokeWidth={1.8} />
      <span className={cn("font-medium", large ? "text-xs" : "text-[11px]")}>Asset could not load</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          className="rounded bg-white px-2 py-1 text-[11px] font-medium text-[#1a1814] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onReplace();
          }}
          className="rounded bg-white px-2 py-1 text-[11px] font-medium text-[#1a1814] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          Replace
        </button>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CardsBlock({ block, workspaceId, projectId, onUpdate }: CardsBlockProps) {
  const blockContent = (block.content ?? {}) as Record<string, unknown>;
  const cardVariant = blockContent.cardVariant === "text" ? "text" : "asset";
  if (cardVariant === "text") {
    return <TextCardsBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
  }

  return <AssetCardsBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
}

function AssetCardsBlock({ block, workspaceId, projectId, onUpdate }: CardsBlockProps) {
  const cardsBlockId = block.id;
  const blockContent = (block.content ?? {}) as Record<string, unknown>;
  const viewMode = (blockContent.viewMode === "list" ? "list" : "grid") as ViewMode;
  const blockTitle = typeof blockContent.title === "string" && blockContent.title.trim() ? blockContent.title : "Cards";

  const initialHeightPx =
    typeof blockContent.heightPx === "number" && blockContent.heightPx > 0 ? blockContent.heightPx : null;
  const [listHeightPx, setListHeightPx] = useState<number | null>(initialHeightPx);
  const listHeightRef = useRef<number | null>(initialHeightPx);

  const gridColumns = clampGridColumns(blockContent.gridColumns);
  const initialGridAssetHeightPx = clampGridAssetMediaPx(blockContent.gridAssetHeightPx, 320);
  const initialGridAssetWidthPx = clampGridAssetMediaPx(
    blockContent.gridAssetWidthPx ?? initialGridAssetHeightPx,
    initialGridAssetHeightPx
  );
  const [gridAssetHeightPx, setGridAssetHeightPx] = useState(initialGridAssetHeightPx);
  const gridAssetHeightRef = useRef(initialGridAssetHeightPx);
  const [gridAssetWidthPx, setGridAssetWidthPx] = useState(initialGridAssetWidthPx);
  const gridAssetWidthRef = useRef(initialGridAssetWidthPx);

  useEffect(() => {
    if (typeof blockContent.heightPx === "number" && blockContent.heightPx > 0) {
      setListHeightPx(blockContent.heightPx);
      listHeightRef.current = blockContent.heightPx;
    }
  }, [blockContent.heightPx]);

  useEffect(() => {
    const nextH = clampGridAssetMediaPx(blockContent.gridAssetHeightPx, 320);
    setGridAssetHeightPx(nextH);
    gridAssetHeightRef.current = nextH;
    const nextW = clampGridAssetMediaPx(blockContent.gridAssetWidthPx ?? nextH, nextH);
    setGridAssetWidthPx(nextW);
    gridAssetWidthRef.current = nextW;
  }, [blockContent.gridAssetHeightPx, blockContent.gridAssetWidthPx]);

  const { data: bundle } = useCards(cardsBlockId);
  const cards = useMemo(() => bundle?.cards ?? [], [bundle?.cards]);
  const cardsRef = useRef(cards);
  const effectiveGridColumns = cards.length <= 1 ? 1 : gridColumns;
  const isUniformAssetGrid = viewMode === "grid" && cards.length > 1;
  const setCardCount = useCardCountContext()?.setCardCount;

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    setCardCount?.(cardsBlockId, cards.length);
  }, [cardsBlockId, cards.length, setCardCount]);
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const { data: queriedEntityPropertiesByCardId = {} } = useEntitiesProperties("card", cardIds, workspaceId);
  const entityPropertiesByCardId = useMemo(
    () => ({
      ...(bundle?.entityPropertiesByCardId ?? {}),
      ...queriedEntityPropertiesByCardId,
    }),
    [bundle?.entityPropertiesByCardId, queriedEntityPropertiesByCardId]
  );
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const createCardMutation = useCreateCard(cardsBlockId);
  const updateCardMutation = useUpdateCard(cardsBlockId);
  const deleteCardMutation = useDeleteCard(cardsBlockId);
  const pendingCreateCardPromisesRef = useRef(new Map<string, ReturnType<typeof createCardMutation.mutateAsync>>());
  const cardComments = useCardComments(cardsBlockId);
  const queryClient = useQueryClient();
  const cardsQueryKey = ["cardItems", cardsBlockId] as const;

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [renamingBlock, setRenamingBlock] = useState(false);
  const [blockTitleDraft, setBlockTitleDraft] = useState(blockTitle);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const [propertyMenuCardId, setPropertyMenuCardId] = useState<string | null>(null);
  const [expandedGridCardDetails, setExpandedGridCardDetails] = useState<Record<string, boolean>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [uploadTargetCardId, setUploadTargetCardId] = useState<string | null>(null);
  const [slideIndexByCardId, setSlideIndexByCardId] = useState<Record<string, number>>({});
  const [pendingCardUpdatesByClientKey, setPendingCardUpdatesByClientKey] = useState<
    Record<string, Partial<{ title: string; notes: string }>>
  >({});
  const notesTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingCardUpdatePersistingRef = useRef<Set<string>>(new Set());
  const blockTitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBlockTitleDraft(blockTitle);
  }, [blockTitle]);

  useEffect(() => {
    if (renamingBlock) {
      blockTitleInputRef.current?.focus();
      blockTitleInputRef.current?.select();
    }
  }, [renamingBlock]);

  useEffect(() => {
    if (
      selectedCardId &&
      !cards.some((card) => getCardClientKey(card) === selectedCardId || card.id === selectedCardId)
    ) {
      setSelectedCardId(null);
    }
  }, [cards, selectedCardId]);

  const selectedCard = cards.find((card) => getCardClientKey(card) === selectedCardId || card.id === selectedCardId) ?? null;
  const selectedCardClientKey = selectedCard ? getCardClientKey(selectedCard) : null;

  const patchCardInCache = (cardClientKey: string, updates: Partial<{ title: string; notes: string }>) => {
    queryClient.setQueryData<CardsBlockBundle>(cardsQueryKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        cards: current.cards.map((card) =>
          getCardClientKey(card) === cardClientKey
            ? {
                ...card,
                ...(updates.title !== undefined ? { title: updates.title } : {}),
                ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
              }
            : card
        ),
      };
    });
  };

  useEffect(() => {
    const pendingEntries = Object.entries(pendingCardUpdatesByClientKey);
    if (pendingEntries.length === 0) return;

    pendingEntries.forEach(([cardClientKey, pendingUpdates]) => {
      if (pendingCardUpdatePersistingRef.current.has(cardClientKey)) return;
      const resolvedCard = cards.find((card) => getCardClientKey(card) === cardClientKey);
      if (!resolvedCard || !isPersistedCardId(resolvedCard.id)) return;

      const updates: Partial<{ title: string; notes: string }> = {};
      if (pendingUpdates.title !== undefined && pendingUpdates.title !== resolvedCard.title) {
        updates.title = pendingUpdates.title;
      }
      if (pendingUpdates.notes !== undefined && pendingUpdates.notes !== (resolvedCard.notes ?? "")) {
        updates.notes = pendingUpdates.notes;
      }

      if (Object.keys(updates).length === 0) {
        setPendingCardUpdatesByClientKey((prev) => {
          if (!(cardClientKey in prev)) return prev;
          const next = { ...prev };
          delete next[cardClientKey];
          return next;
        });
        return;
      }

      pendingCardUpdatePersistingRef.current.add(cardClientKey);
      void updateCardMutation
        .mutateAsync({
          cardId: resolvedCard.id,
          updates,
        })
        .finally(() => {
          pendingCardUpdatePersistingRef.current.delete(cardClientKey);
          setPendingCardUpdatesByClientKey((prev) => {
            if (!(cardClientKey in prev)) return prev;
            const next = { ...prev };
            delete next[cardClientKey];
            return next;
          });
        });
    });
  }, [cards, pendingCardUpdatesByClientKey, updateCardMutation]);

  const assetFileIds = useMemo(
    () =>
      cards.flatMap((card) => {
        const ids = card.assetFileIds?.length
          ? card.assetFileIds
          : card.assetFileId
            ? [card.assetFileId]
            : [];
        return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
      }),
    [cards]
  );
  const {
    data: fileUrls = {},
    isFetching: fileUrlsFetching,
    isError: fileUrlsError,
    refetch: refetchFileUrls,
  } = useBatchFileUrls(assetFileIds);

  const getMemberName = (memberId?: string | null) => {
    if (!memberId) return null;
    const member = workspaceMembers.find((entry) => entry.id === memberId || entry.user_id === memberId);
    return member?.name || member?.email || null;
  };

  const getCardProperties = (card: (typeof cards)[number]) => {
    return entityPropertiesByCardId[card.id] ?? null;
  };

  const normalizeStatusValue = (value?: string | null): Status | null => {
    if (value === "todo" || value === "in_progress" || value === "blocked" || value === "done") {
      return value;
    }
    return null;
  };

  const normalizePriorityValue = (value?: string | null): Priority | null => {
    if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
      return value;
    }
    return null;
  };

  const getEffectiveStatusFields = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    const rows =
      props?.statuses?.map((entry: NamedField<Status>) => ({
        id: entry.id,
        field_name: entry.field_name,
        value: entry.value,
      })) ??
      [];

    const fallbackRows =
      rows.length > 0
        ? rows
        : (card.statuses ?? []).map((entry, index) => ({
            id: `card-status-${card.id}-${index}`,
            field_name: entry.field_name,
            value: normalizeStatusValue(entry.value),
          }));

    const seen = new Set<string>();
    const normalized = fallbackRows
      .map((entry: { id: string; field_name: string; value: unknown }) => {
        const fieldName = String(entry.field_name ?? "").trim() || "Status";
        const value = normalizeStatusValue(entry.value as string | null | undefined);
        if (!value) return null;
        const key = fieldName.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: entry.id,
          field_name: fieldName,
          value,
        };
      })
      .filter((entry: { id: string; field_name: string; value: Status } | null): entry is { id: string; field_name: string; value: Status } => Boolean(entry));

    if (normalized.length > 0) return normalized;
    if (props?.status) {
      return [{ id: `card-status-default-${card.id}`, field_name: "Status", value: props.status }];
    }
    return [];
  };

  const getEffectivePriorityFields = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    const rows =
      props?.priorities?.map((entry: NamedField<Priority>) => ({
        id: entry.id,
        field_name: entry.field_name,
        value: entry.value,
      })) ??
      [];

    const fallbackRows =
      rows.length > 0
        ? rows
        : (card.priorities ?? []).map((entry, index) => ({
            id: `card-priority-${card.id}-${index}`,
            field_name: entry.field_name,
            value: normalizePriorityValue(entry.value),
          }));

    const seen = new Set<string>();
    const normalized = fallbackRows
      .map((entry: { id: string; field_name: string; value: unknown }) => {
        const fieldName = String(entry.field_name ?? "").trim() || "Priority";
        const value = normalizePriorityValue(entry.value as string | null | undefined);
        if (!value) return null;
        const key = fieldName.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: entry.id,
          field_name: fieldName,
          value,
        };
      })
      .filter((entry: { id: string; field_name: string; value: Priority } | null): entry is { id: string; field_name: string; value: Priority } => Boolean(entry));

    if (normalized.length > 0) return normalized;
    if (props?.priority) {
      return [{ id: `card-priority-default-${card.id}`, field_name: "Priority", value: props.priority }];
    }
    return [];
  };

  const getEffectiveTags = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    if (Array.isArray(props?.tags) && props.tags.length > 0) {
      return props.tags;
    }
    return Array.isArray(card.tags) ? card.tags : [];
  };

  const getEffectiveAssigneeFields = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    const rows =
      props?.assignees?.map((entry: NamedField<string[]>) => ({
        id: entry.id,
        field_name: entry.field_name,
        value: Array.isArray(entry.value) ? entry.value : [],
      })) ??
      [];

    const fallbackRows =
      rows.length > 0
        ? rows
        : (card.assignees ?? []).map((entry, index) => ({
            id: `card-assignee-${card.id}-${index}`,
            field_name: entry.field_name,
            value: Array.isArray(entry.value) ? entry.value.filter((memberId): memberId is string => typeof memberId === "string" && memberId.trim().length > 0) : [],
          }));

    const seen = new Set<string>();
    const normalized = fallbackRows
      .map((entry: { id: string; field_name: string; value: string[] }) => {
        const fieldName = String(entry.field_name ?? "").trim() || "Assignee";
        const value = entry.value.filter((memberId): memberId is string => typeof memberId === "string" && memberId.trim().length > 0);
        if (value.length === 0) return null;
        const key = fieldName.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: entry.id,
          field_name: fieldName,
          value,
        };
      })
      .filter((entry: { id: string; field_name: string; value: string[] } | null): entry is { id: string; field_name: string; value: string[] } => Boolean(entry));

    if (normalized.length > 0) return normalized;

    const fallbackIds = props?.assignee_ids?.length
      ? props.assignee_ids
      : props?.assignee_id
        ? [props.assignee_id]
        : card.assigneeId
          ? [card.assigneeId]
          : [];

    if (fallbackIds.length > 0) {
      return [{ id: `card-assignee-default-${card.id}`, field_name: "Assignee", value: fallbackIds }];
    }

    return [];
  };

  const normalizeDueDateRange = (value: unknown): DueDateRange | null => {
    if (!value || typeof value !== "object") return null;
    const candidate = value as { start?: unknown; end?: unknown };
    const start = typeof candidate.start === "string" && candidate.start.trim().length > 0 ? candidate.start : null;
    const end = typeof candidate.end === "string" && candidate.end.trim().length > 0 ? candidate.end : null;
    if (!start && !end) return null;
    return { start, end };
  };

  const getEffectiveDueDateFields = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    const rows =
      props?.due_dates?.map((entry: NamedField<DueDateRange>) => ({
        id: entry.id,
        field_name: entry.field_name,
        value: entry.value,
      })) ??
      [];

    const fallbackRows =
      rows.length > 0
        ? rows
        : (card.dueDates ?? []).map((entry, index) => ({
            id: `card-due-date-${card.id}-${index}`,
            field_name: entry.field_name,
            value: normalizeDueDateRange(entry.value),
          }));

    const seen = new Set<string>();
    const normalized = fallbackRows
      .map((entry: { id: string; field_name: string; value: unknown }) => {
        const fieldName = String(entry.field_name ?? "").trim() || "Due Date";
        const value = normalizeDueDateRange(entry.value);
        if (!value) return null;
        const key = fieldName.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: entry.id,
          field_name: fieldName,
          value,
        };
      })
      .filter((entry: { id: string; field_name: string; value: DueDateRange } | null): entry is { id: string; field_name: string; value: DueDateRange } => Boolean(entry));

    if (normalized.length > 0) return normalized;

    const fallbackRange = props?.due_date ?? (card.startDate || card.dueDate ? { start: card.startDate ?? card.dueDate ?? null, end: card.dueDate ?? card.startDate ?? null } : null);
    if (fallbackRange) {
      return [{ id: `card-due-date-default-${card.id}`, field_name: "Due Date", value: fallbackRange }];
    }

    return [];
  };

  const getMemberNames = (memberIds: string[]) => {
    return memberIds
      .map((memberId) => getMemberName(memberId))
      .filter((name): name is string => Boolean(name));
  };

  const hasGridDetails = (card: (typeof cards)[number]) =>
    getEffectiveStatusFields(card).length > 0 ||
    getEffectivePriorityFields(card).length > 0 ||
    getEffectiveTags(card).length > 0 ||
    getPrimaryAssigneeName(card) !== null ||
    getPrimaryDueDate(card) !== null;

  const showStatusColumn = useMemo(
    () => cards.some((card) => getEffectiveStatusFields(card).length > 0),
    [cards, entityPropertiesByCardId]
  );

  const showPriorityColumn = useMemo(
    () => cards.some((card) => getEffectivePriorityFields(card).length > 0),
    [cards, entityPropertiesByCardId]
  );

  const showTagsColumn = useMemo(
    () => cards.some((card) => getEffectiveTags(card).length > 0),
    [cards, entityPropertiesByCardId]
  );

  const renderInlinePropertyBadges = (card: (typeof cards)[number]) => {
    const statusFields = getEffectiveStatusFields(card);
    const priorityFields = getEffectivePriorityFields(card);
    const tags = getEffectiveTags(card);

    if (statusFields.length === 0 && priorityFields.length === 0 && tags.length === 0) {
      return null;
    }

    return (
      <>
        {statusFields.map((field: { id: string; field_name: string; value: Status }) => (
          <StatusBadge
            key={field.id}
            status={field.value}
            label={field.field_name}
          />
        ))}
        {priorityFields.map((field: { id: string; field_name: string; value: Priority }) => (
          <PriorityBadge
            key={field.id}
            priority={field.value}
            label={field.field_name}
          />
        ))}
        {tags.map((tag: string, index: number) => (
          <TagBadge key={`${card.id}-tag-${tag}-${index}`} tag={tag} />
        ))}
      </>
    );
  };

  const getPrimaryAssigneeName = (card: (typeof cards)[number]) => {
    if (card.assigneeName) return card.assigneeName;
    const props = getCardProperties(card);
    const assigneeId = props?.assignee_ids?.[0] ?? props?.assignee_id ?? card.assigneeId ?? null;
    return getMemberName(assigneeId);
  };

  const getPrimaryDueDate = (card: (typeof cards)[number]) => {
    const props = getCardProperties(card);
    return props?.due_date?.end ?? props?.due_date?.start ?? card.dueDate ?? null;
  };

  const handleUpdateViewMode = async (nextViewMode: ViewMode) => {
    if (nextViewMode === viewMode) return;
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...block.content,
        title: blockTitleDraft,
        viewMode: nextViewMode,
      },
    });
    if ("data" in result && result.data) onUpdate?.(result.data);
  };

  const handleGridColumnsChange = async (nextCols: number) => {
    const n = Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, Math.round(nextCols)));
    if (n === clampGridColumns(blockContent.gridColumns)) return;
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...block.content,
        title: blockTitleDraft,
        viewMode,
        gridColumns: n,
      },
    });
    if ("data" in result && result.data) onUpdate?.(result.data);
  };

  const handleBlockTitleSave = async () => {
    const nextTitle = blockTitleDraft.trim() || "Cards";
    setRenamingBlock(false);
    if (nextTitle === blockTitle) return;
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...block.content,
        title: nextTitle,
        viewMode,
      },
    });
    if ("data" in result && result.data) onUpdate?.(result.data);
  };

  const handleCreateCard = async () => {
    // Optimistically expand block to full width when adding second card
    setCardCount?.(cardsBlockId, cards.length + 1);
    const clientKey = createOptimisticCardClientKey();
    setSelectedCardId(clientKey);
    const createPromise = createCardMutation.mutateAsync({
      cardsBlockId,
      clientKey,
      title: "Untitled card",
      status: "todo",
      width: "half",
      height: "tall",
    });
    pendingCreateCardPromisesRef.current.set(clientKey, createPromise);
    try {
      await createPromise;
    } finally {
      pendingCreateCardPromisesRef.current.delete(clientKey);
    }
  };

  const [uploadMode, setUploadMode] = useState<"replace" | "add">("replace");

  const getCardAssetIds = (card: (typeof cards)[number]) =>
    card.assetFileIds?.length ? card.assetFileIds : card.assetFileId ? [card.assetFileId] : [];

  const findCardByUploadKey = (cardKey: string) =>
    cardsRef.current.find((card) => card.id === cardKey || getCardClientKey(card) === cardKey) ?? null;

  const resolveUploadCardTarget = async (cardKey: string) => {
    let card = findCardByUploadKey(cardKey);
    if (card && isPersistedCardId(card.id)) {
      return { cardId: card.id, card, cardClientKey: getCardClientKey(card) };
    }

    const pendingCreate = pendingCreateCardPromisesRef.current.get(cardKey);
    if (pendingCreate) {
      const result = await pendingCreate;
      if ("error" in result) {
        throw new Error(result.error);
      }
      card = findCardByUploadKey(cardKey) ?? findCardByUploadKey(result.data.id);
      return {
        cardId: result.data.id,
        card,
        cardClientKey: card ? getCardClientKey(card) : cardKey,
      };
    }

    for (let i = 0; i < 20; i += 1) {
      await delay(100);
      card = findCardByUploadKey(cardKey);
      if (card && isPersistedCardId(card.id)) {
        return { cardId: card.id, card, cardClientKey: getCardClientKey(card) };
      }
    }

    throw new Error("Card is still saving. Please try again in a moment.");
  };

  const openUploadPicker = (cardKey: string, mode: "replace" | "add" = "replace") => {
    setUploadTargetCardId(cardKey);
    setUploadMode(mode);
    fileInputRef.current?.click();
  };

  const uploadAsset = async (cardKey: string, file: File, mode: "replace" | "add" = "replace") => {
    if (!workspaceId || !projectId) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Please select an image or video file");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    let target: Awaited<ReturnType<typeof resolveUploadCardTarget>>;
    try {
      target = await resolveUploadCardTarget(cardKey);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save this asset to the card");
      return;
    }

    const supabase = createClient();
    const fileId = crypto.randomUUID();
    const extension = file.name.split(".").pop() || "bin";
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("files").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const recordResult = await createFileRecord({
      fileId,
      workspaceId,
      projectId,
      blockId: block.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath,
    });
    if (recordResult.error) {
      await supabase.storage.from("files").remove([storagePath]);
      alert(recordResult.error);
      return;
    }

    const card = target.card;
    const existingIds = card ? getCardAssetIds(card) : [];
    const currentIndex = card
      ? Math.min(slideIndexByCardId[target.cardClientKey] ?? 0, Math.max(0, existingIds.length - 1))
      : 0;

    let nextAssetFileIds: string[];
    if (mode === "add") {
      nextAssetFileIds = [...existingIds, fileId];
    } else if (existingIds.length > 1) {
      nextAssetFileIds = existingIds.map((id, i) => (i === currentIndex ? fileId : id));
    } else {
      nextAssetFileIds = [fileId];
    }

    const updateResult = await updateCardMutation.mutateAsync({
      cardId: target.cardId,
      updates: {
        assetFileIds: nextAssetFileIds,
        assetFileId: nextAssetFileIds[0],
        assetKind: file.type.startsWith("video/") ? "video" : "image",
      },
    });
    if ("error" in updateResult) {
      alert(updateResult.error);
      return;
    }

    cardsRef.current = cardsRef.current.map((currentCard) =>
      currentCard.id === target.cardId || getCardClientKey(currentCard) === target.cardClientKey
        ? {
            ...currentCard,
            assetFileId: nextAssetFileIds[0] ?? null,
            assetFileIds: nextAssetFileIds,
            assetKind: file.type.startsWith("video/") ? "video" : "image",
          }
        : currentCard
    );

    setSlideIndexByCardId((prev) => ({
      ...prev,
      [target.cardClientKey]:
        mode === "add" ? Math.max(0, nextAssetFileIds.length - 1) : Math.min(currentIndex, nextAssetFileIds.length - 1),
    }));
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    const cardId = uploadTargetCardId;
    const mode = uploadMode;
    event.target.value = "";
    if (!cardId) return;
    for (let i = 0; i < files.length; i++) {
      await uploadAsset(cardId, files[i], i === 0 ? mode : "add");
    }
  };

  const handleNotesChange = (cardId: string, draftKey: string, value: string) => {
    setNotesDraft((prev) => ({ ...prev, [draftKey]: value }));
    patchCardInCache(draftKey, { notes: value });
    const existing = notesTimeoutRef.current[draftKey];
    if (existing) clearTimeout(existing);
    notesTimeoutRef.current[draftKey] = setTimeout(() => {
      if (!isPersistedCardId(cardId)) {
        setPendingCardUpdatesByClientKey((prev) => ({
          ...prev,
          [draftKey]: { ...(prev[draftKey] ?? {}), notes: value },
        }));
        return;
      }
      void updateCardMutation.mutateAsync({
        cardId,
        updates: { notes: value },
      });
    }, 400);
  };

  const commitCardTitle = (cardId: string, cardClientKey: string, nextTitle: string) => {
    patchCardInCache(cardClientKey, { title: nextTitle });
    if (!isPersistedCardId(cardId)) {
      setPendingCardUpdatesByClientKey((prev) => ({
        ...prev,
        [cardClientKey]: { ...(prev[cardClientKey] ?? {}), title: nextTitle },
      }));
      return;
    }
    void updateCardMutation.mutateAsync({
      cardId,
      updates: { title: nextTitle },
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isUniformAssetGrid) {
      const startH =
        gridAssetHeightRef.current > 0 ? gridAssetHeightRef.current : initialGridAssetHeightPx;
      const startW =
        gridAssetWidthRef.current > 0 ? gridAssetWidthRef.current : initialGridAssetWidthPx;
      const state = { startX: e.clientX, startY: e.clientY, startH, startW };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        const nextH = Math.min(
          MAX_GRID_ASSET_MEDIA_PX,
          Math.max(MIN_GRID_ASSET_MEDIA_PX, state.startH + dy)
        );
        const nextW = Math.min(
          MAX_GRID_ASSET_MEDIA_PX,
          Math.max(MIN_GRID_ASSET_MEDIA_PX, state.startW + dx)
        );
        setGridAssetHeightPx(nextH);
        gridAssetHeightRef.current = nextH;
        setGridAssetWidthPx(nextW);
        gridAssetWidthRef.current = nextW;
      };

      const handleMouseUp = async () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        const clampedH = Math.round(
          Math.min(
            MAX_GRID_ASSET_MEDIA_PX,
            Math.max(MIN_GRID_ASSET_MEDIA_PX, gridAssetHeightRef.current ?? state.startH)
          )
        );
        const clampedW = Math.round(
          Math.min(
            MAX_GRID_ASSET_MEDIA_PX,
            Math.max(MIN_GRID_ASSET_MEDIA_PX, gridAssetWidthRef.current ?? state.startW)
          )
        );

        setGridAssetHeightPx(clampedH);
        gridAssetHeightRef.current = clampedH;
        setGridAssetWidthPx(clampedW);
        gridAssetWidthRef.current = clampedW;

        if (!block.id.startsWith("temp-")) {
          const result = await updateBlock({
            blockId: block.id,
            content: {
              ...block.content,
              title: blockTitleDraft,
              viewMode,
              gridAssetHeightPx: clampedH,
              gridAssetWidthPx: clampedW,
            },
          });
          if ("data" in result && result.data) onUpdate?.(result.data);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return;
    }

    const MIN_HEIGHT = 240;
    const MAX_HEIGHT = 1600;
    const startHeight = (listHeightRef.current && listHeightRef.current > 0 ? listHeightRef.current : 480) ?? 480;
    const state = { startY: e.clientY, startHeight };

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - state.startY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, state.startHeight + delta));
      setListHeightPx(next);
      listHeightRef.current = next;
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const finalHeight = listHeightRef.current ?? state.startHeight;
      const clamped = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, finalHeight)));

      setListHeightPx(clamped);
      listHeightRef.current = clamped;

      if (!block.id.startsWith("temp-")) {
        const result = await updateBlock({
          blockId: block.id,
          content: {
            ...block.content,
            title: blockTitleDraft,
            viewMode,
            heightPx: clamped,
          },
        });
        if ("data" in result && result.data) onUpdate?.(result.data);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleCreateComment = async () => {
    if (!selectedCard || !commentDraft.trim()) return;
    await cardComments.create.mutateAsync({
      cardId: selectedCard.id,
      text: commentDraft.trim(),
    });
    setCommentDraft("");
  };

  const renderAsset = (card: (typeof cards)[number], large = false) => {
    const cardClientKey = getCardClientKey(card);
    const ids = getCardAssetIds(card);
    const currentIndex = Math.min(slideIndexByCardId[cardClientKey] ?? 0, Math.max(0, ids.length - 1));
    const setSlideIndex = (i: number) =>
      setSlideIndexByCardId((prev) => ({ ...prev, [cardClientKey]: Math.max(0, Math.min(ids.length - 1, i)) }));

    const fileId = ids[currentIndex] ?? null;
    const url = fileId ? fileUrls[fileId] : null;
    const isSlideshow = ids.length > 1;

    if (ids.length === 0) {
      return <UploadPlaceholder large={large} onClick={() => openUploadPicker(cardClientKey)} />;
    }

    if (!url) {
      if (fileUrlsFetching && !fileUrlsError) {
        return <AssetLoadingPlaceholder large={large} />;
      }

      return (
        <AssetUnavailablePlaceholder
          large={large}
          onRetry={() => {
            void refetchFileUrls();
          }}
          onReplace={() => openUploadPicker(cardClientKey, "replace")}
        />
      );
    }

    const navButtons = isSlideshow && (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSlideIndex(currentIndex - 1);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSlideIndex(currentIndex + 1);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </>
    );

    if (card.assetKind === "video" && !isSlideshow) {
      return (
        <div className="group relative h-full w-full overflow-hidden bg-[#f7f4f0]">
          <video src={url} className="h-full w-full object-cover" muted playsInline />
          {navButtons}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
            <button type="button" onClick={(e) => { e.stopPropagation(); openUploadPicker(cardClientKey, "replace"); }} className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">Replace</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); openUploadPicker(cardClientKey, "add"); }} className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">Add image</button>
            <a href={url} target="_blank" rel="noreferrer" className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">View</a>
          </div>
        </div>
      );
    }

    return (
      <div className="group relative h-full w-full overflow-hidden bg-[#f7f4f0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={card.title} className="h-full w-full object-cover" />
        {navButtons}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
          <button type="button" onClick={(e) => { e.stopPropagation(); openUploadPicker(cardClientKey, "replace"); }} className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">Replace</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); openUploadPicker(cardClientKey, "add"); }} className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">Add image</button>
          <a href={url} target="_blank" rel="noreferrer" className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-[#1a1814]">View</a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="group flex min-w-0 items-center gap-2">
          <div className="grid grid-cols-2 gap-[3px] opacity-35">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="h-[3px] w-[3px] rounded-full bg-[#1a1814]" />
            ))}
          </div>
          {renamingBlock ? (
            <input
              ref={blockTitleInputRef}
              value={blockTitleDraft}
              onChange={(event) => setBlockTitleDraft(event.target.value)}
              onBlur={handleBlockTitleSave}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleBlockTitleSave();
                if (event.key === "Escape") {
                  setBlockTitleDraft(blockTitle);
                  setRenamingBlock(false);
                }
              }}
              className="min-w-0 bg-transparent text-[13px] font-semibold text-[#1a1814] outline-none"
            />
          ) : (
            <button type="button" onClick={() => setRenamingBlock(true)} className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-[#1a1814]">{blockTitle}</span>
              <Pencil className="h-3.5 w-3.5 text-[#9b9389] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[6px] bg-[#ede8e0] p-[3px]">
            <button
              type="button"
              onClick={() => void handleUpdateViewMode("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[4px] transition-all",
                viewMode === "grid" ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-transparent"
              )}
            >
              <Grid2x2 className={cn("h-[14px] w-[14px]", viewMode === "grid" ? "text-[#1a1814]" : "text-[#bbb]")} />
            </button>
            <button
              type="button"
              onClick={() => void handleUpdateViewMode("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[4px] transition-all",
                viewMode === "list" ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-transparent"
              )}
            >
              <LayoutList className={cn("h-[14px] w-[14px]", viewMode === "list" ? "text-[#1a1814]" : "text-[#bbb]")} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateCard()}
            className="inline-flex items-center gap-1 rounded-[5px] border border-[#e0d8cf] px-2.5 py-1.5 text-[11px] font-semibold text-[#7d746a] transition-colors hover:bg-[#faf8f5]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-[#1a1814] opacity-70 transition-opacity hover:opacity-100"
                aria-label="Cards block layout"
              >
                <Settings className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e857c]">
                Grid columns (2+ cards)
              </DropdownMenuLabel>
              <div className="px-2 pb-2 pt-0.5">
                <select
                  value={gridColumns}
                  onChange={(event) => void handleGridColumnsChange(Number(event.target.value))}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-2 py-1.5 text-[12px] text-[#1a1814] outline-none"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} column{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] leading-snug text-[#8e857c]">
                  With several cards in grid view, drag the corner handle on the grid to resize every card image wider
                  and taller together.
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Lock className="h-4 w-4 text-[#1a1814] opacity-40" />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className={cn("min-w-0 flex-1", isUniformAssetGrid && "relative")}>
          <div
            className={viewMode === "list" ? "min-h-0" : "overflow-auto"}
            style={
              viewMode === "grid"
                ? {
                    maxHeight: listHeightPx ? `${listHeightPx}px` : "70vh",
                    height: listHeightPx ? `${listHeightPx}px` : undefined,
                  }
                : undefined
            }
          >
          {viewMode === "grid" ? (
            <div
              className="gap-3"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${effectiveGridColumns}, minmax(0, 1fr))`,
              }}
            >
              {cards.map((card) => {
                const cardClientKey = getCardClientKey(card);
                const selected = selectedCardId === cardClientKey || selectedCardId === card.id;
                const statusFields = getEffectiveStatusFields(card);
                const priorityFields = getEffectivePriorityFields(card);
                const tags = getEffectiveTags(card);
                const assigneeName = getPrimaryAssigneeName(card);
                const dueDate = getPrimaryDueDate(card);
                const isDetailsExpanded = Boolean(expandedGridCardDetails[cardClientKey]);
                const showDetailsToggle = hasGridDetails(card);
                const cardWidth = card.width ?? "half";
                const assetHeightPx =
                  cards.length > 1
                    ? gridAssetHeightPx
                    : (card.height ?? "tall") === "compact"
                      ? 220
                      : 320;
                const spanFullRow =
                  effectiveGridColumns > 1 && (cardWidth === "full" || cards.length === 1);
                return (
                  <div
                    key={cardClientKey}
                    onClick={() => setSelectedCardId(cardClientKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCardId(cardClientKey);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={spanFullRow ? { gridColumn: "1 / -1" } : undefined}
                    className={cn(
                      "overflow-hidden rounded-[8px] border bg-white text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all",
                      selected ? "border-[#c3baaf] shadow-[0_2px_12px_rgba(0,0,0,0.07)]" : "border-[#e8e2da] hover:border-[#d0c8be] hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
                    )}
                  >
                    <div className="flex justify-center border-b border-[#f0ebe4] bg-[#f7f4f0]">
                      <div
                        className="relative overflow-hidden"
                        style={
                          cards.length > 1
                            ? {
                                width: gridAssetWidthPx,
                                maxWidth: "100%",
                                height: assetHeightPx,
                              }
                            : { width: "100%", height: assetHeightPx }
                        }
                      >
                        {renderAsset(card)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 px-[13px] pb-[13px] pt-[10px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 text-[12px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#1a1814]">{card.title}</div>
                        {getCardAssetIds(card).length > 1 ? (
                          <span className="flex-shrink-0 text-[11px] text-[#8e857c]">
                            {(slideIndexByCardId[cardClientKey] ?? 0) + 1}/{getCardAssetIds(card).length} image
                          </span>
                        ) : null}
                      </div>
                      {showDetailsToggle ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedGridCardDetails((prev) => ({
                              ...prev,
                              [cardClientKey]: !prev[cardClientKey],
                            }));
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-[#8e857c] transition-colors hover:text-[#5f574f]"
                        >
                          <ChevronRight className={cn("h-3 w-3 transition-transform", isDetailsExpanded && "rotate-90")} />
                          <span>{isDetailsExpanded ? "Hide details" : "Show details"}</span>
                        </button>
                      ) : null}
                      {isDetailsExpanded ? (
                        <div className="space-y-2 rounded-[6px] bg-[#faf8f5] p-2.5">
                          {(statusFields.length > 0 || priorityFields.length > 0 || tags.length > 0) ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {statusFields.map((field: { id: string; field_name: string; value: Status }) => (
                                <StatusBadge key={field.id} status={field.value} label={field.field_name} />
                              ))}
                              {priorityFields.map((field: { id: string; field_name: string; value: Priority }) => (
                                <PriorityBadge key={field.id} priority={field.value} label={field.field_name} />
                              ))}
                              {tags.map((tag: string, tagIndex: number) => (
                                <TagBadge key={`${card.id}-grid-tag-${tag}-${tagIndex}`} tag={tag} />
                              ))}
                            </div>
                          ) : null}
                          {(assigneeName || dueDate) ? (
                            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#8e857c]">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b6b2] text-[10px] text-white">{getInitials(assigneeName)}</span>
                                <span className="truncate">{assigneeName ?? "Unassigned"}</span>
                              </div>
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="h-[11px] w-[11px]" />
                                <span>{formatDate(dueDate)}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[8px] border border-[#e8e2da] bg-white min-h-0">
              <div className="flex items-center gap-3 border-b border-[#ede8e0] bg-[#faf8f5] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#bbb]">
                <div className="w-9" />
                <div className="flex-1">Name</div>
                {showStatusColumn ? <div className="w-[180px]">Status</div> : null}
                {showPriorityColumn ? <div className="w-[180px]">Priority</div> : null}
                {showTagsColumn ? <div className="w-[180px]">Tags</div> : null}
                <div className="w-[90px]">Assignee</div>
                <div className="w-[60px]">Due</div>
                <div className="w-3" />
              </div>
              {cards.map((card, index) => {
                const cardClientKey = getCardClientKey(card);
                const selected = selectedCardId === cardClientKey || selectedCardId === card.id;
                const assigneeName = getPrimaryAssigneeName(card);
                const dueDate = getPrimaryDueDate(card);
                const statusFields = getEffectiveStatusFields(card);
                const priorityFields = getEffectivePriorityFields(card);
                const tags = getEffectiveTags(card);
                const ids = getCardAssetIds(card);
                const thumbIndex = Math.min(slideIndexByCardId[cardClientKey] ?? 0, ids.length - 1);
                const url = ids[thumbIndex] ? fileUrls[ids[thumbIndex]] : null;
                return (
                  <div
                    key={cardClientKey}
                    onClick={() => setSelectedCardId(cardClientKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCardId(cardClientKey);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "group flex w-full items-center gap-3 px-3 py-[9px] text-left transition-colors hover:bg-[#f7f4f0]",
                      index < cards.length - 1 && "border-b border-[#f0ebe4]",
                      selected && "bg-[#f7f4f0] shadow-[inset_2px_0_0_#cbb7a5]"
                    )}
                  >
                    <div
                      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#f0ebe4]"
                      onClick={(e) => {
                        if (ids.length <= 1) return;
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < rect.width / 2) {
                          setSlideIndexByCardId((prev) => ({
                            ...prev,
                            [cardClientKey]: Math.max(0, (prev[cardClientKey] ?? 0) - 1),
                          }));
                        } else {
                          setSlideIndexByCardId((prev) => ({
                            ...prev,
                            [cardClientKey]: Math.min(ids.length - 1, (prev[cardClientKey] ?? 0) + 1),
                          }));
                        }
                      }}
                    >
                      {url ? (
                        card.assetKind === "video" ? (
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={card.title} className="h-full w-full object-cover" />
                        )
                      ) : (
                        <ImageIcon className="h-4 w-4 text-[#b5aca2]" />
                      )}
                      {ids.length > 1 ? (
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
                          {(slideIndexByCardId[cardClientKey] ?? 0) + 1}/{ids.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-1 truncate text-[12px] font-medium tracking-[-0.005em] text-[#1a1814]">{card.title}</div>
                    {showStatusColumn ? (
                      <div className="w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {statusFields.map((field: { id: string; field_name: string; value: Status }) => (
                            <StatusBadge key={field.id} status={field.value} label={field.field_name} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {showPriorityColumn ? (
                      <div className="w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {priorityFields.map((field: { id: string; field_name: string; value: Priority }) => (
                            <PriorityBadge key={field.id} priority={field.value} label={field.field_name} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {showTagsColumn ? (
                      <div className="w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag: string, tagIndex: number) => (
                            <TagBadge key={`${card.id}-list-tag-${tag}-${tagIndex}`} tag={tag} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="w-[90px] text-[11px] font-medium text-[#8e857c]">{assigneeName ?? "Unassigned"}</div>
                    <div className="w-[60px] text-[11px] font-medium text-[#8e857c]">{dueDate ? formatDate(dueDate) : "-"}</div>
                    <div className="w-3 text-[#b5aca2] opacity-0 transition-opacity group-hover:opacity-100">
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
          {isUniformAssetGrid ? (
            <button
              type="button"
              aria-label="Resize all card images — drag diagonally"
              title="Drag diagonally to resize width and height together"
              onMouseDown={handleResizeMouseDown}
              className="absolute bottom-1 right-1 z-10 flex h-6 w-6 cursor-nwse-resize select-none items-end justify-end rounded-sm border border-[#e0d8cf] bg-white/95 p-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:border-[#c3baaf] hover:bg-white"
            >
              <span className="pointer-events-none block h-2.5 w-2.5 rounded-br border-b-2 border-r-2 border-[#9b9389]" />
            </button>
          ) : (
            <div
              className="mt-1 flex flex-col items-end gap-0.5 cursor-ns-resize select-none"
              onMouseDown={handleResizeMouseDown}
              title="Drag to resize the block height"
            >
              <div className="h-1 w-10 rounded-full bg-[#e8e2da] hover:bg-[#d0c8be]" />
            </div>
          )}
        </div>

        {selectedCard ? (
          <div className="w-[320px] flex-shrink-0 self-start overflow-hidden rounded-[8px] border border-[#e8e2da] bg-white opacity-100 transition-all duration-[180ms] ease-out animate-in slide-in-from-right-4">
            {(() => {
              const selectedCardStatusFields = getEffectiveStatusFields(selectedCard);
              const selectedCardPriorityFields = getEffectivePriorityFields(selectedCard);
              const selectedCardTags = getEffectiveTags(selectedCard);
              const selectedCardAssigneeFields = getEffectiveAssigneeFields(selectedCard);
              const selectedCardDueDateFields = getEffectiveDueDateFields(selectedCard);

              return (
                <>
            <div className="flex items-center justify-between border-b border-[#f0ebe4] px-5 py-4">
              <input
                value={titleDrafts[selectedCardClientKey ?? selectedCard.id] ?? selectedCard.title}
                onFocus={() => {
                  if (!selectedCardClientKey) return;
                  setTitleDrafts((prev) => ({ ...prev, [selectedCardClientKey]: prev[selectedCardClientKey] ?? selectedCard.title }));
                }}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!selectedCardClientKey) return;
                  setTitleDrafts((prev) => ({ ...prev, [selectedCardClientKey]: value }));
                }}
                onBlur={() => {
                  const draftKey = selectedCardClientKey ?? selectedCard.id;
                  const nextTitle = (titleDrafts[draftKey] ?? selectedCard.title).trim() || "Untitled card";
                  if (nextTitle !== selectedCard.title) {
                    commitCardTitle(selectedCard.id, draftKey, nextTitle);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tracking-[-0.01em] text-[#1a1814] outline-none"
              />
              <button type="button" onClick={() => setSelectedCardId(null)} className="rounded p-1 text-[#bbb] transition-colors hover:bg-[#f7f4f0]">
                <X className="h-[15px] w-[15px]" />
              </button>
            </div>
            <div className="flex justify-center border-b border-[#f0ebe4] bg-[#f7f4f0]">
              <div
                className="relative overflow-hidden"
                style={
                  isUniformAssetGrid
                    ? {
                        width: gridAssetWidthPx,
                        maxWidth: "100%",
                        height: gridAssetHeightPx,
                      }
                    : { width: "100%", height: 210 }
                }
              >
                {renderAsset(selectedCard, true)}
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-5 py-[18px]">
              {getCardAssetIds(selectedCard).length > 1 ? (
                <div className="flex w-full items-center gap-4 border-b border-[#f5f1ec] py-2.5">
                  <span className="w-[90px] flex-shrink-0 text-[12px] font-medium text-[#aaa]">Image</span>
                  <span className="text-[12px] text-[#1a1814]">
                    {(slideIndexByCardId[selectedCardClientKey ?? selectedCard.id] ?? 0) + 1} / {getCardAssetIds(selectedCard).length} image
                  </span>
                </div>
              ) : null}
              <div className="flex w-full items-center gap-4 border-b border-[#f5f1ec] py-2.5">
                <span className="w-[90px] flex-shrink-0 text-[12px] font-medium text-[#aaa]">Size</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {isUniformAssetGrid ? (
                    <>
                      <p className="text-[12px] leading-snug text-[#8e857c]">
                        Image size is shared for every card in this grid. Drag the corner handle on the grid (bottom
                        right) to change width and height together. Column count is in the block settings (gear).
                      </p>
                      <select
                        value={selectedCard.width ?? "half"}
                        onChange={(e) => {
                          const v = e.target.value as CardWidth;
                          void updateCardMutation.mutateAsync({ cardId: selectedCard.id, updates: { width: v } });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-fit rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-2.5 py-1.5 text-[12px] text-[#1a1814] outline-none"
                      >
                        <option value="half">Half row width</option>
                        <option value="full">Full row width</option>
                      </select>
                    </>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <select
                        value={selectedCard.width ?? "half"}
                        onChange={(e) => {
                          const v = e.target.value as CardWidth;
                          void updateCardMutation.mutateAsync({ cardId: selectedCard.id, updates: { width: v } });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-2.5 py-1.5 text-[12px] text-[#1a1814] outline-none"
                      >
                        <option value="half">Half width</option>
                        <option value="full">Full width</option>
                      </select>
                      <select
                        value={selectedCard.height ?? "tall"}
                        onChange={(e) => {
                          const v = e.target.value as CardHeight;
                          void updateCardMutation.mutateAsync({ cardId: selectedCard.id, updates: { height: v } });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-2.5 py-1.5 text-[12px] text-[#1a1814] outline-none"
                      >
                        <option value="compact">Compact</option>
                        <option value="tall">Tall</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              {[
                {
                  label: "Statuses",
                  content:
                    selectedCardStatusFields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCardStatusFields.map((field: { id: string; field_name: string; value: Status }) => (
                          <StatusBadge key={field.id} status={field.value} label={field.field_name} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb]">None</span>
                    ),
                },
                {
                  label: "Priorities",
                  content:
                    selectedCardPriorityFields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCardPriorityFields.map((field: { id: string; field_name: string; value: Priority }) => (
                          <PriorityBadge key={field.id} priority={field.value} label={field.field_name} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb]">None</span>
                    ),
                },
                {
                  label: "Tags",
                  content:
                    selectedCardTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCardTags.map((tag: string, index: number) => (
                          <TagBadge key={`${selectedCard.id}-detail-tag-${tag}-${index}`} tag={tag} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb]">None</span>
                    ),
                },
                {
                  label: "Assignees",
                  content:
                    selectedCardAssigneeFields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCardAssigneeFields.map((field: { id: string; field_name: string; value: string[] }) => (
                          <AssigneeBadge
                            key={field.id}
                            label={field.field_name}
                            memberNames={getMemberNames(field.value)}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb]">None</span>
                    ),
                },
                {
                  label: "Due Dates",
                  content:
                    selectedCardDueDateFields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCardDueDateFields.map((field: { id: string; field_name: string; value: DueDateRange }) => (
                          <DueDateBadge
                            key={field.id}
                            label={field.field_name}
                            dueDate={field.value}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb]">None</span>
                    ),
                },
              ].map((row) => (
                <div
                  key={row.label}
                  onClick={() => {
                    setPropertyMenuCardId(selectedCard.id);
                    setPropertyMenuOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPropertyMenuCardId(selectedCard.id);
                      setPropertyMenuOpen(true);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center gap-4 border-b border-[#f5f1ec] py-2.5 text-left"
                >
                  <span className="w-[90px] flex-shrink-0 text-[12px] font-medium text-[#aaa]">{row.label}</span>
                  <span className="min-w-0 flex-1">{row.content}</span>
                </div>
              ))}

              <div className="mt-5">
                <div className="mb-2 text-[12px] font-medium text-[#aaa]">Notes</div>
                <textarea
                  value={notesDraft[selectedCardClientKey ?? selectedCard.id] ?? selectedCard.notes ?? ""}
                  onChange={(event) => {
                    if (!selectedCardClientKey) return;
                    handleNotesChange(selectedCard.id, selectedCardClientKey, event.target.value);
                  }}
                  placeholder="Add notes…"
                  className="min-h-[76px] w-full rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-3 py-2.5 text-[12px] text-[#1a1814] outline-none placeholder:text-[#ccc]"
                />
              </div>

              <div className="mt-5">
                <div className="mb-2.5 text-[12px] font-medium text-[#aaa]">Comments</div>
                <div className="space-y-3">
                  {selectedCard.comments.map((comment: { id: string; author: string; text: string; timestamp: string }) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d9b6b2] text-[10px] text-white">
                        {getInitials(comment.author)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#8e857c]">
                          <span className="font-semibold text-[#5f574f]">{comment.author}</span>
                          <span>{new Date(comment.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-1 text-[12px] text-[#1a1814]">{comment.text}</div>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d9b6b2] text-[10px] text-white">
                      {getInitials(workspaceMembers[0]?.name || null)}
                    </span>
                    <div className="flex-1 rounded-[6px] border border-[#ede8e0] bg-[#faf8f5] px-3 py-2">
                      <textarea
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Leave a comment…"
                        className="min-h-[44px] w-full resize-none bg-transparent text-[12px] text-[#1a1814] outline-none placeholder:text-[#ccc]"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleCreateComment()}
                          className="rounded bg-[#1a1814] px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-between">
                <button
                  type="button"
                  onClick={() => void deleteCardMutation.mutateAsync(selectedCard.id).then(() => setSelectedCardId(null))}
                  className="text-[11px] font-semibold text-[#a86b63]"
                >
                  Delete card
                </button>
                {(createCardMutation.isPending || updateCardMutation.isPending || cardComments.create.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#8e857c]" />
                ) : null}
              </div>
            </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>

      {propertyMenuCardId ? (
        <PropertyMenu
          open={propertyMenuOpen}
          onOpenChange={setPropertyMenuOpen}
          entityType="card"
          entityId={propertyMenuCardId}
          workspaceId={workspaceId ?? ""}
          projectId={projectId}
          entityTitle={selectedCard?.title}
        />
      ) : null}
    </div>
  );
}
