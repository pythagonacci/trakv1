"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

interface TableContent {
  title?: string;
  rows: number;
  cols: number;
  cells: string[][];
  columnWidths?: number[];
}

interface TableBlockProps {
  block: Block;
  onUpdate?: () => void;
}

export default function TableBlock({ block, onUpdate }: TableBlockProps) {
  const content = (block.content || {}) as TableContent;
  const title = content.title || "";
  const rows = content.rows || 3;
  const cols = content.cols || 3;
  const cells = content.cells || [];
  const columnWidths = content.columnWidths || Array(cols).fill(150);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [tempColumnWidths, setTempColumnWidths] = useState<number[]>(columnWidths);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Ensure cells array matches rows/cols dimensions
  useEffect(() => {
    const currentRows = cells.length;
    const currentCols = cells[0]?.length || 0;

    if (currentRows !== rows || currentCols !== cols) {
      const newCells: string[][] = [];
      for (let r = 0; r < rows; r++) {
        newCells[r] = [];
        for (let c = 0; c < cols; c++) {
          newCells[r][c] = cells[r]?.[c] || "";
        }
      }
      updateBlock({
        blockId: block.id,
        content: {
          ...content,
          rows,
          cols,
          cells: newCells,
          columnWidths: columnWidths.length === cols ? columnWidths : Array(cols).fill(150),
        },
      }).then(() => onUpdate?.());
    }
  }, [rows, cols, cells, block.id, content, columnWidths, onUpdate]);

  // Sync tempColumnWidths when columnWidths prop changes
  useEffect(() => {
    setTempColumnWidths(columnWidths);
  }, [columnWidths]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Sync title value when content changes
  useEffect(() => {
    if (!editingTitle) {
      setTitleValue(content.title || "");
    }
  }, [content.title, editingTitle]);

  // Focus title input when editing starts
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const startEditing = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(cells[row]?.[col] || "");
  };

  const saveCell = useCallback(
    async (row: number, col: number, value: string) => {
      const newCells = cells.map((r, rIdx) =>
        rIdx === row ? r.map((c, cIdx) => (cIdx === col ? value : c)) : r
      );

      await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          cells: newCells,
        },
      });
      onUpdate?.();
    },
    [cells, block.id, content, onUpdate]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, row: number, col: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveCell(row, col, editValue);
      setEditingCell(null);

      // Move to next cell (same row, next col, or next row, first col)
      if (col < cols - 1) {
        startEditing(row, col + 1);
      } else if (row < rows - 1) {
        startEditing(row + 1, 0);
      }
    } else if (e.key === "Enter" && e.shiftKey) {
      // Shift+Enter: insert newline (default behavior, don't prevent)
      // The textarea will handle this naturally
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      saveCell(row, col, editValue);
      setEditingCell(null);

      // Move to next cell
      if (!e.shiftKey) {
        if (col < cols - 1) {
          startEditing(row, col + 1);
        } else if (row < rows - 1) {
          startEditing(row + 1, 0);
        }
      } else {
        // Shift+Tab: move to previous cell
        if (col > 0) {
          startEditing(row, col - 1);
        } else if (row > 0) {
          startEditing(row - 1, cols - 1);
        }
      }
    }
  };

  const handleBlur = (row: number, col: number) => {
    saveCell(row, col, editValue);
    setEditingCell(null);
  };

  const addRow = async () => {
    const newCells = [...cells, Array(cols).fill("")];
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        rows: rows + 1,
        cells: newCells,
      },
    });
    onUpdate?.();
  };

  const deleteRow = async (rowIndex: number) => {
    if (rows <= 1) return;
    const newCells = cells.filter((_, idx) => idx !== rowIndex);
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        rows: rows - 1,
        cells: newCells,
      },
    });
    onUpdate?.();
  };

  const addColumn = async () => {
    const newCells = cells.map((row) => [...row, ""]);
    const newColumnWidths = [...tempColumnWidths, 150];
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        cols: cols + 1,
        cells: newCells,
        columnWidths: newColumnWidths,
      },
    });
    setTempColumnWidths(newColumnWidths);
    onUpdate?.();
  };

  const deleteColumn = async (colIndex: number) => {
    if (cols <= 1) return;
    const newCells = cells.map((row) => row.filter((_, idx) => idx !== colIndex));
    const newColumnWidths = tempColumnWidths.filter((_, idx) => idx !== colIndex);
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        cols: cols - 1,
        cells: newCells,
        columnWidths: newColumnWidths,
      },
    });
    setTempColumnWidths(newColumnWidths);
    onUpdate?.();
  };

  // Column resize handlers
  const handleResizeStart = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(tempColumnWidths[colIndex] || 150);
  };

  useEffect(() => {
    if (resizingCol === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(100, resizeStartWidth + diff);
      const newColumnWidths = [...tempColumnWidths];
      newColumnWidths[resizingCol] = newWidth;
      setTempColumnWidths(newColumnWidths);
    };

    const handleMouseUp = async () => {
      await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          columnWidths: tempColumnWidths,
        },
      });
      onUpdate?.();
      setResizingCol(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol, resizeStartX, resizeStartWidth, tempColumnWidths, block.id, content, onUpdate]);

  const displayWidths = resizingCol !== null ? tempColumnWidths : columnWidths;

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (titleValue !== title) {
      await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          title: titleValue,
        },
      });
      onUpdate?.();
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === "Escape") {
      setTitleValue(title);
      setEditingTitle(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Title/Header */}
      <div className="border-b border-[var(--border)] pb-3">
        {editingTitle ? (
          <input
            id="tab-name"
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="Table title..."
            className="w-full rounded-[4px] border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--foreground)] focus:outline-none focus:shadow-none"
            disabled={false}
            autoFocus
            maxLength={100}
          />
        ) : (
          <div
            onClick={() => setEditingTitle(true)}
            className="flex min-h-[28px] items-center rounded-[4px] px-2 py-1.5 text-base font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {title || <span className="text-neutral-400 dark:text-neutral-500 font-normal">Table title...</span>}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead className="bg-[var(--surface)]">
            <tr>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="relative border-r border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] last:border-r-0"
                  style={{ width: `${displayWidths[colIndex] || 150}px`, minWidth: "100px" }}
                  onMouseEnter={() => setHoveredCol(colIndex)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div className="flex items-center justify-between">
                    {editingCell?.row === 0 && editingCell?.col === colIndex ? (
                      <textarea
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleBlur(0, colIndex)}
                        onKeyDown={(e) => handleKeyDown(e, 0, colIndex)}
                        placeholder="Header..."
                        className="min-h-[20px] w-full resize-none rounded-[4px] border-0 bg-transparent px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:shadow-none placeholder:text-[var(--tertiary-foreground)]"
                        rows={1}
                        style={{ overflow: 'hidden' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => startEditing(0, colIndex)}
                        className="flex-1 cursor-text rounded-md px-2 py-1 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-surface-hover"
                      >
                        {cells[0]?.[colIndex] || <span className="text-neutral-400 dark:text-neutral-500">Header...</span>}
                      </div>
                    )}
                    {/* Delete column button - shows on hover */}
                    {hoveredCol === colIndex && cols > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteColumn(colIndex);
                        }}
                        className="ml-2 rounded-[4px] p-1 text-[var(--tertiary-foreground)] transition-colors hover:bg-red-50 hover:text-red-500"
                        title="Delete column"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => handleResizeStart(colIndex, e)}
                    className={cn(
                      "absolute top-0 right-0 h-full w-0.5 cursor-col-resize transition-colors",
                      resizingCol === colIndex ? "bg-[var(--foreground)]" : "bg-transparent hover:bg-[var(--border-strong)]"
                    )}
                    style={{ marginRight: "-2px" }}
                  />
                </th>
              ))}
              {/* Add column button */}
              <th className="w-10 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center">
                <button
                  onClick={addColumn}
                  className="flex h-full w-full items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  title="Add column"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows - 1 }).map((_, rowIndex) => {
              const actualRowIndex = rowIndex + 1; // Skip header row
              return (
                <tr
                  key={actualRowIndex}
                  onMouseEnter={() => setHoveredRow(actualRowIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="group"
                >
                  {Array.from({ length: cols }).map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-[var(--border)] p-2 text-sm text-[var(--foreground)]"
                      style={{ width: `${displayWidths[colIndex] || 150}px` }}
                    >
                      {editingCell?.row === actualRowIndex && editingCell?.col === colIndex ? (
                        <textarea
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleBlur(actualRowIndex, colIndex)}
                          onKeyDown={(e) => handleKeyDown(e, actualRowIndex, colIndex)}
                              className="min-h-[24px] w-full resize-none rounded-[4px] border-0 bg-transparent px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:shadow-none"
                          rows={1}
                          style={{ overflow: 'hidden' }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(actualRowIndex, colIndex)}
                          className="min-h-[24px] cursor-text rounded-[4px] px-2 py-1 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          {cells[actualRowIndex]?.[colIndex] || ""}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row button */}
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
          {/* Delete row button - shows on hover */}
          {hoveredRow !== null && hoveredRow > 0 && rows > 1 && (
            <button
              onClick={() => deleteRow(hoveredRow)}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-100"
            >
              <X className="w-3.5 h-3.5" />
              Delete row
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
