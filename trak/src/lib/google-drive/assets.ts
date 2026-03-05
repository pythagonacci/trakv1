import { createServiceClient } from "@/lib/supabase/service";
import type { DriveAssetInput } from "./types";

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) throw new Error("Not a member of this workspace");
  return membership;
}

export async function requireWorkspaceAdmin(workspaceId: string, userId: string) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Only workspace admins can manage the Google Drive connection");
  }
  return membership;
}

export async function requireProjectAccess(projectId: string, userId: string) {
  const supabase = await createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Project not found");

  const membership = await requireWorkspaceMember(project.workspace_id, userId);

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", project.workspace_id)
    .maybeSingle();

  if (workspaceError) throw new Error(workspaceError.message);
  if (workspace?.owner_id === userId) {
    return project;
  }

  const { count, error: restrictionError } = await supabase
    .from("project_members")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (restrictionError) throw new Error(restrictionError.message);

  const isRestricted = (count ?? 0) > 0;
  if (isRestricted) {
    const { data: projectMember, error: projectMemberError } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (projectMemberError) throw new Error(projectMemberError.message);
    if (!projectMember) throw new Error("You do not have access to this project");
  } else if (!membership) {
    throw new Error("You do not have access to this project");
  }

  return project;
}

export async function requireEntityAccess(params: {
  workspaceId: string;
  userId: string;
  entityType: string;
  entityId: string;
}) {
  const supabase = await createServiceClient();

  await requireWorkspaceMember(params.workspaceId, params.userId);

  if (params.entityType === "project") {
    await requireProjectAccess(params.entityId, params.userId);
    return;
  }

  if (params.entityType === "tab") {
    const { data: tab, error } = await supabase
      .from("tabs")
      .select("id, project_id")
      .eq("id", params.entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tab) throw new Error("Tab not found");
    await requireProjectAccess(tab.project_id, params.userId);
    return;
  }

  if (params.entityType === "block") {
    const { data: block, error } = await supabase
      .from("blocks")
      .select("id, tab_id")
      .eq("id", params.entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!block) throw new Error("Block not found");
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", block.tab_id)
      .maybeSingle();
    if (tabError) throw new Error(tabError.message);
    if (!tab) throw new Error("Tab not found");
    await requireProjectAccess(tab.project_id, params.userId);
    return;
  }

  if (params.entityType === "task") {
    const { data: task, error } = await supabase
      .from("task_items")
      .select("id, tab_id")
      .eq("id", params.entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("Task not found");
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", task.tab_id)
      .maybeSingle();
    if (tabError) throw new Error(tabError.message);
    if (!tab) throw new Error("Tab not found");
    await requireProjectAccess(tab.project_id, params.userId);
    return;
  }
}

export async function upsertExternalAssets(params: {
  workspaceId: string;
  userId: string;
  assets: DriveAssetInput[];
}) {
  if (!params.assets.length) return [];

  const supabase = await createServiceClient();

  const rows = params.assets.map((asset) => ({
    workspace_id: params.workspaceId,
    provider: "google_drive",
    provider_item_id: asset.providerItemId,
    item_kind: asset.itemKind,
    name: asset.name,
    mime_type: asset.mimeType ?? null,
    web_view_link: asset.webViewLink ?? null,
    web_content_link: asset.webContentLink ?? null,
    thumbnail_link: asset.thumbnailLink ?? null,
    icon_link: asset.iconLink ?? null,
    size_bytes: asset.sizeBytes ?? null,
    modified_time: asset.modifiedTime ?? null,
    owner_display: asset.ownerDisplay ?? null,
    stale_state: asset.staleState ?? "active",
    created_by: params.userId,
  }));

  const { data, error } = await supabase
    .from("external_assets")
    .upsert(rows, { onConflict: "workspace_id,provider,provider_item_id" })
    .select("id, workspace_id, provider, provider_item_id, item_kind, name, mime_type, web_view_link, web_content_link, thumbnail_link, icon_link, size_bytes, modified_time, owner_display, stale_state");

  if (error) throw new Error(error.message);

  return data || [];
}

export async function linkAssetsToEntity(params: {
  workspaceId: string;
  userId: string;
  entityType: string;
  entityId: string;
  assetIds: string[];
}) {
  if (!params.assetIds.length) return [];
  const supabase = await createServiceClient();

  const rows = params.assetIds.map((assetId) => ({
    workspace_id: params.workspaceId,
    asset_id: assetId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    created_by: params.userId,
  }));

  const { data, error } = await supabase
    .from("asset_links")
    .upsert(rows, { onConflict: "workspace_id,asset_id,entity_type,entity_id" })
    .select("id, asset_id, entity_type, entity_id");

  if (error) throw new Error(error.message);
  return data || [];
}

export async function removeAssetLink(params: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  assetId: string;
}) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("asset_links")
    .delete()
    .eq("workspace_id", params.workspaceId)
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .eq("asset_id", params.assetId);

  if (error) throw new Error(error.message);
}

export async function getEntityAssets(params: {
  workspaceId: string;
  entityType: string;
  entityId: string;
}) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("asset_links")
    .select(`
      id,
      entity_type,
      entity_id,
      asset:external_assets (
        id,
        provider,
        provider_item_id,
        item_kind,
        name,
        mime_type,
        web_view_link,
        web_content_link,
        thumbnail_link,
        icon_link,
        size_bytes,
        modified_time,
        owner_display,
        stale_state,
        created_at
      )
    `)
    .eq("workspace_id", params.workspaceId)
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function setProjectDriveFolder(params: {
  workspaceId: string;
  projectId: string;
  userId: string;
  driveFolderAssetId: string;
}) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("project_drive_folders")
    .upsert(
      {
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        drive_folder_asset_id: params.driveFolderAssetId,
        created_by: params.userId,
      },
      { onConflict: "project_id" }
    )
    .select("id, project_id, workspace_id, drive_folder_asset_id, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProjectDriveFolder(projectId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("project_drive_folders")
    .select(`
      id,
      project_id,
      workspace_id,
      drive_folder_asset_id,
      asset:external_assets (
        id,
        provider_item_id,
        name,
        web_view_link,
        mime_type,
        icon_link,
        modified_time,
        owner_display
      )
    `)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function logDriveAuditEvent(params: {
  workspaceId: string;
  userId?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServiceClient();
  await supabase.from("google_drive_audit_log").insert({
    workspace_id: params.workspaceId,
    created_by: params.userId ?? null,
    event_type: params.eventType,
    metadata: params.metadata || {},
  });
}
