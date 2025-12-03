"use client";

import { ReactNode } from "react";
import { Block } from "@/app/actions/block";
import { cn } from "@/lib/utils";
import ClientDocViewer from "./client-doc-viewer";
import dynamic from "next/dynamic";

const TimelineBlock = dynamic(
  () => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/timeline-block"),
  { ssr: false }
);

type ColumnType = "text" | "number" | "date" | "checkbox" | "select";

interface ColumnConfig {
  type?: ColumnType;
  name?: string;
  numberFormat?: "number" | "currency" | "percentage";
  decimals?: number;
  options?: string[];
  multiSelect?: boolean;
}

interface ClientTableContent {
  title?: string;
  rows?: number;
  cols?: number;
  cells?: string[][];
  columns?: ColumnConfig[];
}

const normalizeCellsMatrix = (
  source: string[][] | undefined,
  rows: number,
  cols: number
): string[][] => {
  const normalized: string[][] = [];
  for (let r = 0; r < rows; r++) {
    normalized[r] = [];
    for (let c = 0; c < cols; c++) {
      normalized[r][c] = source?.[r]?.[c] ?? "";
    }
  }
  return normalized;
};

const renderMultilineText = (value: string) => {
  if (!value) return null;
  const lines = value.split(/\r?\n/);
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, idx) => (
        <span key={`line-${idx}`} className="whitespace-pre-wrap break-words">
          {line === "" ? "\u00a0" : line}
        </span>
      ))}
    </div>
  );
};

const formatNumber = (value: string, config: ColumnConfig): string => {
  if (!value || isNaN(Number(value))) return value;
  const num = Number(value);

  if (config.numberFormat === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: config.decimals ?? 2,
      maximumFractionDigits: config.decimals ?? 2,
    }).format(num);
  }

  if (config.numberFormat === "percentage") {
    return `${(num * 100).toFixed(config.decimals ?? 0)}%`;
  }

  return num.toFixed(config.decimals ?? 2);
};

const formatDate = (value: string): string => {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
};

