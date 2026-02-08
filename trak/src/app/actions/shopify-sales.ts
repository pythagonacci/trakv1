"use server";

import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { createShopifyClient, buildOrderDateQuery } from "@/lib/shopify/client";
import { decryptToken } from "@/lib/shopify/encryption";

type ActionResult<T> = { data: T } | { error: string };

export type ProductSalesData = {
  unitsSold: number;
  computedAt: string;
  cached: boolean;
  warning?: string;
};

const MAX_SYNC_DATE_RANGE_DAYS = 90;
const CACHE_TTL_HOURS = 1;

/**
 * Gets units sold for a product in a date range
 * Uses cache if available and fresh, otherwise computes from Shopify orders
 */
export async function getProductUnitsSold(
  trakProductId: string,
  startDate: string, // ISO date (YYYY-MM-DD)
  endDate: string     // ISO date (YYYY-MM-DD)
): Promise<ActionResult<ProductSalesData>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Get product with variants and connection info
    const { data: product, error: productError } = await supabase
      .from("trak_products")
      .select(
        `
        id,
        workspace_id,
        connection_id,
        shopify_connections!inner (
          id,
          shop_domain,
          access_token_encrypted,
          encryption_key_id,
          sync_status
        ),
        trak_product_variants (
          id,
          shopify_variant_id
        )
      `
      )
      .eq("id", trakProductId)
      .single();

    if (productError || !product) {
      return { error: "Product not found" };
    }

    const connection = product.shopify_connections;

    if (connection.sync_status !== "active") {
      return { error: "Connection is not active" };
    }

    // Check cache first
    const { data: cachedData } = await supabase
      .from("trak_product_sales_cache")
      .select("*")
      .eq("product_id", trakProductId)
      .eq("start_date", startDate)
      .eq("end_date", endDate)
      .single();

    // If cache exists and is fresh (< 1 hour old), return it
    if (cachedData) {
      const cacheAge = Date.now() - new Date(cachedData.computed_at).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      if (cacheAgeHours < CACHE_TTL_HOURS) {
        return {
          data: {
            unitsSold: cachedData.units_sold,
            computedAt: cachedData.computed_at,
            cached: true,
          },
        };
      }
    }

    // Calculate date range span
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // If date range is too large, enqueue async job
    if (daysDiff > MAX_SYNC_DATE_RANGE_DAYS) {
      // Enqueue async sales computation job
      await supabase.from("shopify_sync_jobs").insert({
        workspace_id: product.workspace_id,
        connection_id: connection.id,
        job_type: "sales_computation",
        status: "pending",
        metadata: {
          product_id: trakProductId,
          start_date: startDate,
          end_date: endDate,
        },
      });

      return {
        data: {
          unitsSold: 0,
          computedAt: new Date().toISOString(),
          cached: false,
          warning: `Computing sales data in background for ${daysDiff} day range. This may take a few minutes.`,
        },
      };
    }

    // Compute units sold directly (for smaller date ranges)
    try {
      // Decrypt token
      const accessToken = await decryptToken(
        connection.access_token_encrypted,
        connection.encryption_key_id
      );

      // Create Shopify GraphQL client
      const client = await createShopifyClient(connection.shop_domain, accessToken);

      // Build variant IDs set for matching
      const variantIds = new Set(
        product.trak_product_variants.map((v: any) => v.shopify_variant_id)
      );

      let totalUnitsSold = 0;
      let processedOrders = 0;
      const timeout = 30000; // 30 seconds max
      const startTime = Date.now();

      // Build order query with date filter
      const dateQuery = buildOrderDateQuery(startDate, endDate);

      // GraphQL query for orders
      const ordersQuery = `
        query GetOrders($first: Int!, $after: String, $query: String) {
          orders(first: $first, after: $after, query: $query) {
            edges {
              cursor
              node {
                id
                createdAt
                lineItems(first: 250) {
                  edges {
                    node {
                      variant {
                        id
                      }
                      quantity
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
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

      // Paginate through orders
      while (hasNextPage) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          console.warn("Sales computation timeout, returning partial results");
          break;
        }

        const variables = {
          first: 50,
          after: cursor,
          query: dateQuery,
        };

        const result = await client.query<any>(ordersQuery, variables);

        // Process orders
        for (const orderEdge of result.orders.edges) {
          const order = orderEdge.node;

          // Process line items
          for (const lineItemEdge of order.lineItems.edges) {
            const lineItem = lineItemEdge.node;

            // Check if variant matches our product
            if (lineItem.variant && variantIds.has(lineItem.variant.id)) {
              totalUnitsSold += lineItem.quantity || 0;
            }
          }

          // Handle lineItems pagination (if >250 line items in one order)
          if (order.lineItems.pageInfo.hasNextPage) {
            console.warn("Order has >250 line items, pagination not fully implemented");
            // TODO: Implement lineItems pagination if needed
          }

          processedOrders++;
        }

        // Update pagination
        hasNextPage = result.orders.pageInfo.hasNextPage;
        cursor = result.orders.pageInfo.endCursor;
      }

      // Cache the result
      await supabase.from("trak_product_sales_cache").upsert(
        {
          product_id: trakProductId,
          start_date: startDate,
          end_date: endDate,
          units_sold: totalUnitsSold,
          computed_at: new Date().toISOString(),
        },
        {
          onConflict: "product_id,start_date,end_date",
        }
      );

      return {
        data: {
          unitsSold: totalUnitsSold,
          computedAt: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      console.error("Error computing units sold:", error);

      // Check if it's a Shopify API error
      if (error instanceof Error && error.message.includes("date range")) {
        return {
          error: "Date range not supported by Shopify. Order history may be limited.",
        };
      }

      return { error: "Failed to compute units sold" };
    }
  } catch (error) {
    console.error("Error in getProductUnitsSold:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Gets cached sales data for a product
 */
export async function getCachedSalesData(
  trakProductId: string,
  startDate?: string,
  endDate?: string
): Promise<ActionResult<any[]>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS handles workspace membership)
    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("trak_product_sales_cache")
      .select("*")
      .eq("product_id", trakProductId)
      .order("start_date", { ascending: false });

    // Add date filters if provided
    if (startDate) {
      query = query.gte("start_date", startDate);
    }
    if (endDate) {
      query = query.lte("end_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching cached sales data:", error);
      return { error: "Failed to fetch cached data" };
    }

    return { data: data || [] };
  } catch (error) {
    console.error("Error in getCachedSalesData:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Invalidates (deletes) sales cache for a product
 */
export async function invalidateSalesCache(
  trakProductId: string
): Promise<ActionResult<void>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS handles workspace membership)
    const supabase = await createClient();

    // Delete cache entries
    const { error } = await supabase
      .from("trak_product_sales_cache")
      .delete()
      .eq("product_id", trakProductId);

    if (error) {
      console.error("Error invalidating sales cache:", error);
      return { error: "Failed to invalidate cache" };
    }

    return { data: undefined };
  } catch (error) {
    console.error("Error in invalidateSalesCache:", error);
    return { error: "Internal server error" };
  }
}
