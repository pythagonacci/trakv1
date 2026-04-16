"use client";

import { useMemo, memo } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { type TableField } from "@/types/table";
import { cn } from "@/lib/utils";
import { TableCell } from "./table-cell";

interface Props {
  fields: TableField[];
  columnTemplate?: string;
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
  onChange: (rowId: string, fieldId: string, value: unknown) => void;
  savingRowIds?: Set<string>;
  onOpenComments?: (rowId: string, anchorEl?: HTMLElement | null) => void;
  isCommentsOpen?: boolean;
  pinnedFields?: string[];
  onContextMenu?: (e: React.MouseEvent, rowId: string, fieldId?: string) => void;
  onCellDoubleClick?: (rowId: string, fieldId: string) => void;
  widths?: Record<string, number>;
  selectionWidth?: number;
  showSelection?: boolean;
  isSelected?: boolean;
  onSelectRow?: (rowId: string, event: React.MouseEvent<HTMLInputElement>) => void;
  rowMetadata?: {
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    updated_by?: string;
  };
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  files?: Array<{ id: string; file_name: string; file_size: number; file_type: string; url?: string }>;
  onUploadFiles?: (files: File[]) => Promise<string[]>;
  onCellKeyDown?: (e: React.KeyboardEvent, rowId: string, fieldId: string) => void;
  cellRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  draggable?: boolean;
  onDragStart?: (rowId: string, e: React.DragEvent) => void;
  onUpdateFieldConfig?: (fieldId: string, config: TableField["config"]) => void;
  editRequest?: { rowId: string; fieldId: string; initialValue?: string };
  onEditRequestHandled?: () => void;
  subtaskMeta?: {
    isSubtask?: boolean;
    hasSubtasks?: boolean;
    isCollapsed?: boolean;
  };
  onToggleSubtasks?: (rowId: string) => void;
  commentCount?: number;
  onContentResize?: () => void;
  expandedFieldIds?: Set<string>;
  expandedCellIds?: Set<string>;
  onToggleCellExpansion?: (rowId: string, fieldId: string) => void;
  selectedCellIds?: Set<string>;
  onCellSelectionMouseDown?: (event: React.MouseEvent, rowId: string, fieldId: string) => void;
  onCellSelectionMouseEnter?: (rowId: string, fieldId: string) => void;
}

