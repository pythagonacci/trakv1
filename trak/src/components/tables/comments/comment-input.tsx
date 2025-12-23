"use client";

import { useState } from "react";

interface Props {
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

export function CommentInput({ onSubmit, onCancel, submitting }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full rounded-[2px] bg-[var(--surface)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--border-strong)]"
        rows={3}
        placeholder="Add a comment..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end gap-2 text-sm">
        {onCancel && (
          <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="px-3 py-1 rounded-[2px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors duration-150"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
