import crypto from "crypto";
import { timingSafeEqual } from "./encryption";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const REPLAY_WINDOW_SECONDS = 60 * 5; // 5 minutes

/**
 * Verifies the signature of a Slack request
 * Implements Slack's signature verification algorithm with replay attack protection
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * @param body The raw request body as a string
 * @param signature The X-Slack-Signature header value
 * @param timestamp The X-Slack-Request-Timestamp header value
 * @returns True if the signature is valid and the request is not a replay attack
 */
export function verifySlackSignature(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    if (!SLACK_SIGNING_SECRET) {
      console.error("SLACK_SIGNING_SECRET environment variable not set");
      return false;
    }

    if (!signature || !timestamp) {
      console.error("Missing signature or timestamp");
      return false;
    }

    // 1. REPLAY ATTACK PROTECTION
    // Reject requests older than 5 minutes to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const requestTimestamp = parseInt(timestamp, 10);

    if (isNaN(requestTimestamp)) {
      console.error("Invalid timestamp format");
      return false;
    }

    const timeDifference = Math.abs(now - requestTimestamp);
    if (timeDifference > REPLAY_WINDOW_SECONDS) {
      console.error(`Request timestamp too old: ${timeDifference} seconds`);
      return false;
    }

    // 2. COMPUTE HMAC-SHA256 SIGNATURE
    // Slack signature format: v0=<hex_digest>
    // Message to sign: v0:<timestamp>:<body>
    const sigBasestring = `v0:${timestamp}:${body}`;
    const computedSignature = `v0=${crypto
      .createHmac("sha256", SLACK_SIGNING_SECRET)
      .update(sigBasestring, "utf8")
      .digest("hex")}`;

    // 3. TIMING-SAFE COMPARISON
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(computedSignature, signature);
  } catch (error) {
    console.error("Error verifying Slack signature:", error);
    return false;
  }
}

/**
 * Validates that required Slack headers are present
 * @param headers The request headers object
 * @returns Object with signature and timestamp if valid, null otherwise
 */
export function extractSlackHeaders(headers: Headers): {
  signature: string;
  timestamp: string;
} | null {
  const signature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");

  if (!signature || !timestamp) {
    return null;
  }

  return { signature, timestamp };
}
