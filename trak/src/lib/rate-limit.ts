/**
 * Simple in-memory rate limiter using sliding window
 * For production, consider using Redis or Upstash for distributed rate limiting
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove timestamps older than 1 hour
    entry.timestamps = entry.timestamps.filter(
      (timestamp) => now - timestamp < 60 * 60 * 1000
    );
    // Delete the entry if no recent timestamps
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional custom error message
   */
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  message?: string;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the rate limit (e.g., IP + endpoint, visitorId)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = rateLimitStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(identifier, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(
    (timestamp) => timestamp > windowStart
  );

  // Check if limit exceeded
  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetAt = oldestTimestamp + config.windowMs;

    return {
      success: false,
      remaining: 0,
      resetAt,
      message:
        config.message ||
        `Rate limit exceeded. Try again in ${Math.ceil((resetAt - now) / 1000)} seconds.`,
    };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  const remaining = config.maxRequests - entry.timestamps.length;
  const resetAt = entry.timestamps[0] + config.windowMs;

  return {
    success: true,
    remaining,
    resetAt,
  };
}

/**
 * Get IP address from NextRequest
 * Handles both direct connections and proxied requests (Vercel, Cloudflare, etc.)
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers first
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback (this might not work in serverless environments)
  return 'unknown';
}
