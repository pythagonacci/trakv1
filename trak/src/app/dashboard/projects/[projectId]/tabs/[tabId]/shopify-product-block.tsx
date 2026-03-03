"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getProductDetails,
  refreshProduct,
  searchWorkspaceProducts,
} from "@/app/actions/shopify-products";
import { UnitsSoldWidget } from "@/components/shopify/units-sold-widget";
import type { Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerResults, setPickerResults] = useState<
    Array<{
      id: string;
      title: string;
      featured_image_url: string | null;
      status: string;
      vendor: string | null;
      product_type: string | null;
      variants_count: number;
    }>
  >([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (productId) {
      void loadProduct();
    } else {
      setProduct(null);
      setError(null);
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
  const loadPickerResults = async (term: string) => {
    setPickerLoading(true);
    setPickerError(null);
    const result = await searchWorkspaceProducts({ search: term, limit: 30 });
    if ("error" in result) {
      setPickerError(result.error);
      setPickerResults([]);
    } else {
      setPickerResults(result.data.products);
    }
    setPickerLoading(false);
  };

  useEffect(() => {
    if (!pickerOpen) return;
    void loadPickerResults(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const debouncedSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (value: string) => {
      setSearch(value);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void loadPickerResults(value);
      }, 300);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAttachProduct = (p: {
    id: string;
    title: string;
  }) => {
    setPickerOpen(false);
    startTransition(async () => {
      const nextContent = {
        ...(block.content ?? {}),
        product_id: p.id,
        title: p.title,
      };
      const result = await updateBlock({
        blockId: block.id,
        content: nextContent,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onUpdate?.(result.data);
    });
  };

  if (!productId) {
    return (
      <>
        <div className="p-5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-between gap-4">
          <div className="text-sm text-[var(--muted-foreground)]">
            No product linked to this block. Select a Shopify product to embed it with live details and sales analytics.
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            Select product
          </Button>
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Shopify product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search products by title..."
                defaultValue={search}
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              {pickerError && (
                <div className="text-sm text-red-500">
                  {pickerError}
                </div>
              )}
              {pickerLoading && (
                <div className="text-sm text-[var(--muted-foreground)]">
                  Loading products...
                </div>
              )}
              {!pickerLoading && pickerResults.length === 0 && (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No products found. Try a different search.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pickerResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAttachProduct(p)}
                    className="text-left rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] transition-colors overflow-hidden"
                  >
                    {p.featured_image_url ? (
                      <img
                        src={p.featured_image_url}
                        alt={p.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-[var(--muted)]/40 flex items-center justify-center text-[var(--border)] text-xs">
                        No image
                      </div>
                    )}
                    <div className="p-3 space-y-1">
                      <div className="font-medium text-sm truncate">{p.title}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                        {p.vendor && (
                          <div>
                            <span className="font-medium">Vendor:</span> {p.vendor}
                          </div>
                        )}
                        {p.product_type && (
                          <div>
                            <span className="font-medium">Type:</span> {p.product_type}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Variants:</span> {p.variants_count}
                        </div>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
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
      <>
        <div className="p-5 rounded-lg border border-dashed border-red-200 bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-4">
          <span>{error || "Product not found"}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            Select different product
          </Button>
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Shopify product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search products by title..."
                defaultValue={search}
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              {pickerError && (
                <div className="text-sm text-red-500">
                  {pickerError}
                </div>
              )}
              {pickerLoading && (
                <div className="text-sm text-[var(--muted-foreground)]">
                  Loading products...
                </div>
              )}
              {!pickerLoading && pickerResults.length === 0 && (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No products found. Try a different search.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pickerResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAttachProduct(p)}
                    className="text-left rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] transition-colors overflow-hidden"
                  >
                    {p.featured_image_url ? (
                      <img
                        src={p.featured_image_url}
                        alt={p.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-[var(--muted)]/40 flex items-center justify-center text-[var(--border)] text-xs">
                        No image
                      </div>
                    )}
                    <div className="p-3 space-y-1">
                      <div className="font-medium text-sm truncate">{p.title}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                        {p.vendor && (
                          <div>
                            <span className="font-medium">Vendor:</span> {p.vendor}
                          </div>
                        )}
                        {p.product_type && (
                          <div>
                            <span className="font-medium">Type:</span> {p.product_type}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Variants:</span> {p.variants_count}
                        </div>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {!productId ? (
        <div className="p-5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-between gap-4">
          <div className="text-sm text-[var(--muted-foreground)]">
            No product linked to this block. Select a Shopify product to embed it with live details and sales analytics.
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            Select product
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compact header widget (mirrors Shopify products grid) */}
          <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
            {product.featured_image_url ? (
              <div className="md:w-40 flex-shrink-0">
                <img
                  src={product.featured_image_url}
                  alt={product.title}
                  className="w-full h-32 md:h-full object-cover rounded-lg bg-[var(--muted)]/40"
                />
              </div>
            ) : (
              <div className="md:w-40 h-32 md:h-full flex-shrink-0 rounded-lg bg-[var(--muted)]/40 flex items-center justify-center text-[var(--border)] text-xs">
                No image
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-semibold truncate">
                    {product.title}
                  </h3>
                  <p className="text-xs md:text-sm text-[var(--muted-foreground)] mt-0.5">
                    Last synced: {new Date(product.last_synced_at).toLocaleString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
                    {product.vendor && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--muted)]/40">
                        <span className="font-medium">Vendor</span>
                        <span>• {product.vendor}</span>
                      </span>
                    )}
                    {product.product_type && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--muted)]/40">
                        <span className="font-medium">Type</span>
                        <span>• {product.product_type}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--muted)]/40">
                      <span className="font-medium">Status</span>
                      <span>• {product.status}</span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    onClick={handleRefresh}
                    disabled={isPending}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {isPending ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
                    onClick={() => setPickerOpen(true)}
                  >
                    Change product
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? "Collapse details" : "Expand details"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {expanded && (
            <>
              {/* Image + key info side by side to reduce height */}
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {product.featured_image_url && (
                  <div className="md:w-56 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--muted)]/30">
                    <img
                      src={product.featured_image_url}
                      alt={product.title}
                      className="w-full h-40 md:h-48 object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                    <p className="text-[var(--foreground)] font-mono text-xs">
                      {product.shopify_product_id}
                    </p>
                  </div>
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
                <h4 className="font-semibold mb-4">
                  Variants ({product.variants?.length || 0})
                </h4>
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
                                <p className="text-sm text-[var(--muted-foreground)]">
                                  SKU: {variant.sku}
                                </p>
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
                                <p className="font-medium">
                                  {variant.available_total} available
                                </p>
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
                                    <span className="text-[var(--muted-foreground)]">
                                      {inv.location_name}:
                                    </span>
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
            </>
          )}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Shopify product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search products by title..."
              defaultValue={search}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
            {pickerError && (
              <div className="text-sm text-red-500">
                {pickerError}
              </div>
            )}
            {pickerLoading && (
              <div className="text-sm text-[var(--muted-foreground)]">
                Loading products...
              </div>
            )}
            {!pickerLoading && pickerResults.length === 0 && (
              <div className="text-sm text-[var(--muted-foreground)]">
                No products found. Try a different search.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pickerResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAttachProduct(p)}
                  className="text-left rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] transition-colors overflow-hidden"
                >
                  {p.featured_image_url ? (
                    <img
                      src={p.featured_image_url}
                      alt={p.title}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-[var(--muted)]/40 flex items-center justify-center text-[var(--border)] text-xs">
                      No image
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                      {p.vendor && (
                        <div>
                          <span className="font-medium">Vendor:</span> {p.vendor}
                        </div>
                      )}
                      {p.product_type && (
                        <div>
                          <span className="font-medium">Type:</span> {p.product_type}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Variants:</span> {p.variants_count}
                      </div>
                    </div>
                    <div className="mt-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                          p.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
