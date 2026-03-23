"use client";

import { useEffect, useState } from "react";
import type { Block } from "@/app/actions/block";
import type { ClientCommentIdentity } from "./use-client-comment-identity";
import type { ClientEditableBlockType } from "@/lib/client-page-edits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ClientBlockEditDialogProps {
  block: Block | null;
  open: boolean;
  publicToken: string;
  identity: ClientCommentIdentity | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedBlock: Block) => void;
}

type DraftState = {
  text: string;
  title: string;
  subtitle: string;
  url: string;
  caption: string;
};

function getEditableType(block: Block | null): ClientEditableBlockType | null {
  if (!block) return null;
  if (block.type === "text" || block.type === "link" || block.type === "section_header") {
    return block.type;
  }
  return null;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function ClientBlockEditDialog({
  block,
  open,
  publicToken,
  identity,
  onOpenChange,
  onSave,
}: ClientBlockEditDialogProps) {
  const editableType = getEditableType(block);
  const [draft, setDraft] = useState<DraftState>({
    text: "",
    title: "",
    subtitle: "",
    url: "",
    caption: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!block) return;
    const content = (block.content || {}) as Record<string, unknown>;
    setDraft({
      text: typeof content.text === "string" ? content.text : "",
      title: typeof content.title === "string" ? content.title : "",
      subtitle: typeof content.subtitle === "string" ? content.subtitle : "",
      url: typeof content.url === "string" ? content.url : "",
      caption: typeof content.caption === "string" ? content.caption : "",
    });
  }, [block]);

  const handleSave = async () => {
    if (!block || !editableType || !identity?.id || !identity.name) return;

    let content: Record<string, unknown>;
    if (editableType === "text") {
      content = { text: draft.text };
    } else if (editableType === "link") {
      content = {
        title: draft.title.trim() || null,
        url: normalizeUrl(draft.url) || null,
        caption: draft.caption.trim() || null,
      };
      if (!content.url) {
        alert("Please enter a link URL.");
        return;
      }
    } else {
      content = {
        title: draft.title.trim() || "New Section",
        subtitle: draft.subtitle.trim() || null,
      };
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/client-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          visitorId: identity.id,
          visitorName: identity.name,
          content,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.block) {
        throw new Error(data.error || "Failed to save changes.");
      }
      onSave(data.block as Block);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update client block:", error);
      alert(
        error instanceof Error ? error.message : "Failed to save changes."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDisabled =
    isSaving ||
    !editableType ||
    !identity?.name ||
    (editableType === "link" ? !draft.url.trim() : false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editableType === "text"
              ? "Edit text"
              : editableType === "link"
              ? "Edit link"
              : "Edit section"}
          </DialogTitle>
          <DialogDescription>
            Changes will be saved to the shared client page and attributed to your name.
          </DialogDescription>
        </DialogHeader>

        {editableType === "text" ? (
          <textarea
            value={draft.text}
            onChange={(event) =>
              setDraft((current) => ({ ...current, text: event.target.value }))
            }
            rows={10}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        ) : editableType === "link" ? (
          <div className="space-y-3">
            <input
              value={draft.url}
              onChange={(event) =>
                setDraft((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="https://example.com"
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Link title"
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <input
              value={draft.caption}
              onChange={(event) =>
                setDraft((current) => ({ ...current, caption: event.target.value }))
              }
              placeholder="Optional caption"
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Section title"
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <textarea
              value={draft.subtitle}
              onChange={(event) =>
                setDraft((current) => ({ ...current, subtitle: event.target.value }))
              }
              rows={3}
              placeholder="Optional subtitle"
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveDisabled}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
