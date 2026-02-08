"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T } | { error: string };

export type ShopifyConnection = {
  id: string;
  workspace_id: string;
  shop_domain: string;
  scopes: string[];
  sync_status: "active" | "error" | "disconnected";
  shop_name: string | null;
  shop_email: string | null;
  shop_currency: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Lists all Shopify connections for a workspace
 */
export async function listShopifyConnections(
  workspaceId: string
): Promise<ActionResult<ShopifyConnection[]>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Check workspace membership
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return { error: "Not a member of this workspace" };
    }

    // Query shopify_connections (exclude access_token_encrypted for security)
    const { data: connections, error: connectionsError } = await supabase
      .from("shopify_connections")
      .select("id, workspace_id, shop_domain, scopes, sync_status, shop_name, shop_email, shop_currency, last_synced_at, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (connectionsError) {
      console.error("Error fetching Shopify connections:", connectionsError);
      return { error: "Failed to fetch connections" };
    }

    return { data: connections || [] };
  } catch (error) {
    console.error("Error in listShopifyConnections:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Gets a single Shopify connection by ID
 */
export async function getShopifyConnection(
  connectionId: string
): Promise<ActionResult<ShopifyConnection | null>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS will handle workspace membership check)
    const supabase = await createClient();

    // Query shopify_connections (exclude access_token_encrypted for security)
    const { data: connection, error: connectionError } = await supabase
      .from("shopify_connections")
      .select("id, workspace_id, shop_domain, scopes, sync_status, shop_name, shop_email, shop_currency, last_synced_at, created_at, updated_at")
      .eq("id", connectionId)
      .single();

    if (connectionError) {
      if (connectionError.code === "PGRST116") {
        return { data: null };
      }
      console.error("Error fetching Shopify connection:", connectionError);
      return { error: "Failed to fetch connection" };
    }

    return { data: connection };
  } catch (error) {
    console.error("Error in getShopifyConnection:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Disconnects a Shopify store
 */
export async function disconnectShopify(
  connectionId: string
): Promise<ActionResult<void>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS will handle workspace membership check)
    const supabase = await createClient();

    // Get connection to know workspace for revalidation
    const { data: connection, error: fetchError } = await supabase
      .from("shopify_connections")
      .select("workspace_id")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      return { error: "Connection not found or access denied" };
    }

    // Update sync_status to 'disconnected'
    const { error: updateError } = await supabase
      .from("shopify_connections")
      .update({ sync_status: "disconnected" })
      .eq("id", connectionId);

    if (updateError) {
      console.error("Error disconnecting Shopify:", updateError);
      return { error: "Failed to disconnect" };
    }

    // Delete pending sync jobs
    const { error: jobsError } = await supabase
      .from("shopify_sync_jobs")
      .delete()
      .eq("connection_id", connectionId)
      .in("status", ["pending", "processing"]);

    if (jobsError) {
      console.error("Error deleting sync jobs:", jobsError);
      // Don't fail the request
    }

    // Revalidate integrations page
    revalidatePath("/dashboard/settings/integrations");

    return { data: undefined };
  } catch (error) {
    console.error("Error in disconnectShopify:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Gets sync jobs for a connection
 */
export async function getSyncJobs(
  connectionId: string,
  limit: number = 10
): Promise<ActionResult<any[]>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS will handle workspace membership check)
    const supabase = await createClient();

    // Query sync jobs
    const { data: jobs, error: jobsError } = await supabase
      .from("shopify_sync_jobs")
      .select("*")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (jobsError) {
      console.error("Error fetching sync jobs:", jobsError);
      return { error: "Failed to fetch sync jobs" };
    }

    return { data: jobs || [] };
  } catch (error) {
    console.error("Error in getSyncJobs:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Triggers a manual sync job
 */
export async function triggerSync(
  connectionId: string,
  jobType: "full_sync" | "inventory_sync" | "metadata_sync"
): Promise<ActionResult<string>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS will handle workspace membership check)
    const supabase = await createClient();

    // Get connection to verify access and get workspace_id
    const { data: connection, error: fetchError } = await supabase
      .from("shopify_connections")
      .select("workspace_id, sync_status")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      return { error: "Connection not found or access denied" };
    }

    if (connection.sync_status !== "active") {
      return { error: "Connection is not active" };
    }

    // Check for existing pending/processing job of same type (deduplication)
    const { data: existingJob } = await supabase
      .from("shopify_sync_jobs")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("job_type", jobType)
      .in("status", ["pending", "processing"])
      .single();

    if (existingJob) {
      return { data: existingJob.id };
    }

    // Create new sync job
    const { data: newJob, error: insertError } = await supabase
      .from("shopify_sync_jobs")
      .insert({
        workspace_id: connection.workspace_id,
        connection_id: connectionId,
        job_type: jobType,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !newJob) {
      console.error("Error creating sync job:", insertError);
      return { error: "Failed to create sync job" };
    }

    return { data: newJob.id };
  } catch (error) {
    console.error("Error in triggerSync:", error);
    return { error: "Internal server error" };
  }
}
