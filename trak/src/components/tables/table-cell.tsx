"use client";

import { useEffect, useState, memo } from "react";
import { type TableField } from "@/types/table";
import { TextCell } from "./cells/text-cell";
import { LongTextCell } from "./cells/long-text-cell";
import { NumberCell } from "./cells/number-cell";
import { DateCell } from "./cells/date-cell";
import { SelectCell } from "./cells/select-cell";
import { MultiSelectCell } from "./cells/multi-select-cell";
import { UrlCell } from "./cells/url-cell";
import { EmailCell } from "./cells/email-cell";
import { PhoneCell } from "./cells/phone-cell";
import { CheckboxCell } from "./cells/checkbox-cell";
import { PersonCell } from "./cells/person-cell";
import { FilesCell } from "./cells/files-cell";
import { StatusCell } from "./cells/status-cell";
import { PriorityCell } from "./cells/priority-cell";
import { RelationCell } from "./cells/relation-cell";
import { RollupCell } from "./cells/rollup-cell";
import { FormulaCell } from "./cells/formula-cell";

type OnChange = (value: unknown) => void;

interface TableCellProps {
  field: TableField;
  value: unknown;
  onChange: OnChange;
  rowId: string;
  tableId: string;
  saving?: boolean;
  rowData?: Record<string, unknown>;
  // Optional props for complex field types
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  files?: Array<{ id: string; file_name: string; file_size: number; file_type: string; url?: string }>;
  relatedRecords?: Array<{ id: string; title: string }>;
  availableRecords?: Array<{ id: string; title: string }>;
  computedValue?: unknown;
  fieldMap?: Record<string, TableField>;
  onUploadFiles?: (files: File[]) => Promise<string[]>;
  onUpdateFieldConfig?: (config: any) => void;
  editRequest?: { rowId: string; fieldId: string; initialValue?: string };
  onEditRequestHandled?: () => void;
}

export const TableCell = memo(function TableCell({
  field,
  value,
  onChange,
  rowId,
  tableId,
  saving,
  rowData,
  workspaceMembers,
  files,
  relatedRecords,
  availableRecords,
  computedValue,
  fieldMap,
  onUploadFiles,
  onUpdateFieldConfig,
  editRequest,
  onEditRequestHandled,
}: TableCellProps) {
  const [editing, setEditing] = useState(false);
  const [initialValue, setInitialValue] = useState<string | null>(null);

  useEffect(() => {
    if (!editRequest) return;
    if (editRequest.rowId !== rowId || editRequest.fieldId !== field.id) return;
    setInitialValue(editRequest.initialValue ?? "");
    setEditing(true);
    onEditRequestHandled?.();
  }, [editRequest, field.id, onEditRequestHandled, rowId]);

  const commonProps = {
    value,
    editing,
    saving,
    onStartEdit: () => {
      setInitialValue(null);
      setEditing(true);
    },
    onCancel: () => {
      setInitialValue(null);
      setEditing(false);
    },
    onCommit: (val: unknown) => {
      setInitialValue(null);
      setEditing(false);
      onChange(val);
    },
  };

  switch (field.type) {
    case "long_text":
      return <LongTextCell {...commonProps} field={field} initialValue={initialValue} />;
    case "number":
      return <NumberCell {...commonProps} field={field} initialValue={initialValue} />;
    case "date":
      return <DateCell {...commonProps} field={field} />;
    case "checkbox":
      return <CheckboxCell {...commonProps} field={field} />;
    case "select":
      return <SelectCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "multi_select":
      return <MultiSelectCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "status":
      return <StatusCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "priority":
      return <PriorityCell {...commonProps} field={field} />;
    case "url":
      return <UrlCell {...commonProps} field={field} initialValue={initialValue} />;
    case "email":
      return <EmailCell {...commonProps} field={field} initialValue={initialValue} />;
    case "phone":
      return <PhoneCell {...commonProps} field={field} initialValue={initialValue} />;
    case "person":
      return <PersonCell {...commonProps} field={field} workspaceMembers={workspaceMembers} />;
    case "files":
      return <FilesCell {...commonProps} field={field} files={files} onUpload={onUploadFiles} />;
    case "relation":
      return <RelationCell {...commonProps} field={field} rowId={rowId} />;
    case "rollup":
      return <RollupCell field={field} value={value} rowId={rowId} tableId={tableId} fieldMap={fieldMap} />;
    case "formula":
      return <FormulaCell field={field} value={value} rowId={rowId} tableId={tableId} />;
    default:
      return <TextCell {...commonProps} field={field} initialValue={initialValue} />;
  }
});
