"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { unimportShopifyProduct } from "@/app/actions/shopify-products";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShopifyProductDetail } from "@/components/shopify/product-detail";

interface Product {
  id: string;
  title: string;
  description: string | null;
  featured_image_url: string | null;
  status: string;
  vendor: string | null;
  product_type: string | null;
  last_synced_at: string;
  shopify_connections: {
    id: string;
    shop_domain: string;
    shop_name: string | null;
  };
  trak_product_variants: Array<{ count: number }>;
}

interface Connection {
  id: string;
  shop_domain: string;
  shop_name: string | null;
}

interface ShopifyProductsClientProps {
  initialProducts: Product[];
  connections: Connection[];
  selectedConnectionId?: string;
}

type UnimportResult = {
  type: "success" | "error";
  message: string;
};

export function ShopifyProductsClient({
  initialProducts,
  connections,
  selectedConnectionId,
}: ShopifyProductsClientProps) {
  const router = useRouter();
  const { setHeaderHidden } = useDashboardHeader();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);

  // Hide dashboard header on this page
  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Filter products by search
  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnectionFilter = (connectionId: string) => {
    if (connectionId === "all") {
      router.push("/dashboard/shopify/products");
    } else {
      router.push(`/dashboard/shopify/products?connection_id=${connectionId}`);
    }
  };

  const handleUnimport = async (
    productId: string,
    productTitle: string
  ): Promise<UnimportResult> => {
    setRemovingProductId(productId);
    const result = await unimportShopifyProduct(productId);
    setRemovingProductId(null);

    if ("error" in result) {
      return {
        message: `Failed to remove product: ${result.error}`,
        type: "error",
      };
    }

    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== productId)
    );
    return {
      message: `"${productTitle}" was removed from the products page.`,
      type: "success",
    };
  };

  return (
    <div className="w-full px-8 pt-12 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Products</h1>
        <p className="text-[var(--muted-foreground)]">View and manage your imported Shopify products</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:max-w-xl"
          />
        </div>

        {connections.length > 1 && (
          <Select
            value={selectedConnectionId || "all"}
            onValueChange={handleConnectionFilter}
          >
            <SelectTrigger className="w-full md:w-64 md:shrink-0">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.shop_name || conn.shop_domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-[var(--tertiary-foreground)] mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-[var(--muted-foreground)] mb-4">
              {search
                ? "No products match your search"
                : "No products imported yet"}
            </p>
            {!search && (
              <Button onClick={() => router.push("/dashboard/shopify/stores")}>
                Connect a store
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => setSelectedProduct(product.id)}
            >
              <CardContent className="flex h-full flex-col p-4">
                {/* Product Image */}
                {product.featured_image_url ? (
                  <img
                    src={product.featured_image_url}
                    alt={product.title}
                    className="w-full h-48 object-cover rounded-[var(--radius-lg)] mb-4"
                  />
                ) : (
                  <div className="w-full h-48 bg-[var(--surface-muted)] rounded-[var(--radius-lg)] mb-4 flex items-center justify-center">
                    <svg
                      className="w-16 h-16 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* Product Info */}
                <div className="flex flex-1 flex-col">
                  <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                    {product.title}
                  </h3>

                  <div className="text-sm text-[var(--tertiary-foreground)] space-y-1">
                    {product.vendor && (
                      <div>
                        <span className="font-medium">Vendor:</span> {product.vendor}
                      </div>
                    )}
                    {product.product_type && (
                      <div>
                        <span className="font-medium">Type:</span> {product.product_type}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Store:</span>{" "}
                      {product.shopify_connections.shop_name ||
                        product.shopify_connections.shop_domain}
                    </div>
                    <div>
                      <span className="font-medium">Variants:</span>{" "}
                      {product.trak_product_variants[0]?.count || 0}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-auto pt-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs ${
                        product.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-[var(--surface-muted)] text-gray-800"
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product Detail Dialog */}
      {selectedProduct && (
        <ShopifyProductDetail
          productId={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUnimport={async () => {
            const product = products.find((item) => item.id === selectedProduct);
            if (!product) {
              return {
                type: "error",
                message: "Product not found.",
              };
            }
            return handleUnimport(product.id, product.title);
          }}
          isUnimporting={removingProductId === selectedProduct}
        />
      )}
    </div>
  );
}
