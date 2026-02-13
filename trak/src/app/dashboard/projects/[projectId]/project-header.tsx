"use client";

import { ArrowLeft, Edit, Palette, LayoutDashboard, Users } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../../projects/status-badge";
import ClientPageToggle from "./client-page-toggle";
import ProjectPermissionsDialog from "../project-permissions-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TAB_THEMES } from "./tabs/[tabId]/tab-themes";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  children?: Tab[];
}

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    workspace_id?: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date?: string | null;
    due_date_text?: string | null;
    client_page_enabled?: boolean;
    client_comments_enabled?: boolean;
    client_editing_enabled?: boolean;
    public_token?: string | null;
    client?: {
      id: string;
      name: string;
      company?: string | null;
    } | null;
  };
  tabId?: string;
  tabs?: Tab[];
  workspaceId?: string;
}

export default function ProjectHeader({ project, tabId, tabs = [], workspaceId }: ProjectHeaderProps) {
  const router = useRouter();
  const [tabTheme, setTabTheme] = useState<string>("default");
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) return;
    const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
    if (saved && TAB_THEMES.some((t) => t.id === saved)) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Listen for theme changes from tab canvas
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) return;
    const handleThemeChange = (e: StorageEvent) => {
      if (e.key === `trak-tab-theme-${tabId}` && e.newValue) {
        if (TAB_THEMES.some((t) => t.id === e.newValue)) {
          setTabTheme(e.newValue);
        }
      }
    };
    window.addEventListener("storage", handleThemeChange);
    return () => window.removeEventListener("storage", handleThemeChange);
  }, [tabId]);

  const handleThemeChange = (themeId: string) => {
    if (!tabId) return;
    setTabTheme(themeId);
    localStorage.setItem(`trak-tab-theme-${tabId}`, themeId);
    // Dispatch custom event for same-window listeners (storage event only works cross-window)
    window.dispatchEvent(new CustomEvent("tab-theme-updated"));
  };

  const formatDueDate = () => {
    if (project.due_date_text) {
      return project.due_date_text;
    }
    if (project.due_date_date) {
      const date = new Date(project.due_date_date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return null;
  };

  const hasDueDate = project.due_date_text || project.due_date_date;
  const dueDateText = formatDueDate();

  const pathname = usePathname();
  const isOverview = pathname?.endsWith("/overview");
  const projectOverviewPath = `/dashboard/projects/${project.id}/overview`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          onClick={() => router.push("/dashboard/projects")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to projects
        </button>
        {!isOverview && (
          <button
            onClick={() => router.push(projectOverviewPath)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Overview
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          {project.client && (
            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--velvet-purple)]">
              {project.client.name}
              {project.client.company && <span className="text-[var(--velvet-purple)]/70">· {project.client.company}</span>}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-normal text-[var(--foreground)] font-playfair" style={{ fontFamily: 'var(--font-playfair)' }}>
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={project.status} />
            {hasDueDate && dueDateText && (
              <span className="flex items-center gap-1 text-[var(--foreground)]/70 font-medium">
                Due {dueDateText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme selector - only show when on a tab */}
          {tabId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <Palette className="h-3.5 w-3.5" />
                  Theme
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Background Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TAB_THEMES.map((theme) => (
                  <DropdownMenuItem
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border border-[var(--border)] flex-shrink-0",
                        tabTheme === theme.id && "ring-2 ring-[var(--foreground)]"
                      )}
                      style={theme.containerBg ? { background: theme.containerBg } : undefined}
                    />
                    <span>{theme.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Public Link Toggle */}
          <ClientPageToggle
            projectId={project.id}
            clientPageEnabled={project.client_page_enabled || false}
            publicToken={project.public_token || null}
            clientCommentsEnabled={project.client_comments_enabled || false}
            clientEditingEnabled={project.client_editing_enabled || false}
            tabs={tabs}
          />

          {/* Manage Access Button */}
          {(workspaceId || project.workspace_id) && (
            <button
              onClick={() => setIsPermissionsDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm"
            >
              <Users className="h-3.5 w-3.5" />
              Manage Access
            </button>
          )}

          <button className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm">
            <Edit className="h-3.5 w-3.5" />
            Edit details
          </button>
        </div>
      </div>

      {/* Project Permissions Dialog */}
      {(workspaceId || project.workspace_id) && (
        <ProjectPermissionsDialog
          isOpen={isPermissionsDialogOpen}
          onClose={() => setIsPermissionsDialogOpen(false)}
          projectId={project.id}
          projectName={project.name}
          workspaceId={workspaceId || project.workspace_id || ""}
          onSuccess={() => {
            // Optionally refresh the project data
            router.refresh();
          }}
        />
      )}
    </div>
  );
}