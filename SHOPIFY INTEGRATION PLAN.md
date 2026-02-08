# Shopify Admin GraphQL Integration - Implementation Plan

## Context

This plan implements a read-only Shopify connector for Trak, enabling workspace owners to:
- Connect their Shopify store via OAuth
- Import products with variants and inventory
- Compute units sold from order data
- Maintain synchronized product information through background jobs

The integration follows Trak's existing architecture patterns: Next.js App Router, Supabase direct SQL, server actions with `ActionResult<T>` pattern, existing job queue system, and Radix UI components.

---

## Database Schema

**Migration:** `/supabase/migrations/20260208000000_add_shopify_integration.sql`

### Tables to Create

1. **`shopify_connections`** - OAuth credentials and shop metadata
   - `workspace_id` (FK) - **supports multiple Shopify stores per workspace**
   - `shop_domain` (text) - e.g., "my-store.myshopify.com"
   - `access_token_encrypted` - AES-256-GCM encrypted token
   - `encryption_key_id` - for key rotation support
   - `scopes` (text[]) - granted OAuth scopes
   - `sync_status` - 'active' | 'error' | 'disconnected'
   - **UNIQUE constraint:** `(workspace_id, shop_domain)` - allows multiple stores per workspace
   - RLS: `is_member_of_workspace(workspace_id)`

2. **`trak_products`** - Product metadata
   - `workspace_id`, `connection_id` (FK)
   - `shopify_product_id` (text, GID format)
   - `title`, `description`, `product_type`, `vendor`, `tags`
   - `featured_image_url`, `status`
   - `last_synced_at`, `shopify_created_at`, `shopify_updated_at`
   - UNIQUE constraint on `(connection_id, shopify_product_id)`
   - GIN index on `to_tsvector('english', title)` for search
   - RLS: `is_member_of_workspace(workspace_id)`

3. **`trak_product_variants`** - SKUs, pricing, options
   - `product_id` (FK to trak_products)
   - `shopify_variant_id` (text, GID format)
   - `title`, `sku`, `barcode`, `price`, `compare_at_price`
   - `option1_name`, `option1_value`, `option2_name`, `option2_value`, `option3_name`, `option3_value`
   - `inventory_item_id` - for inventory queries
   - `image_url`, `available_for_sale`, `inventory_tracked`
   - UNIQUE constraint on `(product_id, shopify_variant_id)`
   - Index on `sku` WHERE sku IS NOT NULL
   - RLS: Inherit from parent product via EXISTS subquery

4. **`trak_product_inventory`** - Inventory levels by location (InventoryLevel data)
   - `variant_id` (FK to trak_product_variants)
   - `location_id` (text, Shopify location GID)
   - `location_name` (text)
   - `available` (integer) - reliable field from InventoryLevel.available
   - `last_synced_at`
   - UNIQUE constraint on `(variant_id, location_id)`
   - RLS: Inherit from parent variant via EXISTS subquery

   **Also add to `trak_product_variants`:**
   - `available_total` (integer) - computed sum of available across all locations for fast UI display
   - Updated during inventory sync

5. **`shopify_sync_jobs`** - Background sync tracking (follows existing `indexing_jobs` pattern)
   - `workspace_id`, `connection_id` (FK)
   - `job_type` - 'full_sync' | 'inventory_sync' | 'metadata_sync' | 'initial_import' | 'sales_computation'
   - `status` - 'pending' | 'processing' | 'completed' | 'failed'
   - `total_items`, `processed_items`, `failed_items`, `attempts`
   - `error_message`, `started_at`, `completed_at`
   - Index on `(status, created_at)` WHERE status IN ('pending', 'processing')
   - Trigger: `set_updated_at()` on update
   - RLS: `is_member_of_workspace(workspace_id)`

6. **`trak_product_sales_cache`** - Cached units sold computation (PRODUCT-level, not variant)
   - `product_id` (FK to trak_products)
   - `start_date`, `end_date` (date range)
   - `units_sold` (integer) - sum across all variants
   - `computed_at` (timestamp)
   - **UNIQUE constraint:** `(product_id, start_date, end_date)`
   - Index on `(start_date, end_date)`
   - RLS: Inherit from parent product via EXISTS subquery

