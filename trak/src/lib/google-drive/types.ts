export type DriveItemKind = "file" | "folder";

export interface DriveConnectionRecord {
  id: string;
  workspace_id: string;
  google_account_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  encryption_key_id: string;
  token_expiry: string | null;
  scopes: string[];
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  trashed?: boolean;
  owners?: Array<{ displayName?: string }>;
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export interface DriveAssetInput {
  providerItemId: string;
  itemKind: DriveItemKind;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  sizeBytes?: number;
  modifiedTime?: string;
  ownerDisplay?: string;
  staleState?: "active" | "not_found" | "trashed";
}
