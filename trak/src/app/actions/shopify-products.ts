"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { createShopifyClient } from "@/lib/shopify/client";
import { decryptToken } from "@/lib/shopify/encryption";

type ActionResult<T> = { data: T } | { error: string };

export type ShopifyProduct = {
  id: string;
  title: string;
  description: string | null;
  product_type: string | null;
  vendor: string | null;
  tags: string[];
  featured_image_url: string | null;
  status: string;
  shopify_product_id: string;
  shopify_created_at: string | null;
  shopify_updated_at: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
  variants_count?: number;
};

export type ShopifyProductVariant = {
  id: string;
  product_id: string;
  shopify_variant_id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compare_at_price: number | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  inventory_item_id: string | null;
  image_url: string | null;
  available_for_sale: boolean;
  inventory_tracked: boolean;
  available_total: number;
  created_at: string;
  updated_at: string;
};

export type ProductInventory = {
  id: string;
  variant_id: string;
  location_id: string;
  location_name: string;
  available: number;
  last_synced_at: string;
};

export type ProductWithVariants = ShopifyProduct & {
  variants: (ShopifyProductVariant & {
    inventory: ProductInventory[];
  })[];
};

/**
 * Lists Shopify products from live Shopify API (for import picker)
 */
export async function listShopifyProducts(
  connectionId: string,
  options: { search?: string; limit?: number; afterCursor?: string } = {}
): Promise<
  ActionResult<{
    products: any[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }>
> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const { search, limit = 50, afterCursor } = options;

    // Create Supabase client
    const supabase = await createClient();

    // Get connection (RLS handles workspace membership)
    const { data: connection, error: connectionError } = await supabase
      .from("shopify_connections")
      .select("shop_domain, access_token_encrypted, encryption_key_id")
      .eq("id", connectionId)
      .eq("sync_status", "active")
      .single();

    if (connectionError || !connection) {
      return { error: "Connection not found or inactive" };
    }

    // Decrypt token
    const accessToken = await decryptToken(
      connection.access_token_encrypted,
      connection.encryption_key_id
    );

    // Create Shopify GraphQL client
    const client = await createShopifyClient(connection.shop_domain, accessToken);

    // Build query filter
    let queryFilter = "";
    if (search && search.trim()) {
      queryFilter = `title:*${search.trim()}*`;
    }

    // GraphQL query
    const query = `
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
              featuredImage {
                url
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
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

    const variables = {
      first: limit,
      after: afterCursor || null,
      query: queryFilter || null,
    };

    const result = await client.query<any>(query, variables);

    // Transform response
    const products = result.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      description: edge.node.description,
      productType: edge.node.productType,
      vendor: edge.node.vendor,
      tags: edge.node.tags,
      status: edge.node.status,
      createdAt: edge.node.createdAt,
      updatedAt: edge.node.updatedAt,
      featuredImage: edge.node.featuredImage,
      variantsCount: edge.node.variants.edges.length,
      variants: edge.node.variants.edges.map((v: any) => v.node),
    }));

    return {
      data: {
        products,
        pageInfo: result.products.pageInfo,
      },
    };
  } catch (error) {
    console.error("Error in listShopifyProducts:", error);
    return { error: "Failed to fetch products from Shopify" };
  }
}

/**
 * Imports Shopify products into Trak database
 */
export async function importShopifyProducts(
  connectionId: string,
  productIds: string[] // Shopify GIDs
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Get connection (RLS handles workspace membership)
    const { data: connection, error: connectionError } = await supabase
      .from("shopify_connections")
      .select("id, workspace_id, shop_domain, access_token_encrypted, encryption_key_id")
      .eq("id", connectionId)
      .eq("sync_status", "active")
      .single();

    if (connectionError || !connection) {
      return { error: "Connection not found or inactive" };
    }

    // Decrypt token
    const accessToken = await decryptToken(
      connection.access_token_encrypted,
      connection.encryption_key_id
    );

    // Create Shopify GraphQL client
    const client = await createShopifyClient(connection.shop_domain, accessToken);

    let imported = 0;
    let skipped = 0;

    // Process each product
    for (const productId of productIds) {
      try {
        // Fetch full product data
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
        `;

        const productResult = await client.query<any>(productQuery, { id: productId });
        const product = productResult.product;

        if (!product) {
          skipped++;
          continue;
        }

        // Upsert product
        const { data: trakProduct, error: productError } = await supabase
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

        if (productError || !trakProduct) {
          console.error("Error upserting product:", productError);
          skipped++;
          continue;
        }

        // Process variants
        for (const variantEdge of product.variants.edges) {
          const variant = variantEdge.node;

          // Parse selected options
          const options = variant.selectedOptions.reduce(
            (acc: any, opt: any, idx: number) => {
              const num = idx + 1;
              acc[`option${num}_name`] = opt.name;
              acc[`option${num}_value`] = opt.value;
              return acc;
            },
            {}
          );

          // Upsert variant
          const { data: trakVariant, error: variantError } = await supabase
            .from("trak_product_variants")
            .upsert(
              {
                product_id: trakProduct.id,
                shopify_variant_id: variant.id,
                title: variant.title,
                sku: variant.sku,
                barcode: variant.barcode,
                price: variant.price ? parseFloat(variant.price) : null,
                compare_at_price: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
                ...options,
                inventory_item_id: variant.inventoryItem?.id,
                image_url: variant.image?.url,
                available_for_sale: variant.availableForSale,
                inventory_tracked: !!variant.inventoryItem,
              },
              {
                onConflict: "product_id,shopify_variant_id",
              }
            )
            .select("id")
            .single();

          if (variantError || !trakVariant) {
            console.error("Error upserting variant:", variantError);
            continue;
          }

          // Fetch inventory levels if inventory is tracked
          if (variant.inventoryItem?.id) {
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

            const inventoryResult = await client.query<any>(inventoryQuery, {
              inventoryItemId: variant.inventoryItem.id,
            });

            let totalAvailable = 0;

            // Upsert inventory levels
            for (const invEdge of inventoryResult.inventoryItem.inventoryLevels.edges) {
              const inv = invEdge.node;
              totalAvailable += inv.available || 0;

              await supabase.from("trak_product_inventory").upsert(
                {
                  variant_id: trakVariant.id,
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
              .eq("id", trakVariant.id);
          }
        }

        imported++;
      } catch (error) {
        console.error("Error importing product:", error);
        skipped++;
      }
    }

    // Revalidate integrations page
    revalidatePath("/dashboard/settings/integrations");

    return { data: { imported, skipped } };
  } catch (error) {
    console.error("Error in importShopifyProducts:", error);
    return { error: "Failed to import products" };
  }
}

