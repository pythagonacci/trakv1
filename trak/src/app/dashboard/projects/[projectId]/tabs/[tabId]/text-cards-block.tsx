"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { type Block } from "@/app/actions/block";
import { useCards, useCreateCard, useDeleteCard, useUpdateCard } from "@/lib/hooks/use-card-queries";
import { useCardCountContext } from "./card-count-context";
import { useEntitiesProperties, useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { cn } from "@/lib/utils";
import type { DueDateRange, EntityProperties, Priority, Status } from "@/types/properties";
import type { TextCardFieldType, TextCardRow, TextCardRowValue } from "@/types/card";
import { DateRangeCalendarDropdown } from "@/components/due-date-calendar";
import { PriorityBadge, StatusBadge } from "@/components/properties";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { PersonCell } from "@/components/tables/cells/person-cell";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/types/properties";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Plus, X } from "lucide-react";

interface TextCardsBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
}

interface WorkspaceMemberLike {
  id?: string | null;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
}

const STATUS_NONE = "__none__";
const PRIORITY_NONE = "__none__";

const FIELD_TYPE_LABELS: Record<TextCardFieldType, string> = {
  text: "Text",
  date: "Date",
  status: "Status",
  priority: "Priority",
  person: "Person",
};

const FIELD_TYPE_DEFAULT_LABELS: Record<Exclude<TextCardFieldType, "text">, string> = {
  date: "Date",
  status: "Status",
  priority: "Priority",
  person: "Person",
};

function createEmptyTextRow(): TextCardRow {
  return {
    id: crypto.randomUUID(),
    label: "",
    fieldType: "text",
    value: "",
  };
}

function createDefaultTextRows(): TextCardRow[] {
  return [createEmptyTextRow(), createEmptyTextRow(), createEmptyTextRow()];
}

function getPersistedFieldName(row: TextCardRow): string {
  const trimmed = row.label.trim();
  if (trimmed) return trimmed;
  if (row.fieldType === "text") return "";
  return FIELD_TYPE_DEFAULT_LABELS[row.fieldType];
}

function normalizeDueDateValue(value: TextCardRowValue): DueDateRange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as unknown as Record<string, unknown>;
  const start = typeof candidate.start === "string" ? candidate.start : null;
  const end = typeof candidate.end === "string" ? candidate.end : null;
  if (!start && !end) return null;
  return { start, end: end ?? start };
}

function normalizeRowValueForType(fieldType: TextCardFieldType, value: TextCardRowValue): TextCardRowValue {
  if (fieldType === "text") return typeof value === "string" ? value : "";
  if (fieldType === "status") {
    return value === "todo" || value === "in_progress" || value === "blocked" || value === "done" ? value : null;
  }
  if (fieldType === "priority") {
    return value === "low" || value === "medium" || value === "high" || value === "urgent" ? value : null;
  }
  if (fieldType === "person") {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  }
  return normalizeDueDateValue(value);
}

function getDefaultRowValue(fieldType: TextCardFieldType): TextCardRowValue {
  if (fieldType === "text") return "";
  if (fieldType === "person") return [];
  return null;
}

function hydrateRowsFromProperties(rows: TextCardRow[] | undefined, properties: EntityProperties | null | undefined): TextCardRow[] {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  return normalizedRows.map((row) => {
    const fieldName = getPersistedFieldName(row);
    if (!fieldName || row.fieldType === "text") {
      return { ...row, value: normalizeRowValueForType(row.fieldType, row.value) };
    }

    if (row.fieldType === "status") {
      const match = properties?.statuses?.find((entry) => entry.field_name === fieldName);
      return { ...row, value: normalizeRowValueForType("status", (match?.value as TextCardRowValue) ?? row.value) };
    }

    if (row.fieldType === "priority") {
      const match = properties?.priorities?.find((entry) => entry.field_name === fieldName);
      return { ...row, value: normalizeRowValueForType("priority", (match?.value as TextCardRowValue) ?? row.value) };
    }

    if (row.fieldType === "person") {
      const match = properties?.assignees?.find((entry) => entry.field_name === fieldName);
      return { ...row, value: normalizeRowValueForType("person", (match?.value as TextCardRowValue) ?? row.value) };
    }

    const match = properties?.due_dates?.find((entry) => entry.field_name === fieldName);
    return { ...row, value: normalizeRowValueForType("date", (match?.value as TextCardRowValue) ?? row.value) };
  });
}

