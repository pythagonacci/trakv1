import { NextResponse } from "next/server";
import { warmPromptToActionCache } from "@/lib/ai/executor";

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
  return handleWarmup();
}

export async function GET() {
  return handleWarmup();
}
