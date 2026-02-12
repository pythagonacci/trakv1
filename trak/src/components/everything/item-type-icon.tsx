import { Calendar, CheckSquare, Table, FileText } from "lucide-react";
import type { EntityType } from "@/types/properties";

interface ItemTypeIconProps {
  type: EntityType;
  className?: string;
}

export function ItemTypeIcon({ type, className = "h-4 w-4" }: ItemTypeIconProps) {
  switch (type) {
    case "timeline_event":
      return <Calendar className={className} />;
    case "task":
      return <CheckSquare className={className} />;
    case "subtask":
      return <CheckSquare className={className} />;
    case "table_row":
      return <Table className={className} />;
    case "block":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function getEntityTypeLabel(type: EntityType): string {
  const labels: Record<EntityType, string> = {
    timeline_event: "Timeline Event",
    task: "Task",
    subtask: "Subtask",
    table_row: "Table Row",
    block: "Block",
  };
  return labels[type] || type;
}
