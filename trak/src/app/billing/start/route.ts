import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PaidPlan = "standard" | "business";

function normalizePaidPlan(value: string | null): PaidPlan | null {
  return value === "standard" || value === "business" ? value : null;
}

function buildAppUrl(request: NextRequest, path: string) {
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const plan = normalizePaidPlan(request.nextUrl.searchParams.get("plan"));

  if (!plan) {
    return NextResponse.redirect(buildAppUrl(request, "/signup"));
  }

  const cookieStore = await cookies();
  cookieStore.set("signup_billing_plan", plan, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 2 * 60 * 60,
    path: "/",
  });

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(buildAppUrl(request, `/signup?billingPlan=${plan}`));
  }

  const stage = session.user?.user_metadata?.signup_stage;
  if (stage && stage !== "complete") {
    if (stage === "otp_sent" || stage === "email_verified") {
      return NextResponse.redirect(buildAppUrl(request, "/signup/password"));
    }
    if (stage === "password_set") {
      return NextResponse.redirect(buildAppUrl(request, "/signup/account-setup"));
    }
  }

  let workspaceId = cookieStore.get("trak_current_workspace")?.value ?? null;

  if (!workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    workspaceId = typeof membership?.workspace_id === "string" ? membership.workspace_id : null;

    if (workspaceId) {
      cookieStore.set("trak_current_workspace", workspaceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }
  }

  const checkoutPath = workspaceId
    ? `/billing/checkout?plan=${plan}&workspaceId=${workspaceId}`
    : `/billing/checkout?plan=${plan}`;

  return NextResponse.redirect(buildAppUrl(request, checkoutPath));
}