function buildPropertyUpdates(rows: TextCardRow[]) {
  return {
    statuses: rows
      .filter((row) => row.fieldType === "status")
      .map((row) => ({
        field_name: getPersistedFieldName(row),
        value: normalizeRowValueForType("status", row.value) as Status | null,
      })),
    priorities: rows
      .filter((row) => row.fieldType === "priority")
      .map((row) => ({
        field_name: getPersistedFieldName(row),
        value: normalizeRowValueForType("priority", row.value) as Priority | null,
      })),
    assignees: rows
      .filter((row) => row.fieldType === "person")
      .map((row) => ({
        field_name: getPersistedFieldName(row),
        value: normalizeRowValueForType("person", row.value) as string[],
      })),
    dueDates: rows
      .filter((row) => row.fieldType === "date")
      .map((row) => ({
        field_name: getPersistedFieldName(row),
        value: normalizeRowValueForType("date", row.value) as DueDateRange | null,
      })),
  };
}

function formatDateRange(value: DueDateRange | null): string {
  if (!value?.start && !value?.end) return "—";
  const start = value?.start ? new Date(`${value.start}T12:00:00`) : null;
  const endToken = value?.end ?? value?.start ?? null;
  const end = endToken ? new Date(`${endToken}T12:00:00`) : null;
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end && value.start && value.end && value.start !== value.end) {
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }
  return formatter.format(end ?? start ?? new Date());
}

function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function resolvePersonDisplay(value: TextCardRowValue, workspaceMembers: WorkspaceMemberLike[]) {
  const ids = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  return ids.map((id) => {
    const member = workspaceMembers.find((candidate) => candidate.user_id === id || candidate.id === id);
    const displayName = member?.name?.trim() || member?.email?.trim() || "Unknown";
    return {
      id,
      displayName,
      initials: getInitials(displayName),
    };
  });
}

