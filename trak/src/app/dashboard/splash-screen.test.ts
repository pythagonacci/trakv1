import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createUnavailableSplashWeather,
  resolveSplashWeather,
} from "./splash-screen";

describe("resolveSplashWeather", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("falls back when geolocation never resolves", async () => {
    vi.useFakeTimers();

    const promise = resolveSplashWeather({
      geolocation: {
        getCurrentPosition: vi.fn(),
      },
      loadWeather: vi.fn(),
      mapGeolocationError: () => "Location unavailable",
    });

    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual(
      createUnavailableSplashWeather("Weather unavailable")
    );
  });
});
