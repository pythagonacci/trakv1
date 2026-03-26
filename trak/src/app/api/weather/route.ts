import { NextResponse } from "next/server";

type ReverseGeocodeAddress = {
  city?: string | null;
  town?: string | null;
  village?: string | null;
  municipality?: string | null;
  hamlet?: string | null;
  county?: string | null;
};

const NOMINATIM_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const NOMINATIM_USER_AGENT = `Saria/1.0 (+${NOMINATIM_APP_URL})`;

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
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}` +
      `&zoom=10&addressdetails=1`;

    const [weatherRes, geoRes] = await Promise.all([
      fetch(weatherUrl, { cache: "no-store" }),
      fetch(geoUrl, {
        cache: "no-store",
        headers: {
          "user-agent": NOMINATIM_USER_AGENT,
          "accept-language": "en",
        },
      }),
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
    if (geoJson) {
      location = formatWeatherLocation(geoJson.address as ReverseGeocodeAddress | undefined);
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

export function formatWeatherLocation(address?: ReverseGeocodeAddress | null) {
  const location = [
    address?.city,
    address?.town,
    address?.village,
    address?.municipality,
    address?.hamlet,
    address?.county,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  return location?.trim() || "Location unavailable";
}
