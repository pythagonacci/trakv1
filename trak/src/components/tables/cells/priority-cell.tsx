"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { type TableField, type PriorityFieldConfig, type PriorityLevelConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

const getPriorityIcon = (order: number) => {
  if (order >= 4) return <AlertCircle className="h-3.5 w-3.5" />;
  if (order >= 3) return <ArrowUp className="h-3.5 w-3.5" />;
  if (order >= 2) return <Minus className="h-3.5 w-3.5" />;
  return <ArrowDown className="h-3.5 w-3.5" />;
};

export function PriorityCell({ field, value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const config = (field.config || {}) as PriorityFieldConfig;
  const levels = config.levels || [];
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

  const selectedLevel = levels.find((level) => level.id === value);
  const sortedLevels = [...levels].sort((a, b) => (b.order || 0) - (a.order || 0));

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
          {sortedLevels.map((level: PriorityLevelConfig) => (
            <div
              key={level.id}
              className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm flex items-center gap-2"
              onClick={() => {
                setDraft(level.id);
                onCommit(level.id);
                setDropdownOpen(false);
              }}
            >
              <div style={{ color: level.color || 'var(--muted-foreground)' }}>
                {getPriorityIcon(level.order || 0)}
              </div>
              <span className="text-[var(--foreground)]">{level.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedLevel) {
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
          backgroundColor: selectedLevel.color ? `${selectedLevel.color}20` : 'var(--surface-muted)',
          color: selectedLevel.color || 'var(--foreground)',
        }}
      >
        {getPriorityIcon(selectedLevel.order || 0)}
        {selectedLevel.label}
      </span>
    </button>
  );
}
