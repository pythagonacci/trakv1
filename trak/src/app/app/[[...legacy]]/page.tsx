import { redirect } from "next/navigation";

interface LegacyAppPageProps {
  params: Promise<{ legacy?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyAppRedirectPage({
  params,
  searchParams,
}: LegacyAppPageProps) {
  const { legacy } = await params;
  const query = await searchParams;

  const targetPath = legacy && legacy.length > 0 ? `/${legacy.join("/")}` : "/";
  const queryString = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      queryString.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        queryString.append(key, item);
      }
    }
  }

  const suffix = queryString.toString();
  const destination = suffix ? `${targetPath}?${suffix}` : targetPath;
  redirect(destination);
}
