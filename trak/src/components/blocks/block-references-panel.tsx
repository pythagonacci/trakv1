"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBlockReferences, useDeleteBlockReference } from "@/lib/hooks/use-block-references";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import { getReferenceHref } from "@/lib/references/navigation";
import { useRouter } from "next/navigation";

export default function BlockReferencesPanel({
  blockId,
  readOnly,
}: {
  blockId: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { data: references = [] } = useBlockReferences(blockId);
  const deleteReference = useDeleteBlockReference(blockId);
  const picker = useBlockReferencePicker();

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (references.length > 0) {
      setIsOpen(true);
    }
  }, [references.length]);

  const countLabel = useMemo(() => {
    if (references.length === 0) return "No attachments";
    if (references.length === 1) return "1 attachment";
    return `${references.length} attachments`;
  }, [references.length]);

  if (!picker) {
    return null;
  }

  if (references.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[#d8d8d8]/20 text-[11px]">
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
          />
          <span>Attachments</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
            {countLabel}
          </span>
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={() => picker.openPicker()}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            title="Add attachment"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="border-t border-[var(--border)] px-2.5 py-1.5">
          {references.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--muted-foreground)]">
              No attachments yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {references.map((ref) => {
                const href = getReferenceHref({
                  reference_type: ref.reference_type,
                  reference_id: ref.reference_id,
                  tab_id: ref.tab_id ?? undefined,
                  project_id: ref.project_id ?? undefined,
                  is_workflow: ref.is_workflow,
                });
                return (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (href) router.push(href);
                      }}
                      className={cn(
                        "min-w-0 flex-1 text-left",
                        href ? "hover:opacity-80" : "cursor-default"
                      )}
                    >
                      <div className="font-medium text-[var(--foreground)] truncate leading-snug">
                        {ref.title}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">
                        {ref.type_label || ref.reference_type}
                      </div>
                    </button>
                    <div className="ml-2 flex items-center gap-1">
                      {href && (
                        <button
                          type="button"
                          onClick={() => router.push(href)}
                          className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                          title="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => deleteReference.mutateAsync(ref.id)}
                          className="text-[var(--tertiary-foreground)] hover:text-red-500"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
