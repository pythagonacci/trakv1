"use client";

import { useRouter } from "next/navigation";
import { 
  Folder, 
  FileText, 
  CheckSquare, 
  Clock,
  ArrowRight,
  Users,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  project_type: string;
  updated_at: string;
}

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

interface Task {
  id: string;
  text: string;
  projectName: string;
  tabName: string;
  projectId: string;
  tabId: string;
}

interface DashboardOverviewProps {
  projects: Project[];
  docs: Doc[];
  tasks: Task[];
  workspaceId: string;
}

export default function DashboardOverview({ projects, docs, tasks }: DashboardOverviewProps) {
  const router = useRouter();

  const activeProjects = projects.filter(p => p.status !== 'complete' && p.project_type === 'project');
  const internalSpaces = projects.filter(p => p.project_type === 'internal');

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
          {greeting}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Stats - Minimal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Projects"
          value={activeProjects.length}
          onClick={() => router.push("/dashboard/projects")}
        />
        <StatCard
          label="Open Tasks"
          value={tasks.length}
        />
        <StatCard
          label="Documents"
          value={docs.length}
          onClick={() => router.push("/dashboard/docs")}
        />
        <StatCard
          label="Internal Spaces"
          value={internalSpaces.length}
          onClick={() => router.push("/dashboard/internal")}
        />
      </div>

      {/* Main Content - Flowing Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Tasks & Projects */}
        <div className="lg:col-span-3 space-y-6">
          {/* Open Tasks */}
          {tasks.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--foreground)]">Tasks</h2>
                <span className="text-xs text-[var(--tertiary-foreground)]">
                  {tasks.length} open
                </span>
              </div>
              <div className="space-y-1">
                {tasks.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}`)}
                    className="group flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                  >
                    <div className="mt-0.5">
                      <div className="h-3.5 w-3.5 rounded border border-[var(--border)] group-hover:border-[var(--foreground)] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] line-clamp-1 leading-snug">{task.text}</p>
                      <p className="text-xs text-[var(--tertiary-foreground)] mt-0.5">
                        {task.projectName} · {task.tabName}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--tertiary-foreground)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active Projects */}
          {activeProjects.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--foreground)]">Projects</h2>
                <button
                  onClick={() => router.push("/dashboard/projects")}
                  className="text-xs text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="space-y-1">
                {activeProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                  >
                    <Folder className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] truncate leading-snug">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--tertiary-foreground)] mt-0.5">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--tertiary-foreground)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Recent Docs */}
        <div className="lg:col-span-2">
          {docs.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--foreground)]">Recent</h2>
                <button
                  onClick={() => router.push("/dashboard/docs")}
                  className="text-xs text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="space-y-1">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/dashboard/docs/${doc.id}`)}
                    className="group flex items-center gap-2.5 rounded-md px-3 py-2.5 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                  >
                    <FileText className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] truncate leading-snug">{doc.title}</p>
                      <p className="text-xs text-[var(--tertiary-foreground)] mt-0.5">
                        {new Date(doc.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--tertiary-foreground)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && activeProjects.length === 0 && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-[var(--foreground)]">Nothing here yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Get started by creating your first project, document, or internal space.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  onClick?: () => void;
}

function StatCard({ label, value, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group text-left px-4 py-3 rounded-md border border-transparent transition-colors",
        onClick 
          ? "hover:border-[var(--border)] hover:bg-[var(--surface)] cursor-pointer" 
          : "cursor-default"
      )}
    >
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">{value}</p>
        <p className="text-xs text-[var(--tertiary-foreground)]">{label}</p>
      </div>
    </button>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

