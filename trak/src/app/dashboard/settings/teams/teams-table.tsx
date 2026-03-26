"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound, UserPlus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { deleteTeam } from "@/app/actions/workspace-teams";
import type { WorkspaceTeam } from "@/app/actions/workspace-teams";
import CreateTeamDialog from "./create-team-dialog";
import EditTeamDialog from "./edit-team-dialog";

interface Member {
  id: string;
  email: string;
  name: string | null;
}

interface TeamsTableProps {
  workspaceId: string;
  teams: WorkspaceTeam[];
  members: Member[];
  canManage: boolean;
}

function getMemberDisplayName(members: Member[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.name || m.email.split("@")[0]) : "Unknown";
}

export default function TeamsTable({
  workspaceId,
  teams,
  members,
  canManage,
}: TeamsTableProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<WorkspaceTeam | null>(null);

  const handleDelete = async (team: WorkspaceTeam) => {
    if (!confirm(`Delete team "${team.name}"? This does not remove members from the workspace.`)) return;
    const result = await deleteTeam(team.id);
    if ("error" in result) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Groups of workspace members you can assign to tasks and other items
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90"
          >
            <UserPlus className="h-4 w-4" />
            Create Team
          </Button>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] mb-4">
              <UsersRound className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">No teams yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm">
              Create teams from your workspace members to assign groups to tasks in one click.
            </p>
            {canManage && (
              <Button
                onClick={() => setCreateOpen(true)}
                variant="outline"
                className="mt-4 gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Create your first team
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Members</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-sm text-[var(--muted-foreground)]">
                    {team.member_ids.length === 0
                      ? "—"
                      : team.member_ids
                          .map((id) => getMemberDisplayName(members, id))
                          .join(", ")}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTeam(team)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDelete(team)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {createOpen && (
        <CreateTeamDialog
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          workspaceId={workspaceId}
          members={members}
          onTeamCreated={() => router.refresh()}
        />
      )}

      {editingTeam && (
        <EditTeamDialog
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          team={editingTeam}
          members={members}
          onTeamUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}
