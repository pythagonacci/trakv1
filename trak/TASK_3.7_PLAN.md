# Task 3.7: Drag and Drop for Blocks Implementation Plan

## Overview
Implement drag and drop functionality for blocks within tabs, allowing users to reorder blocks by dragging them. Blocks already have a `position` field and the UI shows a "drag" handle, but the drag functionality is not yet implemented.

**Goal**: Add drag-and-drop block reordering  
**Duration**: 6 hours

## Current State Analysis

### ✅ What We Have
1. **Server Actions** (`app/actions/block.ts`):
   - `moveBlock(data)` - Already implemented! Can move blocks between tabs and update positions
   - `updateBlock(data)` - Can update position directly
   - Blocks have `position` field (number)
   - Blocks are fetched ordered by `position` ascending

2. **UI Components**:
   - `block-wrapper.tsx` - Has a visual "drag" handle that says "drag" (line 61-63)
   - `block-renderer.tsx` - Renders blocks
   - `tab-canvas.tsx` - Container that displays blocks
   - `isDragging` prop exists but isn't used functionally yet

3. **Block Structure**:
   - Blocks have: `id`, `tab_id`, `position`, `type`, `content`, `parent_block_id`
   - Currently all blocks have `parent_block_id: null` (top-level only)
   - Position determines display order

### ❌ What We Need
1. Install drag-and-drop library (`@dnd-kit/core` and `@dnd-kit/sortable`)
2. Make blocks draggable with proper drag handles
3. Visual feedback during dragging
4. Update positions on server after drop
5. Handle sections (for future, when sections are implemented)

## Task Breakdown

### 3.7.1: Install dnd-kit Library (30 min) - [UI]

**Subtasks**:
1. Install dependencies:
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```
2. Set up `DndContext` in `tab-canvas.tsx` or a wrapper component
3. Configure sensors (mouse, keyboard, touch for mobile)

**Files to Modify**:
- `package.json` (add dependencies)
- `tab-canvas.tsx` (add DndContext provider)

**Key Points**:
- Use `@dnd-kit/core` for the main drag context
- Use `@dnd-kit/sortable` for vertical list sorting
- Use `@dnd-kit/utilities` for helper functions

### 3.7.2: Add Drag Handles to Blocks (1.5 hours) - [UI]

**Subtasks**:
1. Replace current "drag" text with six-dot icon (GripVertical from lucide-react)
2. Position handle on left side of block
3. Show handle on hover (already partially implemented)
4. Change cursor to `grab` when hovering handle, `grabbing` when dragging
5. Make handle the drag activator (only dragging when grabbing handle, not whole block)

**Files to Modify**:
- `block-wrapper.tsx` - Add proper drag handle with cursor styles

**Visual Requirements**:
- Six-dot grip icon (GripVertical from lucide-react)
- Appears on left side on hover
- Cursor: `grab` → `grabbing` during drag
- Only the handle should initiate drag (not entire block)

**Implementation Details**:
```tsx
// Use asDragHandleRef from @dnd-kit/core
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';

// In BlockWrapper:
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: block.id,
});
```

### 3.7.3: Implement Drag to Reorder (2.5 hours) - [UI]

**Subtasks**:
1. Set up `SortableContext` in `tab-canvas.tsx`
2. Wrap each block in `SortableItem` component
3. Implement drag start/drag over/drag end handlers
4. Add visual placeholder showing drop position
5. Animate other blocks shifting during drag
6. Handle drag constraints (vertical only)

**Files to Modify**:
- `tab-canvas.tsx` - Add SortableContext and drag handlers
- `block-wrapper.tsx` - Convert to useSortable hook
- Create `sortable-block.tsx` wrapper (optional, or integrate into block-wrapper)

**Key Features**:
- Blocks can be dragged up/down (vertical only)
- Visual placeholder shows drop position
- Other blocks shift smoothly with animations
- Smooth animations during drag
- Mobile/touch support

**Visual Feedback**:
- Drag overlay (ghost image while dragging)
- Drop indicator line/shadow at drop position
- Smooth transitions when blocks shift

**Implementation Approach**:
```tsx
// In tab-canvas.tsx
<DndContext 
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
    {blocks.map(block => (
      <SortableBlock key={block.id} block={block} />
    ))}
  </SortableContext>
