import { NextRequest, NextResponse } from "next/server";
import { getOrCreateWorkflowSession, getWorkflowSessionMessages, clearWorkflowSession } from "@/app/actions/workflow-session";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = (await request.json()) as { tabId?: string };
    const tabId = String(body?.tabId || "").trim();
    if (!tabId) {
      return NextResponse.json({ success: false, error: "Missing tabId" }, { status: 400 });
    }

    const sessionResult = await getOrCreateWorkflowSession({ tabId });
    if ("error" in sessionResult) {
      return NextResponse.json({ success: false, error: sessionResult.error }, { status: 400 });
    }

    const messagesResult = await getWorkflowSessionMessages({ sessionId: sessionResult.data.id });
    if ("error" in messagesResult) {
      return NextResponse.json({ success: false, error: messagesResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionResult.data.id,
      messages: messagesResult.data,
    });
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    console.error("[Workflow Messages] Error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireUser();

    const body = (await request.json()) as { tabId?: string };
    const tabId = String(body?.tabId || "").trim();
    if (!tabId) {
      return NextResponse.json({ success: false, error: "Missing tabId" }, { status: 400 });
    }

    const sessionResult = await getOrCreateWorkflowSession({ tabId });
    if ("error" in sessionResult) {
      return NextResponse.json({ success: false, error: sessionResult.error }, { status: 400 });
    }

    const clearResult = await clearWorkflowSession({ sessionId: sessionResult.data.id });
    if ("error" in clearResult) {
      return NextResponse.json({ success: false, error: clearResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    console.error("[Workflow Messages DELETE] Error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
