import Link from "next/link";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAvailableProjectTemplates } from "@/app/actions/project-templates";
import { Button } from "@/components/ui/button";
import TemplatesPageClient, { type TemplateCard } from "./templates-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 5;

const TEMPLATE_ORDER = [
  "pr-package-tracking",
  "pop-up-planning",
  "product-development-design",
  "seasonal-drop-launch",
];

function normalizeTemplateName(name: string) {
  return name.replace(/\s+template$/i, "").trim();
}

function getTemplateCard(template: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  minimumPlan: "free" | "standard" | "business";
  isAvailable: boolean;
}): TemplateCard {
  const lookup = `${template.slug} ${template.name}`.toLowerCase();

  if (lookup.includes("influencer") || lookup.includes("seeding")) {
    return {
      id: template.id,
      actualName: template.name,
      title: "PR Package Tracking",
      projectName: "PR Package Tracking",
      description:
        "Track seeding outreach from package contents and ship dates through posted content, follow-ups, and campaign results.",
      labels: ["Outreach", "PR", "Gifting"],
      minimumPlan: template.minimumPlan,
      isAvailable: template.isAvailable,
      theme: "package",
      order: 0,
    };
  }

  if (lookup.includes("pop-up") || lookup.includes("popup")) {
    return {
      id: template.id,
      actualName: template.name,
      title: "Pop-Up Planning",
      projectName: "Pop-Up Planning",
      description:
        "Plan a pop-up end to end with venue logistics, vendor coordination, staffing, marketing, budget tracking, and day-of execution.",
      labels: ["Events", "Logistics", "Retail"],
      minimumPlan: template.minimumPlan,
      isAvailable: template.isAvailable,
      theme: "store",
      order: 1,
    };
  }

  if (
    (lookup.includes("product") && lookup.includes("development")) ||
    (lookup.includes("product") && lookup.includes("design"))
  ) {
    return {
      id: template.id,
      actualName: template.name,
      title: "Product Development & Design",
      projectName: "Product Development & Design",
      description:
        "Move a product from brief to launch prep with sampling rounds, costing, supplier handoff, QA notes, and approval checkpoints.",
      labels: ["Product", "Design", "Sourcing"],
      minimumPlan: template.minimumPlan,
      isAvailable: template.isAvailable,
      theme: "product",
      order: 2,
    };
  }

  if (lookup.includes("seasonal") || lookup.includes("multi-sku") || lookup.includes("drop")) {
    return {
      id: template.id,
      actualName: template.name,
      title: "Seasonal Drop / Multi-SKU Launch",
      projectName: "Seasonal Drop / Multi-SKU Launch",
      description:
        "Coordinate a launch across campaign brief, pinned products, creative deadlines, launch timing, and cross-functional go-live tasks.",
      labels: ["Launch", "Campaign", "Multi-SKU"],
      minimumPlan: template.minimumPlan,
      isAvailable: template.isAvailable,
      theme: "launch",
      order: 3,
    };
  }

  return {
    id: template.id,
    actualName: template.name,
    title: normalizeTemplateName(template.name),
    projectName: normalizeTemplateName(template.name),
    description:
      template.description?.trim() ||
      "Create a project from this starter structure and customize it for your team.",
    labels: [template.category ?? "Template"],
    minimumPlan: template.minimumPlan,
    isAvailable: template.isAvailable,
    theme: "neutral",
    order: TEMPLATE_ORDER.length,
  };
}

export default async function ProjectTemplatesPage() {
  const workspaceId = await getCurrentWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--tertiary-foreground)]">No workspace selected</p>
        </div>
      </div>
    );
  }

  const result = await getAvailableProjectTemplates(workspaceId);

  if ("error" in result) {
    return (
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const templates = result.data
    .map(getTemplateCard)
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));

  return <TemplatesPageClient workspaceId={workspaceId} templates={templates} />;
}
