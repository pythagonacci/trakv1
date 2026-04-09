# Context Gather — Project Overview Tab

Reference paths: route segment `trak/src/app/dashboard/projects/[projectId]/overview/`.

---

## 1. Overview tab component — full file

`trak/src/app/dashboard/projects/[projectId]/overview/project-overview.tsx` (client component).

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Flag,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export interface ProjectOverviewTask {
  id: string;
  text: string;
  tabName: string;
  tabId: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDate?: string;
  dueTime?: string;
  status?: string;
}

export interface TeamFeedbackItem {
  id: string;
  text: string;
  author: string;
  tabName: string;
  tabId: string;
  blockId: string;
  timestamp?: string;
}

interface ProjectOverviewProps {
  projectId: string;
  projectName: string;
  tasksDueToday: ProjectOverviewTask[];
  tasksDueSoon: ProjectOverviewTask[];
  tasksOverdue: ProjectOverviewTask[];
  teamFeedback: TeamFeedbackItem[];
  openTasksCount: number;
}

export default function ProjectOverview({
  projectId,
  projectName,
  tasksDueToday,
  tasksDueSoon,
  tasksOverdue,
  teamFeedback,
  openTasksCount,
}: ProjectOverviewProps) {
  const router = useRouter();

  const formatRelativeTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    let dateLabel = "";
    if (taskDate.getTime() === today.getTime()) {
      dateLabel = "Today";
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (dueTime) {
      const time = new Date(`2000-01-01T${dueTime}`);
      const timeStr = time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateLabel} ${timeStr}`;
    }
    return dateLabel;
  };

  const getPriorityColor = (priority?: ProjectOverviewTask["priority"]) => {
    switch (priority) {
      case "urgent":
        return "text-[var(--priority-urgent-text)] bg-[var(--priority-urgent-bg)] border border-[var(--priority-urgent-text)]/20";
      case "high":
        return "text-[var(--priority-high-text)] bg-[var(--priority-high-bg)] border border-[var(--priority-high-text)]/20";
      case "medium":
        return "text-[var(--priority-medium-text)] bg-[var(--priority-medium-bg)] border border-[var(--priority-medium-text)]/20";
      case "low":
        return "text-[var(--priority-low-text)] bg-[var(--priority-low-bg)] border border-[var(--priority-low-text)]/20";
      default:
        return "";
    }
  };

  const getPriorityLabel = (priority?: ProjectOverviewTask["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };

  const goToTab = (tabId: string, tabName: string, taskId?: string) => {
    const q = taskId ? `?taskId=${taskId}` : "";
    router.push(`${buildProjectTabPath(projectId, tabId, projectName, tabName)}${q}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-10 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            Project overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
            {projectName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            What’s due, overdue, and recent feedback from your team—all in one place.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => {}}
          className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
        >
          <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
            {openTasksCount}
          </p>
          <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
            Open tasks
          </p>
        </button>
        <button
          onClick={() => {}}
          className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
        >
          <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
            {teamFeedback.length}
          </p>
          <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
            Team comments & feedback
          </p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Team comments & feedback */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl lg:col-span-2">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Team comments & feedback
            </CardTitle>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Recent comments left by your team on this project’s tabs.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 pt-0">
            {teamFeedback.length === 0 ? (
              <p className="text-[var(--muted-foreground)] text-xs">
                No team comments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {teamFeedback.slice(0, 10).map((feedback) => (
                  <button
                    key={feedback.id}
                    onClick={() => goToTab(feedback.tabId, feedback.tabName)}
                    className="group flex w-full items-start gap-2 rounded-[var(--radius-md)] border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[var(--foreground)]" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[13px] font-medium text-[var(--foreground)] line-clamp-2">
                        &ldquo;{feedback.text}&rdquo;
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {feedback.author} · {feedback.tabName} ·{" "}
                        {formatRelativeTime(feedback.timestamp)}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Due today */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }}
                />
                <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
                  Due today
                </CardTitle>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Tasks due in the next 24 hours.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksDueToday.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksDueToday.length > 0 ? (
              <div className="space-y-2">
                {tasksDueToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent="var(--primary)"
                    onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Nothing due today for this project.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Due soon */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}
                />
                <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
                  Due soon
                </CardTitle>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Coming up in the next 7 days.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksDueSoon.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksDueSoon.length > 0 ? (
              <div className="space-y-2">
                {tasksDueSoon.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent="var(--success)"
                    onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No tasks due in the next week.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--error)", flexShrink: 0 }}
                />
                <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
                  Overdue
                </CardTitle>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Past-due items that need attention.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksOverdue.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksOverdue.length > 0 ? (
              <div className="space-y-2">
                {tasksOverdue.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent="var(--error)"
                    onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No overdue tasks. You’re on track.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  accent,
  onClick,
  formatDueDate,
  getPriorityColor,
  getPriorityLabel,
}: {
  task: ProjectOverviewTask;
  accent: string;
  onClick: () => void;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  getPriorityColor: (p?: ProjectOverviewTask["priority"]) => string;
  getPriorityLabel: (p?: ProjectOverviewTask["priority"]) => string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs transition hover:bg-[var(--surface-hover)] group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `2.5px solid ${accent}`,
        borderRadius: "var(--radius-lg)",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-medium text-[12.5px] line-clamp-1 text-[var(--foreground)]">
          {task.text}
        </p>
        <span className="whitespace-nowrap text-[10.5px] text-[var(--tertiary-foreground)] shrink-0">
          {task.tabName}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{
              background: "var(--surface-muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <Calendar className="h-2.5 w-2.5" />
            {formatDueDate(task.dueDate, task.dueTime)}
          </span>
        )}
      </div>
    </button>
  );
}
```

---

## 2. How the overview tab is mounted

**Routing:** Overview is its own Next.js route: `.../projects/[readable]/overview`, implemented by `overview/page.tsx`. `buildProjectOverviewPath` in `trak/src/lib/dashboard-routes.ts` returns `` `${buildProjectPath(projectId, projectName)}/overview` ``.

**Layout parent:** `trak/src/app/dashboard/projects/[projectId]/layout.tsx` wraps all project sub-routes. It renders `ProjectHeaderWrapper`, then (if there are tabs) a sticky `TabBar`, then `{children}`. The overview page’s content is whatever `overview/page.tsx` returns—it becomes `{children}` inside the padded main area.

**Tab selection:** `trak/src/app/dashboard/projects/[projectId]/tab-bar.tsx` is client-side. It sets `isOverview = pathname?.endsWith("/overview")`. The Overview pill is a button:

- `router.push(buildProjectOverviewPath(projectId, projectName))`
- Active styles when `isOverview` is true (underline / mobile selected state).

**Props into `ProjectOverview`:** Only the parent **page** (`overview/page.tsx`) instantiates `<ProjectOverview ... />`. The layout does **not** pass overview data. Props are:

| Prop | Source |
|------|--------|
| `projectId` | Resolved UUID from `resolveProjectIdFromParam` |
| `projectName` | `project.name` from DB |
| `tasksDueToday` | Computed in page (see §12) |
| `tasksDueSoon` | `tasksDueSoon.slice(0, 10)` in page |
| `tasksOverdue` | `tasksOverdue.slice(0, 15)` in page |
| `teamFeedback` | Built in page, max 15 items |
| `openTasksCount` | `openTasks.length` (all open tasks from fetched batch, not only the three buckets) |

**Default redirect:** `page.tsx` at `[projectId]` redirects to overview when the project has tabs (`buildProjectOverviewPath`).

---

## 3. Stats block — “Open Tasks” and “Team Comments & Feedback”

**Exact JSX:**

```tsx
<div className="grid gap-3 md:grid-cols-2">
  <button
    onClick={() => {}}
    className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
  >
    <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
      {openTasksCount}
    </p>
    <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
      Open tasks
    </p>
  </button>
  <button
    onClick={() => {}}
    className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
  >
    <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
      {teamFeedback.length}
    </p>
    <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
      Team comments & feedback
    </p>
  </button>
</div>
```

**Numbers:**

- **Open tasks:** prop `openTasksCount` → from server page as `openTasks.length` (open = not done; see §12).
- **Team comments & feedback:** **not** a separate count query — it is `teamFeedback.length` (length of the **already trimmed** array passed from the server, max 15 items). So this stat is “count of feedback rows we loaded,” not necessarily total comments in the project.

---

## 4. Team comments & feedback section

**Exact JSX (list + empty state):**

```tsx
<Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl lg:col-span-2">
  <CardHeader className="pb-2 px-4 pt-4">
    <CardTitle className="text-sm font-medium flex items-center gap-2">
      <MessageSquare className="h-4 w-4" />
      Team comments & feedback
    </CardTitle>
    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
      Recent comments left by your team on this project’s tabs.
    </p>
  </CardHeader>
  <CardContent className="space-y-2 px-4 pb-4 pt-0">
    {teamFeedback.length === 0 ? (
      <p className="text-[var(--muted-foreground)] text-xs">
        No team comments yet.
      </p>
    ) : (
      <div className="space-y-2">
        {teamFeedback.slice(0, 10).map((feedback) => (
          <button
            key={feedback.id}
            onClick={() => goToTab(feedback.tabId, feedback.tabName)}
            className="group flex w-full items-start gap-2 rounded-[var(--radius-md)] border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
          >
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[var(--foreground)]" />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-[13px] font-medium text-[var(--foreground)] line-clamp-2">
                &ldquo;{feedback.text}&rdquo;
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {feedback.author} · {feedback.tabName} ·{" "}
                {formatRelativeTime(feedback.timestamp)}
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0" />
          </button>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

**Per-item fields (`TeamFeedbackItem`):** `id`, `text`, `author`, `tabName`, `tabId`, `blockId`, `timestamp` (optional). **Displayed:** `text`, `author`, `tabName`, `formatRelativeTime(timestamp)`. **`blockId`** is not shown; navigation uses only `tabId` / `tabName` (no deep link to block).

**Server-side mapping** (from `BlockComment` in `trak/src/types/block-comment.ts`): `author` ← `author_name` or local part of `author_email` or `"Team"`; `source !== "external"` filtered out; sort by `timestamp` desc; `slice(0, 15)` before passing to the client (UI then `slice(0, 10)`).

---

## 5. Due today section

**Filtering:** Done entirely in `overview/page.tsx` (not in the client). Open tasks with a parseable `dueDate` are bucketed using `parseDateSafe` and calendar midnight boundaries: **due today** = `d >= todayStart` and `d < todayEnd` (where `todayEnd` is start of tomorrow). *Note:* Card subtitle says “next 24 hours” but the implementation is **calendar day**, not a rolling 24h window.

**Exact JSX:**

```tsx
<Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }}
        />
        <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
          Due today
        </CardTitle>
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        Tasks due in the next 24 hours.
      </p>
    </div>
    <span className="text-xs text-[var(--tertiary-foreground)]">
      {tasksDueToday.length} items
    </span>
  </CardHeader>
  <CardContent className="px-4 pb-4">
    {tasksDueToday.length > 0 ? (
      <div className="space-y-2">
        {tasksDueToday.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            accent="var(--primary)"
            onClick={() => goToTab(task.tabId, task.tabName, task.id)}
            formatDueDate={formatDueDate}
            getPriorityColor={getPriorityColor}
            getPriorityLabel={getPriorityLabel}
          />
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-[var(--muted-foreground)]">
        Nothing due today for this project.
      </p>
    )}
  </CardContent>
</Card>
```

**Task card fields:** See §8 (`TaskRow`): title `task.text`, tab `task.tabName`, priority pill (if not `none`), due chip via `formatDueDate(task.dueDate, task.dueTime)`. **No explicit status** on the row.

---

## 6. Due soon section

**Filtering:** Same loop: due date strictly after today through **before** `todayStart + 8 days` (`soonEnd`), i.e. **next 7 calendar days** after today.

**Server pass:** `tasksDueSoon={tasksDueSoon.slice(0, 10)}`.

**Exact JSX:**

```tsx
<Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}
        />
        <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
          Due soon
        </CardTitle>
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        Coming up in the next 7 days.
      </p>
    </div>
    <span className="text-xs text-[var(--tertiary-foreground)]">
      {tasksDueSoon.length} items
    </span>
  </CardHeader>
  <CardContent className="px-4 pb-4">
    {tasksDueSoon.length > 0 ? (
      <div className="space-y-2">
        {tasksDueSoon.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            accent="var(--success)"
            onClick={() => goToTab(task.tabId, task.tabName, task.id)}
            formatDueDate={formatDueDate}
            getPriorityColor={getPriorityColor}
            getPriorityLabel={getPriorityLabel}
          />
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-[var(--muted-foreground)]">
        No tasks due in the next week.
      </p>
    )}
  </CardContent>
</Card>
```

---

## 7. Overdue section

**Filtering:** `d < todayStart` (calendar day before today). Order: inherits from query order for `task_items` after filtering; bucketing preserves the relative order of `openTasks` (which came from DB order: `due_date` asc, then `updated_at` desc).

**Server pass:** `tasksOverdue={tasksOverdue.slice(0, 15)}`.

**Show more / pagination:** **None.** Only slicing on the server; all passed items are rendered.

**Exact JSX:**

```tsx
<Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)] lg:col-span-2">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--error)", flexShrink: 0 }}
        />
        <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">
          Overdue
        </CardTitle>
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        Past-due items that need attention.
      </p>
    </div>
    <span className="text-xs text-[var(--tertiary-foreground)]">
      {tasksOverdue.length} items
    </span>
  </CardHeader>
  <CardContent className="px-4 pb-4">
    {tasksOverdue.length > 0 ? (
      <div className="space-y-2">
        {tasksOverdue.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            accent="var(--error)"
            onClick={() => goToTab(task.tabId, task.tabName, task.id)}
            formatDueDate={formatDueDate}
            getPriorityColor={getPriorityColor}
            getPriorityLabel={getPriorityLabel}
          />
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-[var(--muted-foreground)]">
        No overdue tasks. You’re on track.
      </p>
    )}
  </CardContent>
</Card>
```

---

## 8. Task row (“task card”) — full definition

Defined in the **same file** as `ProjectOverview`, not a separate module.

```tsx
function TaskRow({
  task,
  accent,
  onClick,
  formatDueDate,
  getPriorityColor,
  getPriorityLabel,
}: {
  task: ProjectOverviewTask;
  accent: string;
  onClick: () => void;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  getPriorityColor: (p?: ProjectOverviewTask["priority"]) => string;
  getPriorityLabel: (p?: ProjectOverviewTask["priority"]) => string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs transition hover:bg-[var(--surface-hover)] group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `2.5px solid ${accent}`,
        borderRadius: "var(--radius-lg)",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-medium text-[12.5px] line-clamp-1 text-[var(--foreground)]">
          {task.text}
        </p>
        <span className="whitespace-nowrap text-[10.5px] text-[var(--tertiary-foreground)] shrink-0">
          {task.tabName}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{
              background: "var(--surface-muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <Calendar className="h-2.5 w-2.5" />
            {formatDueDate(task.dueDate, task.dueTime)}
          </span>
        )}
      </div>
    </button>
  );
}
```

---

## 9. Priority pill rendering

- **Not** a shared `PriorityBadge` component in this view.
- **Pattern:** Local `getPriorityColor` returns Tailwind class strings using CSS variables (`--priority-*-text`, `--priority-*-bg`). Local `getPriorityLabel` maps enum to label.
- **Rendered** as a `<span>` with `cn(..., getPriorityColor(task.priority))`, `Flag` icon, and `getPriorityLabel(task.priority)`.
- Shown only when `task.priority && task.priority !== "none"`.

---

## 10. Date pill rendering

- **Utility:** Inline `formatDueDate` inside `ProjectOverview` (not `formatDueDateForDisplay` from `@/lib/due-date`). Uses `Date`, compares to local `today`/`tomorrow`, `toLocaleDateString("en-US", { month: "short", day: "numeric" })`, and optional `dueTime` via `new Date(\`2000-01-01T${dueTime}\`)` + `toLocaleTimeString`.
- **JSX:**

```tsx
{task.dueDate && (
  <span
    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
    style={{
      background: "var(--surface-muted)",
      color: "var(--muted-foreground)",
    }}
  >
    <Calendar className="h-2.5 w-2.5" />
    {formatDueDate(task.dueDate, task.dueTime)}
  </span>
)}
```

**Bucketing on server** uses `parseDateSafe` from `@/lib/due-date` for stable local calendar interpretation.

---

## 11. Section headers — styling and dots

Shared structure for Due today / Due soon / Overdue:

- Outer: `CardHeader` with `className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4"`.
- Inner title row: `div className="flex items-center gap-1.5 mb-2"`.
- **Dot:** `div` with inline style `width: 5, height: 5, borderRadius: "50%", flexShrink: 0`, background:
  - Due today: `var(--primary)`
  - Due soon: `var(--success)`
  - Overdue: `var(--error)`
- Title: `CardTitle` with `className="text-[15px] font-medium text-[var(--foreground)]"`.
- Subtitle: `p` with `className="mt-1 text-xs text-[var(--muted-foreground)]"`.
- Count: `span` with `className="text-xs text-[var(--tertiary-foreground)]"` showing `{tasksDueToday.length} items` (etc.).

Team feedback card uses a different header pattern (icon + `text-sm` title, no dot).

---

## 12. Data fetching — overview tab

**Where:** `trak/src/app/dashboard/projects/[projectId]/overview/page.tsx` — async **server component** (not a separate server action). Uses `createClient()` from `@/lib/supabase/server`.

**Flow summary:**

1. Resolve `projectId`, load `projects` row (for name + canonical URL redirect).
2. Load flat `tabs` (`id`, `name`) for the project; if empty/error, render `ProjectOverview` with all lists empty and `openTasksCount={0}`.
3. **Parallel queries** (`Promise.allSettled`):
   - **`task_items`:** `select` with nested `tab:tabs(id, name)`; filter `tab_id in tabIds`, `workspace_id`, `is_placeholder = false`; order `due_date` asc (nulls last), `updated_at` desc; **limit 100**.
   - **`blocks`:** rows where `content->_blockComments` is not null; `select` id, content, updated_at, tab_id, `tabs(id,name)`; **limit 80**.
4. **Open tasks:** Filter out tasks whose `statuses` array contains done-like values (`done`, `complete`, `completed`). Map to overview shape:
   - `id`: `` `${task_block_id}-${id}` ``
   - `text`: `title`
   - `tabName` / `tabId` from join or `tabNameById`
   - `priority`: first entry in `priorities[].value` (may be null)
   - `dueDate` / `dueTime` from columns
   - `status`: first status value or `"todo"`
5. **Buckets:** Only open tasks **with** parseable `dueDate` are split into overdue / due today / due soon (see §5–7).
6. **Team feedback:** Flatten `_blockComments` from each block, drop `source === "external"`, map fields, sort by timestamp desc, `slice(0, 15)`.

**Important limits:** Task query caps at **100** rows; comments pipeline caps **80** blocks and **15** feedback items after merge. Counts and lists can be incomplete for large projects.

---

## 13. Shared card / section wrapper

**Import:**

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
```

**Usage:** Every major section (team feedback, due today, due soon, overdue) is a shadcn-style `Card` with `CardHeader` + `CardTitle` + optional description + `CardContent`. Stats row uses plain `button` + `div`s, not `Card`.

---

## 14. Full file tree — `trak/src/app/dashboard/projects/[projectId]/`

All files under the segment (`find … -type f | sort`):

```
trak/src/app/dashboard/projects/[projectId]/3.3.txt
trak/src/app/dashboard/projects/[projectId]/client-page-toggle.tsx
trak/src/app/dashboard/projects/[projectId]/create-tab-dialog.tsx
trak/src/app/dashboard/projects/[projectId]/delete-tab-dialog.tsx
trak/src/app/dashboard/projects/[projectId]/drive/page.tsx
trak/src/app/dashboard/projects/[projectId]/drive/project-drive-client.tsx
trak/src/app/dashboard/projects/[projectId]/empty-tabs-state.tsx
trak/src/app/dashboard/projects/[projectId]/integrations/google-drive/page.tsx
trak/src/app/dashboard/projects/[projectId]/integrations/google-drive/project-settings-client.tsx
trak/src/app/dashboard/projects/[projectId]/layout.tsx
trak/src/app/dashboard/projects/[projectId]/loading.tsx
trak/src/app/dashboard/projects/[projectId]/not-found.tsx
trak/src/app/dashboard/projects/[projectId]/overview/page.tsx
trak/src/app/dashboard/projects/[projectId]/overview/project-overview.tsx
trak/src/app/dashboard/projects/[projectId]/page.tsx
trak/src/app/dashboard/projects/[projectId]/project-header-wrapper.tsx
trak/src/app/dashboard/projects/[projectId]/project-header.tsx
trak/src/app/dashboard/projects/[projectId]/tab-bar.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/3.5-timeline-block.txt
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/add-block-button.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/attached-files-list.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-comments.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-reference-renderer.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-reference-selector.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/blocks/doc-reference-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/card-count-context.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/cards-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/divider-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/doc-selector-dialog.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/doc-sidebar.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/embed-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/empty-canvas-state.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/file-attachment-dialog.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/file-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/file-upload-zone.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/gallery-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/image-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/inline-file-preview.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/lazy-block-wrapper.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/link-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/loading.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/make-template-dialog.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/pdf-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/section-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/section-header-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/shopify-product-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/subtab-sidebar-wrapper.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/subtab-sidebar.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-bar.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas-wrapper.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-page-layout.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-themes.ts
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-of-contents.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/text-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/timeline-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/video-block.tsx
trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/video-player.tsx
```

---

## Appendix — `overview/page.tsx` (server data layer)

Full source for the route that queries Supabase and passes props to `ProjectOverview`:

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { buildProjectOverviewPath, isCanonicalReadableParam } from "@/lib/dashboard-routes";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import { BlockComment } from "@/types/block-comment";
import { parseDateSafe } from "@/lib/due-date";
import ProjectOverview from "./project-overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const { projectId: projectIdParam } = await params;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const authResult = await requireWorkspaceAccess(workspaceId);
  if ("error" in authResult) redirect("/login");

  const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectIdParam);
  if (!projectId) notFound();

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select(
      `id, name, status, due_date_date, due_date_text, priority, tags, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, client:clients(id, name, company)`
    )
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (projectError || !projectRow) notFound();

  const project = {
    ...projectRow,
    client: Array.isArray(projectRow.client) ? projectRow.client[0] : projectRow.client,
    tags: projectRow.tags ?? [],
  };

  if (!isCanonicalReadableParam(projectIdParam, project.name, project.id)) {
    redirect(buildProjectOverviewPath(project.id, project.name));
  }

  const { data: projectTabs, error: tabsError } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", projectId);

  const hierarchicalTabsResult = await getProjectTabs(projectId);
  const hierarchicalTabs = hierarchicalTabsResult.data || [];

  if (tabsError || !projectTabs?.length) {
    return (
      <div className="w-full px-2 md:px-3 lg:px-4">
        <div className="max-w-7xl mx-auto pt-2 pb-1">
          <ProjectOverview
            projectId={projectId}
            projectName={project.name}
            tasksDueToday={[]}
            tasksDueSoon={[]}
            tasksOverdue={[]}
            teamFeedback={[]}
            openTasksCount={0}
          />
        </div>
      </div>
    );
  }

  const tabIds = projectTabs.map((t) => t.id);
  const tabNameById = Object.fromEntries(projectTabs.map((t) => [t.id, t.name]));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const soonEnd = new Date(todayStart);
  soonEnd.setDate(soonEnd.getDate() + 8);

  const [tasksResult, commentBlocksResult] = await Promise.allSettled([
    supabase
      .from("task_items")
      .select(
        `
        id,
        title,
        statuses,
        priorities,
        due_date,
        due_time,
        task_block_id,
        tab_id,
        tab:tabs(id, name)
      `
      )
      .in("tab_id", tabIds)
      .eq("workspace_id", workspaceId)
      .eq("is_placeholder", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("blocks")
      .select(`
        id,
        content,
        updated_at,
        tab_id,
        tabs(id, name)
      `)
      .in("tab_id", tabIds)
      .not("content->>_blockComments", "is", null)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const taskItems =
    tasksResult.status === "fulfilled" && !tasksResult.value.error
      ? tasksResult.value.data || []
      : [];
  const commentBlocks =
    commentBlocksResult.status === "fulfilled" && !commentBlocksResult.value.error
      ? commentBlocksResult.value.data || []
      : [];

  const doneStatuses = new Set(["done", "complete", "completed"]);
  const isTaskDone = (t: any): boolean => {
    const statuses = Array.isArray(t?.statuses) ? t.statuses : [];
    for (const entry of statuses) {
      const value =
        typeof entry?.value === "string" ? entry.value.toLowerCase() : "";
      if (doneStatuses.has(value)) return true;
    }
    return false;
  };
  const firstStatusFromStatuses = (statuses: unknown): string =>
    (Array.isArray(statuses) && statuses[0]?.value != null
      ? String((statuses[0] as any).value)
      : "todo") as string;

  const openTasks = taskItems
    .filter((t: any) => !isTaskDone(t))
    .map((t: any) => {
      const taskPriorities = Array.isArray(t.priorities) ? t.priorities : [];
      const firstPriority = taskPriorities[0]?.value ?? null;
      return {
        id: `${t.task_block_id}-${t.id}`,
        text: t.title,
        tabName: t.tab?.name ?? tabNameById[t.tab_id] ?? "Unknown",
        tabId: t.tab_id,
        priority: firstPriority,
        dueDate: t.due_date,
        dueTime: t.due_time,
        status: firstStatusFromStatuses(t.statuses),
      };
    });

  const tasksDueToday: typeof openTasks = [];
  const tasksDueSoon: typeof openTasks = [];
  const tasksOverdue: typeof openTasks = [];

  for (const task of openTasks) {
    if (!task.dueDate) continue;
    const d = parseDateSafe(task.dueDate);
    if (!d) continue;
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < todayStart.getTime()) {
      tasksOverdue.push(task);
    } else if (d.getTime() < todayEnd.getTime()) {
      tasksDueToday.push(task);
    } else if (d.getTime() < soonEnd.getTime()) {
      tasksDueSoon.push(task);
    }
  }

  const teamFeedback = commentBlocks.flatMap((block: any) => {
    const comments: BlockComment[] = Array.isArray(block.content?._blockComments)
      ? block.content._blockComments
      : [];
    return comments
      .filter((c) => c && c.source !== "external")
      .map((c) => ({
        id: c.id ?? `${block.id}-${c.timestamp}`,
        text: c.text,
        author: c.author_name || c.author_email?.split("@")[0] || "Team",
        tabName: block.tabs?.name ?? tabNameById[block.tab_id] ?? "Untitled tab",
        tabId: block.tab_id,
        blockId: block.id,
        timestamp: c.timestamp,
      }));
  }).sort((a, b) => {
    const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bt - at;
  }).slice(0, 15);

  return (
    <div className="w-full px-2 md:px-3 lg:px-4">
      <div className="py-3 md:py-4 lg:py-5">
        <ProjectOverview
          projectId={projectId}
          projectName={project.name}
          tasksDueToday={tasksDueToday}
          tasksDueSoon={tasksDueSoon.slice(0, 10)}
          tasksOverdue={tasksOverdue.slice(0, 15)}
          teamFeedback={teamFeedback}
          openTasksCount={openTasks.length}
        />
      </div>
    </div>
  );
}
```

---

*Generated for redesign planning; aligns with repo state as of gather time.*
