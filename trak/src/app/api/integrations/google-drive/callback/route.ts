import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptDriveToken } from "@/lib/google-drive/encryption";
import { exchangeCodeForTokens, fetchGoogleAccountEmail, getGoogleOAuthConfig } from "@/lib/google-drive/oauth";
import { logDriveAuditEvent } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

function redirectWithError(error: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/dashboard/settings/integrations/google-drive?error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/dashboard/settings/integrations/google-drive?success=true`);
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
    const service = await createServiceClient();

    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("id, state, workspace_id, user_id, expires_at")
      .eq("state", state)
      .eq("provider", "google_drive")
      .maybeSingle();

    if (stateError || !oauthState) {
      return redirectWithError("invalid_state");
    }

    if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return redirectWithError("state_expired");
    }

    const tokenData = await exchangeCodeForTokens(code);
    const accessEncrypted = await encryptDriveToken(tokenData.access_token);

    const { data: existing } = await service
      .from("drive_connections")
      .select("id, refresh_token_encrypted")
      .eq("workspace_id", oauthState.workspace_id)
      .maybeSingle();

    let refreshTokenEncrypted = existing?.refresh_token_encrypted ?? null;
    if (tokenData.refresh_token) {
      const encryptedRefresh = await encryptDriveToken(tokenData.refresh_token);
      refreshTokenEncrypted = encryptedRefresh.encrypted;
    }

    const email = await fetchGoogleAccountEmail(tokenData.access_token);
    const tokenExpiry = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { error: upsertError } = await service.from("drive_connections").upsert(
      {
        workspace_id: oauthState.workspace_id,
        google_account_email: email || "unknown@google",
        access_token_encrypted: accessEncrypted.encrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        encryption_key_id: accessEncrypted.keyId,
        token_expiry: tokenExpiry,
        scopes: tokenData.scope ? tokenData.scope.split(" ") : [],
        created_by: oauthState.user_id,
      },
      { onConflict: "workspace_id" }
    );

    if (upsertError) {
      return redirectWithError("connection_upsert_failed");
    }

    await logDriveAuditEvent({
      workspaceId: oauthState.workspace_id,
      userId: oauthState.user_id,
      eventType: existing ? "reconnected" : "connected",
      metadata: {
        scopes: tokenData.scope ? tokenData.scope.split(" ") : [],
        redirect_uri: getGoogleOAuthConfig().redirectUri,
      },
    });

    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return redirectWithSuccess();
  } catch (error: unknown) {
    return redirectWithError(getErrorMessage(error, "oauth_callback_failed"));
  }
}
