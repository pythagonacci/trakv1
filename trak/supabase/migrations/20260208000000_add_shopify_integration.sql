-- Shopify Integration Migration
-- Creates tables for OAuth connections, products, variants, inventory, sync jobs, and sales cache

-- Enable required extensions if not already enabled
-- Note: pg_cron and pg_net should be enabled in Supabase dashboard

-- 1. OAuth states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  nonce text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_oauth_states_state_provider ON oauth_states(state, provider);
CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);

-- 2. Shopify connections table - OAuth credentials and shop metadata
CREATE TABLE IF NOT EXISTS shopify_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  access_token_encrypted text NOT NULL,
  encryption_key_id text NOT NULL DEFAULT 'v1',
  scopes text[] NOT NULL DEFAULT '{}',
  sync_status text NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disconnected')),
  shop_name text,
  shop_email text,
  shop_currency text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Support multiple Shopify stores per workspace
  CONSTRAINT uq_shopify_connections_workspace_shop UNIQUE (workspace_id, shop_domain)
);

CREATE INDEX idx_shopify_connections_workspace_id ON shopify_connections(workspace_id);
CREATE INDEX idx_shopify_connections_sync_status ON shopify_connections(sync_status);

-- RLS for shopify_connections
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace's Shopify connections"
  ON shopify_connections FOR SELECT
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can insert Shopify connections for their workspace"
  ON shopify_connections FOR INSERT
  WITH CHECK (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can update their workspace's Shopify connections"
  ON shopify_connections FOR UPDATE
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can delete their workspace's Shopify connections"
  ON shopify_connections FOR DELETE
  USING (is_member_of_workspace(workspace_id));

-- 3. Trak products table - Product metadata from Shopify
CREATE TABLE IF NOT EXISTS trak_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES shopify_connections(id) ON DELETE CASCADE,
  shopify_product_id text NOT NULL,
  title text NOT NULL,
  description text,
  product_type text,
  vendor text,
  tags text[] DEFAULT '{}',
  featured_image_url text,
  status text NOT NULL DEFAULT 'active',
  last_synced_at timestamptz DEFAULT now() NOT NULL,
  shopify_created_at timestamptz,
  shopify_updated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uq_trak_products_connection_shopify_id UNIQUE (connection_id, shopify_product_id)
);

CREATE INDEX idx_trak_products_workspace_id ON trak_products(workspace_id);
CREATE INDEX idx_trak_products_connection_id ON trak_products(connection_id);
CREATE INDEX idx_trak_products_shopify_product_id ON trak_products(shopify_product_id);
-- Full-text search index on title
CREATE INDEX idx_trak_products_title_search ON trak_products USING GIN (to_tsvector('english', title));

-- RLS for trak_products
ALTER TABLE trak_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace's products"
  ON trak_products FOR SELECT
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can insert products for their workspace"
  ON trak_products FOR INSERT
  WITH CHECK (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can update their workspace's products"
  ON trak_products FOR UPDATE
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can delete their workspace's products"
  ON trak_products FOR DELETE
  USING (is_member_of_workspace(workspace_id));

-- 4. Trak product variants table - SKUs, pricing, options
CREATE TABLE IF NOT EXISTS trak_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES trak_products(id) ON DELETE CASCADE,
  shopify_variant_id text NOT NULL,
  title text NOT NULL,
  sku text,
  barcode text,
  price numeric(10, 2),
  compare_at_price numeric(10, 2),
  option1_name text,
  option1_value text,
  option2_name text,
  option2_value text,
  option3_name text,
  option3_value text,
  inventory_item_id text,
  image_url text,
  available_for_sale boolean DEFAULT true,
  inventory_tracked boolean DEFAULT true,
  available_total integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uq_trak_product_variants_product_shopify_id UNIQUE (product_id, shopify_variant_id)
);

CREATE INDEX idx_trak_product_variants_product_id ON trak_product_variants(product_id);
CREATE INDEX idx_trak_product_variants_shopify_variant_id ON trak_product_variants(shopify_variant_id);
CREATE INDEX idx_trak_product_variants_sku ON trak_product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_trak_product_variants_inventory_item_id ON trak_product_variants(inventory_item_id);

-- RLS for trak_product_variants (inherits from parent product)
ALTER TABLE trak_product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view variants of their workspace's products"
  ON trak_product_variants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_variants.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can insert variants for their workspace's products"
  ON trak_product_variants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_variants.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can update variants of their workspace's products"
  ON trak_product_variants FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_variants.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can delete variants of their workspace's products"
  ON trak_product_variants FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_variants.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

-- 5. Trak product inventory table - Inventory levels by location
CREATE TABLE IF NOT EXISTS trak_product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES trak_product_variants(id) ON DELETE CASCADE,
  location_id text NOT NULL,
  location_name text NOT NULL,
  available integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uq_trak_product_inventory_variant_location UNIQUE (variant_id, location_id)
);

CREATE INDEX idx_trak_product_inventory_variant_id ON trak_product_inventory(variant_id);
CREATE INDEX idx_trak_product_inventory_location_id ON trak_product_inventory(location_id);

