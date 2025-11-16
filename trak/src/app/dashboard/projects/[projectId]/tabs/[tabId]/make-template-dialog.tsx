"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { makeBlockTemplate } from "@/app/actions/block-templates";

interface MakeTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  blockType: string;
  onSuccess: () => void;
}

export default function MakeTemplateDialog({ isOpen, onClose, blockId, blockType, onSuccess }: MakeTemplateDialogProps) {
  const [templateName, setTemplateName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!templateName.trim()) {
      setError("Please enter a name for this reusable block");
      return;
    }

    setIsLoading(true);
    const result = await makeBlockTemplate(blockId, templateName);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setTemplateName("");
      setIsLoading(false);
      onSuccess();
      onClose();
    }
  };

  const handleClose = () => {
    setTemplateName("");
    setError(null);
    onClose();
  };

  const getBlockTypeLabel = () => {
    const labels: Record<string, string> = {
      text: "Text Block",
      task: "Task List",
      link: "Link",
      table: "Table",
      timeline: "Timeline",
      file: "File",
      image: "Image",
      video: "Video",
      embed: "Embed",
      pdf: "PDF",
      section: "Section",
    };
    return labels[blockType] || "Block";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Make Reusable Block</DialogTitle>
          <DialogDescription>
            This {getBlockTypeLabel().toLowerCase()} will be saved to your library and can be referenced in other projects. Changes to the original will update everywhere.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Block Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Standard Project Timeline, Client Onboarding"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Give it a descriptive name so you can find it later
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Making Reusable..." : "Make Reusable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

