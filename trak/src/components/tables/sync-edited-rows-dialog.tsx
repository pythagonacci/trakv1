"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SyncResolution = "push" | "discard" | "cancel";

interface Props {
  open: boolean;
  editedRowCount: number;
  resolving?: boolean;
  onResolve: (resolution: SyncResolution) => void;
}

export function SyncEditedRowsDialog({
  open,
  editedRowCount,
  resolving,
  onResolve,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={() => onResolve("cancel")}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--foreground)]">
            <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
            Resolve local edits before syncing
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-[var(--foreground)]">
          <p>
            <span className="font-semibold">{editedRowCount}</span> source-linked row
            {editedRowCount === 1 ? " has" : "s have"} local edits that haven&apos;t been
            synced to the source. Choose how to handle them before enabling live sync.
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full justify-center"
            onClick={() => onResolve("push")}
            disabled={resolving}
          >
            {resolving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Pushing...
              </>
            ) : (
              "Push my changes to source"
            )}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => onResolve("discard")}
            disabled={resolving}
          >
            {resolving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Discarding...
              </>
            ) : (
              "Discard my changes and use source data"
            )}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => onResolve("cancel")}
            disabled={resolving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
