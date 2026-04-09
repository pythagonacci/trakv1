export interface SplashWeather {
  tempF: number | null;
  location: string;
  summary: string;
}

export const WEATHER_LOOKUP_TIMEOUT_MS = 2000;
export const SPLASH_HIDE_DELAY_MS = 800;
export const SPLASH_FADE_DURATION_MS = 300;
export const SPLASH_SESSION_COOKIE_NAME = "trak-dashboard-splash-seen";

let splashAutoShowState: "idle" | "claimed" | "completed" = "idle";

export function createUnavailableSplashWeather(summary: string): SplashWeather {
  return {
    tempF: null,
    location: "Location unavailable",
    summary,
  };
}

export function shouldAutoShowSplashForSession(
  cookieDocument?: Pick<Document, "cookie"> | null
) {
  const splashCookieValue = readCookieValue(
    cookieDocument?.cookie,
    SPLASH_SESSION_COOKIE_NAME
  );
  if (splashCookieValue === "pending" || splashCookieValue === "1") {
    splashAutoShowState = "completed";
    return false;
  }

  if (splashAutoShowState !== "idle") {
    return false;
  }

  splashAutoShowState = "claimed";

  try {
    cookieDocument.cookie = createSplashCookie("pending");
  } catch {
    // Ignore cookie access failures and fall back to the in-memory session gate.
  }

  return true;
}

export function markSplashShownForSession(
  cookieDocument?: Pick<Document, "cookie"> | null
) {
  splashAutoShowState = "completed";

  try {
    cookieDocument.cookie = createSplashCookie("1");
  } catch {
    // Ignore cookie access failures and rely on the in-memory session gate.
  }
}

export function resetSplashSessionStateForTests() {
  splashAutoShowState = "idle";
}

export function buildSplashGreeting(name: string, now = new Date()) {
  return `${getTimeOfDayGreeting(now)}, ${name}`;
}

export function getTimeOfDayGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function resolveSplashWeather({
  geolocation,
  loadWeather,
  mapGeolocationError,
  timeoutMs = WEATHER_LOOKUP_TIMEOUT_MS,
}: {
  geolocation?: Pick<Geolocation, "getCurrentPosition"> | null;
  loadWeather: (coords: { latitude: number; longitude: number }) => Promise<SplashWeather>;
  mapGeolocationError: (error: GeolocationPositionError) => string;
  timeoutMs?: number;
}) {
  return new Promise<SplashWeather>((resolve) => {
    let settled = false;

    const finish = (next: SplashWeather) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(next);
    };

    const timeoutId = setTimeout(() => {
      finish(createUnavailableSplashWeather("Weather unavailable"));
    }, timeoutMs);

    if (!geolocation) {
      finish(createUnavailableSplashWeather("Geolocation unavailable"));
      return;
    }

    geolocation.getCurrentPosition(
      (position) => {
        void loadWeather({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
          .then((weather) => {
            finish(weather);
          })
          .catch(() => {
            finish(createUnavailableSplashWeather("Weather unavailable"));
          });
      },
      (error) => {
        finish(createUnavailableSplashWeather(mapGeolocationError(error)));
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });
}

function createSplashCookie(value: "pending" | "1") {
  return `${SPLASH_SESSION_COOKIE_NAME}=${value}; Path=/; SameSite=Lax`;
}

function readCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    if (!trimmedCookie.startsWith(`${name}=`)) continue;
    return trimmedCookie.slice(name.length + 1);
  }

  return null;
}
