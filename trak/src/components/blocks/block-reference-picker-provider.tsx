"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ReferencePicker from "@/components/timelines/reference-picker";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";
import { useCreateBlockReference } from "@/lib/hooks/use-block-references";

interface OpenOptions {
  initialQuery?: string;
  onSelect?: (item: LinkableItem, searchQuery?: string) => void;
  onClose?: () => void;
  anchorRect?: DOMRect | null;
  /** Called on viewport resize/scroll to keep popover anchored to trigger. */
  getAnchorRect?: () => DOMRect | null;
  popoverGap?: number;
  /** When true, picker hides the keyboard instructions (for card comment/notes). */
  hideInstructions?: boolean;
  /** When "left", picker is placed to the left of the anchor (e.g. next to card). */
  popoverSide?: "left" | "right";
}

interface BlockReferencePickerContextValue {
  openPicker: (options?: OpenOptions) => void;
  updateQuery?: (query: string) => void;
  closePicker: () => void;
  isOpen: boolean;
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
  const [popoverGap, setPopoverGap] = useState<number>(2);
  const [hideInstructions, setHideInstructions] = useState(false);
  const [popoverSide, setPopoverSide] = useState<"left" | "right" | undefined>(undefined);
  const pendingCloseRef = useRef<(() => void) | undefined>(undefined);
  const getAnchorRectRef = useRef<(() => DOMRect | null) | undefined>(undefined);

  const createReference = useCreateBlockReference(blockId);

  const openPicker = useCallback((options?: OpenOptions) => {
    const query = options?.initialQuery ?? "";
    setInitialQuery(query);
    setCurrentQuery(query);
    setPendingSelect(() => options?.onSelect);
    setAnchorRect(options?.anchorRect ?? null);
    setPopoverGap(options?.popoverGap ?? 2);
    setHideInstructions(options?.hideInstructions ?? false);
    setPopoverSide(options?.popoverSide);
    getAnchorRectRef.current = options?.getAnchorRect;
    pendingCloseRef.current = options?.onClose;
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
    setPopoverGap(2);
    setHideInstructions(false);
    setPopoverSide(undefined);
    getAnchorRectRef.current = undefined;
    pendingCloseRef.current?.();
    pendingCloseRef.current = undefined;
  }, []);

  // Re-anchor popover on viewport resize or scroll so it stays next to the trigger
  React.useEffect(() => {
    if (!isOpen || !anchorRect) return;
    const updatePosition = () => {
      const rect = getAnchorRectRef.current?.();
      if (rect) setAnchorRect(rect);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, anchorRect]);

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
      }

      if (pendingSelect) {
        // Always call so inline mentions (e.g. in comments) get the link even if block ref failed
        pendingSelect(item, currentQuery);
      }

      return !("error" in result);
    },
    [blockId, createReference, pendingSelect, currentQuery]
  );

  const value = useMemo(
    () => ({ openPicker, updateQuery, closePicker: handleClose, isOpen }),
    [openPicker, updateQuery, handleClose, isOpen]
  );

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
          popoverGap={popoverGap}
          autoFocus={!anchorRect}
          onClose={handleClose}
          onSelect={handleSelect}
          onQueryChange={handleQueryChange}
          hideInstructions={hideInstructions}
          popoverSide={popoverSide}
        />
      )}
    </BlockReferencePickerContext.Provider>
  );
}
