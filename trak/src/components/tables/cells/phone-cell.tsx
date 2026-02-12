"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { type TableField } from "@/types/table";
import { isValidPhone, formatPhoneNumber } from "@/lib/field-utils";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  initialValue?: string | null;
}

export function PhoneCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue }: Props) {
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

  useEffect(() => {
    if (!editing) return;
    if (initialValue === undefined || initialValue === null) return;
    setDraft(initialValue);
    setError("");
  }, [editing, initialValue]);

  const handleCommit = () => {
    if (!draft.trim()) {
      onCommit("");
      setError("");
      return;
    }

    const phone = draft.trim();
    if (!isValidPhone(phone)) {
      setError("Invalid phone number");
      return;
    }

    setError("");
    onCommit(phone);
  };

  if (editing) {
    return (
      <div className="w-full">
        <input
          ref={inputRef}
          type="tel"
          className={`w-full bg-[var(--surface)] border ${
            error ? 'border-[var(--error)]' : 'border-[var(--border-strong)]'
          } text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1`}
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
          placeholder="(555) 123-4567"
        />
        {error && (
          <div className="text-xs text-[var(--error)] mt-1">{error}</div>
        )}
      </div>
    );
  }

  const phoneString = String(value ?? "");

  if (!phoneString) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 w-full min-h-[18px]">
      <Phone className="h-3 w-3 text-[var(--muted-foreground)] flex-shrink-0" />
      <a
        href={`tel:${phoneString.replace(/\D/g, '')}`}
        className="text-xs text-[var(--foreground)] hover:text-[var(--primary)] truncate flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {formatPhoneNumber(phoneString)}
      </a>
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