7. **`oauth_states`** - OAuth CSRF protection (new table)
   - `state` (text, unique) - CSRF token
   - `nonce` (text)
   - `workspace_id`, `user_id` (FK)
   - `provider` (text) - 'shopify'
   - `metadata` (jsonb) - `{ shop: "..." }`
   - `expires_at` (timestamp) - 5 minute expiration
   - Index on `(state, provider)`

---

## Security: Token Encryption

**File:** `/src/lib/shopify/encryption.ts`

Since Trak currently has no application-level encryption, implement AES-256-GCM encryption for Shopify tokens:

```typescript
"use server";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_ID = "v1"; // for rotation support

export async function encryptToken(plaintext: string): Promise<{
  encrypted: string;
  keyId: string;
}> {
  // Get key from env: SHOPIFY_TOKEN_ENCRYPTION_KEY (32-byte base64)
  // Generate random IV
  // Encrypt with AES-256-GCM
  // Format: base64(iv):base64(authTag):base64(ciphertext)
  // Return { encrypted, keyId: "v1" }
}

export async function decryptToken(encrypted: string, keyId: string): Promise<string> {
  // Parse format, decrypt, return plaintext
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}
```

**Environment Variable:**
```bash
SHOPIFY_TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
SHOPIFY_CLIENT_ID=<from Shopify Partner Dashboard>
SHOPIFY_CLIENT_SECRET=<from Shopify Partner Dashboard>
```

**Security Requirements:**
- Never log decrypted tokens
- Use timing-safe comparison for HMAC verification
- Validate shop domain with regex: `/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/`
- CSRF protection via state parameter (stored in `oauth_states` table)
- HMAC verification on callback per Shopify docs

---

## OAuth Flow

### 1. Install Route

**File:** `/src/app/api/shopify/install/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  // 1. Check auth with getAuthenticatedUser()
  // 2. Get shop + workspace_id from query params
  // 3. Validate shop domain format
  // 4. Verify workspace membership
  // 5. Generate state (32 bytes hex) and nonce (16 bytes hex)
  // 6. Store in oauth_states table with 5min expiration
  // 7. Build Shopify auth URL: https://{shop}/admin/oauth/authorize
  //    - client_id, scope (read_products,read_inventory,read_orders)
  //    - redirect_uri, state
  //    - NOTE: NOT using grant_options[]=per-user (workspace-level token, not per-user)
  // 8. Redirect to Shopify
}
```

### 2. Callback Route

**File:** `/src/app/api/shopify/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { encryptToken } from "@/lib/shopify/encryption";

function verifyHmac(query: Record<string, string>, hmac: string): boolean {
  // Build message: key=value&... (sorted, exclude hmac/signature)
  // HMAC-SHA256 with SHOPIFY_CLIENT_SECRET
  // Use crypto.timingSafeEqual for comparison
}

async function exchangeCodeForToken(shop: string, code: string) {
  // POST to https://{shop}/admin/oauth/access_token
  // Body: { client_id, client_secret, code }
  // Return { accessToken, scopes }
}

async function fetchShopMetadata(shop: string, accessToken: string) {
  // GET https://{shop}/admin/api/2024-01/shop.json
  // Header: X-Shopify-Access-Token
  // Return { name, email, currency }
}

export async function GET(request: NextRequest) {
  // 1. Extract code, hmac, shop, state from query params
  // 2. Verify HMAC signature
  // 3. Verify state in oauth_states table (check expiration)
  // 4. Exchange code for access token
  // 5. Fetch shop metadata
  // 6. Encrypt access token
  // 7. Upsert shopify_connections (onConflict: workspace_id, shop_domain) - supports multiple stores
  // 8. Delete used oauth_state
  // 9. Enqueue initial sync job
  // 10. Redirect to /dashboard/settings/integrations?success=true
}
```

### 3. Disconnect Route

**File:** `/src/app/api/shopify/disconnect/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Check auth
  // 2. Get workspace_id from body
  // 3. Soft delete: UPDATE sync_status = 'disconnected'
  // 4. Delete all pending shopify_sync_jobs for this connection
  // 5. Optionally: keep trak_products for historical reference
  // 6. Return success
}
```

