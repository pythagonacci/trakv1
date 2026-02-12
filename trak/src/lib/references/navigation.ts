export function getReferenceHref(input: {
  reference_type: string;
  reference_id: string;
  tab_id?: string | null;
  project_id?: string | null;
  is_workflow?: boolean;
}): string | null {
  if (input.reference_type === "doc") {
    return `/dashboard/docs/${input.reference_id}`;
  }

  if (input.reference_type === "task") {
    if (input.tab_id) {
      if (input.is_workflow || !input.project_id) {
        return `/dashboard/workflow/${input.tab_id}#task-${input.reference_id}`;
      }
      return `/dashboard/projects/${input.project_id}/tabs/${input.tab_id}#task-${input.reference_id}`;
    }
    return null;
  }

  if (input.reference_type === "block" && input.tab_id) {
    if (input.is_workflow || !input.project_id) {
      return `/dashboard/workflow/${input.tab_id}#block-${input.reference_id}`;
    }
    return `/dashboard/projects/${input.project_id}/tabs/${input.tab_id}#block-${input.reference_id}`;
  }

  return null;
}

export function getLinkableItemHref(input: {
  referenceType: string;
  id: string;
  tabId?: string;
  projectId?: string | null;
  isWorkflow?: boolean;
}): string | null {
  if (input.referenceType === "doc") {
    return `/dashboard/docs/${input.id}`;
  }

  if (input.referenceType === "block" && input.tabId) {
    if (input.isWorkflow || !input.projectId) {
      return `/dashboard/workflow/${input.tabId}#block-${input.id}`;
    }
    return `/dashboard/projects/${input.projectId}/tabs/${input.tabId}#block-${input.id}`;
  }

  if (input.referenceType === "task" && input.tabId) {
    if (input.isWorkflow || !input.projectId) {
      return `/dashboard/workflow/${input.tabId}#task-${input.id}`;
    }
    return `/dashboard/projects/${input.projectId}/tabs/${input.tabId}#task-${input.id}`;
  }

  return null;
}
