"use server";

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Test context for running outside of Next.js request scope
let testUserContext: { userId: string } | null = null;

// Set test user context (used by test harness)
export async function setTestUserContext(userId: string) {
  testUserContext = { userId };
}

// Clear test user context
export async function clearTestUserContext() {
  testUserContext = null;
}

/**
 * 🚀 Cached auth utilities - run once per request
 * These are safe to cache because they're scoped to a single server request
 */

export const getAuthenticatedUser = cache(async () => {
  // Check if running in test context first (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true';
  if (testUserContext && isTestEnvironment) {
    // In test mode, create a service client to fetch user data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseKey);
      const { data: { user }, error } = await serviceClient.auth.admin.getUserById(testUserContext.userId);
      if (error || !user) return null;
      return user;
    }
  }

  // Normal Next.js request flow
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (error) {
    // If createClient fails (not in request context), return null
    return null;
  }
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

