export type WorkspaceRole = 'owner' | 'admin' | 'teammate'

interface EffectiveWorkspaceRoleInput {
  membershipRole?: WorkspaceRole | null
  ownerId?: string | null
  userId: string
}

export function getEffectiveWorkspaceRole({
  membershipRole,
  ownerId,
  userId,
}: EffectiveWorkspaceRoleInput): WorkspaceRole | null {
  if (ownerId && ownerId === userId) {
    return 'owner'
  }

  return membershipRole ?? null
}

export function canManageWorkspace(role?: WorkspaceRole | null) {
  return role === 'owner' || role === 'admin'
}
