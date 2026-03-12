"use client";

import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useNotificationPreferences, useUpdateNotificationPreference } from "@/hooks/use-notifications";
import type { NotificationPreferenceToggle } from "@/lib/notifications/types";

export default function NotificationPreferencesPanel({
  workspaceId,
  className,
}: {
  workspaceId?: string | null;
  className?: string;
}) {
  const { data, isLoading } = useNotificationPreferences(workspaceId);
  const updatePreference = useUpdateNotificationPreference(workspaceId);

  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)]", className)}>
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Notifications</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Choose which updates appear in your global notifications feed.
        </p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notification preferences...
          </div>
        ) : (
          (data?.toggles ?? []).map((toggle: NotificationPreferenceToggle) => {
            const isPending = updatePreference.isPending && updatePreference.variables?.type === toggle.type;
            return (
              <div key={toggle.type} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{toggle.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {toggle.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted-foreground)]" />}
                  <Switch
                    checked={toggle.enabled}
                    disabled={isPending}
                    onCheckedChange={(checked) => updatePreference.mutate({ type: toggle.type, enabled: checked })}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
