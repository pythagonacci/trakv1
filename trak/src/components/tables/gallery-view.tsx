"use client";

// Gallery data lives in table_rows; the cover is a normal field (url or files) on the row.
// galleryConfig.coverFieldId points to which field to show as the card cover. No separate store.

import React, { useMemo, useState, useRef } from "react";
import { Calendar, ChevronDown, LayoutGrid, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isValidUrl, ensureHttps } from "@/lib/field-utils";
import type {
  GroupByConfig,
  PriorityFieldConfig,
  PriorityLevelConfig,
  SelectFieldConfig,
  SelectFieldOption,
  StatusFieldConfig,
  TableField,
  TableRow,
  ViewConfig,
} from "@/types/table";
import { groupRows, canGroupByField } from "@/lib/table-grouping";
import {
  getCanonicalPriorityOption,
  getCanonicalStatusOption,
  TABLE_STATUS_OPTIONS,
  TABLE_PRIORITY_LEVELS,
} from "@/lib/tables/universal-property";
import { formatUserDisplay } from "@/lib/field-utils";
import { uploadFile } from "@/app/actions/file";
import { useQuery } from "@tanstack/react-query";

const MAX_VISIBLE_PILLS = 6;

interface GalleryViewProps {
  fields: TableField[];
  rows: TableRow[];
  groupBy?: GroupByConfig;
  galleryConfig?: ViewConfig["galleryConfig"];
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  selectedRows: Set<string>;
  onSelectRow: (rowId: string, event: React.MouseEvent<HTMLInputElement>) => void;
  onUpdateCell: (rowId: string, fieldId: string, value: unknown) => void;
  onCreateRow: (data?: Record<string, unknown>) => void;
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
  onOpenRow?: (rowId: string) => void;
  tableId?: string;
  /** Required for cover image upload (file picker). */
  workspaceId?: string | null;
  projectId?: string | null;
  /** When set, "Add cover" immediately opens file picker and this handles upload (ensures Files cover field + upload + set cell). */
  onUploadCoverImage?: (rowId: string, file: File) => Promise<void>;
}

function withAlpha(color: string, alpha: string) {
  if (!color) return color;
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color;
}

function toDateToken(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateRange(value: unknown): { start: string; end: string } | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) return { start: rangeMatch[1], end: rangeMatch[2] };
    const token = toDateToken(trimmed);
    return token ? { start: token, end: token } : null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const start = toDateToken(obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null);
    const end = toDateToken(obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start);
    if (!start && !end) return null;
    return { start: start || end, end: end || start };
  }

  const token = toDateToken(value);
  return token ? { start: token, end: token } : null;
}

function formatShortToken(token: string): string {
  const [year, month, day] = token.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateShort(value: unknown): string | null {
  const range = toDateRange(value);
  if (!range) return null;
  if (range.start && range.end && range.start !== range.end) {
    return `${formatShortToken(range.start)} - ${formatShortToken(range.end)}`;
  }
  return formatShortToken(range.end || range.start);
}

/** Allowed image extensions for gallery cover (cover must be an image). */
const COVER_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)(\?|$)/i;

function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return COVER_IMAGE_EXTENSIONS.test(pathname);
  } catch {
    return false;
  }
}

/** Resolve cover image URL from row data. For files field, use fileUrlMap to resolve file id -> url. */
function getCoverUrl(
  row: TableRow,
  coverField: TableField | undefined,
  fileUrlMap?: Record<string, string> | null
): string | null {
  if (!coverField) return null;
  const value = row.data?.[coverField.id];
  if (value == null) return null;
  if (coverField.type === "url" && typeof value === "string") return value.trim() || null;
  if (coverField.type === "files") {
    const arr = Array.isArray(value) ? value : [];
    const first = arr[0];
    if (typeof first === "string") {
      const id = first.trim();
      if (fileUrlMap?.[id]) return fileUrlMap[id];
      return null; // file id not yet resolved
    }
    if (first && typeof first === "object" && "url" in first && typeof (first as { url: unknown }).url === "string") {
      return ((first as { url: string }).url).trim() || null;
    }
  }
  return null;
}

