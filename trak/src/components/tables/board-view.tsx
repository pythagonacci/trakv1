"use client";

import React, { useMemo } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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

const toDateDisplay = (value: unknown) => {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    if (!year || !month || !day) return "";
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
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
  const tagsField = useMemo(() => fields.find((f) => f.type === "multi_select"), [fields]);

  if (!groupByField || !grouped) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Choose a field in the "Group" menu to build your board.
      </div>
    );
  }

  const handleAddRow = (groupId: string) => {
    const data: Record<string, unknown> = {};
    if (groupId !== "__ungrouped__") {
      if (groupByField.type === "multi_select") {
        data[groupByField.id] = [groupId];
      } else if (groupByField.type === "checkbox") {
        data[groupByField.id] = groupId === "true";
      } else {
        data[groupByField.id] = groupId;
      }
    } else if (groupByField.type === "multi_select") {
      data[groupByField.id] = [];
    } else {
      data[groupByField.id] = null;
    }
    onCreateRow(data);
  };

  const handleDrop = (rowId: string, sourceGroupId: string, targetGroupId: string) => {
    if (!groupByField) return;
    if (groupByField.type === "multi_select") {
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
    if (groupByField.type === "checkbox") {
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
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border"
      style={{
        backgroundColor: color ? withAlpha(color, "1A") : "#f3f4f6",
        borderColor: color ? withAlpha(color, "33") : "#e5e7eb",
        color: color || "#374151",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color || "#9ca3af" }}
      />
      {label}
    </span>
  );

  const renderPriorityBadge = (level?: PriorityLevelConfig | null) => {
    if (!level) return null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border"
        style={{
          backgroundColor: level.color ? withAlpha(level.color, "1A") : "#f3f4f6",
          borderColor: level.color ? withAlpha(level.color, "33") : "#e5e7eb",
          color: level.color || "#374151",
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
      return levels.find((level) => level.id === value) || null;
    }
    if (field.type === "select" || field.type === "multi_select") {
      const options = ((field.config || {}) as SelectFieldConfig).options || [];
      return options.find((opt) => opt.id === value) || null;
    }
    if (field.type === "status") {
      const options = ((field.config || {}) as StatusFieldConfig).options || [];
      return options.find((opt) => opt.id === value) || null;
    }
    return null;
  };

  return (
    <div className="bg-white p-6">
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
        <span className="uppercase tracking-wide text-[10px]">Grouped by</span>
        <span className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">
          {groupByField.name}
        </span>
        <span className="text-gray-400">
          ({(groupBy?.sortOrder ?? "asc") === "asc" ? "A→Z" : "Z→A"})
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map((group) => (
          <div
            key={group.groupId}
            className="bg-gray-50/50 border border-gray-200 rounded-lg p-4 min-w-[280px] flex-shrink-0"
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {group.groupColor && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: group.groupColor }}
                  />
                )}
                <h2 className="text-sm font-semibold text-gray-900">{group.groupLabel}</h2>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                {group.count}
              </span>
            </div>

            <div className="space-y-2 mb-3">
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
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer group"
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-medium text-gray-900 flex-1">{title}</h3>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) =>
                          onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                        }
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {dateField && Boolean(dateValue) && (
                        <span className="text-xs text-gray-500">{toDateDisplay(dateValue)}</span>
                      )}
                      {personField && person && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                          <span className="h-5 w-5 rounded-full bg-gray-200 text-[10px] flex items-center justify-center text-gray-600">
                            {formatUserDisplay(person).slice(0, 2).toUpperCase()}
                          </span>
                          {formatUserDisplay(person)}
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
                        <span className="text-xs text-gray-500">+{tags.length - 2}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="w-full text-xs text-gray-600 py-2 border border-dashed border-gray-300 rounded hover:bg-gray-50 transition-colors"
              onClick={() => handleAddRow(group.groupId)}
            >
              + Add row
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
