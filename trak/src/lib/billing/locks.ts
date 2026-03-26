import { cache } from "react";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { createServiceClient } from "@/lib/supabase/service";

export interface WorkspacePlanLockState {
  workspaceId: string;
  lockedProjectIds: string[];
  lockedTabIds: string[];
  lockedBlockIds: string[];
}

export const getWorkspacePlanLockState = cache(async (workspaceId: string): Promise<WorkspacePlanLockState> => {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  const projectLimit = entitlements.maxProjectsPerWorkspace;
  const tabLimit = entitlements.maxTopLevelTabsPerProject;
  const blockLimit = entitlements.maxTopLevelBlocksPerTab;

  if (projectLimit == null && tabLimit == null && blockLimit == null) {
    return {
      workspaceId,
      lockedProjectIds: [],
      lockedTabIds: [],
      lockedBlockIds: [],
    };
  }

  const supabase = await createServiceClient();
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_type, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (projectsError) {
    throw new Error(`Failed to load workspace projects for plan locking: ${projectsError.message}`);
  }

  const orderedProjects = projects ?? [];
  const regularProjects = orderedProjects.filter((project: any) => project.project_type !== "internal");
  const internalProjects = orderedProjects.filter((project: any) => project.project_type === "internal");
  const unlockedRegularProjects = projectLimit == null ? regularProjects : regularProjects.slice(0, projectLimit);
  const lockedRegularProjectIds = projectLimit == null ? [] : regularProjects.slice(projectLimit).map((project) => String(project.id));
  const unlockedInternalProjects = internalProjects.slice(0, 1);
  const lockedInternalProjectIds = internalProjects.slice(1).map((project) => String(project.id));
  const unlockedProjects = [...unlockedRegularProjects, ...unlockedInternalProjects];
  const lockedProjectIds = [...lockedRegularProjectIds, ...lockedInternalProjectIds];
  const unlockedProjectIds = unlockedProjects.map((project) => String(project.id));

  if (tabLimit == null && blockLimit == null) {
    return {
      workspaceId,
      lockedProjectIds,
      lockedTabIds: [],
      lockedBlockIds: [],
    };
  }

  const { data: tabs, error: tabsError } = await supabase
    .from("tabs")
    .select("id, project_id, parent_tab_id, position, created_at")
    .in("project_id", unlockedProjectIds.length > 0 ? unlockedProjectIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (tabsError) {
    throw new Error(`Failed to load workspace tabs for plan locking: ${tabsError.message}`);
  }

  const tabsByProject = new Map<string, Array<any>>();
  const tabsByParent = new Map<string, string[]>();
  for (const tab of tabs ?? []) {
    const projectTabs = tabsByProject.get(String(tab.project_id)) ?? [];
    projectTabs.push(tab);
    tabsByProject.set(String(tab.project_id), projectTabs);

    if (tab.parent_tab_id) {
      const children = tabsByParent.get(String(tab.parent_tab_id)) ?? [];
      children.push(String(tab.id));
      tabsByParent.set(String(tab.parent_tab_id), children);
    }
  }

  const lockedTabIds = new Set<string>();
  const unlockedTabIds = new Set<string>();

  const lockTabTree = (tabId: string) => {
    if (lockedTabIds.has(tabId)) return;
    lockedTabIds.add(tabId);
    const children = tabsByParent.get(tabId) ?? [];
    for (const childId of children) {
      lockTabTree(childId);
    }
  };

  for (const projectId of unlockedProjectIds) {
    const projectTabs = tabsByProject.get(projectId) ?? [];
    const topLevelTabs = projectTabs.filter((tab) => tab.parent_tab_id == null);
    const unlockedTopLevelTabs = tabLimit == null ? topLevelTabs : topLevelTabs.slice(0, tabLimit);

    for (const tab of unlockedTopLevelTabs) {
      unlockedTabIds.add(String(tab.id));
    }

    if (tabLimit != null) {
      for (const tab of topLevelTabs.slice(tabLimit)) {
        lockTabTree(String(tab.id));
      }
    }

    for (const tab of projectTabs) {
      if (tab.parent_tab_id && !lockedTabIds.has(String(tab.id))) {
        unlockedTabIds.add(String(tab.id));
      }
    }
  }

  if (blockLimit == null) {
    return {
      workspaceId,
      lockedProjectIds,
      lockedTabIds: Array.from(lockedTabIds),
      lockedBlockIds: [],
    };
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("id, tab_id, position, column, created_at")
    .in("tab_id", unlockedTabIds.size > 0 ? Array.from(unlockedTabIds) : ["00000000-0000-0000-0000-000000000000"])
    .is("parent_block_id", null)
    .order("column", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (blocksError) {
    throw new Error(`Failed to load workspace blocks for plan locking: ${blocksError.message}`);
  }

  const blocksByTab = new Map<string, Array<any>>();
  for (const block of blocks ?? []) {
    const tabBlocks = blocksByTab.get(String(block.tab_id)) ?? [];
    tabBlocks.push(block);
    blocksByTab.set(String(block.tab_id), tabBlocks);
  }

  const lockedBlockIds = new Set<string>();
  for (const [tabId, tabBlocks] of blocksByTab.entries()) {
    for (const block of tabBlocks.slice(blockLimit)) {
      lockedBlockIds.add(String(block.id));
    }
  }

  return {
    workspaceId,
    lockedProjectIds,
    lockedTabIds: Array.from(lockedTabIds),
    lockedBlockIds: Array.from(lockedBlockIds),
  };
});
