"use client";

import Link from "next/link";
import { Bell, CalendarClock, CheckCheck, FileUp, Loader2, MessageSquare, MessageSquareReply, Settings2, UserRoundPlus, AtSign, CircleDot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@/hooks/use-notifications";
import { buildNotificationPresentation, formatNotificationTimeAgo } from "@/lib/notifications/presentation";
import type { NotificationType } from "@/lib/notifications/constants";
import type { NotificationListItem } from "@/lib/notifications/types";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "mention":
      return AtSign;
    case "task_assignment":
      return UserRoundPlus;
    case "client_comment":
      return MessageSquare;
    case "comment_reply":
      return MessageSquareReply;
    case "file_upload":
      return FileUp;
    case "task_status_change":
      return CircleDot;
    case "due_date_change":
      return CalendarClock;
    default:
      return Bell;
  }
}

export default function NotificationBell({ workspaceId }: { workspaceId?: string | null }) {
  const { data, isLoading } = useNotifications(workspaceId);
  const markRead = useMarkNotificationRead(workspaceId);
  const markAllRead = useMarkAllNotificationsRead(workspaceId);
  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--header-bar-text)] transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold leading-[18px] text-[var(--primary-foreground)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={unreadCount === 0 || markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                {markAllRead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Mark all read
              </Button>
              <Link href="/dashboard/settings?tab=notifications" className="inline-flex">
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--muted-foreground)]">
                <Bell className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No notifications yet</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Mentions, assignments, client comments, and file updates will appear here.
              </p>
            </div>
          ) : (
            items.map((item: NotificationListItem) => {
              const presentation = buildNotificationPresentation(item);
              const Icon = getNotificationIcon(presentation.type);
              const unread = !item.read_at;
              const content = (
                <>
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    unread
                      ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--muted-foreground)]"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-5", unread ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]")}>{presentation.title}</p>
                      <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                        {formatNotificationTimeAgo(item.notification_events.created_at)}
                      </span>
                    </div>
                    {presentation.detail && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">{presentation.detail}</p>
                    )}
                  </div>
                  <div className="mt-1 flex shrink-0 items-center gap-2">
                    {unread && (
                      <button
                        type="button"
                        className="text-[10px] font-medium text-[var(--primary)] hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!markRead.isPending) {
                            markRead.mutate(item.id);
                          }
                        }}
                      >
                        Mark read
                      </button>
                    )}
                    {unread && <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />}
                  </div>
                </>
              );

              const commonClassName = cn(
                "flex w-full items-start gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0",
                unread ? "bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10" : "hover:bg-[var(--surface-hover)]"
              );

              const handleOpen = () => {
                if (!item.read_at && !markRead.isPending) {
                  markRead.mutate(item.id);
                }
              };

              return presentation.href ? (
                <Link key={item.id} href={presentation.href} className={commonClassName} onClick={handleOpen}>
                  {content}
                </Link>
              ) : (
                <button key={item.id} type="button" className={commonClassName} onClick={handleOpen}>
                  {content}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
