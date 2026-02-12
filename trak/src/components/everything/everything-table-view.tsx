"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useUpdateEverythingItem } from "@/lib/hooks/use-everything-queries";
import { useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { ItemTypeIcon } from "./item-type-icon";
import { SourceTypeIcon } from "./source-type-icon";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import type { EverythingItem, SortConfig, SortField } from "@/types/everything";
import type { Status, Priority } from "@/types/properties";
import { format, parseISO } from "date-fns";
import { formatDueDateRange, getDueDateEnd, hasDueDate } from "@/lib/due-date";

interface EverythingTableViewProps {
  items: EverythingItem[];
  workspaceId: string;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
}

export function EverythingTableView({
  items,
  workspaceId,
  sort,
  onSortChange,
}: EverythingTableViewProps) {
  const { mutate: updateItem } = useUpdateEverythingItem(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      // Toggle direction
      onSortChange({
        field,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      // New field, default to ascending
      onSortChange({ field, direction: "asc" });
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sort.direction === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
            {/* Name Column */}
            <th className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900/50 px-4 py-3 text-left">
              <button
                onClick={() => handleSort("name")}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Name
                {getSortIcon("name")}
              </button>
            </th>

            {/* Source Column */}
            <th className="px-4 py-3 text-left min-w-[250px]">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Source
              </div>
            </th>

            {/* Assignee Column */}
            <th className="px-4 py-3 text-left min-w-[180px]">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Assignee
              </div>
            </th>

            {/* Status Column */}
            <th className="px-4 py-3 text-left min-w-[140px]">
              <button
                onClick={() => handleSort("status")}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Status
                {getSortIcon("status")}
              </button>
            </th>

            {/* Priority Column */}
            <th className="px-4 py-3 text-left min-w-[130px]">
              <button
                onClick={() => handleSort("priority")}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Priority
                {getSortIcon("priority")}
              </button>
            </th>

            {/* Due Date Column */}
            <th className="px-4 py-3 text-left min-w-[140px]">
              <button
                onClick={() => handleSort("due_date")}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Due Date
                {getSortIcon("due_date")}
              </button>
            </th>

            {/* Tags Column */}
            <th className="px-4 py-3 text-left min-w-[200px]">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Tags
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TableRowComponent
              key={item.id}
              item={item}
              workspaceId={workspaceId}
              members={members || []}
              onUpdate={updateItem}
            />
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
          No items to display
        </div>
      )}
    </div>
  );
}

interface TableRowComponentProps {
  item: EverythingItem;
  workspaceId: string;
  members: Array<{ id: string; name?: string | null; email?: string | null; avatar_url?: string | null }>;
  onUpdate: (params: { item: EverythingItem; updates: any }) => void;
}

function TableRowComponent({ item, workspaceId, members, onUpdate }: TableRowComponentProps) {
  return (
    <tr className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
      {/* Name Cell */}
      <td className="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-4 py-3">
        <Link
          href={item.source.url}
          className="flex items-center gap-2 group hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ItemTypeIcon type={item.type} className="h-4 w-4 text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-[300px]">
            {item.name}
          </span>
        </Link>
      </td>

      {/* Source Cell */}
      <td className="px-4 py-3">
        <Link
          href={item.source.url}
          className="flex items-center gap-2 group hover:text-blue-600 dark:hover:text-blue-400"
        >
          <SourceTypeIcon type={item.source.type} className="h-4 w-4 text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {item.source.tabName}
            </span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
              {item.source.name}
            </span>
          </div>
        </Link>
      </td>

      {/* Assignee Cell */}
      <td className="px-4 py-3">
        <AssigneeCell item={item} workspaceId={workspaceId} members={members} onUpdate={onUpdate} />
      </td>

      {/* Status Cell */}
      <td className="px-4 py-3">
        <StatusCell item={item} workspaceId={workspaceId} onUpdate={onUpdate} />
      </td>

      {/* Priority Cell */}
      <td className="px-4 py-3">
        <PriorityCell item={item} workspaceId={workspaceId} onUpdate={onUpdate} />
      </td>

      {/* Due Date Cell */}
      <td className="px-4 py-3">
        <DueDateCell item={item} workspaceId={workspaceId} onUpdate={onUpdate} />
      </td>

      {/* Tags Cell */}
      <td className="px-4 py-3">
        <TagsCell item={item} workspaceId={workspaceId} onUpdate={onUpdate} />
      </td>
    </tr>
  );
}

// Assignee Cell Component
function AssigneeCell({ item, members, onUpdate }: TableRowComponentProps) {
  const assignedMembers = members.filter((m) =>
    item.properties.assignee_ids.includes(m.id)
  );

  if (assignedMembers.length === 0) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {assignedMembers.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800"
          title={member.email || undefined}
        >
          {member.avatar_url && (
            <img
              src={member.avatar_url}
              alt={member.name || member.email || ""}
              className="h-4 w-4 rounded-full"
            />
          )}
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {member.name || member.email}
          </span>
        </div>
      ))}
    </div>
  );
}

