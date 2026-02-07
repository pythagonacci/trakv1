"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Settings, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X, Trash2, Pin, Eye, EyeOff } from "lucide-react";
import type { SortCondition, TableField, CalculationType, TableRow as TableRowType } from "@/types/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { FieldType } from "@/types/table";

const DEFAULT_COL_WIDTH = 180;

function availableCalculations(type: string): CalculationType[] {
  switch (type) {
    case "number":
      return ["sum", "average", "median", "min", "max", "range"];
    case "checkbox":
      return ["checked", "unchecked", "percent_checked"];
    case "text":
    case "long_text":
    case "url":
    case "email":
      return ["count_values", "count_empty", "count_unique"];
    case "select":
    case "multi_select":
    case "status":
    case "priority":
      return ["count_values", "count_unique"];
    default:
      return ["count_all", "count_values"];
  }
}

function calculateValue(values: unknown[], type: CalculationType) {
  const cleanValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericValues = cleanValues
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => !Number.isNaN(v));

  switch (type) {
    case "sum":
      return numericValues.reduce((sum, v) => sum + v, 0);
    case "average":
      return numericValues.length ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length : 0;
    case "median": {
      if (!numericValues.length) return 0;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    case "min":
      return numericValues.length ? Math.min(...numericValues) : null;
    case "max":
      return numericValues.length ? Math.max(...numericValues) : null;
    case "range":
      return numericValues.length ? Math.max(...numericValues) - Math.min(...numericValues) : null;
    case "count_all":
      return values.length;
    case "count_values":
      return cleanValues.length;
    case "count_empty":
      return values.length - cleanValues.length;
    case "count_unique":
      return new Set(cleanValues.map((v) => JSON.stringify(v))).size;
    case "percent_empty": {
      const empty = values.length - cleanValues.length;
      return values.length ? Math.round((empty / values.length) * 100) : 0;
    }
    case "percent_filled": {
      return values.length ? Math.round((cleanValues.length / values.length) * 100) : 0;
    }
    case "checked": {
      return values.filter((v) => v === true).length;
    }
    case "unchecked": {
      return values.filter((v) => v === false || v === null || v === undefined).length;
    }
    case "percent_checked": {
      const checked = values.filter((v) => v === true).length;
      return values.length ? Math.round((checked / values.length) * 100) : 0;
    }
    default:
      return null;
  }
}

function formatCalcValue(value: unknown, fieldType: string, calcType?: CalculationType) {
  if (value === null || value === undefined) return "-";
  if (calcType && calcType.includes("percent")) return `${value}%`;
  if (fieldType === "number" && typeof value === "number") return value.toLocaleString();
  return String(value);
}

const TYPE_OPTIONS: Array<{ value: FieldType; label: string; category?: string }> = [
  // Basic Types
  { value: "text", label: "Text", category: "Basic" },
  { value: "long_text", label: "Long Text", category: "Basic" },
  { value: "number", label: "Number", category: "Basic" },
  { value: "date", label: "Date", category: "Basic" },
  { value: "checkbox", label: "Checkbox", category: "Basic" },

  // Selection Types
  { value: "select", label: "Select", category: "Select" },
  { value: "multi_select", label: "Multi-select", category: "Select" },
  { value: "status", label: "Status", category: "Select" },
  { value: "priority", label: "Priority", category: "Select" },

  // Contact Types
  { value: "email", label: "Email", category: "Contact" },
  { value: "phone", label: "Phone", category: "Contact" },
  { value: "url", label: "URL", category: "Contact" },
  { value: "person", label: "Person", category: "Contact" },
  { value: "files", label: "Files", category: "Contact" },

  // Relations & Computed
  { value: "relation", label: "Relation", category: "Advanced" },
  { value: "rollup", label: "Rollup", category: "Advanced" },
  { value: "formula", label: "Formula", category: "Advanced" },
];

