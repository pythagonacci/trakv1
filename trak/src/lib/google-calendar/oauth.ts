import { GOOGLE_CALENDAR_SCOPE_STRING } from "./scopes";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getGoogleCalendarOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Missing Google OAuth config: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL"
    );
  }

  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri: `${appUrl}/api/integrations/google-calendar/callback`,
  };
}

export function buildGoogleCalendarAuthUrl(state: string, forceConsent = false) {
  const { clientId, redirectUri } = getGoogleCalendarOAuthConfig();
  const url = new URL(GOOGLE_AUTH_BASE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE_STRING);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // request refresh_token
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeCodeForCalendarTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleCalendarOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error_description || data?.error || "Failed to exchange Google OAuth code"
    );
  }

  return data as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
}

export async function refreshCalendarAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleCalendarOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error_description || data?.error || "Failed to refresh Google Calendar access token"
    );
  }

  return data as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}
