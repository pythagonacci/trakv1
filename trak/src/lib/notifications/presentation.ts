import { buildProjectDrivePath, buildProjectTabPath } from "@/lib/dashboard-routes";
import { getLinkableItemHref } from "@/lib/references/navigation";
import type { NotificationListItem } from "./types";
import type { NotificationType } from "./constants";

function formatDateShort(value: string | null | undefined): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatNotificationTimeAgo(value: string): string {
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
}

function resolveHref(item: NotificationListItem): string | null {
  const event = item.notification_events;
  const payload = event.payload || {};

  if (event.task_id && event.tab_id && event.project_id && payload.project_name && payload.tab_name) {
    return getLinkableItemHref({
      referenceType: "task",
      id: event.task_id,
      tabId: event.tab_id,
      projectId: event.project_id,
      projectName: payload.project_name,
      tabName: payload.tab_name,
    });
  }

  if (event.block_id && event.tab_id && event.project_id && payload.project_name && payload.tab_name) {
    return getLinkableItemHref({
      referenceType: "block",
      id: event.block_id,
      tabId: event.tab_id,
      projectId: event.project_id,
      projectName: payload.project_name,
      tabName: payload.tab_name,
    });
  }

  if (event.project_id && event.tab_id && payload.project_name && payload.tab_name) {
    return buildProjectTabPath(event.project_id, event.tab_id, payload.project_name, payload.tab_name);
  }

  if (event.project_id && payload.project_name) {
    return buildProjectDrivePath(event.project_id, payload.project_name);
  }

  return null;
}

export function buildNotificationPresentation(item: NotificationListItem): {
  title: string;
  detail: string | null;
  href: string | null;
  type: NotificationType;
} {
  const event = item.notification_events;
  const payload = event.payload || {};
  const actorName = payload.actor_name || "Someone";
  const taskTitle = payload.task_title || "this task";
  const projectName = payload.project_name || null;
  const tabName = payload.tab_name || null;
  const context = [projectName, tabName].filter(Boolean).join(" · ") || null;

  switch (event.event_type) {
    case "mention":
      return {
        type: event.event_type,
        title: `${actorName} mentioned you${taskTitle !== "this task" ? ` in ${taskTitle}` : ""}`,
        detail: context,
        href: resolveHref(item),
      };
    case "task_assignment":
      return {
        type: event.event_type,
        title: `You were assigned to ${taskTitle}`,
        detail: context,
        href: resolveHref(item),
      };
    case "client_comment":
      if (payload.activity_type === "edit") {
        return {
          type: event.event_type,
          title: `${actorName} edited${tabName ? ` on ${tabName}` : ""}`,
          detail: payload.comment_excerpt || context,
          href: resolveHref(item),
        };
      }
      return {
        type: event.event_type,
        title: `${actorName} commented${tabName ? ` on ${tabName}` : ""}`,
        detail: payload.comment_excerpt || context,
        href: resolveHref(item),
      };
    case "comment_reply":
      return {
        type: event.event_type,
        title: `${actorName} replied to your comment${taskTitle !== "this task" ? ` on ${taskTitle}` : ""}`,
        detail: payload.comment_excerpt || context,
        href: resolveHref(item),
      };
    case "file_upload":
      return {
        type: event.event_type,
        title: payload.actor_name
          ? `${actorName} uploaded${payload.file_name ? ` ${payload.file_name}` : " a file"}`
          : `New file uploaded${payload.file_name ? `: ${payload.file_name}` : ""}`,
        detail: context,
        href: resolveHref(item),
      };
    case "task_status_change":
      return {
        type: event.event_type,
        title: `Status changed for ${taskTitle}`,
        detail: payload.next_status ? `${payload.previous_status || "No status"} -> ${payload.next_status}` : context,
        href: resolveHref(item),
      };
    case "due_date_change":
      return {
        type: event.event_type,
        title: `Due date changed for ${taskTitle}`,
        detail: `${formatDateShort(payload.previous_due_date)} -> ${formatDateShort(payload.next_due_date)}`,
        href: resolveHref(item),
      };
    default:
      return {
        type: event.event_type,
        title: "Notification",
        detail: context,
        href: resolveHref(item),
      };
  }
}
