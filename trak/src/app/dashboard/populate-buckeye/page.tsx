"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function PopulateBuckeyePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  const handlePopulate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/populate-buckeye", {
        method: "POST",
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Populate Buckeye Brownies Project</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        This will add subtabs and content blocks to the Buckeye Brownies project to demonstrate how a real organization would use Trak.
      </p>

      <Button onClick={handlePopulate} disabled={loading}>
        {loading ? "Populating..." : "Populate Project"}
      </Button>

      {result && (
        <div className={`mt-6 p-4 rounded-md ${result.error ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
          {result.error ? (
            <p className="text-red-600 dark:text-red-400">Error: {result.error}</p>
          ) : (
            <div>
              <p className="text-green-600 dark:text-green-400 font-medium">{result.message}</p>
              {result.success && (
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                  Refresh the Buckeye Brownies project page to see the new tabs and content.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

