"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { type TableField, type SelectFieldOption, type SelectFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

export function MultiSelectCell({ field, value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const config = (field.config || {}) as SelectFieldConfig;
  const options = config.options || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIds(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  }, [value]);

  useEffect(() => {
    if (editing) {
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [editing]);

  // Close dropdown when clicking outside
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
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      } else {
        return [...prev, optionId];
      }
    });
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== optionId);
    setSelectedIds(newIds);
    onCommit(newIds);
  };

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-[2px] px-2 py-1.5 min-h-[32px]">
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
                style={{ backgroundColor: opt.color ? `${opt.color}20` : undefined }}
              >
                {opt.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(opt.id);
                  }}
                  className="hover:text-[var(--error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-[var(--muted-foreground)] py-0.5">
              {selectedIds.length === 0 ? "Select options..." : ""}
            </span>
          </div>
        </div>
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <div
                key={opt.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm"
                onClick={() => toggleOption(opt.id)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="h-4 w-4 rounded-[2px] border-[var(--border)] bg-[var(--surface)]"
                />
                <span
                  className="flex-1 text-[var(--foreground)]"
                  style={{ color: opt.color || undefined }}
                >
                  {opt.label}
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
        className="w-full text-left text-sm text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  const displayLimit = 2;
  const visibleOptions = selectedOptions.slice(0, displayLimit);
  const remainingCount = selectedOptions.length - displayLimit;

  return (
    <button
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity"
      onClick={onStartEdit}
      disabled={saving}
    >
      <div className="flex flex-wrap gap-1">
        {visibleOptions.map((opt) => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
            style={{ backgroundColor: opt.color ? `${opt.color}20` : undefined }}
          >
            {opt.label}
            <button
              onClick={(e) => removeOption(opt.id, e)}
              className="hover:text-[var(--error)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--muted-foreground)]">
            +{remainingCount} more
          </span>
        )}
      </div>
    </button>
  );
}
