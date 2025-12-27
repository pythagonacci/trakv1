"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { type TableField } from "@/types/table";
import { isValidUrl, ensureHttps, getDisplayUrl } from "@/lib/field-utils";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
}

export function UrlCell({ value, editing, onStartEdit, onCommit, onCancel, saving }: Props) {
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value ?? ""));
    setError("");
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const handleCommit = () => {
    if (!draft.trim()) {
      onCommit("");
      setError("");
      return;
    }

    const urlWithProtocol = ensureHttps(draft.trim());
    if (!isValidUrl(urlWithProtocol)) {
      setError("Invalid URL");
      return;
    }

    setError("");
    onCommit(urlWithProtocol);
  };

  if (editing) {
    return (
      <div className="w-full">
        <input
          ref={inputRef}
          className={`w-full bg-[var(--surface)] border ${
            error ? 'border-[var(--error)]' : 'border-[var(--border-strong)]'
          } text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommit();
            }
            if (e.key === "Escape") {
              setDraft(String(value ?? ""));
              setError("");
              onCancel();
            }
          }}
          placeholder="https://example.com"
        />
        {error && (
          <div className="text-xs text-[var(--error)] mt-1">{error}</div>
        )}
      </div>
    );
  }

  const urlString = String(value ?? "");

  if (!urlString) {
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
    <div className="flex items-center gap-1.5 w-full min-h-[18px]">
      <a
        href={ensureHttps(urlString)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--primary)] hover:underline truncate flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {getDisplayUrl(urlString)}
      </a>
      <ExternalLink className="h-3 w-3 text-[var(--muted-foreground)] flex-shrink-0" />
      <button
        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onStartEdit}
        disabled={saving}
      >
        Edit
      </button>
    </div>
  );
}
