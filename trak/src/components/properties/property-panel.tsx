"use client";

// Universal Properties & Linking System - Property Panel Component
// Modal/panel for viewing and editing properties on an entity

import React, { useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Link2,
  Check,
  X,
  Calendar,
  Hash,
  Type,
  List,
  User,
  ChevronDown,
} from "lucide-react";
import {
  usePropertyDefinitions,
  useEntityPropertiesWithInheritance,
  useSetEntityProperty,
  useRemoveEntityProperty,
  useSetInheritedPropertyVisibility,
} from "@/lib/hooks/use-property-queries";
import { PropertyBadge } from "./property-badge";
import type {
  EntityType,
  PropertyDefinition,
  PropertyValue,
  PropertyOption,
  InheritedProperty,
} from "@/types/properties";

interface PropertyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  entityTitle?: string;
}

/**
 * Modal/panel for viewing and editing properties on an entity.
 * Shows direct properties with editors and inherited properties with visibility toggles.
 */
export function PropertyPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  workspaceId,
  entityTitle,
}: PropertyPanelProps) {
  const [addingProperty, setAddingProperty] = useState(false);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>("");

  const { data: definitions = [], isLoading: loadingDefinitions } =
    usePropertyDefinitions(workspaceId);

  const { data: propertiesResult, isLoading: loadingProperties } =
    useEntityPropertiesWithInheritance(entityType, entityId);

  const setProperty = useSetEntityProperty(entityType, entityId, workspaceId);
  const removeProperty = useRemoveEntityProperty(entityType, entityId);
  const setVisibility = useSetInheritedPropertyVisibility(entityType, entityId);

  const direct = propertiesResult?.direct ?? [];
  const inherited = propertiesResult?.inherited ?? [];

  // Properties that haven't been set on this entity yet
  const availableDefinitions = definitions.filter(
    (def) => !direct.some((p) => p.property_definition_id === def.id)
  );

  const handleAddProperty = useCallback(() => {
    if (!selectedDefinitionId) return;

    // Set default value based on type
    const definition = definitions.find((d) => d.id === selectedDefinitionId);
    if (!definition) return;

    let defaultValue: PropertyValue = null;
    switch (definition.type) {
      case "checkbox":
        defaultValue = false;
        break;
      case "multi_select":
        defaultValue = [];
        break;
      case "text":
        defaultValue = "";
        break;
    }

    setProperty.mutate({
      propertyDefinitionId: selectedDefinitionId,
      value: defaultValue,
    });

    setAddingProperty(false);
    setSelectedDefinitionId("");
  }, [selectedDefinitionId, definitions, setProperty]);

  const handlePropertyChange = useCallback(
    (definitionId: string, value: PropertyValue) => {
      setProperty.mutate({ propertyDefinitionId: definitionId, value });
    },
    [setProperty]
  );

  const handleRemoveProperty = useCallback(
    (definitionId: string) => {
      removeProperty.mutate(definitionId);
    },
    [removeProperty]
  );

  const handleToggleInheritedVisibility = useCallback(
    (prop: InheritedProperty) => {
      setVisibility.mutate({
        sourceEntityType: prop.source.entity_type,
        sourceEntityId: prop.source.entity_id,
        propertyDefinitionId: prop.property.property_definition_id,
        isVisible: !prop.is_visible,
      });
    },
    [setVisibility]
  );

  const isLoading = loadingDefinitions || loadingProperties;

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

        <div className="space-y-6">
          {/* Direct Properties */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--foreground)]">
              Direct Properties
            </h3>

            {isLoading ? (
              <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>
            ) : direct.length === 0 && !addingProperty ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                No properties set
              </div>
            ) : (
              <div className="space-y-2">
                {direct.map((prop) => (
                  <PropertyEditor
                    key={prop.id}
                    definition={prop.definition}
                    value={prop.value}
                    onChange={(value) =>
                      handlePropertyChange(prop.property_definition_id, value)
                    }
                    onRemove={() => handleRemoveProperty(prop.property_definition_id)}
                  />
                ))}
              </div>
            )}

            {/* Add Property */}
            {addingProperty ? (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedDefinitionId}
                  onValueChange={setSelectedDefinitionId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDefinitions.map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddProperty}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingProperty(false);
                    setSelectedDefinitionId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              availableDefinitions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingProperty(true)}
                  className="w-full justify-start text-[var(--muted-foreground)]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add property
                </Button>
              )
            )}
          </div>

          {/* Inherited Properties */}
          {inherited.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Inherited Properties
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Properties from linked entities. Toggle visibility for each.
              </p>

              <div className="space-y-2">
                {inherited.map((prop, index) => (
                  <div
                    key={`${prop.source.entity_id}-${prop.property.property_definition_id}-${index}`}
                    className="flex items-center justify-between gap-2 p-2 rounded border border-dashed border-[var(--border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <PropertyBadge
                        definition={prop.property.definition}
                        value={prop.property.value}
                        inherited
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleInheritedVisibility(prop)}
                      title={prop.is_visible ? "Hide property" : "Show property"}
                    >
                      {prop.is_visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Individual property editor row.
 */
function PropertyEditor({
  definition,
  value,
  onChange,
  onRemove,
}: {
  definition: PropertyDefinition;
  value: PropertyValue;
  onChange: (value: PropertyValue) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <Label className="w-24 truncate text-sm text-[var(--muted-foreground)]">
        {definition.name}
      </Label>
      <div className="flex-1">
        <PropertyValueEditor
          definition={definition}
          value={value}
          onChange={onChange}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove property"
      >
        <Trash2 className="h-4 w-4 text-[var(--error)]" />
      </Button>
    </div>
  );
}

/**
 * Property value editor based on property type.
 */
function PropertyValueEditor({
  definition,
  value,
  onChange,
}: {
  definition: PropertyDefinition;
  value: PropertyValue;
  onChange: (value: PropertyValue) => void;
}) {
  switch (definition.type) {
    case "text":
      return (
        <Input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter text..."
          className="h-8"
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.valueAsNumber || null)}
          placeholder="Enter number..."
          className="h-8"
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8"
        />
      );

    case "checkbox":
      return (
        <div className="flex items-center">
          <Checkbox
            checked={(value as boolean) ?? false}
            onCheckedChange={(checked) => onChange(!!checked)}
          />
        </div>
      );

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v || null)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(definition.options ?? []).map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      getOptionColorClass(option.color)
                    )}
                  />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select":
      return (
        <MultiSelectEditor
          options={definition.options ?? []}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      );

    case "person":
      // TODO: Add person picker from workspace members
      return (
        <Input
          type="text"
          value={Array.isArray(value) ? value.join(", ") : (value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Enter user ID..."
          className="h-8"
        />
      );

    default:
      return (
        <Input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="h-8"
        />
      );
  }
}

/**
 * Multi-select value editor.
 */
function MultiSelectEditor({
  options,
  value,
  onChange,
}: {
  options: PropertyOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedOptions = options.filter((opt) => value.includes(opt.id));

  const toggleOption = (optionId: string) => {
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm",
          "hover:bg-[var(--surface-hover)]"
        )}
      >
        <span className="flex items-center gap-1 flex-wrap min-h-[20px]">
          {selectedOptions.length === 0 ? (
            <span className="text-[var(--muted-foreground)]">Select...</span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-xs",
                  getOptionBgClass(opt.color)
                )}
              >
                {opt.label}
              </span>
            ))
          )}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-md">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleOption(option.id)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-sm",
                "hover:bg-[var(--surface-hover)]"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center",
                  value.includes(option.id)
                    ? "bg-[var(--primary)] border-[var(--primary)]"
                    : "border-[var(--border)]"
                )}
              >
                {value.includes(option.id) && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  getOptionColorClass(option.color)
                )}
              />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getOptionColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-500",
    red: "bg-red-500",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
  };
  return colorMap[color] ?? colorMap.gray;
}

function getOptionBgClass(color: string): string {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  };
  return colorMap[color] ?? colorMap.gray;
}

export default PropertyPanel;
