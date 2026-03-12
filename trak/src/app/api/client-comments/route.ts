"use server";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { listBlockCommentRows, mapBlockCommentRow, syncBlockCommentsMirror } from "@/lib/block-comments";
import type { BlockComment } from "@/types/block-comment";

type CommentSource = "internal" | "external";

type BlockContext = {
  block: { id: string; tab_id: string };
  tab: { id: string; project_id: string; is_client_visible: boolean };
  project: {
    id: string;
    workspace_id: string;
    client_page_enabled: boolean;
    client_comments_enabled: boolean;
    public_token: string | null;
  };
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
};

const ERROR_MESSAGES = {
  forbidden: "Comments are not enabled for this client page.",
  invalid: "Invalid request payload.",
  missingName: "Please provide a display name before commenting.",
  missingBlock: "Block not found.",
  unauthorized: "You do not have permission to modify this comment.",
};

async function getBlockContext(blockId: string): Promise<BlockContext | { error: string }> {
  const supabase = await createServiceClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id")
    .eq("id", blockId)
    .single();
  if (blockError || !block) return { error: ERROR_MESSAGES.missingBlock };

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_client_visible")
    .eq("id", block.tab_id)
    .single();
  if (tabError || !tab || !tab.is_client_visible) return { error: ERROR_MESSAGES.forbidden };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id, client_page_enabled, client_comments_enabled, public_token")
    .eq("id", tab.project_id)
    .single();
  if (projectError || !project) return { error: ERROR_MESSAGES.forbidden };

  return { block, tab, project, supabase };
}

async function revalidateSurfaces(projectId: string, tabId: string, publicToken: string | null) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/tabs/${tabId}`);
  if (publicToken) {
    revalidatePath(`/client/${publicToken}`);
    revalidatePath(`/client/${publicToken}/${tabId}`);
  }
}

function buildAuthorId(visitorId: string) {
  return `client:${visitorId}`;
}

function isOwnExternalComment(comment: BlockComment, visitorId: string) {
  return comment.source === "external" && comment.author_id === buildAuthorId(visitorId);
}

function validateIncomingComment(text: unknown) {
  if (typeof text !== "string") return { error: ERROR_MESSAGES.invalid };
  const trimmed = text.trim();
  if (!trimmed) return { error: "Comment cannot be empty." };
  if (trimmed.length > 2000) return { error: "Comment is too long (2000 char max)." };
  return { text: trimmed };
}

async function loadCommentsForResponse(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  blockId: string
) {
  const rows = await listBlockCommentRows(supabase, blockId);
  await syncBlockCommentsMirror(supabase, blockId, rows);
  return rows.map(mapBlockCommentRow);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, text, authorName, visitorId } = body ?? {};

    if (typeof publicToken !== "string" || typeof blockId !== "string" || typeof visitorId !== "string") {
      return NextResponse.json({ error: ERROR_MESSAGES.invalid }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`comment:create:${visitorId}:${clientIp}`, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
      message: "Too many comments. Please wait a few minutes before commenting again.",
    });
    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }

    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      return NextResponse.json({ error: ERROR_MESSAGES.missingName }, { status: 400 });
    }

    const { text: validatedText, error: textError } = validateIncomingComment(text);
    if (textError || !validatedText) return NextResponse.json({ error: textError }, { status: 400 });

    const context = await getBlockContext(blockId);
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: 400 });
    const { block, project, tab, supabase } = context;

    if (!project.client_page_enabled || !project.client_comments_enabled || project.public_token !== publicToken) {
      return NextResponse.json({ error: ERROR_MESSAGES.forbidden }, { status: 403 });
    }

    const timestamp = new Date().toISOString();
    const commentId = `client-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase.from("block_comments").insert({
      id: commentId,
      block_id: block.id,
      parent_id: null,
      author_user_id: null,
      author_external_id: buildAuthorId(visitorId),
      author_name: authorName.trim(),
      author_email: null,
      text: validatedText,
      source: "external" satisfies CommentSource,
      created_at: timestamp,
      updated_at: timestamp,
    });
    if (error) throw new Error(error.message || "Failed to add comment.");

    try {
      const { createClientCommentNotification } = await import("@/lib/notifications/service");
      await createClientCommentNotification({
        workspaceId: project.workspace_id,
        projectId: project.id,
        tabId: tab.id,
        blockId: block.id,
        commentId,
        authorName: authorName.trim(),
        text: validatedText,
      });
    } catch (notificationError) {
      logger.error("Client comment notification error:", notificationError);
    }

    const comments = await loadCommentsForResponse(supabase, block.id);
    await revalidateSurfaces(project.id, tab.id, project.public_token);
    return NextResponse.json({ comments });
  } catch (error) {
    logger.error("Client comment POST error:", error);
    return NextResponse.json({ error: "Failed to add comment." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, commentId, text, visitorId } = body ?? {};
    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string" ||
      typeof commentId !== "string"
    ) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalid }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`comment:update:${visitorId}:${clientIp}`, {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment updates. Please wait a few minutes.",
    });
    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }

    const { text: validatedText, error: textError } = validateIncomingComment(text);
    if (textError || !validatedText) return NextResponse.json({ error: textError }, { status: 400 });

    const context = await getBlockContext(blockId);
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: 400 });
    const { block, project, tab, supabase } = context;

    if (!project.client_page_enabled || !project.client_comments_enabled || project.public_token !== publicToken) {
      return NextResponse.json({ error: ERROR_MESSAGES.forbidden }, { status: 403 });
    }

    const comments = await loadCommentsForResponse(supabase, block.id);
    const target = comments.find((comment) => comment.id === commentId);
    if (!target) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 403 });
    }

    const { error } = await supabase
      .from("block_comments")
      .update({ text: validatedText, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("block_id", block.id)
      .eq("source", "external");
    if (error) throw new Error(error.message || "Failed to update comment.");

    const nextComments = await loadCommentsForResponse(supabase, block.id);
    await revalidateSurfaces(project.id, tab.id, project.public_token);
    return NextResponse.json({ comments: nextComments });
  } catch (error) {
    logger.error("Client comment PATCH error:", error);
    return NextResponse.json({ error: "Failed to update comment." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, commentId, visitorId } = body ?? {};
    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string" ||
      typeof commentId !== "string"
    ) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalid }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`comment:delete:${visitorId}:${clientIp}`, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment deletions. Please wait a few minutes.",
    });
    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: 400 });
    const { block, project, tab, supabase } = context;

    if (!project.client_page_enabled || !project.client_comments_enabled || project.public_token !== publicToken) {
      return NextResponse.json({ error: ERROR_MESSAGES.forbidden }, { status: 403 });
    }

    const comments = await loadCommentsForResponse(supabase, block.id);
    const target = comments.find((comment) => comment.id === commentId);
    if (!target) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 403 });
    }

    const { error } = await supabase.from("block_comments").delete().eq("id", commentId).eq("block_id", block.id);
    if (error) throw new Error(error.message || "Failed to delete comment.");

    const nextComments = await loadCommentsForResponse(supabase, block.id);
    await revalidateSurfaces(project.id, tab.id, project.public_token);
    return NextResponse.json({ comments: nextComments });
  } catch (error) {
    logger.error("Client comment DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete comment." }, { status: 500 });
  }
}
