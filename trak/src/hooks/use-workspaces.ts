'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface Workspace {
  id: string;
  name: string;
  role: string;
}

/**
 * Client-side hook to fetch user's workspaces
 * Cached with React Query for instant navigation
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: ['userWorkspaces'],
    queryFn: async (): Promise<Workspace[]> => {
      const supabase = createClient();

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return [];
      }

      // Query all workspaces user is member of with role information
      const { data: memberships, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          workspaces!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching workspaces:', error);
        return [];
      }

      // Transform the data to include role at workspace level
      const workspaces = (memberships || []).map((membership: any) => ({
        id: membership.workspaces.id,
        name: membership.workspaces.name,
        role: membership.role,
      }));

      return workspaces;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
