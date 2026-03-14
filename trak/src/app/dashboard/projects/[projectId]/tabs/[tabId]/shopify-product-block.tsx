"use client";

import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import {
  getProductDetails,
  refreshProduct,
  searchWorkspaceProducts,
  type ProductWithVariants,
} from "@/app/actions/shopify-products";
import type { Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { UnitsSoldWidget } from "@/components/shopify/units-sold-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ShopifyProductBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
}

type PickerResult = {
  id: string;
  title: string;
  featured_image_url: string | null;
  status: string;
  vendor: string | null;
  product_type: string | null;
  variants_count: number;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString();
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatValueRange(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => typeof value === "number");
  if (numericValues.length === 0) return "—";

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

function getBadgeVariant(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "success" as const;
    case "draft":
      return "secondary" as const;
    case "archived":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = "No image",
}: {
  src: string | null;
  alt: string;
  className: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[var(--muted)]/40 text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]",
          className,
          fallbackClassName,
        )}
      >
        {fallbackLabel}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
    />
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]/80">
        {label}
      </span>
      <span>•</span>
      <span className="text-[12px] text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function DetailStack({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className={cn("text-[13px] text-[var(--foreground)]", mono && "font-mono text-[12px]")}>
        {value}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1 md:border-l md:border-[var(--border)] md:pl-4 md:first:border-l-0 md:first:pl-0">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className={cn("mt-1 text-[13px] font-medium text-[var(--foreground)]", muted && "font-normal text-[var(--muted-foreground)]")}>
        {value}
      </div>
    </div>
  );
}

