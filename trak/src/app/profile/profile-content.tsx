"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { updateCurrentWorkspace } from "@/app/actions/workspace";
import CreateWorkspaceDialog from "./create-workspace-dialog";

interface Workspace {
  id: string;
  name: string;
  role: string;
  owner_id: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
}

interface ProfileContentProps {
  user: User;
  initialWorkspaces: Workspace[];
}

export default function ProfileContent({ user, initialWorkspaces }: ProfileContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleWorkspaceCreated = (newWorkspace: Workspace) => {
    setWorkspaces([...workspaces, newWorkspace]);
  };

  const handleWorkspaceClick = async (workspace: Workspace) => {
    // Update the workspace cookie
    await updateCurrentWorkspace(workspace.id);

    // Navigate to dashboard with transition
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto px-2 py-4 md:px-3 lg:px-4 lg:py-5">
        {/* Header - matches dashboard/projects and workflow page */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">
                Your Workspaces
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {user.email}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspaces Table - same UI as projects table (no card, same table styling) */}
        {workspaces.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-8 py-14 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[2px] border border-[var(--river-indigo)]/20 bg-[var(--river-indigo)]/10 text-[var(--river-indigo)]">
              <Building2 className="h-7 w-7" />
            </div>
            <h3 className="mb-1.5 text-[15px] font-semibold text-[var(--foreground)]">No workspaces yet</h3>
            <p className="mb-4 max-w-sm text-[12px] text-[var(--muted-foreground)]">
              Create your first workspace to get started.
            </p>
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-[2px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          </div>
        ) : (
          <Table className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:h-10 [&_td]:px-3 [&_td]:py-2.5">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Workspace
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Role
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((workspace) => (
                <TableRow
                  key={workspace.id}
                  className={cn(
                    "cursor-pointer",
                    isPending && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => handleWorkspaceClick(workspace)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-sm font-semibold">
                        {getInitials(workspace.name)}
                      </div>
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {workspace.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {workspace.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {workspace.role === 'owner' && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/20 rounded-md">
                        <Check className="h-3.5 w-3.5 text-[var(--dome-teal)]" />
                        <span className="text-xs font-medium text-[var(--dome-teal)]">Owner</span>
                      </div>
                    )}
                    {workspace.role === 'admin' && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/20 rounded-md">
                        <span className="text-xs font-medium text-[var(--river-indigo)]">Admin</span>
                      </div>
                    )}
                    {workspace.role === 'teammate' && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--muted)]/10 border border-[var(--border)] rounded-md">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Teammate</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateWorkspaceDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
