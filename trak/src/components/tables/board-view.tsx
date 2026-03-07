"use client";

import React, { useMemo } from "react";
import { ArrowDown, ArrowUp, Minus, Plus } from "lucide-react";
import type {
  GroupByConfig,
  PriorityFieldConfig,
  PriorityLevelConfig,
  SelectFieldOption,
  SelectFieldConfig,
  StatusFieldConfig,
  TableField,
  TableRow,
} from "@/types/table";
import { groupRows, canGroupByField } from "@/lib/table-grouping";
import { getCanonicalPriorityOption, getCanonicalStatusOption } from "@/lib/tables/universal-property";
import { formatUserDisplay } from "@/lib/field-utils";

interface BoardViewProps {
  fields: TableField[];
  rows: TableRow[];
  groupBy?: GroupByConfig;
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  selectedRows: Set<string>;
  onSelectRow: (rowId: string, event: React.MouseEvent<HTMLInputElement>) => void;
  onUpdateCell: (rowId: string, fieldId: string, value: unknown) => void;
  onCreateRow: (data?: Record<string, unknown>) => void;
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
}

const getPriorityIcon = (order: number) => {
  if (order >= 4) return <ArrowUp className="h-3 w-3" />;
  if (order >= 3) return <ArrowUp className="h-3 w-3" />;
  if (order >= 2) return <Minus className="h-3 w-3" />;
  return <ArrowDown className="h-3 w-3" />;
};

const toDateToken = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateRange = (value: unknown): { start: string; end: string } | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) return { start: rangeMatch[1], end: rangeMatch[2] };
    const token = toDateToken(trimmed);
    return token ? { start: token, end: token } : null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const start = toDateToken(obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null);
    const end = toDateToken(obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start);
    if (!start && !end) return null;
    return { start: start || end, end: end || start };
  }

  const token = toDateToken(value);
  return token ? { start: token, end: token } : null;
};

const formatToken = (token: string): string => {
  const [year, month, day] = token.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString();
};

const toDateDisplay = (value: unknown) => {
  const range = toDateRange(value);
  if (!range) return "";
  if (range.start && range.end && range.start !== range.end) {
    return `${formatToken(range.start)} - ${formatToken(range.end)}`;
  }
  return formatToken(range.end || range.start);
};

const withAlpha = (color: string, alpha: string) => {
  if (!color) return color;
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color;
};

