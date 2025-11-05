"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Block, getChildBlocks, createBlock } from "@/app/actions/block";
import BlockRenderer from "./block-renderer";
import AddBlockButton from "./add-block-button";
import { cn } from "@/lib/utils";

interface SectionBlockProps {
  block: Block;
  workspaceId: string;
  projectId: string;
  tabId: string;
  onUpdate?: () => void;
}

export default function SectionBlock({ block, workspaceId, projectId, tabId, onUpdate }: SectionBlockProps) {
  const router = useRouter();
  const [childBlocks, setChildBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const height = (block.content?.height as number) || 400;

  // Fetch child blocks
  useEffect(() => {
    const fetchChildBlocks = async () => {
      setIsLoading(true);
      const result = await getChildBlocks(block.id);
      if (result.error) {
        console.error("Failed to fetch child blocks:", result.error);
        setChildBlocks([]);
      } else {
        setChildBlocks(result.data || []);
      }
      setIsLoading(false);
    };

    fetchChildBlocks();
  }, [block.id]);

  const handleUpdate = () => {
    // Refresh child blocks
    const fetchChildBlocks = async () => {
      const result = await getChildBlocks(block.id);
      if (result.error) {
        console.error("Failed to fetch child blocks:", result.error);
      } else {
        setChildBlocks(result.data || []);
      }
    };
    fetchChildBlocks();
    onUpdate?.();
  };

  const handleDelete = async (blockId: string) => {
    // Remove from local state
    setChildBlocks(prev => prev.filter(b => b.id !== blockId));
    router.refresh();
  };

  const handleConvert = async (blockId: string, newType: any) => {
    // Not implemented for child blocks for now
    router.refresh();
  };


  return (
    <div className="w-full">
      {/* Scrollable container */}
      <div
        className={cn(
          "w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30",
          "overflow-x-auto overflow-y-auto",
          "scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent"
        )}
        style={{ height: `${height}px`, maxHeight: `${height}px` }}
      >
        <div className="p-4 space-y-3 min-h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-neutral-400">
              Loading...
            </div>
          ) : childBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <p className="text-sm text-neutral-400 dark:text-neutral-600 mb-4">
                This section is empty
              </p>
              <AddBlockButton 
                tabId={tabId} 
                projectId={projectId}
                parentBlockId={block.id}
                onBlockCreated={handleUpdate}
              />
            </div>
          ) : (
            <>
              {childBlocks.map((childBlock) => (
                <div key={childBlock.id} className="w-full">
                  <BlockRenderer
                    block={childBlock}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    tabId={tabId}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onConvert={handleConvert}
                    isDragging={false}
                  />
                </div>
              ))}
              <div className="pt-2">
                <AddBlockButton 
                  tabId={tabId} 
                  projectId={projectId}
                  parentBlockId={block.id}
                  onBlockCreated={handleUpdate}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

