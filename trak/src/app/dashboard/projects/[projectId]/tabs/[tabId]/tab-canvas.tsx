"use client";

import { useRouter } from "next/navigation";
import { type Block, deleteBlock, updateBlock } from "@/app/actions/block";
import EmptyCanvasState from "./empty-canvas-state";
import AddBlockButton from "./add-block-button";
import BlockRenderer from "./block-renderer";

interface TabCanvasProps {
  tabId: string;
  projectId: string;
  workspaceId: string; // NEW: Added workspaceId
  blocks: Block[];
}

export default function TabCanvas({ tabId, projectId, workspaceId, blocks }: TabCanvasProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh();
  };

  const handleDelete = async (blockId: string) => {
    const result = await deleteBlock(blockId);
    if (result.error) {
      console.error("Failed to delete block:", result.error);
      alert(`Error deleting block: ${result.error}`);
      return;
    }
    router.refresh();
  };

  const handleConvert = async (blockId: string, newType: "text" | "task" | "link" | "divider") => {
    // Determine default content for the new type
    let newContent: Record<string, any> = {};
    if (newType === "text") {
      newContent = { text: "" };
    } else if (newType === "task") {
      newContent = { title: "New Task List", tasks: [] };
    } else if (newType === "link") {
      newContent = { title: "", url: "", description: "" };
    } else if (newType === "divider") {
      newContent = {};
    }

    const result = await updateBlock({
      blockId,
      type: newType,
      content: newContent,
    });

    if (result.error) {
      console.error("Failed to convert block:", result.error);
      alert(`Error converting block: ${result.error}`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {blocks.length === 0 ? (
        <EmptyCanvasState tabId={tabId} projectId={projectId} />
      ) : (
        <>
          {blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              workspaceId={workspaceId} // NEW: Pass workspaceId
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onConvert={handleConvert}
            />
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