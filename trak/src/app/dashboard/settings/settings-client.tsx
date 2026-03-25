"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, MessageCircle, UsersRound, FolderOpen, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import MembersTable from "./members/members-table";
import GeneralSettingsForm from "./general/general-settings-form";
import TeamsTable from "./teams/teams-table";
import NotificationPreferencesPanel from "@/components/notifications/notification-preferences-panel";
import type { WorkspaceBillingSummary } from "@/hooks/use-workspace-billing";

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "teammate";
}

interface WorkspaceTeam {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  member_ids: string[];
}

interface SettingsClientProps {
  workspace: Workspace;
  members: Member[];
  teams: WorkspaceTeam[];
  billingSummary: WorkspaceBillingSummary;
  currentUserRole: "owner" | "admin" | "teammate";
  currentUserId: string;
  initialTab: "members" | "general" | "teams" | "notifications";
}

export function SettingsClient({
  workspace,
  members,
  teams,
  billingSummary,
  currentUserRole,
  currentUserId,
  initialTab,
}: SettingsClientProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"members" | "general" | "teams" | "notifications">(initialTab);
  const { setHeaderHidden } = useDashboardHeader();
  const isSlackPage = pathname?.includes("/settings/integrations/slack");
  const isGoogleDrivePage = pathname?.includes("/settings/integrations/google-drive");

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // Hide header on mount, show on unmount
  useEffect(() => {
    setHeaderHidden(true);
    return () => {
      setHeaderHidden(false);
    };
  }, [setHeaderHidden]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Page Header - thin, no border, single line with dot separator */}
      <header className="sticky top-0 z-40 bg-[var(--surface)]">
        <div className="flex w-full items-center py-2 px-4 md:px-5 lg:px-6">
          <p className="text-sm text-[var(--foreground)]">
            Workspace Settings <span className="text-[var(--muted-foreground)]">·</span>{" "}
            <span className="text-[var(--muted-foreground)]">{workspace.name}</span>
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-[var(--surface)]">
        <div className="flex gap-6 px-6">
          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "members"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <Users className="h-4 w-4" />
            Members
            {activeTab === "members" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "teams"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <UsersRound className="h-4 w-4" />
            Teams
            {activeTab === "teams" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "general"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <Settings className="h-4 w-4" />
            General
            {activeTab === "general" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "notifications"
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
            {activeTab === "notifications" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </button>
          <Link
            href="/dashboard/settings/integrations/slack"
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              isSlackPage
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Slack
            {isSlackPage && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </Link>
          <Link
            href="/dashboard/settings/integrations/google-drive"
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
              isGoogleDrivePage
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <FolderOpen className="h-4 w-4" />
            Google Drive
            {isGoogleDrivePage && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
            )}
          </Link>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "members" && (
          <MembersTable
            workspaceId={workspace.id}
            members={members}
            canManage={canManage}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === "teams" && (
          <TeamsTable
            workspaceId={workspace.id}
            teams={teams}
            members={members}
            canManage={canManage}
          />
        )}
        {activeTab === "general" && (
          <GeneralSettingsForm
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            canManage={canManage}
            billingSummary={billingSummary}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationPreferencesPanel workspaceId={workspace.id} />
        )}
      </div>
    </div>
  );
}
