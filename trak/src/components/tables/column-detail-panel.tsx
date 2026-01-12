"use client";

import { X } from "lucide-react";
import { useTable } from "@/lib/hooks/use-table-queries";
import type { TableField, TableRow } from "@/types/table";
import { TableCell } from "./table-cell";

interface Props {
  tableId: string;
  fieldId: string;
  rows: TableRow[];
  onClose: () => void;
}

export function ColumnDetailPanel({ tableId, fieldId, rows, onClose }: Props) {
  const { data: tableData } = useTable(tableId);
  const field = tableData?.fields.find((f) => f.id === fieldId);
  const fieldMap = (tableData?.fields || []).reduce<Record<string, TableField>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  if (!field) return null;

  const columnData = rows.map((row) => ({
    rowId: row.id,
    value: row.data?.[fieldId],
  }));

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-[var(--surface)] border-l border-[var(--border)] shadow-popover flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{field.name}</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{field.type}</p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-[2px] bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors duration-150"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-2">
          {columnData.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)] text-center py-8">No data in this column</div>
          ) : (
            columnData.map((item, idx) => (
              <div
                key={item.rowId}
                className="p-3 rounded-[2px] bg-[var(--surface-muted)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors duration-150"
              >
                <div className="text-xs text-[var(--muted-foreground)] mb-1.5">Row {idx + 1}</div>
                <div className="min-h-[24px]">
                  <TableCell
                    field={field}
                    value={item.value}
                    onChange={() => {}} // Read-only in detail panel for now
                    tableId={tableId}
                    rowId={item.rowId}
                    saving={false}
                    fieldMap={fieldMap}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        {columnData.length} {columnData.length === 1 ? "row" : "rows"}
      </div>
    </div>
  );
}