function PickerDialog({
  open,
  onOpenChange,
  search,
  onSearchChange,
  pickerError,
  pickerLoading,
  pickerResults,
  onSelectProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  pickerError: string | null;
  pickerLoading: boolean;
  pickerResults: PickerResult[];
  onSelectProduct: (product: { id: string; title: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Shopify product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search products by title..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {pickerError && (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pickerResults.map((pickerProduct) => (
              <button
                key={pickerProduct.id}
                type="button"
                onClick={() => onSelectProduct(pickerProduct)}
                className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-left transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]"
              >
                <ProductImage
                  src={pickerProduct.featured_image_url}
                  alt={pickerProduct.title}
                  className="h-32 w-full object-cover"
                />
                <div className="space-y-2 px-3 py-3">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">
                    {pickerProduct.title}
                  </div>
                  <div className="space-y-1 text-[11px] text-[var(--muted-foreground)]">
                    {pickerProduct.vendor && <div>Vendor: {pickerProduct.vendor}</div>}
                    {pickerProduct.product_type && <div>Type: {pickerProduct.product_type}</div>}
                    <div>Variants: {pickerProduct.variants_count}</div>
                  </div>
                  <Badge variant={getBadgeVariant(pickerProduct.status)} className="px-2 py-0 text-[10px] font-medium capitalize">
                    {pickerProduct.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ShopifyProductBlock({ block, onUpdate }: ShopifyProductBlockProps) {
  const content = (block.content || {}) as Block["content"];
  const productId = block.content?.product_id as string | undefined;
  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerResults, setPickerResults] = useState<PickerResult[]>([]);
  const [expanded, setExpanded] = useState<boolean>(() => {
    const initial = (block.content || {}) as Block["content"];
    return initial.shopifyExpanded === true;
  });
  const isLocked = Boolean(block.locked);
  const initialHeightPx =
    typeof content.heightPx === "number" && content.heightPx > 0 ? content.heightPx : null;
  const [contentHeightPx, setContentHeightPx] = useState<number | null>(initialHeightPx);
  const contentHeightRef = useRef<number | null>(initialHeightPx);

  const variantCount = product?.variants?.length ?? 0;
  const totalInventory = product?.variants.reduce((sum, variant) => {
    if (!variant.inventory_tracked) return sum;
    return sum + Math.max(variant.available_total, 0);
  }, 0) ?? 0;
  const priceLabel = product ? formatValueRange(product.variants.map((variant) => variant.price)) : "—";
  const compareAtLabel = product
    ? formatValueRange(product.variants.map((variant) => variant.compare_at_price))
    : "—";

  const loadProduct = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    const result = await getProductDetails(productId);
    if ("data" in result) {
      setProduct(result.data);
    } else {
      setProduct(null);
      setError(result.error || "Failed to load product");
    }

    setLoading(false);
  }, [productId]);

  useEffect(() => {
    if (productId) {
      void loadProduct();
    } else {
      setProduct(null);
      setError(null);
      setLoading(false);
    }
  }, [loadProduct, productId]);

  useEffect(() => {
    const nextHeight =
      typeof content.heightPx === "number" && content.heightPx > 0 ? content.heightPx : null;
    setContentHeightPx(nextHeight);
    contentHeightRef.current = nextHeight;
  }, [content.heightPx]);

  const handleRefresh = () => {
    if (!productId) return;

    startTransition(async () => {
      const result = await refreshProduct(productId);
      if ("error" in result) {
        setError(result.error ?? "Failed to refresh product");
      } else {
        await loadProduct();
        onUpdate?.();
      }
    });
  };

  const loadPickerResults = useCallback(async (term: string) => {
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
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    void loadPickerResults(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ blockId: string }>) => {
      if (e.detail?.blockId === block.id) {
        setPickerOpen(true);
      }
    };

    window.addEventListener("shopify-product-block-open-picker", handler as EventListener);
    return () => window.removeEventListener("shopify-product-block-open-picker", handler as EventListener);
  }, [block.id]);

  const debouncedSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (value: string) => {
      setSearch(value);
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(() => {
        void loadPickerResults(value);
      }, 300);
    };
  }, [loadPickerResults]);

  const handleAttachProduct = (selectedProduct: { id: string; title: string }) => {
    setPickerOpen(false);

    startTransition(async () => {
      const nextContent = {
        ...(block.content ?? {}),
        product_id: selectedProduct.id,
        title: selectedProduct.title,
      };
      const result = await updateBlock({
        blockId: block.id,
        content: nextContent,
      });

      if ("error" in result) {
        setError(result.error ?? "Failed to attach product");
        return;
      }

      setError(null);
      onUpdate?.(result.data);
    });
  };

  const handleResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isLocked) return;

    e.preventDefault();
    e.stopPropagation();

    const MIN_HEIGHT = 240;
    const MAX_HEIGHT = 1600;
    const startHeight =
      (contentHeightRef.current && contentHeightRef.current > 0 ? contentHeightRef.current : 520) ?? 520;
    const state = { startY: e.clientY, startHeight };

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - state.startY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, state.startHeight + delta));
      setContentHeightPx(next);
      contentHeightRef.current = next;
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const finalHeight = contentHeightRef.current ?? state.startHeight;
      const clamped = Math.round(
        Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, finalHeight),
        ),
      );

      setContentHeightPx(clamped);
      contentHeightRef.current = clamped;

      if (!block.id.startsWith("temp-")) {
        const result = await updateBlock({
          blockId: block.id,
          content: {
            ...content,
            heightPx: clamped,
          },
        });

        if ("data" in result && result.data) {
          onUpdate?.(result.data);
        } else if ("error" in result && result.error) {
          console.error("Failed to update Shopify product block height:", result.error);
        } else {
          onUpdate?.();
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const nextContent = (block.content || {}) as Block["content"];
    if (typeof nextContent.shopifyExpanded === "boolean") {
      setExpanded(nextContent.shopifyExpanded);
    }
  }, [block.content]);

  const handleToggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;

      if (!block.id.startsWith("temp-")) {
        void (async () => {
          const result = await updateBlock({
            blockId: block.id,
            content: {
              ...content,
              shopifyExpanded: next,
            },
          });

          if ("data" in result && result.data) {
            onUpdate?.(result.data);
          } else if ("error" in result && result.error) {
            console.error("Failed to update Shopify product block expanded state:", result.error);
            onUpdate?.();
          } else {
            onUpdate?.();
          }
        })();
      }

      return next;
    });
  };

  const pickerDialog = (
    <PickerDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      search={search}
      onSearchChange={debouncedSearch}
      pickerError={pickerError}
      pickerLoading={pickerLoading}
      pickerResults={pickerResults}
      onSelectProduct={handleAttachProduct}
    />
  );

  if (!productId) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3">
          <div className="text-sm text-[var(--muted-foreground)]">
            No product linked to this block. Select a Shopify product to embed it with live details and sales analytics.
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)} className="h-8 rounded-[8px] px-3">
            Select product
          </Button>
        </div>
        {pickerDialog}
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--foreground)]" />
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error || "Product not found"}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="h-8 rounded-[8px] border-red-300 px-3 text-red-700 hover:bg-red-100"
          >
            Select different product
          </Button>
        </div>
        {pickerDialog}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div
          className="space-y-3"
          style={
            contentHeightPx && expanded
              ? {
                  height: `${contentHeightPx}px`,
                  overflowY: "auto",
                }
              : undefined
          }
        >
          {!expanded ? (
            <div className="flex flex-col gap-4 px-4 py-3 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--muted)]/20">
                  <ProductImage
                    src={product.featured_image_url}
                    alt={product.title}
                    className="h-20 w-14 object-cover"
                  />
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-semibold text-[var(--foreground)]">
                      {product.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                      Last synced: {formatDateTime(product.last_synced_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <MetaItem label="Vendor" value={product.vendor} />
                    <MetaItem label="Type" value={product.product_type} />
                    <MetaItem label="Status" value={product.status} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:pl-4">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  title={isPending ? "Refreshing..." : "Refresh from Shopify"}
                >
                  <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleExpanded}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  title="Expand details"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[20px] font-semibold text-[var(--foreground)]">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                        Last synced: {formatDateTime(product.last_synced_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={getBadgeVariant(product.status)} className="rounded-full px-2 py-0 text-[10px] font-medium capitalize">
                        {product.status}
                      </Badge>
                      {product.product_type && (
                        <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-medium">
                          {product.product_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                      title={isPending ? "Refreshing..." : "Refresh from Shopify"}
                    >
                      <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleExpanded}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      title="Collapse details"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 border-t border-[var(--border)] px-4 pt-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--muted)]/20">
                  <ProductImage
                    src={product.featured_image_url}
                    alt={product.title}
                    className="h-[220px] w-full object-contain"
                  />
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {product.vendor && <DetailStack label="Vendor" value={product.vendor} />}
                    {product.product_type && <DetailStack label="Type" value={product.product_type} />}
                    <DetailStack label="Status" value={product.status} />
                    <DetailStack label="Source" value="Shopify" />
                    <DetailStack label="Variants" value={`${variantCount}`} />
                    <DetailStack label="Shopify ID" value={product.shopify_product_id} mono />
                  </div>
                </div>
              </div>

              {(product.description || product.tags.length > 0) && (
                <div className="border-t border-[var(--border)] px-4 pt-4">
                  <div className="space-y-4">
                    {product.description && (
                      <div className="space-y-2">
                        <div className="text-[13px] font-semibold text-[var(--foreground)]">
                          Description
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--muted-foreground)]">
                          {product.description}
                        </p>
                      </div>
                    )}
                    {product.tags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[13px] font-semibold text-[var(--foreground)]">
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--foreground)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-[var(--border)] px-4 pt-4">
                <h4 className="text-[13px] font-semibold text-[var(--foreground)]">
                  Commerce details
                </h4>
                <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <StatCell label="Price" value={priceLabel} />
                  <StatCell label="Compare at" value={compareAtLabel} muted={compareAtLabel === "—"} />
                  <StatCell
                    label="Inventory"
                    value={variantCount > 0 ? `${totalInventory} available` : "—"}
                    muted={variantCount === 0}
                  />
                  <StatCell label="Variants" value={`${variantCount}`} />
                  <StatCell label="Source" value="Shopify" muted />
                </div>
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <div className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">
                    Units sold
                  </div>
                  <UnitsSoldWidget productId={productId} />
                </div>
              </div>

              <div className="border-t border-[var(--border)] px-4 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-[13px] font-semibold text-[var(--foreground)]">
                    Variants
                  </h4>
                  <div className="text-[12px] text-[var(--muted-foreground)]">
                    {variantCount} total
                  </div>
                </div>
                <div className="space-y-2">
                  {product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--muted)]/20">
                              <ProductImage
                                src={variant.image_url}
                                alt={variant.title}
                                className="h-12 w-12 object-cover"
                                fallbackClassName="h-12 w-12"
                              />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                                {variant.title}
                              </div>
                              {variant.sku && (
                                <div className="text-[12px] text-[var(--muted-foreground)]">
                                  SKU: {variant.sku}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <DetailStack label="Price" value={formatCurrency(variant.price)} />
                            <DetailStack label="Compare at" value={formatCurrency(variant.compare_at_price)} />
                            <DetailStack
                              label="Inventory"
                              value={variant.inventory_tracked ? `${variant.available_total} available` : "Not tracked"}
                            />
                            {variant.barcode && <DetailStack label="Barcode" value={variant.barcode} mono />}
                          </div>
                        </div>
                      </div>
                      {variant.inventory.length > 0 && (
                        <div className="mt-3 border-t border-[var(--border)] pt-3">
                          <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                            Inventory by location
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {variant.inventory.map((inventoryItem) => (
                              <div
                                key={inventoryItem.id}
                                className="flex items-center justify-between rounded-[8px] bg-[var(--muted)]/20 px-3 py-2 text-[12px]"
                              >
                                <span className="truncate text-[var(--muted-foreground)]">
                                  {inventoryItem.location_name}
                                </span>
                                <span className="font-medium text-[var(--foreground)]">
                                  {inventoryItem.available}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {!isLocked && (
          <div
            className="mt-1 flex cursor-row-resize justify-end select-none"
            onMouseDown={handleResizeMouseDown}
          >
            <div className="h-1 w-10 rounded-full bg-[var(--border)] hover:bg-[var(--foreground)]" />
          </div>
        )}
      </div>

      {pickerDialog}
    </>
  );
}
