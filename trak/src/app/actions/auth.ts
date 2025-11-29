"use server";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerUser } from "@/lib/auth/get-server-user";

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
  const { user } = authResult;
  
  return { 
    data: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User"
    }
  };
});
