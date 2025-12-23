"use client";

import { useState } from "react";
import type { FilterCondition, SortCondition, TableField } from "@/types/table";

interface Props {
  fields: TableField[];
  sorts: SortCondition[];
  onSortChange: (sorts: SortCondition[]) => void;
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onSearch?: (q: string) => void;
  onColumnSearch?: (fieldId: string) => void;
}

export function TableToolbar({ fields, sorts, onSortChange, filters, onFiltersChange, onSearch, onColumnSearch }: Props) {
  const [search, setSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");

  const toggleSort = (fieldId: string) => {
    onSortChange((prev) => {
      const existing = prev.find((s) => s.fieldId === fieldId);
      if (!existing) return [{ fieldId, direction: "asc" }];
      if (existing.direction === "asc") return [{ fieldId, direction: "desc" }];
      return [];
    });
  };

  const addFilter = (fieldId: string) => {
    const next: FilterCondition = {
      fieldId,
      operator: "contains",
      value: "",
    };
    onFiltersChange([...filters, next]);
  };

  return (
    <div className="flex flex-col gap-2 px-3 py-3 border-b border-white/10 bg-white/10 backdrop-blur-md rounded-t-2xl">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg bg-slate-950/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 border border-white/10"
          placeholder="Search rows..."
          value={search}
          onChange={(e) => {
            const q = e.target.value;
            setSearch(q);
            onSearch?.(q);
          }}
        />
        <div className="relative">
          <input
            className="w-48 rounded-lg bg-slate-950/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 border border-white/10"
            placeholder="Jump to column..."
            value={columnSearch}
            onChange={(e) => {
              setColumnSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && columnSearch && onColumnSearch) {
                const matchingField = fields.find((f) =>
                  f.name.toLowerCase().includes(columnSearch.toLowerCase())
                );
                if (matchingField) {
                  onColumnSearch(matchingField.id);
                  // Keep the text in the input field
                }
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300">Sort</label>
          <select
            className="rounded-lg bg-slate-950/30 px-2 py-2 text-sm text-white border border-white/10"
            value={sorts[0]?.fieldId ?? ""}
            onChange={(e) => {
              const fid = e.target.value;
              if (!fid) return onSortChange([]);
              toggleSort(fid);
            }}
          >
            <option value="">None</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-200">
          {filters.map((f, idx) => {
            const field = fields.find((fld) => fld.id === f.fieldId);
            return (
              <div key={`${f.fieldId}-${idx}`} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <span className="font-semibold">{field?.name ?? "Field"}</span>
                <select
                  className="bg-transparent text-white outline-none"
                  value={f.operator}
                  onChange={(e) => {
                    const next = [...filters];
                    next[idx] = { ...f, operator: e.target.value as FilterCondition["operator"] };
                    onFiltersChange(next);
                  }}
                >
                  <option value="contains">contains</option>
                  <option value="equals">is</option>
                  <option value="not_equals">is not</option>
                  <option value="is_empty">is empty</option>
                  <option value="is_not_empty">is not empty</option>
                </select>
                {f.operator !== "is_empty" && f.operator !== "is_not_empty" && (
                  <input
                    className="bg-transparent text-white outline-none border-b border-white/20 text-xs"
                    value={String(f.value ?? "")}
                    onChange={(e) => {
                      const next = [...filters];
                      next[idx] = { ...f, value: e.target.value };
                      onFiltersChange(next);
                    }}
                  />
                )}
                <button
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    const next = filters.filter((_, i) => i !== idx);
                    onFiltersChange(next);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          className="rounded-lg bg-white/10 px-2 py-2 text-sm text-white"
          onChange={(e) => {
            if (!e.target.value) return;
            addFilter(e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="">Add filter</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          className="text-xs text-slate-300 hover:text-white"
          onClick={() => onFiltersChange([])}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
