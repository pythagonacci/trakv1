import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptWorkspaceInviteAfterLogin } from "@/lib/auth/actions";

const CURRENT_WORKSPACE_COOKIE = "trak_current_workspace";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const next = searchParams.get("next") ?? "/dashboard";

  if (!token) {
    return NextResponse.redirect(`${origin}/invite/accept?error=${encodeURIComponent("Invalid or missing invitation.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.redirect(
      `${origin}/login?inviteToken=${encodeURIComponent(token)}&redirectedFrom=${encodeURIComponent(next)}`,
    );
  }

  const inviteResult = await acceptWorkspaceInviteAfterLogin(token, {
    id: user.id,
    email: user.email,
  });

  if (inviteResult.error || !inviteResult.workspaceId) {
    return NextResponse.redirect(
      `${origin}/invite/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        inviteResult.error ?? "Invitation not found or expired.",
      )}`,
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set(CURRENT_WORKSPACE_COOKIE, inviteResult.workspaceId, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
