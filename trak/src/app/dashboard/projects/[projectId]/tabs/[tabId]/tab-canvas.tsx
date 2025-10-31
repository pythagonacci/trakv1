"use client";

import { type Block } from "@/app/actions/block";
import EmptyCanvasState from "./empty-canvas-state";
import AddBlockButton from "./add-block-button";

interface TabCanvasProps {
  tabId: string;
  projectId: string;
  blocks: Block[];
}

export default function TabCanvas({ tabId, projectId, blocks }: TabCanvasProps) {
  return (
    <div className="space-y-6">
      {blocks.length === 0 ? (
        <EmptyCanvasState tabId={tabId} projectId={projectId} />
      ) : (
        <>
          {/* Blocks will render here in Task 2.6 */}
          {blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5"
            >
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                [{block.type}] Block ID: {block.id}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add Block Button */}
      <div className="flex gap-2">
        <AddBlockButton tabId={tabId} projectId={projectId} />
      </div>
    </div>
  );
}

