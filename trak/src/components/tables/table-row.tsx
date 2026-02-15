"use client";

import { useMemo, memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type TableField } from "@/types/table";
import { TableCell } from "./table-cell";

interface Props {
  fields: TableField[];
  columnTemplate?: string;
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
  onChange: (rowId: string, fieldId: string, value: unknown) => void;
  savingRowIds?: Set<string>;
  onOpenComments?: (rowId: string) => void;
  pinnedFields?: string[];
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
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
  onUpdateFieldConfig?: (fieldId: string, config: any) => void;
  editRequest?: { rowId: string; fieldId: string; initialValue?: string };
  onEditRequestHandled?: () => void;
  subtaskMeta?: {
    isSubtask?: boolean;
    hasSubtasks?: boolean;
    isCollapsed?: boolean;
  };
  onToggleSubtasks?: (rowId: string) => void;
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
  pinnedFields,
  onContextMenu,
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
    // Default template: selection column + fields + add column
    const fieldsTemplate = Array(fields.length).fill("minmax(180px,1fr)").join(" ");
    return showSelection ? `${selectionWidth || 36}px ${fieldsTemplate} 40px` : `${fieldsTemplate} 40px`;
  }, [columnTemplate, fields.length, showSelection, selectionWidth]);

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
      className="grid border-b border-l border-[var(--border)] row-hover-teal transition-colors duration-150 bg-[var(--surface)] w-full last:border-b-0"
      style={{ gridTemplateColumns: template }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, rowId);
      }}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(rowId, e)}
    >
      {showSelection && (
        <div className="flex items-center justify-center border-r border-[var(--border-strong)] bg-[var(--surface)] sticky left-0 z-20">
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
        return (
          <div
            key={field.id}
            className={`px-3 py-2 border-r border-[var(--border-strong)] last:border-r-0 min-w-0 ${isPinned ? "sticky z-10 bg-[var(--surface)]" : ""}`}
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
          >
            <div className={`flex items-start gap-1 ${showSubtaskIndent ? "pl-6" : ""}`}>
              {showSubtaskToggle && (
                <button
                  type="button"
                  className="h-4 w-4 shrink-0 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mt-0.5"
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
              <div className="min-w-0 flex-1 w-full overflow-hidden">
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
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="px-2 py-2 border-l border-[var(--border)]" />
    </div>
  );
});