---

## GraphQL Client

**File:** `/src/lib/shopify/client.ts`

```typescript
"use server";

interface ShopifyGraphQLClient {
  query<T>(query: string, variables?: Record<string, any>): Promise<T>;
  paginate<T>(query: string, variables: Record<string, any>, extractEdges: (data: any) => any[]): AsyncGenerator<T>;
}

export async function createShopifyClient(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyGraphQLClient> {
  const API_VERSION = "2024-01";
  const endpoint = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;

  return {
    async query(query, variables) {
      // Retry logic with exponential backoff (max 3 retries)
      // Handle rate limiting: check response headers (X-Shopify-Shop-Api-Call-Limit)
      // Handle throttling: check extensions.cost.throttleStatus
      // If throttled: delay and retry (exponential backoff)
      // Structured logging: shop, operation, latency, cost
      // Error handling: auth errors, validation, upstream 5xx
    },

    async *paginate(query, variables, extractEdges) {
      // Cursor-based pagination helper
      // Loop: query with cursor, yield items, update cursor
      // Handle pageInfo.hasNextPage
    }
  };
}
```

**Rate Limiting Strategy (Cost-Based Throttling):**
- **Primary:** Check `extensions.cost.throttleStatus` in GraphQL response
  - `throttleStatus.currentlyAvailable` < 100: delay before next request
  - `throttleStatus.restoreRate` indicates recovery speed (typically 50/second)
  - Calculate delay: `(requestedCost - currentlyAvailable) / restoreRate`
- **Secondary:** Check for HTTP 429 responses → exponential backoff (1s, 2s, 4s, 8s max)
- **Diagnostic only:** May check `X-Shopify-Shop-Api-Call-Limit` header if present, but not primary for GraphQL
- Log all throttle events with cost data for monitoring
- Track `extensions.cost.requestedQueryCost` and `actualQueryCost` for optimization

**GraphQL Queries to Use (Admin API, NO product listings):**

All queries use **Shopify Admin GraphQL API** under `read_products`, `read_inventory`, `read_orders` scopes:

1. **Product Discovery/Import:**
   ```graphql
   query GetProducts($first: Int!, $after: String, $query: String) {
     products(first: $first, after: $after, query: $query) {
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
           featuredImage { url }
           variants(first: 100) {
             edges {
               node {
                 id
                 title
                 sku
                 barcode
                 price
                 compareAtPrice
                 inventoryItem { id }
                 selectedOptions { name value }
                 image { url }
                 availableForSale
               }
             }
           }
         }
       }
       pageInfo { hasNextPage endCursor }
     }
   }
   ```

2. **Inventory Levels:**
   ```graphql
   query GetInventory($inventoryItemId: ID!) {
     inventoryItem(id: $inventoryItemId) {
       inventoryLevels(first: 50) {
         edges {
           node {
             location { id name }
             available
           }
         }
       }
     }
   }
   ```

3. **Orders for Units Sold:**
   ```graphql
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
                 variant { id }
                 quantity
               }
             }
             pageInfo { hasNextPage endCursor }
           }
         }
       }
       pageInfo { hasNextPage endCursor }
     }
   }
   ```

   **Query filter for date ranges:**
   - Use Shopify order search query syntax exactly
   - Example: `query: "created_at:>=2024-01-01 created_at:<=2024-01-31"`
   - **IMPORTANT:** Validate query syntax on dev store first; Shopify's search grammar is strict
   - Implement a helper function `buildOrderDateQuery(startDate, endDate)` that formats date filters and test thoroughly

   **LineItems Pagination:**
   - If `lineItems.pageInfo.hasNextPage` is true, the order has >250 line items (rare but possible)
   - **Strategy:** Fetch additional pages of lineItems for that order to avoid undercounting
   - Alternative: If `hasNextPage`, mark computation as partial and enqueue async recompute job

**Important:** Do NOT use `productListings` query (requires `read_product_listings` scope). All product data comes from `products` query under `read_products` scope.

---

## Server Actions

