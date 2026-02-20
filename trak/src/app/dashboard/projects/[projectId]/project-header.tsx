"use client";

import { ArrowLeft, Edit, Palette, LayoutDashboard, Users, ChevronUp, ChevronDown } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../../projects/status-badge";
import ClientPageToggle from "./client-page-toggle";
import ProjectPermissionsDialog from "../project-permissions-dialog";
import TabBar from "./tab-bar";
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTabBarOpen, setIsTabBarOpen] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) return;
    const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
    if (saved && TAB_THEMES.some((t) => t.id === saved)) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Load collapsed state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-project-header-collapsed-${project.id}`);
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, [project.id]);

  // Close tab bar when tab changes
  useEffect(() => {
    setIsTabBarOpen(false);
  }, [tabId]);

  // Save collapsed state to localStorage
  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (typeof window !== "undefined") {
      localStorage.setItem(`trak-project-header-collapsed-${project.id}`, String(newCollapsed));
    }
    // Dispatch event so parent can react to collapse state
    window.dispatchEvent(new CustomEvent("project-header-collapse-changed", { 
      detail: { projectId: project.id, collapsed: newCollapsed } 
    }));
  };

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

  // Find current tab name
  const findTabName = (tabs: Tab[], tabId: string | undefined): string | null => {
    if (!tabId) return null;
    for (const tab of tabs) {
      if (tab.id === tabId) return tab.name;
      if (tab.children) {
        for (const child of tab.children) {
          if (child.id === tabId) return child.name;
        }
      }
    }
    return null;
  };

  const currentTabName = tabId ? findTabName(tabs, tabId) : null;


  // Collapsed view - only show when collapsed and on a tab
  if (isCollapsed && tabId && currentTabName) {
    return (
      <>
        <div className="flex items-center justify-between h-5 px-2 border-b border-[var(--border)]/30 bg-[var(--surface)]/50 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--foreground)]/70">
            <span className="font-medium truncate">{project.name}</span>
            <span className="text-[var(--foreground)]/30">·</span>
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[var(--foreground)]/50"></span>
              <span className="truncate">{currentTabName}</span>
              {tabs.length > 0 && (
                <button
                  onClick={() => setIsTabBarOpen(!isTabBarOpen)}
                  className="inline-flex items-center p-0.5 text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors rounded hover:bg-[var(--surface-hover)]"
                  title="Show tabs"
                >
                  <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isTabBarOpen && "rotate-180")} />
                </button>
              )}
            </span>
          </div>
          <button
            onClick={handleCollapseToggle}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80 transition-colors rounded hover:bg-[var(--surface-hover)]"
            title="Expand header"
          >
            <ChevronDown className="h-2.5 w-2.5" />
            Expand
          </button>
        </div>
        {/* TabBar shown when dropdown is open */}
        {isTabBarOpen && (
          <div className="border-b border-[var(--border)]/50 bg-[var(--surface)]/50 backdrop-blur-sm">
            <div className="px-2 md:px-3 lg:px-4">
              <TabBar 
                tabs={tabs} 
                projectId={project.id}
                isClientProject={!!project.client}
                clientPageEnabled={project.client_page_enabled || false}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <button
          onClick={() => router.push("/dashboard/projects")}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to projects
        </button>
        {!isOverview && (
          <button
            onClick={() => router.push(projectOverviewPath)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
          >
            <LayoutDashboard className="h-3 w-3" />
            Overview
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          {project.client && (
            <span className="inline-flex items-center gap-1 rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--velvet-purple)]">
              {project.client.name}
              {project.client.company && <span className="text-[var(--velvet-purple)]/70">· {project.client.company}</span>}
            </span>
          )}
          <h1 className="text-lg font-bold tracking-normal text-[var(--foreground)] md:text-xl">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <StatusBadge status={project.status} />
            {hasDueDate && dueDateText && (
              <span className="flex items-center gap-1 text-[var(--foreground)]/70 font-medium">
                Due {dueDateText}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Collapse button - only show when on a tab */}
          {tabId && (
            <button
              onClick={handleCollapseToggle}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm"
              title="Collapse header"
            >
              <ChevronUp className="h-3 w-3" />
              Collapse
            </button>
          )}

          {/* Theme selector - only show when on a tab */}
          {tabId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
                  <Palette className="h-3 w-3" />
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
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm"
            >
              <Users className="h-3 w-3" />
              Manage Access
            </button>
          )}

          <button className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm">
            <Edit className="h-3 w-3" />
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