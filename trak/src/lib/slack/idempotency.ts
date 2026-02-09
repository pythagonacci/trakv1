import { createClient as createServiceClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Checks if a request has already been processed (idempotency check)
 * @param key The idempotency key (format: "team:TEAM_ID:request:REQUEST_ID")
 * @returns The cached response payload if found, null otherwise
 */
export async function checkIdempotency(key: string): Promise<any | null> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from("slack_idempotency_keys")
      .select("response_payload")
      .eq("idempotency_key", key)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - this is expected for new requests
        return null;
      }
      console.error("Error checking idempotency:", error);
      return null;
    }

    return data?.response_payload || null;
  } catch (error) {
    console.error("Unexpected error in checkIdempotency:", error);
    return null;
  }
}

/**
 * Saves a response for idempotency deduplication
 * @param key The idempotency key
 * @param response The response payload to cache
 */
export async function saveIdempotency(key: string, response: any): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

    const { error } = await supabase.from("slack_idempotency_keys").upsert(
      {
        idempotency_key: key,
        response_payload: response,
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: "idempotency_key",
      }
    );

    if (error) {
      console.error("Error saving idempotency key:", error);
      // Don't throw - this is not critical to the request flow
    }
  } catch (error) {
    console.error("Unexpected error in saveIdempotency:", error);
    // Don't throw - this is not critical to the request flow
  }
}

/**
 * Generates an idempotency key from request parameters
 * @param teamId The Slack team ID
 * @param requestId The Slack request ID (X-Slack-Request-Id header)
 * @returns The idempotency key string
 */
export function generateIdempotencyKey(teamId: string, requestId: string): string {
  return `team:${teamId}:request:${requestId}`;
}
