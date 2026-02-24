"use client";

import { useEffect } from "react";
import { type Block } from "@/app/actions/block";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { getTableBootstrap } from "@/app/actions/tables/query-actions";

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
  const queryClient = useQueryClient();
  const content = (block.content || {}) as Record<string, any>;
  const connectedTableId = content?.tableId;

  // Start loading table data as soon as we have tableId (runs in parallel with TableView chunk load)
  useEffect(() => {
    if (!connectedTableId) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.tableBootstrap(connectedTableId),
      queryFn: async () => {
        const result = await getTableBootstrap(connectedTableId);
        if ("error" in result) throw new Error(result.error);
        return result.data;
      },
      staleTime: 30_000,
    });
  }, [connectedTableId, queryClient]);

  // New Supabase-backed table path: render the dedicated table view.
  if (connectedTableId) {
    return <TableView tableId={connectedTableId} />;
  }

  return <TableLoadingState />;
}        