function resolveOption(
  field: TableField | undefined,
  value: unknown
): SelectFieldOption | PriorityLevelConfig | null {
  if (!field || value === null || value === undefined) return null;
  if (field.type === "priority") {
    const levels = ((field.config || {}) as PriorityFieldConfig).levels || [];
    const matched = levels.find((l) => l.id === value || l.label === value);
    if (matched) return matched;
    const fallback = getCanonicalPriorityOption(value);
    return fallback
      ? { id: fallback.id, label: fallback.label, color: fallback.color, order: fallback.order }
      : null;
  }
  if (field.type === "select" || field.type === "multi_select" || field.type === "tags") {
    const options = ((field.config || {}) as SelectFieldConfig).options || [];
    return options.find((opt) => opt.id === value || opt.label === value) || null;
  }
  if (field.type === "status") {
    const options = ((field.config || {}) as StatusFieldConfig).options || [];
    const matched = options.find((opt) => opt.id === value || opt.label === value);
    if (matched) return matched;
    const fallback = getCanonicalStatusOption(value);
    return fallback ? { id: fallback.id, label: fallback.label, color: fallback.color } : null;
  }
  return null;
}

function Pill({
  label,
  color,
  className,
}: {
  label: string;
  color?: string;
  className?: string;
}) {
  const style = color
    ? {
        backgroundColor: withAlpha(color, "1A"),
        borderColor: withAlpha(color, "33"),
        color: color,
      }
    : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-medium",
        className
      )}
      style={style}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="max-w-[160px] truncate">{label}</span>
    </span>
  );
}

function Cover({
  url,
  title,
  emptyLabel = "Add cover",
  editable,
  onSetCoverClick,
  onNoCoverClick,
}: {
  url: string | null;
  title: string;
  emptyLabel?: string;
  editable?: boolean;
  onSetCoverClick?: () => void;
  /** When empty and not editable (no cover field), clicking runs this (e.g. show hint). */
  onNoCoverClick?: () => void;
}) {
  const content =
    url ?
      (
        <div className="relative h-32 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} className="h-full w-full object-cover" />
        </div>
      )
    : (
        <div className="relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-b from-[var(--surface)] to-[var(--surface-hover)] hover:border-[var(--border-strong)]">
          <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-600 shadow-sm">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{emptyLabel}</span>
          </div>
        </div>
      );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editable && onSetCoverClick) onSetCoverClick();
    else if (!url && onNoCoverClick) onNoCoverClick();
  };

  if (editable && onSetCoverClick) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
      >
        {content}
      </button>
    );
  }
  if (!url && onNoCoverClick) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
      >
        {content}
      </button>
    );
  }
  return content;
}

function NoCoverFieldHintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add cover image</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-neutral-600">
          Choose a cover field in the <strong>Cover</strong> menu in the toolbar above. Use a <strong>Files</strong> column to upload from your computer, or a <strong>URL</strong> column to paste an image link.
        </p>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetCoverUrlDialog({
  open,
  onOpenChange,
  currentUrl,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string;
  onSave: (url: string) => void;
}) {
  const [draft, setDraft] = useState(currentUrl);
  const [error, setError] = useState("");
  React.useEffect(() => {
    setDraft(currentUrl);
    setError("");
  }, [currentUrl, open]);
  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onSave("");
      onOpenChange(false);
      return;
    }
    const urlWithProtocol = ensureHttps(trimmed);
    if (!isValidUrl(urlWithProtocol)) {
      setError("Enter a valid URL");
      return;
    }
    if (!isImageUrl(urlWithProtocol)) {
      setError("Cover must be an image (e.g. .jpg, .png, .webp)");
      return;
    }
    setError("");
    onSave(urlWithProtocol);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set cover image</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(""); }}
            placeholder="https://example.com/image.jpg"
            className="font-mono text-sm"
          />
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvatarPill({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] text-[var(--foreground)]">
      <div className="grid h-5 w-5 place-items-center rounded-sm bg-neutral-200 text-[10px] font-semibold text-neutral-600">
        {initials}
      </div>
      <span className="max-w-[120px] truncate">{name}</span>
    </div>
  );
}

