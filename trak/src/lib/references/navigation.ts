import { buildProjectTabPath } from "@/lib/dashboard-routes";

export function getReferenceHref(input: {
  reference_type: string;
  reference_id: string;
  tab_id?: string | null;
  project_id?: string | null;
  tab_name?: string | null;
  project_name?: string | null;
  is_workflow?: boolean;
}): string | null {
  if (input.reference_type === "doc") {
    return `/dashboard/docs/${input.reference_id}`;
  }

  if (input.reference_type === "task") {
    if (input.tab_id) {
      if (input.is_workflow) {
        return `/dashboard/workflow/${input.tab_id}#task-${input.reference_id}`;
      }
      if (!input.project_id || !input.project_name || !input.tab_name) {
        return null;
      }
      return `${buildProjectTabPath(input.project_id, input.tab_id, input.project_name, input.tab_name)}#task-${input.reference_id}`;
    }
    return null;
  }

  if (input.reference_type === "block" && input.tab_id) {
    if (input.is_workflow) {
      return `/dashboard/workflow/${input.tab_id}#block-${input.reference_id}`;
    }
    if (!input.project_id || !input.project_name || !input.tab_name) {
      return null;
    }
    return `${buildProjectTabPath(input.project_id, input.tab_id, input.project_name, input.tab_name)}#block-${input.reference_id}`;
  }

  return null;
}

export function getLinkableItemHref(input: {
  referenceType: string;
  id: string;
  tabId?: string;
  projectId?: string | null;
  tabName?: string | null;
  projectName?: string | null;
  isWorkflow?: boolean;
}): string | null {
  if (input.referenceType === "doc") {
    return `/dashboard/docs/${input.id}`;
  }

  if (input.referenceType === "person") {
    return `#member-${input.id}`;
  }

  if (input.referenceType === "block" && input.tabId) {
    if (input.isWorkflow) {
      return `/dashboard/workflow/${input.tabId}#block-${input.id}`;
    }
    if (!input.projectId || !input.projectName || !input.tabName) {
      return null;
    }
    return `${buildProjectTabPath(input.projectId, input.tabId, input.projectName, input.tabName)}#block-${input.id}`;
  }

  if (input.referenceType === "task" && input.tabId) {
    if (input.isWorkflow) {
      return `/dashboard/workflow/${input.tabId}#task-${input.id}`;
    }
    if (!input.projectId || !input.projectName || !input.tabName) {
      return null;
    }
    return `${buildProjectTabPath(input.projectId, input.tabId, input.projectName, input.tabName)}#task-${input.id}`;
  }

  return null;
}
