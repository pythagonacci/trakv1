import { ProductsTabBar } from "./products-tab-bar";

export default function ShopifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <ProductsTabBar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
