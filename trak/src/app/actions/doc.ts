"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AuthContext } from "@/lib/auth-context";

// Types
export type Doc = {
  id: string;
  workspace_id: string;
  title: string;
  content: any; // ProseMirror JSON
  created_by: string;
  created_at: string;
  updated_at: string;
  last_edited_by: string | null;
  is_archived: boolean;
};

type DocFilters = {
  search?: string;
  is_archived?: boolean;
  sort_by?: "created_at" | "updated_at" | "title";
  sort_order?: "asc" | "desc";
};

/**
 * Get all docs for a workspace
 */
export async function getAllDocs(workspaceId: string, filters?: DocFilters) {
  const supabase = await createClient();

  try {
    // SECURITY: Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: "Unauthorized" };
    }

    // SECURITY: Verify user is a member of this workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this workspace" };
    }

    let query = supabase
      .from("docs")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Apply filters
    if (filters?.is_archived !== undefined) {
      query = query.eq("is_archived", filters.is_archived);
    } else {
      query = query.eq("is_archived", false);
    }

    if (filters?.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }

    // Apply sorting
    const sortBy = filters?.sort_by || "updated_at";
    const sortOrder = filters?.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching docs:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getAllDocs:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Get a single doc by ID
 */
export async function getSingleDoc(docId: string) {
  const supabase = await createClient();

  try {
    // SECURITY: Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: "Unauthorized" };
    }

    // First, get the doc to find its workspace
    const { data: doc, error } = await supabase
      .from("docs")
      .select("*")
      .eq("id", docId)
      .single();

    if (error) {
      console.error("Error fetching doc:", error);
      return { data: null, error: error.message };
    }

    if (!doc) {
      return { data: null, error: "Document not found" };
    }

    // SECURITY: Verify user is a member of the doc's workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this document" };
    }

    return { data: doc, error: null };
  } catch (error: any) {
    console.error("Error in getSingleDoc:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Create a new doc
 */
export async function createDoc(workspaceId: string, title?: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };
    userId = user.id;
  }

  try {
    // SECURITY: Verify user is a member of this workspace before creating
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this workspace" };
    }

    const { data, error } = await supabase
      .from("docs")
      .insert({
        workspace_id: workspaceId,
        title: title || "Untitled Document",
        created_by: userId,
        last_edited_by: userId,
        content: {
          type: "doc",
          content: [{ type: "paragraph" }],
        },
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating doc:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/docs");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in createDoc:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Update a doc
 */
export async function updateDoc(
  docId: string,
  updates: {
    title?: string;
    content?: any;
    is_archived?: boolean;
  },
  opts?: { authContext?: AuthContext }
) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };
    userId = user.id;
  }

  try {
    // SECURITY: First get the doc to find its workspace
    const { data: doc } = await supabase
      .from("docs")
      .select("workspace_id")
      .eq("id", docId)
      .single();

    if (!doc) {
      return { data: null, error: "Document not found" };
    }

    // SECURITY: Verify user is a member of the doc's workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this document" };
    }

    const { data, error } = await supabase
      .from("docs")
      .update({
        ...updates,
        last_edited_by: userId,
      })
      .eq("id", docId)
      .select()
      .single();

    if (error) {
      console.error("Error updating doc:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/docs");
    revalidatePath(`/dashboard/docs/${docId}`);
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in updateDoc:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Delete a doc
 */
export async function deleteDoc(docId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    userId = user.id;
  }

  try {

    // SECURITY: First get the doc to find its workspace
    const { data: doc } = await supabase
      .from("docs")
      .select("workspace_id")
      .eq("id", docId)
      .single();

    if (!doc) {
      return { error: "Document not found" };
    }

    // SECURITY: Verify user is a member of the doc's workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !membership) {
      return { error: "You don't have access to this document" };
    }

    const { error } = await supabase.from("docs").delete().eq("id", docId);

    if (error) {
      console.error("Error deleting doc:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard/docs");
    return { error: null };
  } catch (error: any) {
    console.error("Error in deleteDoc:", error);
    return { error: error.message };
  }
}




