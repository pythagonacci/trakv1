"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { createWorkflowPage, getWorkspaceWorkflowPages, type WorkflowPageTab } from "@/app/actions/workflow-page";
import Toast from "@/app/dashboard/projects/toast";
import { Button } from "@/components/ui/button";
import WorkflowPagesTable from "./workflow-pages-table";

export const dynamic = "force-dynamic";

export default function WorkflowPagesIndex() {
  const router = useRouter();
  const [pages, setPages] = useState<WorkflowPageTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await getWorkspaceWorkflowPages();
    if ("error" in result) {
      setToast({ message: result.error, type: "error" });
      setLoading(false);
      return;
    }
    setPages(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createWorkflowPage({ isWorkspaceLevel: true });
      if ("error" in result) throw new Error(result.error);
      router.push(`/dashboard/workflow/${result.data.tabId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create workflow page";
      setToast({ message, type: "error" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-[var(--foreground)] font-playfair" style={{ fontFamily: 'var(--font-playfair)' }}>Workflow Pages</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Permanent, AI-powered analysis documents.
          </p>
        </div>
        <Button
          onClick={() => void onCreate()}
          disabled={creating}
          size="sm"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New Workflow Page
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <WorkflowPagesTable pages={pages} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