// Status Cell Component
function StatusCell({ item, onUpdate }: Omit<TableRowComponentProps, "members">) {
  const [isEditing, setIsEditing] = useState(false);

  if (!item.properties.status) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  const statusOption = STATUS_OPTIONS.find((s) => s.value === item.properties.status);

  return (
    <div className="relative">
      <button
        onClick={() => setIsEditing(!isEditing)}
        className={`px-2 py-1 rounded-md text-sm font-medium ${
          statusOption
            ? `bg-${statusOption.color}-100 text-${statusOption.color}-700 dark:bg-${statusOption.color}-900/30 dark:text-${statusOption.color}-400`
            : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        }`}
      >
        {statusOption?.label || item.properties.status}
      </button>

      {isEditing && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-lg min-w-[140px]">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onUpdate({ item, updates: { status: option.value as Status } });
                setIsEditing(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full bg-${option.color}-500`}
              />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Priority Cell Component
function PriorityCell({ item, onUpdate }: Omit<TableRowComponentProps, "members">) {
  const [isEditing, setIsEditing] = useState(false);

  if (!item.properties.priority) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  const priorityOption = PRIORITY_OPTIONS.find((p) => p.value === item.properties.priority);

  return (
    <div className="relative">
      <button
        onClick={() => setIsEditing(!isEditing)}
        className={`px-2 py-1 rounded-md text-sm font-medium ${
          priorityOption
            ? `bg-${priorityOption.color}-100 text-${priorityOption.color}-700 dark:bg-${priorityOption.color}-900/30 dark:text-${priorityOption.color}-400`
            : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        }`}
      >
        {priorityOption?.label || item.properties.priority}
      </button>

      {isEditing && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-lg min-w-[130px]">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onUpdate({ item, updates: { priority: option.value as Priority } });
                setIsEditing(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full bg-${option.color}-500`}
              />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Due Date Cell Component
function DueDateCell({ item, onUpdate }: Omit<TableRowComponentProps, "members">) {
  if (!hasDueDate(item.properties.due_date)) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  try {
    const endDateIso = getDueDateEnd(item.properties.due_date);
    if (!endDateIso) return <span className="text-sm text-neutral-400">—</span>;
    const date = parseISO(endDateIso);
    const formatted = formatDueDateRange(item.properties.due_date, (iso) =>
      format(parseISO(iso), "MMM d, yyyy")
    );
    const today = new Date();
    const isOverdue = date < today && !isSameDay(date, today);
    const isToday = isSameDay(date, today);

    return (
      <span
        className={`text-sm ${
          isOverdue
            ? "text-red-600 dark:text-red-400 font-medium"
            : isToday
            ? "text-orange-600 dark:text-orange-400 font-medium"
            : "text-neutral-700 dark:text-neutral-300"
        }`}
      >
        {formatted}
      </span>
    );
  } catch (error) {
    return <span className="text-sm text-neutral-400">Invalid date</span>;
  }
}

// Tags Cell Component
function TagsCell({ item, onUpdate }: Omit<TableRowComponentProps, "members">) {
  if (item.properties.tags.length === 0) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {item.properties.tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// Helper function
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
