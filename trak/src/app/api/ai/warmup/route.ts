import { NextResponse } from "next/server";
import { warmPromptToActionCache } from "@/lib/ai/executor";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleWarmup() {
  const result = warmPromptToActionCache();
  return NextResponse.json({
    ok: true,
    warmed: result.warmed,
  });
}

export async function POST() {
  try {
    await requireUser();
    return handleWarmup();
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }
    return NextResponse.json({ error: "Warmup failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireUser();
    return handleWarmup();
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }
    return NextResponse.json({ error: "Warmup failed" }, { status: 500 });
  }
}
