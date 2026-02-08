const API_VERSION = "2024-01";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

interface PaginationInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyGraphQLClient {
  query<T>(query: string, variables?: Record<string, any>): Promise<T>;
  paginate<T>(
    query: string,
    variables: Record<string, any>,
    extractEdges: (data: any) => { nodes: T[]; pageInfo: PaginationInfo }
  ): AsyncGenerator<T>;
}

/**
 * Creates a Shopify GraphQL client for making API requests
 * @param shopDomain The shop domain (e.g., "my-store.myshopify.com")
 * @param accessToken The Shopify access token
 * @returns ShopifyGraphQLClient instance
 */
export async function createShopifyClient(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyGraphQLClient> {
  const endpoint = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;

  /**
   * Makes a GraphQL query with retry and rate limiting
   */
  async function query<T>(
    queryString: string,
    variables?: Record<string, any>
  ): Promise<T> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        const startTime = Date.now();

        // Make the request
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query: queryString,
            variables: variables || {},
          }),
        });

        const latency = Date.now() - startTime;

        // Check for HTTP errors
        if (!response.ok) {
          // Handle rate limiting (HTTP 429)
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const delayMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : BASE_DELAY_MS * Math.pow(2, retryCount);

            console.warn(`[Shopify] Rate limited (HTTP 429), retrying after ${delayMs}ms`, {
              shop: shopDomain,
              attempt: retryCount + 1,
            });

            await sleep(delayMs);
            retryCount++;
            continue;
          }

          // Handle auth errors (no retry)
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
          }

          // Handle server errors (retry)
          if (response.status >= 500) {
            const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
            console.warn(
              `[Shopify] Server error ${response.status}, retrying after ${delayMs}ms`,
              {
                shop: shopDomain,
                attempt: retryCount + 1,
              }
            );

            await sleep(delayMs);
            retryCount++;
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: GraphQLResponse<T> = await response.json();

        // Log cost information for monitoring
        if (result.extensions?.cost) {
          const { requestedQueryCost, actualQueryCost, throttleStatus } = result.extensions.cost;
          console.log("[Shopify] Query cost", {
            shop: shopDomain,
            requestedCost: requestedQueryCost,
            actualCost: actualQueryCost,
            available: throttleStatus.currentlyAvailable,
            maximum: throttleStatus.maximumAvailable,
            latency,
          });

          // Check if we need to throttle based on available points
          if (throttleStatus.currentlyAvailable < 100) {
            const neededPoints = 100 - throttleStatus.currentlyAvailable;
            const delayMs = Math.ceil((neededPoints / throttleStatus.restoreRate) * 1000);
            console.warn(`[Shopify] Throttling: available points low, delaying ${delayMs}ms`, {
              shop: shopDomain,
              available: throttleStatus.currentlyAvailable,
            });
            await sleep(delayMs);
          }
        }

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e) => e.message).join(", ");
          console.error("[Shopify] GraphQL errors", {
            shop: shopDomain,
            errors: result.errors,
          });
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }

        // Return the data
        if (!result.data) {
          throw new Error("No data returned from GraphQL query");
        }

        return result.data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on auth errors or client errors
        if (
          error instanceof Error &&
          (error.message.includes("Authentication failed") ||
            error.message.includes("GraphQL errors"))
        ) {
          throw error;
        }

        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
          console.warn(`[Shopify] Request failed, retrying after ${delayMs}ms`, {
            shop: shopDomain,
            attempt: retryCount + 1,
            error: error instanceof Error ? error.message : String(error),
          });
          await sleep(delayMs);
          retryCount++;
        } else {
          break;
        }
      }
    }

    // Max retries exceeded
    throw new Error(
      `Max retries exceeded: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Paginates through a GraphQL connection
   */
  async function* paginate<T>(
    queryString: string,
    variables: Record<string, any>,
    extractEdges: (data: any) => { nodes: T[]; pageInfo: PaginationInfo }
  ): AsyncGenerator<T> {
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      // Add cursor to variables if we have one
      const queryVariables = {
        ...variables,
        ...(cursor ? { after: cursor } : {}),
      };

      // Execute query
      const data = await query<any>(queryString, queryVariables);

      // Extract edges and page info
      const { nodes, pageInfo } = extractEdges(data);

      // Yield each node
      for (const node of nodes) {
        yield node;
      }

      // Update pagination state
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      // Break if no more pages
      if (!hasNextPage) {
        break;
      }
    }
  }

  return {
    query,
    paginate,
  };
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to build order date query for Shopify search
 * @param startDate ISO date string (YYYY-MM-DD)
 * @param endDate ISO date string (YYYY-MM-DD)
 * @returns Shopify search query string
 */
export function buildOrderDateQuery(startDate: string, endDate: string): string {
  // Shopify uses specific date format for search
  // Example: "created_at:>=2024-01-01 created_at:<=2024-01-31"
  return `created_at:>=${startDate} created_at:<=${endDate}`;
}

/**
 * Helper function to extract product ID from Shopify GID
 * @param gid Shopify Global ID (e.g., "gid://shopify/Product/123456")
 * @returns Numeric ID as string
 */
export function extractIdFromGid(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}

/**
 * Helper function to build Shopify GID
 * @param type Resource type (e.g., "Product", "Variant")
 * @param id Numeric ID
 * @returns Shopify Global ID
 */
export function buildGid(type: string, id: string | number): string {
  return `gid://shopify/${type}/${id}`;
}
