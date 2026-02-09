import { createClient as createServiceClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Rate limits: 20 requests per user per minute, 100 requests per team per minute
const USER_LIMIT = parseInt(process.env.SLACK_RATE_LIMIT_PER_USER_PER_MINUTE || "20", 10);
const TEAM_LIMIT = parseInt(process.env.SLACK_RATE_LIMIT_PER_TEAM_PER_MINUTE || "100", 10);
const WINDOW_MS = 60 * 1000; // 1 minute

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  message?: string;
}

/**
 * Generates a rate limit identifier for a user or team
 * @param teamId The Slack team ID
 * @param userId The Slack user ID (optional, for per-user limits)
 * @returns Rate limit identifier string
 */
export function getRateLimitIdentifier(teamId: string, userId?: string): string {
  if (userId) {
    return `team:${teamId}:user:${userId}`;
  }
  return `team:${teamId}`;
}

/**
 * Checks if a request is within the rate limit
 * @param identifier The rate limit identifier
 * @param limit The maximum number of requests allowed in the window
 * @returns Result object with success status and remaining requests
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = USER_LIMIT
): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);

    // Get or create rate limit entry
    const { data: existing, error: fetchError } = await supabase
      .from("slack_rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is expected for new entries
      console.error("Error fetching rate limit:", fetchError);
      // Fail open - allow request but log error
      return { success: true, remaining: limit - 1 };
    }

    if (!existing) {
      // First request - create entry
      const { error: insertError } = await supabase
        .from("slack_rate_limits")
        .insert({
          identifier,
          request_count: 1,
          window_start: now.toISOString(),
          last_request_at: now.toISOString(),
        });

      if (insertError) {
        console.error("Error inserting rate limit:", insertError);
        return { success: true, remaining: limit - 1 }; // Fail open
      }

      return { success: true, remaining: limit - 1 };
    }

    // Check if window has expired
    const existingWindowStart = new Date(existing.window_start);
    if (now.getTime() - existingWindowStart.getTime() > WINDOW_MS) {
      // Reset window
      const { error: updateError } = await supabase
        .from("slack_rate_limits")
        .update({
          request_count: 1,
          window_start: now.toISOString(),
          last_request_at: now.toISOString(),
        })
        .eq("identifier", identifier);

      if (updateError) {
        console.error("Error resetting rate limit window:", updateError);
        return { success: true, remaining: limit - 1 }; // Fail open
      }

      return { success: true, remaining: limit - 1 };
    }

    // Check if limit exceeded
    if (existing.request_count >= limit) {
      const resetAt = new Date(existingWindowStart.getTime() + WINDOW_MS);
      const secondsRemaining = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return {
        success: false,
        remaining: 0,
        message: `⏱️ Rate limit exceeded. Try again in ${secondsRemaining} seconds.`,
      };
    }

    // Increment counter
    const { error: updateError } = await supabase
      .from("slack_rate_limits")
      .update({
        request_count: existing.request_count + 1,
        last_request_at: now.toISOString(),
      })
      .eq("identifier", identifier);

    if (updateError) {
      console.error("Error updating rate limit:", updateError);
      return { success: true, remaining: limit - existing.request_count - 1 }; // Fail open
    }

    return {
      success: true,
      remaining: limit - existing.request_count - 1,
    };
  } catch (error) {
    console.error("Unexpected error in checkRateLimit:", error);
    // Fail open - allow request but log error
    return { success: true, remaining: limit - 1 };
  }
}

/**
 * Checks both user and team rate limits
 * @param teamId The Slack team ID
 * @param userId The Slack user ID
 * @returns Result object with success status and message if rate limited
 */
export async function checkBothRateLimits(
  teamId: string,
  userId: string
): Promise<RateLimitResult> {
  // Check user limit first (stricter)
  const userResult = await checkRateLimit(
    getRateLimitIdentifier(teamId, userId),
    USER_LIMIT
  );
  if (!userResult.success) {
    return userResult;
  }

  // Check team limit
  const teamResult = await checkRateLimit(
    getRateLimitIdentifier(teamId),
    TEAM_LIMIT
  );
  if (!teamResult.success) {
    return {
      ...teamResult,
      message: `⏱️ Team rate limit exceeded. Your Slack workspace is making too many requests. ${teamResult.message}`,
    };
  }

  // Return user result (shows more specific remaining count)
  return userResult;
}
