"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShopifyConnection, disconnectShopify, triggerSync } from "@/app/actions/shopify-connection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShopifyProductPicker } from "./product-picker";

interface ShopifyConnectionCardProps {
  connection: ShopifyConnection;
  onUpdate: () => void;
}

export function ShopifyConnectionCard({ connection, onUpdate }: ShopifyConnectionCardProps) {
  const router = useRouter();
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect this Shopify store?")) {
      return;
    }

    setIsDisconnecting(true);
    startTransition(async () => {
      const result = await disconnectShopify(connection.id);
      setIsDisconnecting(false);

      if ("error" in result) {
        alert(`Failed to disconnect: ${result.error}`);
      } else {
        onUpdate();
      }
    });
  };

  const handleSync = (syncType: "full_sync" | "inventory_sync" | "metadata_sync") => {
    setIsSyncing(true);
    startTransition(async () => {
      const result = await triggerSync(connection.id, syncType);
      setIsSyncing(false);

      if ("error" in result) {
        alert(`Failed to trigger sync: ${result.error}`);
      } else {
        alert("Sync job queued successfully!");
      }
    });
  };

  const getStatusBadge = () => {
    switch (connection.sync_status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      case "disconnected":
        return <Badge className="bg-gray-100 text-gray-800">Disconnected</Badge>;
      default:
        return <Badge>{connection.sync_status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">
                  {connection.shop_name || connection.shop_domain}
                </h3>
                {getStatusBadge()}
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">Domain:</span> {connection.shop_domain}
                </div>
                {connection.shop_email && (
                  <div>
                    <span className="font-medium">Email:</span> {connection.shop_email}
                  </div>
                )}
                {connection.shop_currency && (
                  <div>
                    <span className="font-medium">Currency:</span> {connection.shop_currency}
                  </div>
                )}
                {connection.last_synced_at && (
                  <div>
                    <span className="font-medium">Last synced:</span>{" "}
                    {new Date(connection.last_synced_at).toLocaleString()}
                  </div>
                )}
                <div>
                  <span className="font-medium">Scopes:</span> {connection.scopes.join(", ")}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 ml-6">
              {connection.sync_status === "active" && (
                <>
                  <Button
                    onClick={() => router.push(`/dashboard/shopify/products?connection_id=${connection.id}`)}
                    size="sm"
                  >
                    View Products
                  </Button>

                  <Button
                    onClick={() => setShowProductPicker(true)}
                    disabled={isPending}
                    variant="outline"
                    size="sm"
                  >
                    Import Products
                  </Button>

                  <Button
                    onClick={() => handleSync("inventory_sync")}
                    disabled={isPending || isSyncing}
                    variant="outline"
                    size="sm"
                  >
                    {isSyncing ? "Syncing..." : "Sync Inventory"}
                  </Button>

                  <Button
                    onClick={() => handleSync("metadata_sync")}
                    disabled={isPending || isSyncing}
                    variant="outline"
                    size="sm"
                  >
                    {isSyncing ? "Syncing..." : "Sync Metadata"}
                  </Button>
                </>
              )}

              <Button
                onClick={handleDisconnect}
                disabled={isPending || isDisconnecting}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showProductPicker && (
        <ShopifyProductPicker
          isOpen={showProductPicker}
          onClose={() => setShowProductPicker(false)}
          connectionId={connection.id}
          onImport={onUpdate}
        />
      )}
    </>
  );
}
