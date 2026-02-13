import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RequireUserResult = {
  user: User;
  supabase: ServerSupabaseClient;
};

export class UnauthorizedApiError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedApiError";
  }
}

export function isUnauthorizedApiError(error: unknown): error is UnauthorizedApiError {
  return error instanceof UnauthorizedApiError;
}

export function unauthorizedJsonResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedApiError();
  }

  return { user, supabase };
}
