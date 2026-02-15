"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { evaluateFormula } from "@/lib/formula-parser";
import type { TableField } from "@/types/table";

interface Props {
  open: boolean;
  field: TableField | null;
  tableFields: TableField[];
  onClose: () => void;
  onSave: (config: { formula: string; return_type: string }) => void;
}

export function FormulaConfigModal({ open, field, tableFields, onClose, onSave }: Props) {
  const [formula, setFormula] = useState("");
  const [returnType, setReturnType] = useState("text");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TableField[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchInfo, setMatchInfo] = useState<{ start: number; quote: string } | null>(null);
  const [testResult, setTestResult] = useState<{ value?: unknown; error?: string; sampleSummary?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!field) return;
    const cfg = (field.config || {}) as Record<string, unknown>;
    setFormula((cfg.formula as string) || "");
    setReturnType((cfg.return_type as string) || "text");
    setTestResult(null);
  }, [field, open]);

  const insertField = (name: string) => {
    const cursor = textareaRef.current?.selectionStart ?? formula.length;
    if (!matchInfo) {
      const before = formula.slice(0, cursor);
      const after = formula.slice(cursor);
      const snippet = `prop("${name}")`;
      const next = `${before}${snippet}${after}`;
      setFormula(next);
      setSuggestionsOpen(false);
      setTestResult(null);
      requestAnimationFrame(() => {
        const pos = (before + snippet).length;
        textareaRef.current?.setSelectionRange(pos, pos);
        textareaRef.current?.focus();
      });
      return;
    }

    const closeSeq = `${matchInfo.quote})`;
    const existingCloseIndex = formula.indexOf(closeSeq, matchInfo.start);
    const before = formula.slice(0, matchInfo.start);
    const after =
      existingCloseIndex !== -1 && existingCloseIndex >= cursor
        ? formula.slice(existingCloseIndex + closeSeq.length)
        : formula.slice(cursor);
    const next = `${before}${name}${closeSeq}${after}`;
    setFormula(next);
    setSuggestionsOpen(false);
    setTestResult(null);
    requestAnimationFrame(() => {
      const pos = (before + name + closeSeq).length;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  };

  const updateSuggestions = (text: string, cursor: number) => {
    const upto = text.slice(0, cursor);
    const doubleIdx = upto.lastIndexOf('prop("');
    const singleIdx = upto.lastIndexOf("prop('");
    const idx = Math.max(doubleIdx, singleIdx);
    if (idx === -1) {
      setSuggestionsOpen(false);
      setMatchInfo(null);
      return;
    }
    const quote = idx === singleIdx ? "'" : "\"";
    const start = idx + 6;
    const closing = upto.indexOf(quote, start);
    if (closing !== -1 && closing < cursor) {
      setSuggestionsOpen(false);
      setMatchInfo(null);
      return;
    }
    const query = upto.slice(start, cursor).toLowerCase();
    const matches = tableFields.filter((f) => f.name.toLowerCase().includes(query));
    if (matches.length === 0) {
      setSuggestionsOpen(false);
      setMatchInfo(null);
      return;
    }
    setSuggestions(matches);
    setActiveIndex(0);
    setMatchInfo({ start, quote });
    setSuggestionsOpen(true);
  };

  const buildSampleData = () => {
    const rowData: Record<string, unknown> = {};
    const summary: string[] = [];

    tableFields.forEach((f) => {
      let sample: unknown = "Sample";
      const cfg = (f.config || {}) as Record<string, any>;
      switch (f.type) {
        case "number":
          sample = 42;
          break;
        case "long_text":
          sample = "Lorem ipsum dolor sit amet";
          break;
        case "date":
          sample = new Date().toISOString().slice(0, 10);
          break;
        case "checkbox":
        case "subtask":
          sample = true;
          break;
        case "select":
        case "status":
          sample = cfg.options?.[0]?.label ?? cfg.options?.[0]?.id ?? "Option";
          break;
        case "priority":
          sample = cfg.levels?.[0]?.label ?? cfg.levels?.[0]?.id ?? "Priority";
          break;
        case "multi_select":
          sample = cfg.options?.slice(0, 2).map((opt: any) => opt.label ?? opt.id) ?? [];
          break;
        case "url":
          sample = "https://trak.so";
          break;
        case "email":
          sample = "team@trak.so";
          break;
        case "phone":
          sample = "+1 555 0100";
          break;
        default:
          sample = "Sample Text";
      }
      rowData[f.id] = sample;
      summary.push(`${f.name}=${Array.isArray(sample) ? sample.join(", ") : sample}`);
    });

    return { rowData, summary: summary.slice(0, 6).join(", ") };
  };

  const handleTest = () => {
    const { rowData, summary } = buildSampleData();
    const result = evaluateFormula(formula, rowData, tableFields);
    if (result.error) {
      setTestResult({ error: result.error, sampleSummary: summary });
      return;
    }
    setTestResult({ value: result.value, sampleSummary: summary });
  };

  const formattedTestValue = useMemo(() => {
    if (!testResult || testResult.error) return null;
    if (returnType === "number") {
      const num = Number(testResult.value);
      return Number.isNaN(num) ? String(testResult.value) : num.toLocaleString();
    }
    if (returnType === "date") {
      const date = new Date(String(testResult.value));
      return Number.isNaN(date.getTime()) ? String(testResult.value) : date.toLocaleDateString();
    }
    if (returnType === "boolean") {
      return testResult.value ? "true" : "false";
    }
    return String(testResult.value ?? "");
  }, [testResult, returnType]);

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Formula</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Formula</label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="w-full min-h-[160px] rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] font-mono"
                value={formula}
                onChange={(e) => {
                  setFormula(e.target.value);
                  setTestResult(null);
                  updateSuggestions(e.target.value, e.target.selectionStart || 0);
                }}
                onKeyDown={(e) => {
                  if (!suggestionsOpen) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev + 1) % suggestions.length);
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const selected = suggestions[activeIndex];
                    if (selected) insertField(selected.name);
                  }
                  if (e.key === "Escape") {
                    setSuggestionsOpen(false);
                    setMatchInfo(null);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setSuggestionsOpen(false), 100);
                }}
                placeholder='Example: prop("Hours") * prop("Rate")'
              />
              {suggestionsOpen && (
                <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-10">
                  {suggestions.map((f, idx) => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertField(f.name)}
                      className={`w-full px-3 py-2 text-left text-xs ${
                        idx === activeIndex ? "bg-[var(--surface-hover)]" : ""
                      }`}
                    >
                      <div className="text-[var(--foreground)]">{f.name}</div>
                      <div className="text-[var(--muted-foreground)]">{f.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Return type</label>
            <select
              className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
              value={returnType}
              onChange={(e) => setReturnType(e.target.value)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Insert field</label>
            <div className="flex flex-wrap gap-2">
              {tableFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => insertField(f.name)}
                  className="rounded-[2px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={!formula.trim()}>
              <FlaskConical className="h-3 w-3" />
              Test with sample data
            </Button>
          </div>
          {testResult && (
            <div
              className={`rounded-[2px] border px-3 py-2 text-xs ${
                testResult.error
                  ? "border-[var(--error)] text-[var(--error)]"
                  : "border-[var(--success)] text-[var(--success)]"
              }`}
            >
              {testResult.error ? (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">Formula Error</div>
                    <div className="text-[var(--muted-foreground)]">{testResult.error}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-semibold">Test Result: {formattedTestValue}</div>
                </div>
              )}
              {testResult.sampleSummary && (
                <div className="mt-1 text-[var(--muted-foreground)]">
                  Using sample data: {testResult.sampleSummary}
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-[var(--muted-foreground)]">
            Use prop("Field Name") to reference other fields.
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ formula, return_type: returnType })} disabled={!formula.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
