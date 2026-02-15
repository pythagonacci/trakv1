"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import MembersTable from "./members/members-table";
import GeneralSettingsForm from "./general/general-settings-form";

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

interface SettingsClientProps {
  workspace: Workspace;
  members: Member[];
  currentUserRole: "owner" | "admin" | "teammate";
  currentUserId: string;
}

export function SettingsClient({
  workspace,
  members,
  currentUserRole,
  currentUserId,
}: SettingsClientProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"members" | "general">("members");
  const { setHeaderHidden } = useDashboardHeader();
  const isSlackPage = pathname?.includes("/settings/integrations/slack");

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // Hide header on mount, show on unmount
  useEffect(() => {
    setHeaderHidden(true);
    return () => {
      setHeaderHidden(false);
    };
  }, [setHeaderHidden]);

  return (
    <div className="flex h-full flex-col">
      {/* Page Header - same coloring as table header, larger */}
      <header className="sticky top-0 z-40 border-b border-[var(--secondary)] bg-[var(--secondary)]/10">
        <div className="flex w-full items-center justify-between py-4 px-4 md:px-5 lg:px-6">
          <div className="flex flex-col justify-center gap-0.5">
            <h2 className="text-base font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
              Workspace Settings
            </h2>
            <p className="text-sm text-[var(--tertiary-foreground)]/80">
              {workspace.name}
            </p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
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
        {activeTab === "general" && (
          <GeneralSettingsForm
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            canManage={canManage}
          />
        )}
      </div>
    </div>
  );
}