const formatClientText = (text: string): string => {
  if (!text || text.trim() === "") {
    return "";
  }

  const normalizeUnmatchedBold = (input: string) => {
    let result = input;
    let boldTokens = (result.match(/\*\*/g) || []).length;

    if (boldTokens % 2 !== 0) {
      const lastIndex = result.lastIndexOf("**");
      if (lastIndex !== -1) {
        result = result.slice(0, lastIndex) + result.slice(lastIndex + 2);
      }
    }

    return result;
  };

  const lines = text.split("\n");
  const formattedLines = lines.map((rawLine) => {
    const line = normalizeUnmatchedBold(rawLine);
    if (!line.trim()) return "<br/>";

    let formatted = line;
    if (/<u>.*?<\/u>/.test(formatted)) {
      formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-[var(--foreground)]">$1</u>');
    }

    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--foreground)]">$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--foreground)]/90">$1</em>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="rounded-sm bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>');

    if (/^### /.test(formatted)) {
      return `<h3 class="text-base font-medium text-[var(--foreground)] mb-2">${formatted.replace(/^### /, "")}</h3>`;
    }
    if (/^## /.test(formatted)) {
      return `<h2 class="text-lg font-semibold text-[var(--foreground)] mb-2">${formatted.replace(/^## /, "")}</h2>`;
    }
    if (/^# /.test(formatted)) {
      return `<h1 class="text-xl font-semibold text-[var(--foreground)] mb-3">${formatted.replace(/^# /, "")}</h1>`;
    }

    if (/^• /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5"><span class="text-[var(--muted-foreground)]">•</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^• /, '')}</span></div>`;
    }
    if (/^→ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>→</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^→ /, '')}</span></div>`;
    }
    if (/✅ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--success)]"><span>✅</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/✅ /, '')}</span></div>`;
    }
    if (/⚠️ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--warning)]"><span>⚠️</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/⚠️ /, '')}</span></div>`;
    }
    if (/💬 /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--muted-foreground)]"><span>💬</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/💬 /, '')}</span></div>`;
    }
    if (/🔄 /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>🔄</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/🔄 /, '')}</span></div>`;
    }
    if (/⭐/.test(formatted)) {
      return `<div class="mb-1.5 text-sm text-[var(--foreground)]">${formatted}</div>`;
    }

    return `<p class="mb-1.5 text-sm leading-relaxed text-[var(--foreground)]">${formatted}</p>`;
  });

  return formattedLines.join("");
};

const renderTableCellValue = (value: string, column?: ColumnConfig): ReactNode => {
  if (!column) {
    return renderMultilineText(value);
  }

  switch (column.type) {
    case "number":
      return formatNumber(value, column);
    case "date":
      return formatDate(value);
    case "checkbox":
      return value === "true" || value === "✓" ? "✓" : "";
    case "select": {
      if (!value) return "";
      if (column.multiSelect) {
        const tags = value.split(",").map((item) => item.trim()).filter(Boolean);
        if (tags.length === 0) return "";
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                {tag}
              </span>
            ))}
          </div>
        );
      }
      return value;
    }
    default:
      return renderMultilineText(value);
  }
};

interface ClientPageContentProps {
  blocks: Block[];
  publicToken: string;
}

const formatShortDate = (date?: string) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
};

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
    <div className="space-y-4">
      {Object.entries(blockRows)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([rowIndex, rowBlocks]) => {
          const maxCol = Math.max(...rowBlocks.map(b => b.column));
          const columnCount = maxCol + 1;

          return (
            <div
              key={rowIndex}
              className={cn(
                "grid gap-4",
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
            dangerouslySetInnerHTML={{ __html: formatClientText(textContent) }}
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
      case "table":
        return <ReadOnlyTable block={block} />;
      case "timeline":
        return <TimelineBlock block={block} readOnly />;

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

function ReadOnlyTable({ block }: { block: Block }) {
  const content = (block.content || {}) as ClientTableContent;
  const rowCount = Math.max(
    typeof content.rows === "number" ? content.rows : 0,
    Array.isArray(content.cells) ? content.cells.length : 0
  );
  const colCount = Math.max(
    typeof content.cols === "number" ? content.cols : 0,
    Array.isArray(content.cells) && content.cells[0] ? content.cells[0].length : 0
  );

  if (rowCount === 0 || colCount === 0) {
    return (
      <div className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
        No table data yet.
      </div>
    );
  }

  const normalizedCells = normalizeCellsMatrix(content.cells, rowCount, colCount);
  const headerCells = normalizedCells[0] || [];
  const dataRows = normalizedCells.slice(1);

  const columnConfigs: ColumnConfig[] = Array.from({ length: colCount }, (_, idx) => {
    const existing = content.columns?.[idx];
    const headerLabel = (headerCells[idx] ?? "").trim();
    const fallbackName = (existing?.name ?? "").trim();

    return {
      type: existing?.type ?? "text",
      name: headerLabel || fallbackName,
      numberFormat: existing?.numberFormat,
      decimals: existing?.decimals,
      options: existing?.options,
      multiSelect: existing?.multiSelect,
    };
  });

  return (
    <div className="space-y-3">
      {content.title && (
        <p className="text-sm font-semibold text-[var(--foreground)]">{content.title}</p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {columnConfigs.map((col, idx) => {
                const label = col.name;
                return (
                  <th
                    key={`${block.id}-header-${idx}`}
                    className="border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--tertiary-foreground)]"
                  >
                    {label ? label : <span className="opacity-50">&nbsp;</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dataRows.length > 0 ? (
              dataRows.map((row, rowIdx) => (
                <tr
                  key={`${block.id}-row-${rowIdx + 1}`}
                  className="odd:bg-[var(--surface)] even:bg-[var(--surface-muted)]/40"
                >
                  {row.map((cellValue, colIdx) => (
                    <td
                      key={`${block.id}-cell-${rowIdx + 1}-${colIdx}`}
                      className="border border-[var(--border)] px-3 py-2 align-top text-[var(--foreground)]"
                    >
                      {renderTableCellValue(cellValue, columnConfigs[colIdx]) || (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={colCount}
                  className="border border-[var(--border)] px-3 py-4 text-center text-[var(--muted-foreground)]"
                >
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

