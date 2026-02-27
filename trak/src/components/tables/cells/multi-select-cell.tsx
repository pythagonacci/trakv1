"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { type TableField, type SelectFieldOption, type SelectFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  onUpdateConfig?: (config: SelectFieldConfig) => void;
}

const randomColor = () => {
  const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1"];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function MultiSelectCell({ field, value, editing, onStartEdit, onCommit, saving, onUpdateConfig }: Props) {
  const config = (field.config || {}) as SelectFieldConfig;
  const options = config.options || [];

  const resolveLabel = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return null;
    const matched = options.find(
      (opt) => opt.label.trim().toLowerCase() === normalized || opt.id.trim().toLowerCase() === normalized
    );
    return matched?.label ?? raw.trim();
  };

  const normalizeValues = (raw: unknown): string[] =>
    (Array.isArray(raw) ? raw : [])
      .map((entry) => resolveLabel(entry))
      .filter((entry): entry is string => Boolean(entry));

  const [selectedValues, setSelectedValues] = useState<string[]>(normalizeValues(value));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedValues(normalizeValues(value));
  }, [value, options]);

  useEffect(() => {
    setDropdownOpen(editing);
  }, [editing]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        onCommit(selectedValues);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, selectedValues, onCommit]);

  const toggleOption = (optionLabel: string) => {
    setSelectedValues((prev) => {
      if (prev.includes(optionLabel)) {
        return prev.filter((label) => label !== optionLabel);
      }
      return [...prev, optionLabel];
    });
  };

  const removeOption = (optionLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValues = selectedValues.filter((label) => label !== optionLabel);
    setSelectedValues(newValues);
    onCommit(newValues);
  };

  const handleAddOption = () => {
    if (!newOptionName.trim() || !onUpdateConfig) return;

    const newOption: SelectFieldOption = {
      id: `opt_${Date.now()}`,
      label: newOptionName.trim(),
      color: randomColor(),
    };

    const newConfig: SelectFieldConfig = {
      ...config,
      options: [...options, newOption],
    };

    onUpdateConfig(newConfig);
    const newValues = [...selectedValues, newOption.label];
    setSelectedValues(newValues);
    onCommit(newValues);
    setNewOptionName("");
  };

  const handleDeleteOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateConfig) return;

    const deletedOpt = options.find((opt) => opt.id === optionId);
    const newConfig: SelectFieldConfig = {
      ...config,
      options: options.filter((opt) => opt.id !== optionId),
    };

    onUpdateConfig(newConfig);

    if (deletedOpt && selectedValues.includes(deletedOpt.label)) {
      const newValues = selectedValues.filter((label) => label !== deletedOpt.label);
      setSelectedValues(newValues);
      onCommit(newValues);
    }
  };

  const selectedOptions = options.filter((opt) => selectedValues.includes(opt.label));

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-[4px] px-2 py-1.5 min-h-[32px]">
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
                style={{ backgroundColor: opt.color ? `${opt.color}20` : undefined }}
              >
                {opt.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(opt.label);
                  }}
                  className="hover:text-[var(--error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-[var(--muted-foreground)] py-0.5">
              {selectedValues.length === 0 ? "Select options..." : ""}
            </span>
          </div>
        </div>
        <div className="absolute top-full left-0 min-w-[240px] mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.label);
            return (
              <div
                key={opt.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs group"
                onClick={() => toggleOption(opt.label)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="h-4 w-4 rounded-[4px] border-[var(--border)] bg-[var(--surface)]"
                />
                <span
                  className="flex-1 text-[var(--foreground)]"
                  style={{ color: opt.color || undefined }}
                >
                  {opt.label}
                </span>
                {onUpdateConfig && (
                  <button
                    onClick={(e) => handleDeleteOption(opt.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          {onUpdateConfig && (
            <>
              <div className="border-t border-[var(--border)] my-1" />
              <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="New option..."
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOptionName.trim()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-[4px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
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

  if (selectedOptions.length === 0) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 flex items-center gap-1"
        onClick={onStartEdit}
        disabled={saving}
      >
        {onUpdateConfig && <Plus className="h-3 w-3" />}
      </button>
    );
  }

  const displayLimit = 2;
  const visibleOptions = selectedOptions.slice(0, displayLimit);
  const remainingCount = selectedOptions.length - displayLimit;

  return (
    <div
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity cursor-pointer"
      onClick={onStartEdit}
    >
      <div className="flex flex-wrap gap-1">
        {visibleOptions.map((opt) => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
            style={{ backgroundColor: opt.color ? `${opt.color}20` : undefined }}
          >
            {opt.label}
            <button
              onClick={(e) => removeOption(opt.label, e)}
              className="hover:text-[var(--error)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--muted-foreground)]">
            +{remainingCount} more
          </span>
        )}
      </div>
    </div>
  );
}
