"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusValue = "todo" | "in_progress" | "done" | "blocked";
type PriorityValue = "low" | "medium" | "high" | "urgent" | null;
type GroupBy = "status" | "priority" | "assignee";

export interface RollupTask {
  id: string;
  status: StatusValue;
  statuses: Array<{ field_name: string; value: string }>;
  priorities: Array<{ field_name: string; value: string | null }>;
  assigneeIds: string[];
}

// A filter step: "where [groupBy] = [value]"
interface FilterStep {
  groupBy: GroupBy;
  value: string;
  label: string;
}

// currentGroupBy === null means "intermediate state":
// the user clicked a segment to filter down, but hasn't yet chosen the next groupBy.
// The bar renders as a single colored stripe (portion of all tasks).
interface BarConfig {
  id: string;
  filters: FilterStep[];
  currentGroupBy: GroupBy | null;
  // When true, bar widths are shown as % of ALL tasks (not just the filtered n-1 set)
  showAsPortionOfAll: boolean;
}

interface Segment {
  value: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface Props {
  tasks: RollupTask[];
  getMemberName: (id: string) => string | undefined;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusValue, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<StatusValue, string> = {
  todo: "var(--muted-foreground)",
  in_progress: "var(--primary)",
  done: "var(--success)",
  blocked: "var(--error)",
};

const PRIORITY_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_COLORS: Record<string, string> = {
  none: "white",
  None: "white",
  low: "var(--muted-foreground)",
  medium: "var(--warning)",
  high: "var(--tile-orange)",
  urgent: "var(--error)",
};

const ASSIGNEE_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--tile-orange)",
  "var(--warning)",
  "var(--secondary)",
];

const GROUPBY_LABELS: Record<GroupBy, string> = {
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
};

const STATUS_ORDER: StatusValue[] = ["todo", "in_progress", "done", "blocked"];
const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSegmentLabel(value: string, groupBy: GroupBy, getMemberName: (id: string) => string | undefined): string {
  if (groupBy === "status") return STATUS_LABELS[value as StatusValue] ?? value;
  if (groupBy === "priority") return PRIORITY_LABELS[value] ?? value;
  if (groupBy === "assignee") {
    if (value === "unassigned") return "Unassigned";
    return getMemberName(value) ?? value;
  }
  return value;
}

function getSegmentColor(value: string, groupBy: GroupBy, assigneeIndex: number): string {
  if (groupBy === "status") return STATUS_COLORS[value as StatusValue] ?? "var(--muted-foreground)";
  if (groupBy === "priority") {
    const key = (value === "None" || value === "none" || !value) ? "none" : value;
    return PRIORITY_COLORS[key] ?? "var(--muted-foreground)";
  }
  if (groupBy === "assignee") return ASSIGNEE_COLORS[assigneeIndex % ASSIGNEE_COLORS.length];
  return "var(--muted-foreground)";
}

function matchesFilter(task: RollupTask, groupBy: GroupBy, value: string): boolean {
  if (groupBy === "status") return task.status === value;
  if (groupBy === "priority") return (task.priorities?.[0]?.value ?? "none") === value;
  if (groupBy === "assignee") {
    if (value === "unassigned") return task.assigneeIds.length === 0;
    return task.assigneeIds.includes(value);
  }
  return false;
}

function applyFilters(tasks: RollupTask[], filters: FilterStep[]): RollupTask[] {
  return filters.reduce((acc, f) => acc.filter((t) => matchesFilter(t, f.groupBy, f.value)), tasks);
}

function computeSegments(
  tasks: RollupTask[],
  groupBy: GroupBy,
  getMemberName: (id: string) => string | undefined,
  // denominator controls bar widths — defaults to tasks.length (the filtered set)
  denominator?: number
): Segment[] {
  const groups = new Map<string, number>();

  if (groupBy === "status") {
    tasks.forEach((t) => groups.set(t.status, (groups.get(t.status) ?? 0) + 1));
  } else if (groupBy === "priority") {
    tasks.forEach((t) => {
      const key = t.priorities?.[0]?.value ?? "none";
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });
  } else if (groupBy === "assignee") {
    tasks.forEach((t) => {
      if (t.assigneeIds.length === 0) {
        groups.set("unassigned", (groups.get("unassigned") ?? 0) + 1);
      } else {
        t.assigneeIds.forEach((id) => groups.set(id, (groups.get(id) ?? 0) + 1));
      }
    });
  }

  const total = denominator ?? tasks.length;

  const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
    if (groupBy === "status") return STATUS_ORDER.indexOf(a as StatusValue) - STATUS_ORDER.indexOf(b as StatusValue);
    if (groupBy === "priority") return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
    return 0;
  });

  let assigneeIdx = 0;
  return sorted.map(([value, count]) => {
    const idx = groupBy === "assignee" ? assigneeIdx++ : 0;
    return {
      value,
      label: getSegmentLabel(value, groupBy, getMemberName),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: getSegmentColor(value, groupBy, idx),
    };
  });
}

