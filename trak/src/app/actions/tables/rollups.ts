"use server";

import { createClient } from "@/lib/supabase/server";
import { getRelatedRows } from "./relations";

/**
 * Create a rollup field
 */
export async function createRollupField(
  tableId: string,
  fieldName: string,
  config: {
    relation_field_id: string;
    target_field_id: string;
    aggregation: string;
    filter?: { field_id: string; operator: string; value: any };
  }
) {
  const supabase = await createClient();

  try {
    // 1. Validate relation field exists
    const { data: relationField } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', config.relation_field_id)
      .eq('table_id', tableId)
      .single();

    if (!relationField || relationField.type !== 'relation') {
      throw new Error('Invalid relation field');
    }

    // 2. Validate target field exists in related table
    const relatedTableId = (relationField.config as any).relation_table_id;
    const { data: targetField } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', config.target_field_id)
      .eq('table_id', relatedTableId)
      .single();

    if (!targetField) {
      throw new Error('Invalid target field');
    }

    // 3. Create rollup field
    const { data: field, error: fieldError } = await supabase
      .from('table_fields')
      .insert({
        table_id: tableId,
        name: fieldName,
        type: 'rollup',
        config: {
          relation_field_id: config.relation_field_id,
          target_field_id: config.target_field_id,
          aggregation: config.aggregation,
          filter: config.filter,
        },
      })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // 4. Compute initial values for all rows in table
    const { data: rows } = await supabase
      .from('table_rows')
      .select('id')
      .eq('table_id', tableId);

    if (rows) {
      for (const row of rows) {
        await computeRollupValue(row.id, field.id);
      }
    }

    return { field, error: null };
  } catch (error) {
    console.error('Error creating rollup field:', error);
    return { field: null, error };
  }
}

/**
 * Compute rollup value for a specific row
 */
export async function computeRollupValue(
  rowId: string,
  fieldId: string
): Promise<{ value: any; error: any }> {
  const supabase = await createClient();

  try {
    // 1. Get rollup field config
    const { data: field } = await supabase
      .from('table_fields')
      .select('config, table_id')
      .eq('id', fieldId)
      .single();

    if (!field || field.type !== 'rollup') {
      throw new Error('Not a rollup field');
    }

    const config = field.config as any;

    // 2. Get related rows via relation field
    const { rows: relatedRows } = await getRelatedRows(rowId, config.relation_field_id);

    // 3. Extract target field values
    let values = relatedRows.map(r => r.data?.[config.target_field_id]);

    // 4. Apply filter if specified
    if (config.filter) {
      values = relatedRows
        .filter(row => {
          const fieldValue = row.data?.[config.filter.field_id];
          return applyFilterOperator(fieldValue, config.filter.operator, config.filter.value);
        })
        .map(r => r.data?.[config.target_field_id]);
    }

    // 5. Apply aggregation function
    const result = aggregateValues(values, config.aggregation);

    // 6. Store computed value in row data
    const { data: row } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', rowId)
      .single();

    await supabase
      .from('table_rows')
      .update({
        data: {
          ...row?.data,
          [fieldId]: result,
          [`${fieldId}_computed_at`]: new Date().toISOString(),
        },
      })
      .eq('id', rowId);

    return { value: result, error: null };
  } catch (error) {
    console.error('Error computing rollup value:', error);
    return { value: null, error };
  }
}

/**
 * Invalidate rollup cache when related rows change
 */
