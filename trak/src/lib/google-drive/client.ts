import { createServiceClient } from "@/lib/supabase/service";
import { decryptDriveToken, encryptDriveToken } from "./encryption";
import { refreshGoogleAccessToken } from "./oauth";
import type { DriveAssetInput, DriveConnectionRecord, GoogleDriveFile, GoogleDriveListResponse } from "./types";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const MAX_RETRIES = 3;

function toExpiry(expiresInSeconds?: number | null) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function isTokenLikelyExpired(tokenExpiry?: string | null) {
  if (!tokenExpiry) return true;
  return Date.now() >= new Date(tokenExpiry).getTime() - 60_000;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : 0;
  }
  return 0;
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    const shouldRetry = status === 429 || status >= 500;
    if (!shouldRetry || attempt >= MAX_RETRIES - 1) {
      throw error;
    }

    const backoffMs = 200 * Math.pow(2, attempt);
    await sleep(backoffMs);
    return withRetry(fn, attempt + 1);
  }
}

function normalizeDriveFile(file: GoogleDriveFile) {
  const itemKind = file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file";
  const sizeBytes = file.size ? Number(file.size) : undefined;
  return {
    providerItemId: file.id,
    itemKind,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    thumbnailLink: file.thumbnailLink,
    iconLink: file.iconLink,
    sizeBytes,
    modifiedTime: file.modifiedTime,
    ownerDisplay: file.owners?.[0]?.displayName,
    staleState: file.trashed ? "trashed" : "active",
  } as const;
}

export class DriveAuthError extends Error {
  code: "reconnect_required" | "connection_missing";

  constructor(code: "reconnect_required" | "connection_missing", message: string) {
    super(message);
    this.code = code;
  }
}

export async function getDriveConnection(workspaceId: string): Promise<DriveConnectionRecord> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("drive_connections")
    .select("id, workspace_id, google_account_email, access_token_encrypted, refresh_token_encrypted, encryption_key_id, token_expiry, scopes")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new DriveAuthError("connection_missing", "Google Drive is not connected for this workspace");
  }

  return data as DriveConnectionRecord;
}

export async function updateDriveConnectionTokens(params: {
  connectionId: string;
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string | null;
  scopes?: string[];
}) {
  const supabase = await createServiceClient();
  const encryptedAccessToken = await encryptDriveToken(params.accessToken);
  const updatePayload: Record<string, unknown> = {
    access_token_encrypted: encryptedAccessToken.encrypted,
    encryption_key_id: encryptedAccessToken.keyId,
    token_expiry: toExpiry(params.expiresIn),
  };

  if (params.refreshToken) {
    const encryptedRefreshToken = await encryptDriveToken(params.refreshToken);
    updatePayload.refresh_token_encrypted = encryptedRefreshToken.encrypted;
  }

  if (params.scopes) {
    updatePayload.scopes = params.scopes;
  }

  const { error } = await supabase
    .from("drive_connections")
    .update(updatePayload)
    .eq("id", params.connectionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getValidDriveAccessToken(workspaceId: string): Promise<{ connection: DriveConnectionRecord; accessToken: string }> {
  const connection = await getDriveConnection(workspaceId);

  let accessToken = await decryptDriveToken(connection.access_token_encrypted);

  if (!isTokenLikelyExpired(connection.token_expiry)) {
    return { connection, accessToken };
  }

  if (!connection.refresh_token_encrypted) {
    throw new DriveAuthError(
      "reconnect_required",
      "Google Drive refresh token is missing. Reconnect with consent to continue."
    );
  }

  const refreshToken = await decryptDriveToken(connection.refresh_token_encrypted);

  let refreshed;
  try {
    refreshed = await refreshGoogleAccessToken(refreshToken);
  } catch {
    throw new DriveAuthError("reconnect_required", "Google Drive token refresh failed. Reconnect required.");
  }

  accessToken = refreshed.access_token;

  await updateDriveConnectionTokens({
    connectionId: connection.id,
    accessToken,
    expiresIn: refreshed.expires_in,
    scopes: refreshed.scope ? refreshed.scope.split(" ") : connection.scopes,
  });

  return { connection, accessToken };
}

async function driveRequest<T>(workspaceId: string, url: string, init?: RequestInit): Promise<T> {
  const call = async () => {
    const { accessToken } = await getValidDriveAccessToken(workspaceId);
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Google Drive API error (${response.status}): ${body}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  };

  return withRetry(call);
}

export async function fetchDriveItemsByIds(workspaceId: string, fileIds: string[]) {
  const unique = Array.from(new Set(fileIds.filter(Boolean)));
  const results: DriveAssetInput[] = [];

  for (const fileId of unique) {
    try {
      const file = await driveRequest<GoogleDriveFile>(
        workspaceId,
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,size,trashed,owners(displayName)&supportsAllDrives=true`
      );
      results.push(normalizeDriveFile(file));
    } catch (error: unknown) {
      const status = getErrorStatus(error);
      if (status === 403 || status === 404) {
        results.push({
          providerItemId: fileId,
          itemKind: "file",
          name: "Unavailable file",
          staleState: status === 404 ? "not_found" : "active",
        });
        continue;
      }
      throw error;
    }
  }

  return results;
}

export async function listDriveFolderContents(workspaceId: string, folderId: string, pageToken?: string) {
  const query = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    pageSize: "50",
    fields: "nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,size,trashed,owners(displayName))",
    orderBy: "folder,name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });

  if (pageToken) params.set("pageToken", pageToken);

  const data = await driveRequest<GoogleDriveListResponse>(workspaceId, `${DRIVE_API_BASE}/files?${params.toString()}`);
  return {
    files: (data.files || []).map(normalizeDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

export async function searchDriveItems(params: {
  workspaceId: string;
  query?: string;
  parentId?: string;
  foldersOnly?: boolean;
  pageToken?: string;
  source?: "all" | "my_drive" | "shared_drives";
}) {
  const clauses: string[] = ["trashed=false"];

  if (params.parentId) {
    clauses.push(`'${params.parentId.replace(/'/g, "\\'")}' in parents`);
  }

  if (params.query) {
    const escaped = params.query.replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  if (params.foldersOnly) {
    clauses.push("mimeType='application/vnd.google-apps.folder'");
  }

  if (params.source === "my_drive") {
    clauses.push("'me' in owners");
  } else if (params.source === "shared_drives") {
    clauses.push("not 'me' in owners");
  }

  const query = clauses.join(" and ");

  const searchParams = new URLSearchParams({
    q: query,
    pageSize: "30",
    fields: "nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,size,trashed,owners(displayName))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
    orderBy: "folder,name",
  });

  if (params.pageToken) searchParams.set("pageToken", params.pageToken);

  const data = await driveRequest<GoogleDriveListResponse>(params.workspaceId, `${DRIVE_API_BASE}/files?${searchParams.toString()}`);
  return {
    files: (data.files || []).map(normalizeDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

export async function createDriveFolder(params: { workspaceId: string; name: string; parentId?: string }) {
  const payload: Record<string, unknown> = {
    name: params.name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (params.parentId) {
    payload.parents = [params.parentId];
  }

  const file = await driveRequest<GoogleDriveFile>(
    params.workspaceId,
    `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,iconLink,modifiedTime,size,trashed,owners(displayName)`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  return normalizeDriveFile(file);
}