interface GalleryCardProps {
  row: TableRow;
  fields: TableField[];
  primaryField: TableField | undefined;
  statusField: TableField | undefined;
  priorityField: TableField | undefined;
  personField: TableField | undefined;
  dateField: TableField | undefined;
  coverField: TableField | undefined;
  propertyPillFields: TableField[];
  workspaceMembers: Array<{ id: string; name?: string; email?: string }>;
  selectedRows: Set<string>;
  onSelectRow: (rowId: string, event: React.MouseEvent<HTMLInputElement>) => void;
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
  onOpenRow?: (rowId: string) => void;
  onUpdateCell?: (rowId: string, fieldId: string, value: unknown) => void;
  onOpenEdit?: (rowId: string) => void;
  /** When cover field is files: upload selected image and set as cover. */
  onUploadCover?: (file: File) => Promise<void>;
  /** When set, "Add cover" opens file picker and this handles upload (used when parent ensures cover field + upload). */
  onUploadCoverImage?: (file: File) => Promise<void>;
  /** Map of file id -> signed URL for displaying files-type cover. */
  coverFileUrlMap?: Record<string, string> | null;
}

function GalleryCard({
  row,
  fields,
  primaryField,
  statusField,
  priorityField,
  personField,
  dateField,
  coverField,
  propertyPillFields,
  workspaceMembers,
  selectedRows,
  onSelectRow,
  onContextMenu,
  onOpenRow,
  onUpdateCell,
  onOpenEdit,
  onUploadCover,
  onUploadCoverImage,
  coverFileUrlMap,
}: GalleryCardProps) {
  const [pillsExpanded, setPillsExpanded] = useState(false);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [noCoverHintOpen, setNoCoverHintOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
  const coverUrl = getCoverUrl(row, coverField, coverFileUrlMap);
  const openFilePickerOnAddCover = Boolean(
    onUploadCoverImage ?? (coverField?.type === "files" && onUploadCover)
  );
  const coverEditable =
    openFilePickerOnAddCover ||
    Boolean(coverField?.type === "url" && onUpdateCell);
  const coverIsFiles = coverField?.type === "files";
  const currentCoverUrl = coverField?.type === "url" ? String(row.data?.[coverField.id] ?? "") : "";
  const statusOption = statusField ? resolveOption(statusField, row.data?.[statusField.id]) : null;
  const priorityOption = priorityField ? resolveOption(priorityField, row.data?.[priorityField.id]) as PriorityLevelConfig | null : null;
  const personId = personField ? row.data?.[personField.id] : null;
  const person = typeof personId === "string" ? workspaceMembers.find((m) => m.id === personId) : null;
  const personIds = personField && Array.isArray(row.data?.[personField.id])
    ? (row.data[personField.id] as string[])
    : personId != null ? [String(personId)] : [];
  const persons = personIds
    .map((id) => workspaceMembers.find((m) => m.id === id))
    .filter(Boolean) as Array<{ id: string; name?: string; email?: string }>;
  const dateVal = dateField ? row.data?.[dateField.id] : null;
  const dateStr = formatDateShort(dateVal);

  const allPillItems = useMemo(() => {
    const items: { field: TableField; label: string; color?: string }[] = [];
    for (const field of propertyPillFields) {
      const value = row.data?.[field.id];
      if (value === null || value === undefined || value === "") continue;
      if (field.type === "date") {
        const formatted = formatDateShort(value);
        if (formatted) items.push({ field, label: formatted, color: undefined });
      } else if (field.type === "status" || field.type === "priority" || field.type === "select" || field.type === "multi_select" || field.type === "tags") {
        const opt = resolveOption(field, value);
        if (opt) items.push({ field, label: (opt as SelectFieldOption).label ?? (opt as PriorityLevelConfig).label, color: (opt as SelectFieldOption).color ?? (opt as PriorityLevelConfig).color });
      } else {
        const label = Array.isArray(value) ? value.join(", ") : String(value);
        if (label.length > 0) items.push({ field, label: label.slice(0, 80), color: undefined });
      }
    }
    return items;
  }, [row.data, propertyPillFields]);

  const visiblePills = pillsExpanded ? allPillItems : allPillItems.slice(0, MAX_VISIBLE_PILLS);
  const overflowCount = allPillItems.length - MAX_VISIBLE_PILLS;
  const showExpander = !pillsExpanded && overflowCount > 0;

  return (
    <Card
      className="group rounded-xl border-neutral-200 bg-white shadow-sm"
      onContextMenu={(e) => onContextMenu?.(e, row.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {statusOption && (
              <Pill label={statusOption.label} color={statusOption.color} />
            )}
            {priorityOption && (
              <Pill label={priorityOption.label} color={priorityOption.color} />
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <input
              type="checkbox"
              checked={selectedRows.has(row.id)}
              onChange={(e) => onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-neutral-200 text-[var(--foreground)] focus:ring-2 focus:ring-[var(--foreground)]"
            />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Row</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenRow?.(row.id)}>Open details</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="mt-3">
          {openFilePickerOnAddCover && (
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingCover(true);
                const done = () => {
                  setUploadingCover(false);
                  e.target.value = "";
                };
                if (onUploadCoverImage) {
                  onUploadCoverImage(file).catch(() => {}).finally(done);
                } else if (onUploadCover) {
                  onUploadCover(file).catch(() => {}).finally(done);
                } else {
                  done();
                }
              }}
            />
          )}
          <Cover
            url={coverUrl}
            title={title}
            emptyLabel={uploadingCover ? "Uploading…" : "Add cover"}
            editable={coverEditable}
            onSetCoverClick={
              coverEditable
                ? openFilePickerOnAddCover
                  ? () => coverFileInputRef.current?.click()
                  : () => setCoverDialogOpen(true)
                : undefined
            }
            onNoCoverClick={() => {
              if (openFilePickerOnAddCover) {
                coverFileInputRef.current?.click();
              } else if (coverEditable) {
                setCoverDialogOpen(true);
              } else {
                setNoCoverHintOpen(true);
              }
            }}
          />
          {coverField?.type === "url" && (
            <SetCoverUrlDialog
              open={coverDialogOpen}
              onOpenChange={setCoverDialogOpen}
              currentUrl={currentCoverUrl}
              onSave={(url) => onUpdateCell?.(row.id, coverField.id, url)}
            />
          )}
          <NoCoverFieldHintDialog open={noCoverHintOpen} onOpenChange={setNoCoverHintOpen} />
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-[var(--foreground)]">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
              {visiblePills.map(({ field, label, color }) => (
                <Pill key={field.id} label={label} color={color} />
              ))}
              {showExpander && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPillsExpanded(true); }}
                  className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-200"
                >
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  +{overflowCount}
                </button>
              )}
            </div>
          </div>
          {dateStr && !propertyPillFields.some((f) => f.id === dateField?.id) && dateField && (
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[12px] font-medium text-[var(--foreground)]">
                <Calendar className="h-3.5 w-3.5 text-neutral-600" />
                {dateStr}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {persons.slice(0, 2).map((p) => (
              <AvatarPill key={p.id} name={formatUserDisplay(p)} />
            ))}
            {persons.length > 2 && (
              <div className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-600">
                +{persons.length - 2}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-[12px] text-[var(--foreground)] hover:bg-neutral-200"
              onClick={(e) => { e.stopPropagation(); onOpenRow?.(row.id); }}
            >
              Open
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-[12px] text-[var(--foreground)] hover:bg-neutral-200"
              onClick={(e) => { e.stopPropagation(); onOpenEdit?.(row.id); }}
            >
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GalleryCardEditDialog({
  open,
  onOpenChange,
  row,
  fields,
  primaryField,
  statusField,
  priorityField,
  dateField,
  coverField,
  workspaceMembers,
  onUpdateCell,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: TableRow;
  fields: TableField[];
  primaryField: TableField | undefined;
  statusField: TableField | undefined;
  priorityField: TableField | undefined;
  dateField: TableField | undefined;
  coverField: TableField | undefined;
  workspaceMembers: Array<{ id: string; name?: string; email?: string }>;
  onUpdateCell: (rowId: string, fieldId: string, value: unknown) => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [dateVal, setDateVal] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverError, setCoverError] = useState("");
  React.useEffect(() => {
    if (!open) return;
    setTitle(primaryField ? String(row.data?.[primaryField.id] ?? "") : "");
    setStatus(statusField ? String(row.data?.[statusField.id] ?? "") : "");
    setPriority(priorityField ? String(row.data?.[priorityField.id] ?? "") : "");
    const d = dateField ? row.data?.[dateField.id] : null;
    setDateVal(d ? (typeof d === "string" ? d.slice(0, 10) : "") : "");
    setCoverUrl(coverField?.type === "url" ? String(row.data?.[coverField.id] ?? "") : "");
    setCoverError("");
  }, [open, row.data, primaryField, statusField, priorityField, dateField, coverField]);

  const handleSave = () => {
    if (primaryField) onUpdateCell(row.id, primaryField.id, title.trim() || "");
    if (statusField) onUpdateCell(row.id, statusField.id, status || null);
    if (priorityField) onUpdateCell(row.id, priorityField.id, priority || null);
    if (dateField) onUpdateCell(row.id, dateField.id, dateVal ? `${dateVal}T00:00:00` : null);
    if (coverField?.type === "url") {
      const trimmed = coverUrl.trim();
      if (trimmed) {
        const urlWithProtocol = ensureHttps(trimmed);
        if (!isValidUrl(urlWithProtocol)) {
          setCoverError("Enter a valid URL");
          return;
        }
        if (!isImageUrl(urlWithProtocol)) {
          setCoverError("Cover must be an image (e.g. .jpg, .png, .webp)");
          return;
        }
        onUpdateCell(row.id, coverField.id, urlWithProtocol);
      } else {
        onUpdateCell(row.id, coverField.id, "");
      }
    }
    setCoverError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {primaryField && (
            <div>
              <label className="text-xs font-medium text-neutral-600">{primaryField.name}</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="mt-1"
              />
            </div>
          )}
          {statusField && (
            <div>
              <label className="text-xs font-medium text-neutral-600">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">—</option>
                {TABLE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          {priorityField && (
            <div>
              <label className="text-xs font-medium text-neutral-600">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">—</option>
                {TABLE_PRIORITY_LEVELS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          {dateField && (
            <div>
              <label className="text-xs font-medium text-neutral-600">{dateField.name}</label>
              <Input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
          {coverField?.type === "url" && (
            <div>
              <label className="text-xs font-medium text-neutral-600">Cover image URL</label>
              <Input
                value={coverUrl}
                onChange={(e) => { setCoverUrl(e.target.value); setCoverError(""); }}
                placeholder="https://..."
                className="mt-1 font-mono text-sm"
              />
              {coverError && <p className="mt-1 text-xs text-[var(--error)]">{coverError}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryView({
  fields,
  rows,
  groupBy,
  galleryConfig,
  workspaceMembers = [],
  selectedRows,
  onSelectRow,
  onUpdateCell,
  onCreateRow,
  onContextMenu,
  onOpenRow,
  workspaceId,
  projectId,
  onUploadCoverImage,
}: GalleryViewProps) {
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const coverFieldId = galleryConfig?.coverFieldId;
  const coverField = coverFieldId ? fields.find((f) => f.id === coverFieldId) : undefined;
  const primaryField = useMemo(() => fields.find((f) => f.is_primary) ?? fields[0], [fields]);
  const statusField = useMemo(() => fields.find((f) => f.type === "status"), [fields]);
  const priorityField = useMemo(() => fields.find((f) => f.type === "priority"), [fields]);
  const personField = useMemo(() => fields.find((f) => f.type === "person"), [fields]);
  const dateField = useMemo(() => fields.find((f) => f.type === "date"), [fields]);
  const editRow = editRowId ? rows.find((r) => r.id === editRowId) : null;

  const coverFileIds = useMemo(() => {
    if (!coverField || coverField.type !== "files") return [];
    const ids: string[] = [];
    for (const row of rows) {
      const value = row.data?.[coverField.id];
      const arr = Array.isArray(value) ? value : [];
      for (const item of arr) {
        if (typeof item === "string" && item.trim()) ids.push(item.trim());
      }
    }
    return Array.from(new Set(ids));
  }, [rows, coverField]);

  const { data: coverFileUrlMap } = useQuery({
    queryKey: ["fileUrls", coverFileIds],
    queryFn: async () => {
      if (coverFileIds.length === 0) return {} as Record<string, string>;
      const params = new URLSearchParams();
      coverFileIds.forEach((id) => params.append("ids", id));
      const res = await fetch(`/api/files/batch-urls?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json?.error) return {} as Record<string, string>;
      return (json.data ?? {}) as Record<string, string>;
    },
    enabled: coverFileIds.length > 0,
    staleTime: 50 * 60 * 1000,
  });

  const handleUploadCover = useMemo(() => {
    if (onUploadCoverImage) return undefined;
    if (!workspaceId || !projectId || !coverField || coverField.type !== "files" || !onUpdateCell)
      return undefined;
    return (rowId: string, file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      return uploadFile(formData, workspaceId, projectId)
        .then((result) => {
          if (result.error) throw new Error(result.error);
          const fileId = result.data?.id;
          if (!fileId) throw new Error("Upload failed");
          onUpdateCell(rowId, coverField.id, [fileId]);
        });
    };
  }, [onUploadCoverImage, workspaceId, projectId, coverField, onUpdateCell]);

  const propertyPillFields = useMemo(() => {
    const excludeIds = new Set<string>([
      primaryField?.id,
      coverField?.id,
      statusField?.id,
      priorityField?.id,
      personField?.id,
    ].filter((id): id is string => Boolean(id)));
    return fields.filter((f) => !excludeIds.has(f.id));
  }, [fields, primaryField?.id, coverField?.id, statusField?.id, priorityField?.id, personField?.id]);

  const groupByField = groupBy?.fieldId ? fields.find((f) => f.id === groupBy.fieldId) : undefined;
  const grouped = useMemo(() => {
    if (!groupByField || !canGroupByField(groupByField.type)) return null;
    return groupRows(rows, groupByField, groupBy?.collapsed ?? [], {
      members: workspaceMembers,
      showEmptyGroups: groupBy?.showEmptyGroups ?? true,
      sortOrder: groupBy?.sortOrder,
    });
  }, [rows, groupByField, groupBy?.collapsed, groupBy?.showEmptyGroups, groupBy?.sortOrder, workspaceMembers]);

  const cardSize = galleryConfig?.cardSize ?? "medium";
  const gridClass = cn(
    "grid gap-3",
    cardSize === "small" && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    cardSize === "medium" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    cardSize === "large" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
  );

  const cardProps = {
    fields,
    primaryField,
    statusField,
    priorityField,
    personField,
    dateField,
    coverField,
    propertyPillFields,
    workspaceMembers,
    selectedRows,
    onSelectRow,
    onContextMenu,
    onOpenRow,
    onUpdateCell,
    onOpenEdit: setEditRowId,
    coverFileUrlMap: coverFileUrlMap ?? null,
  };

  const mainContent =
    grouped && grouped.length > 0 ? (
      <div className="space-y-8 p-4">
        {grouped.map((group) => (
          <div key={group.groupId} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {group.groupColor && (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.groupColor }}
                  />
                )}
                <span className="text-[13px] font-semibold text-[var(--foreground)]">{group.groupLabel}</span>
                <span className="text-[12px] text-neutral-600">{group.count}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-md px-2 text-[12px] text-neutral-600 hover:bg-neutral-200"
                onClick={() => {
                  const data: Record<string, unknown> = {};
                  if (group.groupId !== "__ungrouped__" && groupByField) {
                    if (groupByField.type === "multi_select" || groupByField.type === "tags") {
                      data[groupByField.id] = [group.groupId];
                    } else if (groupByField.type === "checkbox" || groupByField.type === "subtask") {
                      data[groupByField.id] = group.groupId === "true";
                    } else {
                      data[groupByField.id] = group.groupId;
                    }
                  }
                  onCreateRow(data);
                }}
              >
                Add
              </Button>
            </div>
            <div className={gridClass}>
              {group.rows.map((row) => (
                <GalleryCard
                  key={row.id}
                  row={row}
                  {...cardProps}
                  onUploadCover={
                    handleUploadCover ? (file) => handleUploadCover(row.id, file) : undefined
                  }
                  onUploadCoverImage={
                    onUploadCoverImage ? (file) => onUploadCoverImage(row.id, file) : undefined
                  }
                />
              ))}
            </div>
            <div className="border-t border-neutral-200 pt-1" />
          </div>
        ))}
      </div>
    ) : (
      <div className={cn("p-4", gridClass)}>
        {rows.map((row) => (
          <GalleryCard
            key={row.id}
            row={row}
            {...cardProps}
            onUploadCover={
              handleUploadCover ? (file) => handleUploadCover(row.id, file) : undefined
            }
            onUploadCoverImage={
              onUploadCoverImage ? (file) => onUploadCoverImage(row.id, file) : undefined
            }
          />
        ))}
      </div>
    );

  return (
    <>
      {mainContent}
      {editRow && onUpdateCell && (
        <GalleryCardEditDialog
          open={Boolean(editRowId)}
          onOpenChange={(open) => !open && setEditRowId(null)}
          row={editRow}
          fields={fields}
          primaryField={primaryField}
          statusField={statusField}
          priorityField={priorityField}
          dateField={dateField}
          coverField={coverField}
          workspaceMembers={workspaceMembers}
          onUpdateCell={onUpdateCell}
        />
      )}
    </>
  );
}