/**
 * Gets imported products from Trak database
 */
export async function getTrakProducts(
  connectionId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
): Promise<ActionResult<{ products: ShopifyProduct[]; total: number }>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const { search, limit = 50, offset = 0 } = options;

    // Create Supabase client (RLS handles workspace membership)
    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("trak_products")
      .select("*, trak_product_variants(count)", { count: "exact" })
      .eq("connection_id", connectionId);

    // Add search if provided
    if (search && search.trim()) {
      query = query.ilike("title", `%${search.trim()}%`);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1).order("created_at", { ascending: false });

    const { data: products, error: productsError, count } = await query;

    if (productsError) {
      console.error("Error fetching Trak products:", productsError);
      return { error: "Failed to fetch products" };
    }

    return {
      data: {
        products: products || [],
        total: count || 0,
      },
    };
  } catch (error) {
    console.error("Error in getTrakProducts:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Gets product details with variants and inventory
 */
export async function getProductDetails(
  trakProductId: string
): Promise<ActionResult<ProductWithVariants>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client (RLS handles workspace membership)
    const supabase = await createClient();

    // Fetch product with variants and inventory
    const { data: product, error: productError } = await supabase
      .from("trak_products")
      .select(
        `
        *,
        trak_product_variants (
          *,
          trak_product_inventory (*)
        )
      `
      )
      .eq("id", trakProductId)
      .single();

    if (productError || !product) {
      return { error: "Product not found" };
    }

    // Transform data
    const result: ProductWithVariants = {
      ...product,
      variants: product.trak_product_variants.map((v: any) => ({
        ...v,
        inventory: v.trak_product_inventory,
      })),
    };

    return { data: result };
  } catch (error) {
    console.error("Error in getProductDetails:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Refreshes a product from Shopify
 */
export async function refreshProduct(
  trakProductId: string
): Promise<ActionResult<void>> {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Get product with connection info
    const { data: product, error: productError } = await supabase
      .from("trak_products")
      .select(
        `
        *,
        shopify_connections!inner (
          shop_domain,
          access_token_encrypted,
          encryption_key_id,
          sync_status
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

    // Decrypt token
    const accessToken = await decryptToken(
      connection.access_token_encrypted,
      connection.encryption_key_id
    );

    // Create Shopify GraphQL client
    const client = await createShopifyClient(connection.shop_domain, accessToken);

    // Fetch updated product data
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
    `;

    const productResult = await client.query<any>(productQuery, {
      id: product.shopify_product_id,
    });

    const updatedProduct = productResult.product;

    if (!updatedProduct) {
      return { error: "Product not found in Shopify" };
    }

    // Update product
    await supabase
      .from("trak_products")
      .update({
        title: updatedProduct.title,
        description: updatedProduct.description,
        product_type: updatedProduct.productType,
        vendor: updatedProduct.vendor,
        tags: updatedProduct.tags || [],
        featured_image_url: updatedProduct.featuredImage?.url,
        status: updatedProduct.status,
        shopify_updated_at: updatedProduct.updatedAt,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", trakProductId);

    // Invalidate sales cache
    await supabase.from("trak_product_sales_cache").delete().eq("product_id", trakProductId);

    return { data: undefined };
  } catch (error) {
    console.error("Error in refreshProduct:", error);
    return { error: "Failed to refresh product" };
  }
}
