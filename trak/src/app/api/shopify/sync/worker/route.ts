import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ShopifySyncQueue, processSyncJob } from "@/lib/shopify/sync-worker";

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_JOBS_PER_RUN = 10;

/**
 * Shopify sync worker endpoint
 * Called by pg_cron or manual trigger
 * POST /api/shopify/sync/worker
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Check Authorization header
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${CRON_SECRET}`;

    // Allow manual trigger in development
    const isDevelopment = process.env.NODE_ENV === "development";
    const isAuthorized = authHeader === expectedAuth;

    if (!isAuthorized && !isDevelopment) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isDevelopment && !CRON_SECRET) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Worker not configured" },
        { status: 500 }
      );
    }

    // Create service client for background processing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    const queue = new ShopifySyncQueue(supabase);

    let processed = 0;
    let failed = 0;

    // Process up to MAX_JOBS_PER_RUN jobs
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const job = await queue.pickNextJob();

      if (!job) {
        // No more jobs to process
        break;
      }

      try {
        console.log(`Processing job ${job.id}: ${job.job_type}`);
        await processSyncJob(job);
        processed++;
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);
        failed++;
      }
    }

    // Check if there are more jobs remaining
    const { count: remaining } = await supabase
      .from("shopify_sync_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    console.log(
      `Shopify sync worker completed: processed=${processed}, failed=${failed}, remaining=${remaining || 0}`
    );

    return NextResponse.json({
      success: true,
      processed,
      failed,
      remaining: remaining || 0,
    });
  } catch (error) {
    console.error("Error in Shopify sync worker:", error);
    return NextResponse.json(
      { error: "Worker failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual status check
 */
export async function GET(request: NextRequest) {
  try {
    // Create service client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    // Get job counts by status
    const { data: jobs, error } = await supabase
      .from("shopify_sync_jobs")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    const statusCounts = jobs.reduce(
      (acc: any, job: any) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      status: "operational",
      jobs: statusCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in worker status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
