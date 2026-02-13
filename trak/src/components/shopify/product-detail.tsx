"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProductDetails, refreshProduct } from "@/app/actions/shopify-products";
import { createProjectFromProduct } from "@/app/actions/project";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { UnitsSoldWidget } from "./units-sold-widget";

interface ProductDetailProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShopifyProductDetail({ productId, isOpen, onClose }: ProductDetailProps) {
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isCreatingProject, startCreateTransition] = useTransition();

  useEffect(() => {
    if (isOpen && productId) {
      loadProduct();
    }
  }, [isOpen, productId]);

  const loadProduct = async () => {
    setLoading(true);
    const result = await getProductDetails(productId);

    if ("data" in result) {
      setProduct(result.data);
    } else {
      console.error("Error loading product:", result.error);
    }
    setLoading(false);
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
      const workspaceId = await getCurrentWorkspaceId();
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
        router.push(`/dashboard/projects/${result.data.projectId}/tabs/${result.data.tabId}`);
      } else {
        router.push(`/dashboard/projects/${result.data.projectId}`);
      }
    });
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-12 text-center text-gray-500">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl">{product.title}</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Last synced: {new Date(product.last_synced_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleCreateProject}
                disabled={isCreatingProject}
                variant="default"
                size="sm"
              >
                {isCreatingProject ? "Creating..." : "Create project from product"}
              </Button>
              <Button onClick={handleRefresh} disabled={isPending} variant="outline" size="sm">
                {isPending ? "Refreshing..." : "Refresh from Shopify"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Featured Image */}
          {product.featured_image_url && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={product.featured_image_url}
                alt={product.title}
                className="w-full max-h-96 object-contain bg-gray-50"
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
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p>
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
              {product.variants?.map((variant: any) => (
                <div
                  key={variant.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
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
                            <p className="text-sm text-gray-500">SKU: {variant.sku}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {variant.price && (
                          <div>
                            <span className="text-gray-600">Price:</span>
                            <p className="font-medium">${variant.price}</p>
                          </div>
                        )}
                        {variant.compare_at_price && (
                          <div>
                            <span className="text-gray-600">Compare at:</span>
                            <p className="font-medium">${variant.compare_at_price}</p>
                          </div>
                        )}
                        {variant.inventory_tracked && (
                          <div>
                            <span className="text-gray-600">Inventory:</span>
                            <p className="font-medium">{variant.available_total} available</p>
                          </div>
                        )}
                        {variant.barcode && (
                          <div>
                            <span className="text-gray-600">Barcode:</span>
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
                            {variant.inventory.map((inv: any) => (
                              <div key={inv.id} className="text-xs">
                                <span className="text-gray-600">{inv.location_name}:</span>
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
