"use client";

import { useEffect, useRef, useState } from "react";
import { type TableField, type SelectFieldOption, type StatusFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

export function StatusCell({ field, value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const config = (field.config || {}) as StatusFieldConfig;
  const options = config.options || [];
  const [draft, setDraft] = useState<string | undefined>(typeof value === "string" ? value : undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(typeof value === "string" ? value : undefined);
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
        onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, onCancel]);

  const selectedOption = options.find((opt) => opt.id === value);

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div className="absolute top-0 left-0 right-0 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[2px] shadow-lg z-10 max-h-60 overflow-y-auto">
          <div
            className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm text-[var(--muted-foreground)]"
            onClick={() => {
              setDraft(undefined);
              onCommit(null);
              setDropdownOpen(false);
            }}
          >
            Clear
          </div>
          {options.map((opt: SelectFieldOption) => (
            <div
              key={opt.id}
              className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm flex items-center gap-2"
              onClick={() => {
                setDraft(opt.id);
                onCommit(opt.id);
                setDropdownOpen(false);
              }}
            >
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: opt.color || 'var(--muted-foreground)' }}
              />
              <span className="text-[var(--foreground)]">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedOption) {
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

  return (
    <button
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity"
      onClick={onStartEdit}
      disabled={saving}
    >
      <span
        className="inline-flex items-center gap-2 px-2 py-1 rounded-[2px] text-sm font-medium border border-[var(--border)]"
        style={{
          backgroundColor: selectedOption.color ? `${selectedOption.color}20` : 'var(--surface-muted)',
          color: selectedOption.color || 'var(--foreground)',
        }}
      >
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: selectedOption.color || 'var(--muted-foreground)' }}
        />
        {selectedOption.label}
      </span>
    </button>
  );
}
