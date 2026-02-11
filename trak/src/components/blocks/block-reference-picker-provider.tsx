"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import ReferencePicker from "@/components/timelines/reference-picker";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";
import { useCreateBlockReference } from "@/lib/hooks/use-block-references";

interface OpenOptions {
  initialQuery?: string;
  onSelect?: (item: LinkableItem, searchQuery?: string) => void;
  anchorRect?: DOMRect | null;
}

interface BlockReferencePickerContextValue {
  openPicker: (options?: OpenOptions) => void;
  updateQuery?: (query: string) => void;
}

const BlockReferencePickerContext = createContext<BlockReferencePickerContextValue | null>(null);

export function useBlockReferencePicker() {
  return useContext(BlockReferencePickerContext);
}

export function BlockReferencePickerProvider({
  blockId,
  projectId,
  workspaceId,
  children,
}: {
  blockId: string;
  projectId?: string | null;
  workspaceId?: string | null;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string>("");
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [pendingSelect, setPendingSelect] = useState<OpenOptions["onSelect"]>();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const createReference = useCreateBlockReference(blockId);

  const openPicker = useCallback((options?: OpenOptions) => {
    const query = options?.initialQuery ?? "";
    setInitialQuery(query);
    setCurrentQuery(query);
    setPendingSelect(() => options?.onSelect);
    setAnchorRect(options?.anchorRect ?? null);
    setIsOpen(true);
  }, []);

  const updateQuery = useCallback((query: string) => {
    if (isOpen) {
      setInitialQuery(query);
      setCurrentQuery(query);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setInitialQuery("");
    setCurrentQuery("");
    setPendingSelect(undefined);
    setAnchorRect(null);
  }, []);

  const handleQueryChange = useCallback((query: string) => {
    setCurrentQuery(query);
  }, []);

  const handleSelect = useCallback(
    async (item: LinkableItem) => {
      const result = await createReference.mutateAsync({
        blockId,
        referenceType: item.referenceType,
        referenceId: item.id,
        tableId: null,
      });
      if ("error" in result) {
        console.error("Failed to create block reference:", result.error);
        return false;
      }

      if (pendingSelect) {
        // Pass the current query so the callback can replace "@" + query
        pendingSelect(item, currentQuery);
      }

      return true;
    },
    [blockId, createReference, pendingSelect, currentQuery]
  );

  const value = useMemo(() => ({ openPicker, updateQuery }), [openPicker, updateQuery]);

  return (
    <BlockReferencePickerContext.Provider value={value}>
      {children}
      {projectId && workspaceId && (
        <ReferencePicker
          isOpen={isOpen}
          projectId={projectId}
          workspaceId={workspaceId}
          initialQuery={initialQuery}
          variant={anchorRect ? "popover" : "dialog"}
          anchorRect={anchorRect}
          autoFocus={!anchorRect}
          onClose={handleClose}
          onSelect={handleSelect}
          onQueryChange={handleQueryChange}
        />
      )}
    </BlockReferencePickerContext.Provider>
  );
}
