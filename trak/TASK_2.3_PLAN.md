# Task 2.3: Tab Management UI - Implementation Plan

## Overview
Build UI for creating, editing, and deleting tabs. This includes a create dialog, inline rename functionality, and a context menu for tab operations.

**Duration**: 5 hours  
**Status**: Planning Phase

---

## Current State Analysis

### ✅ What Exists
1. **Tab Bar Component** (`tab-bar.tsx`)
   - Displays tabs horizontally
   - Has "Add Tab" button (currently only console.logs)
   - Handles tab navigation
   - Mobile responsive with dropdown

2. **Server Actions** (`actions/tab.ts`)
   - `createTab(projectId, name, parentTabId?)` - ✅ Complete
   - `updateTab(tabId, name?, parentTabId?)` - ✅ Complete
   - `deleteTab(tabId)` - ✅ Complete
   - `getProjectTabs(projectId)` - ✅ Complete (returns hierarchical structure)

3. **UI Components Available**
   - Dialog (shadcn/ui)
   - DropdownMenu (shadcn/ui)
   - Input, Label, Button
   - Icons (lucide-react)

### ❌ What Needs to be Built
1. Create Tab Dialog with form
2. Connect "Add Tab" button to dialog
3. Inline tab rename (double-click)
4. Tab context menu (three-dot or right-click)

---

## Detailed Implementation Plan

### Subtask 2.3.1: Build Add Tab Button ✅ (Already exists, needs connection)
**Time**: Already done, just needs hookup (5 min)
**Status**: Button exists in `tab-bar.tsx` line 58-64, needs state management

**Actions**:
- Add state for dialog open/close in TabBar component
- Connect `handleAddTab` to open dialog (instead of console.log)

---

### Subtask 2.3.2: Build Create Tab Dialog
**Time**: 1.5 hours  
**Location**: New component `src/app/dashboard/projects/[projectId]/create-tab-dialog.tsx`

**Requirements**:
- Form with tab name input (required)
- Option to create as sub-tab (checkbox or toggle)
- Parent tab selector (dropdown, only shows when "sub-tab" is checked)
  - Should list all existing tabs (flat or hierarchical)
  - Disable parent selector for tabs that are descendants of other tabs (to prevent cycles)
- Create and Cancel buttons
- Validation (name cannot be empty)
- Error handling from server action

**Implementation Details**:
```typescript
// Props needed:
interface CreateTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingTabs: Tab[]; // All tabs for parent selector
  onSuccess?: () => void; // Callback to refresh tabs
}
```

**Form Fields**:
1. **Tab Name** (Input, required)
2. **Create as sub-tab** (Checkbox or Switch)
3. **Parent Tab** (Select dropdown, conditionally shown, required if sub-tab checked)

**UI Flow**:
1. User clicks "Add Tab"
2. Dialog opens
3. User enters tab name
4. Optional: Check "Create as sub-tab" → Parent selector appears
5. If sub-tab: Select parent tab from dropdown
6. Click "Create" → Call `createTab` action
7. On success: Close dialog, refresh tabs, show toast
8. On error: Show error message in dialog

**Considerations**:
- Need to fetch all tabs for parent selector (use `getProjectTabs`)
- Filter out tabs that would create circular references
- Position is calculated automatically by server action

---

### Subtask 2.3.3: Connect to Server Action
**Time**: 1 hour (30 min form submission, 30 min backend integration)

**Form Submission Logic**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const result = await createTab({
    projectId,
    name: tabName.trim(),
    parentTabId: isSubTab ? selectedParentId : null
  });
  
  if (result.error) {
    setError(result.error);
    return;
  }
  
  // Success
  onSuccess?.();
  onClose();
};
```

**Backend Integration**:
- `createTab` action already exists and handles:
  - Auth validation
  - Workspace membership check
  - Parent tab validation
  - Position calculation
  - Cascade creation

**State Management**:
- Dialog open/close state
- Form state (name, isSubTab, selectedParentId)
- Loading state during submission
- Error state for displaying errors

**Optimistic Updates** (Optional, but recommended):
- Add tab to UI immediately
- Remove if creation fails
- Show loading indicator on tab

---

### Subtask 2.3.4: Build Inline Tab Rename
**Time**: 1 hour (30 min UI, 30 min backend)

**Implementation Approach**:
1. Tab name displays as text normally
2. Double-click on tab name → transforms to input field
3. User edits name inline
4. Save on:
   - Enter key
   - Blur (lose focus)
5. Cancel on:
   - Escape key

**Implementation Details**:
- Create new component: `TabNameEditor` or add to `TabBar`
- State: `editingTabId: string | null`
- Input should be same size/position as text
- Show loading indicator during save
- Revert on error

**Component Structure**:
```typescript
// In TabBar component
const [editingTabId, setEditingTabId] = useState<string | null>(null);
const [editName, setEditName] = useState("");

