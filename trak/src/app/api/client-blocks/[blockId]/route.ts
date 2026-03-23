"use server";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  buildClientEditSummary,
  isClientEditableBlockType,
} from "@/lib/client-page-edits";

type EditContext = {
  block: {
    id: string;
    tab_id: string;
    type: string;
    content: Record<string, unknown> | null;
    locked: boolean | null;
  };
  tab: { id: string; project_id: string; is_client_visible: boolean };
  project: {
    id: string;
    workspace_id: string;
    client_page_enabled: boolean;
    client_editing_enabled: boolean;
    public_token: string | null;
  };
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
};

const ERROR_MESSAGES = {
  forbidden: "Editing is not enabled for this client page.",
  invalid: "Invalid request payload.",
  missingName: "Please provide your name before editing.",
};

function sanitizeContent(
  blockType: string,
  rawContent: unknown
): Record<string, unknown> | null {
  if (!isClientEditableBlockType(blockType)) return null;
  if (!rawContent || typeof rawContent !== "object" || Array.isArray(rawContent)) {
    return null;
  }

  const content = rawContent as Record<string, unknown>;
  switch (blockType) {
    case "text":
      return {
        text: typeof content.text === "string" ? content.text : "",
      };
    case "link":
      return {
        title:
          typeof content.title === "string" && content.title.trim()
            ? content.title.trim()
            : null,
        url:
          typeof content.url === "string" && content.url.trim()
            ? content.url.trim()
            : null,
        caption:
          typeof content.caption === "string" && content.caption.trim()
            ? content.caption.trim()
            : null,
      };
    case "section_header":
      return {
        title:
          typeof content.title === "string" && content.title.trim()
            ? content.title.trim()
            : "New Section",
        subtitle:
          typeof content.subtitle === "string" && content.subtitle.trim()
            ? content.subtitle.trim()
            : null,
      };
    default:
      return null;
  }
}

async function getEditContext(blockId: string): Promise<EditContext | { error: string }> {
  const supabase = await createServiceClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id, type, content, locked")
    .eq("id", blockId)
    .single();
  if (blockError || !block) return { error: "Block not found." };

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_client_visible")
    .eq("id", block.tab_id)
    .single();
  if (tabError || !tab || !tab.is_client_visible) {
    return { error: ERROR_MESSAGES.forbidden };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id, client_page_enabled, client_editing_enabled, public_token")
    .eq("id", tab.project_id)
    .single();
  if (projectError || !project) return { error: ERROR_MESSAGES.forbidden };

  return {
    block: {
      id: block.id,
      tab_id: block.tab_id,
      type: block.type,
      content:
        block.content && typeof block.content === "object" && !Array.isArray(block.content)
          ? (block.content as Record<string, unknown>)
          : {},
      locked: block.locked,
    },
    tab,
    project,
    supabase,
  };
}

function revalidateSurfaces(projectId: string, tabId: string, publicToken: string | null) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/tabs/${tabId}`);
  if (publicToken) {
    revalidatePath(`/client/${publicToken}`);
    revalidatePath(`/client/${publicToken}/${tabId}`);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const body = await request.json();
    const { publicToken, visitorId, visitorName, content } = body ?? {};

    if (
      typeof publicToken !== "string" ||
      typeof visitorId !== "string" ||
      typeof visitorName !== "string"
    ) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalid }, { status: 400 });
    }

    if (!visitorName.trim()) {
      return NextResponse.json({ error: ERROR_MESSAGES.missingName }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`client-block-edit:${visitorId}:${clientIp}`, {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      message: "Too many edits. Please wait a few minutes before trying again.",
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
          },
        }
      );
    }

    const context = await getEditContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }
    const { block, tab, project, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_editing_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json({ error: ERROR_MESSAGES.forbidden }, { status: 403 });
    }

    if (block.locked) {
      return NextResponse.json(
        { error: "This block is locked and cannot be edited." },
        { status: 403 }
      );
    }

    if (!isClientEditableBlockType(block.type)) {
      return NextResponse.json(
        { error: "This block type is not editable from a client page yet." },
        { status: 403 }
      );
    }

    const sanitizedContent = sanitizeContent(block.type, content);
    if (!sanitizedContent) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalid }, { status: 400 });
    }

    const nextContent = {
      ...(block.content || {}),
      ...sanitizedContent,
    };

    const { data: updatedBlock, error: updateError } = await supabase
      .from("blocks")
      .update({
        content: nextContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", block.id)
      .select(
        "id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, locked, created_at, updated_at"
      )
      .single();
    if (updateError || !updatedBlock) {
      throw new Error(updateError?.message || "Failed to update block.");
    }

    const summary = buildClientEditSummary(block.type, nextContent);
    const { data: editRow, error: editInsertError } = await supabase
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
          block_type: block.type,
        },
      })
      .select("id")
      .single();
    if (editInsertError || !editRow) {
      throw new Error(editInsertError?.message || "Failed to record edit activity.");
    }

    try {
      const { createClientEditNotification } = await import("@/lib/notifications/service");
      await createClientEditNotification({
        activityId: editRow.id,
        workspaceId: project.workspace_id,
        projectId: project.id,
        tabId: tab.id,
        blockId: block.id,
        visitorName: visitorName.trim(),
        summary,
      });
    } catch (notificationError) {
      logger.error("Client edit notification error:", notificationError);
    }

    revalidateSurfaces(project.id, tab.id, project.public_token);
    return NextResponse.json({ block: updatedBlock });
  } catch (error) {
    logger.error("Client block PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to save changes." },
      { status: 500 }
    );
  }
}
