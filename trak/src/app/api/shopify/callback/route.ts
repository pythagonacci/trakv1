import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { encryptToken, timingSafeEqual } from "@/lib/shopify/encryption";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

/**
 * Verifies the HMAC signature from Shopify
 */
function verifyHmac(query: Record<string, string>, hmacToVerify: string): boolean {
  if (!SHOPIFY_CLIENT_SECRET) {
    throw new Error("SHOPIFY_CLIENT_SECRET not configured");
  }

  // Build message by sorting params and excluding hmac/signature
  const message = Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature")
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");

  // Compute HMAC-SHA256
  const computedHmac = crypto
    .createHmac("sha256", SHOPIFY_CLIENT_SECRET)
    .update(message)
    .digest("hex");

  // Timing-safe comparison
  return timingSafeEqual(computedHmac, hmacToVerify);
}

/**
 * Exchanges authorization code for access token
 */
async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ accessToken: string; scope: string }> {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("Shopify credentials not configured");
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}

/**
 * Fetches shop metadata from Shopify
 */
async function fetchShopMetadata(
  shop: string,
  accessToken: string
): Promise<{ name: string; email: string; currency: string }> {
  const response = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch shop metadata: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    name: data.shop.name,
    email: data.shop.email,
    currency: data.shop.currency,
  };
}

/**
 * OAuth callback route - handles Shopify OAuth response
 * GET /api/shopify/callback?code=<code>&hmac=<hmac>&shop=<shop>&state=<state>&...
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const hmac = searchParams.get("hmac");
    const shop = searchParams.get("shop");
    const state = searchParams.get("state");

    if (!code || !hmac || !shop || !state) {
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=missing_params`
      );
    }

    // 2. Build query object for HMAC verification
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // 3. Verify HMAC signature
    if (!verifyHmac(queryParams, hmac)) {
      console.error("HMAC verification failed");
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=invalid_hmac`
      );
    }

    // 4. Verify state in database (check expiration)
    const supabase = await createClient();
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "shopify")
      .single();

    if (stateError || !oauthState) {
      console.error("Invalid or missing OAuth state:", stateError);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=invalid_state`
      );
    }

    // Check expiration
    if (new Date(oauthState.expires_at) < new Date()) {
      console.error("OAuth state expired");
      // Clean up expired state
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=state_expired`
      );
    }

    // Verify shop matches
    if (oauthState.metadata?.shop !== shop) {
      console.error("Shop mismatch in OAuth state");
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=shop_mismatch`
      );
    }

    // 5. Exchange code for access token
    const { accessToken, scope } = await exchangeCodeForToken(shop, code);

    // 6. Fetch shop metadata
    const shopMetadata = await fetchShopMetadata(shop, accessToken);

    // 7. Encrypt access token
    const { encrypted, keyId } = await encryptToken(accessToken);

    // 8. Upsert shopify_connections (supports multiple stores per workspace)
    const { error: connectionError } = await supabase
      .from("shopify_connections")
      .upsert(
        {
          workspace_id: oauthState.workspace_id,
          shop_domain: shop,
          access_token_encrypted: encrypted,
          encryption_key_id: keyId,
          scopes: scope.split(","),
          sync_status: "active",
          shop_name: shopMetadata.name,
          shop_email: shopMetadata.email,
          shop_currency: shopMetadata.currency,
        },
        {
          onConflict: "workspace_id,shop_domain",
        }
      );

    if (connectionError) {
      console.error("Error saving Shopify connection:", connectionError);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=save_failed`
      );
    }

    // 9. Delete used oauth_state
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    // 10. Get the connection to enqueue initial sync
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("id")
      .eq("workspace_id", oauthState.workspace_id)
      .eq("shop_domain", shop)
      .single();

    // 11. Enqueue initial sync job
    if (connection) {
      await supabase.from("shopify_sync_jobs").insert({
        workspace_id: oauthState.workspace_id,
        connection_id: connection.id,
        job_type: "initial_import",
        status: "pending",
      });
    }

    // 12. Redirect to success page
    return NextResponse.redirect(
      `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?success=true`
    );
  } catch (error) {
    console.error("Error in Shopify callback route:", error);
    return NextResponse.redirect(
      `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=callback_failed`
    );
  }
}
