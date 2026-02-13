"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getProductDetails, refreshProduct } from "@/app/actions/shopify-products";
import { UnitsSoldWidget } from "@/components/shopify/units-sold-widget";
import type { Block } from "@/app/actions/block";

interface ShopifyProductBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
}

export default function ShopifyProductBlock({ block, onUpdate }: ShopifyProductBlockProps) {
  const productId = block.content?.product_id as string | undefined;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (productId) {
      loadProduct();
    } else {
      setError("No product linked");
      setLoading(false);
    }
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    const result = await getProductDetails(productId);
    if ("data" in result) {
      setProduct(result.data);
    } else {
      setError(result.error || "Failed to load product");
    }
    setLoading(false);
  };

  const handleRefresh = () => {
    if (!productId) return;
    startTransition(async () => {
      const result = await refreshProduct(productId);
      if ("error" in result) {
        setError(result.error);
      } else {
        await loadProduct();
        onUpdate?.();
      }
    });
  };

  if (!productId) {
    return (
      <div className="p-5 rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
        No product linked to this block.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <div className="h-4 w-4 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-5 rounded-lg border border-dashed border-red-200 bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
        {error || "Product not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold truncate">{product.title}</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Last synced: {new Date(product.last_synced_at).toLocaleString()}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isPending}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {isPending ? "Refreshing..." : "Refresh from Shopify"}
        </Button>
      </div>

      {/* Featured Image */}
      {product.featured_image_url && (
        <div className="rounded-lg overflow-hidden bg-[var(--muted)]/30">
          <img
            src={product.featured_image_url}
            alt={product.title}
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}

      {/* Product Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {product.vendor && (
          <div>
            <span className="font-medium text-[var(--muted-foreground)]">Vendor:</span>
            <p className="text-[var(--foreground)]">{product.vendor}</p>
          </div>
        )}
        {product.product_type && (
          <div>
            <span className="font-medium text-[var(--muted-foreground)]">Type:</span>
            <p className="text-[var(--foreground)]">{product.product_type}</p>
          </div>
        )}
        <div>
          <span className="font-medium text-[var(--muted-foreground)]">Status:</span>
          <p className="text-[var(--foreground)]">{product.status}</p>
        </div>
        <div>
          <span className="font-medium text-[var(--muted-foreground)]">Shopify ID:</span>
          <p className="text-[var(--foreground)] font-mono text-xs">{product.shopify_product_id}</p>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div>
          <h4 className="font-semibold mb-2">Description</h4>
          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
            {product.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Units Sold Widget */}
      <div className="border-t border-[var(--border)] pt-6">
        <h4 className="font-semibold mb-4">Sales Analytics</h4>
        <UnitsSoldWidget productId={productId} />
      </div>

      {/* Variants */}
      <div className="border-t border-[var(--border)] pt-6">
        <h4 className="font-semibold mb-4">Variants ({product.variants?.length || 0})</h4>
        <div className="space-y-3">
          {product.variants?.map((variant: any) => (
            <div
              key={variant.id}
              className="border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--muted)]/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {variant.image_url && (
                      <img
                        src={variant.image_url}
                        alt={variant.title}
                        className="w-12 h-12 object-cover rounded shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <h5 className="font-medium truncate">{variant.title}</h5>
                      {variant.sku && (
                        <p className="text-sm text-[var(--muted-foreground)]">SKU: {variant.sku}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {variant.price != null && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Price:</span>
                        <p className="font-medium">${variant.price}</p>
                      </div>
                    )}
                    {variant.compare_at_price != null && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Compare at:</span>
                        <p className="font-medium">${variant.compare_at_price}</p>
                      </div>
                    )}
                    {variant.inventory_tracked && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Inventory:</span>
                        <p className="font-medium">{variant.available_total} available</p>
                      </div>
                    )}
                    {variant.barcode && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Barcode:</span>
                        <p className="font-mono text-xs">{variant.barcode}</p>
                      </div>
                    )}
                  </div>
                  {variant.inventory && variant.inventory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                        Inventory by Location:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {variant.inventory.map((inv: any) => (
                          <div key={inv.id} className="text-xs">
                            <span className="text-[var(--muted-foreground)]">{inv.location_name}:</span>
                            <span className="ml-2 font-medium">{inv.available}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
