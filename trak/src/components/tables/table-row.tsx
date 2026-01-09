"use client";

import { useMemo, memo } from "react";
import { type TableField } from "@/types/table";
import { TableCell } from "./table-cell";

interface Props {
  fields: TableField[];
  columnTemplate?: string;
  rowId: string;
  data: Record<string, unknown>;
  onChange: (rowId: string, fieldId: string, value: unknown) => void;
  savingRowIds?: Set<string>;
  onOpenComments?: (rowId: string) => void;
  pinnedFields?: string[];
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
  widths?: Record<string, number>;
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
}

export const TableRow = memo(function TableRow({
  fields,
  columnTemplate,
  rowId,
  data,
  onChange,
  savingRowIds,
  onOpenComments,
  pinnedFields,
  onContextMenu,
  widths,
  rowMetadata,
  workspaceMembers,
  files,
  onUploadFiles,
  onCellKeyDown,
  cellRefs,
  draggable,
  onDragStart,
  onUpdateFieldConfig,
}: Props) {
  const saving = savingRowIds?.has(rowId);
  const template = useMemo(
    () => columnTemplate || Array(fields.length).fill("minmax(180px,1fr)").join(" "),
    [columnTemplate, fields.length]
  );

  const pinnedOffsets = useMemo(() => {
    let acc = 0;
    const offsets: Record<string, number> = {};
    fields.forEach((f) => {
      offsets[f.id] = acc;
      acc += widths?.[f.id] ?? f.width ?? 180;
    });
    return offsets;
  }, [fields, widths]);

  return (
    <div
      className="grid border-b border-l border-[var(--border)] row-hover-teal transition-colors duration-150 bg-[var(--surface)] w-full"
      style={{ gridTemplateColumns: template }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, rowId);
      }}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(rowId, e)}
    >
      {fields.map((field, idx) => {
        const isPinned = pinnedFields?.includes(field.id);
        return (
          <div
            key={field.id}
            className={`px-3 py-2 border-r border-[var(--border-strong)] last:border-r-0 ${isPinned ? "sticky z-10 bg-[var(--surface)]" : ""}`}
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
            <TableCell
              field={field}
              value={data?.[field.id]}
              onChange={(value) => onChange(rowId, field.id, value)}
              saving={saving}
              rowData={rowMetadata}
              workspaceMembers={workspaceMembers}
              files={files}
              onUploadFiles={onUploadFiles}
              onUpdateFieldConfig={(config) => onUpdateFieldConfig?.(field.id, config)}
            />
          </div>
        );
      })}
      <div className="px-2 py-2 border-l border-[var(--border)]" />
    </div>
  );
});
