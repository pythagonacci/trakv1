"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

interface TableContent {
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
  const rows = content.rows || 3;
  const cols = content.cols || 3;
  const cells = content.cells || [];
  const columnWidths = content.columnWidths || Array(cols).fill(150);

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [tempColumnWidths, setTempColumnWidths] = useState<number[]>(columnWidths);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCell(row, col, editValue);
      setEditingCell(null);

      // Move to next cell (same row, next col, or next row, first col)
      if (col < cols - 1) {
        startEditing(row, col + 1);
      } else if (row < rows - 1) {
        startEditing(row + 1, 0);
      }
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

  return (
    <div className="p-5">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="relative border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 font-semibold text-sm text-neutral-900 dark:text-white p-2 text-left"
                  style={{ width: `${displayWidths[colIndex] || 150}px`, minWidth: "100px" }}
                  onMouseEnter={() => setHoveredCol(colIndex)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div className="flex items-center justify-between">
                    {editingCell?.row === 0 && editingCell?.col === colIndex ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleBlur(0, colIndex)}
                        onKeyDown={(e) => handleKeyDown(e, 0, colIndex)}
                        className="flex-1 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 -mx-1 -my-0.5"
                      />
                    ) : (
                      <div
                        onClick={() => startEditing(0, colIndex)}
                        className="flex-1 cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors min-h-[24px]"
                      >
                        {cells[0]?.[colIndex] || ""}
                      </div>
                    )}
                    {/* Delete column button - shows on hover */}
                    {hoveredCol === colIndex && cols > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteColumn(colIndex);
                        }}
                        className="ml-2 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
                      "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10",
                      resizingCol === colIndex && "bg-blue-500"
                    )}
                    style={{ marginRight: "-2px" }}
                  />
                </th>
              ))}
              {/* Add column button */}
              <th className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 p-2 w-12">
                <button
                  onClick={addColumn}
                  className="w-full h-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  title="Add column"
                >
                  <Plus className="w-4 h-4" />
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
                      className="border border-neutral-200 dark:border-neutral-800 p-2 text-sm text-neutral-900 dark:text-white"
                      style={{ width: `${displayWidths[colIndex] || 150}px` }}
                    >
                      {editingCell?.row === actualRowIndex && editingCell?.col === colIndex ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleBlur(actualRowIndex, colIndex)}
                          onKeyDown={(e) => handleKeyDown(e, actualRowIndex, colIndex)}
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 -mx-1 -my-0.5"
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(actualRowIndex, colIndex)}
                          className="cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors min-h-[24px]"
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
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-200 dark:border-neutral-700"
          >
            <Plus className="w-4 h-4" />
            Add row
          </button>
          {/* Delete row button - shows on hover */}
          {hoveredRow !== null && hoveredRow > 0 && rows > 1 && (
            <button
              onClick={() => deleteRow(hoveredRow)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <X className="w-4 h-4" />
              Delete row
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
