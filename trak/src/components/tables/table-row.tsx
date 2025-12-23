"use client";

import { useMemo } from "react";
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
}

export function TableRow({ fields, columnTemplate, rowId, data, onChange, savingRowIds, onOpenComments, pinnedFields, onContextMenu }: Props) {
  const saving = savingRowIds?.has(rowId);
  const template = useMemo(
    () => columnTemplate || Array(fields.length).fill("minmax(180px,1fr)").join(" "),
    [columnTemplate, fields.length]
  );
  return (
    <div
      className="grid border-b border-[var(--border)] row-hover-teal transition-colors duration-150 bg-[var(--surface)] w-full"
      style={{ gridTemplateColumns: template }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, rowId);
      }}
    >
      {fields.map((field, idx) => {
        const isPinned = pinnedFields?.includes(field.id);
        return (
          <div
            key={field.id}
            className={`px-3 py-2 border-r border-[var(--border)] last:border-r-0 ${isPinned ? "sticky z-10 bg-[var(--surface)]" : ""}`}
            style={isPinned ? {
              left: idx > 0 ? `${idx * 180}px` : '0px',
              boxShadow: idx > 0 ? '2px 0 4px rgba(0,0,0,0.1)' : 'none'
            } : {}}
          >
            <TableCell
              field={field}
              value={data?.[field.id]}
              onChange={(value) => onChange(rowId, field.id, value)}
              saving={saving}
            />
          </div>
        );
      })}
      <div className="px-2 py-2 border-l border-[var(--border)]" />
    </div>
  );
}
