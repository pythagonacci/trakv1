"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { groupItems } from "@/lib/everything-grouping";
import { useUpdateEverythingItem } from "@/lib/hooks/use-everything-queries";
import { useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { ItemTypeIcon } from "./item-type-icon";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import type { EverythingItem, GroupByField } from "@/types/everything";
import type { Status, Priority } from "@/types/properties";
import { format, parseISO } from "date-fns";
import { formatDueDateRange, getDueDateEnd, hasDueDate } from "@/lib/due-date";

interface EverythingBoardViewProps {
  items: EverythingItem[];
  workspaceId: string;
  groupBy: GroupByField;
  onGroupByChange: (groupBy: GroupByField) => void;
}

export function EverythingBoardView({
  items,
  workspaceId,
  groupBy,
  onGroupByChange,
}: EverythingBoardViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const { mutate: updateItem } = useUpdateEverythingItem(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const groups = groupItems(items, groupBy, collapsedGroups);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div className="p-4">
      {/* Group By Selector */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Group by:
        </label>
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GroupByField)}
          className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
        >
          <option value="status">Status</option>
          <option value="priority">Priority</option>
          <option value="assignee">Assignee</option>
          <option value="due_date">Due Date</option>
          <option value="tags">Tags</option>
          <option value="project">Project</option>
          <option value="source_type">Source Type</option>
          <option value="entity_type">Entity Type</option>
        </select>
      </div>

      {/* Board Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex-shrink-0 w-80 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-800"
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800"
            >
              <div className="flex items-center gap-2">
                {group.collapsed ? (
                  <ChevronRight className="h-4 w-4 text-neutral-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                )}
                <span
                  className={`w-2 h-2 rounded-full bg-${group.color}-500`}
                />
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  {group.label}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {group.count}
                </span>
              </div>
            </button>

            {/* Group Items */}
            {!group.collapsed && (
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {group.items.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    members={members || []}
                    onUpdate={updateItem}
                  />
                ))}
                {group.items.length === 0 && (
                  <div className="py-8 text-center text-sm text-neutral-400">
                    No items
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface BoardCardProps {
  item: EverythingItem;
  members: Array<{
    id: string;
    user_id?: string | null;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  }>;
  onUpdate: (params: { item: EverythingItem; updates: any }) => void;
}

function BoardCard({ item, members, onUpdate }: BoardCardProps) {
  const assignedMembers = members.filter((m) => {
    const memberIds = [m.id, m.user_id].filter(Boolean) as string[];
    return memberIds.some((id) => item.properties.assignee_ids.includes(id));
  });

  return (
    <Link
      href={item.source.url}
      className="block p-3 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
    >
      {/* Title */}
      <div className="flex items-start gap-2 mb-2">
        <ItemTypeIcon type={item.type} className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />
        <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2">
          {item.name}
        </h3>
      </div>

      {/* Source */}
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {item.source.tabName} › {item.source.name}
      </div>

      {/* Properties */}
      <div className="space-y-2">
        {/* Status & Priority */}
        <div className="flex items-center gap-2">
          {item.properties.status && (
            <StatusBadge status={item.properties.status} />
          )}
          {item.properties.priority && (
            <PriorityBadge priority={item.properties.priority} />
          )}
        </div>

        {/* Due Date */}
        {hasDueDate(item.properties.due_date) && (
          <DueDateBadge dueDate={item.properties.due_date} />
        )}

        {/* Assignees */}
        {assignedMembers.length > 0 && (
          <div className="flex items-center gap-1">
            {assignedMembers.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs"
                title={member.email || undefined}
              >
                {member.avatar_url && (
                  <img
                    src={member.avatar_url}
                    alt={member.name || member.email || ""}
                    className="h-3 w-3 rounded-full"
                  />
                )}
                <span className="text-neutral-700 dark:text-neutral-300 truncate max-w-[100px]">
                  {member.name || member.email}
                </span>
              </div>
            ))}
            {assignedMembers.length > 3 && (
              <span className="text-xs text-neutral-500">
                +{assignedMembers.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {item.properties.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.properties.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs"
              >
                {tag}
              </span>
            ))}
            {item.properties.tags.length > 3 && (
              <span className="text-xs text-neutral-500">
                +{item.properties.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const option = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        option
          ? `bg-${option.color}-100 text-${option.color}-700 dark:bg-${option.color}-900/30 dark:text-${option.color}-400`
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      {option?.label || status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const option = PRIORITY_OPTIONS.find((p) => p.value === priority);
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        option
          ? `bg-${option.color}-100 text-${option.color}-700 dark:bg-${option.color}-900/30 dark:text-${option.color}-400`
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      {option?.label || priority}
    </span>
  );
}

function DueDateBadge({ dueDate }: { dueDate: EverythingItem["properties"]["due_date"] }) {
  try {
    const endDateIso = getDueDateEnd(dueDate);
    if (!endDateIso) return null;
    const date = parseISO(endDateIso);
    const formatted = formatDueDateRange(dueDate, (iso) => format(parseISO(iso), "MMM d"));
    const today = new Date();
    const isOverdue = date < today && !isSameDay(date, today);
    const isToday = isSameDay(date, today);

    return (
      <div
        className={`text-xs ${
          isOverdue
            ? "text-red-600 dark:text-red-400 font-medium"
            : isToday
            ? "text-orange-600 dark:text-orange-400 font-medium"
            : "text-neutral-600 dark:text-neutral-400"
        }`}
      >
        📅 {formatted}
      </div>
    );
  } catch (error) {
    return null;
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
