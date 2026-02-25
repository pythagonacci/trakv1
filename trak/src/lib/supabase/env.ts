function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function getEnv(name: string) {
  const raw = process.env[name];
  if (!raw) {
    return "";
  }
  return stripWrappingQuotes(raw);
}

export function getSupabaseEnv() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_MODE) {
    console.error("ENABLE_TEST_MODE must not be set in production.");
    throw new Error("ENABLE_TEST_MODE is set in production. Refusing to start.");
  }

  return {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
