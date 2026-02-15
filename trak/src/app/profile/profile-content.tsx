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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)] mb-2">
                Your Workspaces
              </h1>
              <p className="text-[var(--muted-foreground)]">
                {user.email}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspaces Table */}
        {workspaces.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No workspaces yet
            </h3>
            <p className="text-[var(--muted-foreground)] mb-6">
              Create your first workspace to get started.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Workspace
            </Button>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <Table className="[&_th]:px-4 [&_th]:py-3.5 [&_th]:h-12 [&_td]:px-4 [&_td]:py-4">
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
                      "cursor-pointer hover:bg-[var(--surface-hover)]",
                      isPending && "opacity-50 pointer-events-none"
                    )}
                    onClick={() => handleWorkspaceClick(workspace)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-sm font-semibold">
                          {getInitials(workspace.name)}
                        </div>
                        <span className="text-base font-semibold text-[var(--foreground)]">
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
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/20 rounded-md">
                          <Check className="h-3.5 w-3.5 text-[var(--dome-teal)]" />
                          <span className="text-xs font-medium text-[var(--dome-teal)]">Owner</span>
                        </div>
                      )}
                      {workspace.role === 'admin' && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/20 rounded-md">
                          <span className="text-xs font-medium text-[var(--river-indigo)]">Admin</span>
                        </div>
                      )}
                      {workspace.role === 'teammate' && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--muted)]/10 border border-[var(--border)] rounded-md">
                          <span className="text-xs font-medium text-[var(--muted-foreground)]">Teammate</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
