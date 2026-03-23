export const PROJECT_CLIENT_TAB_VISIBILITY_EVENT =
  "project-client-tab-visibility-changed";

export interface ProjectClientTabVisibilityDetail {
  projectId: string;
  tabId: string;
  isClientVisible: boolean;
}

export function dispatchProjectClientTabVisibilityChanged(
  detail: ProjectClientTabVisibilityDetail
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ProjectClientTabVisibilityDetail>(
      PROJECT_CLIENT_TAB_VISIBILITY_EVENT,
      { detail }
    )
  );
}
