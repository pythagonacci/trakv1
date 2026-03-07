/**
 * Google Calendar API scopes (read-only).
 * Matches the scopes configured in Google Cloud Console for the Calendar API.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.public.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendars.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export const GOOGLE_CALENDAR_SCOPE_STRING = GOOGLE_CALENDAR_SCOPES.join(" ");
