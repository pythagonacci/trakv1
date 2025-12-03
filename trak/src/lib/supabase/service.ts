"use server";

import { createClient } from "@supabase/supabase-js";

let cachedClientPromise: Promise<ReturnType<typeof createClient>> | null = null;

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

export async function createServiceClient() {
  if (!cachedClientPromise) {
    cachedClientPromise = initServiceClient();
  }

  return cachedClientPromise;
}

