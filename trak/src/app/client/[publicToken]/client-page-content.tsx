"use client";

import { Block } from "@/app/actions/block";
import { cn } from "@/lib/utils";
import ClientDocViewer from "./client-doc-viewer";

interface ClientPageContentProps {
  blocks: Block[];
  publicToken: string;
}

export default function ClientPageContent({ blocks, publicToken }: ClientPageContentProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[var(--muted-foreground)]">No content in this tab yet.</p>
      </div>
    );
  }

  // Group blocks by row (position) and column
  const blockRows = blocks.reduce((rows, block) => {
    const rowIndex = Math.floor(block.position);
    if (!rows[rowIndex]) {
      rows[rowIndex] = [];
    }
    rows[rowIndex].push(block);
    return rows;
  }, {} as Record<number, Block[]>);

  return (
    <div className="space-y-6">
      {Object.entries(blockRows)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([rowIndex, rowBlocks]) => {
          const maxCol = Math.max(...rowBlocks.map(b => b.column));
          const columnCount = maxCol + 1;

          return (
            <div
              key={rowIndex}
              className={cn(
                "grid gap-6",
                columnCount === 1
                  ? "grid-cols-1"
                  : columnCount === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              )}
            >
              {rowBlocks
                .sort((a, b) => a.column - b.column)
                .map((block) => (
                  <ReadOnlyBlock key={block.id} block={block} publicToken={publicToken} />
                ))}
            </div>
          );
        })}
    </div>
  );
}

// Read-only block renderer (no editing, no menus)
function ReadOnlyBlock({ block, publicToken }: { block: Block; publicToken: string }) {
  const renderContent = () => {
    switch (block.type) {
      case "text":
        const textContent = (block.content as { text?: string })?.text || "";
        return (
          <div 
            className="prose prose-sm max-w-none text-[var(--foreground)]"
            dangerouslySetInnerHTML={{ __html: textContent }}
          />
        );

      case "task":
        const taskContent = block.content as { title?: string; tasks?: Array<{ id: string; text: string; completed: boolean }> };
        return (
          <div>
            {taskContent.title && (
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                {taskContent.title}
              </h3>
            )}
            <div className="space-y-2">
              {(taskContent.tasks || []).map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    disabled
                    className="rounded border-[var(--border)] text-[var(--primary)] disabled:opacity-50"
                  />
                  <span className={cn(
                    "text-sm",
                    task.completed ? "text-[var(--muted-foreground)] line-through" : "text-[var(--foreground)]"
                  )}>
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case "link":
        const linkContent = block.content as { title?: string; url?: string; description?: string };
        return (
          <div className="space-y-2">
            {linkContent.title && (
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {linkContent.title}
              </h3>
            )}
            {linkContent.url && (
              <a
                href={linkContent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block"
              >
                {linkContent.url}
              </a>
            )}
            {linkContent.description && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {linkContent.description}
              </p>
            )}
          </div>
        );

      case "divider":
        return <hr className="border-t border-[var(--border)]" />;

      case "doc_reference":
        const docContent = block.content as { doc_id: string; doc_title: string };
        return (
          <ClientDocViewer
            docId={docContent.doc_id}
            docTitle={docContent.doc_title}
            publicToken={publicToken}
          />
        );

      default:
        return (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              {block.type} block (preview not available)
            </p>
          </div>
        );
    }
  };

  // Don't wrap dividers or doc_references in a card (they have their own styling)
  if (block.type === "divider" || block.type === "doc_reference") {
    return renderContent();
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      {renderContent()}
    </div>
  );
}

