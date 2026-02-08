"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ConnectShopifyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function ConnectShopifyDialog({ isOpen, onClose, workspaceId }: ConnectShopifyDialogProps) {
  const [shopDomain, setShopDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    setError(null);

    // Validate shop domain
    let domain = shopDomain.trim().toLowerCase();

    // Remove https:// or http:// if present
    domain = domain.replace(/^https?:\/\//, "");

    // Remove trailing slash
    domain = domain.replace(/\/$/, "");

    // Add .myshopify.com if not present
    if (!domain.endsWith(".myshopify.com")) {
      domain = `${domain}.myshopify.com`;
    }

    // Validate format
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopRegex.test(domain)) {
      setError("Invalid shop domain. Please enter a valid Shopify store domain.");
      return;
    }

    startTransition(() => {
      // Redirect to OAuth install route
      const installUrl = `/api/shopify/install?shop=${encodeURIComponent(domain)}&workspace_id=${encodeURIComponent(workspaceId)}`;
      window.location.href = installUrl;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConnect();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Shopify Store</DialogTitle>
          <DialogDescription>
            Enter your Shopify store domain to connect. You'll be redirected to Shopify to authorize the
            connection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="shop-domain">Shop Domain</Label>
            <Input
              id="shop-domain"
              type="text"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isPending}
              autoFocus
            />
            <p className="text-sm text-gray-500">
              Enter your store name or full domain (e.g., "my-store" or "my-store.myshopify.com")
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You'll be redirected to Shopify to authorize access. We'll request
              permission to read products, inventory, and orders.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isPending || !shopDomain.trim()}>
            {isPending ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
