import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createUnavailableSplashWeather,
  markSplashShownForSession,
  resetSplashSessionStateForTests,
  resolveSplashWeather,
  shouldAutoShowSplashForSession,
} from "./splash-screen";

describe("resolveSplashWeather", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetSplashSessionStateForTests();
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

  it("only auto-shows once per browser session", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };

    expect(shouldAutoShowSplashForSession(storage)).toBe(true);

    markSplashShownForSession(storage);

    expect(shouldAutoShowSplashForSession(storage)).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith("trak-dashboard-splash-seen", "1");
  });

  it("skips auto-show when the session was already marked seen", () => {
    const storage = {
      getItem: vi.fn(() => "1"),
    };

    expect(shouldAutoShowSplashForSession(storage)).toBe(false);
  });
});
