# Fixes Applied

## 1. ✅ Fixed: project_id null error when creating items

### Problem:
When creating a new item, you were getting: `null value in column "project_id" of relation "items" violates not-null constraint`

### Solution:
Updated `ItemDialogV3.tsx` to include `project_id` when creating new items:
```typescript
// Added project_id to the insert
.insert({
  name: name.trim(),
  description,
  estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
  actual_time: actualTime ? parseFloat(actualTime) : 0,
  column_id: columnId,
  project_id: projectId,  // ← Fixed: Now includes project_id
  position: nextPosition,
})
```

## 2. ✅ Added: Manual ordering within columns

### What's New:
- Users can now drag and drop items **within the same column** to reorder them
- Items maintain their position when moved
- Position updates are saved to the database

### How It Works:
1. **Drag an item** within its column
2. **Drop it** above or below other items
3. The item's position updates automatically
4. All other items adjust their positions accordingly

### Technical Changes:

#### KanbanItem.tsx:
- Now passes `position` when dragging an item

#### KanbanColumn.tsx:
- Added support for reordering within the same column
- Calculates target position based on drop location
- Updates all affected items' positions in the database
- Shows "Item reordered" toast notification

### Code Changes:
```typescript
// Now handles both:
if (draggedItem.columnId === column.id) {
  // Reordering within the same column
  // Updates positions for all affected items
} else {
  // Moving to a different column (existing functionality)
  // Also sets project_id to prevent null errors
}
```

## Testing the Fixes

### Test Item Creation:
1. Click "Add item" in any column
2. Fill in the item details
3. Save - should work without errors

### Test Item Reordering:
1. Drag any item within its column
2. Drop it above or below another item
3. The order should update immediately
4. Refresh the page - order should persist

### Test Moving Between Columns:
1. Drag an item to a different column
2. Should work as before
3. Item gets the correct project_id

## Files Modified:
- `/src/components/ItemDialogV3.tsx` - Added project_id to item creation
- `/src/components/KanbanItem.tsx` - Added position to drag data
- `/src/components/KanbanColumn.tsx` - Added reordering logic within columns

The app now properly handles item creation with project_id and supports full drag-and-drop reordering!