export function BoardView({
  fields,
  rows,
  groupBy,
  workspaceMembers = [],
  selectedRows,
  onSelectRow,
  onUpdateCell,
  onCreateRow,
  onContextMenu,
}: BoardViewProps) {
  const groupByField = groupBy?.fieldId
    ? fields.find((f) => f.id === groupBy.fieldId)
    : undefined;

  const grouped = useMemo(() => {
    if (!groupByField || !canGroupByField(groupByField.type)) {
      return null;
    }
    return groupRows(rows, groupByField, [], {
      members: workspaceMembers,
      showEmptyGroups: groupBy?.showEmptyGroups ?? true,
      sortOrder: groupBy?.sortOrder,
    });
  }, [rows, groupByField, groupBy?.showEmptyGroups, groupBy?.sortOrder, workspaceMembers]);

  const primaryField = useMemo(
    () => fields.find((f) => f.is_primary) ?? fields[0],
    [fields]
  );
  const dateField = useMemo(() => fields.find((f) => f.type === "date"), [fields]);
  const personField = useMemo(() => fields.find((f) => f.type === "person"), [fields]);
  const priorityField = useMemo(() => fields.find((f) => f.type === "priority"), [fields]);
  const statusField = useMemo(() => fields.find((f) => f.type === "status"), [fields]);
  const selectField = useMemo(() => fields.find((f) => f.type === "select"), [fields]);
  const tagsField = useMemo(() => fields.find((f) => f.type === "tags"), [fields]);

  if (!groupByField || !grouped) {
    return (
      <div className="p-6 text-sm text-[var(--muted-foreground)]">
        Choose a field in the "Group" menu to build your board.
      </div>
    );
  }

  const handleAddRow = (groupId: string) => {
    const data: Record<string, unknown> = {};
    if (groupId !== "__ungrouped__") {
      if (groupByField.type === "multi_select" || groupByField.type === "tags") {
        data[groupByField.id] = [groupId];
      } else if (groupByField.type === "checkbox" || groupByField.type === "subtask") {
        data[groupByField.id] = groupId === "true";
      } else {
        data[groupByField.id] = groupId;
      }
    } else if (groupByField.type === "multi_select" || groupByField.type === "tags") {
      data[groupByField.id] = [];
    } else {
      data[groupByField.id] = null;
    }
    onCreateRow(data);
  };

  const handleDrop = (rowId: string, sourceGroupId: string, targetGroupId: string) => {
    if (!groupByField) return;
    if (groupByField.type === "multi_select" || groupByField.type === "tags") {
      const current = rows.find((row) => row.id === rowId)?.data?.[groupByField.id];
      const currentValues = Array.isArray(current) ? current.map(String) : [];
      const withoutSource = currentValues.filter((value) => value !== sourceGroupId);
      const next =
        targetGroupId === "__ungrouped__"
          ? withoutSource
          : Array.from(new Set([...withoutSource, targetGroupId]));
      onUpdateCell(rowId, groupByField.id, next.length ? next : []);
      return;
    }
    if (groupByField.type === "checkbox" || groupByField.type === "subtask") {
      if (targetGroupId === "__ungrouped__") {
        onUpdateCell(rowId, groupByField.id, null);
      } else {
        onUpdateCell(rowId, groupByField.id, targetGroupId === "true");
      }
      return;
    }
    const value = targetGroupId === "__ungrouped__" ? null : targetGroupId;
    onUpdateCell(rowId, groupByField.id, value);
  };

  const renderSelectBadge = (label: string, color?: string) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] px-1.5 py-0.5 text-[10px]"
      style={{
        backgroundColor: color ? withAlpha(color, "1A") : "var(--surface-hover)",
        borderColor: color ? withAlpha(color, "33") : "var(--border)",
        color: color || "var(--muted-foreground)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color || "var(--muted-foreground)" }}
      />
      {label}
    </span>
  );

  const renderPriorityBadge = (level?: PriorityLevelConfig | null) => {
    if (!level) return null;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: level.color ? withAlpha(level.color, "1A") : "var(--surface-hover)",
          borderColor: level.color ? withAlpha(level.color, "33") : "var(--border)",
          color: level.color || "var(--muted-foreground)",
        }}
      >
        {getPriorityIcon(level.order || 0)}
        {level.label}
      </span>
    );
  };

  const resolveOption = (
    field: TableField | undefined,
    value: unknown
  ): SelectFieldOption | PriorityLevelConfig | null => {
    if (!field || value === null || value === undefined) return null;
    if (field.type === "priority") {
      const levels = ((field.config || {}) as PriorityFieldConfig).levels || [];
      const matched = levels.find((level) => level.id === value || level.label === value);
      if (matched) return matched;
      const fallback = getCanonicalPriorityOption(value);
      return fallback
        ? { id: fallback.id, label: fallback.label, color: fallback.color, order: fallback.order }
        : null;
    }
    if (field.type === "select" || field.type === "multi_select" || field.type === "tags") {
      const options = ((field.config || {}) as SelectFieldConfig).options || [];
      return options.find((opt) => opt.id === value || opt.label === value) || null;
    }
    if (field.type === "status") {
      const options = ((field.config || {}) as StatusFieldConfig).options || [];
      const matched = options.find((opt) => opt.id === value || opt.label === value);
      if (matched) return matched;
      const fallback = getCanonicalStatusOption(value);
      return fallback ? { id: fallback.id, label: fallback.label, color: fallback.color } : null;
    }
    return null;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex w-full min-w-max p-3">
        {grouped.map((group, columnIndex) => (
          <div
            key={group.groupId}
            className={`flex min-w-[240px] flex-1 flex-col gap-2 ${columnIndex > 0 ? "border-l-2 border-[var(--border)] pl-3" : "pr-2"}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const rowId = e.dataTransfer.getData("rowId");
              const sourceGroupId = e.dataTransfer.getData("groupId");
              if (rowId) {
                handleDrop(rowId, sourceGroupId, group.groupId);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-[var(--muted-foreground)] flex items-center gap-1.5">
                {group.groupColor && (
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.groupColor }}
                  />
                )}
                {group.groupLabel}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--tertiary-foreground)]">
                  {group.count}
                </span>
                <button
                  type="button"
                  onClick={() => handleAddRow(group.groupId)}
                  className="p-0.5 rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  aria-label={`Add row to ${group.groupLabel}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-h-[120px]">
              {group.rows.map((row) => {
                const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
                const personValue = personField ? row.data?.[personField.id] : null;
                const person = workspaceMembers.find((m) => m.id === personValue);
                const dateValue = dateField ? row.data?.[dateField.id] : null;
                const priorityValue = priorityField ? row.data?.[priorityField.id] : null;
                const statusValue = statusField ? row.data?.[statusField.id] : null;
                const selectValue = selectField ? row.data?.[selectField.id] : null;
                const tagsValue = tagsField ? row.data?.[tagsField.id] : [];

                const priority = resolveOption(priorityField, priorityValue) as PriorityLevelConfig | null;
                const status = resolveOption(statusField, statusValue);
                const selection = resolveOption(selectField, selectValue);
                const tags = Array.isArray(tagsValue)
                  ? tagsValue
                      .map((tag) => resolveOption(tagsField, tag))
                      .filter((tag): tag is SelectFieldOption => Boolean(tag))
                  : [];

                const cardGroupId = group.groupId;

                return (
                  <div
                    key={row.id}
                    className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs transition-shadow cursor-pointer group hover:border-[var(--secondary)]/30 hover:shadow-sm"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("rowId", row.id);
                      e.dataTransfer.setData("groupId", cardGroupId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onContextMenu?.(e, row.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-medium text-[var(--foreground)] flex-1 min-w-0 truncate">{title}</h3>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) =>
                          onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                        }
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--foreground)] focus:ring-offset-0 flex-shrink-0"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                      {dateField && Boolean(dateValue) && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">{toDateDisplay(dateValue)}</span>
                      )}
                      {personField && person && (
                        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)]">
                          <span className="h-5 w-5 rounded-full bg-[var(--border)] text-[10px] flex items-center justify-center text-[var(--muted-foreground)] flex-shrink-0">
                            {formatUserDisplay(person).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[100px]">{formatUserDisplay(person)}</span>
                        </span>
                      )}
                      {priorityField && priority && priorityField.id !== groupByField.id && renderPriorityBadge(priority)}
                      {statusField && status && statusField.id !== groupByField.id &&
                        renderSelectBadge(status.label, status.color)}
                      {selectField && selection && selectField.id !== groupByField.id &&
                        renderSelectBadge(selection.label, selection.color)}
                      {tagsField && tagsField.id !== groupByField.id &&
                        tags.slice(0, 2).map((tag) =>
                          renderSelectBadge(tag.label, tag.color)
                        )}
                      {tags.length > 2 && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">+{tags.length - 2}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
