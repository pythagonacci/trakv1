"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import ReferencePicker from "@/components/timelines/reference-picker";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";
import { useCreateBlockReference } from "@/lib/hooks/use-block-reference-queries";

export type AttachOpenOptions = {
  /** When set, picker appears above this position (inline mode). User types in place; call updateAttachQuery with text after @. */
  position?: { top: number; left: number };
  initialQuery?: string;
  /** When user selects an item in inline mode, called with the new ref id and display title so the block can insert it at caret. */
  onInsertRef?: (payload: { refId: string; title: string }) => void;
};

type BlockAttachContextValue = {
  openAttachPicker: (blockId: string, options?: AttachOpenOptions) => void;
  /** True when picker is open for this block (block should call updateAttachQuery on input). */
  isAttachOpenForBlock: (blockId: string) => boolean;
  updateAttachQuery: (query: string) => void;
  onAttachClose: () => void;
};

const BlockAttachContext = createContext<BlockAttachContextValue | null>(null);

export function useBlockAttach() {
  return useContext(BlockAttachContext);
}

export function BlockAttachProvider({
  children,
  projectId,
  workspaceId,
}: {
  children: React.ReactNode;
  projectId: string;
  workspaceId: string;
}) {
  const [attachBlockId, setAttachBlockId] = useState<string | null>(null);
  const [attachPosition, setAttachPosition] = useState<{ top: number; left: number } | null>(null);
  const [attachQuery, setAttachQuery] = useState("");
  const [onInsertRef, setOnInsertRef] = useState<((payload: { refId: string; title: string }) => void) | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const createBlockReferenceMutation = useCreateBlockReference(attachBlockId ?? undefined);

  const openAttachPicker = useCallback((blockId: string, options?: AttachOpenOptions) => {
    setAttachBlockId(blockId);
    setAttachPosition(options?.position ?? null);
    setAttachQuery(options?.initialQuery ?? "");
    setOnInsertRef(options?.onInsertRef ?? null);
    setIsOpen(true);
  }, []);

  const isAttachOpenForBlock = useCallback(
    (blockId: string) => isOpen && attachBlockId === blockId,
    [isOpen, attachBlockId]
  );

  const updateAttachQuery = useCallback((query: string) => {
    setAttachQuery(query);
  }, []);

  const onAttachClose = useCallback(() => {
    setIsOpen(false);
    setAttachBlockId(null);
    setAttachPosition(null);
    setAttachQuery("");
    setOnInsertRef(null);
  }, []);

  const handleSelect = useCallback(
    async (item: LinkableItem) => {
      if (!attachBlockId) return false;
      const result = await createBlockReferenceMutation.mutateAsync({
        blockId: attachBlockId,
        referenceType: item.referenceType as "doc" | "table_row" | "task" | "block",
        referenceId: item.id,
        tableId: null,
      });
      if ("error" in result) {
        console.error("Failed to create block reference:", result.error);
        return false;
      }
      const refId = result.data?.id;
      const title = item.name ?? "Item";
      if (refId && title != null && onInsertRef) {
        onInsertRef({ refId, title });
      }
      return true;
    },
    [attachBlockId, createBlockReferenceMutation, onInsertRef]
  );

  const value: BlockAttachContextValue = {
    openAttachPicker,
    isAttachOpenForBlock,
    updateAttachQuery,
    onAttachClose,
  };

  const isInline = attachPosition != null;

  return (
    <BlockAttachContext.Provider value={value}>
      {children}
      <ReferencePicker
        isOpen={isOpen}
        projectId={projectId}
        workspaceId={workspaceId}
        initialSearchQuery=""
        onClose={onAttachClose}
        onSelect={handleSelect}
        variant={isInline ? "inline" : "dialog"}
        position={attachPosition ?? undefined}
        controlledSearchQuery={isInline ? attachQuery : undefined}
      />
    </BlockAttachContext.Provider>
  );
}