const handleDoubleClick = (tab: Tab) => {
  setEditingTabId(tab.id);
  setEditName(tab.name);
};

const handleSave = async () => {
  if (!editingTabId) return;
  
  const result = await updateTab({
    tabId: editingTabId,
    name: editName.trim()
  });
  
  if (result.error) {
    // Show error, revert name
    setEditName(tabs.find(t => t.id === editingTabId)?.name || "");
    return;
  }
  
  // Success: refresh tabs
  setEditingTabId(null);
  router.refresh(); // Or use callback prop
};

const handleCancel = () => {
  setEditingTabId(null);
  setEditName("");
};
```

**UX Considerations**:
- Select all text on double-click for easy replacement
- Visual feedback when editing (border, background change)
- Prevent tab navigation while editing
- Show save/cancel buttons? (Optional - Enter/Esc might be enough)

---

### Subtask 2.3.5: Build Tab Context Menu
**Time**: 1.5 hours (45 min UI, 15 min backend connection)

**Implementation Options**:
1. **Three-dot menu** (Recommended - more discoverable)
   - Icon appears on hover
   - Positioned at end of tab
   - More accessible on mobile

2. **Right-click menu** (Alternative/additional)
   - Native context menu
   - More traditional desktop pattern
   - Can implement both

**Menu Options**:
- **Rename** - Triggers inline edit (same as double-click)
- **Add sub-tab** - Opens create dialog with sub-tab mode pre-selected
- **Delete** - Shows confirmation dialog, then deletes
- **Separator** between rename/add and delete (destructive action)

**Implementation Details**:
- Use `DropdownMenu` from shadcn/ui
- Position menu relative to tab button
- Handle click outside to close
- Show confirmation dialog for delete

**Delete Confirmation**:
- Dialog: "Delete tab and all sub-tabs?"
- Warn if tab has sub-tabs or blocks
- Show count: "This will delete X tabs and Y blocks"
- Confirm/Cancel buttons

**Component Structure**:
```typescript
// Add to TabBar, one menu per tab
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="opacity-0 group-hover:opacity-100">
      <MoreHorizontal />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleRename}>
      <Edit /> Rename
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleAddSubTab}>
      <Plus /> Add sub-tab
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      variant="destructive"
      onClick={handleDeleteClick}
    >
      <Trash2 /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Backend Connection**:
- `updateTab` for rename
- `createTab` for add sub-tab (with parentTabId)
- `deleteTab` for delete (with confirmation)

---

## File Structure

```
src/app/dashboard/projects/[projectId]/
├── tab-bar.tsx                    (Modify - add dialog state, inline edit, context menu)
├── create-tab-dialog.tsx           (New - create tab form)
├── delete-tab-dialog.tsx          (New - delete confirmation, optional separate component)
└── page.tsx                        (No changes needed)
```

**Alternative Structure** (all in tab-bar.tsx):
- Could put dialog inline in TabBar component
- Simpler structure, but larger file
- Recommended: Separate dialog component for maintainability

---

## Data Flow

### Creating a Tab
1. User clicks "Add Tab" → `handleAddTab()` sets `isDialogOpen = true`
2. Dialog opens, fetches all tabs (for parent selector)
3. User fills form → `handleSubmit()` calls `createTab` action
4. Success → Close dialog, `router.refresh()` to refetch tabs
5. Error → Display error message in dialog

### Renaming a Tab
1. User double-clicks tab name → `handleDoubleClick(tab.id)`
2. Tab transforms to input field
3. User edits → `handleSave()` calls `updateTab` action
4. Success → Exit edit mode, `router.refresh()`
5. Error → Revert to original name, show error

### Deleting a Tab
1. User clicks three-dot menu → "Delete"
2. Confirmation dialog opens (shows warning if has sub-tabs/blocks)
3. User confirms → `handleDelete()` calls `deleteTab` action
4. Success → `router.refresh()`
5. Error → Show error toast

---

## State Management

