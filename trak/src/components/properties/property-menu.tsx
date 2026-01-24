"use client";

// Trak Universal Properties - Property Menu Component
// Simple menu for managing fixed properties (status, priority, assignee, due date, tags)

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X, Eye, EyeOff, Calendar as CalendarIcon, User, Tag as TagIcon } from "lucide-react";
import {
  useEntityPropertiesWithInheritance,
  useSetEntityProperties,
  useAddTag,
  useRemoveTag,
  useWorkspaceMembers,
  useSetInheritedPropertyVisibility,
} from "@/lib/hooks/use-property-queries";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type EntityType,
  type Status,
  type Priority,
} from "@/types/properties";

interface PropertyMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  entityTitle?: string;
}

/**
 * Menu for viewing and editing properties on an entity
 */
export function PropertyMenu({
  open,
  onOpenChange,
  entityType,
  entityId,
  workspaceId,
  entityTitle,
}: PropertyMenuProps) {
  const [newTagInput, setNewTagInput] = useState("");

  const { data: propertiesResult, isLoading } =
    useEntityPropertiesWithInheritance(entityType, entityId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const setProperties = useSetEntityProperties(entityType, entityId, workspaceId);
  const addTagMutation = useAddTag(entityType, entityId, workspaceId);
  const removeTagMutation = useRemoveTag(entityType, entityId);
  const setVisibility = useSetInheritedPropertyVisibility(entityType, entityId);

  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited ?? [];
  const memberLookup = React.useMemo(() => {
    const map = new Map<string, (typeof members)[number]>();
    members.forEach((member) => {
      map.set(member.id, member);
      if (member.user_id) {
        map.set(member.user_id, member);
      }
    });
    return map;
  }, [members]);
  const selectedAssigneeId = direct?.assignee_id
    ? memberLookup.get(direct.assignee_id)?.user_id ?? "none"
    : "none";

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    addTagMutation.mutate(newTagInput.trim(), {
      onSuccess: () => setNewTagInput(""),
    });
  };

  const handleRemoveTag = (tag: string) => {
    removeTagMutation.mutate(tag);
  };

  const handleToggleInheritedVisibility = (sourceType: EntityType, sourceId: string, currentVisibility: boolean) => {
    setVisibility.mutate({
      sourceEntityType: sourceType,
      sourceEntityId: sourceId,
      isVisible: !currentVisibility,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Properties</DialogTitle>
          <DialogDescription>
            {entityTitle
              ? `Manage properties for "${entityTitle}"`
              : `Manage properties for this ${entityType.replace("_", " ")}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select
                value={direct?.status || "none"}
                onValueChange={(value) =>
                  setProperties.mutate({
                    status: value === "none" ? null : (value as Status),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-[var(--muted-foreground)]">None</span>
                  </SelectItem>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                          STATUS_COLORS[option.value]
                        )}
                      >
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <Select
                value={direct?.priority || "none"}
                onValueChange={(value) =>
                  setProperties.mutate({
                    priority: value === "none" ? null : (value as Priority),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-[var(--muted-foreground)]">None</span>
                  </SelectItem>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                          PRIORITY_COLORS[option.value]
                        )}
                      >
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assignee</Label>
              <Select
                value={selectedAssigneeId}
                onValueChange={(value) =>
                  setProperties.mutate({
                    assignee_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="flex items-center gap-2 text-[var(--muted-foreground)]">
                      <User className="h-4 w-4" />
                      Unassigned
                    </span>
                  </SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {member.name || member.email}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Due Date</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={direct?.due_date || ""}
                  onChange={(e) =>
                    setProperties.mutate({
                      due_date: e.target.value || null,
                    })
                  }
                  className="flex-1"
                />
                {direct?.due_date && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProperties.mutate({ due_date: null })}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tags</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {(direct?.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    <TagIcon className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-[var(--error)] transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag..."
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
            </div>

            {/* Inherited Properties */}
            {inherited.length > 0 && (
              <div className="pt-4 border-t border-[var(--border)] space-y-3">
                <h4 className="text-sm font-medium">Inherited Properties</h4>
                {inherited.map((inh) => (
                  <div
                    key={`${inh.source_entity_id}`}
                    className="space-y-2 p-3 rounded border border-dashed border-[var(--border)] bg-[var(--surface-hover)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--muted-foreground)]">
                        From: {inh.source_title}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleInheritedVisibility(
                            inh.source_entity_type,
                            inh.source_entity_id,
                            inh.visible
                          )
                        }
                        title={inh.visible ? "Hide inherited properties" : "Show inherited properties"}
                      >
                        {inh.visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-[var(--muted-foreground)]" />
                        )}
                      </Button>
                    </div>
                    {inh.visible && (
                      <div className="space-y-1 text-xs">
                        {inh.properties.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--muted-foreground)]">Status:</span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-1.5 py-0.5 font-medium",
                                STATUS_COLORS[inh.properties.status]
                              )}
                            >
                              {STATUS_OPTIONS.find((o) => o.value === inh.properties.status)?.label}
                            </span>
                          </div>
                        )}
                        {inh.properties.priority && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--muted-foreground)]">Priority:</span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-1.5 py-0.5 font-medium",
                                PRIORITY_COLORS[inh.properties.priority]
                              )}
                            >
                              {PRIORITY_OPTIONS.find((o) => o.value === inh.properties.priority)?.label}
                            </span>
                          </div>
                        )}
                        {inh.properties.due_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--muted-foreground)]">Due:</span>
                            <span>{new Date(inh.properties.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {inh.properties.tags && inh.properties.tags.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--muted-foreground)]">Tags:</span>
                            <span>{inh.properties.tags.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PropertyMenu;
