"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Toast from "@/app/dashboard/projects/toast";
import {
  getProductDetails,
  refreshProduct,
  type ProductWithVariants,
} from "@/app/actions/shopify-products";
import { createProjectFromProduct } from "@/app/actions/project";
import { UnitsSoldWidget } from "./units-sold-widget";
import { buildProjectPath, buildProjectTabPath } from "@/lib/dashboard-routes";

interface ProductDetailProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
  onUnimport?: () => Promise<{ type: "success" | "error"; message: string }>;
  isUnimporting?: boolean;
}

export function ShopifyProductDetail({
  productId,
  isOpen,
  onClose,
  onUnimport,
  isUnimporting = false,
}: ProductDetailProps) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isCreatingProject, startCreateTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    const result = await getProductDetails(productId);

    if ("data" in result) {
      setProduct(result.data);
    } else {
      console.error("Error loading product:", result.error);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    if (isOpen && productId) {
      const timer = window.setTimeout(() => {
        void loadProduct();
        setToast(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, productId, loadProduct]);

  const handleUnimportClick = () => {
    if (!onUnimport) return;

    void (async () => {
      const result = await onUnimport();
      setToast(result);
      if (result.type === "success") {
        window.setTimeout(() => {
          onClose();
        }, 900);
      }
    })();
  };

  const handleRefresh = () => {
    startTransition(async () => {
      const result = await refreshProduct(productId);

      if ("error" in result) {
        alert(`Failed to refresh: ${result.error}`);
      } else {
        await loadProduct();
        alert("Product refreshed successfully!");
      }
    });
  };

  const handleCreateProject = () => {
    startCreateTransition(async () => {
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log("[PERF] client getCurrentWorkspaceId via route (shopify)");
      const response = await fetch("/api/workspaces/current", { cache: "no-store" });
      const json = await response.json();
      const workspaceId = json?.data?.workspaceId || null;
      if (!workspaceId) {
        alert("No workspace selected");
        return;
      }
      const result = await createProjectFromProduct(workspaceId, productId);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      onClose();
      if (result.data.tabId) {
        router.push(
          buildProjectTabPath(
            result.data.projectId,
            result.data.tabId,
            result.data.projectName,
            result.data.tabName
          )
        );
      } else {
        router.push(buildProjectPath(result.data.projectId, result.data.projectName));
      }
    });
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Loading product</DialogTitle>
          <div className="p-12 text-center text-[var(--tertiary-foreground)]">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="relative max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:top-6">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            className="absolute right-6 top-6 z-20"
          />
        )}
        <DialogHeader className="pr-10 sm:pr-12">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl">{product.title}</DialogTitle>
              <p className="text-sm text-[var(--tertiary-foreground)] mt-1">
                Last synced: {new Date(product.last_synced_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {onUnimport && (
                <Button
                  onClick={handleUnimportClick}
                  disabled={isUnimporting}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isUnimporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Unimport</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={handleCreateProject}
                disabled={isCreatingProject}
                variant="default"
                size="sm"
                className="h-8 px-2 text-[11px]"
              >
                {isCreatingProject ? "Creating..." : "Create project from product"}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isPending}
                variant="outline"
                size="sm"
                className="h-8 px-2 text-[11px]"
              >
                {isPending ? "Refreshing..." : "Refresh from Shopify"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Featured Image */}
          {product.featured_image_url && (
            <div className="rounded-[var(--radius-lg)] overflow-hidden">
              <img
                src={product.featured_image_url}
                alt={product.title}
                className="w-full max-h-96 object-contain bg-[var(--background)]"
              />
            </div>
          )}

          {/* Product Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {product.vendor && (
              <div>
                <span className="font-medium text-gray-700">Vendor:</span>
                <p className="text-gray-900">{product.vendor}</p>
              </div>
            )}
            {product.product_type && (
              <div>
                <span className="font-medium text-gray-700">Type:</span>
                <p className="text-gray-900">{product.product_type}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <p className="text-gray-900">{product.status}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Shopify ID:</span>
              <p className="text-gray-900 font-mono text-xs">{product.shopify_product_id}</p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Units Sold Widget */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Sales Analytics</h3>
            <UnitsSoldWidget productId={productId} />
          </div>

          {/* Variants */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">
              Variants ({product.variants?.length || 0})
            </h3>
            <div className="space-y-3">
              {product.variants?.map((variant) => (
                <div
                  key={variant.id}
                  className="border rounded-[var(--radius-lg)] p-4 hover:bg-[var(--background)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {variant.image_url && (
                          <img
                            src={variant.image_url}
                            alt={variant.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <h4 className="font-medium">{variant.title}</h4>
                          {variant.sku && (
                            <p className="text-sm text-[var(--tertiary-foreground)]">SKU: {variant.sku}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {variant.price && (
                          <div>
                            <span className="text-[var(--muted-foreground)]">Price:</span>
                            <p className="font-medium">${variant.price}</p>
                          </div>
                        )}
                        {variant.compare_at_price && (
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

                      {/* Inventory by Location */}
                      {variant.inventory && variant.inventory.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Inventory by Location:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {variant.inventory.map((inv) => (
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
      </DialogContent>
    </Dialog>
  );
}
