"use client";

import { useState, useEffect } from "react";
import { ShopifyConnection } from "@/app/actions/shopify-connection";
import { ShopifyConnectionCard } from "@/components/shopify/connection-card";
import { ConnectShopifyDialog } from "@/components/shopify/connect-shopify-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface IntegrationsClientProps {
  workspaceId: string;
  initialConnections: ShopifyConnection[];
  success?: boolean;
  error?: string;
}

export function IntegrationsClient({
  workspaceId,
  initialConnections,
  success,
  error,
}: IntegrationsClientProps) {
  const [connections, setConnections] = useState<ShopifyConnection[]>(initialConnections);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showMessage, setShowMessage] = useState(success || !!error);

  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => setShowMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showMessage]);

  const handleConnectionUpdate = () => {
    // Refresh the page to get updated connections
    window.location.reload();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-gray-600">Connect external services to TWOD</p>
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

      {/* Shopify Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Shopify</CardTitle>
              <CardDescription>
                Connect your Shopify stores to import products, track inventory, and compute sales
              </CardDescription>
            </div>
            <Button onClick={() => setShowConnectDialog(true)} className="ml-4">
              + Connect Store
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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

      {/* Connect Dialog */}
      <ConnectShopifyDialog
        isOpen={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
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