Follow existing pattern from `/src/app/actions/project.ts`:
- All actions are `"use server"`
- Return type: `ActionResult<T> = { data: T } | { error: string }`
- Use `getAuthenticatedUser()` from `/src/lib/auth-utils.ts`
- Use `createClient()` from `/src/lib/supabase/server.ts`
- Call `revalidatePath()` where appropriate

### 1. Connection Actions

**File:** `/src/app/actions/shopify-connection.ts`

```typescript
"use server";

export async function listShopifyConnections(
  workspaceId: string
): Promise<ActionResult<ShopifyConnection[]>> {
  // Check auth
  // Check workspace membership
  // Query shopify_connections WHERE workspace_id = ? (SELECT without access_token_encrypted)
  // Return array of connections (may be multiple stores)
}

export async function getShopifyConnection(
  connectionId: string
): Promise<ActionResult<ShopifyConnection | null>> {
  // Check auth (RLS handles workspace membership)
  // Query shopify_connections WHERE id = ? (SELECT without access_token_encrypted)
  // Return connection or null
}

export async function disconnectShopify(
  connectionId: string
): Promise<ActionResult<void>> {
  // Check auth (RLS handles workspace membership)
  // Update shopify_connections SET sync_status = 'disconnected' WHERE id = ?
  // Delete pending sync jobs for this connection_id
  // Revalidate /dashboard/settings/integrations
}
```

### 2. Product Actions

**File:** `/src/app/actions/shopify-products.ts`

```typescript
"use server";

export async function listShopifyProducts(
  connectionId: string,
  options: { search?: string; limit?: number; afterCursor?: string }
): Promise<ActionResult<{
  products: Product[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}>> {
  // Check auth (RLS handles workspace membership)
  // Get connection by connectionId
  // Decrypt token
  // Create GraphQL client
  // Query products using Admin GraphQL Products query (under read_products scope)
  //   - Use cursor pagination: products(first: limit, after: afterCursor)
  //   - Use query filter for search: `query: "title:*${search}*"`
  //   - Return pageInfo { hasNextPage, endCursor } from GraphQL response
  // Return { products, pageInfo }
}

export async function importShopifyProducts(
  connectionId: string,
  productIds: string[] // Shopify GIDs
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  // Check auth (RLS handles workspace membership)
  // Get connection by connectionId
  // Decrypt token
  // Create GraphQL client
  // For each productId:
  //   - Fetch full product data using Admin GraphQL Products query
  //   - Fetch variants (each variant has inventoryItem.id)
  //   - Fetch inventory using InventoryLevel query:
  //       inventoryItem(id: "...") { inventoryLevels { edges { node { location, available } } } }
  //   - Upsert trak_products (onConflict: connection_id, shopify_product_id)
  //   - For each variant:
  //       - Upsert trak_product_variants (onConflict: product_id, shopify_variant_id)
  //       - For each location's inventory level:
  //           - Upsert trak_product_inventory (variant_id, location_id, available)
  //       - Compute available_total = SUM(available) across all locations
  //       - Update trak_product_variants.available_total
  // Return counts
  // Revalidate /dashboard/settings/integrations
}

export async function refreshProduct(
  trakProductId: string
): Promise<ActionResult<void>> {
  // Check auth (RLS handles workspace membership)
  // Get trak_product with connection_id
  // Get connection + decrypt token
  // Create GraphQL client
  // Re-fetch product from Shopify (Products query + InventoryLevel query)
  // Update trak_products, trak_product_variants, trak_product_inventory
  // Recompute available_total for each variant
  // Invalidate sales cache for this product
}

export async function getProductDetails(
  trakProductId: string
): Promise<ActionResult<ProductWithVariants>> {
  // Check auth (via RLS)
  // Join trak_products + trak_product_variants + trak_product_inventory
  // Return full product data
}
```

### 3. Sales Actions

**File:** `/src/app/actions/shopify-sales.ts`

