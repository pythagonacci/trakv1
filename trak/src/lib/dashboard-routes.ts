export function slugifyUrlSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 60) || "item";
}

export function encodeReadableId(label?: string | null): string {
  const trimmedLabel = label?.trim();
  if (!trimmedLabel) return slugifyUrlSegment("untitled");
  return slugifyUrlSegment(trimmedLabel);
}

export function matchesReadableEntity(param: string, label?: string | null): boolean {
  if (!label) return false;
  return slugifyUrlSegment(param.trim()) === slugifyUrlSegment(label);
}

export function isCanonicalReadableParam(param: string, label?: string | null): boolean {
  if (!label) return true;
  return param.trim() === slugifyUrlSegment(label);
}

export function buildProjectPath(projectId: string, projectName: string): string {
  return `/dashboard/projects/${encodeReadableId(projectName)}`;
}

export function buildProjectOverviewPath(projectId: string, projectName: string): string {
  return `${buildProjectPath(projectId, projectName)}/overview`;
}

export function buildProjectDrivePath(projectId: string, projectName: string): string {
  return `${buildProjectPath(projectId, projectName)}/drive`;
}

export function buildProjectGoogleDrivePath(projectId: string, projectName: string): string {
  return `${buildProjectPath(projectId, projectName)}/integrations/google-drive`;
}

export function buildProjectTabPath(
  projectId: string,
  tabId: string,
  projectName: string,
  tabName: string
): string {
  return `${buildProjectPath(projectId, projectName)}/tabs/${encodeReadableId(tabName)}`;
}