function InlineInput({
  value,
  placeholder,
  className,
  onCommit,
  onFocus,
  textAlign = "left",
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (nextValue: string) => void;
  onFocus?: () => void;
  textAlign?: "left" | "right";
}) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resolvedPlaceholder = placeholder ?? "—";

  const resizeTextarea = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.max(node.scrollHeight, 24)}px`;
  };

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    resizeTextarea();
  }, [draft, value]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => resizeTextarea());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={textareaRef}
      data-row-editor="true"
      value={draft}
      placeholder={resolvedPlaceholder}
      onFocus={onFocus}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDraft(value);
          (event.currentTarget as HTMLTextAreaElement).blur();
        }
      }}
      rows={1}
      wrap="soft"
      className={cn(
        "w-full appearance-none resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre-wrap break-words leading-[1.45] outline-none shadow-none placeholder:text-[#c3bab0] ring-0 [overflow-wrap:anywhere] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
        textAlign === "right" ? "text-right" : "text-left",
        className
      )}
    />
  );
}

function SortableTextCardRow({
  rowId,
  children,
}: {
  rowId: string;
  children: (args: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowId });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

export default function TextCardsBlock({ block, workspaceId }: TextCardsBlockProps) {
  const cardsBlockId = block.id;
  const { data: bundle } = useCards(cardsBlockId);
  const cards = useMemo(() => bundle?.cards ?? [], [bundle?.cards]);
  const setCardCount = useCardCountContext()?.setCardCount;
  const [editingPersonRowId, setEditingPersonRowId] = useState<string | null>(null);
  const [activeTypeMenuRowKey, setActiveTypeMenuRowKey] = useState<string | null>(null);
  const [activeDragRowId, setActiveDragRowId] = useState<string | null>(null);
  const [overRowId, setOverRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setCardCount?.(cardsBlockId, cards.length);
  }, [cards.length, cardsBlockId, setCardCount]);

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

  const persistTextRows = async (cardId: string, rows: TextCardRow[]) => {
    const normalizedRows = rows.map((row) => ({
      ...row,
      value: normalizeRowValueForType(row.fieldType, row.value),
    }));
    const propertyUpdates = buildPropertyUpdates(normalizedRows);
    await updateCardMutation.mutateAsync({
      cardId,
      updates: {
        textRows: normalizedRows,
        statuses: propertyUpdates.statuses,
        priorities: propertyUpdates.priorities,
        assignees: propertyUpdates.assignees,
        dueDates: propertyUpdates.dueDates,
      },
    });
  };

  const createTextCard = async () => {
    setCardCount?.(cardsBlockId, cards.length + 1);
    await createCardMutation.mutateAsync({
      cardsBlockId,
      title: "Untitled card",
      width: "half",
      height: "tall",
      textRows: createDefaultTextRows(),
    });
  };

  const getHydratedRows = (cardId: string, rawRows: TextCardRow[] | undefined) =>
    hydrateRowsFromProperties(rawRows, entityPropertiesByCardId[cardId]);

  useEffect(() => {
    if (!activeTypeMenuRowKey) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-text-card-type-menu]")) return;
      if (target.closest(`[data-row-key="${activeTypeMenuRowKey}"]`)) return;
      setActiveTypeMenuRowKey(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeTypeMenuRowKey]);

  return (
    <div
      className={cn(
        "w-full",
        cards.length > 1 ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1"
      )}
    >
      {cards.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-[14px] border border-dashed border-[#d8d0c7] bg-[#faf8f5]">
          <button
            type="button"
            onClick={() => void createTextCard()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d3cbc1] bg-white text-[#766d64] transition-colors hover:border-[#bdb4aa] hover:text-[#1f1a15]"
            aria-label="Add text card"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {cards.map((card) => {
        const rows = getHydratedRows(card.id, card.textRows);
        const sortableIds = rows.map((row) => row.id);
        const onUpdateRows = (updater: (currentRows: TextCardRow[]) => TextCardRow[]) => {
          const nextRows = updater(rows);
          void persistTextRows(card.id, nextRows);
        };

        return (
          <div key={card.id} className="group/card relative max-w-full">
            <button
              type="button"
              onClick={() => void deleteCardMutation.mutateAsync(card.id)}
              className="absolute -left-4 top-5 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d0c7] bg-white text-[#b0a69b] opacity-0 shadow-[0_2px_8px_rgba(23,18,10,0.06)] transition-all hover:border-[#bdb4aa] hover:text-[#5f574f] group-hover/card:opacity-100 group-focus-within/card:opacity-100"
              aria-label="Delete card"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative w-full overflow-visible rounded-[14px] border border-[#d8d0c7] bg-white shadow-[0_1px_2px_rgba(23,18,10,0.04)]">
              <div className="px-6 pb-3 pt-5">
                <InlineInput
                  value={card.title}
                  placeholder="—"
                  onCommit={(nextTitle) =>
                    void updateCardMutation.mutateAsync({
                      cardId: card.id,
                      updates: { title: nextTitle.trim() || "Untitled card" },
                    })
                  }
                  className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#7d746b]"
                />
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(event: DragStartEvent) => {
                  setActiveDragRowId(String(event.active.id));
                  setOverRowId(String(event.active.id));
                  setActiveTypeMenuRowKey(null);
                }}
                onDragOver={(event) => {
                  setOverRowId(event.over ? String(event.over.id) : null);
                }}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  setActiveDragRowId(null);
                  setOverRowId(null);
                  if (!over || active.id === over.id) return;
                  const oldIndex = rows.findIndex((row) => row.id === active.id);
                  const newIndex = rows.findIndex((row) => row.id === over.id);
                  if (oldIndex === -1 || newIndex === -1) return;
                  void persistTextRows(card.id, arrayMove(rows, oldIndex, newIndex));
                }}
                onDragCancel={() => {
                  setActiveDragRowId(null);
                  setOverRowId(null);
                }}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div>
                    {rows.map((row, index) => {
                      const isLastRow = index === rows.length - 1;
                      const rowKey = `${card.id}:${row.id}`;
                      const isTypeMenuOpen = activeTypeMenuRowKey === rowKey;
                      const showDropIndicator = overRowId === row.id && activeDragRowId !== row.id;
                      const personValue = Array.isArray(row.value) ? row.value : [];
                      const personEntries = resolvePersonDisplay(row.value, workspaceMembers);

                      return (
                        <SortableTextCardRow key={row.id} rowId={row.id}>
                          {({ attributes, listeners, isDragging }) => (
                            <div
                              data-text-card-row="true"
                              data-row-key={rowKey}
                              data-row-id={row.id}
                              className={cn("relative", isDragging && "z-10")}
                              onClick={(event) => {
                                if (isDragging) return;
                                const target = event.target as HTMLElement;
                                if (target.closest("[data-row-editor='true']")) return;
                                setActiveTypeMenuRowKey(rowKey);
                              }}
                              {...attributes}
                              {...listeners}
                            >
                              {showDropIndicator ? <div className="absolute -top-px left-0 right-0 h-0.5 bg-[#2f6df6]" /> : null}

                              <div
                                className={cn(
                                  "flex cursor-grab items-start gap-4 px-6 py-3.5 active:cursor-grabbing",
                                  !isLastRow && "border-b border-[#e7dfd7]",
                                  isDragging && "rounded-[12px] border border-[#d8d0c7] bg-white shadow-[0_12px_32px_rgba(23,18,10,0.08)]"
                                )}
                                style={!isLastRow ? { borderBottomWidth: 0.5 } : undefined}
                              >
                                <div className="min-w-0 flex-[0_0_42%]">
                                  <InlineInput
                                    value={row.label}
                                    onCommit={(nextLabel) =>
                                      onUpdateRows((currentRows) =>
                                        currentRows.map((candidate) =>
                                          candidate.id === row.id ? { ...candidate, label: nextLabel } : candidate
                                        )
                                      )
                                    }
                                    className="text-[15px] text-[#3f3831]"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  {row.fieldType === "text" ? (
                                    <InlineInput
                                      value={typeof row.value === "string" ? row.value : ""}
                                      placeholder="—"
                                      onCommit={(nextValue) =>
                                        onUpdateRows((currentRows) =>
                                          currentRows.map((candidate) =>
                                            candidate.id === row.id ? { ...candidate, value: nextValue } : candidate
                                          )
                                        )
                                      }
                                      textAlign="right"
                                      className="text-[15px] text-[#1f1a15]"
                                    />
                                  ) : null}

                                  {row.fieldType === "status" ? (
                                    <div
                                      data-row-editor="true"
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      className="flex justify-end"
                                    >
                                      <Select
                                        value={(row.value as Status | null) ?? STATUS_NONE}
                                        onValueChange={(nextValue) =>
                                          onUpdateRows((currentRows) =>
                                            currentRows.map((candidate) =>
                                              candidate.id === row.id
                                                ? {
                                                    ...candidate,
                                                    value: nextValue === STATUS_NONE ? null : (nextValue as Status),
                                                  }
                                                : candidate
                                            )
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-auto w-auto min-w-0 border-0 bg-transparent px-0 py-0 text-sm shadow-none hover:bg-transparent focus:ring-0">
                                          {row.value ? (
                                            <StatusBadge status={row.value as Status} />
                                          ) : (
                                            <span className="text-[15px] text-[#b8afa5]">—</span>
                                          )}
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                          <SelectItem value={STATUS_NONE}>None</SelectItem>
                                          {STATUS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : null}

                                  {row.fieldType === "priority" ? (
                                    <div
                                      data-row-editor="true"
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      className="flex justify-end"
                                    >
                                      <Select
                                        value={(row.value as Priority | null) ?? PRIORITY_NONE}
                                        onValueChange={(nextValue) =>
                                          onUpdateRows((currentRows) =>
                                            currentRows.map((candidate) =>
                                              candidate.id === row.id
                                                ? {
                                                    ...candidate,
                                                    value: nextValue === PRIORITY_NONE ? null : (nextValue as Priority),
                                                  }
                                                : candidate
                                            )
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-auto w-auto min-w-0 border-0 bg-transparent px-0 py-0 text-sm shadow-none hover:bg-transparent focus:ring-0">
                                          {row.value ? (
                                            <PriorityBadge priority={row.value as Priority} />
                                          ) : (
                                            <span className="text-[15px] text-[#b8afa5]">—</span>
                                          )}
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                          <SelectItem value={PRIORITY_NONE}>None</SelectItem>
                                          {PRIORITY_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : null}

                                  {row.fieldType === "date" ? (
                                    <div
                                      data-row-editor="true"
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      className="flex justify-end"
                                    >
                                      <DateRangeCalendarDropdown
                                        range={normalizeDueDateValue(row.value) ?? { start: null, end: null }}
                                        onChange={(nextRange) =>
                                          onUpdateRows((currentRows) =>
                                            currentRows.map((candidate) =>
                                              candidate.id === row.id ? { ...candidate, value: nextRange } : candidate
                                            )
                                          )
                                        }
                                      >
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1.5 bg-transparent text-[15px] text-[#1f1a15]"
                                        >
                                          {normalizeDueDateValue(row.value) ? <Calendar className="h-3.5 w-3.5 text-[#9e9488]" /> : null}
                                          <span className={cn(!normalizeDueDateValue(row.value) && "text-[#b8afa5]")}>
                                            {formatDateRange(normalizeDueDateValue(row.value))}
                                          </span>
                                        </button>
                                      </DateRangeCalendarDropdown>
                                    </div>
                                  ) : null}

                                  {row.fieldType === "person" ? (
                                    <div
                                      data-row-editor="true"
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      className="flex justify-end"
                                    >
                                      {editingPersonRowId === row.id ? (
                                        <div className="w-[220px] max-w-full">
                                          <PersonCell
                                            field={{
                                              id: row.id,
                                              table_id: "__text_card__",
                                              name: row.label || "Person",
                                              type: "person",
                                              config: null,
                                              order: index,
                                              is_primary: false,
                                              width: null,
                                              created_at: "",
                                              updated_at: "",
                                            }}
                                            value={personValue}
                                            editing
                                            onStartEdit={() => setEditingPersonRowId(row.id)}
                                            onCancel={() => setEditingPersonRowId(null)}
                                            onCommit={(nextValue) => {
                                              setEditingPersonRowId(null);
                                              onUpdateRows((currentRows) =>
                                                currentRows.map((candidate) =>
                                                  candidate.id === row.id
                                                    ? {
                                                        ...candidate,
                                                        value: Array.isArray(nextValue) ? nextValue : [],
                                                      }
                                                    : candidate
                                                )
                                              );
                                            }}
                                            workspaceMembers={workspaceMembers.map((member) => ({
                                              id: member.user_id,
                                              name: member.name ?? undefined,
                                              email: member.email,
                                            }))}
                                          />
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setEditingPersonRowId(row.id)}
                                          className={cn(
                                            "inline-flex min-h-[28px] items-center gap-2 bg-transparent text-[15px] text-[#1f1a15]",
                                            personEntries.length === 0 && "text-[#b8afa5]"
                                          )}
                                        >
                                          {personEntries.length === 0 ? (
                                            <span>—</span>
                                          ) : (
                                            <>
                                              <span className="flex -space-x-2">
                                                {personEntries.slice(0, 2).map((entry) => (
                                                  <span
                                                    key={entry.id}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[#e6f0ff] text-[11px] font-medium text-[#315e9d]"
                                                  >
                                                    {entry.initials}
                                                  </span>
                                                ))}
                                              </span>
                                              <span className="truncate">
                                                {personEntries[0]?.displayName}
                                                {personEntries.length > 1 ? ` +${personEntries.length - 1}` : ""}
                                              </span>
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {isTypeMenuOpen ? (
                                <div
                                  data-text-card-type-menu="true"
                                  className="absolute left-[calc(100%+14px)] top-1/2 z-20 w-40 -translate-y-1/2 rounded-[12px] border border-[#d8d0c7] bg-white p-1.5 shadow-[0_12px_32px_rgba(23,18,10,0.1)]"
                                >
                                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => {
                                    const isActive = row.fieldType === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                          setActiveTypeMenuRowKey(null);
                                          if (row.fieldType === value) return;
                                          onUpdateRows((currentRows) =>
                                            currentRows.map((candidate) =>
                                              candidate.id === row.id
                                                ? {
                                                    ...candidate,
                                                    fieldType: value as TextCardFieldType,
                                                    value: getDefaultRowValue(value as TextCardFieldType),
                                                  }
                                                : candidate
                                            )
                                          );
                                        }}
                                        className={cn(
                                          "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px] text-[#5f574f] transition-colors hover:bg-[#f6f2ed]",
                                          isActive && "bg-[#f6f2ed] text-[#1f1a15]"
                                        )}
                                      >
                                        <span>{label}</span>
                                        {isActive ? <span className="text-[11px] text-[#8b837a]">Current</span> : null}
                                      </button>
                                    );
                                  })}

                                  <div className="my-1 h-px bg-[#ece4da]" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTypeMenuRowKey(null);
                                      onUpdateRows((currentRows) => currentRows.filter((candidate) => candidate.id !== row.id));
                                    }}
                                    className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] text-[#9a5047] transition-colors hover:bg-[#fcf2f0]"
                                  >
                                    Delete field
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </SortableTextCardRow>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="px-6 pb-5 pt-4">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => onUpdateRows((currentRows) => [...currentRows, createEmptyTextRow()])}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d3cbc1] bg-white text-[#766d64] transition-colors hover:border-[#bdb4aa] hover:text-[#1f1a15]"
                    aria-label="Add field"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
