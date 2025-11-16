"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function logout() {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { error: error.message };
  }
  
  redirect("/login");
}

// Cache this to prevent redundant auth checks in the same request
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: "Not authenticated" };
  }
  
  return { 
    data: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User"
    }
  };
});