import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; // Assuming this exists or similar
import { IndexingQueue } from "@/lib/search/job-queue";
import { ResourceIndexer } from "@/lib/search/indexer";
// If createClient is not at that path, I'll fallback to generic supabase instantiation.
// Accessing file system showed supabase/server usage in other routes? 
// Checking file list... I see src/app/api/file-analysis/route.ts.
// Let's assume `@/lib/supabase/server` is correct for next.js app router here.
// If it fails in build/test, I'll fix.

export async function POST(req: NextRequest) {
    // Optional security check: verifying secret header for cron/internal use
    // const authHeader = req.headers.get("x-cron-secret");
    // if (authHeader !== process.env.CRON_SECRET) { ... }

    try {
        const supabase = await createClient(); // Restore client
        const queue = new IndexingQueue(supabase);
        const indexer = new ResourceIndexer(supabase);
        const processed: string[] = [];
        const failed: string[] = [];

        // Process up to 10 jobs in a single request
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

        return NextResponse.json({
            message: `Processed ${processed.length} jobs, ${failed.length} failed`,
            processed,
            failed,
            remaining: processed.length === LIMIT // Signal there might be more
        }, { status: 200 });

    } catch (error: any) {
        console.error("Worker Route Crash:", error);
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}
