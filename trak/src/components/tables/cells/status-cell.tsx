"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { type TableField, type SelectFieldOption, type StatusFieldConfig } from "@/types/table";
import { usePropertyDefinition } from "@/lib/hooks/use-property-queries";

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

  // Fetch property definition if field is linked to one
  const fieldWithPropDef = field as TableField & { property_definition_id?: string };
  const { data: propertyDefinition } = usePropertyDefinition(fieldWithPropDef.property_definition_id);

  // Use property definition options if available, otherwise fall back to config
  const options = propertyDefinition?.options
    ? (propertyDefinition.options as SelectFieldOption[])
    : (config.options || []);

  // Disable inline option editing for canonical fields (managed at workspace level)
  const canEditOptions = !fieldWithPropDef.property_definition_id && onUpdateConfig;

  const [draft, setDraft] = useState<string | undefined>(typeof value === "string" ? value : undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

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
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        setDropdownOpen(false);
        onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, onCancel]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const maxHeight = 240;
      const width = Math.max(240, rect.width);
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUpward = spaceBelow < maxHeight && spaceAbove > spaceBelow;
      const height = Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow);
      const top = openUpward ? rect.top - height : rect.bottom;
      const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
      setDropdownStyle({
        position: "fixed",
        top,
        left,
        width,
        maxHeight: Math.max(120, height),
        zIndex: 60,
      });
    };

    updatePosition();
    const handleScroll = () => requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [dropdownOpen, options.length]);

  const handleAddOption = () => {
    if (!newOptionName.trim() || !canEditOptions) return;

    const newOption: SelectFieldOption = {
      id: `opt_${Date.now()}`,
      label: newOptionName.trim(),
      color: randomColor(),
    };

    const newConfig: StatusFieldConfig = {
      ...config,
      options: [...options, newOption],
    };

    onUpdateConfig?.(newConfig);
    setDraft(newOption.id);
    onCommit(newOption.id);
    setNewOptionName("");
    setDropdownOpen(false);
  };

  const handleDeleteOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEditOptions) return;

    const newConfig: StatusFieldConfig = {
      ...config,
      options: options.filter((opt) => opt.id !== optionId),
    };

    onUpdateConfig?.(newConfig);
    if (draft === optionId) {
      setDraft(undefined);
      onCommit(null);
    }
  };

  const selectedOption = options.find((opt) => opt.id === value);

  if (editing && dropdownOpen) {
    return (
      <>
        <div className="w-full min-h-[18px]" ref={anchorRef} />
        {dropdownStyle &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[4px] shadow-lg overflow-y-auto"
            >
              <div
                className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs text-[var(--muted-foreground)]"
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
                  className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs flex items-center gap-2 group"
                  onClick={() => {
                    setDraft(opt.id);
                    onCommit(opt.id);
                    setDropdownOpen(false);
                  }}
                >
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opt.color || "var(--muted-foreground)" }}
                  />
                  <span className="flex-1 text-[var(--foreground)]">{opt.label}</span>
                  {canEditOptions && (
                    <button
                      onClick={(e) => handleDeleteOption(opt.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {canEditOptions && (
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
            </div>,
            document.body
          )}
      </>
    );
  }

  if (!selectedOption) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 flex items-center gap-1"
        onClick={onStartEdit}
        disabled={saving}
      >
        {canEditOptions && <Plus className="h-3 w-3" />}
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
        className="inline-flex items-center gap-2 px-2 py-1 rounded-[4px] text-xs font-medium border border-[var(--border)]"
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
