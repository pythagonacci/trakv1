"use server";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerUser } from "@/lib/auth/get-server-user";
import { resolveUserDisplayName, resolveUserFirstName } from "@/lib/user-display";

export async function logout() {
  const authResult = await getServerUser();
  
  // If no active session, redirect to login
  if (!authResult) {
    redirect("/login");
  }

  const { supabase } = authResult;
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { error: error.message };
  }
  
  redirect("/login");
}

// Cache this to prevent redundant auth checks in the same request
export const getCurrentUser = cache(async () => {
  const authResult = await getServerUser();
  
  if (!authResult) {
    return { error: "Not authenticated" };
  }
  const { user, supabase } = authResult;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  
  return { 
    data: {
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
    }
  };
});
