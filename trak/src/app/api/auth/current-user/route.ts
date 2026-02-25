import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const authResult = await getServerUser();
  if (!authResult) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { user } = authResult;
  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
    },
  });
}
