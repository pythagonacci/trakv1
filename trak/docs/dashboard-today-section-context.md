# Dashboard home — Today / Upcoming / Past due section (context)

Reference for styling and structure of the dashboard **Today** widget. The route entry is `page.tsx`, but the overview UI lives in `dashboard-overview.tsx`.

---

## Dashboard home entry vs overview

### `src/app/dashboard/page.tsx`

Server page: auth, workspace, then client shell.

```tsx
import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardClient from "./dashboard-client";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-[var(--tertiary-foreground)]">No workspace selected</p>
        </div>
      </div>
    );
  }

  return <DashboardClient workspaceId={workspaceId} />;
}
```

### `src/app/dashboard/dashboard-client.tsx`

Loads data and passes it into `DashboardOverview`:

```tsx
    return (
        <>
            <DashboardOverview {...data} />
            <DashboardConfigModal workspaceId={workspaceId} />
        </>
    );
```

### `src/app/dashboard/dashboard-overview.tsx`

Full overview component (notifications, configurable widgets, Today block, etc.).

---

## Today section: data + rendering

**Data:** `dueAwareItems` (preferred) or `tasks` are bucketed in `useMemo` into `pastDueTasks`, `dueTodayTasks`, `upcomingTasks` using a `YYYY-MM-DD` “today” string and `task.dueDate?.slice(0, 10)`. Items without a due date go to **Upcoming**.

```tsx
  const { pastDueTasks, dueTodayTasks, upcomingTasks } = useMemo((): {
    pastDueTasks: Task[];
    dueTodayTasks: Task[];
    upcomingTasks: Task[];
  } => {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pastDue: Task[] = [];
    const dueToday: Task[] = [];
    const upcoming: Task[] = [];

    const itemsToBucket = dueAwareItems.length > 0
      ? dueAwareItems.map((item) => ({
          id: item.id,
          text: item.text,
          projectName: item.projectName,
          tabName: item.tabName,
          projectId: item.projectId,
          tabId: item.tabId,
          priority: (item.priority as Task["priority"]) ?? undefined,
          dueDate: item.dueDate,
          dueTime: undefined,
          sourceUrl: item.sourceUrl,
        }))
      : tasks.map((t) => ({ ...t, sourceUrl: undefined }));

    for (const task of itemsToBucket) {
      const due = task.dueDate?.slice(0, 10);
      if (!due) {
        upcoming.push(task);
        continue;
      }
      if (due < todayStr) pastDue.push(task);
      else if (due === todayStr) dueToday.push(task);
      else upcoming.push(task);
    }
    return { pastDueTasks: pastDue, dueTodayTasks: dueToday, upcomingTasks: upcoming };
  }, [tasks, dueAwareItems]);
```

**Widget:** Rendered when `widget.type === "today"` inside `dashboardConfig.widgets.map`.

**Exact Today-widget JSX** (three columns, headers, map → `TaskRowButton`):

```tsx
          if (widget.type === "today") {
            return (
              <Card key={widget.id} className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <div>
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      What matters now and coming up.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push("/dashboard/projects")}>
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3 px-4 pb-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Due today</p>
                    {dueTodayTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {dueTodayTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing due today.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Upcoming</p>
                    {upcomingTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {upcomingTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing upcoming.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Past due</p>
                    {pastDueTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {pastDueTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">No past due tasks.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
```

**`TaskRowButton` props:** `task`, `getPriorityColor`, `getPriorityLabel`, `formatDueDate`, `onNavigate`.

---

## Task card component (`TaskRowButton`)

Local function component in **`dashboard-overview.tsx`** (not a separate file).

```tsx
function TaskRowButton({
  task,
  getPriorityColor,
  getPriorityLabel,
  formatDueDate,
  onNavigate,
}: {
  task: Task;
  getPriorityColor: (priority?: Task["priority"]) => string;
  getPriorityLabel: (priority?: Task["priority"]) => string;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  onNavigate: () => void;
}) {
  return (
    <button
      onClick={onNavigate}
      className="w-full rounded-[var(--radius-md)] border border-border/60 bg-transparent px-3 py-2 text-left text-xs transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30 text-[var(--foreground)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[13px] line-clamp-1">{task.text}</p>
        <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
          {task.tabName}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <p className="line-clamp-1 text-[11px] text-[var(--muted-foreground)]">
          {task.projectName}
        </p>
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              "border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]"
            )}
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

## Priority pill

**Not** `PriorityBadge` from `src/components/properties/property-badge.tsx`.

Uses **`getPriorityColor`** and **`getPriorityLabel`** in `dashboard-overview.tsx`, merged with a local **`cn`** helper:

```tsx
  const getPriorityColor = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high": return "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium": return "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low": return "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
      default: return "";
    }
  };

  const getPriorityLabel = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };
```

---

## Status pill

**None** on `TaskRowButton`. The row `Task` type has no `status` field used here, and the JSX does not render status.

---

## Column header styling

Headers are plain `<p>` tags. **No colored indicator dots** for “Due today”, “Upcoming”, or “Past due”.

Shared classes:

`text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]`

Empty-state copy uses:

`text-[11px] text-[var(--muted-foreground)]`

---

## Left border / card accent

**No colored left border.** The row is a `<button>` with a full border: `border border-border/60`, plus hover `hover:border-[var(--secondary)]/30`. No `border-l-*` accent.

---

## Date pill (“Mar 28” style)

**Inline JSX** in `TaskRowButton`: `<span>` with fixed orange theme classes and **`Calendar`** icon; text from **`formatDueDate`** (`parseDateSafe`, “Today”, “Tomorrow”, or short month + day).

```tsx
  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = parseDateSafe(dueDate);
    if (!date) return null;
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
      const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${dateLabel} ${timeStr}`;
    }
    return dateLabel;
  };
```

Date chip classes on the card:

`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium`  
`border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]`

---

## Wrapper structure

The Today block uses **`Card`**, **`CardHeader`**, **`CardTitle`**, subtitle, ghost **`Button`** (“View all”), and **`CardContent`** with **`md:grid-cols-3`**.

Imports: `@/components/ui/card` (`Card`, `CardContent`, `CardHeader`, `CardTitle`).

Today **`Card`** classes:

`border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl`

---

## Source file

Primary implementation: **`trak/src/app/dashboard/dashboard-overview.tsx`**.
