"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent } from "@/types/chart";
import { updateChartCustomization } from "@/app/actions/chart-actions";

interface ChartCustomizeDialogProps {
  block: Block;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ChartRow = {
  label: string;
  value: string;
  color: string;
};

function buildRows(labels: string[], values: number[], colors: string[]) {
  const maxLen = Math.max(labels.length, values.length, colors.length, 1);
  return Array.from({ length: maxLen }).map((_, idx) => ({
    label: labels[idx] ?? "",
    value: values[idx] !== undefined ? String(values[idx]) : "",
    color: colors[idx] ?? "#3b82f6",
  }));
}

function parseNumeric(value: string) {
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export default function ChartCustomizeDialog({ block, isOpen, onClose, onSuccess }: ChartCustomizeDialogProps) {
  const content = (block.content || {}) as ChartBlockContent;
  const customization = content.metadata?.customization;

  const [title, setTitle] = useState(customization?.title ?? content.title ?? "");
  const [rows, setRows] = useState<ChartRow[]>(() =>
    buildRows(customization?.labels ?? [], customization?.values ?? [], customization?.colors ?? [])
  );
  const [height, setHeight] = useState(
    customization?.height !== null && customization?.height !== undefined
      ? String(customization.height)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const previewLabelCount = useMemo(() => rows.filter((row) => row.label.trim()).length, [rows]);
  const previewValueCount = useMemo(() => rows.filter((row) => parseNumeric(row.value) !== null).length, [rows]);

  const reset = () => {
    setTitle(customization?.title ?? content.title ?? "");
    setRows(buildRows(customization?.labels ?? [], customization?.values ?? [], customization?.colors ?? []));
    setHeight(
      customization?.height !== null && customization?.height !== undefined
        ? String(customization.height)
        : ""
    );
    setError(null);
  };

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedLabels: string[] = [];
    const parsedValues: number[] = [];
    const parsedColors: string[] = [];
    rows.forEach((row) => {
      const label = row.label.trim();
      const numeric = parseNumeric(row.value);
      if (!label && numeric === null) return;
      if (!label || numeric === null) return;
      parsedLabels.push(label);
      parsedValues.push(numeric);
      parsedColors.push(row.color || "#3b82f6");
    });
    const parsedHeight = height ? Number(height) : undefined;

    if (parsedLabels.length === 0 || parsedValues.length === 0) {
      setError("Please provide at least one label and value.");
      return;
    }

    if (height && Number.isNaN(parsedHeight)) {
      setError("Height must be a number.");
      return;
    }

    setIsSaving(true);
    const result = await updateChartCustomization({
      blockId: block.id,
      title: title.trim() ? title.trim() : null,
      labels: parsedLabels.length > 0 ? parsedLabels : undefined,
      values: parsedValues.length > 0 ? parsedValues : undefined,
      colors: parsedColors.length > 0 ? parsedColors : undefined,
      height: parsedHeight,
    });

    if ("error" in result) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSuccess?.();
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Customize Chart</DialogTitle>
          <DialogDescription>
            Update labels, values, colors, and sizing. Leave fields empty to keep the existing chart data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="chart-title">Title</Label>
              <Input
                id="chart-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Quarterly ARR"
              />
            </div>

            <div className="space-y-2">
              <Label>Labels, Values, Colors</Label>
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={`row-${index}`} className="grid grid-cols-[1fr_120px_48px_32px] items-center gap-2">
                    <Input
                      value={row.label}
                      onChange={(event) => {
                        const next = [...rows];
                        next[index] = { ...next[index], label: event.target.value };
                        setRows(next);
                      }}
                      placeholder={`Label ${index + 1}`}
                    />
                    <Input
                      value={row.value}
                      onChange={(event) => {
                        const next = [...rows];
                        next[index] = { ...next[index], value: event.target.value };
                        setRows(next);
                      }}
                      placeholder="Value"
                    />
                    <input
                      type="color"
                      value={row.color}
                      onChange={(event) => {
                        const next = [...rows];
                        next[index] = { ...next[index], color: event.target.value };
                        setRows(next);
                      }}
                      className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
                      aria-label={`Color ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = rows.filter((_, rowIndex) => rowIndex !== index);
                        setRows(next.length ? next : buildRows([], [], []));
                      }}
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      aria-label="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRows([...rows, { label: "", value: "", color: "#3b82f6" }])}
                >
                  Add row
                </Button>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Current rows with labels: {previewLabelCount || 0}. Parsed values: {previewValueCount || 0}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chart-height">Height (px)</Label>
              <Input
                id="chart-height"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                placeholder="280"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