export async function invalidateRollups(
  affectedRowIds: string[],
  relationFieldId: string
) {
  const supabase = await createClient();

  try {
    // 1. Find all rollup fields that depend on this relation
    const { data: rollupFields } = await supabase
      .from('table_fields')
      .select('id, table_id')
      .eq('type', 'rollup')
      .contains('config', { relation_field_id: relationFieldId });

    if (!rollupFields || rollupFields.length === 0) return { error: null };

    // 2. For each affected row, recompute rollups
    for (const rowId of affectedRowIds) {
      for (const rollupField of rollupFields) {
        await computeRollupValue(rowId, rollupField.id);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error invalidating rollups:', error);
    return { error };
  }
}

/**
 * Helper: Apply filter operator
 */
function applyFilterOperator(value: any, operator: string, filterValue: any): boolean {
  switch (operator) {
    case 'equals':
      return value === filterValue;
    case 'not_equals':
      return value !== filterValue;
    case 'contains':
      return String(value).includes(String(filterValue));
    case 'greater_than':
      return Number(value) > Number(filterValue);
    case 'less_than':
      return Number(value) < Number(filterValue);
    case 'is_empty':
      return value == null || value === '';
    case 'is_not_empty':
      return value != null && value !== '';
    default:
      return true;
  }
}

/**
 * Helper: Aggregate values based on aggregation type
 */
function aggregateValues(values: any[], aggregation: string): any {
  // Filter out null/undefined values for most operations
  const cleanValues = values.filter(v => v != null);

  switch (aggregation) {
    case 'count':
      return values.length;

    case 'count_values':
      return cleanValues.filter(v => v !== '').length;

    case 'count_unique':
      return new Set(cleanValues).size;

    case 'count_empty':
      return values.filter(v => v == null || v === '').length;

    case 'percent_empty':
      const empty = values.filter(v => v == null || v === '').length;
      return values.length > 0 ? Math.round((empty / values.length) * 100) : 0;

    case 'percent_not_empty':
      const notEmpty = cleanValues.filter(v => v !== '').length;
      return values.length > 0 ? Math.round((notEmpty / values.length) * 100) : 0;

    case 'sum':
      const nums = cleanValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
      return nums.reduce((sum, v) => sum + Number(v), 0);

    case 'average':
      const avgNums = cleanValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
      if (avgNums.length === 0) return null;
      return avgNums.reduce((sum, v) => sum + Number(v), 0) / avgNums.length;

    case 'median':
      const medNums = cleanValues
        .filter(v => typeof v === 'number' || !isNaN(Number(v)))
        .map(v => Number(v))
        .sort((a, b) => a - b);
      if (medNums.length === 0) return null;
      const mid = Math.floor(medNums.length / 2);
      return medNums.length % 2 === 0
        ? (medNums[mid - 1] + medNums[mid]) / 2
        : medNums[mid];

    case 'min':
      const minNums = cleanValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
      return minNums.length > 0 ? Math.min(...minNums.map(v => Number(v))) : null;

    case 'max':
      const maxNums = cleanValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
      return maxNums.length > 0 ? Math.max(...maxNums.map(v => Number(v))) : null;

    case 'range':
      const rangeNums = cleanValues.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(v => Number(v));
      if (rangeNums.length === 0) return null;
      return Math.max(...rangeNums) - Math.min(...rangeNums);

    case 'earliest_date':
      const dates = cleanValues.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
      return dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString() : null;

    case 'latest_date':
      const lateDates = cleanValues.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
      return lateDates.length > 0 ? new Date(Math.max(...lateDates.map(d => d.getTime()))).toISOString() : null;

    case 'date_range':
      const rangeDates = cleanValues.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
      if (rangeDates.length === 0) return null;
      const earliest = Math.min(...rangeDates.map(d => d.getTime()));
      const latest = Math.max(...rangeDates.map(d => d.getTime()));
      return Math.round((latest - earliest) / (1000 * 60 * 60 * 24)); // Days

    case 'checked':
      return values.filter(v => v === true).length;

    case 'unchecked':
      return values.filter(v => v === false || v == null).length;

    case 'percent_checked':
      const total = values.length;
      const checked = values.filter(v => v === true).length;
      return total > 0 ? Math.round((checked / total) * 100) : 0;

    case 'show_unique':
      return Array.from(new Set(cleanValues)).join(', ');

    case 'show_original':
      return cleanValues.join(', ');

    default:
      return null;
  }
}