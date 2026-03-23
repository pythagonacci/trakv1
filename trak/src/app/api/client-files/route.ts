import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_FILE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/msword": [".doc"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/ogg": [".ogg"],
  "video/quicktime": [".mov"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/ogg": [".ogg"],
  "application/zip": [".zip"],
  "application/x-rar-compressed": [".rar"],
  "text/csv": [".csv"],
} as const;

const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".pif",
  ".vbs",
  ".js",
  ".jse",
  ".msi",
  ".msp",
  ".hta",
  ".cpl",
  ".jar",
  ".sh",
  ".bash",
  ".ps1",
  ".psm1",
  ".dll",
  ".sys",
  ".drv",
  ".app",
  ".deb",
  ".rpm",
  ".dmg",
  ".pkg",
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function validateFileType(file: File): string | null {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  const extension = `.${fileName.split(".").pop() || ""}`;

  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    return `File type not allowed: ${extension}. Executable and script files are blocked for security.`;
  }

  const allowedExtensions =
    ALLOWED_FILE_TYPES[fileType as keyof typeof ALLOWED_FILE_TYPES];
  if (!allowedExtensions) {
    const allAllowedExtensions = Object.values(ALLOWED_FILE_TYPES).flat();
    if (!allAllowedExtensions.includes(extension)) {
      return `File type not supported: ${extension}. Please upload images, documents, videos, or archives only.`;
    }
  }

  return null;
}

function revalidateSurfaces(projectId: string, tabId: string, publicToken: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/tabs/${tabId}`);
  revalidatePath(`/client/${publicToken}`);
  revalidatePath(`/client/${publicToken}/${tabId}`);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const publicToken = formData.get("publicToken");
    const visitorId = formData.get("visitorId");
    const visitorName = formData.get("visitorName");
    const blockId = formData.get("blockId");
    const file = formData.get("file");

    if (
      typeof publicToken !== "string" ||
      typeof visitorId !== "string" ||
      typeof visitorName !== "string" ||
      typeof blockId !== "string" ||
      !(file instanceof File)
    ) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    if (!visitorName.trim()) {
      return NextResponse.json(
        { error: "Please provide your name before uploading." },
        { status: 400 }
      );
    }

    const rateLimit = checkRateLimit(
      `client-file-upload:${visitorId}:${getClientIp(request)}`,
      {
        maxRequests: 20,
        windowMs: 5 * 60 * 1000,
        message: "Too many uploads. Please wait a few minutes before trying again.",
      }
    );

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 });
    }

    const validationError = validateFileType(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id, type, locked")
      .eq("id", blockId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found." }, { status: 404 });
    }

    if (block.type !== "file") {
      return NextResponse.json(
        { error: "Uploads are only supported on file blocks." },
        { status: 403 }
      );
    }

    if (block.locked) {
      return NextResponse.json(
        { error: "This block is locked and cannot be edited." },
        { status: 403 }
      );
    }

    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, is_client_visible")
      .eq("id", block.tab_id)
      .single();

    if (tabError || !tab || !tab.is_client_visible) {
      return NextResponse.json(
        { error: "Editing is not enabled for this client page." },
        { status: 403 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, client_editing_enabled, public_token")
      .eq("id", tab.project_id)
      .single();

    if (
      projectError ||
      !project ||
      !project.client_page_enabled ||
      !project.client_editing_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: "Editing is not enabled for this client page." },
        { status: 403 }
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (workspaceError || !workspace?.owner_id) {
      return NextResponse.json(
        { error: "Workspace owner not found." },
        { status: 500 }
      );
    }

    const fileId = crypto.randomUUID();
    const fileExtension = file.name.includes(".")
      ? `.${file.name.split(".").pop()?.toLowerCase() || ""}`
      : "";
    const storagePath = `${project.workspace_id}/${project.id}/${fileId}${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("files")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const normalizedFileType =
      file.type && file.type !== "application/octet-stream"
        ? file.type
        : null;

    const { data: fileRecord, error: fileError } = await supabase
      .from("files")
      .insert({
        id: fileId,
        workspace_id: project.workspace_id,
        project_id: project.id,
        uploaded_by: workspace.owner_id,
        file_name: file.name,
        file_size: file.size,
        file_type: normalizedFileType,
        storage_path: storagePath,
      })
      .select("id, file_name, file_size, file_type, storage_path, created_at")
      .single();

    if (fileError || !fileRecord) {
      await supabase.storage.from("files").remove([storagePath]);
      throw new Error(fileError?.message || "Failed to create file record.");
    }

    const { error: attachmentError } = await supabase
      .from("file_attachments")
      .insert({
        file_id: fileId,
        block_id: block.id,
        display_mode: "inline",
      });

    if (attachmentError) {
      await supabase.from("files").delete().eq("id", fileId);
      await supabase.storage.from("files").remove([storagePath]);
      throw new Error(attachmentError.message);
    }

    const summary = `Uploaded file: ${file.name}`;
    const { data: activity, error: activityError } = await supabase
      .from("client_page_edits")
      .insert({
        workspace_id: project.workspace_id,
        project_id: project.id,
        tab_id: tab.id,
        block_id: block.id,
        visitor_id: visitorId,
        visitor_name: visitorName.trim(),
        summary,
        metadata: {
          block_type: "file",
          activity_type: "upload",
          file_id: fileId,
          file_name: file.name,
        },
      })
      .select("id")
      .single();

    if (activityError || !activity) {
      logger.error("Failed to record client file upload activity:", activityError);
    }

    try {
      const { createClientFileUploadNotification } = await import(
        "@/lib/notifications/service"
      );
      await createClientFileUploadNotification({
        workspaceId: project.workspace_id,
        projectId: project.id,
        tabId: tab.id,
        blockId: block.id,
        fileId,
        fileName: file.name,
        visitorName: visitorName.trim(),
      });
    } catch (notificationError) {
      logger.error("Client file upload notification error:", notificationError);
    }

    revalidateSurfaces(project.id, tab.id, publicToken);
    return NextResponse.json({ file: fileRecord });
  } catch (error) {
    logger.error("Client file upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file." },
      { status: 500 }
    );
  }
}
