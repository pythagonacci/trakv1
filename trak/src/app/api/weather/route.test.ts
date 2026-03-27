import { describe, expect, it } from "vitest";
import { formatWeatherLocation } from "./route";

describe("formatWeatherLocation", () => {
  it("returns the city name only", () => {
    expect(formatWeatherLocation({ city: "New York", county: "New York County" })).toBe("New York");
  });

  it("falls back through town-style fields before giving up", () => {
    expect(formatWeatherLocation({ city: "   ", town: "Cambridge" })).toBe("Cambridge");
    expect(formatWeatherLocation({ municipality: "Santorini" })).toBe("Santorini");
  });

  it("falls back when no place name is available", () => {
    expect(formatWeatherLocation({ city: "   " })).toBe("Location unavailable");
    expect(formatWeatherLocation(null)).toBe("Location unavailable");
  });
});
