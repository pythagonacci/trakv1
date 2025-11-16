"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InternalDialogProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: {
    name: string;
    status: "not_started" | "in_progress" | "complete";
  };
}

interface FormData {
  name: string;
  status: "not_started" | "in_progress" | "complete";
}

export default function InternalDialog({ mode, isOpen, onClose, onSubmit, initialData }: InternalDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || "",
    status: initialData?.status || "not_started",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name,
        status: initialData.status,
      });
    } else if (isOpen && !initialData) {
      setFormData({
        name: "",
        status: "not_started",
      });
    }
    setError(null);
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // onClose is called in parent after successful submit
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Space" : "Edit Space"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new internal space for company knowledge and documentation."
              : "Update the details of this space."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Space Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Operations, Brand Guidelines, Templates..."
              required
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as "not_started" | "in_progress" | "complete" }))}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1"
            >
              <option value="not_started">Draft</option>
              <option value="in_progress">Active</option>
              <option value="complete">Archived</option>
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Space" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

