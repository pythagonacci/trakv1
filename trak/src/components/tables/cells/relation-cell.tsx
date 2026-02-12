"use client";

import { useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import type { TableField } from "@/types/table";
import { useRelatedRows } from "@/lib/hooks/use-table-queries";
import { RelationSelector } from "./relation-selector";

interface Props {
  field: TableField;
  value: unknown;
  rowId: string;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

function getRelationIds(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") return [value];
  return [];
}

export function RelationCell({
  field,
  value,
  rowId,
  editing,
  saving,
  onStartEdit,
  onCancel,
  onCommit,
}: Props) {
  const [open, setOpen] = useState(false);
  const ids = getRelationIds(value);
  const { data } = useRelatedRows(rowId, field.id);

  const displayFieldId = data?.displayFieldId;
  const rowMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.rows || []).forEach((row) => {
      const label =
        displayFieldId && row.data?.[displayFieldId] !== undefined
          ? row.data?.[displayFieldId]
          : row.id;
      map.set(row.id, label ? String(label) : "Untitled");
    });
    return map;
  }, [data, displayFieldId]);

  const labels = ids.map((id) => rowMap.get(id) || "Untitled");

  const handleOpen = () => {
    setOpen(true);
    onStartEdit();
  };

  const handleClose = () => {
    setOpen(false);
    onCancel();
  };

  const handleRemove = (id: string) => {
    const next = ids.filter((valueId) => valueId !== id);
    onCommit(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {labels.length === 0 && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={saving}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
        >
          Empty
        </button>
      )}
      {labels.slice(0, 3).map((label, idx) => (
        <span
          key={`${label}-${idx}`}
          className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--foreground)]"
        >
          <span className="truncate max-w-[120px]">{label}</span>
          <button
            type="button"
            onClick={() => handleRemove(ids[idx])}
            className="text-[var(--muted-foreground)] hover:text-[var(--error)]"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {labels.length > 3 && (
        <span className="inline-flex items-center rounded-[4px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
          +{labels.length - 3} more
        </span>
      )}
      <button
        type="button"
        onClick={handleOpen}
        disabled={saving}
        className="h-6 w-6 inline-flex items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        title="Add relation"
      >
        <Plus className="h-3 w-3" />
      </button>
      {open && (
        <RelationSelector
          field={field}
          currentLinks={ids}
          onSelect={(next) => {
            onCommit(next);
            setOpen(false);
          }}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
