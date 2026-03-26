"use client";

import { X } from "lucide-react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import type { FilterConfig } from "@/types/everything";
import type { EntityType, Status, Priority } from "@/types/properties";

interface EverythingFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; user_id?: string | null; name?: string | null; email?: string | null }>;
}

export function EverythingFilters({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  projects,
  members,
}: EverythingFiltersProps) {
  if (!isOpen) return null;

  const updateFilter = <K extends keyof FilterConfig>(
    key: K,
    value: FilterConfig[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-[var(--surface)] dark:bg-neutral-950 border-l border-neutral-300 dark:border-neutral-700 shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Filters
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-[var(--radius-md)] hover:bg-[var(--surface-muted)] dark:hover:bg-neutral-900"
            >
              <X className="h-5 w-5 text-[var(--tertiary-foreground)]" />
            </button>
          </div>
        </div>

        {/* Filter Sections */}
        <div className="p-6 space-y-6">
          {/* Entity Types */}
          <FilterSection
            title="Item Type"
            hasActive={(filters.entityTypes?.length ?? 0) > 0}
            onClear={() => updateFilter("entityTypes", undefined)}
          >
            <CheckboxGroup
              options={[
                { value: "timeline_event", label: "Timeline Events" },
                { value: "task", label: "Tasks" },
                { value: "subtask", label: "Subtasks" },
                { value: "table_row", label: "Table Rows" },
                { value: "block", label: "Blocks" },
              ]}
              selected={filters.entityTypes || []}
              onChange={(values) =>
                updateFilter("entityTypes", values as EntityType[])
              }
            />
          </FilterSection>

          {/* Status */}
          <FilterSection
            title="Status"
            hasActive={(filters.status?.length ?? 0) > 0}
            onClear={() => updateFilter("status", undefined)}
          >
            <CheckboxGroup
              options={STATUS_OPTIONS.map((s) => ({
                value: s.value,
                label: s.label,
                color: s.color,
              }))}
              selected={filters.status || []}
              onChange={(values) => updateFilter("status", values as Status[])}
            />
          </FilterSection>

          {/* Priority */}
          <FilterSection
            title="Priority"
            hasActive={(filters.priority?.length ?? 0) > 0}
            onClear={() => updateFilter("priority", undefined)}
          >
            <CheckboxGroup
              options={PRIORITY_OPTIONS.map((p) => ({
                value: p.value,
                label: p.label,
                color: p.color,
              }))}
              selected={filters.priority || []}
              onChange={(values) =>
                updateFilter("priority", values as Priority[])
              }
            />
          </FilterSection>

          {/* Assignees */}
          <FilterSection
            title="Assignee"
            hasActive={(filters.assigneeIds?.length ?? 0) > 0}
            onClear={() => updateFilter("assigneeIds", undefined)}
          >
            <CheckboxGroup
              options={members.map((m) => ({
                value: m.user_id ?? m.id,
                label: m.name || m.email || "Unknown",
              }))}
              selected={filters.assigneeIds || []}
              onChange={(values) => updateFilter("assigneeIds", values)}
            />
          </FilterSection>

          {/* Due Date Presets */}
          <FilterSection
            title="Due Date"
            hasActive={Boolean(filters.dueDatePreset)}
            onClear={() => updateFilter("dueDatePreset", undefined)}
          >
            <RadioGroup
              options={[
                { value: "", label: "Any" },
                { value: "overdue", label: "Overdue" },
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "this_week", label: "This Week" },
                { value: "next_week", label: "Next Week" },
                { value: "this_month", label: "This Month" },
                { value: "next_month", label: "Next Month" },
                { value: "no_date", label: "No Date" },
              ]}
              selected={filters.dueDatePreset || ""}
              onChange={(value) =>
                updateFilter(
                  "dueDatePreset",
                  value ? (value as any) : undefined
                )
              }
            />
          </FilterSection>

          {/* Projects */}
          {projects.length >= 1 && (
            <FilterSection
              title="Project"
              hasActive={(filters.projectIds?.length ?? 0) > 0}
              onClear={() => updateFilter("projectIds", undefined)}
            >
              <CheckboxGroup
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                selected={filters.projectIds || []}
                onChange={(values) => updateFilter("projectIds", values)}
              />
            </FilterSection>
          )}
        </div>
      </div>
    </>
  );
}

function FilterSection({
  title,
  onClear,
  hasActive,
  children,
}: {
  title: string;
  onClear?: () => void;
  hasActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h3>
        {hasActive && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded hover:bg-[var(--surface-muted)] dark:hover:bg-neutral-800 text-[var(--tertiary-foreground)] hover:text-neutral-700"
            aria-label={`Clear ${title} filter`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: Array<{ value: string; label: string; color?: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggleOption(option.value)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
          />
          {option.color && (
            <span
              className={`w-2 h-2 rounded-full bg-${option.color}-500`}
            />
          )}
          <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function RadioGroup({
  options,
  selected,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <input
            type="radio"
            checked={selected === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