### TabBar Component State
```typescript
const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
const [editingTabId, setEditingTabId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
const [openMenuId, setOpenMenuId] = useState<string | null>(null);
const [deleteConfirmTab, setDeleteConfirmTab] = useState<Tab | null>(null);
```

### Create Dialog State
```typescript
const [tabName, setTabName] = useState("");
const [isSubTab, setIsSubTab] = useState(false);
const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

---

## UI/UX Considerations

1. **Loading States**
   - Show spinner on "Create" button during submission
   - Disable inputs during submission
   - Show loading indicator on tab being renamed

2. **Error Handling**
   - Display errors in dialog/form
   - Show toast notifications for save/delete actions
   - Don't lose user's input on validation errors

3. **Accessibility**
   - Keyboard navigation (Enter to save, Esc to cancel)
   - Focus management (focus input when dialog opens, when renaming)
   - ARIA labels for buttons and inputs

4. **Visual Feedback**
   - Highlight active tab
   - Show hover states on buttons
   - Smooth transitions for edit mode

5. **Mobile Responsiveness**
   - Context menu works on touch (long-press alternative?)
   - Dialog is mobile-friendly (already handled by shadcn/ui)
   - Inline edit works on mobile (double-tap)

---

## Testing Checklist

- [ ] Create top-level tab
- [ ] Create sub-tab
- [ ] Create sub-tab with invalid parent (should fail gracefully)
- [ ] Rename tab inline
- [ ] Rename tab via context menu
- [ ] Delete tab (with confirmation)
- [ ] Delete tab with sub-tabs (cascade delete)
- [ ] Error handling (network error, validation error)
- [ ] Loading states display correctly
- [ ] Mobile responsiveness
- [ ] Keyboard navigation
- [ ] Focus management

---

## Dependencies

### Existing Components (No changes needed)
- Dialog components from `@/components/ui/dialog`
- DropdownMenu components from `@/components/ui/dropdown-menu`
- Input, Label, Button from `@/components/ui`
- Icons from `lucide-react`

### Server Actions (No changes needed)
- `createTab` from `@/app/actions/tab`
- `updateTab` from `@/app/actions/tab`
- `deleteTab` from `@/app/actions/tab`
- `getProjectTabs` from `@/app/actions/tab`

---

## Implementation Order

1. **Create Tab Dialog** (2.3.2 & 2.3.3)
   - Build dialog component
   - Connect to server action
   - Hook up "Add Tab" button

2. **Inline Rename** (2.3.4)
   - Add edit state to TabBar
   - Implement double-click handler
   - Connect to updateTab action

3. **Context Menu** (2.3.5)
   - Add three-dot menu to tabs
   - Implement menu options
   - Add delete confirmation dialog
   - Connect all actions

---

## Notes & Considerations

1. **Tab Refresh Strategy**
   - Option A: Use `router.refresh()` after mutations (simplest)
   - Option B: Use optimistic updates + refetch on error (better UX)
   - Option C: Lift state up and manage tab list in parent (most complex)
   - **Recommendation**: Start with `router.refresh()`, optimize later if needed

2. **Parent Tab Selector**
   - For now, show all tabs in flat list (simpler)
   - Future: Show hierarchical tree with indentation
   - Filter out tabs that would create cycles

3. **Delete Confirmation**
   - Should check if tab has sub-tabs or blocks before showing warning
   - Might need `getProjectTabs` to count children
   - Or add endpoint to check tab details

4. **Performance**
   - Fetching all tabs for parent selector might be expensive with many tabs
   - Could limit to top-level tabs only (can move sub-tabs later)
   - Or lazy-load parent selector options

---

## Estimated Time Breakdown

- **2.3.1**: 5 min (already exists, just hookup)
- **2.3.2**: 1.5 hours (dialog UI)
- **2.3.3**: 1 hour (server action integration)
- **2.3.4**: 1 hour (inline rename)
- **2.3.5**: 1.5 hours (context menu + delete)
- **Testing & Polish**: 30 min

**Total**: ~5.5 hours (slightly over, but reasonable buffer)

---

## Success Criteria

✅ Users can create top-level tabs via dialog  
✅ Users can create sub-tabs with parent selection  
✅ Users can rename tabs by double-clicking  
✅ Users can rename tabs via context menu  
✅ Users can delete tabs with confirmation  
✅ All actions show appropriate loading states  
✅ Errors are displayed clearly  
✅ Mobile responsive  
✅ Keyboard accessible  

---

**Ready to proceed with implementation!**

