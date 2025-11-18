"use client";

import { useState } from "react";
import { Link2, Copy, Check, BarChart3 } from "lucide-react";
import { enableClientPage, disableClientPage } from "@/app/actions/client-page";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClientPageToggleProps {
  projectId: string;
  clientPageEnabled: boolean;
  publicToken: string | null;
}

export default function ClientPageToggle({
  projectId,
  clientPageEnabled,
  publicToken,
}: ClientPageToggleProps) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(clientPageEnabled);
  const [token, setToken] = useState(publicToken);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const clientPageUrl = token
    ? `${window.location.origin}/client/${token}`
    : "";

  const handleToggle = async () => {
    setIsLoading(true);

    if (isEnabled) {
      // Disable
      const result = await disableClientPage(projectId);

      if (result.error) {
        alert(`Error: ${result.error}`);
        setIsLoading(false);
        return;
      }

      setIsEnabled(false);
      setDialogOpen(false);
    } else {
      // Enable
      const result = await enableClientPage(projectId);

      if (result.error) {
        alert(`Error: ${result.error}`);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setToken(result.data.public_token);
        setIsEnabled(true);
        setDialogOpen(true);
      }
    }

    setIsLoading(false);
    router.refresh();
  };

  const handleCopy = () => {
    if (clientPageUrl) {
      navigator.clipboard.writeText(clientPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          if (isEnabled) {
            setDialogOpen(true);
          } else {
            handleToggle();
          }
        }}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
          isEnabled
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border border-[var(--border)]",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <Link2 className="h-4 w-4" />
        <span>{isEnabled ? "Client Page" : "Enable Client Page"}</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Client Page Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Share this link with your client to give them access to this project.
              They can view it without logging in.
            </p>

            {/* Shareable Link */}
            <div className="flex gap-2">
              <input
                type="text"
                value={clientPageUrl}
                readOnly
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Preview Link */}
            <a
              href={clientPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:underline"
            >
              Open client page in new tab →
            </a>

            {/* Instructions */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                Next steps:
              </p>
              <ol className="list-decimal list-inside text-sm text-[var(--muted-foreground)] space-y-1">
                <li>Mark tabs as "Visible to client" from the tab menu</li>
                <li>Share this link with your client</li>
                <li>They can view updates in real-time</li>
              </ol>
            </div>

            {/* Analytics & Settings */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  // TODO: Open analytics modal
                  alert("Analytics view coming soon!");
                }}
                className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </button>

              <button
                onClick={handleToggle}
                disabled={isLoading}
                className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {isLoading ? "Disabling..." : "Disable Client Page"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

