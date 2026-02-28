"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { type TableField } from "@/types/table";

type TagOption = { id: string; label: string; color?: string | null };

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

function getOptions(field: TableField): TagOption[] {
  const options = ((field.config as any)?.options ?? []) as Array<{ id?: unknown; label?: unknown; color?: unknown }>;
  return options
    .map((option) => {
      const id = typeof option?.id === "string" ? option.id : "";
      const label = typeof option?.label === "string" ? option.label : "";
      if (!id || !label) return null;
      return { id, label, color: typeof option?.color === "string" ? option.color : null } as TagOption;
    })
    .filter((option): option is TagOption => Boolean(option));
}

function normalizeTagIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return values
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function TagsCell({ field, value, editing, onStartEdit, onCommit, saving }: Props) {
  const options = getOptions(field);
  const [selectedIds, setSelectedIds] = useState<string[]>(normalizeTagIds(value));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIds(normalizeTagIds(value));
  }, [value]);

  useEffect(() => {
    setDropdownOpen(editing);
  }, [editing]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        onCommit(selectedIds);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, selectedIds, onCommit]);

  const toggleOption = (optionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      return [...prev, optionId];
    });
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedIds.filter((id) => id !== optionId);
    setSelectedIds(next);
    onCommit(next);
  };

  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-[4px] px-2 py-1.5 min-h-[32px]">
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((option) => (
              <span
                key={option.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
                style={{ backgroundColor: option.color ? `${option.color}20` : undefined }}
              >
                {option.label}
                <button onClick={() => toggleOption(option.id)} className="hover:text-[var(--error)]">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-[var(--muted-foreground)] py-0.5">
              {selectedIds.length === 0 ? "Select tags..." : ""}
            </span>
          </div>
        </div>
        <div className="absolute top-full left-0 min-w-[240px] mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <div
                key={option.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs"
                onClick={() => toggleOption(option.id)}
              >
                <input type="checkbox" checked={isSelected} onChange={() => {}} className="h-4 w-4 rounded-[4px]" />
                <span style={{ color: option.color || undefined }} className="flex-1">
                  {option.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (selectedOptions.length === 0) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  return (
    <div className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity cursor-pointer" onClick={onStartEdit}>
      <div className="flex flex-wrap gap-1">
        {selectedOptions.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
            style={{ backgroundColor: option.color ? `${option.color}20` : undefined }}
          >
            {option.label}
            <button onClick={(e) => removeOption(option.id, e)} className="hover:text-[var(--error)]">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

