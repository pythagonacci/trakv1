export interface SplashWeather {
  tempF: number | null;
  location: string;
  summary: string;
}

export const WEATHER_LOOKUP_TIMEOUT_MS = 2000;
export const SPLASH_HIDE_DELAY_MS = 800;
export const SPLASH_FADE_DURATION_MS = 300;

export function createUnavailableSplashWeather(summary: string): SplashWeather {
  return {
    tempF: null,
    location: "Location unavailable",
    summary,
  };
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
