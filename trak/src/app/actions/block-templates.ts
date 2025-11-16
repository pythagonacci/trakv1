"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Get all template blocks for the current workspace
 */
export async function getTemplateBlocks(workspaceId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .select(`
        *,
        tab:tabs!blocks_tab_id_fkey(
          id,
          name,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            workspace_id
          )
        )
      `)
      .eq("is_template", true)
      .eq("tab.project.workspace_id", workspaceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching template blocks:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getTemplateBlocks:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Mark a block as a template
 */
export async function makeBlockTemplate(blockId: string, templateName?: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .update({
        is_template: true,
        template_name: templateName || null,
      })
      .eq("id", blockId)
      .select()
      .single();

    if (error) {
      console.error("Error making block template:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in makeBlockTemplate:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Remove template status from a block
 */
export async function removeBlockTemplate(blockId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .update({
        is_template: false,
        template_name: null,
      })
      .eq("id", blockId)
      .select()
      .single();

    if (error) {
      console.error("Error removing block template:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in removeBlockTemplate:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Get a single block (for referencing)
 */
export async function getSingleBlock(blockId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .select(`
        *,
        tab:tabs!blocks_tab_id_fkey(
          id,
          name,
          project_id,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            project_type
          )
        )
      `)
      .eq("id", blockId)
      .single();

    if (error) {
      console.error("Error fetching block:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getSingleBlock:", error);
    return { data: null, error: error.message };
  }
}