```typescript
"use server";

export async function getProductUnitsSold(
  trakProductId: string,
  startDate: string, // ISO date
  endDate: string     // ISO date
): Promise<ActionResult<{
  unitsSold: number;
  computedAt: string;
  cached: boolean;
  warning?: string; // e.g., "Order history limited to 60 days"
}>> {
  // Check auth
  // Get product + all variants

  // Check cache: SELECT FROM trak_product_sales_cache
  //   WHERE product_id = ? AND start_date = ? AND end_date = ?
  // If cached and fresh (< 1 hour old): return cached

  // Otherwise, compute:
  // 1. Calculate date range span (days)
  // 2. If range > 90 days OR estimated order volume is high:
  //    - Enqueue async job (shopify_sync_jobs with type 'sales_computation')
  //    - Return { unitsSold: 0, cached: false, warning: "Computing sales data in background..." }
  //    - Job will compute and cache result
  // 3. For smaller ranges (<= 90 days):
  //    - Get connection + decrypt token
  //    - Create GraphQL client
  //    - Query orders with date filter (createdAt >= startDate AND createdAt <= endDate)
  //    - Paginate through orders connection
  //    - For each order, iterate lineItems connection
  //    - Sum quantities where lineItem.variant.id matches ANY product variant ID
  //    - Enforce timeout: max 30 seconds of processing
  //    - Cache result: INSERT INTO trak_product_sales_cache (product_id, start_date, end_date, units_sold)
  //    - If Shopify returns error about date range: set warning flag
  // Return result
}
```

---

## Background Sync

Reuse existing job queue pattern from `/src/lib/search/job-queue.ts`.

### 1. Sync Worker

**File:** `/src/lib/shopify/sync-worker.ts`

```typescript
"use server";

import { SupabaseClient } from "@supabase/supabase-js";

export type SyncJobType = "full_sync" | "inventory_sync" | "metadata_sync" | "initial_import" | "sales_computation";

export class ShopifySyncQueue {
  constructor(private supabase: SupabaseClient) {}

  async enqueue(params: {
    workspaceId: string;
    connectionId: string;
    jobType: SyncJobType;
  }): Promise<string | null> {
    // Insert into shopify_sync_jobs with status: 'pending'
    // Deduplication: check for pending job of same type
  }

  async pickNextJob(): Promise<ShopifySyncJob | null> {
    // SELECT * FROM shopify_sync_jobs WHERE status = 'pending'
    // ORDER BY created_at LIMIT 1
    // UPDATE status = 'processing' (optimistic lock with WHERE status = 'pending')
  }

  async completeJob(jobId: string): Promise<void> {
    // UPDATE status = 'completed', completed_at = now()
  }

  async failJob(jobId: string, error: string): Promise<void> {
    // UPDATE status = 'failed', error_message = ?, attempts = attempts + 1
  }

  async updateProgress(jobId: string, processed: number): Promise<void> {
    // UPDATE processed_items = ?
  }
}

export async function processSyncJob(job: ShopifySyncJob): Promise<void> {
  // Get connection
  // Decrypt token
  // Create GraphQL client
  // Switch on job_type:
  //   - initial_import:
  //       Fetch all products (paginated using Products query), import to DB
  //   - inventory_sync:
  //       For all imported products in this connection:
  //         - Get all variant inventory_item_ids
  //         - For each inventory_item_id:
  //             - Query InventoryLevel: inventoryItem(id) { inventoryLevels { edges { node { location, available } } } }
  //             - Upsert trak_product_inventory (variant_id, location_id, available)
  //         - For each variant: compute available_total = SUM(available)
  //         - Update trak_product_variants.available_total
  //   - metadata_sync:
  //       Refresh product metadata (title, description, tags, etc.) from Products query
  //   - full_sync:
  //       Both inventory + metadata
  //   - sales_computation:
  //       Compute units sold for a specific product/date range (enqueued from getProductUnitsSold)
  // Update progress periodically (every 10 items)
  // Handle errors gracefully (partial success, log failures)
}
```

### 2. Worker API Route

**File:** `/src/app/api/shopify/sync/worker/route.ts`

Follow pattern from `/src/app/api/internal/indexing/worker/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  // Security: Check Authorization header matches CRON_SECRET
  // const authHeader = req.headers.get("authorization");
  // const expectedAuth = process.env.CRON_SECRET;
  // const isAuthorized = authHeader === `Bearer ${expectedAuth}` || manual trigger flag
  // if (!isAuthorized) return 401

  // Create ShopifySyncQueue
  // Process up to 10 jobs per request:
  //   - pickNextJob()
  //   - processSyncJob(job)
  //   - completeJob() or failJob()
  // Return { processed, failed, remaining }
}
```

