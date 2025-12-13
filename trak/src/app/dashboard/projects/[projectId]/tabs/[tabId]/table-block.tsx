"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Filter, ArrowUp, ArrowDown, Settings2, Calculator, HelpCircle, Type, Hash, Calendar, CheckSquare, List, AlertCircle, Search, Undo, Redo } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ColumnType = "text" | "number" | "date" | "checkbox" | "select";

export interface ColumnConfig {
  type: ColumnType;
  name: string;
  required?: boolean;
  // Number-specific
  numberFormat?: "number" | "currency" | "percentage";
  decimals?: number;
  min?: number;
  max?: number;
  // Select-specific
  options?: string[];
  multiSelect?: boolean;
  // Formula
  formula?: string;
  // Validation
  validation?: {
    pattern?: string;
    customMessage?: string;
  };
}

type TableFilter = {
  column: number;
  operator: string;
  value: string;
};

interface TableContent {
  title?: string;
  rows: number;
  cols: number;
  cells: string[][];
  columnWidths?: number[];
  columns?: ColumnConfig[]; // Column metadata
  filters?: TableFilter[];
  sort?: { column: number; direction: "asc" | "desc" };
}

interface TableBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(value: string, config: ColumnConfig): string {
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
}

function parseNumber(value: string): number | null {
  // Remove currency symbols, commas, etc.
  const cleaned = value.replace(/[$,%]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function formatDate(value: string): string {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  } catch {
    return value;
  }
}

function evaluateFormula(formula: string, rowIndex: number, cells: string[][], columns: ColumnConfig[]): string {
  // Basic formula support: SUM, AVERAGE, COUNT
  // Syntax: =SUM(columnName) or =AVERAGE(columnName) or =COUNT(columnName)
  // For now, simple column references: =SUM(A) means sum all numbers in column A
  
  if (!formula.startsWith("=")) return formula;
  
  const formulaUpper = formula.toUpperCase();
  const row = cells[rowIndex] || [];
  
  // SUM formula
  if (formulaUpper.startsWith("=SUM(")) {
    const match = formula.match(/=SUM\(([A-Z]+)\)/i);
    if (match) {
      const colName = match[1];
      const colIndex = columns.findIndex(c => c.name.toUpperCase() === colName.toUpperCase());
      if (colIndex >= 0 && columns[colIndex].type === "number") {
        let sum = 0;
        for (let i = 1; i < cells.length; i++) {
          const val = parseNumber(cells[i]?.[colIndex] || "");
          if (val !== null) sum += val;
        }
        return sum.toString();
      }
    }
  }
  
  // AVERAGE formula
  if (formulaUpper.startsWith("=AVERAGE(")) {
    const match = formula.match(/=AVERAGE\(([A-Z]+)\)/i);
    if (match) {
      const colName = match[1];
      const colIndex = columns.findIndex(c => c.name.toUpperCase() === colName.toUpperCase());
      if (colIndex >= 0 && columns[colIndex].type === "number") {
        let sum = 0;
        let count = 0;
        for (let i = 1; i < cells.length; i++) {
          const val = parseNumber(cells[i]?.[colIndex] || "");
          if (val !== null) {
            sum += val;
            count++;
          }
        }
        return count > 0 ? (sum / count).toString() : "0";
      }
    }
  }
  
  // COUNT formula
  if (formulaUpper.startsWith("=COUNT(")) {
    const match = formula.match(/=COUNT\(([A-Z]+)\)/i);
    if (match) {
      const colName = match[1];
      const colIndex = columns.findIndex(c => c.name.toUpperCase() === colName.toUpperCase());
      if (colIndex >= 0) {
        let count = 0;
        for (let i = 1; i < cells.length; i++) {
          if (cells[i]?.[colIndex]) count++;
        }
        return count.toString();
      }
    }
  }
  
  return formula;
}

function validateCell(value: string, config: ColumnConfig): { valid: boolean; error?: string } {
  if (config.required && !value) {
    return { valid: false, error: "This field is required" };
  }
  
  if (config.type === "number") {
    if (value && parseNumber(value) === null) {
      return { valid: false, error: "Invalid number" };
    }
    const num = parseNumber(value);
    if (num !== null) {
      if (config.min !== undefined && num < config.min) {
        return { valid: false, error: `Must be at least ${config.min}` };
      }
      if (config.max !== undefined && num > config.max) {
        return { valid: false, error: `Must be at most ${config.max}` };
      }
    }
  }
  
  if (config.type === "date" && value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { valid: false, error: "Invalid date" };
    }
  }
  
  if (config.validation?.pattern && value) {
    const regex = new RegExp(config.validation.pattern);
    if (!regex.test(value)) {
      return { valid: false, error: config.validation.customMessage || "Invalid format" };
    }
  }
  
  return { valid: true };
}

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TableBlock({ block, onUpdate }: TableBlockProps) {
  const content = (block.content || {}) as TableContent;
  const title = content.title || "";
  const rows = content.rows || 3;
  const cols = content.cols || 3;
  const cells = useMemo(
    () => normalizeCellsMatrix(content.cells, rows, cols),
    [content.cells, rows, cols]
  );
  const columnWidths = content.columnWidths || Array(cols).fill(150);
  
  // Initialize columns if not present (backward compatibility)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (content.columns && content.columns.length === cols) {
      return content.columns;
    }
    // Create default text columns
    return Array.from({ length: cols }, (_, i) => ({
      type: "text" as ColumnType,
      name: cells[0]?.[i] || `Column ${i + 1}`,
    }));
  });
  
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
  const [filters, setFilters] = useState<TableFilter[]>(content.filters || []);
  const [sort, setSort] = useState<{ column: number; direction: "asc" | "desc" } | null>(content.sort || null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogType, setConfigDialogType] = useState<"select" | "number" | "formula" | "help" | null>(null);
  const [selectOptions, setSelectOptions] = useState<string[]>([]);
  const [numberMin, setNumberMin] = useState<string>("");
  const [numberMax, setNumberMax] = useState<string>("");
  const [numberDecimals, setNumberDecimals] = useState<string>("2");
  const [formulaValue, setFormulaValue] = useState<string>("");
  const [cellError, setCellError] = useState<{ row: number; col: number; message: string } | null>(null);
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ row: number; col: number }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [history, setHistory] = useState<TableContent[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedCells, setCopiedCells] = useState<{ row: number; col: number; value: string }[]>([]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // History management functions
  const addToHistory = useCallback((newContent: TableContent) => {
    setHistory((prevHistory) => {
      const newHistory = prevHistory.slice(0, historyIndex + 1);
      newHistory.push(newContent);
      // Limit history to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      } else {
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      }
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevContent = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      updateBlock({
        blockId: block.id,
        content: prevContent,
      }).then((result) => {
        if (result.error) {
          console.error("Failed to undo table change:", result.error);
          // Revert history index on error
          setHistoryIndex(historyIndex + 1);
        } else if (result.data) {
          onUpdate?.(result.data);
        }
      });
    }
  }, [history, historyIndex, block.id, onUpdate]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextContent = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      updateBlock({
        blockId: block.id,
        content: nextContent,
      }).then((result) => {
        if (result.error) {
          console.error("Failed to redo table change:", result.error);
          // Revert history index on error
          setHistoryIndex(historyIndex - 1);
        } else if (result.data) {
          onUpdate?.(result.data);
        }
      });
    }
  }, [history, historyIndex, block.id, onUpdate]);

  // Copy/Paste functionality
  const copyCell = useCallback((row: number, col: number) => {
    const value = cells[row]?.[col] || "";
    setCopiedCells([{ row, col, value }]);
    
    // Also copy to clipboard
    navigator.clipboard.writeText(value).catch(() => {
      // Fallback if clipboard API fails
    });
  }, [cells]);

  const pasteCells = useCallback(async (startRow: number, startCol: number) => {
    if (copiedCells.length === 0) {
      // Try to paste from clipboard directly
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
          const newCells = [...cells];
          const lines = clipboardText.split("\n");
          lines.forEach((line, rowOffset) => {
            const values = line.split("\t");
            values.forEach((value, colOffset) => {
              const targetRow = startRow + rowOffset;
              const targetCol = startCol + colOffset;
              if (targetRow < newCells.length && targetCol < cols) {
                if (!newCells[targetRow]) {
                  newCells[targetRow] = Array(cols).fill("");
                }
                newCells[targetRow] = [...newCells[targetRow]];
                newCells[targetRow][targetCol] = value.trim();
              }
            });
          });

          const newContent = { ...content, cells: newCells };
          addToHistory(newContent);

          const result = await updateBlock({
            blockId: block.id,
            content: newContent,
          });

          if (result.error) {
            console.error("Failed to paste table cells:", result.error);
            setCellError({
              row: startRow,
              col: startCol,
              message: "Failed to save pasted content. Please try again."
            });
            setTimeout(() => setCellError(null), 5000);
            return;
          }

          if (result.data) {
            onUpdate?.(result.data);
          }
        }
      } catch (err) {
        // Clipboard read failed
      }
      return;
    }

    const newCells = [...cells];
    
    // Handle single cell paste
    if (copiedCells.length === 1) {
      const { value } = copiedCells[0];
      if (startRow < newCells.length && startCol < cols) {
        newCells[startRow] = [...newCells[startRow]];
        newCells[startRow][startCol] = value;
      }
    }

    const newContent = { ...content, cells: newCells };
    addToHistory(newContent);

    const result = await updateBlock({
      blockId: block.id,
      content: newContent,
    });
    
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  }, [copiedCells, cells, cols, content, block.id, onUpdate, addToHistory]);

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0) {
      setHistory([content]);
      setHistoryIndex(0);
    }
  }, [content, history.length]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const results: { row: number; col: number }[] = [];
    const query = searchQuery.toLowerCase();

    for (let row = 0; row < cells.length; row++) {
      for (let col = 0; col < cols; col++) {
        const cellValue = cells[row]?.[col] || "";
        if (cellValue.toLowerCase().includes(query)) {
          results.push({ row, col });
        }
      }
    }

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, cells, cols]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F: Search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Cmd/Ctrl + Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd/Ctrl + C: Copy (when not editing)
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !editingCell) {
        if (document.activeElement?.tagName === "TD" || document.activeElement?.closest("td")) {
          e.preventDefault();
          const td = document.activeElement.closest("td");
          if (td) {
            const row = parseInt(td.getAttribute("data-row") || "0");
            const col = parseInt(td.getAttribute("data-col") || "0");
            copyCell(row, col);
          }
        }
      }

      // Cmd/Ctrl + V: Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && !editingCell) {
        e.preventDefault();
        const td = document.activeElement?.closest("td");
        if (td) {
          const row = parseInt(td.getAttribute("data-row") || "0");
          const col = parseInt(td.getAttribute("data-col") || "0");
          pasteCells(row, col);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingCell, undo, redo, copyCell, pasteCells]);

  // Ensure source cells array matches rows/cols dimensions for legacy data
  useEffect(() => {
    const sourceCells = content.cells || [];
    const currentRows = sourceCells.length;
    const currentCols = sourceCells[0]?.length || 0;

    if (currentRows !== rows || currentCols !== cols) {
      const normalized = normalizeCellsMatrix(content.cells, rows, cols);
      updateBlock({
        blockId: block.id,
        content: {
          ...content,
          rows,
          cols,
          cells: normalized,
          columnWidths: columnWidths.length === cols ? columnWidths : Array(cols).fill(150),
          columns,
        },
      }).then((result) => {
        if (result.data) {
          onUpdate?.(result.data);
        } else {
          onUpdate?.();
        }
      });
    }
  }, [rows, cols, content.cells, block.id, content, columnWidths, columns, onUpdate]);

  // Sync tempColumnWidths when columnWidths prop changes
  useEffect(() => {
    setTempColumnWidths(columnWidths);
  }, [columnWidths]);

  // Sync columns when content changes
  useEffect(() => {
    if (content.columns && content.columns.length === cols) {
      setColumns(content.columns);
    }
  }, [content.columns, cols]);

  // Apply filters and sorting
  const filteredAndSortedRows = useMemo(() => {
    let rowIndices = Array.from({ length: rows - 1 }, (_, i) => i + 1);
    
    // Apply filters
    if (filters.length > 0) {
      rowIndices = rowIndices.filter((rowIdx) => {
        return filters.every((filter) => {
          const cellValue = cells[rowIdx]?.[filter.column] || "";
          if (filter.operator === "contains") {
            return cellValue.toLowerCase().includes(filter.value.toLowerCase());
          }
          if (filter.operator === "equals") {
            return cellValue === filter.value;
          }
          if (filter.operator === "greater") {
            const num = parseNumber(cellValue);
            const filterNum = parseNumber(filter.value);
            return num !== null && filterNum !== null && num > filterNum;
          }
          if (filter.operator === "less") {
            const num = parseNumber(cellValue);
            const filterNum = parseNumber(filter.value);
            return num !== null && filterNum !== null && num < filterNum;
          }
          return true;
        });
      });
    }
    
    // Apply sorting
    if (sort) {
      rowIndices.sort((a, b) => {
        const aVal = cells[a]?.[sort.column] || "";
        const bVal = cells[b]?.[sort.column] || "";
        const colConfig = columns[sort.column];
        
        if (colConfig?.type === "number") {
          const aNum = parseNumber(aVal) ?? 0;
          const bNum = parseNumber(bVal) ?? 0;
          return sort.direction === "asc" ? aNum - bNum : bNum - aNum;
        }
        
        if (colConfig?.type === "date") {
          const aDate = new Date(aVal).getTime();
          const bDate = new Date(bVal).getTime();
          return sort.direction === "asc" ? aDate - bDate : bDate - aDate;
        }
        
        // Text comparison
        const comparison = aVal.localeCompare(bVal);
        return sort.direction === "asc" ? comparison : -comparison;
      });
    }
    
    return rowIndices;
  }, [rows, cells, filters, sort, columns]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Focus date input when editing date cell
  useEffect(() => {
    if (editingCell && dateInputRef.current && columns[editingCell.col]?.type === "date") {
      dateInputRef.current.showPicker?.();
    }
  }, [editingCell, columns]);

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


  // Debounced save state
  const [pendingSave, setPendingSave] = useState<{
    row: number;
    col: number;
    value: string;
    timeoutId: NodeJS.Timeout;
  } | null>(null);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (globalSaveTimeout) {
        clearTimeout(globalSaveTimeout);
      }
    };
  }, [globalSaveTimeout]);

  // Global debouncing state - single timeout for all table changes
  const [globalSaveTimeout, setGlobalSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, { row: number; col: number; value: string }>>(new Map());

  const saveCell = useCallback(
    async (row: number, col: number, value: string) => {
      const colConfig = columns[col];
      const changeKey = `${row}-${col}`;

      // Validate
      if (colConfig) {
        const validation = validateCell(value, colConfig);
        if (!validation.valid) {
          setCellError({ row, col, message: validation.error || "Invalid value" });
          // Clear error after 3 seconds
          setTimeout(() => setCellError(null), 3000);
          return;
        }
        // Clear error if validation passes
        if (cellError && cellError.row === row && cellError.col === col) {
          setCellError(null);
        }
      }

      // Process formula cells
      let finalValue = value;
      if (colConfig?.formula && value.startsWith("=")) {
        finalValue = evaluateFormula(value, row, cells, columns);
      }

      // Optimistic UI update (immediate)
      const newCells = cells.map((r, rIdx) =>
        rIdx === row ? r.map((c, cIdx) => cIdx === col ? finalValue : c) : r
      );
      const newContent = { ...content, cells: newCells, columns };
      addToHistory(newContent);

      // Add to pending changes batch
      setPendingChanges(prev => new Map(prev.set(changeKey, { row, col, value: finalValue })));

      // Clear existing global timeout
      if (globalSaveTimeout) {
        clearTimeout(globalSaveTimeout);
      }

      // Set up debounced batch save (300ms delay)
      const timeoutId = setTimeout(async () => {
        try {
          // Get all pending changes and clear them atomically
          const changesToSave = new Map(pendingChanges);
          setPendingChanges(new Map());
          setGlobalSaveTimeout(null);

          // Apply all pending changes to content
          let updatedContent = { ...content };
          for (const [key, change] of changesToSave) {
            const { row: r, col: c, value: val } = change;
            const updatedCells = updatedContent.cells?.map((rowCells, rIdx) =>
              rIdx === r ? rowCells.map((cellVal, cIdx) => cIdx === c ? val : cellVal) : rowCells
            ) || [];
            updatedContent = { ...updatedContent, cells: updatedCells };
          }

          const result = await updateBlock({
            blockId: block.id,
            content: updatedContent,
          });

          if (result.data) {
            onUpdate?.(result.data);
          } else {
            onUpdate?.();
          }
        } catch (error) {
          console.error("Failed to save table cells:", error);
          // Show error to user
          setCellError({
            row,
            col,
            message: "Failed to save changes. Please refresh and try again."
          });
          setTimeout(() => setCellError(null), 5000);
        }
      }, 300); // Reduced from 750ms to 300ms

      setGlobalSaveTimeout(timeoutId);
    },
    [cells, block.id, content, columns, onUpdate, addToHistory, cellError, pendingChanges, globalSaveTimeout]
  );

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    row: number,
    col: number
  ) => {
    const colType = columns[col]?.type ?? "text";
    const allowsPlainNewline = colType === "text";

    const commitCell = () => {
      e.preventDefault();
      saveCell(row, col, editValue);
      setEditingCell(null);

      // Move to next cell
      if (col < cols - 1) {
        startEditing(row, col + 1);
      } else if (row < rows - 1) {
        startEditing(row + 1, 0);
      }
    };

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      commitCell();
    } else if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (!allowsPlainNewline) {
        commitCell();
      }
      // For text columns we allow natural newline insertion (no preventDefault)
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
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        rows: rows + 1,
        cells: newCells,
        columns,
      },
    });

    if (result.error) {
      console.error("Failed to add table row:", result.error);
      // Note: Optimistic update stays, user can try again or refresh
    }
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const deleteRow = async (rowIndex: number) => {
    if (rows <= 1) return;
    const newCells = cells.filter((_, idx) => idx !== rowIndex);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        rows: rows - 1,
        cells: newCells,
        columns,
      },
    });

    if (result.error) {
      console.error("Failed to delete table row:", result.error);
      // Note: Optimistic update stays, user can try again or refresh
    }

    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const addColumn = async () => {
    const newCells = cells.map((row) => [...row, ""]);
    const newColumnWidths = [...tempColumnWidths, 150];
    const newColumns = [
      ...columns,
      {
        type: "text" as ColumnType,
        name: `Column ${cols + 1}`,
      },
    ];
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        cols: cols + 1,
        cells: newCells,
        columnWidths: newColumnWidths,
        columns: newColumns,
      },
    });

    if (result.error) {
      console.error("Failed to add table column:", result.error);
      // Note: Optimistic update stays, user can try again or refresh
    }
    setTempColumnWidths(newColumnWidths);
    setColumns(newColumns);
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const deleteColumn = async (colIndex: number) => {
    if (cols <= 1) return;
    const newCells = cells.map((row) => row.filter((_, idx) => idx !== colIndex));
    const newColumnWidths = tempColumnWidths.filter((_, idx) => idx !== colIndex);
    const newColumns = columns.filter((_, idx) => idx !== colIndex);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        cols: cols - 1,
        cells: newCells,
        columnWidths: newColumnWidths,
        columns: newColumns,
      },
    });

    if (result.error) {
      console.error("Failed to delete table column:", result.error);
      // Note: Optimistic update stays, user can try again or refresh
    }
    setTempColumnWidths(newColumnWidths);
    setColumns(newColumns);
    // Clear filters/sort for deleted column
    setFilters(filters.filter((f) => f.column !== colIndex));
    if (sort && sort.column === colIndex) {
      setSort(null);
    }
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const updateColumnConfig = async (colIndex: number, updates: Partial<ColumnConfig>) => {
    const newColumns = columns.map((col, idx) =>
      idx === colIndex ? { ...col, ...updates } : col
    );
    setColumns(newColumns);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        columns: newColumns,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const setColumnType = async (colIndex: number, type: ColumnType) => {
    const colConfig = columns[colIndex];
    const updates: Partial<ColumnConfig> = { type };
    
    // Reset type-specific configs
    if (type !== "number") {
      updates.numberFormat = undefined;
      updates.decimals = undefined;
      updates.min = undefined;
      updates.max = undefined;
    }
    if (type !== "select") {
      updates.options = undefined;
      updates.multiSelect = undefined;
    }
    
    await updateColumnConfig(colIndex, updates);
  };

  const toggleSort = (colIndex: number) => {
    if (sort && sort.column === colIndex) {
      if (sort.direction === "asc") {
        setSort({ column: colIndex, direction: "desc" });
      } else {
        setSort(null);
      }
    } else {
      setSort({ column: colIndex, direction: "asc" });
    }
    
    // Save to block
    const newSort = sort && sort.column === colIndex && sort.direction === "asc" 
      ? { column: colIndex, direction: "desc" as const }
      : sort && sort.column === colIndex
      ? null
      : { column: colIndex, direction: "asc" as const };
    
    updateBlock({
      blockId: block.id,
      content: {
        ...content,
        sort: newSort,
      },
    }).then((result) => {
      if (result.data) {
        onUpdate?.(result.data);
      }
    });
  };

  const addFilter = (colIndex: number) => {
    const newFilter = { column: colIndex, operator: "contains", value: "" };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    updateBlock({
      blockId: block.id,
      content: {
        ...content,
        filters: newFilters,
      },
    }).then((result) => {
      if (result.data) {
        onUpdate?.(result.data);
      }
    });
  };

  const removeFilter = (filterIndex: number) => {
    const newFilters = filters.filter((_, idx) => idx !== filterIndex);
    setFilters(newFilters);
    updateBlock({
      blockId: block.id,
      content: {
        ...content,
        filters: newFilters,
      },
    }).then((result) => {
      if (result.data) {
        onUpdate?.(result.data);
      }
    });
  };

  const updateFilter = (filterIndex: number, updates: Partial<TableFilter>) => {
    const newFilters = filters.map((f, idx) =>
      idx === filterIndex ? { ...f, ...updates } : f
    );
    setFilters(newFilters);
    updateBlock({
      blockId: block.id,
      content: {
        ...content,
        filters: newFilters,
      },
    }).then((result) => {
      if (result.data) {
        onUpdate?.(result.data);
      }
    });
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
      const result = await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          columnWidths: tempColumnWidths,
        },
      });

      if (result.error) {
        console.error("Failed to save column widths:", result.error);
        // Revert to original widths on error
        setTempColumnWidths(columnWidths);
      } else if (result.data) {
        onUpdate?.(result.data);
      } else {
        onUpdate?.();
      }
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
      const result = await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          title: titleValue,
        },
      });
      if (result.data) {
        onUpdate?.(result.data);
      } else {
        onUpdate?.();
      }
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

  // Render cell based on type
  const renderCell = (row: number, col: number, isEditing: boolean) => {
    const colConfig = columns[col];
    const cellValue = cells[row]?.[col] || "";
    const isHeader = row === 0;
    
    if (isEditing) {
      if (colConfig?.type === "date") {
        return (
          <input
            ref={dateInputRef}
            type="date"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleBlur(row, col)}
            onKeyDown={(e) => handleKeyDown(e, row, col)}
            className="min-h-[24px] w-full rounded-[4px] border-0 bg-transparent px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:shadow-none"
          />
        );
      }
      
      if (colConfig?.type === "checkbox") {
        return (
          <input
            type="checkbox"
            checked={editValue === "true" || editValue === "✓"}
            onChange={(e) => {
              setEditValue(e.target.checked ? "✓" : "");
              saveCell(row, col, e.target.checked ? "✓" : "");
            }}
            className="h-4 w-4 cursor-pointer"
          />
        );
      }
      
      if (colConfig?.type === "select" && colConfig.options) {
        return (
          <select
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              saveCell(row, col, e.target.value);
            }}
            onBlur={() => handleBlur(row, col)}
            className="min-h-[24px] w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none"
          >
            <option value="">Select...</option>
            {colConfig.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }
      
      // Default textarea for text/number/formula
      return (
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleBlur(row, col)}
          onKeyDown={(e) => handleKeyDown(e, row, col)}
          placeholder={colConfig?.formula ? "Enter formula (e.g., =SUM(A))" : ""}
          className="min-h-[24px] w-full resize-none rounded-[4px] border-0 bg-transparent px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:shadow-none"
          rows={1}
          style={{ overflow: "hidden" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      );
    }
    
    // Display mode
    if (colConfig?.type === "number" && cellValue) {
      return formatNumber(cellValue, colConfig);
    }
    
    if (colConfig?.type === "date" && cellValue) {
      return formatDate(cellValue);
    }
    
    if (colConfig?.type === "checkbox") {
      return cellValue === "true" || cellValue === "✓" ? "✓" : "";
    }
    
    // Formula evaluation for display
    if (colConfig?.formula && cellValue.startsWith("=")) {
      const evaluated = evaluateFormula(cellValue, row, cells, columns);
      return evaluated;
    }
    
    return renderMultilineText(cellValue);
  };

  return (
    <div className="space-y-4">
      {/* Table Title/Header */}
      <div className="border-b border-[var(--border)] pb-3 flex items-center justify-between gap-4">
        <div className="flex-1">
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
        {/* Search bar */}
        {searchOpen && (
          <div className="flex items-center gap-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table..."
              className="flex-1 bg-transparent border-0 outline-none text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                } else if (e.key === "Enter" && e.shiftKey && searchResults.length > 0) {
                  // Shift+Enter: previous result
                  setCurrentSearchIndex((prev) => prev > 0 ? prev - 1 : searchResults.length - 1);
                } else if (e.key === "Enter" && searchResults.length > 0) {
                  // Enter: next result
                  setCurrentSearchIndex((prev) => prev < searchResults.length - 1 ? prev + 1 : 0);
                }
              }}
            />
            {searchQuery && (
              <>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : "0"}
                </span>
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Table settings menu */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title="Search (Cmd/Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Cmd/Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </button>

          <DropdownMenu open={tableSettingsOpen} onOpenChange={setTableSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded hover:bg-[var(--surface-hover)]"
                title="Table settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[280px]">
              <DropdownMenuLabel>Table Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setTableSettingsOpen(false);
                  // Show help in a dialog
                  setConfigDialogType("help");
                  setConfigDialogOpen(true);
                }}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Keyboard Shortcuts & Help
              </DropdownMenuItem>
            {filters.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Active Filters ({filters.length})</DropdownMenuLabel>
                {filters.map((filter, idx) => (
                  <DropdownMenuItem
                    key={idx}
                    onClick={() => removeFilter(idx)}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs">
                      {cells[0]?.[filter.column] || columns[filter.column]?.name || `Column ${filter.column + 1}`} {filter.operator} &quot;{filter.value}&quot;
                    </span>
                    <X className="h-3 w-3" />
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onClick={() => {
                    setFilters([]);
                    updateBlock({
                      blockId: block.id,
                      content: { ...content, filters: [] },
                    }).then((result) => {
                      if (result.data) onUpdate?.(result.data);
                    });
                  }}
                >
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
            {sort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Sorting</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setSort(null);
                    updateBlock({
                      blockId: block.id,
                      content: { ...content, sort: null },
                    }).then((result) => {
                      if (result.data) onUpdate?.(result.data);
                    });
                  }}
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Clear sort
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
     </div> 
    

      <div className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead className="bg-[var(--surface)]">
            <tr>
              {Array.from({ length: cols }).map((_, colIndex) => {
                const colConfig = columns[colIndex];
                const isSorted = sort && sort.column === colIndex;
                return (
                  <th
                    key={colIndex}
                    className="relative border-r border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] last:border-r-0"
                    style={{ width: `${displayWidths[colIndex] || 150}px`, minWidth: "100px" }}
                    onMouseEnter={() => setHoveredCol(colIndex)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        {editingCell?.row === 0 && editingCell?.col === colIndex ? (
                          renderCell(0, colIndex, true)
                        ) : (
                          <div
                            onClick={() => startEditing(0, colIndex)}
                            className="flex-1 cursor-text rounded-md px-2 py-1 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-surface-hover"
                          >
                            {cells[0]?.[colIndex] || <span className="text-neutral-400 dark:text-neutral-500">Header...</span>}
                          </div>
                        )}
                        {/* Column type indicator with icon */}
                        {colConfig && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--tertiary-foreground)] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                            {colConfig.type === "text" && <Type className="h-2.5 w-2.5" />}
                            {colConfig.type === "number" && <Hash className="h-2.5 w-2.5" />}
                            {colConfig.type === "date" && <Calendar className="h-2.5 w-2.5" />}
                            {colConfig.type === "checkbox" && <CheckSquare className="h-2.5 w-2.5" />}
                            {colConfig.type === "select" && <List className="h-2.5 w-2.5" />}
                            <span className="capitalize">{colConfig.type}</span>
                            {colConfig.required && (
                              <span className="text-red-500" title="Required field">*</span>
                            )}
                            {colConfig.formula && (
                              <Calculator className="h-2.5 w-2.5 text-blue-500" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Column settings - now includes filter and sort */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="rounded p-1 text-[var(--tertiary-foreground)] transition-colors hover:text-[var(--foreground)]"
                              title="Column settings"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[200px]">
                            <DropdownMenuLabel>Column Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => toggleSort(colIndex)}>
                              {isSorted ? (
                                <>
                                  {sort.direction === "asc" ? (
                                    <ArrowUp className="h-4 w-4 mr-2" />
                                  ) : (
                                    <ArrowDown className="h-4 w-4 mr-2" />
                                  )}
                                  {sort.direction === "asc" ? "Sort Descending" : "Sort Ascending"}
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="h-4 w-4 mr-2 opacity-50" />
                                  Sort Column
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addFilter(colIndex)}>
                              <Filter className={cn(
                                "h-4 w-4 mr-2",
                                filters.some((f) => f.column === colIndex) && "text-blue-500"
                              )} />
                              {filters.some((f) => f.column === colIndex) ? "Add Another Filter" : "Filter Column"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Column Type</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setColumnType(colIndex, "text")} className="flex items-center gap-2">
                              <Type className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Text</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Plain text input</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setColumnType(colIndex, "number")} className="flex items-center gap-2">
                              <Hash className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Number</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Numeric values with formatting</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setColumnType(colIndex, "date")} className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Date</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Date picker</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setColumnType(colIndex, "checkbox")} className="flex items-center gap-2">
                              <CheckSquare className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Checkbox</div>
                                <div className="text-xs text-[var(--muted-foreground)]">True/false toggle</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setColumnType(colIndex, "select")} className="flex items-center gap-2">
                              <List className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Select</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Dropdown with options</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Number Format</DropdownMenuLabel>
                            {colConfig?.type === "number" && (
                              <>
                                <DropdownMenuItem onClick={() => updateColumnConfig(colIndex, { numberFormat: "number" })}>
                                  Number
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateColumnConfig(colIndex, { numberFormat: "currency" })}>
                                  Currency
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateColumnConfig(colIndex, { numberFormat: "percentage" })}>
                                  Percentage
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {colConfig?.type === "select" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectOptions(colConfig.options || []);
                                  setConfigDialogType("select");
                                  setEditingColumn(colIndex);
                                  setConfigDialogOpen(true);
                                }}
                              >
                                Configure Options
                              </DropdownMenuItem>
                            )}
                            {colConfig?.type === "number" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setNumberMin(colConfig.min?.toString() || "");
                                  setNumberMax(colConfig.max?.toString() || "");
                                  setNumberDecimals((colConfig.decimals ?? 2).toString());
                                  setConfigDialogType("number");
                                  setEditingColumn(colIndex);
                                  setConfigDialogOpen(true);
                                }}
                              >
                                Configure Number Settings
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setFormulaValue(colConfig?.formula || "");
                                setConfigDialogType("formula");
                                setEditingColumn(colIndex);
                                setConfigDialogOpen(true);
                              }}
                            >
                              {colConfig?.formula ? "Edit" : "Set"} Formula
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                const newRequired = !colConfig?.required;
                                updateColumnConfig(colIndex, { required: newRequired });
                              }}
                            >
                              {colConfig?.required ? "Remove" : "Set"} Required
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {/* Delete column button */}
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
                );
              })}
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
            {filteredAndSortedRows.map((actualRowIndex) => {
              return (
                <tr
                  key={actualRowIndex}
                  onMouseEnter={() => setHoveredRow(actualRowIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="group"
                >
                  {Array.from({ length: cols }).map((_, colIndex) => {
                    const isEditing = editingCell?.row === actualRowIndex && editingCell?.col === colIndex;
                    return (
                      <td
                        key={colIndex}
                        data-row={actualRowIndex}
                        data-col={colIndex}
                        className={cn(
                          "border border-[var(--border)] p-2 text-sm text-[var(--foreground)] relative",
                          cellError?.row === actualRowIndex && cellError?.col === colIndex && "bg-red-50 dark:bg-red-950/20",
                          searchResults.some((r) => r.row === actualRowIndex && r.col === colIndex) && "bg-yellow-100 dark:bg-yellow-900/30",
                          currentSearchIndex >= 0 && searchResults[currentSearchIndex]?.row === actualRowIndex && searchResults[currentSearchIndex]?.col === colIndex && "ring-2 ring-blue-500"
                        )}
                        style={{ width: `${displayWidths[colIndex] || 150}px` }}
                      >
                        {isEditing ? (
                          <div className="relative">
                            {renderCell(actualRowIndex, colIndex, true)}
                            {cellError?.row === actualRowIndex && cellError?.col === colIndex && (
                              <div className="absolute top-full left-0 mt-1 z-10 bg-red-500 text-white text-xs rounded px-2 py-1 shadow-lg flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {cellError.message}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditing(actualRowIndex, colIndex)}
                            className={cn(
                              "min-h-[24px] cursor-text rounded-[4px] px-2 py-1 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]",
                              columns[colIndex]?.required && !cells[actualRowIndex]?.[colIndex] && "ring-1 ring-orange-300 dark:ring-orange-700"
                            )}
                            title={columns[colIndex]?.required && !cells[actualRowIndex]?.[colIndex] ? "Required field" : "Click to edit"}
                          >
                            {renderCell(actualRowIndex, colIndex, false)}
                            {columns[colIndex]?.required && !cells[actualRowIndex]?.[colIndex] && (
                              <span className="text-orange-500 ml-1">*</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row button */}
        <div className="flex items-center gap-2 p-2">
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
              <X className="h-3.5 w-3.5" />
              Delete row
            </button>
          )}
        </div>
      </div>

      {/* Configuration Dialogs */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {configDialogType === "select" && "Configure Select Options"}
              {configDialogType === "number" && "Configure Number Settings"}
              {configDialogType === "formula" && "Set Formula"}
              {configDialogType === "help" && "Keyboard Shortcuts & Help"}
            </DialogTitle>
          </DialogHeader>

          {configDialogType === "select" && editingColumn !== null && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Options (one per line)</label>
                <textarea
                  value={selectOptions.join("\n")}
                  onChange={(e) => setSelectOptions(e.target.value.split("\n").filter((o) => o.trim()))}
                  placeholder="Option 1\nOption 2\nOption 3"
                  className="min-h-[120px] w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  rows={5}
                />
              </div>
              <DialogFooter>
                <button
                  onClick={() => {
                    updateColumnConfig(editingColumn, {
                      options: selectOptions.filter((o) => o.trim()),
                    });
                    setConfigDialogOpen(false);
                  }}
                  className="rounded-[4px] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
                >
                  Save
                </button>
              </DialogFooter>
            </div>
          )}

          {configDialogType === "number" && editingColumn !== null && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Value</label>
                <Input
                  type="number"
                  value={numberMin}
                  onChange={(e) => setNumberMin(e.target.value)}
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Maximum Value</label>
                <Input
                  type="number"
                  value={numberMax}
                  onChange={(e) => setNumberMax(e.target.value)}
                  placeholder="No maximum"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Decimal Places</label>
                <Input
                  type="number"
                  value={numberDecimals}
                  onChange={(e) => setNumberDecimals(e.target.value)}
                  min="0"
                  max="10"
                />
              </div>
              <DialogFooter>
                <button
                  onClick={() => {
                    updateColumnConfig(editingColumn, {
                      min: numberMin ? parseFloat(numberMin) : undefined,
                      max: numberMax ? parseFloat(numberMax) : undefined,
                      decimals: numberDecimals ? parseInt(numberDecimals) : 2,
                    });
                    setConfigDialogOpen(false);
                  }}
                  className="rounded-[4px] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
                >
                  Save
                </button>
              </DialogFooter>
            </div>
          )}

          {configDialogType === "help" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-[var(--foreground)] mb-2">Keyboard Shortcuts</div>
                    <div className="space-y-1.5 text-sm text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Tab</kbd>
                      <span>Move to next cell</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Shift+Tab</kbd>
                      <span>Move to previous cell</span>
                    </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Enter</kbd>
                        <span>New line (text columns)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+Enter</kbd>
                        <span>Save cell & move down</span>
                      </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Esc</kbd>
                      <span>Cancel editing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+F</kbd>
                      <span>Search table</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+C</kbd>
                      <span>Copy cell</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+V</kbd>
                      <span>Paste cell(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+Z</kbd>
                      <span>Undo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-[var(--background)] rounded border border-[var(--border)] text-xs">Cmd/Ctrl+Shift+Z</kbd>
                      <span>Redo</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-[var(--foreground)] mb-2">Tips</div>
                  <div className="space-y-1.5 text-sm text-[var(--muted-foreground)]">
                    <div>Click column header to edit name</div>
                    <div>Use settings menu to change column type</div>
                    <div>Formulas: <code className="text-xs bg-[var(--background)] px-1 rounded">=SUM(A)</code>, <code className="text-xs bg-[var(--background)] px-1 rounded">=AVERAGE(B)</code></div>
                    <div>Required fields show orange border when empty</div>
                    <div>Paste from Excel/CSV: Copy cells and paste directly</div>
                    <div>Search highlights matches: Use Enter/Shift+Enter to navigate</div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <button
                  onClick={() => setConfigDialogOpen(false)}
                  className="rounded-[4px] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
                >
                  Got it
                </button>
              </DialogFooter>
            </div>
          )}

          {configDialogType === "formula" && editingColumn !== null && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Formula</label>
                <Input
                  value={formulaValue}
                  onChange={(e) => setFormulaValue(e.target.value)}
                  placeholder="=SUM(A) or =AVERAGE(B) or =COUNT(C)"
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Use column names (A, B, C...) to reference columns. Examples: =SUM(A), =AVERAGE(B), =COUNT(C)
                </p>
              </div>
              <DialogFooter>
                <button
                  onClick={() => {
                    updateColumnConfig(editingColumn, {
                      formula: formulaValue || undefined,
                    });
                    setConfigDialogOpen(false);
                  }}
                  className="rounded-[4px] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
                >
                  Save
                </button>
                {columns[editingColumn]?.formula && (
                  <button
                    onClick={() => {
                      updateColumnConfig(editingColumn, {
                        formula: undefined,
                      });
                      setConfigDialogOpen(false);
                    }}
                    className="rounded-[4px] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    Remove Formula
                  </button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}        