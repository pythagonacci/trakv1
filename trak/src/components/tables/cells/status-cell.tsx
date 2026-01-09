"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { type TableField, type SelectFieldOption, type StatusFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  onUpdateConfig?: (config: StatusFieldConfig) => void;
}

const randomColor = () => {
  const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1"];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function StatusCell({ field, value, editing, onStartEdit, onCommit, onCancel, saving, onUpdateConfig }: Props) {
  const config = (field.config || {}) as StatusFieldConfig;
  const options = config.options || [];
  const [draft, setDraft] = useState<string | undefined>(typeof value === "string" ? value : undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleAddOption = () => {
    if (!newOptionName.trim() || !onUpdateConfig) return;

    const newOption: SelectFieldOption = {
      id: `opt_${Date.now()}`,
      label: newOptionName.trim(),
      color: randomColor(),
    };

    const newConfig: StatusFieldConfig = {
      ...config,
      options: [...options, newOption],
    };

    onUpdateConfig(newConfig);
    setDraft(newOption.id);
    onCommit(newOption.id);
    setNewOptionName("");
    setDropdownOpen(false);
  };

  const handleDeleteOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateConfig) return;

    const newConfig: StatusFieldConfig = {
      ...config,
      options: options.filter((opt) => opt.id !== optionId),
    };

    onUpdateConfig(newConfig);
    if (draft === optionId) {
      setDraft(undefined);
      onCommit(null);
    }
  };

  const selectedOption = options.find((opt) => opt.id === value);

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div className="absolute top-0 left-0 min-w-[240px] bg-[var(--surface)] border border-[var(--border-strong)] rounded-[2px] shadow-lg z-10 max-h-60 overflow-y-auto">
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
              className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm flex items-center gap-2 group"
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
              <span className="flex-1 text-[var(--foreground)]">{opt.label}</span>
              {onUpdateConfig && (
                <button
                  onClick={(e) => handleDeleteOption(opt.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {onUpdateConfig && (
            <>
              <div className="border-t border-[var(--border)] my-1" />
              <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="New status..."
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1"
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOptionName.trim()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-[2px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!selectedOption) {
    return (
      <button
        className="w-full text-left text-sm text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 flex items-center gap-1"
        onClick={onStartEdit}
        disabled={saving}
      >
        {onUpdateConfig && <Plus className="h-3 w-3" />}
        <span>Empty</span>
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
