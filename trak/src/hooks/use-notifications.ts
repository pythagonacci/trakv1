"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from "@/app/actions/notifications";
import type { NotificationType } from "@/lib/notifications/constants";

const notificationKeys = {
  list: (workspaceId: string) => ["notifications", workspaceId] as const,
  preferences: (workspaceId: string) => ["notificationPreferences", workspaceId] as const,
};

export function useNotifications(workspaceId?: string | null) {
  return useQuery({
    queryKey: notificationKeys.list(workspaceId || "none"),
    queryFn: async () => {
      if (!workspaceId) return { items: [], unreadCount: 0 };
      const result = await getNotifications(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      const result = await markNotificationRead(recipientId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) });
      }
    },
  });
}

export function useMarkAllNotificationsRead(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) return { success: true };
      const result = await markAllNotificationsRead(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) });
      }
    },
  });
}

export function useNotificationPreferences(workspaceId?: string | null) {
  return useQuery({
    queryKey: notificationKeys.preferences(workspaceId || "none"),
    queryFn: async () => {
      if (!workspaceId) return { toggles: [] };
      const result = await getNotificationPreferences(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
  });
}

export function useUpdateNotificationPreference(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: NotificationType; enabled: boolean }) => {
      if (!workspaceId) throw new Error("Missing workspace");
      const result = await updateNotificationPreference(workspaceId, input.type, input.enabled);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(workspaceId) });
        queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) });
      }
    },
  });
}
