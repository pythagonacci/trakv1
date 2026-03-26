export interface SplashWeather {
  tempF: number | null;
  location: string;
  summary: string;
}

export const WEATHER_LOOKUP_TIMEOUT_MS = 2000;
export const SPLASH_HIDE_DELAY_MS = 800;
export const SPLASH_FADE_DURATION_MS = 300;
export const SPLASH_SESSION_STORAGE_KEY = "trak-dashboard-splash-seen";

let splashAutoShowState: "idle" | "pending" | "completed" = "idle";

export function createUnavailableSplashWeather(summary: string): SplashWeather {
  return {
    tempF: null,
    location: "Location unavailable",
    summary,
  };
}

export function shouldAutoShowSplashForSession(
  storage?: Pick<Storage, "getItem"> | null
) {
  if (splashAutoShowState === "pending") {
    return true;
  }

  if (splashAutoShowState === "completed") {
    return false;
  }

  try {
    if (storage?.getItem(SPLASH_SESSION_STORAGE_KEY) === "1") {
      splashAutoShowState = "completed";
      return false;
    }
  } catch {
    // Ignore storage access failures and fall back to the in-memory session gate.
  }

  splashAutoShowState = "pending";
  return true;
}

export function markSplashShownForSession(
  storage?: Pick<Storage, "setItem"> | null
) {
  splashAutoShowState = "completed";

  try {
    storage?.setItem(SPLASH_SESSION_STORAGE_KEY, "1");
  } catch {
    // Ignore storage access failures and rely on the in-memory session gate.
  }
}

export function resetSplashSessionStateForTests() {
  splashAutoShowState = "idle";
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
