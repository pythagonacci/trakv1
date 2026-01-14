"use client";

import { type Block } from "@/app/actions/block";
import { TableView } from "@/components/tables/table-view";

interface TableBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
}

export default function TableBlock({ block }: TableBlockProps) {
  const content = (block.content || {}) as Record<string, any>;
  const connectedTableId = content?.tableId;
  
  // New Supabase-backed table path: render the dedicated table view.
  if (connectedTableId) {
    return <TableView tableId={connectedTableId} />;
  }

  // Legacy table blocks without a connected tableId are no longer supported.
  // They should be migrated to use the new table system.
  return (
    <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)]">
      This table block needs to be migrated to the new table system. Please recreate it as a new table.
    </div>
  );
}        
