'use server'

import { createServiceClient } from '@/lib/supabase/service'

export type InviteInfo = {
  email: string
  workspaceName: string
  role: string
  expired: boolean
} | null

export async function getInviteByToken(token: string): Promise<InviteInfo> {
  if (!token?.trim()) return null
  const supabase = await createServiceClient()
  const { data: invite, error } = await supabase
    .from('workspace_invitations')
    .select('id, email, role, expires_at, workspace_id')
    .eq('token', token.trim())
    .maybeSingle()

  if (error || !invite) return null

  let workspaceName = 'Unknown'
  if (invite.workspace_id) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', invite.workspace_id)
      .single()
    if (ws?.name) workspaceName = ws.name
  }

  const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0
  const expired = Date.now() > expiresAt

  return {
    email: invite.email,
    workspaceName,
    role: invite.role,
    expired,
  }
}
