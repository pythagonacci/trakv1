"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductsTabBar() {
  const pathname = usePathname();
  const isProducts = pathname === "/dashboard/shopify/products" || pathname?.startsWith("/dashboard/shopify/products");
  const isStores = pathname === "/dashboard/shopify/stores" || pathname?.startsWith("/dashboard/shopify/stores");

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <nav className="flex gap-6 px-6" aria-label="Products tabs">
        <Link
          href="/dashboard/shopify/products"
          className={cn(
            "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
            isProducts
              ? "text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <Package className="h-4 w-4" />
          Products
          {isProducts && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
          )}
        </Link>
        <Link
          href="/dashboard/shopify/stores"
          className={cn(
            "flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors relative",
            isStores
              ? "text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <Store className="h-4 w-4" />
          Stores
          {isStores && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--river-indigo)]" />
          )}
        </Link>
      </nav>
    </div>
  );
}