-- RLS for trak_product_inventory (inherits from parent variant)
ALTER TABLE trak_product_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory of their workspace's variants"
  ON trak_product_inventory FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trak_product_variants
    INNER JOIN trak_products ON trak_products.id = trak_product_variants.product_id
    WHERE trak_product_variants.id = trak_product_inventory.variant_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can insert inventory for their workspace's variants"
  ON trak_product_inventory FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trak_product_variants
    INNER JOIN trak_products ON trak_products.id = trak_product_variants.product_id
    WHERE trak_product_variants.id = trak_product_inventory.variant_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can update inventory of their workspace's variants"
  ON trak_product_inventory FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM trak_product_variants
    INNER JOIN trak_products ON trak_products.id = trak_product_variants.product_id
    WHERE trak_product_variants.id = trak_product_inventory.variant_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can delete inventory of their workspace's variants"
  ON trak_product_inventory FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trak_product_variants
    INNER JOIN trak_products ON trak_products.id = trak_product_variants.product_id
    WHERE trak_product_variants.id = trak_product_inventory.variant_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

-- 6. Shopify sync jobs table - Background sync tracking
CREATE TABLE IF NOT EXISTS shopify_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES shopify_connections(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('full_sync', 'inventory_sync', 'metadata_sync', 'initial_import', 'sales_computation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_items integer DEFAULT 0,
  processed_items integer DEFAULT 0,
  failed_items integer DEFAULT 0,
  attempts integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_shopify_sync_jobs_workspace_id ON shopify_sync_jobs(workspace_id);
CREATE INDEX idx_shopify_sync_jobs_connection_id ON shopify_sync_jobs(connection_id);
CREATE INDEX idx_shopify_sync_jobs_status_created ON shopify_sync_jobs(status, created_at)
  WHERE status IN ('pending', 'processing');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shopify_sync_jobs_updated_at
  BEFORE UPDATE ON shopify_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Also add trigger to other tables
CREATE TRIGGER shopify_connections_updated_at
  BEFORE UPDATE ON shopify_connections
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trak_products_updated_at
  BEFORE UPDATE ON trak_products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trak_product_variants_updated_at
  BEFORE UPDATE ON trak_product_variants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trak_product_inventory_updated_at
  BEFORE UPDATE ON trak_product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS for shopify_sync_jobs
ALTER TABLE shopify_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace's sync jobs"
  ON shopify_sync_jobs FOR SELECT
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can insert sync jobs for their workspace"
  ON shopify_sync_jobs FOR INSERT
  WITH CHECK (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can update their workspace's sync jobs"
  ON shopify_sync_jobs FOR UPDATE
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Users can delete their workspace's sync jobs"
  ON shopify_sync_jobs FOR DELETE
  USING (is_member_of_workspace(workspace_id));

-- 7. Trak product sales cache table - Cached units sold computation
CREATE TABLE IF NOT EXISTS trak_product_sales_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES trak_products(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  units_sold integer NOT NULL DEFAULT 0,
  computed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uq_trak_product_sales_cache_product_dates UNIQUE (product_id, start_date, end_date)
);

CREATE INDEX idx_trak_product_sales_cache_product_id ON trak_product_sales_cache(product_id);
CREATE INDEX idx_trak_product_sales_cache_dates ON trak_product_sales_cache(start_date, end_date);

-- RLS for trak_product_sales_cache (inherits from parent product)
ALTER TABLE trak_product_sales_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales cache of their workspace's products"
  ON trak_product_sales_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_sales_cache.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can insert sales cache for their workspace's products"
  ON trak_product_sales_cache FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_sales_cache.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can update sales cache of their workspace's products"
  ON trak_product_sales_cache FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_sales_cache.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

CREATE POLICY "Users can delete sales cache of their workspace's products"
  ON trak_product_sales_cache FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trak_products
    WHERE trak_products.id = trak_product_sales_cache.product_id
    AND is_member_of_workspace(trak_products.workspace_id)
  ));

-- 8. Cron setup for background sync
-- Note: This requires pg_cron and pg_net extensions to be enabled in Supabase dashboard
-- The actual cron jobs will be set up via SQL in production after deployment

-- Create HTTP trigger function for sync worker
CREATE OR REPLACE FUNCTION trigger_shopify_sync_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url text;
  cron_secret text;
BEGIN
  -- Get app URL from settings (you'll need to set this)
  app_url := current_setting('app.shopify_sync_url', true);
  cron_secret := current_setting('app.cron_secret', true);

  IF app_url IS NULL OR app_url = '' THEN
    RAISE NOTICE 'Shopify sync URL not configured (app.shopify_sync_url)';
    RETURN;
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE NOTICE 'Cron secret not configured (app.cron_secret)';
    RETURN;
  END IF;

  -- Make HTTP POST request to sync worker
  PERFORM net.http_post(
    url := app_url || '/api/shopify/sync/worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || cron_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

-- Note: To schedule cron jobs, run these commands in Supabase SQL editor after enabling pg_cron:
--
-- Schedule nightly inventory sync (2 AM UTC):
-- SELECT cron.schedule(
--   'shopify-inventory-sync',
--   '0 2 * * *',
--   $$SELECT trigger_shopify_sync_worker();$$
-- );
--
-- Schedule weekly metadata refresh (Sunday 3 AM UTC):
-- SELECT cron.schedule(
--   'shopify-metadata-sync',
--   '0 3 * * 0',
--   $$SELECT trigger_shopify_sync_worker();$$
-- );

-- Cleanup function for expired oauth states (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
END;
$$;

-- Schedule cleanup (runs daily at 1 AM UTC):
-- SELECT cron.schedule(
--   'cleanup-oauth-states',
--   '0 1 * * *',
--   $$SELECT cleanup_expired_oauth_states();$$
-- );
