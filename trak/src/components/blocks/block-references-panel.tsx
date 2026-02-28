"use client";

import { useRef, useState } from "react";
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
  const addAttachmentButtonRef = useRef<HTMLButtonElement>(null);

  if (!picker) {
    return null;
  }

  if (references.length === 0) {
    return null;
  }

  return (
    <div className="text-[11px]">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <span className={cn("font-medium underline underline-offset-2", isOpen && "text-[var(--foreground)]")}>
            Attachments ({references.length})
          </span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")}
          />
        </button>
        {!readOnly && (
          <button
            ref={addAttachmentButtonRef}
            type="button"
            onClick={(e) => {
              const el = e.currentTarget as HTMLElement;
              picker.openPicker({
                anchorRect: el.getBoundingClientRect(),
                getAnchorRect: () => addAttachmentButtonRef.current?.getBoundingClientRect() ?? null,
              });
            }}
            className="inline-flex items-center justify-center text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Add attachment"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 shadow-popover">
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
