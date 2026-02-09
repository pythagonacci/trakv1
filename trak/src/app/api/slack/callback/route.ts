import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/slack/encryption";
import type { SlackOAuthAccessResponse } from "@/lib/slack/types";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

/**
 * OAuth callback route - handles Slack OAuth redirect
 * GET /api/slack/callback?code=<code>&state=<state>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // 1. Handle Slack errors
    if (error) {
      console.error("Slack OAuth error:", error);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=missing_params`
      );
    }

    // 2. Verify state in database
    const supabase = await createClient();
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "slack")
      .single();

    if (stateError || !oauthState) {
      console.error("Invalid OAuth state:", stateError);
      await supabase.from("oauth_states").delete().eq("state", state);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=invalid_state`
      );
    }

    // 3. Check state expiration (5 minutes)
    if (new Date(oauthState.expires_at) < new Date()) {
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=state_expired`
      );
    }

    // 4. Exchange code for access token
    const redirectUri = `${NEXT_PUBLIC_APP_URL}/api/slack/callback`;
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID!,
        client_secret: SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Slack token exchange failed:", tokenResponse.status);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=token_exchange_failed`
      );
    }

    const tokenData: SlackOAuthAccessResponse = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error("Slack OAuth error:", tokenData.error);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=${tokenData.error}`
      );
    }

    // 5. Encrypt bot access token
    const { encrypted, keyId } = await encryptToken(tokenData.access_token);

    // 6. Upsert slack_workspace_connections
    const { error: connectionError } = await supabase
      .from("slack_workspace_connections")
      .upsert(
        {
          workspace_id: oauthState.workspace_id,
          slack_team_id: tokenData.team.id,
          slack_team_name: tokenData.team.name,
          bot_access_token_encrypted: encrypted,
          encryption_key_id: keyId,
          scopes: tokenData.scope.split(","),
          bot_user_id: tokenData.bot_user_id,
          connection_status: "active",
        },
        {
          onConflict: "workspace_id",
        }
      );

    if (connectionError) {
      console.error("Error saving Slack connection:", connectionError);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=save_failed`
      );
    }

    // 7. Delete used oauth_state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    // 8. Redirect to success
    return NextResponse.redirect(
      `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_success=true`
    );
  } catch (error) {
    console.error("Error in Slack callback route:", error);
    return NextResponse.redirect(
      `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?slack_error=callback_failed`
    );
  }
}
