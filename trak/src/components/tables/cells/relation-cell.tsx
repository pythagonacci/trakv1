"use client";

import { useEffect, useRef, useState } from "react";
import { Link, X } from "lucide-react";
import { type TableField, type RelationFieldConfig } from "@/types/table";

interface RelatedRecord {
  id: string;
  title: string;
}

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  relatedRecords?: RelatedRecord[];
  availableRecords?: RelatedRecord[];
}

export function RelationCell({
  field,
  value,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  saving,
  relatedRecords = [],
  availableRecords = [],
}: Props) {
  const config = (field.config || {}) as RelationFieldConfig;
  const allowMultiple = config.allowMultiple ?? false;

  const [selectedIds, setSelectedIds] = useState<string[]>(
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") :
    typeof value === "string" ? [value] : []
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIds(
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") :
      typeof value === "string" ? [value] : []
    );
  }, [value]);

  useEffect(() => {
    if (editing) {
      setDropdownOpen(true);
      setSearchQuery("");
    } else {
      setDropdownOpen(false);
    }
  }, [editing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, onCancel]);

  const filteredRecords = availableRecords.filter((record) => {
    if (!searchQuery) return true;
    return record.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleRecord = (recordId: string) => {
    if (allowMultiple) {
      const newIds = selectedIds.includes(recordId)
        ? selectedIds.filter((id) => id !== recordId)
        : [...selectedIds, recordId];
      setSelectedIds(newIds);
      onCommit(newIds);
    } else {
      setSelectedIds([recordId]);
      onCommit(recordId);
      setDropdownOpen(false);
    }
  };

  const removeRecord = (recordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== recordId);
    setSelectedIds(newIds);
    onCommit(allowMultiple ? newIds : (newIds[0] || null));
  };

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <input
          type="text"
          className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-sm text-[var(--foreground)] outline-none rounded-[2px] px-2 py-1"
          placeholder="Search records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] shadow-lg z-10 max-h-60 overflow-y-auto">
          <div
            className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm text-[var(--muted-foreground)]"
            onClick={() => {
              setSelectedIds([]);
              onCommit(allowMultiple ? [] : null);
              setDropdownOpen(false);
            }}
          >
            Clear
          </div>
          {filteredRecords.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
              No records found
            </div>
          ) : (
            filteredRecords.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              return (
                <div
                  key={record.id}
                  className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-sm flex items-center gap-2"
                  onClick={() => toggleRecord(record.id)}
                >
                  {allowMultiple && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded-[2px]"
                    />
                  )}
                  <Link className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="text-[var(--foreground)] truncate">{record.title}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (relatedRecords.length === 0) {
    return (
      <button
        className="w-full text-left text-sm text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  const displayLimit = 2;
  const visibleRecords = relatedRecords.slice(0, displayLimit);
  const remainingCount = relatedRecords.length - displayLimit;

  return (
    <button
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity group"
      onClick={onStartEdit}
      disabled={saving}
    >
      <div className="flex flex-wrap gap-1">
        {visibleRecords.map((record) => (
          <span
            key={record.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--primary)]"
          >
            <Link className="h-3 w-3" />
            {record.title}
            <button
              onClick={(e) => removeRecord(record.id, e)}
              className="hover:text-[var(--error)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--muted-foreground)]">
            +{remainingCount} more
          </span>
        )}
      </div>
    </button>
  );
}
