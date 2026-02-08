import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { isValidShopDomain, generateRandomString } from "@/lib/shopify/encryption";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const SHOPIFY_SCOPES = "read_products,read_inventory,read_orders";

/**
 * OAuth install route - initiates Shopify OAuth flow
 * GET /api/shopify/install?shop=<shop-domain>&workspace_id=<workspace-id>
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
    const shop = searchParams.get("shop");
    const workspaceId = searchParams.get("workspace_id");

    if (!shop || !workspaceId) {
      return NextResponse.json(
        { error: "Missing required parameters: shop and workspace_id" },
        { status: 400 }
      );
    }

    // 3. Validate shop domain format
    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        { error: "Invalid shop domain format. Must be *.myshopify.com" },
        { status: 400 }
      );
    }

    // 4. Verify workspace membership
    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 }
      );
    }

    // 5. Check environment variables
    if (!SHOPIFY_CLIENT_ID || !NEXT_PUBLIC_APP_URL) {
      console.error("Missing required environment variables: SHOPIFY_CLIENT_ID or NEXT_PUBLIC_APP_URL");
      return NextResponse.json(
        { error: "Shopify integration not configured" },
        { status: 500 }
      );
    }

    // 6. Generate state and nonce for CSRF protection
    const state = generateRandomString(32);
    const nonce = generateRandomString(16);

    // 7. Store state in database with 5 minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        state,
        nonce,
        workspace_id: workspaceId,
        user_id: user.id,
        provider: "shopify",
        metadata: { shop },
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      console.error("Error storing OAuth state:", stateError);
      return NextResponse.json(
        { error: "Failed to initiate OAuth flow" },
        { status: 500 }
      );
    }

    // 8. Build Shopify authorization URL
    const redirectUri = `${NEXT_PUBLIC_APP_URL}/api/shopify/callback`;
    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    // 9. Redirect to Shopify
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error in Shopify install route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