export const TableRow = memo(function TableRow({
  fields,
  columnTemplate,
  tableId,
  rowId,
  data,
  onChange,
  savingRowIds,
  onOpenComments,
  isCommentsOpen,
  pinnedFields,
  onContextMenu,
  onCellDoubleClick,
  widths,
  selectionWidth = 0,
  showSelection,
  isSelected,
  onSelectRow,
  rowMetadata,
  workspaceMembers,
  files,
  onUploadFiles,
  onCellKeyDown,
  cellRefs,
  draggable,
  onDragStart,
  onUpdateFieldConfig,
  editRequest,
  onEditRequestHandled,
  subtaskMeta,
  onToggleSubtasks,
  commentCount,
  onContentResize,
  expandedFieldIds,
  expandedCellIds,
  onToggleCellExpansion,
  selectedCellIds,
  onCellSelectionMouseDown,
  onCellSelectionMouseEnter,
}: Props) {
  const saving = savingRowIds?.has(rowId);
  const isSubtask = Boolean(subtaskMeta?.isSubtask);
  const hasSubtasks = Boolean(subtaskMeta?.hasSubtasks);
  const isCollapsed = Boolean(subtaskMeta?.isCollapsed);
  const fieldMap = useMemo(() => {
    const map: Record<string, TableField> = {};
    fields.forEach((field) => {
      map[field.id] = field;
    });
    return map;
  }, [fields]);
  const primaryFieldId = useMemo(() => fields.find((field) => field.is_primary)?.id ?? fields[0]?.id, [fields]);
  const template = useMemo(() => {
    if (columnTemplate) return columnTemplate;
    // Default template: selection column + fields (last one fills space) + add column
    const lastIdx = fields.length - 1;
    const fieldsTemplate = fields.map((_, idx) =>
      idx === lastIdx ? "minmax(180px,1fr)" : "180px"
    ).join(" ");
    return showSelection
      ? `${selectionWidth || 36}px ${fieldsTemplate} 0px 40px`
      : `${fieldsTemplate} 0px 40px`;
  }, [columnTemplate, fields, showSelection, selectionWidth]);

  const pinnedOffsets = useMemo(() => {
    let acc = showSelection ? selectionWidth : 0;
    const offsets: Record<string, number> = {};
    fields.forEach((f) => {
      offsets[f.id] = acc;
      acc += widths?.[f.id] ?? f.width ?? 180;
    });
    return offsets;
  }, [fields, widths, selectionWidth, showSelection]);

  return (
    <div
      className="relative grid min-h-[38px] border-l border-neutral-200 row-hover-teal transition-colors duration-150 bg-white w-full after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:z-30 after:h-px after:bg-[rgba(28,25,22,0.28)]"
      style={{ gridTemplateColumns: template, gridAutoRows: "minmax(38px, max-content)" }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, rowId);
      }}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(rowId, e)}
    >
      {showSelection && (
        <div className="flex min-h-[38px] items-center justify-center border-r border-[var(--border-strong)] bg-white sticky left-0 z-20">
          <input
            type="checkbox"
            checked={Boolean(isSelected)}
            onChange={(e) => {
              e.stopPropagation();
              onSelectRow?.(rowId, e as unknown as React.MouseEvent<HTMLInputElement>);
            }}
            className="h-4 w-4 rounded-[4px] accent-[var(--primary)]"
          />
        </div>
      )}
      {fields.map((field, idx) => {
        const isPinned = pinnedFields?.includes(field.id);
        const isPrimary = field.id === primaryFieldId;
        const showSubtaskToggle = isPrimary && hasSubtasks;
        const showSubtaskIndent = isPrimary && isSubtask;
        const cellKey = `${rowId}:${field.id}`;
        const fieldIsExpanded = Boolean(expandedFieldIds?.has(field.id));
        const cellIsExpanded = Boolean(expandedCellIds?.has(cellKey));
        const isCellSelected = Boolean(selectedCellIds?.has(cellKey));
        return (
          <div
            key={field.id}
            className={cn(
              "min-h-[38px] px-3 py-2 border-r border-[var(--border-strong)] last:border-r-0 min-w-0",
              isPinned ? "sticky z-10 bg-white" : "",
              isCellSelected ? "bg-[var(--secondary)]/15 ring-1 ring-inset ring-[var(--primary)]" : ""
            )}
            style={isPinned ? {
              left: `${pinnedOffsets[field.id]}px`,
              boxShadow: idx > 0 ? '2px 0 4px rgba(0,0,0,0.1)' : 'none'
            } : {}}
            tabIndex={0}
            role="gridcell"
            ref={(el) => {
              if (cellRefs) {
                cellRefs.current[`${rowId}-${field.id}`] = el;
              }
            }}
            onKeyDown={(e) => onCellKeyDown?.(e, rowId, field.id)}
            onMouseDown={(e) => onCellSelectionMouseDown?.(e, rowId, field.id)}
            onMouseEnter={() => onCellSelectionMouseEnter?.(rowId, field.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu?.(e, rowId, field.id);
            }}
            onDoubleClick={(e) => {
              const target = e.target instanceof HTMLElement ? e.target : null;
              if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
              const targetButton = target?.closest("button");
              const buttonClassName = typeof targetButton?.className === "string" ? targetButton.className : "";
              const isCellDisplayButton = buttonClassName.includes("w-full") && buttonClassName.includes("text-left");
              if (targetButton && !isCellDisplayButton) return;
              onCellDoubleClick?.(rowId, field.id);
            }}
          >
            <div className={`flex min-h-[22px] items-start gap-1 ${showSubtaskIndent ? "pl-6" : ""}`}>
              {showSubtaskToggle && (
                <button
                  type="button"
                  className="h-4 w-4 shrink-0 flex items-center justify-center rounded-sm text-neutral-600 hover:text-[var(--foreground)] mt-0.5"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleSubtasks?.(rowId);
                  }}
                  aria-label={isCollapsed ? "Expand subtasks" : "Collapse subtasks"}
                  title={isCollapsed ? "Expand subtasks" : "Collapse subtasks"}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              <div className={cn("min-w-0 flex-1 w-full", fieldIsExpanded || cellIsExpanded ? "overflow-visible" : "overflow-hidden")}>
                <TableCell
                  field={field}
                  value={data?.[field.id]}
                  onChange={(value) => onChange(rowId, field.id, value)}
                  tableId={tableId}
                  rowId={rowId}
                  saving={saving}
                  rowData={rowMetadata}
                  workspaceMembers={workspaceMembers}
                  files={files}
                  fieldMap={fieldMap}
                  onUploadFiles={onUploadFiles}
                  onUpdateFieldConfig={(config) => onUpdateFieldConfig?.(field.id, config)}
                  editRequest={editRequest}
                  onEditRequestHandled={onEditRequestHandled}
                  onContentResize={onContentResize}
                  forceExpanded={fieldIsExpanded}
                  expanded={cellIsExpanded}
                  onToggleExpanded={() => onToggleCellExpansion?.(rowId, field.id)}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="min-w-0 bg-white" aria-hidden="true" />
      <div className="min-h-[38px] px-2 py-2 border-l border-[var(--border-strong)] sticky right-0 z-10 bg-white flex items-center justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments?.(rowId, e.currentTarget);
          }}
          className={cn(
            "relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
            (commentCount || 0) > 0 || isCommentsOpen
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-200 hover:text-[var(--foreground)]"
          )}
          title={(commentCount || 0) > 0 ? `${commentCount} comment${(commentCount || 0) === 1 ? "" : "s"}` : "Add comment"}
          aria-label={(commentCount || 0) > 0 ? `${commentCount} comment${(commentCount || 0) === 1 ? "" : "s"}` : "Add comment"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {(commentCount || 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-medium flex items-center justify-center px-1">
              {commentCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
});
