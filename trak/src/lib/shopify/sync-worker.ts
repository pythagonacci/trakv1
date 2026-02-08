import { SupabaseClient, createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createShopifyClient, buildOrderDateQuery } from "./client";
import { decryptToken } from "./encryption";

export type SyncJobType =
  | "full_sync"
  | "inventory_sync"
  | "metadata_sync"
  | "initial_import"
  | "sales_computation";

export type SyncJobStatus = "pending" | "processing" | "completed" | "failed";

export type ShopifySyncJob = {
  id: string;
  workspace_id: string;
  connection_id: string;
  job_type: SyncJobType;
  status: SyncJobStatus;
  total_items: number | null;
  processed_items: number | null;
  failed_items: number | null;
  attempts: number;
  error_message: string | null;
  metadata: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export class ShopifySyncQueue {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Enqueues a new sync job
   */
  async enqueue(params: {
    workspaceId: string;
    connectionId: string;
    jobType: SyncJobType;
    metadata?: any;
  }): Promise<string | null> {
    try {
      const { workspaceId, connectionId, jobType, metadata } = params;

      // Check for existing pending/processing job of same type (deduplication)
      const { data: existingJob } = await this.supabase
        .from("shopify_sync_jobs")
        .select("id")
        .eq("connection_id", connectionId)
        .eq("job_type", jobType)
        .in("status", ["pending", "processing"])
        .single();

      if (existingJob) {
        console.log(`Job already queued: ${jobType} for connection ${connectionId}`);
        return existingJob.id;
      }

      // Insert new job
      const { data: newJob, error } = await this.supabase
        .from("shopify_sync_jobs")
        .insert({
          workspace_id: workspaceId,
          connection_id: connectionId,
          job_type: jobType,
          status: "pending",
          metadata: metadata || {},
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error enqueuing sync job:", error);
        return null;
      }

      return newJob.id;
    } catch (error) {
      console.error("Error in enqueue:", error);
      return null;
    }
  }

  /**
   * Picks the next pending job and marks it as processing
   */
  async pickNextJob(): Promise<ShopifySyncJob | null> {
    try {
      // Get oldest pending job
      const { data: jobs, error: fetchError } = await this.supabase
        .from("shopify_sync_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchError || !jobs || jobs.length === 0) {
        return null;
      }

      const job = jobs[0];

      // Update status to processing with optimistic lock
      const { error: updateError } = await this.supabase
        .from("shopify_sync_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "pending"); // Optimistic lock

      if (updateError) {
        console.error("Error picking job:", updateError);
        return null;
      }

      return { ...job, status: "processing", started_at: new Date().toISOString() };
    } catch (error) {
      console.error("Error in pickNextJob:", error);
      return null;
    }
  }

  /**
   * Marks a job as completed
   */
  async completeJob(jobId: string): Promise<void> {
    await this.supabase
      .from("shopify_sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }

  /**
   * Marks a job as failed
   */
  async failJob(jobId: string, error: string): Promise<void> {
    await this.supabase
      .from("shopify_sync_jobs")
      .update({
        status: "failed",
        error_message: error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single()
      .then(({ data }) => {
        if (data) {
          // Increment attempts
          return this.supabase
            .from("shopify_sync_jobs")
            .update({ attempts: (data.attempts || 0) + 1 })
            .eq("id", jobId);
        }
      });
  }

  /**
   * Updates job progress
   */
  async updateProgress(jobId: string, processed: number, total?: number): Promise<void> {
    const update: any = { processed_items: processed };
    if (total !== undefined) {
      update.total_items = total;
    }
    await this.supabase.from("shopify_sync_jobs").update(update).eq("id", jobId);
  }
}

/**
 * Processes a sync job
 */
export async function processSyncJob(job: ShopifySyncJob): Promise<void> {
  // Create service client for background processing
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const queue = new ShopifySyncQueue(supabase);

  try {
    console.log(`Processing sync job ${job.id}: ${job.job_type}`);

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("id", job.connection_id)
      .single();

    if (connectionError || !connection) {
      throw new Error("Connection not found or inactive");
    }

    if (connection.sync_status !== "active") {
      throw new Error("Connection is not active");
    }

    // Decrypt token
    const accessToken = await decryptToken(
      connection.access_token_encrypted,
      connection.encryption_key_id
    );

    // Create Shopify GraphQL client
    const client = await createShopifyClient(connection.shop_domain, accessToken);

    // Process based on job type
    switch (job.job_type) {
      case "initial_import":
        await processInitialImport(supabase, queue, job, connection, client);
        break;

      case "inventory_sync":
        await processInventorySync(supabase, queue, job, connection, client);
        break;

      case "metadata_sync":
        await processMetadataSync(supabase, queue, job, connection, client);
        break;

      case "full_sync":
        await processFullSync(supabase, queue, job, connection, client);
        break;

      case "sales_computation":
        await processSalesComputation(supabase, queue, job, connection, client);
        break;

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark job as completed
    await queue.completeJob(job.id);
    console.log(`Completed sync job ${job.id}`);
  } catch (error) {
    console.error(`Error processing sync job ${job.id}:`, error);
    await queue.failJob(job.id, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Initial import - fetches all products
 */
async function processInitialImport(
  supabase: SupabaseClient,
  queue: ShopifySyncQueue,
  job: ShopifySyncJob,
  connection: any,
  client: any
): Promise<void> {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            title
            description
            productType
            vendor
            tags
            status
            createdAt
            updatedAt
            featuredImage {
              url
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  barcode
                  price
                  compareAtPrice
                  inventoryItem {
                    id
                  }
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    url
                  }
                  availableForSale
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let processed = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const result = await client.query<any>(query, {
      first: 50,
      after: cursor,
    });

    // Process products
    for (const edge of result.products.edges) {
      const product = edge.node;

      // Upsert product
      const { data: trakProduct } = await supabase
        .from("trak_products")
        .upsert(
          {
            workspace_id: connection.workspace_id,
            connection_id: connection.id,
            shopify_product_id: product.id,
            title: product.title,
            description: product.description,
            product_type: product.productType,
            vendor: product.vendor,
            tags: product.tags || [],
            featured_image_url: product.featuredImage?.url,
            status: product.status,
            shopify_created_at: product.createdAt,
            shopify_updated_at: product.updatedAt,
            last_synced_at: new Date().toISOString(),
          },
          {
            onConflict: "connection_id,shopify_product_id",
          }
        )
        .select("id")
        .single();

      if (trakProduct) {
        // Process variants
        for (const variantEdge of product.variants.edges) {
          const variant = variantEdge.node;

          const options = variant.selectedOptions.reduce(
            (acc: any, opt: any, idx: number) => {
              const num = idx + 1;
              acc[`option${num}_name`] = opt.name;
              acc[`option${num}_value`] = opt.value;
              return acc;
            },
            {}
          );

          await supabase.from("trak_product_variants").upsert(
            {
              product_id: trakProduct.id,
              shopify_variant_id: variant.id,
              title: variant.title,
              sku: variant.sku,
              barcode: variant.barcode,
              price: variant.price ? parseFloat(variant.price) : null,
              compare_at_price: variant.compareAtPrice
                ? parseFloat(variant.compareAtPrice)
                : null,
              ...options,
              inventory_item_id: variant.inventoryItem?.id,
              image_url: variant.image?.url,
              available_for_sale: variant.availableForSale,
              inventory_tracked: !!variant.inventoryItem,
            },
            {
              onConflict: "product_id,shopify_variant_id",
            }
          );
        }
      }

      processed++;
      if (processed % 10 === 0) {
        await queue.updateProgress(job.id, processed);
      }
    }

    hasNextPage = result.products.pageInfo.hasNextPage;
    cursor = result.products.pageInfo.endCursor;
  }

  await queue.updateProgress(job.id, processed, processed);
}

/**
 * Inventory sync - updates inventory levels
 */
async function processInventorySync(
  supabase: SupabaseClient,
  queue: ShopifySyncQueue,
  job: ShopifySyncJob,
  connection: any,
  client: any
): Promise<void> {
  // Get all variants for this connection
  const { data: variants } = await supabase
    .from("trak_product_variants")
    .select("id, inventory_item_id")
    .eq("inventory_tracked", true)
    .in(
      "product_id",
      supabase
        .from("trak_products")
        .select("id")
        .eq("connection_id", connection.id)
    );

  if (!variants || variants.length === 0) {
    return;
  }

  let processed = 0;
  const total = variants.length;

  for (const variant of variants) {
    if (!variant.inventory_item_id) continue;

    try {
      const inventoryQuery = `
        query GetInventory($inventoryItemId: ID!) {
          inventoryItem(id: $inventoryItemId) {
            inventoryLevels(first: 50) {
              edges {
                node {
                  location {
                    id
                    name
                  }
                  available
                }
              }
            }
          }
        }
      `;

      const result = await client.query<any>(inventoryQuery, {
        inventoryItemId: variant.inventory_item_id,
      });

      let totalAvailable = 0;

      for (const invEdge of result.inventoryItem.inventoryLevels.edges) {
        const inv = invEdge.node;
        totalAvailable += inv.available || 0;

        await supabase.from("trak_product_inventory").upsert(
          {
            variant_id: variant.id,
            location_id: inv.location.id,
            location_name: inv.location.name,
            available: inv.available || 0,
            last_synced_at: new Date().toISOString(),
          },
          {
            onConflict: "variant_id,location_id",
          }
        );
      }

      // Update variant available_total
      await supabase
        .from("trak_product_variants")
        .update({ available_total: totalAvailable })
        .eq("id", variant.id);

      processed++;
      if (processed % 10 === 0) {
        await queue.updateProgress(job.id, processed, total);
      }
    } catch (error) {
      console.error(`Error syncing inventory for variant ${variant.id}:`, error);
    }
  }

  await queue.updateProgress(job.id, processed, total);
}

/**
 * Metadata sync - updates product metadata
 */
async function processMetadataSync(
  supabase: SupabaseClient,
  queue: ShopifySyncQueue,
  job: ShopifySyncJob,
  connection: any,
  client: any
): Promise<void> {
  // Get all products for this connection
  const { data: products } = await supabase
    .from("trak_products")
    .select("id, shopify_product_id")
    .eq("connection_id", connection.id);

  if (!products || products.length === 0) {
    return;
  }

  let processed = 0;
  const total = products.length;

  for (const product of products) {
    try {
      const productQuery = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            productType
            vendor
            tags
            status
            updatedAt
            featuredImage {
              url
            }
          }
        }
      `;

      const result = await client.query<any>(productQuery, {
        id: product.shopify_product_id,
      });

      if (result.product) {
        await supabase
          .from("trak_products")
          .update({
            title: result.product.title,
            description: result.product.description,
            product_type: result.product.productType,
            vendor: result.product.vendor,
            tags: result.product.tags || [],
            featured_image_url: result.product.featuredImage?.url,
            status: result.product.status,
            shopify_updated_at: result.product.updatedAt,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", product.id);
      }

      processed++;
      if (processed % 10 === 0) {
        await queue.updateProgress(job.id, processed, total);
      }
    } catch (error) {
      console.error(`Error syncing metadata for product ${product.id}:`, error);
    }
  }

  await queue.updateProgress(job.id, processed, total);
}

/**
 * Full sync - both inventory and metadata
 */
async function processFullSync(
  supabase: SupabaseClient,
  queue: ShopifySyncQueue,
  job: ShopifySyncJob,
  connection: any,
  client: any
): Promise<void> {
  await processMetadataSync(supabase, queue, job, connection, client);
  await processInventorySync(supabase, queue, job, connection, client);
}

/**
 * Sales computation - computes units sold for a product/date range
 */
async function processSalesComputation(
  supabase: SupabaseClient,
  queue: ShopifySyncQueue,
  job: ShopifySyncJob,
  connection: any,
  client: any
): Promise<void> {
  const { product_id, start_date, end_date } = job.metadata;

  if (!product_id || !start_date || !end_date) {
    throw new Error("Missing required metadata for sales computation");
  }

  // Get product variants
  const { data: variants } = await supabase
    .from("trak_product_variants")
    .select("shopify_variant_id")
    .eq("product_id", product_id);

  if (!variants || variants.length === 0) {
    return;
  }

  const variantIds = new Set(variants.map((v: any) => v.shopify_variant_id));
  let totalUnitsSold = 0;

  const dateQuery = buildOrderDateQuery(start_date, end_date);

  const ordersQuery = `
    query GetOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query) {
        edges {
          node {
            id
            lineItems(first: 250) {
              edges {
                node {
                  variant {
                    id
                  }
                  quantity
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const result = await client.query<any>(ordersQuery, {
      first: 50,
      after: cursor,
      query: dateQuery,
    });

    for (const orderEdge of result.orders.edges) {
      const order = orderEdge.node;

      for (const lineItemEdge of order.lineItems.edges) {
        const lineItem = lineItemEdge.node;

        if (lineItem.variant && variantIds.has(lineItem.variant.id)) {
          totalUnitsSold += lineItem.quantity || 0;
        }
      }
    }

    hasNextPage = result.orders.pageInfo.hasNextPage;
    cursor = result.orders.pageInfo.endCursor;
  }

  // Cache the result
  await supabase.from("trak_product_sales_cache").upsert(
    {
      product_id,
      start_date,
      end_date,
      units_sold: totalUnitsSold,
      computed_at: new Date().toISOString(),
    },
    {
      onConflict: "product_id,start_date,end_date",
    }
  );
}
