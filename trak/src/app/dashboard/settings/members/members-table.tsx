"use client";

import { useState } from "react";
import { Crown, Shield, User, MoreVertical, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import InviteMemberDialog from "./invite-member-dialog";
import EditMemberDialog from "./edit-member-dialog";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "teammate";
}

interface MembersTableProps {
  workspaceId: string;
  members: Member[];
  canManage: boolean;
  currentUserId: string;
}

export default function MembersTable({
  workspaceId,
  members,
  canManage,
  currentUserId,
}: MembersTableProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3.5 w-3.5" />;
      case "admin":
        return <Shield className="h-3.5 w-3.5" />;
      default:
        return <User className="h-3.5 w-3.5" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-[var(--velvet-purple)]/15 text-[var(--velvet-purple)] border-[var(--velvet-purple)]/20";
      case "admin":
        return "bg-[var(--river-indigo)]/15 text-[var(--river-indigo)] border-[var(--river-indigo)]/20";
      default:
        return "bg-[var(--dome-teal)]/15 text-[var(--dome-teal)] border-[var(--dome-teal)]/20";
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Manage who has access to this workspace
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setInviteDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-md transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="rounded-md border border-[var(--border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="text-center py-8 text-[var(--muted-foreground)]">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const isCurrentUser = member.id === currentUserId;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--river-indigo)]/10 text-xs font-medium text-[var(--river-indigo)]">
                          {getInitials(member.name, member.email)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {member.name || member.email.split("@")[0]}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                                (You)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
                          getRoleBadgeColor(member.role)
                        )}
                      >
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <button
                          onClick={() => setEditingMember(member)}
                          disabled={isCurrentUser}
                          className={cn(
                            "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                            isCurrentUser
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-[var(--surface-hover)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          )}
                          title={isCurrentUser ? "You cannot edit yourself" : "Edit member"}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {inviteDialogOpen && (
        <InviteMemberDialog
          workspaceId={workspaceId}
          isOpen={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
        />
      )}

      {editingMember && (
        <EditMemberDialog
          workspaceId={workspaceId}
          member={editingMember}
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
