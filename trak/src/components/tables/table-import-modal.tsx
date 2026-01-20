import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldType, TableField } from "@/types/table";

export type ImportColumnMapping = {
  columnIndex: number;
  columnName: string;
  mode: "field" | "new" | "skip";
  fieldId?: string;
  newFieldName?: string;
  newFieldType?: FieldType;
};

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const mapTargetLabel = (mapping: ImportColumnMapping, fields: TableField[]) => {
  if (mapping.mode === "skip") return "Skip column";
  if (mapping.mode === "new") return "Create new field";
  const match = fields.find((field) => field.id === mapping.fieldId);
  return match ? match.name : "Choose field";
};

interface TableImportModalProps {
  open: boolean;
  rowCount: number;
  columns: ImportColumnMapping[];
  fields: TableField[];
  previewRows: string[][];
  largePasteWarning?: boolean;
  loading?: boolean;
  onClose: () => void;
  onChange: (next: ImportColumnMapping[]) => void;
  onConfirm: () => void;
}

export function TableImportModal({
  open,
  rowCount,
  columns,
  fields,
  previewRows,
  largePasteWarning,
  loading,
  onClose,
  onChange,
  onConfirm,
}: TableImportModalProps) {
  const handleMappingChange = (index: number, nextValue: string) => {
    const next = [...columns];
    const mapping = { ...next[index] };
    if (nextValue === "skip") {
      mapping.mode = "skip";
      mapping.fieldId = undefined;
    } else if (nextValue === "new") {
      mapping.mode = "new";
      mapping.fieldId = undefined;
      mapping.newFieldName = mapping.newFieldName || mapping.columnName;
    } else if (nextValue.startsWith("field:")) {
      mapping.mode = "field";
      mapping.fieldId = nextValue.replace("field:", "");
    }
    next[index] = mapping;
    onChange(next);
  };

  const handleNewFieldName = (index: number, value: string) => {
    const next = [...columns];
    next[index] = { ...next[index], newFieldName: value };
    onChange(next);
  };

  const handleNewFieldType = (index: number, value: FieldType) => {
    const next = [...columns];
    next[index] = { ...next[index], newFieldType: value };
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl p-0">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <DialogHeader className="mb-0 space-y-1">
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              {rowCount} rows detected. Map columns to fields before importing.
            </DialogDescription>
          </DialogHeader>
          {largePasteWarning && (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Large paste detected. Import may take a moment to finish.
            </p>
          )}
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {columns.map((column, idx) => (
              <div key={column.columnIndex} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-4">
                  <p className="text-sm font-medium text-[var(--foreground)]">{column.columnName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Column {column.columnIndex + 1}</p>
                </div>
                <div className="col-span-4">
                  <Select
                    value={
                      column.mode === "skip"
                        ? "skip"
                        : column.mode === "new"
                          ? "new"
                          : column.fieldId
                            ? `field:${column.fieldId}`
                            : "skip"
                    }
                    onValueChange={(value) => handleMappingChange(idx, value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue>{mapTargetLabel(column, fields)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip column</SelectItem>
                      <SelectItem value="new">Create new field</SelectItem>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={`field:${field.id}`}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  {column.mode === "new" ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
                        value={column.newFieldName ?? ""}
                        onChange={(event) => handleNewFieldName(idx, event.target.value)}
                        placeholder="Field name"
                      />
                      <Select
                        value={column.newFieldType}
                        onValueChange={(value) => handleNewFieldType(idx, value as FieldType)}
                      >
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]"> </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4">
          <p className="text-sm font-semibold text-[var(--foreground)] mb-2">Preview (first 5 rows)</p>
          <div className="overflow-auto rounded-[4px] border border-[var(--border)]">
            <table className="min-w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.columnIndex} className="px-3 py-2 text-left font-medium text-[var(--foreground)]">
                      {column.columnName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={`preview-${rowIndex}`} className="border-t border-[var(--border)]">
                    {columns.map((column) => (
                      <td key={`${rowIndex}-${column.columnIndex}`} className="px-3 py-2 text-[var(--muted-foreground)]">
                        {row[column.columnIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="px-6 py-4">
          <button
            onClick={onClose}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center rounded-[2px] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--surface)] hover:bg-[var(--foreground)]/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Importing..." : `Import ${rowCount} rows`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
