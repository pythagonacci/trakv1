"use server";

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * 🚀 Cached auth utilities - run once per request
 * These are safe to cache because they're scoped to a single server request
 */

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

export const checkWorkspaceMembership = cache(async (workspaceId: string, userId: string) => {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return membership;
});

export const getProjectMetadata = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', projectId)
    .single();
  return project;
});

export const getTabMetadata = cache(async (tabId: string) => {
  const supabase = await createClient();
  const { data: tab } = await supabase
    .from('tabs')
    .select('id, project_id, projects!inner(id, workspace_id)')
    .eq('id', tabId)
    .single();
  return tab;
});

/**
 * Verify user has access to a workspace
 * Returns membership or throws/redirects
 */
export async function requireWorkspaceAccess(workspaceId: string) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }
  
  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: 'Not a member of this workspace' };
  }
  
  return { user, membership };
}

/**
 * Verify user has access to a project (via workspace membership)
 */
export async function requireProjectAccess(projectId: string) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }
  
  const project = await getProjectMetadata(projectId);
  if (!project) {
    return { error: 'Project not found' };
  }
  
  const membership = await checkWorkspaceMembership(project.workspace_id, user.id);
  if (!membership) {
    return { error: 'Not a member of this workspace' };
  }
  
  return { user, membership, project };
}