interface Props {
  fields: TableField[];
  columnTemplate?: string;
  sorts: SortCondition[];
  pinnedFields?: string[];
  selectedCount?: number;
  totalCount?: number;
  selectionWidth?: number;
  onToggleAllRows?: () => void;
  onToggleSort: (fieldId: string) => void;
  onSetSort: (fieldId: string, direction: "asc" | "desc" | null) => void;
  onRenameField: (fieldId: string, name: string) => void;
  onDeleteField: (fieldId: string) => void;
  onAddField: () => void;
  onInsertField?: (fieldId: string, direction: "left" | "right") => void;
  onChangeType: (fieldId: string, type: FieldType) => void;
  onReorderField: (fieldId: string, direction: "left" | "right") => void;
  onPinColumn?: (fieldId: string) => void;
  onViewColumnDetails?: (fieldId: string) => void;
  onConfigureField?: (fieldId: string) => void;
  columnRefs?: Record<string, (el: HTMLDivElement | null) => void>;
  className?: string;
  onColumnContextMenu?: (e: React.MouseEvent, fieldId: string) => void;
  onHideField?: (fieldId: string) => void;
  onResize?: (fieldId: string, width: number, persist: boolean) => void;
  widths?: Record<string, number>;
  onUpdateFieldConfig?: (fieldId: string, config: any) => void;
  calculations?: Record<string, CalculationType | undefined>;
  rows?: TableRowType[];
  onUpdateCalculation?: (fieldId: string, calc: CalculationType | null) => void;
}

export function TableHeaderRow({
  fields,
  columnTemplate,
  calculations = {},
  rows = [],
  onUpdateCalculation,
  sorts,
  pinnedFields = [],
  selectedCount = 0,
  totalCount = 0,
  selectionWidth = 0,
  onToggleAllRows,
  onToggleSort,
  onSetSort,
  onRenameField,
  onDeleteField,
  onAddField,
  onInsertField,
  onChangeType,
  onReorderField,
  onPinColumn,
  onViewColumnDetails,
  onConfigureField,
  columnRefs,
  className,
  onColumnContextMenu,
  onHideField,
  onResize,
  widths,
  onUpdateFieldConfig,
}: Props) {
  const template = useMemo(() => {
    if (columnTemplate) return columnTemplate;
    // Default template: selection column + fields + add column
    const fieldsTemplate = Array(fields.length).fill("minmax(180px,1fr)").join(" ");
    const selectionCol = selectionWidth || 36;
    return `${selectionCol}px ${fieldsTemplate} 40px`;
  }, [columnTemplate, fields.length, selectionWidth]);

  const pinnedOffsets = useMemo(() => {
    let acc = selectionWidth;
    const offsets: Record<string, number> = {};
    fields.forEach((f) => {
      offsets[f.id] = acc;
      acc += widths?.[f.id] ?? f.width ?? DEFAULT_COL_WIDTH;
    });
    return offsets;
  }, [fields, widths, selectionWidth]);

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <div
        className="grid border-b border-l border-[var(--border)] bg-[#d8d8d8]/20 w-full"
        style={{ gridTemplateColumns: template }}
      >
        <div className="flex items-center justify-center border-r border-black/10 bg-[#d8d8d8]/20 sticky left-0 z-30">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => onToggleAllRows?.()}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
        </div>
        {fields.map((field, idx) => {
          const isPinned = pinnedFields.includes(field.id);
          return (
              <div
              key={field.id}
              ref={columnRefs?.[field.id]}
              className={`${isPinned ? "sticky z-20 bg-[#d8d8d8]/20" : ""}`}
              style={isPinned ? { 
                left: `${pinnedOffsets[field.id]}px`,
                boxShadow: idx > 0 ? '2px 0 4px rgba(0,0,0,0.1)' : 'none'
              } : {}}
              onContextMenu={(e) => {
                e.preventDefault();
                onColumnContextMenu?.(e, field.id);
              }}
            >
              <FieldHeader
                field={field}
                sort={sorts.find((s) => s.fieldId === field.id)}
                isFirst={idx === 0}
                isLast={idx === fields.length - 1}
                isPinned={isPinned}
                canDelete={fields.length > 1}
                onRenameField={onRenameField}
                onDeleteField={onDeleteField}
                onChangeType={onChangeType}
                onInsertField={onInsertField}
                onReorderField={onReorderField}
                onSetSort={onSetSort}
                onToggleSort={onToggleSort}
                onPinColumn={onPinColumn}
                onViewColumnDetails={onViewColumnDetails}
                onConfigureField={onConfigureField}
                onHideField={onHideField}
            onResize={onResize}
            currentWidth={widths?.[field.id]}
            calculations={calculations}
            rows={rows}
            onUpdateCalculation={onUpdateCalculation}
          />
        </div>
      );
    })}
        <div className="flex items-center justify-center border-l border-black/10 bg-[#d8d8d8]/20 min-w-[40px]">
          <button
            onClick={onAddField}
            className="inline-flex items-center justify-center w-8 h-6 rounded-[2px] border border-dashed border-black/25 bg-transparent text-[var(--muted-foreground)] hover:border-black/40 hover:bg-black/5 hover:text-[var(--foreground)] transition-colors duration-150 text-sm"
            title="Add column"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldHeaderProps {
  field: TableField;
  sort?: SortCondition;
  isFirst: boolean;
  isLast: boolean;
  isPinned?: boolean;
  canDelete: boolean;
  onRenameField: (fieldId: string, name: string) => void;
  onDeleteField: (fieldId: string) => void;
  onChangeType: (fieldId: string, type: FieldType) => void;
  onInsertField?: (fieldId: string, direction: "left" | "right") => void;
  onReorderField: (fieldId: string, direction: "left" | "right") => void;
  onSetSort: (fieldId: string, direction: "asc" | "desc" | null) => void;
  onToggleSort: (fieldId: string) => void;
  onPinColumn?: (fieldId: string) => void;
  onViewColumnDetails?: (fieldId: string) => void;
  onConfigureField?: (fieldId: string) => void;
  onHideField?: (fieldId: string) => void;
  onResize?: (fieldId: string, width: number, persist: boolean) => void;
  currentWidth?: number;
  onUpdateFieldConfig?: (fieldId: string, config: any) => void;
  calculations?: Record<string, CalculationType | undefined>;
  rows?: TableRowType[];
  onUpdateCalculation?: (fieldId: string, calc: CalculationType | null) => void;
}

