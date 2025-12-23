"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Settings, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X, Trash2, Pin, Eye } from "lucide-react";
import type { SortCondition, TableField } from "@/types/table";
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

type BasicFieldType = "text" | "number" | "date" | "checkbox" | "select";

const TYPE_OPTIONS: Array<{ value: BasicFieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
];

interface Props {
  fields: TableField[];
  columnTemplate?: string;
  sorts: SortCondition[];
  pinnedFields?: string[];
  onToggleSort: (fieldId: string) => void;
  onSetSort: (fieldId: string, direction: "asc" | "desc" | null) => void;
  onRenameField: (fieldId: string, name: string) => void;
  onDeleteField: (fieldId: string) => void;
  onAddField: () => void;
  onChangeType: (fieldId: string, type: BasicFieldType) => void;
  onReorderField: (fieldId: string, direction: "left" | "right") => void;
  onPinColumn?: (fieldId: string) => void;
  onViewColumnDetails?: (fieldId: string) => void;
  columnRefs?: Record<string, (el: HTMLDivElement | null) => void>;
  className?: string;
  onColumnContextMenu?: (e: React.MouseEvent, fieldId: string) => void;
}

export function TableHeaderRow({
  fields,
  columnTemplate,
  sorts,
  pinnedFields = [],
  onToggleSort,
  onSetSort,
  onRenameField,
  onDeleteField,
  onAddField,
  onChangeType,
  onReorderField,
  onPinColumn,
  onViewColumnDetails,
  columnRefs,
  className,
  onColumnContextMenu,
}: Props) {
  const template = useMemo(
    () => columnTemplate || Array(fields.length).fill("minmax(180px,1fr)").join(" "),
    [columnTemplate, fields.length]
  );

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <div
        className="grid border-b border-[var(--border)] bg-[var(--background)] w-full"
        style={{ gridTemplateColumns: template }}
      >
        {fields.map((field, idx) => {
          const isPinned = pinnedFields.includes(field.id);
          return (
            <div
              key={field.id}
              ref={columnRefs?.[field.id]}
              className={isPinned ? "sticky z-20 bg-[var(--background)]" : ""}
              style={isPinned ? { 
                left: idx > 0 ? `${idx * 180}px` : '0px',
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
                onReorderField={onReorderField}
                onSetSort={onSetSort}
                onToggleSort={onToggleSort}
                onPinColumn={onPinColumn}
                onViewColumnDetails={onViewColumnDetails}
              />
            </div>
          );
        })}
        <div className="flex items-center justify-center border-l border-[var(--border)] bg-[var(--surface-muted)] min-w-[40px]">
          <button
            onClick={onAddField}
            className="inline-flex items-center justify-center w-8 h-7 rounded-[2px] border border-dashed border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors duration-150 text-sm"
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
  onChangeType: (fieldId: string, type: BasicFieldType) => void;
  onReorderField: (fieldId: string, direction: "left" | "right") => void;
  onSetSort: (fieldId: string, direction: "asc" | "desc" | null) => void;
  onToggleSort: (fieldId: string) => void;
  onPinColumn?: (fieldId: string) => void;
  onViewColumnDetails?: (fieldId: string) => void;
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
  onReorderField,
  onSetSort,
  onToggleSort,
  onPinColumn,
  onViewColumnDetails,
}: FieldHeaderProps) {
  const [draftName, setDraftName] = useState(field.name);

  useEffect(() => {
    setDraftName(field.name);
  }, [field.name]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== field.name) {
      onRenameField(field.id, trimmed);
    } else {
      setDraftName(field.name);
    }
  };

  return (
    <div className="px-3 py-2 flex items-center gap-2 border-r border-[var(--border)] last:border-r-0 bg-[var(--surface-muted)]">
      <div className="flex-1 overflow-hidden">
        <input
          className="w-full bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none truncate border border-transparent focus:border-[var(--border-strong)] rounded-[2px] px-2 py-1"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
        <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] flex items-center gap-1">
          <span className="rounded-[2px] px-1.5 py-[2px] bg-[var(--surface)] border border-[var(--border)] text-[10px]">{field.type}</span>
          {sort && (
            <span className="text-[var(--dome-teal)] flex items-center gap-1">
              {sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {sort.direction}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors duration-150 text-xs"
            aria-label="Field actions"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-1 min-w-[140px]">
          <DropdownMenuLabel className="px-2 py-1 text-[10px]">Field actions</DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            onSelect={() => onDeleteField(field.id)}
            disabled={!canDelete}
            className="gap-1.5 px-2 py-1 text-xs text-red-300 focus:text-red-200"
          >
            <Trash2 className="h-3 w-3" /> Delete column
          </DropdownMenuItem>
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
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuLabel className="px-2 py-1 text-[10px]">Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={field.type as BasicFieldType}
            onValueChange={(value) => onChangeType(field.id, value as BasicFieldType)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className="py-1 pl-7 pr-2 text-xs">
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator className="my-1" />
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
