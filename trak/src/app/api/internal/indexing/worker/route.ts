import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { IndexingQueue } from "@/lib/search/job-queue";
import { ResourceIndexer } from "@/lib/search/indexer";
import { isUnauthorizedApiError, requireUser, unauthorizedJsonResponse } from "@/lib/auth/require-user";

export async function POST(req: NextRequest) {
  // Security: Allow (1) cron with CRON_SECRET, or (2) manual trigger by authenticated user.
  const authHeader = req.headers.get("authorization");
  const expectedAuth = process.env.CRON_SECRET;
  const isManualTrigger = req.headers.get("x-manual-trigger") === "true";

  try {
    if (process.env.NODE_ENV === "production" && !expectedAuth) {
      console.error("CRON_SECRET not configured for indexing worker");
      return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
    }

    const isCronRequest = Boolean(expectedAuth) && authHeader === `Bearer ${expectedAuth}`;
    let supabase: Awaited<ReturnType<typeof createServiceClient>>;

    if (isCronRequest) {
      // Cron has no user session; use service role to bypass RLS for queue + index writes
      supabase = await createServiceClient();
    } else if (isManualTrigger) {
      // Manual trigger from UI: require logged-in user (same pattern as backfill)
      const auth = await requireUser();
      supabase = auth.supabase;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queue = new IndexingQueue(supabase);
    const indexer = new ResourceIndexer(supabase);
    const processed: string[] = [];
    const failed: string[] = [];

    // Process up to 10 jobs in a single request.
    const LIMIT = 10;
    for (let i = 0; i < LIMIT; i++) {
      const job = await queue.pickNextJob();
      if (!job) break;

      try {
        await indexer.processJob(job);
        await queue.completeJob(job.id);
        processed.push(job.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await queue.failJob(job.id, msg);
        failed.push(job.id);
      }
    }

    return NextResponse.json(
      {
        message: `Processed ${processed.length} jobs, ${failed.length} failed`,
        processed,
        failed,
        remaining: processed.length === LIMIT,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Worker Route Crash:", error);
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
