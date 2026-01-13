"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Create a relation field (and optionally a bidirectional reverse field)
 */
export async function createRelationField(
  tableId: string,
  fieldName: string,
  config: {
    relation_table_id: string;
    relation_type: 'one_to_many' | 'many_to_many';
    bidirectional: boolean;
    display_field_id?: string;
  }
) {
  const supabase = await createClient();

  try {
    // 1. Create the relation field in table_fields
    const { data: field, error: fieldError } = await supabase
      .from('table_fields')
      .insert({
        table_id: tableId,
        name: fieldName,
        type: 'relation',
        config: {
          relation_table_id: config.relation_table_id,
          relation_type: config.relation_type,
          bidirectional: config.bidirectional,
          display_field_id: config.display_field_id,
          allow_multiple: config.relation_type === 'many_to_many',
        },
      })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // 2. If bidirectional, create reverse field in related table
    let reverseField = null;
    if (config.bidirectional) {
      const reverseName = `Related ${fieldName}`; // Or get from user input

      const { data: reverse, error: reverseError } = await supabase
        .from('table_fields')
        .insert({
          table_id: config.relation_table_id,
          name: reverseName,
          type: 'relation',
          config: {
            relation_table_id: tableId,
            relation_type: config.relation_type === 'one_to_many' ? 'many_to_one' : 'many_to_many',
            bidirectional: true,
            reverse_field_id: field.id,
            allow_multiple: config.relation_type !== 'one_to_many',
          },
        })
        .select()
        .single();

      if (reverseError) throw reverseError;
      reverseField = reverse;

      // Update original field with reverse field ID
      await supabase
        .from('table_fields')
        .update({
          config: {
            ...field.config,
            reverse_field_id: reverse.id,
          },
        })
        .eq('id', field.id);
    }

    return { field, reverseField, error: null };
  } catch (error) {
    console.error('Error creating relation field:', error);
    return { field: null, reverseField: null, error };
  }
}

/**
 * Link rows together (create relation)
 */
export async function linkRows(
  fromTableId: string,
  fromFieldId: string,
  fromRowId: string,
  toRowIds: string[] // Array to support multiple links
) {
  const supabase = await createClient();

  try {
    // 1. Get field config to check if bidirectional
    const { data: field } = await supabase
      .from('table_fields')
      .select('config, table_id')
      .eq('id', fromFieldId)
      .single();

    if (!field) throw new Error('Field not found');
    const config = field.config as any;
    const toTableId = config.relation_table_id;

    // 2. Insert records into table_relations
    const relations = toRowIds.map(toRowId => ({
      workspace_id: field.table_id, // This should be the workspace_id, but we need to get it
      from_table_id: fromTableId,
      from_field_id: fromFieldId,
      from_row_id: fromRowId,
      to_table_id: toTableId,
      to_row_id: toRowId,
    }));

    const { error: relError } = await supabase
      .from('table_relations')
      .insert(relations);

    if (relError) throw relError;

    // 3. Update row data JSONB to include linked row IDs (for faster reads)
    const { data: existingRow } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', fromRowId)
      .single();

    const existingLinks = (existingRow?.data?.[fromFieldId] || []) as string[];
    const updatedLinks = [...new Set([...existingLinks, ...toRowIds])];

    await supabase
      .from('table_rows')
      .update({
        data: {
          ...existingRow?.data,
          [fromFieldId]: updatedLinks,
        },
      })
      .eq('id', fromRowId);

    // 4. If bidirectional, create reverse links
    if (config.bidirectional && config.reverse_field_id) {
      for (const toRowId of toRowIds) {
        // Add reverse relation records
        await supabase.from('table_relations').insert({
          workspace_id: toTableId, // This should be the workspace_id for the target table
          from_table_id: toTableId,
          from_field_id: config.reverse_field_id,
          from_row_id: toRowId,
          to_table_id: fromTableId,
          to_row_id: fromRowId,
        });

        // Update reverse row JSONB
        const { data: toRow } = await supabase
          .from('table_rows')
          .select('data')
          .eq('id', toRowId)
          .single();

        const toLinks = (toRow?.data?.[config.reverse_field_id] || []) as string[];
        await supabase
          .from('table_rows')
          .update({
            data: {
              ...toRow?.data,
              [config.reverse_field_id]: [...new Set([...toLinks, fromRowId])],
            },
          })
          .eq('id', toRowId);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error linking rows:', error);
    return { error };
  }
}

/**
 * Unlink rows (remove relation)
 */
export async function unlinkRows(
  fromRowId: string,
  fromFieldId: string,
  toRowIds: string[]
) {
  const supabase = await createClient();

  try {
    // 1. Get field config
    const { data: field } = await supabase
      .from('table_fields')
      .select('config, table_id')
      .eq('id', fromFieldId)
      .single();

    if (!field) throw new Error('Field not found');
    const config = field.config as any;

    // 2. Delete from table_relations
    await supabase
      .from('table_relations')
      .delete()
      .eq('from_row_id', fromRowId)
      .eq('from_field_id', fromFieldId)
      .in('to_row_id', toRowIds);

    // 3. Update row data JSONB
    const { data: row } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', fromRowId)
      .single();

    const existingLinks = (row?.data?.[fromFieldId] || []) as string[];
    const updatedLinks = existingLinks.filter(id => !toRowIds.includes(id));

    await supabase
      .from('table_rows')
      .update({
        data: {
          ...row?.data,
          [fromFieldId]: updatedLinks,
        },
      })
      .eq('id', fromRowId);

    // 4. If bidirectional, remove reverse links
    if (config.bidirectional && config.reverse_field_id) {
      for (const toRowId of toRowIds) {
        await supabase
          .from('table_relations')
          .delete()
          .eq('from_row_id', toRowId)
          .eq('from_field_id', config.reverse_field_id)
          .eq('to_row_id', fromRowId);

        const { data: toRow } = await supabase
          .from('table_rows')
          .select('data')
          .eq('id', toRowId)
          .single();

        const toLinks = (toRow?.data?.[config.reverse_field_id] || []) as string[];
        await supabase
          .from('table_rows')
          .update({
            data: {
              ...toRow?.data,
              [config.reverse_field_id]: toLinks.filter(id => id !== fromRowId),
            },
          })
          .eq('id', toRowId);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error unlinking rows:', error);
    return { error };
  }
}

/**
 * Get related rows for a given row and field
 */
export async function getRelatedRows(
  rowId: string,
  fieldId: string
): Promise<{ rows: any[]; error: any }> {
  const supabase = await createClient();

  try {
    // 1. Get linked row IDs from table_relations
    const { data: relations, error: relError } = await supabase
      .from('table_relations')
      .select('to_row_id, to_table_id')
      .eq('from_row_id', rowId)
      .eq('from_field_id', fieldId);

    if (relError) throw relError;
    if (!relations || relations.length === 0) return { rows: [], error: null };

    const toRowIds = relations.map(r => r.to_row_id);
    const toTableId = relations[0].to_table_id;

    // 2. Fetch full row data for linked rows
    const { data: rows, error: rowsError } = await supabase
      .from('table_rows')
      .select('*')
      .eq('table_id', toTableId)
      .in('id', toRowIds);

    if (rowsError) throw rowsError;

    return { rows: rows || [], error: null };
  } catch (error) {
    console.error('Error getting related rows:', error);
    return { rows: [], error };
  }
}