</DndContext>
```

### 3.7.4: Connect to Server Action (1 hour) - [Backend] + [UI]

**Subtasks**:
1. **UI (30 min)**:
   - On drop, calculate new positions for affected blocks
   - Optimistic UI update (update local state immediately)
   - Call `moveBlock` or `updateBlock` server action
   - Handle error cases (revert on error)

2. **Backend (30 min)**:
   - The `moveBlock` action already exists!
   - May need to add a `reorderBlocks` action that handles multiple position updates efficiently
   - Or use existing `updateBlock` to update position one by one

**Files to Modify**:
- `tab-canvas.tsx` - Add onDragEnd handler with server action call
- `app/actions/block.ts` - Potentially add `reorderBlocks` bulk update (optional optimization)

**Implementation Strategy**:
1. **On Drag End**:
   ```tsx
   const handleDragEnd = async (event) => {
     const { active, over } = event;
     if (!over) return;
     
     const oldIndex = blocks.findIndex(b => b.id === active.id);
     const newIndex = blocks.findIndex(b => b.id === over.id);
     
     if (oldIndex === newIndex) return;
     
     // Optimistic update
     const newBlocks = arrayMove(blocks, oldIndex, newIndex);
     setBlocks(newBlocks);
     
     // Update positions in database
     await updateBlockPositions(blocks, oldIndex, newIndex);
   };
   ```

2. **Position Update Logic**:
   - Calculate new positions for all affected blocks
   - Batch update positions (or update individually)
   - Use `updateBlock` for each position change
   - Or create `reorderBlocks(tabId, blockIds)` that takes new ordered array

3. **Error Handling**:
   - If server update fails, revert optimistic update
   - Show error toast
   - Restore original order

**Optimistic Updates**:
- Update UI immediately on drop
- Show loading state if needed
- Revert on error

### 3.7.5: Handle Section Block Dragging (30 min) - [UI]

**Subtasks**:
1. Detect when dragging over a section block
2. Show visual indicator when hovering over section
3. Allow dragging blocks into sections (when sections are implemented)
4. Prevent nesting sections (validation)
5. Update `parent_block_id` when dropping into section

**Files to Modify**:
- `tab-canvas.tsx` - Add section detection in drag handlers
- `block-wrapper.tsx` - Visual indicator for section drop zones

**Current State**:
- Sections may not be fully implemented yet
- All blocks currently have `parent_block_id: null`
- This subtask prepares for future section functionality

**Implementation Notes**:
- For now, focus on top-level block reordering
- Add placeholder code for section detection
- Visual indicators can be added but may not be fully functional until sections exist

## File Structure & Dependencies

### New Dependencies to Install
```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

### Files to Create/Modify

1. **tab-canvas.tsx** (major changes):
   - Add `DndContext` provider
   - Add `SortableContext` 
   - Add drag handlers (`onDragStart`, `onDragOver`, `onDragEnd`)
   - Handle position updates and server sync

2. **block-wrapper.tsx** (major changes):
   - Integrate `useSortable` hook
   - Add proper drag handle with cursor styles
   - Handle drag state visual feedback
   - Apply transform styles during drag

3. **block.ts** (optional - may add bulk update):
   - Potentially add `reorderBlocks` action for efficiency
   - Or just use existing `updateBlock` multiple times

## Implementation Details

### Drag Handle Implementation
```tsx
// In block-wrapper.tsx
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({
  id: block.id,
  disabled: block.type === 'divider', // Maybe disable for dividers?
});

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};

// Drag handle button
<button
  ref={setNodeRef}
  style={style}
  {...attributes}
  {...listeners}
  className="cursor-grab active:cursor-grabbing"
>
  <GripVertical className="w-4 h-4" />
</button>
```

### Position Update Logic
When a block moves from position A to position B:
1. If moving down: All blocks between A and B shift up (position - 1)
2. If moving up: All blocks between B and A shift down (position + 1)
3. Moved block gets new position B

Example:
```
Before: [0: A, 1: B, 2: C, 3: D, 4: E]
Drag D from position 3 to position 1
After: [0: A, 1: D, 2: B, 3: C, 4: E]
Positions: B: 2, C: 3, D: 1
```

### Server Action Options

**Option 1: Individual Updates** (simpler, more API calls)
```typescript
// Update each affected block's position
for (const block of affectedBlocks) {
  await updateBlock({ blockId: block.id, position: block.newPosition });
}
```

**Option 2: Bulk Update** (more efficient, requires new action)
```typescript
// Create new action: reorderBlocks(tabId, blockPositions)
// blockPositions: [{ blockId: string, position: number }]
await reorderBlocks(tabId, newPositions);
```

## Testing Checklist

- [ ] Drag handle appears on hover
- [ ] Cursor changes to grab/grabbing
- [ ] Can drag blocks up and down
- [ ] Visual placeholder shows drop position
- [ ] Other blocks animate smoothly during drag
- [ ] Position updates correctly on server
- [ ] Optimistic update works
- [ ] Error handling reverts on failure
- [ ] Mobile/touch drag works
- [ ] Keyboard navigation still works
- [ ] Drag doesn't interfere with block editing
- [ ] Drag doesn't interfere with block menu
- [ ] Performance is smooth with many blocks

## Edge Cases to Handle

1. **Rapid dragging**: Debounce or batch position updates
2. **Multiple users**: Consider optimistic updates vs conflicts
3. **Large lists**: Virtual scrolling might be needed later
4. **Divider blocks**: May need special handling
5. **Block deletion during drag**: Handle gracefully
6. **Network errors**: Revert optimistic updates

## Future Enhancements (Post-3.7)

1. Drag blocks between tabs
2. Drag blocks into sections (when sections exist)
3. Drag tasks within task blocks
4. Drag timeline events
5. Undo/redo for drag operations
6. Keyboard shortcuts for reordering

## Timeline Estimate

- **3.7.1**: 30 min - Install and setup
- **3.7.2**: 1.5 hours - Drag handles
- **3.7.3**: 2.5 hours - Drag to reorder
- **3.7.4**: 1 hour - Server integration
- **3.7.5**: 30 min - Section handling (preparation)
- **Total**: ~6 hours

## Notes

- The `moveBlock` action exists but is for moving between tabs
- We'll primarily use `updateBlock` to update positions
- Consider creating `reorderBlocks` for better performance
- Section dragging (3.7.5) may be partial if sections aren't fully implemented
- Focus on top-level block reordering first
- Mobile support is important - test on touch devices
