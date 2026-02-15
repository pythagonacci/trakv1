"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Loader2, Trash2, X } from "lucide-react";
import type { TableField } from "@/types/table";
import { Button } from "@/components/ui/button";

interface Props {
  selectedCount: number;
  fields: TableField[];
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onUpdateField: (fieldId: string, value: unknown) => Promise<void> | void;
  onClearSelection: () => void;
}

function getEditableFields(fields: TableField[]) {
  const blocked = new Set(["formula", "rollup", "relation", "files", "person", "created_time", "last_edited_time", "created_by", "last_edited_by"]);
  return fields.filter((field) => !blocked.has(field.type));
}

function getFieldOptions(field: TableField) {
  const config = (field.config || {}) as Record<string, any>;
  if (field.type === "select" || field.type === "multi_select" || field.type === "status") {
    return Array.isArray(config.options) ? config.options : [];
  }
  if (field.type === "priority") {
    return Array.isArray(config.levels) ? config.levels : [];
  }
  return [];
}

export function BulkActionsToolbar({
  selectedCount,
  fields,
  onDelete,
  onDuplicate,
  onExport,
  onUpdateField,
  onClearSelection,
}: Props) {
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [textValue, setTextValue] = useState<string>("");
  const [booleanValue, setBooleanValue] = useState<boolean>(true);
  const [optionValue, setOptionValue] = useState<string>("");
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const editableFields = useMemo(() => getEditableFields(fields), [fields]);
  const selectedField = editableFields.find((field) => field.id === selectedFieldId) || null;
  const options = selectedField ? getFieldOptions(selectedField) : [];
  const isMulti = selectedField?.type === "multi_select";

  const resetEditor = () => {
    setTextValue("");
    setOptionValue("");
    setMultiValue([]);
    setBooleanValue(true);
  };

  const isValid = (() => {
    if (!selectedField) return false;
    switch (selectedField.type) {
      case "checkbox":
      case "subtask":
        return true;
      case "number":
        return textValue.trim() !== "" && !Number.isNaN(Number(textValue));
      case "date":
        return textValue.trim() !== "";
      case "select":
      case "status":
      case "priority":
        return optionValue.trim() !== "";
      case "multi_select":
        return multiValue.length > 0;
      case "long_text":
      case "text":
      case "url":
      case "email":
      case "phone":
      default:
        return textValue.trim() !== "";
    }
  })();

  if (selectedCount === 0) return null;

  const handleApply = async () => {
    if (!selectedField) return;
    let value: unknown = textValue;
    if (selectedField.type === "checkbox" || selectedField.type === "subtask") {
      value = booleanValue;
    }
    if (options.length > 0) {
      value = isMulti ? multiValue : optionValue || null;
    }
    if (selectedField.type === "number") {
      value = textValue === "" ? null : Number(textValue);
    }
    if (selectedField.type === "date") {
      value = textValue || null;
    }
    setApplying(true);
    try {
      await onUpdateField(selectedField.id, value);
      setSelectedFieldId("");
      resetEditor();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="h-4 w-px bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-[var(--error)]">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
      <div className="h-4 w-px bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
          value={selectedFieldId}
          onChange={(e) => {
            setSelectedFieldId(e.target.value);
            resetEditor();
          }}
        >
          <option value="">Update field...</option>
          {editableFields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </select>
        {selectedField && (
          <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {selectedField.type.replace("_", " ")}
          </span>
        )}
        {selectedField && options.length > 0 && !isMulti && (
          <select
            className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
            value={optionValue}
            onChange={(e) => setOptionValue(e.target.value)}
          >
            <option value="">Select...</option>
            {options.map((opt: any) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {selectedField && options.length > 0 && isMulti && (
          <select
            multiple
            className="h-20 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
            value={multiValue}
            onChange={(e) => {
              const next = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              setMultiValue(next);
            }}
          >
            {options.map((opt: any) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {selectedField && options.length === 0 && (selectedField.type === "checkbox" || selectedField.type === "subtask") && (
          <button
            type="button"
            className={`h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs ${
              booleanValue ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
            }`}
            onClick={() => setBooleanValue((prev) => !prev)}
          >
            {booleanValue ? "Checked" : "Unchecked"}
          </button>
        )}
        {selectedField &&
          options.length === 0 &&
          selectedField.type !== "checkbox" &&
          selectedField.type !== "subtask" &&
          selectedField.type !== "long_text" && (
            <input
              className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
              type={
                selectedField.type === "number"
                  ? "number"
                  : selectedField.type === "date"
                    ? "date"
                    : selectedField.type === "email"
                      ? "email"
                      : selectedField.type === "phone"
                        ? "tel"
                        : selectedField.type === "url"
                          ? "url"
                          : "text"
              }
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Value"
            />
          )}
        {selectedField && selectedField.type === "long_text" && (
          <textarea
            className="h-20 min-w-[200px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Enter text..."
          />
        )}
        <Button size="sm" onClick={handleApply} disabled={!isValid || applying}>
          {applying ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Applying
            </>
          ) : (
            `Apply to ${selectedCount} row${selectedCount === 1 ? "" : "s"}`
          )}
        </Button>
      </div>
    </div>
  );
}
