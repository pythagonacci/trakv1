"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Bulk update multiple rows
 */
export async function bulkUpdateRows(
  rowIds: string[],
  updates: Record<string, any>
) {
  const supabase = await createClient();

  try {
    // Get current row data
    const { data: rows } = await supabase
      .from('table_rows')
      .select('id, data')
      .in('id', rowIds);

    if (!rows) throw new Error('Rows not found');

    // Update each row
    const promises = rows.map(row =>
      supabase
        .from('table_rows')
        .update({
          data: {
            ...row.data,
            ...updates,
          },
        })
        .eq('id', row.id)
    );

    await Promise.all(promises);

    return { error: null };
  } catch (error) {
    console.error('Error bulk updating rows:', error);
    return { error };
  }
}

/**
 * Bulk delete multiple rows
 */
export async function bulkDeleteRows(rowIds: string[]) {
  const supabase = await createClient();

  try {
    // Delete rows (cascades to relations via foreign keys)
    const { error } = await supabase
      .from('table_rows')
      .delete()
      .in('id', rowIds);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error bulk deleting rows:', error);
    return { error };
  }
}

/**
 * Bulk duplicate multiple rows
 */
export async function bulkDuplicateRows(rowIds: string[]) {
  const supabase = await createClient();

  try {
    // Get rows to duplicate
    const { data: rows } = await supabase
      .from('table_rows')
      .select('*')
      .in('id', rowIds);

    if (!rows) throw new Error('Rows not found');

    // Create duplicates
    const duplicates = rows.map(row => ({
      table_id: row.table_id,
      data: row.data,
      order: row.order + 0.1, // Insert after original
    }));

    const { error } = await supabase
      .from('table_rows')
      .insert(duplicates);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error bulk duplicating rows:', error);
    return { error };
  }
}