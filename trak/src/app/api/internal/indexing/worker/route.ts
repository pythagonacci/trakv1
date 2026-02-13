import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IndexingQueue } from "@/lib/search/job-queue";
import { ResourceIndexer } from "@/lib/search/indexer";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export async function POST(req: NextRequest) {
  // Security: Only allow Supabase cron or manual triggers from authenticated users.
  const authHeader = req.headers.get("authorization");
  const manualTrigger = req.headers.get("x-manual-trigger");
  const expectedAuth = process.env.CRON_SECRET;

  try {
    const isCronRequest = Boolean(expectedAuth) && authHeader === `Bearer ${expectedAuth}`;
    const isDevNoSecret = !expectedAuth;
    const isManualTrigger = manualTrigger === "true";

    let supabase: Awaited<ReturnType<typeof createClient>>;
    if (isCronRequest || isDevNoSecret) {
      supabase = await createClient();
    } else if (isManualTrigger) {
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
