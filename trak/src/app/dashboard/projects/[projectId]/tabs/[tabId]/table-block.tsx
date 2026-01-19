"use client";

import { type Block } from "@/app/actions/block";
import dynamic from "next/dynamic";

function TableLoadingState() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-48 rounded-md border border-[var(--border)] bg-[var(--surface)]/60" />
      <div className="h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/40" />
    </div>
  );
}

const TableView = dynamic(
  () => import("@/components/tables/table-view").then((mod) => mod.TableView),
  {
    loading: () => <TableLoadingState />,
    ssr: true,
  }
);

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

  return <TableLoadingState />;
}        
