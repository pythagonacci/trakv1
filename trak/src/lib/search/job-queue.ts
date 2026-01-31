import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export type IndexingJobStatus = "pending" | "processing" | "completed" | "failed";

export interface IndexingJob {
  id: string;
  workspace_id: string;
  resource_type: string;
  resource_id: string;
  status: IndexingJobStatus;
  attempts: number;
  error_message?: string;
  created_at: string;
}

export class IndexingQueue {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Enqueue a resource for indexing.
   * If a pending job already exists for this resource, it does nothing (deduplication).
   */
  async enqueue(params: {
    workspaceId: string;
    resourceType: string;
    resourceId: string;
  }): Promise<string | null> {
    const { workspaceId, resourceType, resourceId } = params;

    const { data: created, error } = await this.supabase
      .from("indexing_jobs")
      .upsert({
        workspace_id: workspaceId,
        resource_type: resourceType,
        resource_id: resourceId,
        status: "pending",
      }, {
        onConflict: 'resource_type,resource_id',
        ignoreDuplicates: true
      })
      .select("id")
      .maybeSingle();

    if (error) {
      logger.error("Failed to enqueue indexing job:", error);
      throw error;
    }

    return created?.id || null;
  }

  /**
   * Enqueue multiple resources efficiently.
   */
  async bulkEnqueue(jobs: Array<{
    workspaceId: string;
    resourceType: string;
    resourceId: string;
  }>): Promise<void> {
    if (jobs.length === 0) return;

    const payloads = jobs.map(j => ({
      workspace_id: j.workspaceId,
      resource_type: j.resourceType,
      resource_id: j.resourceId,
      status: "pending" as IndexingJobStatus,
    }));

    const { error } = await this.supabase
      .from("indexing_jobs")
      .upsert(payloads, {
        onConflict: 'resource_type,resource_id',
        ignoreDuplicates: true
      });

    if (error) {
      logger.error("Failed to bulk enqueue indexing jobs:", error);
      throw error;
    }
  }

  /**
   * Pick the next pending job and mark it as processing.
   * Simple locking mechanism.
   */
  async pickNextJob(): Promise<IndexingJob | null> {
    // 1. Find a pending job
    const { data: jobs } = await this.supabase
      .from("indexing_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!jobs || jobs.length === 0) return null;
    const job = jobs[0];

    // 2. Lock it
    const { data: locked, error } = await this.supabase
      .from("indexing_jobs")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending") // optimistic lock
      .select("*")
      .single();

    if (error || !locked) {
      // Could verify race condition here
      return null;
    }

    return locked as IndexingJob;
  }

  async completeJob(jobId: string) {
    await this.supabase
      .from("indexing_jobs")
      .update({ status: "completed", error_message: null })
      .eq("id", jobId);
  }

  async failJob(jobId: string, error: string) {
    await this.supabase
      .from("indexing_jobs")
      .update({
        status: "failed",
        error_message: error.slice(0, 1000), // truncate
      })
      .eq("id", jobId);
  }
}
