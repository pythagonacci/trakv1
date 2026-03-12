import { NextRequest, NextResponse } from "next/server";
import { getCardsByBlock } from "@/app/actions/cards/query-actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;
  if (!blockId) {
    return NextResponse.json({ error: "Missing cards block id" }, { status: 400 });
  }

  const result = await getCardsByBlock(blockId);
  if ("error" in result) {
    const status = result.error === "Unauthorized" ? 401 : result.error === "Not a member of this workspace" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.data });
}
