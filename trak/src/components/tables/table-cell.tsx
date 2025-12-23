"use client";

import { useState } from "react";
import { type TableField } from "@/types/table";
import { TextCell } from "./cells/text-cell";
import { NumberCell } from "./cells/number-cell";
import { DateCell } from "./cells/date-cell";
import { CheckboxCell } from "./cells/checkbox-cell";
import { SelectCell } from "./cells/select-cell";

type OnChange = (value: unknown) => void;

interface TableCellProps {
  field: TableField;
  value: unknown;
  onChange: OnChange;
  saving?: boolean;
}

export function TableCell({ field, value, onChange, saving }: TableCellProps) {
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
    case "number":
      return <NumberCell {...commonProps} field={field} />;
    case "date":
      return <DateCell {...commonProps} field={field} />;
    case "checkbox":
      return <CheckboxCell {...commonProps} field={field} />;
    case "select":
      return <SelectCell {...commonProps} field={field} />;
    default:
      return <TextCell {...commonProps} field={field} />;
  }
}
