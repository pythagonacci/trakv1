"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Package,
  PencilRuler,
  Store,
} from "lucide-react";
import { createProjectFromTemplate } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { buildProjectPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";
import Toast from "../toast";

type TemplateTheme = "package" | "store" | "product" | "launch" | "neutral";

export interface TemplateCard {
  id: string;
  actualName: string;
  title: string;
  projectName: string;
  description: string;
  labels: string[];
  minimumPlan: "free" | "standard" | "business";
  isAvailable: boolean;
  theme: TemplateTheme;
  order: number;
}

interface TemplatesPageClientProps {
  workspaceId: string;
  templates: TemplateCard[];
}

function TemplateGlyph({ theme }: { theme: TemplateTheme }) {
  const iconClassName = "h-4 w-4";

  switch (theme) {
    case "package":
      return <Package className={iconClassName} />;
    case "store":
      return <Store className={iconClassName} />;
    case "product":
      return <PencilRuler className={iconClassName} />;
    case "launch":
      return <BarChart3 className={iconClassName} />;
    default:
      return <Package className={iconClassName} />;
  }
}

const themeStyles: Record<
  TemplateTheme,
  { icon: string; ring: string; badge: string }
> = {
  package: {
    icon: "bg-[#eaf3ff] text-[#24507a]",
    ring: "hover:border-[#a9c4df] hover:bg-[#fdfefe]",
    badge: "border-[#d8e6f4] bg-[#f7fbff] text-[#456885]",
  },
  store: {
    icon: "bg-[#fff1ea] text-[#b9673a]",
    ring: "hover:border-[#e2c0ad] hover:bg-[#fffdfb]",
    badge: "border-[#f0ddd4] bg-[#fff8f4] text-[#9d6648]",
  },
  product: {
    icon: "bg-[#edf6ef] text-[#3b7346]",
    ring: "hover:border-[#b8d0be] hover:bg-[#fcfefd]",
    badge: "border-[#dce9df] bg-[#f7fbf8] text-[#55775c]",
  },
  launch: {
    icon: "bg-[#f6f1e6] text-[#8a6b2e]",
    ring: "hover:border-[#d8caac] hover:bg-[#fffefb]",
    badge: "border-[#ebe2d0] bg-[#fbf8f0] text-[#826c3f]",
  },
  neutral: {
    icon: "bg-[var(--surface-hover)] text-[var(--foreground)]",
    ring: "hover:border-[var(--border-strong)] hover:bg-[var(--surface)]",
    badge: "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
  },
};

function formatPlan(plan: TemplateCard["minimumPlan"]) {
  if (plan === "standard") return "Standard";
  if (plan === "business") return "Business";
  return "Free";
}

export default function TemplatesPageClient({
  workspaceId,
  templates,
}: TemplatesPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleUseTemplate = (template: TemplateCard) => {
    if (!template.isAvailable || isPending) return;

    setPendingTemplateId(template.id);

    startTransition(async () => {
      const result = await createProjectFromTemplate(workspaceId, {
        name: template.projectName,
        template_id: template.id,
      });

      if ("error" in result) {
        setPendingTemplateId(null);
        setToast({ message: result.error ?? "Failed to create project", type: "error" });
        return;
      }

      const createdProject = result.data as { id: string; name: string };
      router.push(buildProjectPath(createdProject.id, createdProject.name || template.projectName));
    });
  };

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">
              Templates
            </h2>
            <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
              Start from a pre-built Trak workflow and create your own editable project in one click.
            </p>
          </div>

          <Button asChild variant="outline" size="sm" className="rounded-[2px]">
            <Link href="/dashboard/projects">Back to projects</Link>
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">No templates available</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Project templates have not been enabled for this workspace yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tertiary-foreground)]">
              Templates
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:max-w-5xl">
              {templates.map((template) => {
                const styles = themeStyles[template.theme];
                const isCreating = pendingTemplateId === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleUseTemplate(template)}
                    disabled={!template.isAvailable || isPending}
                    className={cn(
                      "group flex h-full flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all",
                      styles.ring,
                      template.isAvailable
                        ? "cursor-pointer shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                        : "cursor-not-allowed opacity-65"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-[4px] border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
                          styles.icon
                        )}
                      >
                        <TemplateGlyph theme={template.theme} />
                      </div>

                      {!template.isAvailable ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                          {formatPlan(template.minimumPlan)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 space-y-2">
                      <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                        {template.title}
                      </h2>
                      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                        {template.description}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {template.labels.map((label) => (
                        <span
                          key={`${template.id}-${label}`}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            styles.badge
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs">
                      <span className="text-[var(--tertiary-foreground)]">
                        {template.isAvailable
                          ? `Uses ${template.actualName.replace(/\s+template$/i, "")}`
                          : `Requires ${formatPlan(template.minimumPlan)}`}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--primary)] transition-transform group-hover:translate-x-0.5">
                        {isCreating ? "Creating..." : template.isAvailable ? "Use template" : "Unavailable"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </>
  );
}
