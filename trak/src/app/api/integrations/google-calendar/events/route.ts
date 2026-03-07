import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMember } from "@/lib/google-drive/assets";
import {
  getGoogleCalendarOAuthConfig,
  refreshCalendarAccessToken,
} from "@/lib/google-calendar/oauth";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

function isCalendarConfigured(): boolean {
  try {
    getGoogleCalendarOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isCalendarConfigured()) {
      return NextResponse.json({
        available: false,
        connected: false,
        events: [],
      });
    }

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    const rangeStart = request.nextUrl.searchParams.get("rangeStart");
    const rangeEnd = request.nextUrl.searchParams.get("rangeEnd");

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }
    if (!rangeStart || !rangeEnd) {
      return NextResponse.json(
        { error: "Missing rangeStart or rangeEnd" },
        { status: 400 }
      );
    }

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createClient();
    let { data: connection, error: connError } = await supabase
      .from("google_calendar_connections")
      .select("id, access_token, refresh_token, expires_at, google_account_email, calendar_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError) {
      return NextResponse.json(
        { available: false, connected: false, error: connError.message },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json({
        available: true,
        connected: false,
        events: [],
      });
    }

    let accessToken = connection.access_token;
    const now = new Date();
    const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
    const bufferSeconds = 60;
    if (
      expiresAt &&
      connection.refresh_token &&
      now.getTime() >= expiresAt.getTime() - bufferSeconds * 1000
    ) {
      try {
        const refreshed = await refreshCalendarAccessToken(connection.refresh_token);
        accessToken = refreshed.access_token;
        const newExpiresAt = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null;
        await supabase
          .from("google_calendar_connections")
          .update({
            access_token: refreshed.access_token,
            expires_at: newExpiresAt,
          })
          .eq("id", connection.id);
      } catch (refreshErr) {
        return NextResponse.json(
          {
            available: true,
            connected: true,
            error: "Failed to refresh calendar token",
            events: [],
          },
          { status: 401 }
        );
      }
    }

    const calendarId = encodeURIComponent(connection.calendar_id || "primary");
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${calendarId}/events`);
    url.searchParams.set("timeMin", rangeStart);
    url.searchParams.set("timeMax", rangeEnd);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const calRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calRes.ok) {
      const errBody = await calRes.text();
      return NextResponse.json(
        {
          available: true,
          connected: true,
          accountEmail: connection.google_account_email ?? undefined,
          error: "Failed to fetch calendar events",
          events: [],
        },
        { status: calRes.status }
      );
    }

    const calData = (await calRes.json()) as { items?: unknown[] };
    const events = Array.isArray(calData.items) ? calData.items : [];

    return NextResponse.json({
      available: true,
      connected: true,
      accountEmail: connection.google_account_email ?? undefined,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { available: false, connected: false, error: message, events: [] },
      { status: 500 }
    );
  }
}
