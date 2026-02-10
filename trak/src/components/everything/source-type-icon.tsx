import { Calendar, CheckSquare, Table, FileText } from "lucide-react";
import type { SourceType } from "@/types/everything";

interface SourceTypeIconProps {
  type: SourceType;
  className?: string;
}

export function SourceTypeIcon({ type, className = "h-4 w-4" }: SourceTypeIconProps) {
  switch (type) {
    case "timeline":
      return <Calendar className={className} />;
    case "task_list":
      return <CheckSquare className={className} />;
    case "table":
      return <Table className={className} />;
    case "block":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function getSourceTypeLabel(type: SourceType): string {
  const labels: Record<SourceType, string> = {
    timeline: "Timeline",
    task_list: "Task List",
    table: "Table",
    block: "Block",
  };
  return labels[type] || type;
}
