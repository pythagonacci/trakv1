"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { type TableField } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

type DateDraft = { start: string; end: string };

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_MIN_HEIGHT = 160;
const DROPDOWN_VIEWPORT_GAP = 8;
const DROPDOWN_Z_INDEX = 9999;

const toDateToken = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDraft = (value: unknown): DateDraft => {
  if (value === null || value === undefined || value === "") {
    return { start: "", end: "" };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) {
      return { start: rangeMatch[1], end: rangeMatch[2] };
    }
    const token = toDateToken(trimmed);
    return { start: token, end: token };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const start = toDateToken(obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null);
    const end = toDateToken(obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start);
    return {
      start,
      end: end || start,
    };
  }

  const token = toDateToken(value);
  return { start: token, end: token };
};

const formatTokenForDisplay = (token: string): string => {
  if (!token) return "";
  const [year, month, day] = token.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString();
};

const formatDisplay = (value: unknown): string => {
  const draft = toDraft(value);
  const start = draft.start;
  const end = draft.end;
  if (!start && !end) return "";
  if (start && end && start !== end) {
    return `${formatTokenForDisplay(start)} - ${formatTokenForDisplay(end)}`;
  }
  return formatTokenForDisplay(end || start);
};

const toCommitValue = (draft: DateDraft): unknown => {
  const start = draft.start.trim();
  const end = draft.end.trim();
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  if (start === end) return start;
  return { start, end };
};

export function DateCell({ value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const [draft, setDraft] = useState<DateDraft>(() => toDraft(value));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(toDraft(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [editing]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const rafId = requestAnimationFrame(() => startInputRef.current?.focus());
    return () => cancelAnimationFrame(rafId);
  }, [dropdownOpen]);

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
        onCommit(toCommitValue(draft));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [draft, dropdownOpen, onCommit]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.max(280, rect.width);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - DROPDOWN_VIEWPORT_GAP);
      const spaceAbove = Math.max(0, rect.top - DROPDOWN_VIEWPORT_GAP);
      const openUpward = spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow;
      const availableHeight = openUpward ? spaceAbove : spaceBelow;
      const height = Math.max(
        DROPDOWN_MIN_HEIGHT,
        Math.min(DROPDOWN_MAX_HEIGHT, availableHeight || DROPDOWN_MIN_HEIGHT)
      );
      const unclampedTop = openUpward ? rect.top - height : rect.bottom;
      const top = Math.min(
        Math.max(DROPDOWN_VIEWPORT_GAP, unclampedTop),
        Math.max(DROPDOWN_VIEWPORT_GAP, window.innerHeight - height - DROPDOWN_VIEWPORT_GAP)
      );
      const left = Math.min(
        Math.max(rect.left, DROPDOWN_VIEWPORT_GAP),
        window.innerWidth - width - DROPDOWN_VIEWPORT_GAP
      );

      setDropdownStyle({
        position: "fixed",
        top,
        left,
        width,
        maxHeight: height,
        zIndex: DROPDOWN_Z_INDEX,
      });
    };

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);
    const handleScroll = () => requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [dropdownOpen]);

  if (editing && dropdownOpen) {
    return (
      <>
        <div className="w-full min-h-[18px]" ref={anchorRef} />
        {dropdownStyle &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[4px] shadow-lg p-3 space-y-3 overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Start</span>
                  <input
                    ref={startInputRef}
                    type="date"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
                    value={draft.start}
                    onChange={(e) => setDraft((prev) => ({ ...prev, start: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDraft(toDraft(value));
                        setDropdownOpen(false);
                        onCancel();
                      }
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">End</span>
                  <input
                    type="date"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
                    value={draft.end}
                    onChange={(e) => setDraft((prev) => ({ ...prev, end: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setDropdownOpen(false);
                        onCommit(toCommitValue(draft));
                      }
                      if (e.key === "Escape") {
                        setDraft(toDraft(value));
                        setDropdownOpen(false);
                        onCancel();
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  onClick={() => {
                    const cleared = { start: "", end: "" };
                    setDraft(cleared);
                    setDropdownOpen(false);
                    onCommit(null);
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="h-7 px-3 inline-flex items-center justify-center rounded-[4px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs hover:bg-[var(--primary)]/90 transition-colors duration-150"
                  onClick={() => {
                    setDropdownOpen(false);
                    onCommit(toCommitValue(draft));
                  }}
                >
                  Apply
                </button>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  const display = formatDisplay(value);

  return (
    <button
      className="w-full text-left text-xs text-[var(--foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
      onClick={onStartEdit}
      disabled={saving}
    >
      {display}
    </button>
  );
}
