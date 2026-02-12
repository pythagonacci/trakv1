"use client";

import { useEffect, useRef, useState } from "react";
import { User, X } from "lucide-react";
import { type TableField } from "@/types/table";
import { formatUserDisplay } from "@/lib/field-utils";

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
}

export function PersonCell({
  value,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  saving,
  workspaceMembers = [],
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    typeof value === "string" ? value : undefined
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedUserId(typeof value === "string" ? value : undefined);
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

  const selectedUser = workspaceMembers.find((m) => m.id === selectedUserId);

  const filteredMembers = workspaceMembers.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = formatUserDisplay(member).toLowerCase();
    const email = member.email?.toLowerCase() || "";
    return name.includes(query) || email.includes(query);
  });

  if (editing && dropdownOpen) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <input
          type="text"
          className="w-full bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--foreground)] outline-none rounded-[4px] px-2 py-1"
          placeholder="Search people..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg z-10 max-h-60 overflow-y-auto">
          <div
            className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs text-[var(--muted-foreground)]"
            onClick={() => {
              setSelectedUserId(undefined);
              onCommit(null);
              setDropdownOpen(false);
            }}
          >
            Clear
          </div>
          {filteredMembers.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
              No members found
            </div>
          ) : (
            filteredMembers.map((member) => {
              const displayName = formatUserDisplay(member);
              const initials = displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={member.id}
                  className="px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer text-xs flex items-center gap-2"
                  onClick={() => {
                    setSelectedUserId(member.id);
                    onCommit(member.id);
                    setDropdownOpen(false);
                  }}
                >
                  <div className="h-6 w-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--foreground)] truncate">{displayName}</div>
                    {member.email && (
                      <div className="text-xs text-[var(--muted-foreground)] truncate">
                        {member.email}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  const displayName = formatUserDisplay(selectedUser);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity group"
      onClick={onStartEdit}
      disabled={saving}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-medium flex-shrink-0"
          title={selectedUser.email}
        >
          {initials}
        </div>
        <span className="text-xs text-[var(--foreground)] truncate flex-1">{displayName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCommit(null);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--error)]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </button>
  );
}