function isOptionField(type: FieldType) {
  return type === "select" || type === "multi_select" || type === "status";
}

function isConfigurableField(type: FieldType) {
  return isOptionField(type) || type === "priority";
}

function commitOptions(
  field: TableField,
  options: any[],
  onUpdateFieldConfig?: (fieldId: string, config: any) => void
) {
  if (!onUpdateFieldConfig) return;
  if (isOptionField(field.type)) {
    const config = { ...(field.config || {}), options };
    onUpdateFieldConfig(field.id, config);
  } else if (field.type === "priority") {
    const config = { ...(field.config || {}), levels: options };
    onUpdateFieldConfig(field.id, config);
  }
}

function FieldHeader({
  field,
  sort,
  isFirst,
  isLast,
  isPinned,
  canDelete,
  onRenameField,
  onDeleteField,
  onChangeType,
  onInsertField,
  onReorderField,
  onSetSort,
  onToggleSort,
  onPinColumn,
  onViewColumnDetails,
  onConfigureField,
  onHideField,
  onResize,
  currentWidth,
  calculations = {},
  rows = [],
  onUpdateCalculation,
  onUpdateFieldConfig,
}: FieldHeaderProps) {
  const [draftName, setDraftName] = useState(field.name);
  const [draftOptions, setDraftOptions] = useState<any[]>([]);

  useEffect(() => {
    setDraftName(field.name);
  }, [field.name]);

  useEffect(() => {
    if (isOptionField(field.type)) {
      const opts = (field.config as any)?.options ?? [];
      setDraftOptions(opts);
    } else if (field.type === "priority") {
      const levels = (field.config as any)?.levels ?? [];
      setDraftOptions(levels);
    } else {
      setDraftOptions([]);
    }
  }, [field.type, field.config]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== field.name) {
      onRenameField(field.id, trimmed);
    } else {
      setDraftName(field.name);
    }
  };

  return (
    <div className="px-2 py-0.5 flex items-center gap-1.5 border-r border-black/10 bg-[#d8d8d8]/20 relative min-h-0">
      <div className="flex-1 overflow-hidden min-w-0">
        <input
          className="w-full bg-transparent text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none truncate border border-transparent focus:border-black/30 rounded-[2px] px-1.5 py-0.5"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
        <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--muted-foreground)] flex items-center gap-1">
          {field.type !== "text" && (
            <span className="rounded-[1px] px-1 py-[1px] bg-black/10 border border-black/15 text-[9px] text-[var(--foreground)]">{field.type}</span>
          )}
          {sort && (
            <span className="text-[var(--foreground)] flex items-center gap-0.5">
              {sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {sort.direction}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative z-20 h-6 w-6 inline-flex items-center justify-center rounded-[2px] bg-white/70 border border-black/15 text-[var(--foreground)] hover:bg-white/90 hover:text-[var(--foreground)] transition-colors duration-150 text-xs"
            aria-label="Field actions"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-1 min-w-[140px]">
          <DropdownMenuLabel className="px-2 py-1 text-[10px]">Field actions</DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />
          {onConfigureField && ["relation", "rollup", "formula"].includes(field.type) && (
            <DropdownMenuItem
              onSelect={() => onConfigureField(field.id)}
              className="gap-1.5 px-2 py-1 text-xs"
            >
              Configure field
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => onDeleteField(field.id)}
            disabled={!canDelete}
            className="gap-1.5 px-2 py-1 text-xs text-red-300 focus:text-red-200"
          >
            <Trash2 className="h-3 w-3" /> Delete column
          </DropdownMenuItem>
          {onHideField && (
            <DropdownMenuItem
              onSelect={() => onHideField(field.id)}
              className="gap-1.5 px-2 py-1 text-xs"
            >
              <EyeOff className="h-3 w-3" /> Hide column
            </DropdownMenuItem>
          )}
          {onPinColumn && (
            <DropdownMenuItem
              onSelect={() => onPinColumn(field.id)}
              className="gap-1.5 px-2 py-1 text-xs"
            >
              <Pin className="h-3 w-3" /> {isPinned ? "Unpin column" : "Pin column"}
            </DropdownMenuItem>
          )}
          {onViewColumnDetails && (
            <DropdownMenuItem
              onSelect={() => onViewColumnDetails(field.id)}
              className="gap-1.5 px-2 py-1 text-xs"
            >
              <Eye className="h-3 w-3" /> View column details
            </DropdownMenuItem>
          )}
          {onUpdateCalculation && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuLabel className="px-2 py-1 text-[10px]">Calculate</DropdownMenuLabel>
              {(() => {
                const calc = calculations[field.id];
                const columnValues = rows.map((row) => row.data?.[field.id]);
                const calculatedValue = calc ? calculateValue(columnValues, calc) : null;
                const options = availableCalculations(field.type);
                return (
                  <>
                    <DropdownMenuItem onSelect={() => onUpdateCalculation(field.id, null)} className="gap-1.5 px-2 py-1 text-xs">
                      <X className="h-3 w-3" /> None
                    </DropdownMenuItem>
                    {options.map((opt) => (
                      <DropdownMenuItem 
                        key={opt} 
                        onSelect={() => onUpdateCalculation(field.id, opt)} 
                        className="gap-1.5 px-2 py-1 text-xs"
                      >
                        {opt.replace(/_/g, " ")}
                        {calc === opt && calculatedValue !== null && (
                          <span className="ml-auto text-[10px] text-[var(--muted-foreground)] font-mono">
                            {formatCalcValue(calculatedValue, field.type, opt)}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                );
              })()}
            </>
          )}
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuLabel className="px-2 py-1 text-[10px]">Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={field.type as FieldType}
            onValueChange={(value) => onChangeType(field.id, value as FieldType)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className="py-1 pl-7 pr-2 text-xs">
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator className="my-1" />
          {onInsertField && (
            <>
              <DropdownMenuItem
                onSelect={() => onInsertField(field.id, "left")}
                className="gap-1.5 px-2 py-1 text-xs"
              >
                <ArrowLeft className="h-3 w-3" /> Add column left
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onInsertField(field.id, "right")}
                className="gap-1.5 px-2 py-1 text-xs"
              >
                <ArrowRight className="h-3 w-3" /> Add column right
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => onReorderField(field.id, "left")}
            disabled={isFirst}
            className="gap-1.5 px-2 py-1 text-xs"
          >
            <ArrowLeft className="h-3 w-3" /> Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onReorderField(field.id, "right")}
            disabled={isLast}
            className="gap-1.5 px-2 py-1 text-xs"
          >
            <ArrowRight className="h-3 w-3" /> Move right
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem onSelect={() => onSetSort(field.id, "asc")} className="gap-1.5 px-2 py-1 text-xs">
            <ArrowUp className="h-3 w-3" /> Sort ascending
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSetSort(field.id, "desc")} className="gap-1.5 px-2 py-1 text-xs">
            <ArrowDown className="h-3 w-3" /> Sort descending
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSetSort(field.id, null)} className="gap-1.5 px-2 py-1 text-xs">
            <X className="h-3 w-3" /> Clear sort
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            onSelect={() => onToggleSort(field.id)}
            className="gap-1.5 px-2 py-1 text-xs text-slate-300"
          >
            Toggle sort cycle
          </DropdownMenuItem>

          {/* Configurator for option-based fields */}
          {isConfigurableField(field.type) && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuLabel className="px-2 py-1 text-[10px]">Options</DropdownMenuLabel>
              <div className="px-2 py-1 space-y-2 max-h-64 overflow-y-auto">
                {draftOptions.map((opt, idx) => (
                  <div key={opt.id || idx} className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
                      value={opt.label ?? ""}
                      onChange={(e) => {
                        const next = [...draftOptions];
                        next[idx] = { ...opt, label: e.target.value };
                        setDraftOptions(next);
                        commitOptions(field, next, onUpdateFieldConfig);
                      }}
                      placeholder="Label"
                    />
                    <input
                      type="color"
                      className="h-7 w-9 bg-[var(--surface)] border border-[var(--border)] rounded-[2px]"
                      value={opt.color || "#cccccc"}
                      onChange={(e) => {
                        const next = [...draftOptions];
                        next[idx] = { ...opt, color: e.target.value };
                        setDraftOptions(next);
                        commitOptions(field, next, onUpdateFieldConfig);
                      }}
                    />
                    <button
                      className="text-[var(--error)] hover:text-red-400"
                      onClick={() => {
                        const next = draftOptions.filter((_, i) => i !== idx);
                        setDraftOptions(next);
                        commitOptions(field, next, onUpdateFieldConfig);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  className="w-full rounded-[2px] border border-dashed border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  onClick={() => {
                    const newOpt = {
                      id: crypto.randomUUID ? crypto.randomUUID() : `opt-${Date.now()}`,
                      label: "New option",
                      color: "#4A7A78",
                    };
                    const next = [...draftOptions, newOpt];
                    setDraftOptions(next);
                    commitOptions(field, next, onUpdateFieldConfig);
                  }}
                >
                  Add option
                </button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {onResize && (
        <div
          className="absolute right-0 top-0 h-full w-4 cursor-col-resize select-none bg-transparent group/resize z-10"
          draggable={false}
          title="Drag to resize · Double-click to reset"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startWidth = currentWidth ?? field.width ?? DEFAULT_COL_WIDTH;
            const onMove = (ev: PointerEvent) => {
              const delta = ev.clientX - startX;
              const next = Math.max(120, startWidth + delta);
              onResize(field.id, next, false);
            };
            const onUp = (ev: PointerEvent) => {
              const delta = ev.clientX - startX;
              const next = Math.max(120, startWidth + delta);
              onResize(field.id, next, true);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize(field.id, DEFAULT_COL_WIDTH, true);
          }}
        />
      )}
      {onResize && (
        <div className="absolute right-0 top-0 h-full w-[2px] bg-[var(--border-strong)] opacity-0 group-hover/resize:opacity-60 transition-opacity pointer-events-none" />
      )}
    </div>
  );
}
