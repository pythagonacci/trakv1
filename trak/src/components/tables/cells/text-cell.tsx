"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type TableField } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  initialValue?: string | null;
  onContentResize?: () => void;
  forceExpanded?: boolean;
}

export function TextCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue, onContentResize, forceExpanded }: Props) {
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isExpanded = Boolean(forceExpanded || expanded);

  const requestContentResize = useCallback(() => {
    window.requestAnimationFrame(() => onContentResize?.());
  }, [onContentResize]);

  useEffect(() => {
    requestContentResize();
  }, [forceExpanded, requestContentResize]);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    if (initialValue === undefined || initialValue === null) return;
    setDraft(initialValue);
  }, [editing, initialValue]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === "Escape") {
            setDraft(String(value ?? ""));
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <button
      className={`block w-full text-left text-xs text-[var(--foreground)] min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150 ${
        isExpanded ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : "truncate whitespace-nowrap"
      }`}
      onClick={() => {
        if (forceExpanded) return;
        setExpanded((current) => !current);
        requestContentResize();
      }}
      onDoubleClick={() => {
        setExpanded(false);
        requestContentResize();
        onStartEdit();
      }}
      disabled={saving}
      title={String(value ?? "")}
      aria-expanded={isExpanded}
    >
      {String(value ?? "")}
    </button>
  );
}
