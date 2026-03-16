"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listShopifyProducts, importShopifyProducts } from "@/app/actions/shopify-products";
import Toast from "@/app/dashboard/projects/toast";

interface ShopifyProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
}

interface PickerProduct {
  id: string;
  title: string;
  status: string;
  productType: string | null;
  variantsCount: number;
  featuredImage: {
    url: string;
  } | null;
}

export function ShopifyProductPicker({
  isOpen,
  onClose,
  connectionId,
}: ShopifyProductPickerProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [, startTransition] = useTransition();

  // Fetch products on mount and when search changes
  const fetchProducts = useCallback(async ({
    reset = false,
    searchTerm,
    afterCursor,
  }: {
    reset?: boolean;
    searchTerm?: string;
    afterCursor?: string | null;
  } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await listShopifyProducts(connectionId, {
        search: searchTerm || undefined,
        limit: 50,
        afterCursor: reset ? undefined : afterCursor || undefined,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setProducts((currentProducts) =>
        reset ? result.data.products : [...currentProducts, ...result.data.products]
      );
      setHasMore(result.data.pageInfo.hasNextPage);
      setEndCursor(result.data.pageInfo.endCursor);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  // Fetch products on mount and when search changes
  useEffect(() => {
    if (isOpen) {
      void fetchProducts({ reset: true, searchTerm: search });
      setToast(null);
    }
  }, [fetchProducts, search, isOpen]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      void fetchProducts({ searchTerm: search, afterCursor: endCursor });
    }
  };

  const handleToggle = (productId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const handleImport = () => {
    if (selected.size === 0) return;

    setImporting(true);
    startTransition(async () => {
      const result = await importShopifyProducts(connectionId, Array.from(selected));
      setImporting(false);

      if ("error" in result) {
        setToast({
          message: `Failed to import products: ${result.error}`,
          type: "error",
        });
      } else {
        const productWord = result.data.imported === 1 ? "product" : "products";
        const message =
          result.data.skipped > 0
            ? `Successfully imported ${result.data.imported} ${productWord} (${result.data.skipped} skipped).`
            : `Successfully imported ${result.data.imported} ${productWord}.`;
        setToast({ message, type: "success" });
        setSelected(new Set());
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="relative flex max-h-[80vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import Products from Shopify</DialogTitle>
        </DialogHeader>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            className="absolute right-6 top-6 z-20"
          />
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="pb-4 border-b">
            <Input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Products List */}
          <div className="flex-1 overflow-y-auto mt-4">
            {loading && products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No products found. Try adjusting your search.
              </div>
            ) : (
              <>
                {/* Select All */}
                <div className="pb-3 mb-3 border-b flex items-center gap-2">
                  <Checkbox
                    checked={selected.size === products.length && products.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-gray-600">
                    Select All ({selected.size} of {products.length} selected)
                  </span>
                </div>

                {/* Product Items */}
                <div className="space-y-2">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleToggle(product.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors text-left"
                    >
                      <Checkbox checked={selected.has(product.id)} />

                      {product.featuredImage && (
                        <img
                          src={product.featuredImage.url}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.title}</div>
                        <div className="text-sm text-gray-500">
                          {product.status} • {product.variantsCount} variants
                        </div>
                        {product.productType && (
                          <div className="text-xs text-gray-400">{product.productType}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="mt-4 text-center">
                    <Button
                      onClick={handleLoadMore}
                      variant="outline"
                      disabled={loading}
                      size="sm"
                    >
                      {loading ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selected.size} product{selected.size !== 1 ? "s" : ""} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={selected.size === 0 || importing}>
                {importing ? "Importing..." : `Import ${selected.size} Products`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
