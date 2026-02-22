# General Bug Fixes

## Priority Column Shows "Empty" Despite DB Being Populated

**Issue:** The priority column displays "Empty" for all rows in tables created by cmd+k AI, even when priority data exists in the database.

**Cause:** The AI stores priority as display labels (e.g. "High", "Medium") while the property definition uses lowercase canonical IDs ("high", "medium"), and `PriorityCell` used strict equality (`level.id === value`) so "High" never matched "high".

**Fix:** Added case-insensitive matching in `PriorityCell` when resolving the selected level so values like "High" match canonical "high"; file touched: `src/components/tables/cells/priority-cell.tsx`.
