# Testing Guide: Table Relations, Rollups, and Formulas

## Overview
This guide describes how to validate advanced table features in Trak, with
step-by-step scenarios and verification queries.

## Prerequisites
- Test workspace with sample data
- Access to Supabase dashboard (SQL editor)
- Familiarity with relations, rollups, and formulas

## Test Data Setup

### Create Test Tables
Create two tables:

**Tasks**
- Title (text)
- Hours (number)
- Status (select: Not Started, In Progress, Done)
- Due Date (date)
- Completed (checkbox)
- Priority (select: Low, Medium, High)
- Notes (long_text)

**Projects**
- Name (text)
- Tasks (relation to Tasks, one-to-many)

### Sample Rows (Tasks)
Create at least 5 tasks with varied data:
- Some Hours filled, some null
- Mixed Status values
- Some Notes empty, some filled
- Mixed Due Date values
- Mixed Completed values

## Feature Testing

### Relations
1. **One-to-many linking**
   - Link 3 tasks to a project
   - Verify relation chips show in the project row
   - Unlink one task and verify it disappears

2. **Bidirectional relations**
   - Enable bidirectional and confirm reverse field exists
   - Link a task and verify reverse relation is visible

3. **Self-referencing relations**
   - Create a relation field pointing to the same table
   - Link a row to itself and verify UI handles it cleanly

### Rollups
Create rollups in Projects that aggregate Tasks:

1. **Count aggregations**
   - count
   - count_values
   - count_unique
   - count_empty
   - percent_empty
   - percent_not_empty

2. **Numeric aggregations**
   - sum, average, median, min, max, range

3. **Date aggregations**
   - earliest_date, latest_date, date_range

4. **Checkbox aggregations**
   - checked, unchecked, percent_checked

5. **Text aggregations**
   - show_unique, show_original

For each rollup:
- Verify initial value
- Update a related task and confirm the rollup updates
- Test null values and empty relations

### Formulas
Create formula fields and verify output:

**Arithmetic**
```
prop("Hours") * 50
prop("Budget") - prop("Spent")
```

**Text**
```
concat(prop("First"), " ", prop("Last"))
upper(prop("Email"))
```

**Conditional**
```
if(prop("Status") == "Done", "OK", "Pending")
```

**Date**
```
dateBetween(prop("Start"), prop("End"), "days")
```

Verify:
- Valid inputs compute correctly
- Invalid inputs produce #ERROR with a helpful message
- Formulas recompute when dependencies change

### Recomputation Triggers
1. **Field change**
   - Change a numeric input used by a formula
   - Confirm formula updates within 500ms

2. **Relation change**
   - Link/unlink tasks and confirm rollups update

3. **Rollup dependency**
   - Formula referencing rollup updates after rollup changes

### Column Calculations
1. Set a footer calculation (Sum) on a numeric field
2. Refresh the page
3. Confirm the calculation persists and remains correct
4. Verify calculations are view-specific

### Bulk Operations
1. **Bulk update**
   - Select 20 rows
   - Update a Status field
   - Confirm all rows updated

2. **Bulk delete**
   - Select 10 rows
   - Confirm dialog shows relation count
   - Delete and verify no orphaned relations

3. **Bulk duplicate**
   - Select 5 rows
   - Duplicate and verify new rows are created

## Common Issues and Solutions

### Formula Does Not Update
**Symptoms**
- Formula shows old value after edit
- Formula shows #ERROR

**Checks**
1. Verify formula syntax
2. Confirm field names (case-insensitive)
3. Inspect dependencies in field config

**Fixes**
- Correct syntax
- Update field references
- Recompute formulas

### Rollup Value Incorrect
**Symptoms**
- Rollup does not match manual calc
- Rollup appears stale

**Checks**
1. Confirm relation links exist
2. Verify aggregation type
3. Check null values and filters

**Fixes**
- Repair relation links
- Recompute rollups

## Verification Queries

### Relation Links
```sql
SELECT * FROM table_relations
WHERE from_row_id = 'your_row_id';
```

### Rollup Values
```sql
SELECT data->>'rollup_field_id' AS rollup_value
FROM table_rows
WHERE id = 'your_row_id';
```

### Orphaned Relations
```sql
SELECT COUNT(*) FROM table_relations tr
LEFT JOIN table_rows r ON tr.from_row_id = r.id
WHERE r.id IS NULL;
```

## Performance Benchmarks

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Single formula | < 100ms | < 500ms |
| Single rollup | < 200ms | < 500ms |
| Bulk update (100 rows) | < 5s | < 10s |
| Bulk delete (100 rows) | < 10s | < 15s |

## Reporting Issues
Include:
- Steps to reproduce
- Expected vs actual behavior
- Console errors
- Relevant SQL query output
