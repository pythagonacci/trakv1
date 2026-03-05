# Google Drive Integration (v1)

## Scope
v1 delivers:
- Workspace-level Google Drive OAuth connection (admin-managed)
- Link Drive files/folders as first-class `external_assets`
- Entity linking via `asset_links` (project/task/block/doc/etc.)
- Project canonical Drive folder mapping (`project_drive_folders`)
- Project Drive listing endpoint and UI page
- Inline preview modal + Open in Drive

## Required Environment Variables
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)
- `NEXT_PUBLIC_APP_URL`
- Existing Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)

## OAuth Scopes and Rationale
Scopes are defined in [`src/lib/google-drive/scopes.ts`](/Users/amnaahmad/trakmainwt/trak/src/lib/google-drive/scopes.ts):
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.file`

Rationale:
- `drive.readonly` is required for picker/list/search/metadata and mapped-folder browsing.
- `drive.file` enables create-in-folder flows with narrower write scope than broad full-drive access.
- Broad `drive` scope is intentionally not requested.

## Shared Drives Support
Drive API list/search calls set:
- `supportsAllDrives=true`
- `includeItemsFromAllDrives=true`
- `corpora=allDrives`

This is used in picker search and project folder listing.

## Security Model
- OAuth access/refresh tokens are encrypted at rest (`AES-256-GCM`) and never sent to clients.
- All Drive API calls run on server routes only.
- Workspace/project/entity checks are enforced server-side before linking/listing/mapping.
- RLS policies protect all new Drive tables.

## Reliability Behaviors
- Access tokens are auto-refreshed before Drive API calls.
- Missing/revoked refresh token surfaces reconnect-required states.
- Drive API wrapper retries `429` and `5xx` with exponential backoff.
- Missing/trashed files are represented with stale state (`not_found` / `trashed`).
- Integration lifecycle and link/mapping events are audited in `google_drive_audit_log`.

## Known Limitations (v1)
- External collaborator magic-link behavior is conservative: Drive assets are not exposed through dedicated external-link surfaces.
- Inline preview uses Google embed/viewer URLs; final Drive access is enforced by Google at view time.
- Uploading native Trak files still defaults to existing Supabase upload flow.
