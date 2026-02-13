'use server'

import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'

/**
 * Get project members and permission mode
 * Returns whether project is "All" or has specific member restrictions
 */
export async function getProjectMembers(projectId: string) {
  const authResult = await getServerUser();
  if (!authResult) return { error: 'Unauthorized' };

  const { supabase, user } = authResult;

  // Verify user has access to the project
  const { data: project } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single();

  if (!project) return { error: 'Project not found' };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { error: 'Not a member of workspace' };

  // Check if project is restricted
  const { data: projectMembers } = await supabase
    .from('project_members')
    .select('user_id, created_at')
    .eq('project_id', projectId);

  const isRestricted = (projectMembers?.length ?? 0) > 0;

  if (!isRestricted) {
    return { data: { isAll: true, memberIds: [] } };
  }

  const memberIds = projectMembers?.map(pm => pm.user_id) || [];
  return { data: { isAll: false, memberIds } };
}

/**
 * Update project members
 * Restricted to admins and owners only
 */
export async function updateProjectMembers(projectId: string, memberIds: string[] | 'all') {
  const authResult = await getServerUser();
  if (!authResult) return { error: 'Unauthorized' };

  const { supabase, user } = authResult;

  // Verify user is admin/owner of workspace
  const { data: project } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single();

  if (!project) return { error: 'Project not found' };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Only admins and owners can manage project permissions' };
  }

  // Delete all existing project members
  await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId);

  // If 'all', we're done (no rows = all workspace members)
  if (memberIds === 'all') {
    await safeRevalidatePath('/dashboard');
    return { data: { success: true } };
  }

  // Handle edge case: empty array = convert to "All"
  if (memberIds.length === 0) {
    await safeRevalidatePath('/dashboard');
    return { data: { success: true, convertedToAll: true } };
  }

  // Validate member IDs are workspace members
  const { data: validMembers } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', project.workspace_id)
    .in('user_id', memberIds);

  const validUserIds = validMembers?.map(m => m.user_id) || [];

  if (validUserIds.length === 0) {
    return { error: 'No valid workspace members found' };
  }

  // Insert project members
  const projectMembersToInsert = validUserIds.map(userId => ({
    project_id: projectId,
    user_id: userId,
    added_by: user.id
  }));

  const { error } = await supabase
    .from('project_members')
    .insert(projectMembersToInsert);

  if (error) return { error: error.message };

  await safeRevalidatePath('/dashboard');
  return { data: { success: true } };
}
