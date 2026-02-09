"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { type TableField, type PriorityFieldConfig, type PriorityLevelConfig } from "@/types/table";
import { usePropertyDefinition } from "@/lib/hooks/use-property-queries";

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

  // Fetch property definition if field is linked to one
  const fieldWithPropDef = field as TableField & { property_definition_id?: string };
  const { data: propertyDefinition } = usePropertyDefinition(fieldWithPropDef.property_definition_id);

  // Use property definition options if available, otherwise fall back to config
  // Map canonical IDs to order: low=1, medium=2, high=3, urgent=4
  const levels = propertyDefinition?.options
    ? (propertyDefinition.options as Array<{ id: string; label: string; color: string }>).map((opt, idx) => {
        const order = opt.id === "low" ? 1 : opt.id === "medium" ? 2 : opt.id === "high" ? 3 : opt.id === "urgent" ? 4 : idx + 1;
        return {
          id: opt.id,
          label: opt.label,
          color: opt.color,
          order,
        } as PriorityLevelConfig;
      })
    : (config.levels || []);

  const [draft, setDraft] = useState<string | undefined>(typeof value === "string" ? value : undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  }, [dropdownOpen, levels.length]);

  const selectedLevel = levels.find((level) => level.id === value);
  const sortedLevels = [...levels].sort((a, b) => (b.order || 0) - (a.order || 0));

  if (editing && dropdownOpen) {
    return (
      <>
        <div className="w-full min-h-[18px]" ref={anchorRef} />
        {dropdownStyle &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[2px] shadow-lg overflow-y-auto"
            >
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
                  <div style={{ color: level.color || "var(--muted-foreground)" }}>
                    {getPriorityIcon(level.order || 0)}
                  </div>
                  <span className="text-[var(--foreground)]">{level.label}</span>
                </div>
              ))}
            </div>,
            document.body
          )}
      </>
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
