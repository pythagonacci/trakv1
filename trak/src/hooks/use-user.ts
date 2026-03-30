'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { resolveUserDisplayName, resolveUserFirstName } from '@/lib/user-display';

interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
}

/**
 * Client-side hook to fetch current user
 * Cached with React Query for instant navigation
 */
export function useUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async (): Promise<User | null> => {
      const supabase = createClient();

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      return {
        id: user.id,
        email: user.email || "",
        name: resolveUserDisplayName({
          profileName: profile?.name,
          userMetadata: user.user_metadata,
          email: user.email,
        }),
        firstName: resolveUserFirstName({
          profileName: profile?.name,
          userMetadata: user.user_metadata,
          email: user.email,
        }),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on every focus
    refetchOnMount: false, // Don't refetch on every mount if cached
  });
}
