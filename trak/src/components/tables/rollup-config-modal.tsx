"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTable } from "@/lib/hooks/use-table-queries";
import type { FilterCondition, TableField } from "@/types/table";

interface Props {
  open: boolean;
  field: TableField | null;
  tableFields: TableField[];
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}

const AGGREGATIONS = [
  "count",
  "count_values",
  "count_unique",
  "count_empty",
  "percent_empty",
  "percent_not_empty",
  "sum",
  "average",
  "median",
  "min",
  "max",
  "range",
  "earliest_date",
  "latest_date",
  "date_range",
  "checked",
  "unchecked",
  "percent_checked",
  "show_unique",
  "show_original",
];

export function RollupConfigModal({ open, field, tableFields, onClose, onSave }: Props) {
  const relationFields = tableFields.filter((f) => f.type === "relation");
  const [relationFieldId, setRelationFieldId] = useState<string>("");
  const [targetFieldId, setTargetFieldId] = useState<string>("");
  const [aggregation, setAggregation] = useState<string>("count");
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterFieldId, setFilterFieldId] = useState<string>("");
  const [filterOperator, setFilterOperator] = useState<FilterCondition["operator"]>("equals");
  const [filterValue, setFilterValue] = useState<string>("");

  useEffect(() => {
    if (!field) return;
    const cfg = (field.config || {}) as Record<string, unknown>;
    setRelationFieldId((cfg.relation_field_id as string) || (cfg.relationFieldId as string) || "");
    setTargetFieldId((cfg.target_field_id as string) || (cfg.relatedFieldId as string) || "");
    setAggregation((cfg.aggregation as string) || "count");
    if (cfg.filter) {
      const filter = cfg.filter as any;
      setFilterEnabled(true);
      setFilterFieldId(filter.field_id || "");
      setFilterOperator(filter.operator || "equals");
      setFilterValue(filter.value ? String(filter.value) : "");
    } else {
      setFilterEnabled(false);
      setFilterFieldId("");
      setFilterValue("");
      setFilterOperator("equals");
    }
  }, [field, open]);

  const selectedRelationField = relationFields.find((f) => f.id === relationFieldId);
  const relatedTableId = useMemo(() => {
    if (!selectedRelationField) return "";
    const cfg = (selectedRelationField.config || {}) as Record<string, unknown>;
    return (cfg.relation_table_id as string) || (cfg.linkedTableId as string) || "";
  }, [selectedRelationField]);

  const { data: relatedTable } = useTable(relatedTableId || "", undefined);
  const relatedFields = relatedTable?.fields || [];

  const handleSave = () => {
    if (!relationFieldId || !targetFieldId) return;
    const nextConfig: Record<string, unknown> = {
      relation_field_id: relationFieldId,
      target_field_id: targetFieldId,
      aggregation,
    };
    if (filterEnabled && filterFieldId) {
      nextConfig.filter = {
        field_id: filterFieldId,
        operator: filterOperator,
        value: filterValue,
      };
    }
    onSave(nextConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure Rollup</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Relation field</label>
            <select
              className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
              value={relationFieldId}
              onChange={(e) => {
                setRelationFieldId(e.target.value);
                setTargetFieldId("");
              }}
            >
              <option value="">Select relation</option>
              {relationFields.map((rel) => (
                <option key={rel.id} value={rel.id}>
                  {rel.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Target field</label>
            <select
              className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
              value={targetFieldId}
              onChange={(e) => setTargetFieldId(e.target.value)}
              disabled={!relationFieldId}
            >
              <option value="">Select field</option>
              {relatedFields.map((relField) => (
                <option key={relField.id} value={relField.id}>
                  {relField.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[var(--muted-foreground)]">Aggregation</label>
            <select
              className="h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
            >
              {AGGREGATIONS.map((agg) => (
                <option key={agg} value={agg}>
                  {agg.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={filterEnabled}
                onChange={(e) => setFilterEnabled(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Apply filter
            </label>
            {filterEnabled && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select
                  className="h-9 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
                  value={filterFieldId}
                  onChange={(e) => setFilterFieldId(e.target.value)}
                >
                  <option value="">Field</option>
                  {relatedFields.map((relField) => (
                    <option key={relField.id} value={relField.id}>
                      {relField.name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value as FilterCondition["operator"])}
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="is_empty">is empty</option>
                  <option value="is_not_empty">is not empty</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                </select>
                <Input
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder="Value"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!relationFieldId || !targetFieldId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