**Note:** The pg_cron function sends `Authorization: Bearer <secret>`, so worker must check that header.

### 3. Cron Setup

Add to migration file:

```sql
-- Create HTTP trigger function for sync worker
CREATE OR REPLACE FUNCTION trigger_shopify_sync_worker()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://yourdomain.com/api/shopify/sync/worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
END;
$$;

-- Schedule nightly inventory sync (2 AM UTC)
SELECT cron.schedule(
  'shopify-inventory-sync',
  '0 2 * * *',
  $$SELECT trigger_shopify_sync_worker();$$
);

-- Schedule weekly metadata refresh (Sunday 3 AM UTC)
SELECT cron.schedule(
  'shopify-metadata-sync',
  '0 3 * * 0',
  $$SELECT trigger_shopify_sync_worker();$$
);
```

**Note:** Requires Supabase `pg_cron` and `pg_net` extensions (see `/INDEXING_CRON_SETUP.md`).

---

## UI Components

### 1. Settings Page

**File:** `/src/app/dashboard/settings/integrations/page.tsx`

Create new settings section (currently doesn't exist in Trak):

```tsx
export default async function IntegrationsPage() {
  // Get workspace_id from context
  // Fetch all shopify connections via listShopifyConnections(workspaceId)

  return (
    <div className="p-8">
      <h1>Integrations</h1>
      <h2>Shopify Stores</h2>
      {connections.map((connection) => (
        <ShopifyConnectionCard key={connection.id} connection={connection} />
      ))}
      <Button onClick={() => setShowConnectDialog(true)}>
        + Connect Another Store
      </Button>
      <ConnectShopifyDialog isOpen={showConnectDialog} onClose={...} />
    </div>
  );
}
```

### 2. Connection Card

**File:** `/src/components/shopify/connection-card.tsx`

```tsx
"use client";

export function ShopifyConnectionCard({ connection }: Props) {
  // Show shop name (connection.shop_domain), status badge
  // Show sync status and last_synced_at
  // "Import Products" button → opens ProductPicker for this connection
  // "Disconnect" button → calls disconnectShopify(connection.id)
  // Each card represents one connected Shopify store
}
```

### 3. Connect Dialog

**File:** `/src/components/shopify/connect-shopify-dialog.tsx`

Follow pattern from `/src/app/dashboard/projects/project-dialog.tsx`:

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ConnectShopifyDialog({ isOpen, onClose, workspaceId }: Props) {
  const [shopDomain, setShopDomain] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(() => {
      // Redirect to /api/shopify/install?shop={shopDomain}&workspace_id={workspaceId}
      window.location.href = `/api/shopify/install?shop=${shopDomain}&workspace_id=${workspaceId}`;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Shopify Store</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="your-store.myshopify.com"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
        />
        <Button onClick={handleConnect} disabled={isPending}>
          {isPending ? "Connecting..." : "Connect"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Product Picker

**File:** `/src/components/shopify/product-picker.tsx`

Follow pattern from `/src/components/tables/cells/relation-selector.tsx`:

```tsx
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function ShopifyProductPicker({ isOpen, onClose, connectionId, onImport }: Props) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;

  // Fetch products with server-side pagination
  useEffect(() => {
    // Call listShopifyProducts(connectionId, { search, limit: pageSize, offset: 0 })
    // Uses Admin GraphQL Products query under read_products scope
  }, [search, connectionId]);

  const handleLoadMore = () => {
    // Fetch next page
  };

  const handleImport = async () => {
    // Call importShopifyProducts(connectionId, Array.from(selected))
    // Show success message
    // onClose()
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                const newSelected = new Set(selected);
                if (newSelected.has(product.id)) {
                  newSelected.delete(product.id);
                } else {
                  newSelected.add(product.id);
                }
                setSelected(newSelected);
              }}
              className="flex items-center gap-3 p-3 hover:bg-gray-50"
            >
              <input type="checkbox" checked={selected.has(product.id)} />
              {product.featuredImage && (
                <img src={product.featuredImage.url} className="w-12 h-12 object-cover rounded" />
              )}
              <div>
                <div className="font-medium">{product.title}</div>
                <div className="text-sm text-gray-500">
                  {product.status} • {product.variantsCount} variants
                </div>
              </div>
            </button>
          ))}
          {hasMore && (
            <Button onClick={handleLoadMore} variant="ghost">
              Load More
            </Button>
          )}
        </div>
        <Button onClick={handleImport} disabled={selected.size === 0}>
          Import {selected.size} Products
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

### 5. Product Detail View

**File:** `/src/components/shopify/product-detail.tsx`

```tsx
"use client";

export function ProductDetail({ trakProductId }: Props) {
  // Fetch product details via getProductDetails()
  // Display: images, title, description, variants table
  // Show UnitsSoldWidget
  // "Refresh from Shopify" button -> calls refreshProduct()
}
```

### 6. Units Sold Widget

**File:** `/src/components/shopify/units-sold-widget.tsx`

```tsx
"use client";

export function UnitsSoldWidget({ trakProductId }: Props) {
  const [dateRange, setDateRange] = useState("7d"); // 7d, 30d, 60d, custom
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [data, setData] = useState<SalesData | null>(null);

  useEffect(() => {
    // Compute date range from preset
    // Call getProductUnitsSold(trakProductId, startDate, endDate)
  }, [dateRange, trakProductId]);

  return (
    <div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setDateRange("7d")}>Last 7 Days</Button>
        <Button size="sm" onClick={() => setDateRange("30d")}>Last 30 Days</Button>
        <Button size="sm" onClick={() => setDateRange("60d")}>Last 60 Days</Button>
        {/* Custom date picker */}
      </div>
      {data && (
        <div className="mt-4">
          <div className="text-3xl font-bold">{data.unitsSold}</div>
          <div className="text-sm text-gray-500">
            units sold {data.cached && "(cached)"}
          </div>
          {data.warning && (
            <div className="text-sm text-amber-600 mt-2">{data.warning}</div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## "Create Project from Product" Integration

**File:** `/src/app/actions/project.ts` (modify existing)

Add helper function:

```typescript
export async function createProjectFromShopifyProduct(
  workspaceId: string,
  trakProductId: string
): Promise<ActionResult<{ projectId: string; tabId: string }>> {
  // Get product details
  // Create project with title = product.title
  // Create first tab
  // Add blocks:
  //   - Image gallery block with product images
  //   - Text block with product description
  //   - Custom field/block with link to trak_product_id
  // Return project ID
}
```

Add to UI: "Create Project" button in ProductDetail component.

---

## Critical Files Summary

1. **Migration:** `/supabase/migrations/20260208000000_add_shopify_integration.sql`
2. **Encryption:** `/src/lib/shopify/encryption.ts`
3. **OAuth:** `/src/app/api/shopify/install/route.ts`, `/src/app/api/shopify/callback/route.ts`
4. **GraphQL Client:** `/src/lib/shopify/client.ts`
5. **Server Actions:** `/src/app/actions/shopify-connection.ts`, `shopify-products.ts`, `shopify-sales.ts`
6. **Sync Worker:** `/src/lib/shopify/sync-worker.ts`, `/src/app/api/shopify/sync/worker/route.ts`
7. **UI:** `/src/app/dashboard/settings/integrations/page.tsx`, `/src/components/shopify/*`

---

## Verification & Testing

### 1. Public App Setup
- Create Shopify Partner account (https://partners.shopify.com)
- In Partner Dashboard: **Apps → Create app → Create app manually**
- App type: **Public app**
- Set App URL and Allowed redirection URL(s):
  - **App URL:** `https://yourdomain.com/` (base app URL, not deep settings page)
  - **Redirection URLs:** `https://yourdomain.com/api/shopify/callback`
- Configure scopes: `read_products`, `read_inventory`, `read_orders` (NO read_product_listings)
- Get **Client ID** and **Client Secret** from app credentials
- Create development store for testing
- Set environment variables

### 2. OAuth Flow Test
- Click "Connect Shopify" in Trak
- Enter dev store domain
- Redirect to Shopify authorization
- Grant permissions
- Verify redirect back to Trak
- Check `shopify_connections` table: token encrypted, scopes correct
- Verify state cleaned up in `oauth_states`

### 3. Product Import Test
- Click "Import Products" button
- Search for products (server-side search works)
- Select 2-3 products
- Click "Import"
- Verify `trak_products`, `trak_product_variants`, `trak_product_inventory` populated
- Run import again (idempotent check)

### 4. Inventory Sync Test
- Check inventory in Shopify admin for a SKU
- Trigger inventory sync (manual or via cron)
- Verify `trak_product_inventory.available` matches Shopify

### 5. Units Sold Test
- Create 2 test orders in dev store with imported products
- In Trak, view product detail
- Select "Last 7 days"
- Verify units sold = sum of line item quantities
- Check `trak_product_sales_cache` for cached result
- Request again (should use cache)

### 6. Security Tests
- Test invalid HMAC (should reject)
- Test invalid state (should reject)
- Test expired state (should reject)
- Test invalid shop domain (should reject)
- Verify tokens never appear in logs
- Verify non-members can't access other workspaces (RLS check)

### 7. Error Handling
- Test with revoked Shopify token (should show error)
- Test with date range > 60 days (should show warning)
- Test rate limiting (artificially trigger 429, verify backoff)

### 8. Background Sync
- Manually trigger worker: `POST /api/shopify/sync/worker` with CRON_SECRET
- Verify job picked from queue
- Verify products synced
- Check `shopify_sync_jobs` for status
- Test cron schedule (wait for scheduled run or trigger manually)

---

## Environment Variables Checklist

```bash
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# New for Shopify
SHOPIFY_CLIENT_ID=<from Partner Dashboard>
SHOPIFY_CLIENT_SECRET=<from Partner Dashboard>
SHOPIFY_TOKEN_ENCRYPTION_KEY=<generate with generateEncryptionKey()>
NEXT_PUBLIC_APP_URL=https://yourdomain.com  # for OAuth redirect URI
CRON_SECRET=<random secret for worker protection>
```

---

## Deployment Checklist

- [ ] Run migration: `supabase migration up`
- [ ] Enable pg_cron extension in Supabase dashboard
- [ ] Enable pg_net extension in Supabase dashboard
- [ ] Set environment variables in production
- [ ] Test OAuth flow end-to-end
- [ ] Schedule cron jobs (or verify migration created them)
- [ ] Set up monitoring/alerts for sync job failures
- [ ] Document for users: how to connect Shopify, what data is imported

---

## Notes

- **Public Shopify App:** Uses public app OAuth flow from Partner Dashboard (not custom app per store)
- **App URL:** Set to base app URL (e.g., `https://yourdomain.com/`), not deep settings page
- **No Shopify Billing:** Not implementing Shopify Billing API
- **Read-Only:** Only `read_products`, `read_inventory`, `read_orders` scopes (NO `read_product_listings`)
- **Pagination:** All GraphQL queries use cursor-based pagination (NOT offset-based)
- **Rate Limits:** Primary mechanism is GraphQL cost-based throttling via `extensions.cost.throttleStatus`
- **Order History Limitation:** Shopify may limit order access to recent months; UI warns users gracefully
- **Multi-Store Support:** **Multiple Shopify stores per workspace** supported via UNIQUE (workspace_id, shop_domain)
- **Product-Level Sales Cache:** Units sold cached at product level (sum of all variants), not variant level
- **Bounded Computation:** Large date ranges (>90 days) trigger async jobs to avoid timeouts
- **Inventory:** Uses InventoryItem + InventoryLevel correctly, stores `available` per location + `available_total` at variant level
- **OAuth Token Scope:** Workspace/store-level token (NOT per-user) - no `grant_options[]=per-user`
- **Connection Traceability:** All tables can be traced back to `connection_id` for cleanup when store disconnects
- **LineItems Pagination:** Orders query paginates lineItems (first: 250) and handles `hasNextPage` to avoid undercounting
- **Query Syntax Validation:** Shopify order search query syntax is strict - implement `buildOrderDateQuery()` helper and validate on dev store
- **Cron Security:** Worker checks `Authorization: Bearer <CRON_SECRET>` header (matches what pg_cron sends)
