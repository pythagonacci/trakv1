"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfigureRelationField, useTable, useWorkspaceTables } from "@/lib/hooks/use-table-queries";
import type { TableField } from "@/types/table";

interface Props {
  open: boolean;
  field: TableField | null;
  tableId: string;
  workspaceId?: string | null;
  onClose: () => void;
}

function readConfigValue(field: TableField | null, key: string) {
  if (!field || !field.config) return undefined;
  return (field.config as any)[key];
}

export function RelationConfigModal({ open, field, tableId, workspaceId, onClose }: Props) {
  const { data: tables = [] } = useWorkspaceTables(workspaceId || undefined);
  const configureRelation = useConfigureRelationField(tableId);

  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [bidirectional, setBidirectional] = useState(false);
  const [reverseAllowMultiple, setReverseAllowMultiple] = useState(true);
  const [limit, setLimit] = useState<string>("");
  const [displayFieldId, setDisplayFieldId] = useState<string>("");
  const [reverseFieldName, setReverseFieldName] = useState<string>("");

  useEffect(() => {
    if (!field) return;
    const related =
      readConfigValue(field, "relation_table_id") ||
      readConfigValue(field, "linkedTableId") ||
      "";
    setSelectedTableId(String(related));
    const nextAllowMultiple =
      (readConfigValue(field, "allow_multiple") as boolean | undefined) ??
      (readConfigValue(field, "allowMultiple") as boolean | undefined) ??
      true;
    setAllowMultiple(nextAllowMultiple);
    setBidirectional(Boolean(readConfigValue(field, "bidirectional")));
    setLimit(readConfigValue(field, "limit") ? String(readConfigValue(field, "limit")) : "");
    setDisplayFieldId(
      (readConfigValue(field, "display_field_id") as string | undefined) ||
        (readConfigValue(field, "displayFieldId") as string | undefined) ||
        ""
    );
    setReverseFieldName("");
    const storedReverseAllow =
      (readConfigValue(field, "reverse_allow_multiple") as boolean | undefined) ??
      (readConfigValue(field, "reverseAllowMultiple") as boolean | undefined);
    setReverseAllowMultiple(storedReverseAllow ?? !nextAllowMultiple);
  }, [field, open]);

  const { data: relatedTable } = useTable(selectedTableId || "", undefined);
  const relatedFields = relatedTable?.fields || [];

  const displayOptions = useMemo(() => {
    return relatedFields.map((relField) => ({
      id: relField.id,
      name: relField.name,
    }));
  }, [relatedFields]);

  if (!field) return null;

  const handleSave = () => {
    if (!selectedTableId) return;
        configureRelation.mutate(
          {
            fieldId: field.id,
            name: field.name,
            relatedTableId: selectedTableId,
            allowMultiple,
            bidirectional,
            reverseAllowMultiple,
            limit: limit ? Number(limit) : undefined,
            displayFieldId: displayFieldId || undefined,
            reverseFieldName: reverseFieldName || undefined,
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure Relation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {configureRelation.error && (
            <div className="text-sm text-[var(--error)]">
              {configureRelation.error instanceof Error ? configureRelation.error.message : "Failed to save relation"}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Related table</label>
            <select
              className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              <option value="">Select table</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Allow multiple links
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Create reverse field
            </label>
            {bidirectional && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reverseAllowMultiple}
                  onChange={(e) => setReverseAllowMultiple(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Reverse allows multiple links
              </label>
            )}
          </div>

          {allowMultiple && (
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">Limit (optional)</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="No limit"
              />
            </div>
          )}

          {displayOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">Display field</label>
              <select
                className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
                value={displayFieldId}
                onChange={(e) => setDisplayFieldId(e.target.value)}
              >
                <option value="">Primary field</option>
                {displayOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {bidirectional && (
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">Reverse field name</label>
              <Input
                value={reverseFieldName}
                onChange={(e) => setReverseFieldName(e.target.value)}
                placeholder={`Related ${field.name}`}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedTableId || configureRelation.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
