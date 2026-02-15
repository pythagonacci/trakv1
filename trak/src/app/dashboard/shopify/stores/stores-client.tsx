"use client";

import { useState, useEffect } from "react";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import { ShopifyConnection } from "@/app/actions/shopify-connection";
import { ShopifyConnectionCard } from "@/components/shopify/connection-card";
import { ConnectShopifyDialog } from "@/components/shopify/connect-shopify-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ShopifyStoresClientProps {
  workspaceId: string;
  initialConnections: ShopifyConnection[];
  success?: boolean;
  error?: string;
}

function getErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    missing_params: "Missing required parameters",
    invalid_hmac: "Invalid security signature",
    invalid_state: "Invalid security token",
    state_expired: "Connection request expired",
    shop_mismatch: "Shop domain mismatch",
    save_failed: "Failed to save connection",
    callback_failed: "Connection callback failed",
  };
  return messages[error] || "An unknown error occurred";
}

export function ShopifyStoresClient({
  workspaceId,
  initialConnections,
  success,
  error,
}: ShopifyStoresClientProps) {
  const { setHeaderHidden } = useDashboardHeader();
  const [connections, setConnections] = useState<ShopifyConnection[]>(initialConnections);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showMessage, setShowMessage] = useState(success || !!error);

  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => setShowMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showMessage]);

  const handleConnectionUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="pl-8 pr-4 pt-12 pb-8 max-w-7xl">
      {/* Header - same format as products page */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Shopify Stores</h1>
        <p className="text-gray-600">Connect and manage your Shopify stores</p>
      </div>

      {/* Success/Error Messages */}
      {showMessage && success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          ✓ Shopify store connected successfully!
        </div>
      )}

      {showMessage && error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          ✗ Connection failed: {getErrorMessage(error)}
        </div>
      )}

      {/* Stores content */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-[var(--muted-foreground)]">
              Connect stores to import products and sync inventory
            </p>
            <Button onClick={() => setShowConnectDialog(true)}>
              + Connect Store
            </Button>
          </div>
          {connections.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">No Shopify stores connected yet</p>
              <Button onClick={() => setShowConnectDialog(true)} variant="outline">
                Connect Your First Store
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <ShopifyConnectionCard
                  key={connection.id}
                  connection={connection}
                  onUpdate={handleConnectionUpdate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConnectShopifyDialog
        isOpen={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
