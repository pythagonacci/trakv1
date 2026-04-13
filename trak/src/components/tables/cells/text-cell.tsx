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
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function TextCell({ value, editing, onStartEdit, onCommit, onCancel, saving, initialValue, onContentResize, forceExpanded, expanded, onToggleExpanded }: Props) {
  const displayValue = String(value ?? "");
  const editSeed = initialValue ?? displayValue;
  const [draftState, setDraftState] = useState(() => ({
    seed: displayValue,
    value: displayValue,
    forceMultiline: false,
  }));
  const [localExpanded, setLocalExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextBlurCommitRef = useRef(false);
  const cellExpanded = expanded ?? localExpanded;
  const isExpanded = Boolean(forceExpanded || cellExpanded);
  const draft = editing && draftState.seed === editSeed ? draftState.value : editSeed;
  const forceMultilineEditor = editing && draftState.seed === editSeed && draftState.forceMultiline;
  const useMultilineEditor =
    forceMultilineEditor ||
    isExpanded ||
    draft.length > 80 ||
    draft.includes("\n") ||
    displayValue.includes("\n") ||
    Boolean(initialValue?.includes("\n"));

  const updateDraft = useCallback((nextValue: string, forceMultiline = forceMultilineEditor) => {
    setDraftState({
      seed: editSeed,
      value: nextValue,
      forceMultiline,
    });
  }, [editSeed, forceMultilineEditor]);

  const resetDraft = useCallback(() => {
    setDraftState({
      seed: displayValue,
      value: displayValue,
      forceMultiline: false,
    });
  }, [displayValue]);

  const requestContentResize = useCallback(() => {
    window.requestAnimationFrame(() => onContentResize?.());
  }, [onContentResize]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    requestContentResize();
  }, [requestContentResize]);

  useEffect(() => {
    requestContentResize();
  }, [forceExpanded, requestContentResize]);

  useEffect(() => {
    if (!editing) return;
    if (useMultilineEditor) {
      textareaRef.current?.focus();
      resizeTextarea();
    } else {
      inputRef.current?.focus();
    }
  }, [editing, resizeTextarea, useMultilineEditor]);

  useEffect(() => {
    if (!editing || !useMultilineEditor) return;
    resizeTextarea();
  }, [draft, editing, resizeTextarea, useMultilineEditor]);

  if (editing) {
    if (useMultilineEditor) {
      return (
        <textarea
          ref={textareaRef}
          className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1 resize-none overflow-hidden min-h-[80px] whitespace-pre-wrap"
          value={draft}
          onChange={(e) => {
            updateDraft(e.target.value, true);
            window.requestAnimationFrame(resizeTextarea);
          }}
          onBlur={() => onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onCommit(draft);
            }
            if (e.key === "Escape") {
              resetDraft();
              onCancel();
            }
          }}
          placeholder="Type text... (Cmd/Ctrl+Enter to save)"
        />
      );
    }

    return (
      <input
        ref={inputRef}
        className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
        value={draft}
        onChange={(e) => updateDraft(e.target.value)}
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData("text/plain");
          if (!/[\r\n]/.test(pastedText)) return;
          e.preventDefault();
          const start = e.currentTarget.selectionStart ?? draft.length;
          const end = e.currentTarget.selectionEnd ?? start;
          const normalizedText = pastedText.replace(/\r\n?/g, "\n");
          skipNextBlurCommitRef.current = true;
          updateDraft(`${draft.slice(0, start)}${normalizedText}${draft.slice(end)}`, true);
        }}
        onBlur={() => {
          if (skipNextBlurCommitRef.current) {
            skipNextBlurCommitRef.current = false;
            return;
          }
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === "Escape") {
            resetDraft();
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
        if (onToggleExpanded) {
          onToggleExpanded();
        } else {
          setLocalExpanded((current) => !current);
        }
        requestContentResize();
      }}
      onDoubleClick={() => {
        if (!onToggleExpanded) setLocalExpanded(false);
        requestContentResize();
        setDraftState({
          seed: displayValue,
          value: displayValue,
          forceMultiline: displayValue.length > 80 || displayValue.includes("\n"),
        });
        onStartEdit();
      }}
      disabled={saving}
      title={displayValue}
      aria-expanded={isExpanded}
    >
      {displayValue}
    </button>
  );
}
