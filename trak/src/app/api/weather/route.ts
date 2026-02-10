import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat/lon" },
      { status: 400 }
    );
  }

  try {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`;
    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}` +
      `&count=1&language=en`;

    const [weatherRes, geoRes] = await Promise.all([
      fetch(weatherUrl, { cache: "no-store" }),
      fetch(geoUrl, { cache: "no-store" }),
    ]);

    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: "Weather lookup failed" },
        { status: 502 }
      );
    }

    const weatherJson = await weatherRes.json();
    const geoJson = geoRes.ok ? await geoRes.json() : null;

    const temp =
      typeof weatherJson?.current_weather?.temperature === "number"
        ? Math.round(weatherJson.current_weather.temperature)
        : null;
    const wind =
      typeof weatherJson?.current_weather?.windspeed === "number"
        ? weatherJson.current_weather.windspeed
        : null;
    const code =
      typeof weatherJson?.current_weather?.weathercode === "number"
        ? weatherJson.current_weather.weathercode
        : null;

    let location = "Location unavailable";
    if (geoJson && Array.isArray(geoJson.results) && geoJson.results.length > 0) {
      const entry = geoJson.results[0] as {
        name?: string;
        admin1?: string;
        country_code?: string;
      };
      const name = entry.name || "Unknown";
      const admin = entry.admin1 || "";
      const country = entry.country_code || "";
      if (country.toUpperCase() === "US" && admin) {
        location = `${name}, ${admin}`;
      } else if (admin) {
        location = `${name}, ${admin}`;
      } else {
        location = name;
      }
    }

    return NextResponse.json({
      tempF: temp,
      windMph: wind,
      code,
      location,
    });
  } catch {
    return NextResponse.json(
      { error: "Weather lookup failed" },
      { status: 502 }
    );
  }
}
