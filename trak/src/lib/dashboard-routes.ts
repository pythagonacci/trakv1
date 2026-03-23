const READABLE_ENTITY_ID_DELIMITER = "~";
const LEGACY_READABLE_ENTITY_ID_DELIMITER = "--";
const DEFAULT_READABLE_ENTITY_SLUG = "item";
const DEFAULT_UNTITLED_SLUG = "untitled";
const SHORT_READABLE_ID_LENGTH = 8;

export function slugifyUrlSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 60) || DEFAULT_READABLE_ENTITY_SLUG;
}

function normalizeReadableEntityId(entityId: string): string {
  return entityId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getShortReadableId(entityId?: string | null): string | null {
  if (!entityId) return null;

  const normalizedId = normalizeReadableEntityId(entityId);
  if (!normalizedId) return null;

  return normalizedId.slice(0, SHORT_READABLE_ID_LENGTH) || null;
}

export function decodeReadableEntityParam(param: string): {
  slug: string;
  shortId: string | null;
} {
  const trimmedParam = param.trim();
  const legacyDelimiterIndex = trimmedParam.lastIndexOf(LEGACY_READABLE_ENTITY_ID_DELIMITER);

  if (legacyDelimiterIndex > 0) {
    const slugPart = trimmedParam.slice(0, legacyDelimiterIndex);
    const shortIdPart = normalizeReadableEntityId(
      trimmedParam.slice(legacyDelimiterIndex + LEGACY_READABLE_ENTITY_ID_DELIMITER.length)
    );

    if (shortIdPart) {
      return {
        slug: slugifyUrlSegment(slugPart),
        shortId: shortIdPart,
      };
    }
  }

  const delimiterIndex = trimmedParam.lastIndexOf(READABLE_ENTITY_ID_DELIMITER);
  if (delimiterIndex > 0) {
    const slugPart = trimmedParam.slice(0, delimiterIndex);
    const shortIdPart = normalizeReadableEntityId(
      trimmedParam.slice(delimiterIndex + READABLE_ENTITY_ID_DELIMITER.length)
    );

    if (shortIdPart) {
      return {
        slug: slugifyUrlSegment(slugPart),
        shortId: shortIdPart,
      };
    }
  }

  return {
    slug: slugifyUrlSegment(trimmedParam),
    shortId: null,
  };
}

export function encodeReadableId(label?: string | null, entityId?: string | null): string {
  const trimmedLabel = label?.trim();
  const slug = trimmedLabel
    ? slugifyUrlSegment(trimmedLabel)
    : slugifyUrlSegment(DEFAULT_UNTITLED_SLUG);
  const shortId = getShortReadableId(entityId);

  return shortId ? `${slug}${READABLE_ENTITY_ID_DELIMITER}${shortId}` : slug;
}

function readableEntityIdMatchesShortId(shortId: string, entityId?: string | null): boolean {
  if (!entityId) return false;
  return normalizeReadableEntityId(entityId).startsWith(shortId);
}

export function matchesReadableEntity(
  param: string,
  label?: string | null,
  entityId?: string | null
): boolean {
  if (!label) return false;

  const decodedParam = decodeReadableEntityParam(param);
  if (decodedParam.shortId && entityId) {
    return readableEntityIdMatchesShortId(decodedParam.shortId, entityId);
  }

  return decodedParam.slug === slugifyUrlSegment(label);
}

export function isCanonicalReadableParam(
  param: string,
  label?: string | null,
  entityId?: string | null
): boolean {
  if (!label) return true;
  return param.trim() === encodeReadableId(label, entityId);
}

export function buildProjectPath(projectId: string, projectName: string): string {
  return `/dashboard/projects/${encodeReadableId(projectName, projectId)}`;
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
  return `${buildProjectPath(projectId, projectName)}/tabs/${encodeReadableId(tabName, tabId)}`;
}
