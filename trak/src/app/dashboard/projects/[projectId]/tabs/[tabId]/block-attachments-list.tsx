"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useBlockReferenceSummaries, useDeleteBlockReference } from "@/lib/hooks/use-block-reference-queries";
import type { BlockReferenceSummary } from "@/app/actions/blocks/block-reference-actions";

interface BlockAttachmentsListProps {
  blockId: string;
  onAdd?: () => void;
  disabled?: boolean;
}

function LinkWithHoverCard({
  item,
  disabled,
  onRemove,
}: {
  item: BlockReferenceSummary;
  disabled?: boolean;
  onRemove: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="group relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="cursor-default border-b border-[var(--foreground)] text-[var(--foreground)] hover:opacity-80">
        {item.title}
      </span>
      {hover && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs shadow-lg"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-[var(--foreground)]">{item.title}</div>
              <div className="text-[10px] uppercase text-[var(--muted-foreground)]">
                {item.type_label ?? item.reference_type}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="shrink-0 text-[var(--tertiary-foreground)] hover:text-red-500"
                aria-label="Remove link"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

export default function BlockAttachmentsList({ blockId, onAdd, disabled }: BlockAttachmentsListProps) {
  const { data: references = [], isLoading } = useBlockReferenceSummaries(blockId);
  const deleteMutation = useDeleteBlockReference(blockId);

  if (isLoading) return null;

  if (references.length === 0 && !onAdd) return null;
  if (references.length === 0 && disabled) return null;

  if (references.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
          <span>Linked</span>
          <button type="button" onClick={onAdd} className="text-[var(--foreground)] hover:opacity-80">
            Add
          </button>
        </div>
        <div className="rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
          No linked items yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
        <span>Linked</span>
        {onAdd && (
          <button type="button" onClick={onAdd} className="text-[var(--foreground)] hover:opacity-80">
            Add
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {references.map((ref, i) => (
          <span key={ref.id} className="inline-flex items-center gap-x-1">
            {i > 0 && <span className="text-[var(--muted-foreground)]">,</span>}
            <LinkWithHoverCard
              item={ref}
              disabled={disabled}
              onRemove={(id) => deleteMutation.mutate(id)}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
