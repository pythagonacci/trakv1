import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient(); // ← await the async factory
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json(
      { ok: false, where: "server-route", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    where: "server-route",
    sessionPresent: !!data.session,
  });
}
