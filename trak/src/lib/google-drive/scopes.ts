/**
 * Scope rationale (least privilege):
 * - drive.readonly: needed to list/search/link metadata for existing files and folder contents, including Shared Drives.
 * - drive.file: needed for v1 create-folder flow in mapped project folders without requesting broad full-drive write scope.
 *
 * We intentionally avoid the broad `drive` scope in v1.
 */
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const GOOGLE_DRIVE_SCOPE_STRING = GOOGLE_DRIVE_SCOPES.join(" ");
