import { NextRequest, NextResponse } from "next/server";
import { processAppManagedStandardTrials } from "@/lib/billing/trial-reminders";
import { requireUser } from "@/lib/auth/require-user";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedAuth = process.env.CRON_SECRET;
  const isManualTrigger = request.headers.get("x-manual-trigger") === "true";

  try {
    if (process.env.NODE_ENV === "production" && !expectedAuth) {
      return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
    }

    const isCronRequest = Boolean(expectedAuth) && authHeader === `Bearer ${expectedAuth}`;
    if (!isCronRequest) {
      if (!isManualTrigger) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      await requireUser();
    }

    const result = await processAppManagedStandardTrials();
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process billing trials" },
      { status: 500 }
    );
  }
}
