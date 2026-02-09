import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { generateRandomString } from "@/lib/slack/encryption";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const SLACK_SCOPES = "commands,chat:write,users:read,team:read";

/**
 * OAuth install route - initiates Slack OAuth flow
 * GET /api/slack/install?workspace_id=<workspace-id>
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing required parameter: workspace_id" },
        { status: 400 }
      );
    }

    // 3. Verify user is admin/owner of workspace
    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 }
      );
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only workspace owners and admins can install Slack integration" },
        { status: 403 }
      );
    }

    // 4. Check environment variables
    if (!SLACK_CLIENT_ID || !NEXT_PUBLIC_APP_URL) {
      console.error("Missing required environment variables: SLACK_CLIENT_ID or NEXT_PUBLIC_APP_URL");
      return NextResponse.json(
        { error: "Slack integration not configured" },
        { status: 500 }
      );
    }

    // 5. Generate state and nonce for CSRF protection
    const state = generateRandomString(32);
    const nonce = generateRandomString(16);

    // 6. Store state in database with 5 minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        state,
        nonce,
        workspace_id: workspaceId,
        user_id: user.id,
        provider: "slack",
        metadata: {},
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      console.error("Error storing OAuth state:", stateError);
      return NextResponse.json(
        { error: "Failed to initiate OAuth flow" },
        { status: 500 }
      );
    }

    // 7. Build Slack authorization URL
    const redirectUri = `${NEXT_PUBLIC_APP_URL}/api/slack/callback`;
    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
    authUrl.searchParams.set("scope", SLACK_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    // 8. Redirect to Slack
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error in Slack install route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
