import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForCalendarTokens,
  fetchGoogleAccountEmail,
  getGoogleCalendarOAuthConfig,
} from "@/lib/google-calendar/oauth";

function redirectWithError(error: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(
    `${appUrl}/dashboard/calendar?google_calendar_error=${encodeURIComponent(error)}`
  );
}

function redirectWithSuccess() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/dashboard/calendar?google_calendar_success=1`);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectWithError(oauthError);
  if (!code || !state) return redirectWithError("missing_oauth_parameters");

  try {
    const supabase = await createClient();

    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("id, state, workspace_id, user_id, expires_at")
      .eq("state", state)
      .eq("provider", "google_calendar")
      .maybeSingle();

    if (stateError || !oauthState) {
      return redirectWithError("invalid_state");
    }

    if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return redirectWithError("state_expired");
    }

    const tokenData = await exchangeCodeForCalendarTokens(code);
    const email = await fetchGoogleAccountEmail(tokenData.access_token);
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { data: existing } = await supabase
      .from("google_calendar_connections")
      .select("refresh_token")
      .eq("user_id", oauthState.user_id)
      .eq("workspace_id", oauthState.workspace_id)
      .maybeSingle();

    const refreshToken =
      tokenData.refresh_token && tokenData.refresh_token.length > 0
        ? tokenData.refresh_token
        : existing?.refresh_token ?? "";

    const { error: upsertError } = await supabase.from("google_calendar_connections").upsert(
      {
        workspace_id: oauthState.workspace_id,
        user_id: oauthState.user_id,
        google_account_email: email ?? undefined,
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        scope: tokenData.scope ?? null,
        token_type: tokenData.token_type ?? "Bearer",
        expires_at: expiresAt,
      },
      { onConflict: "user_id,workspace_id" }
    );

    if (upsertError) {
      return redirectWithError("connection_failed");
    }

    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return redirectWithSuccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_callback_failed";
    return redirectWithError(message);
  }
}
