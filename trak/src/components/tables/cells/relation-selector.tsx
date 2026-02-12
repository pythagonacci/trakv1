"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTable } from "@/lib/hooks/use-table-queries";
import { getTableRows } from "@/app/actions/tables/query-actions";
import type { TableField, TableRow } from "@/types/table";

interface Props {
  field: TableField;
  currentLinks: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}

function getRelatedTableId(field: TableField) {
  const cfg = (field.config || {}) as Record<string, unknown>;
  return (cfg.relation_table_id as string | undefined) || (cfg.linkedTableId as string | undefined);
}

function getAllowMultiple(field: TableField) {
  const cfg = (field.config || {}) as Record<string, unknown>;
  return (cfg.allow_multiple as boolean | undefined) ?? (cfg.allowMultiple as boolean | undefined) ?? true;
}

function getLimit(field: TableField) {
  const cfg = (field.config || {}) as Record<string, unknown>;
  return typeof cfg.limit === "number" ? cfg.limit : undefined;
}

function getDisplayFieldId(field: TableField) {
  const cfg = (field.config || {}) as Record<string, unknown>;
  return (cfg.display_field_id as string | undefined) || (cfg.displayFieldId as string | undefined);
}

export function RelationSelector({ field, currentLinks, onSelect, onClose }: Props) {
  const relatedTableId = getRelatedTableId(field);
  const allowMultiple = getAllowMultiple(field);
  const limit = getLimit(field);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(currentLinks));
  const [rows, setRows] = useState<TableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 50;
  const { data: tableData } = useTable(relatedTableId || "", undefined);

  useEffect(() => {
    setSelected(new Set(currentLinks));
  }, [currentLinks]);

  useEffect(() => {
    if (!relatedTableId) return;
    setRows([]);
    setTotalRows(0);
    setHasMore(false);
    setLoading(true);
    getTableRows(relatedTableId, { limit: pageSize, offset: 0 })
      .then((result) => {
        if ("error" in result) {
          setRows([]);
          setTotalRows(0);
          setHasMore(false);
          return;
        }
        setRows(result.data.rows);
        setTotalRows(result.data.total);
        setHasMore(result.data.hasMore);
      })
      .finally(() => setLoading(false));
  }, [relatedTableId]);

  const handleLoadMore = async () => {
    if (!relatedTableId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await getTableRows(relatedTableId, { limit: pageSize, offset: rows.length });
    if (!("error" in result)) {
      const next = [...rows, ...result.data.rows];
      const deduped = Array.from(new Map(next.map((row) => [row.id, row])).values());
      setRows(deduped);
      setTotalRows(result.data.total);
      setHasMore(result.data.hasMore);
    }
    setLoadingMore(false);
  };

  const displayFieldId = useMemo(() => {
    const configured = getDisplayFieldId(field);
    const fields = tableData?.fields || [];
    if (configured) {
      const byId = fields.find((f) => f.id === configured);
      if (byId) return byId.id;
      const byName = fields.find((f) => f.name === configured);
      if (byName) return byName.id;
    }
    const primary = fields.find((f) => f.is_primary);
    if (primary) return primary.id;
    const textField = fields.find((f) => f.type === "text");
    if (textField) return textField.id;
    const longTextField = fields.find((f) => f.type === "long_text");
    if (longTextField) return longTextField.id;
    return fields[0]?.id || "";
  }, [field, tableData]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const value = row.data?.[displayFieldId] ?? "";
      return String(value).toLowerCase().includes(q);
    });
  }, [rows, search, displayFieldId]);

  const toggleRow = (rowId: string) => {
    if (!allowMultiple) {
      setSelected(new Set([rowId]));
      return;
    }
    const next = new Set(selected);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      if (limit && next.size >= limit) return;
      next.add(rowId);
    }
    setSelected(next);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select {field.name}</DialogTitle>
          <DialogDescription>Choose rows to link to this relation field</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-[var(--muted-foreground)]">
            {search
              ? `Showing ${filteredRows.length} of ${rows.length} loaded (filtered)`
              : `Showing ${rows.length} of ${totalRows} rows`}
          </div>
          <div className="max-h-80 overflow-y-auto border border-[var(--border)] rounded-[4px]">
            {loading && (
              <div className="p-4 text-xs text-[var(--muted-foreground)]">Loading rows...</div>
            )}
            {!loading && filteredRows.length === 0 && (
              <div className="p-4 text-xs text-[var(--muted-foreground)]">No rows found.</div>
            )}
            {!loading &&
              filteredRows.map((row) => {
                const value =
                  displayFieldId && row.data?.[displayFieldId] !== undefined
                    ? row.data?.[displayFieldId]
                    : row.id;
                const checked = selected.has(row.id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => toggleRow(row.id)}
                    className="w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-[var(--surface-hover)]"
                  >
                    <input
                      type={allowMultiple ? "checkbox" : "radio"}
                      checked={checked}
                      onChange={() => toggleRow(row.id)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="text-xs text-[var(--foreground)] truncate">{String(value || "Untitled")}</span>
                  </button>
                );
              })}
          </div>
          {hasMore && !search && (
            <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : `Load more (${pageSize})`}
            </Button>
          )}
          <div className="text-xs text-[var(--muted-foreground)]">
            {selected.size} selected{limit ? ` (max ${limit})` : ""}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSelect(Array.from(selected));
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
