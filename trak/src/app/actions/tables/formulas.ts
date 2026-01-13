"use server";

import { createClient } from "@/lib/supabase/server";
import { evaluateFormula, extractDependencies } from "@/lib/formula-parser";

/**
 * Create a formula field
 */
export async function createFormulaField(
  tableId: string,
  fieldName: string,
  config: {
    formula: string;
    return_type: 'number' | 'text' | 'boolean' | 'date';
  }
) {
  const supabase = await createClient();

  try {
    // 1. Get all fields to extract dependencies
    const { data: fields } = await supabase
      .from('table_fields')
      .select('*')
      .eq('table_id', tableId);

    if (!fields) throw new Error('Could not load fields');

    // 2. Extract dependencies from formula
    const dependencies = extractDependencies(config.formula, fields);

    // 3. Create formula field
    const { data: field, error: fieldError } = await supabase
      .from('table_fields')
      .insert({
        table_id: tableId,
        name: fieldName,
        type: 'formula',
        config: {
          formula: config.formula,
          return_type: config.return_type,
          dependencies,
        },
      })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // 4. Compute values for all existing rows
    const { data: rows } = await supabase
      .from('table_rows')
      .select('id, data')
      .eq('table_id', tableId);

    if (rows) {
      for (const row of rows) {
        const value = evaluateFormula(config.formula, row.data, fields);
        await supabase
          .from('table_rows')
          .update({
            data: {
              ...row.data,
              [field.id]: value,
            },
          })
          .eq('id', row.id);
      }
    }

    return { field, error: null };
  } catch (error) {
    console.error('Error creating formula field:', error);
    return { field: null, error };
  }
}

/**
 * Recompute formula values when dependencies change
 */
export async function recomputeFormulas(
  tableId: string,
  rowId: string,
  changedFieldId: string
) {
  const supabase = await createClient();

  try {
    // 1. Get all fields and row data
    const { data: fields } = await supabase
      .from('table_fields')
      .select('*')
      .eq('table_id', tableId);

    const { data: row } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', rowId)
      .single();

    if (!fields || !row) return { error: null };

    // 2. Find all formula fields that depend on the changed field
    const formulaFields = fields.filter(f =>
      f.type === 'formula' &&
      (f.config as any)?.dependencies?.includes(changedFieldId)
    );

    if (formulaFields.length === 0) return { error: null };

    // 3. Recompute each affected formula
    const updatedData = { ...row.data };
    for (const formulaField of formulaFields) {
      const config = formulaField.config as any;
      const value = evaluateFormula(config.formula, row.data, fields);
      updatedData[formulaField.id] = value;
    }

    // 4. Update row
    await supabase
      .from('table_rows')
      .update({ data: updatedData })
      .eq('id', rowId);

    return { error: null };
  } catch (error) {
    console.error('Error recomputing formulas:', error);
    return { error };
  }
}