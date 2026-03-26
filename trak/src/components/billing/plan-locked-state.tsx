import Link from "next/link";

export default function PlanLockedState(props: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6 py-12">
      <div className="max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] text-xl">
          Locked
        </div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{props.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{props.description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard/settings?tab=general"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--river-indigo)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--river-indigo)]/90"
          >
            Update plan
          </Link>
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
