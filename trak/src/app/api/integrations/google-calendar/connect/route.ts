import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleCalendarAuthUrl } from "@/lib/google-calendar/oauth";
import { requireWorkspaceMember } from "@/lib/google-drive/assets";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    const forceConsent = request.nextUrl.searchParams.get("force_consent") === "1";
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createClient();
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from("oauth_states").insert({
      state,
      nonce,
      workspace_id: workspaceId,
      user_id: user.id,
      provider: "google_calendar",
      metadata: { force_consent: forceConsent },
      expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to initialize OAuth flow" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(buildGoogleCalendarAuthUrl(state, forceConsent));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
