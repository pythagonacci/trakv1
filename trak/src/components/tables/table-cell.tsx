"use client";

import { useState, memo } from "react";
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
import { PersonCell } from "./cells/person-cell";
import { FilesCell } from "./cells/files-cell";
import { StatusCell } from "./cells/status-cell";
import { PriorityCell } from "./cells/priority-cell";

type OnChange = (value: unknown) => void;

interface TableCellProps {
  field: TableField;
  value: unknown;
  onChange: OnChange;
  saving?: boolean;
  rowData?: Record<string, unknown>;
  // Optional props for complex field types
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  files?: Array<{ id: string; file_name: string; file_size: number; file_type: string; url?: string }>;
  relatedRecords?: Array<{ id: string; title: string }>;
  availableRecords?: Array<{ id: string; title: string }>;
  computedValue?: unknown;
  onUploadFiles?: (files: File[]) => Promise<string[]>;
  onUpdateFieldConfig?: (config: any) => void;
}

export const TableCell = memo(function TableCell({
  field,
  value,
  onChange,
  saving,
  rowData,
  workspaceMembers,
  files,
  relatedRecords,
  availableRecords,
  computedValue,
  onUploadFiles,
  onUpdateFieldConfig,
}: TableCellProps) {
  const [editing, setEditing] = useState(false);

  const commonProps = {
    value,
    editing,
    saving,
    onStartEdit: () => setEditing(true),
    onCancel: () => setEditing(false),
    onCommit: (val: unknown) => {
      setEditing(false);
      onChange(val);
    },
  };

  switch (field.type) {
    case "long_text":
      return <LongTextCell {...commonProps} field={field} />;
    case "number":
      return <NumberCell {...commonProps} field={field} />;
    case "date":
      return <DateCell {...commonProps} field={field} />;
    case "checkbox": {
      const checked = value === true;
      return (
        <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={checked} readOnly />
          <span className="text-[var(--muted-foreground)] text-xs">Checkbox field type is read-only</span>
        </div>
      );
    }
    case "select":
      return <SelectCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "multi_select":
      return <MultiSelectCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "status":
      return <StatusCell {...commonProps} field={field} onUpdateConfig={onUpdateFieldConfig} />;
    case "priority":
      return <PriorityCell {...commonProps} field={field} />;
    case "url":
      return <UrlCell {...commonProps} field={field} />;
    case "email":
      return <EmailCell {...commonProps} field={field} />;
    case "phone":
      return <PhoneCell {...commonProps} field={field} />;
    case "person":
      return <PersonCell {...commonProps} field={field} workspaceMembers={workspaceMembers} />;
    case "files":
      return <FilesCell {...commonProps} field={field} files={files} onUpload={onUploadFiles} />;
    default:
      return <TextCell {...commonProps} field={field} />;
  }
});
