"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClientPromise: Promise<SupabaseClient<any, "public", any>> | null = null;

async function initServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServiceClient(): Promise<SupabaseClient<any, "public", any>> {
  if (!cachedClientPromise) {
    cachedClientPromise = initServiceClient();
  }

  return cachedClientPromise!;
}

