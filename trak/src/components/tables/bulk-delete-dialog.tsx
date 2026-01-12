"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  rowCount: number;
  relationCount?: number | null;
  countingRelations?: boolean;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BulkDeleteDialog({
  open,
  rowCount,
  relationCount,
  countingRelations,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--error)]">
            <AlertTriangle className="h-4 w-4" />
            Delete rows
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-[var(--foreground)]">
          <div>
            Delete <span className="font-semibold">{rowCount}</span> row{rowCount === 1 ? "" : "s"}?
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            {countingRelations ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Counting relation links...
              </span>
            ) : relationCount && relationCount > 0 ? (
              <span>
                This will remove <span className="font-semibold">{relationCount}</span> relation link
                {relationCount === 1 ? "" : "s"} to other rows.
              </span>
            ) : (
              <span>No relation links will be affected.</span>
            )}
          </div>
          {relationCount && relationCount > 0 && (
            <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              Deleting these rows will remove related links. Rollup values in connected rows will
              update automatically.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${rowCount} row${rowCount === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
