"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type CommentSource = "internal" | "external";

interface BlockComment {
  id: string;
  author_id: string;
  author_name?: string | null;
  author_email?: string | null;
  text: string;
  timestamp: string;
  source?: CommentSource;
}

const ERROR_MESSAGES = {
  forbidden: "Comments are not enabled for this client page.",
  invalid: "Invalid request payload.",
  missingName: "Please provide a display name before commenting.",
  missingToken: "A public token is required.",
  missingBlock: "Block not found.",
  unauthorized: "You do not have permission to modify this comment.",
};

async function getBlockContext(blockId: string) {
  const supabase = await createServiceClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, content, tab_id")
    .eq("id", blockId)
    .single();

  if (blockError || !block) {
    return { error: ERROR_MESSAGES.missingBlock };
  }

  const blockRecord = block as {
    id: string;
    content: Record<string, any>;
    tab_id: string;
  };

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_client_visible")
    .eq("id", blockRecord.tab_id)
    .single();

  const tabRecord = tab as {
    id: string;
    project_id: string;
    is_client_visible: boolean;
  } | null;

  if (tabError || !tabRecord || !tabRecord.is_client_visible) {
    return { error: ERROR_MESSAGES.forbidden };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, client_page_enabled, client_comments_enabled, public_token")
    .eq("id", tabRecord.project_id)
    .single();

  if (projectError || !project) {
    return { error: ERROR_MESSAGES.forbidden };
  }

  const projectRecord = project as {
    id: string;
    client_page_enabled: boolean;
    client_comments_enabled: boolean;
    public_token: string | null;
  };

  return { block: blockRecord, tab: tabRecord, project: projectRecord, supabase };
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
  return (
    comment.source === "external" &&
    comment.author_id === buildAuthorId(visitorId)
  );
}

async function persistComments(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  blockId: string,
  content: Record<string, any>,
  comments: BlockComment[]
) {
  const updatedContent = { ...content, _blockComments: comments };
  const { error } = await (supabase
    .from("blocks") as any)
    .update({ content: updatedContent })
    .eq("id", blockId);

  if (error) {
    throw new Error(error.message || "Failed to update comments.");
  }

  return comments;
}

function validateIncomingComment(text: unknown) {
  if (typeof text !== "string") {
    return { error: ERROR_MESSAGES.invalid };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Comment cannot be empty." };
  }
  if (trimmed.length > 2000) {
    return { error: "Comment is too long (2000 char max)." };
  }
  return { text: trimmed };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, text, authorName, visitorId } = body ?? {};

    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string"
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 10 comments per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:create:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000, // 5 minutes
      message: "Too many comments. Please wait a few minutes before commenting again.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingName },
        { status: 400 }
      );
    }

    const { text: validatedText, error: textError } = validateIncomingComment(
      text
    );
    if (textError || !validatedText) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const newComment: BlockComment = {
      id: `client-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author_id: buildAuthorId(visitorId),
      author_name: authorName.trim(),
      text: validatedText,
      timestamp: new Date().toISOString(),
      source: "external",
    };

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      [...existingComments, newComment]
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment POST error:", error);
    return NextResponse.json(
      { error: "Failed to add comment." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 20 updates per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:update:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment updates. Please wait a few minutes.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    const { text: validatedText, error: textError } = validateIncomingComment(
      text
    );
    if (textError || !validatedText) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const targetIndex = existingComments.findIndex(
      (comment) => comment.id === commentId
    );

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    const target = existingComments[targetIndex];
    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 403 }
      );
    }

    existingComments[targetIndex] = {
      ...target,
      text: validatedText,
      timestamp: new Date().toISOString(),
    };

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      existingComments
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update comment." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 10 deletions per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:delete:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment deletions. Please wait a few minutes.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const targetIndex = existingComments.findIndex(
      (comment) => comment.id === commentId
    );

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    const target = existingComments[targetIndex];

    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 403 }
      );
    }

    existingComments.splice(targetIndex, 1);

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      existingComments
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment." },
      { status: 500 }
    );
  }
}

