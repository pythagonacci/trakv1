'use server'

import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'
import type { AuthContext } from '@/lib/auth-context'

export type ActionResult<T> = { data: T } | { error: string }

export interface InternalSpaceGroup {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export async function createInternalGroup(
  workspaceId: string,
  name: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<InternalSpaceGroup>> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) return { error: 'You must be a workspace member to create groups' }

  const { data: maxGroup } = await supabase
    .from('internal_space_groups')
    .select('position')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newPosition = maxGroup ? maxGroup.position + 1 : 0

  const { data: group, error: createError } = await supabase
    .from('internal_space_groups')
    .insert({ workspace_id: workspaceId, name: name.trim(), position: newPosition })
    .select()
    .single()

  if (createError) return { error: createError.message }

  await safeRevalidatePath('/dashboard/internal')
  return { data: group }
}

export async function getAllInternalGroups(workspaceId: string): Promise<ActionResult<InternalSpaceGroup[]>> {
  const authResult = await getServerUser()
  if (!authResult) return { error: 'Unauthorized' }
  const { supabase, user } = authResult

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to view groups' }

  const { data: groups, error } = await supabase
    .from('internal_space_groups')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  if (error) return { error: error.message }
  return { data: groups || [] }
}

export async function deleteInternalGroup(
  groupId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const { data: group, error: groupError } = await supabase
    .from('internal_space_groups')
    .select('workspace_id')
    .eq('id', groupId)
    .single()

  if (groupError || !group) return { error: 'Group not found' }

  let uid: string
  if (opts?.authContext) uid = opts.authContext.userId
  else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    uid = authResult.user.id
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', uid)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to delete groups' }

  const { error: deleteError } = await supabase
    .from('internal_space_groups')
    .delete()
    .eq('id', groupId)

  if (deleteError) return { error: deleteError.message }

  await safeRevalidatePath('/dashboard/internal')
  return { data: null }
}

export async function moveSpaceToGroup(
  spaceId: string,
  groupId: string | null,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('workspace_id, project_type')
    .eq('id', spaceId)
    .single()

  if (projectError || !project) return { error: 'Space not found' }
  if (project.project_type !== 'internal') return { error: 'Not an internal space' }

  if (groupId) {
    const { data: grp, error: groupError } = await supabase
      .from('internal_space_groups')
      .select('workspace_id')
      .eq('id', groupId)
      .single()

    if (groupError || !grp || grp.workspace_id !== project.workspace_id) return { error: 'Group not found' }
  }

  let uid: string
  if (opts?.authContext) uid = opts.authContext.userId
  else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    uid = authResult.user.id
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', uid)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to move spaces' }

  const { error: updateError } = await supabase
    .from('projects')
    .update({ internal_group_id: groupId, updated_at: new Date().toISOString() })
    .eq('id', spaceId)

  if (updateError) return { error: updateError.message }

  await safeRevalidatePath('/dashboard/internal')
  return { data: null }
}
