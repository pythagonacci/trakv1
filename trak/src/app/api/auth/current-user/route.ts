import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/get-server-user";
import { resolveUserDisplayName, resolveUserFirstName } from "@/lib/user-display";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const authResult = await getServerUser();
  if (!authResult) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { user, supabase } = authResult;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email || "",
      name: resolveUserDisplayName({
        profileName: profile?.name,
        userMetadata: user.user_metadata,
        email: user.email,
      }),
      firstName: resolveUserFirstName({
        profileName: profile?.name,
        userMetadata: user.user_metadata,
        email: user.email,
      }),
    },
  });
}
