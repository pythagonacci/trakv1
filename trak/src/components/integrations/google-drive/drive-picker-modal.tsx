"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PickerItem = {
  providerItemId: string;
  name: string;
  itemKind: "file" | "folder";
  mimeType?: string;
  webViewLink?: string;
  iconLink?: string;
  ownerDisplay?: string;
  modifiedTime?: string;
};

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  foldersOnly?: boolean;
  multiSelect?: boolean;
  title?: string;
  onSelect: (items: PickerItem[]) => void;
}

export function DrivePickerModal({
  isOpen,
  onClose,
  workspaceId,
  foldersOnly = false,
  multiSelect = true,
  title = "Link from Google Drive",
  onSelect,
}: DrivePickerModalProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "my_drive" | "shared_drives">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [selected, setSelected] = useState<Record<string, PickerItem>>({});

  const selectedItems = useMemo(() => Object.values(selected), [selected]);

  const load = async () => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      workspace_id: workspaceId,
      q: query,
      source,
      foldersOnly: foldersOnly ? "1" : "0",
    });

    try {
      const response = await fetch(`/api/integrations/google-drive/picker?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load Drive items");
      }
      setItems(payload.files || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Drive items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, source, foldersOnly]);

  const toggleItem = (item: PickerItem) => {
    if (!multiSelect) {
      setSelected({ [item.providerItemId]: item });
      return;
    }

    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.providerItemId]) {
        delete next[item.providerItemId];
      } else {
        next[item.providerItemId] = item;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const values = selectedItems;
    if (values.length === 0) return;
    onSelect(values);
    onClose();
    setSelected({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={foldersOnly ? "Search folders" : "Search files and folders"}
              className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
            <Button type="button" variant="outline" onClick={load} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className={`rounded px-2 py-1 ${source === "all" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)]"}`}
              onClick={() => setSource("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${source === "my_drive" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)]"}`}
              onClick={() => setSource("my_drive")}
            >
              My Drive
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${source === "shared_drives" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)]"}`}
              onClick={() => setSource("shared_drives")}
            >
              Shared Drives
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="max-h-96 overflow-y-auto rounded-md border border-[var(--border)]">
            {items.length === 0 && !loading ? (
              <div className="p-4 text-sm text-[var(--muted-foreground)]">No items found.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {items.map((item) => {
                  const checked = !!selected[item.providerItemId];
                  return (
                    <label
                      key={item.providerItemId}
                      className="flex cursor-pointer items-center gap-3 p-3 hover:bg-[var(--surface-hover)]"
                    >
                      <input
                        type={multiSelect ? "checkbox" : "radio"}
                        checked={checked}
                        onChange={() => toggleItem(item)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {item.itemKind === "folder" ? "Folder" : item.mimeType || "File"}
                          {item.ownerDisplay ? ` • ${item.ownerDisplay}` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted-foreground)]">Selected: {selectedItems.length}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled={selectedItems.length === 0} onClick={handleConfirm}>
                Link {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
