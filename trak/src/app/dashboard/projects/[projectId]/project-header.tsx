"use client";

import { ArrowLeft, LayoutDashboard, ChevronUp, ChevronDown, PanelRightOpen, PanelRightClose, Settings, FolderOpen } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../../projects/status-badge";
import ClientPageToggle from "./client-page-toggle";
import ProjectPermissionsDialog from "../project-permissions-dialog";
import TabBar from "./tab-bar";
import ProjectDialog from "../project-dialog";
import { updateProject } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseDateSafe } from "@/lib/due-date";
import {
  buildProjectDrivePath,
  buildProjectGoogleDrivePath,
  buildProjectOverviewPath,
} from "@/lib/dashboard-routes";
import { useTabContents } from "./tabs/[tabId]/tab-contents-context";

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
    priority?: string | null;
    tags?: string[] | null;
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
  const tabContents = useTabContents();
  const hasBlocks = tabContents && tabContents.blocks.length > 0;
  const router = useRouter();
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTabBarOpen, setIsTabBarOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; company?: string }[]>([]);

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

  const formatDueDate = () => {
    if (project.due_date_text) {
      return project.due_date_text;
    }
    if (project.due_date_date) {
      const date = parseDateSafe(project.due_date_date);
      if (!date) return null;
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
  const isDrivePage = pathname?.endsWith("/drive");
  const projectOverviewPath = buildProjectOverviewPath(project.id, project.name);
  const projectDrivePath = buildProjectDrivePath(project.id, project.name);

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
          <div className="flex items-center gap-1">
            {hasBlocks && (
              <button
                onClick={() => tabContents?.setTocExpanded((prev) => !prev)}
                className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80 transition-colors rounded hover:bg-[var(--surface-hover)]"
                title={tabContents?.tocExpanded ? "Collapse contents" : "Show contents"}
              >
                {tabContents?.tocExpanded ? (
                  <PanelRightClose className="h-2.5 w-2.5" />
                ) : (
                  <PanelRightOpen className="h-2.5 w-2.5" />
                )}
                <span>Contents</span>
              </button>
            )}
            <button
              onClick={handleCollapseToggle}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80 transition-colors rounded hover:bg-[var(--surface-hover)]"
              title="Expand header"
            >
              <ChevronDown className="h-2.5 w-2.5" />
              Expand
            </button>
          </div>
        </div>
        {/* TabBar shown when dropdown is open */}
        {isTabBarOpen && (
          <div className="border-b border-[var(--border)]/50 bg-[var(--surface)]/50 backdrop-blur-sm">
            <div className="px-2 md:px-3 lg:px-4">
              <TabBar 
                tabs={tabs} 
                projectId={project.id}
                projectName={project.name}
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
        {!isDrivePage && (
          <button
            onClick={() => router.push(projectDrivePath)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
          >
            <FolderOpen className="h-3 w-3" />
            Drive
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
            {project.priority && (
              <span className="rounded-[2px] border border-[var(--border)] bg-[var(--surface-hover)] px-1.5 py-0.5 font-medium capitalize text-[var(--foreground)]/80">
                {project.priority}
              </span>
            )}
            {project.tags && project.tags.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[2px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                  >
                    {tag}
                  </span>
                ))}
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

          {/* Public Link Toggle */}
          <ClientPageToggle
            projectId={project.id}
            clientPageEnabled={project.client_page_enabled || false}
            publicToken={project.public_token || null}
            clientCommentsEnabled={project.client_comments_enabled || false}
            clientEditingEnabled={project.client_editing_enabled || false}
            tabs={tabs}
          />

          {/* Project settings: Edit details + Manage Access */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm"
                title="Project settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                Edit details
              </DropdownMenuItem>
              {(workspaceId || project.workspace_id) && (
                <DropdownMenuItem onClick={() => setIsPermissionsDialogOpen(true)}>
                  Manage Access
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push(buildProjectGoogleDrivePath(project.id, project.name))}>
                Google Drive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contents button - at bottom of header when expanded */}
      {hasBlocks && tabId && (
        <div className="flex justify-end pt-2 pb-0.5">
          <button
            onClick={() => tabContents?.setTocExpanded((prev) => !prev)}
            className="hidden lg:inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm"
            title={tabContents?.tocExpanded ? "Collapse table of contents" : "Show table of contents"}
          >
            {tabContents?.tocExpanded ? (
              <>
                <PanelRightClose className="h-3 w-3" />
                Contents
              </>
            ) : (
              <>
                <PanelRightOpen className="h-3 w-3" />
                Contents
              </>
            )}
          </button>
        </div>
      )}

      {/* Project Permissions Dialog */}
      {(workspaceId || project.workspace_id) && (
        <ProjectPermissionsDialog
          isOpen={isPermissionsDialogOpen}
          onClose={() => setIsPermissionsDialogOpen(false)}
          projectId={project.id}
          projectName={project.name}
          workspaceId={workspaceId || project.workspace_id || ""}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Edit Project Dialog */}
      {workspaceId && (
        <ProjectDialog
          mode="edit"
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSubmit={async (formData) => {
            let due_date_date: string | null = null;
            let due_date_text: string | null = null;
            if (formData.due_date.trim()) {
              const dateTest = new Date(formData.due_date);
              if (!isNaN(dateTest.getTime())) {
                due_date_date = formData.due_date;
              } else {
                due_date_text = formData.due_date;
              }
            }
            const result = await updateProject(project.id, {
              name: formData.name,
              client_id: formData.client_id || null,
              status: formData.status,
              due_date_date,
              due_date_text,
              priority: formData.priority ?? null,
            });
            if ("error" in result) throw new Error(result.error);
            setIsEditDialogOpen(false);
            router.refresh();
          }}
          initialData={{
            id: project.id,
            name: project.name,
            status: project.status,
            due_date_date: project.due_date_date ?? null,
            due_date_text: project.due_date_text ?? null,
            priority: (project.priority as "low" | "medium" | "high" | "urgent" | null) ?? null,
            tags: project.tags ?? [],
            client_id: project.client?.id ?? null,
            client_name: project.client?.name ?? null,
          }}
          workspaceId={workspaceId}
          clients={clients}
          onClientsLoad={setClients}
        />
      )}
    </div>
  );
}