// ─── Helpers for available values in a step ───────────────────────────────────

function getAvailableValues(
  tasks: RollupTask[],
  groupBy: GroupBy,
  getMemberName: (id: string) => string | undefined
): { value: string; label: string }[] {
  const seen = new Set<string>();
  if (groupBy === "status") {
    tasks.forEach((t) => seen.add(t.status));
    return STATUS_ORDER.filter((s) => seen.has(s)).map((s) => ({
      value: s,
      label: STATUS_LABELS[s],
    }));
  }
  if (groupBy === "priority") {
    tasks.forEach((t) => seen.add(t.priorities?.[0]?.value ?? "none"));
    return PRIORITY_ORDER.filter((p) => seen.has(p)).map((p) => ({
      value: p,
      label: PRIORITY_LABELS[p],
    }));
  }
  // assignee
  tasks.forEach((t) => {
    if (t.assigneeIds.length === 0) seen.add("unassigned");
    else t.assigneeIds.forEach((id) => seen.add(id));
  });
  return Array.from(seen).map((id) => ({
    value: id,
    label: id === "unassigned" ? "Unassigned" : (getMemberName(id) ?? id),
  }));
}

// ─── Shared dropdown ──────────────────────────────────────────────────────────

function Dropdown({
  options,
  activeValue,
  onSelect,
  onClose,
}: {
  options: { value: string; label: string }[];
  activeValue?: string;
  onSelect: (value: string, label: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-1 min-w-[130px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onSelect(opt.value, opt.label); onClose(); }}
            className={`w-full px-2.5 py-1 text-left text-[10px] transition-colors hover:bg-[var(--surface-hover)] ${
              activeValue === opt.value
                ? "font-medium text-[var(--foreground)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── RollupBar ────────────────────────────────────────────────────────────────

type OpenDropdown =
  | { kind: "filterGroupBy"; index: number }
  | { kind: "filterValue"; index: number }
  | { kind: "currentGroupBy" }
  | { kind: "nextGroupBy" }
  | null;

function RollupBar({
  config,
  tasks,
  getMemberName,
  onUpdate,
  onRemove,
  showRemove,
}: {
  config: BarConfig;
  tasks: RollupTask[];
  getMemberName: (id: string) => string | undefined;
  onUpdate: (config: BarConfig) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const [open, setOpen] = useState<OpenDropdown>(null);

  const filteredTasks = useMemo(
    () => applyFilters(tasks, config.filters),
    [tasks, config.filters]
  );

  const isFiltered = config.filters.length > 0;
  // Intermediate state: user has drilled into a value but hasn't picked next groupBy yet
  const isIntermediate = config.currentGroupBy === null;

  // When "show as portion of all" is on, bar widths are relative to all tasks
  const denominator = config.showAsPortionOfAll ? tasks.length : undefined;

  // Normal segments (only when we have a groupBy to display)
  const segments = useMemo(
    () =>
      config.currentGroupBy
        ? computeSegments(filteredTasks, config.currentGroupBy, getMemberName, denominator)
        : [],
    [filteredTasks, config.currentGroupBy, getMemberName, denominator]
  );

  // Intermediate bar: colored stripe for the last filter's value, rest white
  const lastFilter = config.filters[config.filters.length - 1];
  const intermediateColor = isIntermediate && lastFilter
    ? getSegmentColor(lastFilter.value, lastFilter.groupBy, 0)
    : undefined;
  const intermediatePct = tasks.length > 0 ? (filteredTasks.length / tasks.length) * 100 : 0;

  // The remainder when showAsPortionOfAll is on
  const filledPct = config.showAsPortionOfAll
    ? (filteredTasks.length / tasks.length) * 100
    : 100;

  const denominatorLabel = isFiltered
    ? `${filteredTasks.length} of ${tasks.length}`
    : `${tasks.length}`;

  // Clicking a segment: lock in that value as a filter, enter intermediate state
  const handleSegmentClick = (seg: Segment) => {
    onUpdate({
      ...config,
      filters: [
        ...config.filters,
        { groupBy: config.currentGroupBy!, value: seg.value, label: seg.label },
      ],
      currentGroupBy: null, // intermediate — user picks next groupBy via "then by"
    });
  };

  // Remove filter at index i and everything after it; restore groupBy from that step
  const removeFilterFrom = (i: number) => {
    onUpdate({
      ...config,
      filters: config.filters.slice(0, i),
      currentGroupBy: config.filters[i].groupBy,
    });
  };

  // Change the groupBy of a filter step (clears its value and all subsequent steps)
  const changeFilterGroupBy = (i: number, newGroupBy: GroupBy) => {
    const newFilters = config.filters.slice(0, i);
    onUpdate({ ...config, filters: newFilters, currentGroupBy: newGroupBy });
  };

  // Change the selected value of a filter step (keeps subsequent steps)
  const changeFilterValue = (i: number, newValue: string, newLabel: string) => {
    const newFilters = config.filters.map((f, idx) =>
      idx === i ? { ...f, value: newValue, label: newLabel } : f
    );
    onUpdate({ ...config, filters: newFilters });
  };

  const groupByOptions = (["status", "priority", "assignee"] as GroupBy[]).map((g) => ({
    value: g,
    label: GROUPBY_LABELS[g],
  }));

  return (
    <div className="select-none">
      {/* ── Chain row ── */}
      <div className="mb-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">

        {/* Root: "All Tasks" — resets the chain */}
        <button
          onClick={() =>
            onUpdate({
              ...config,
              filters: [],
              currentGroupBy: config.filters[0]?.groupBy ?? config.currentGroupBy ?? "status",
            })
          }
          className={`text-[10px] transition-colors ${
            isFiltered
              ? "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              : "font-medium text-[var(--foreground)]"
          }`}
        >
          All Tasks
        </button>

        {/* Filter steps already locked in */}
        {config.filters.map((filter, i) => {
          const tasksBeforeStep = applyFilters(tasks, config.filters.slice(0, i));
          const valueOptions = getAvailableValues(tasksBeforeStep, filter.groupBy, getMemberName);

          return (
            <span key={i} className="contents">
              <span className="text-[10px] text-[var(--muted-foreground)]">·</span>

              {/* GroupBy chip for this filter step */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpen(
                      open?.kind === "filterGroupBy" && open.index === i
                        ? null
                        : { kind: "filterGroupBy", index: i }
                    )
                  }
                  className="inline-flex items-center gap-0.5 rounded-[4px] px-1 py-0.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  {GROUPBY_LABELS[filter.groupBy]}
                  <ChevronDown className="h-2 w-2" />
                </button>
                {open?.kind === "filterGroupBy" && open.index === i && (
                  <Dropdown
                    options={groupByOptions}
                    activeValue={filter.groupBy}
                    onSelect={(v) => changeFilterGroupBy(i, v as GroupBy)}
                    onClose={() => setOpen(null)}
                  />
                )}
              </div>

              <span className="text-[10px] text-[var(--muted-foreground)]">·</span>

              {/* Value chip for this filter step */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpen(
                      open?.kind === "filterValue" && open.index === i
                        ? null
                        : { kind: "filterValue", index: i }
                    )
                  }
                  className="inline-flex items-center gap-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] pl-1.5 pr-1 py-0.5 text-[10px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {filter.label}
                  <ChevronDown className="h-2 w-2 text-[var(--muted-foreground)]" />
                </button>
                {open?.kind === "filterValue" && open.index === i && (
                  <Dropdown
                    options={valueOptions}
                    activeValue={filter.value}
                    onSelect={(v, label) => changeFilterValue(i, v, label)}
                    onClose={() => setOpen(null)}
                  />
                )}
                <button
                  onClick={() => removeFilterFrom(i)}
                  className="ml-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  <X className="h-2 w-2" />
                </button>
              </div>
            </span>
          );
        })}

        <span className="text-[10px] text-[var(--muted-foreground)]">·</span>

        {/* Current groupBy chip — or "then by" prompt in intermediate state */}
        {!isIntermediate ? (
          <div className="relative">
            <button
              onClick={() =>
                setOpen(open?.kind === "currentGroupBy" ? null : { kind: "currentGroupBy" })
              }
              className="inline-flex items-center gap-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              {GROUPBY_LABELS[config.currentGroupBy!]}
              <ChevronDown className="h-2.5 w-2.5 text-[var(--muted-foreground)]" />
            </button>
            {open?.kind === "currentGroupBy" && (
              <Dropdown
                options={groupByOptions}
                activeValue={config.currentGroupBy!}
                onSelect={(v) => onUpdate({ ...config, currentGroupBy: v as GroupBy })}
                onClose={() => setOpen(null)}
              />
            )}
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() =>
                setOpen(open?.kind === "nextGroupBy" ? null : { kind: "nextGroupBy" })
              }
              className="inline-flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              then by
              <ChevronDown className="h-2 w-2" />
            </button>
            {open?.kind === "nextGroupBy" && (
              <Dropdown
                options={groupByOptions}
                onSelect={(v) => onUpdate({ ...config, currentGroupBy: v as GroupBy })}
                onClose={() => setOpen(null)}
              />
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Toggle: show as portion of all tasks — only in non-intermediate filtered state */}
          {isFiltered && !isIntermediate && (
            <button
              onClick={() => onUpdate({ ...config, showAsPortionOfAll: !config.showAsPortionOfAll })}
              className={`rounded-[4px] px-1.5 py-0.5 text-[10px] transition-colors ${
                config.showAsPortionOfAll
                  ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              % of all
            </button>
          )}
          {showRemove && (
            <button
              onClick={onRemove}
              className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Bar ── */}
      {tasks.length === 0 ? (
        <div className="h-3 w-full rounded-full bg-[var(--surface-muted)]" />
      ) : isIntermediate ? (
        /* Intermediate: single colored stripe showing filtered / all */
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full"
            style={{
              width: `${intermediatePct}%`,
              backgroundColor: intermediateColor,
              minWidth: intermediatePct > 0 ? "2px" : "0",
            }}
          />
        </div>
      ) : (
        /* Normal: colored segments, clickable to drill in */
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          {segments.map((seg) => (
            <button
              key={seg.value}
              onClick={() => handleSegmentClick(seg)}
              title={`${seg.label}: ${seg.count} (${Math.round(seg.percentage)}%) — click to drill in`}
              className="h-full cursor-pointer transition-opacity hover:opacity-75"
              style={{
                width: `${seg.percentage}%`,
                backgroundColor: seg.color,
                minWidth: seg.percentage > 0 ? "2px" : "0",
              }}
            />
          ))}
          {/* Gray remainder — only visible when showAsPortionOfAll and there are filters */}
          {config.showAsPortionOfAll && isFiltered && (
            <div
              className="h-full"
              style={{ width: `${100 - filledPct}%`, backgroundColor: "var(--surface-muted)" }}
            />
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {isIntermediate ? (
        /* Intermediate legend: just the filtered count */
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
          {intermediateColor && (
            <span
              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: intermediateColor }}
            />
          )}
          <span className="font-medium text-[var(--foreground)]">{lastFilter?.label}</span>
          <span className="font-medium text-[var(--foreground)]">{filteredTasks.length}</span>
          <span>[{denominatorLabel}]</span>
        </div>
      ) : (
        /* Normal legend: one entry per segment */
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {segments.map((seg) => (
            <button
              key={seg.value}
              onClick={() => handleSegmentClick(seg)}
              title="Click to drill in"
              className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <span
                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              {seg.label}
              <span className="font-medium text-[var(--foreground)]">{seg.count}</span>
            </button>
          ))}
          <span className="text-[10px] text-[var(--muted-foreground)]">[{denominatorLabel}]</span>
        </div>
      )}
    </div>
  );
}

// ─── TaskRollupBar (root) ─────────────────────────────────────────────────────

export function TaskRollupBar({ tasks, getMemberName }: Props) {
  const [bars, setBars] = useState<BarConfig[]>([
    { id: "default", filters: [], currentGroupBy: "status", showAsPortionOfAll: false },
  ]);

  const updateBar = useCallback((id: string, next: BarConfig) => {
    setBars((prev) => prev.map((b) => (b.id === id ? next : b)));
  }, []);

  const removeBar = useCallback((id: string) => {
    setBars((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addBar = useCallback(() => {
    setBars((prev) => [
      ...prev,
      { id: `bar-${Date.now()}`, filters: [], currentGroupBy: "status", showAsPortionOfAll: false },
    ]);
  }, []);

  if (tasks.length === 0) return null;

  return (
    <div className="mt-1 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
      {bars.map((bar, i) => (
        <RollupBar
          key={bar.id}
          config={bar}
          tasks={tasks}
          getMemberName={getMemberName}
          onUpdate={(next) => updateBar(bar.id, next)}
          onRemove={() => removeBar(bar.id)}
          showRemove={i > 0}
        />
      ))}
      <button
        onClick={addBar}
        className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <Plus className="h-2.5 w-2.5" />
        Add bar
      </button>
    </div>
  );
}
