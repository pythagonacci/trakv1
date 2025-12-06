"use client";

import React from "react";
import { Plus } from "lucide-react";

interface ClientTab {
  id: string;
  client_id: string;
  name: string;
  clients?: {
    workspace_id: string;
  }[];
}

interface ClientTabBlock {
  id: string;
  tab_id: string;
  type: string;
  content: any;
  position: number;
  column: number;
  created_at: string;
  updated_at: string;
}

interface ClientTabContentProps {
  tab: ClientTab;
  blocks: ClientTabBlock[];
  clientId: string;
}

export default function ClientTabContent({
  tab,
  blocks,
  clientId
}: ClientTabContentProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-[var(--surface)] p-3">
          <Plus className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          Empty Tab
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-4">
          This tab doesn't have any content yet. Add blocks to organize information about this client.
        </p>
        <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
          <Plus className="h-4 w-4" />
          Add Block
        </button>
      </div>
    );
  }

  // Group blocks by column
  const blocksByColumn = blocks.reduce((acc, block) => {
    if (!acc[block.column]) {
      acc[block.column] = [];
    }
    acc[block.column].push(block);
    return acc;
  }, {} as Record<number, ClientTabBlock[]>);

  const renderBlock = (block: ClientTabBlock) => {
    // Basic block rendering - this would be expanded with actual block types
    return (
      <div
        key={block.id}
        className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4 mb-4"
      >
        <div className="text-sm font-medium text-[var(--foreground)] mb-2 capitalize">
          {block.type.replace(/_/g, " ")}
        </div>
        <div className="text-sm text-[var(--muted-foreground)]">
          {block.content?.text || block.content?.title || "Block content"}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {tab.name}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Custom content for this client
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
          <Plus className="h-4 w-4" />
          Add Block
        </button>
      </div>

      {/* Multi-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((column) => (
          <div key={column} className="space-y-4">
            {blocksByColumn[column]?.map((block) => renderBlock(block)) || (
              <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
                Column {column + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}