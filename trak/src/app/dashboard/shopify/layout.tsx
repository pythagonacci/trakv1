import { ProductsTabBar } from "./products-tab-bar";

export default function ShopifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col -mx-3 md:-mx-4 lg:-mx-5">
      <ProductsTabBar />
      <div className="flex-1 overflow-auto px-3 md:px-4 lg:px-5">{children}</div>
    </div>
  );
}
