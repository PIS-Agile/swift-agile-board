# Real-Time Troubleshooting Guide

## ✅ Fixed Issues in Code

1. **Removed `self: false` configuration** - This was preventing users from seeing their own changes
2. **Fixed subscription filtering** - Items are now properly filtered by project
3. **Added better error handling and logging**
4. **Simplified channel configuration** to avoid connection issues

## 🔧 Enable Real-Time in Supabase Dashboard

### Step 1: Enable Replication for Tables

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Database → Replication**
4. Enable replication for these tables:
   - ✅ `items`
   - ✅ `columns`
   - ✅ `item_assignments`
   - ✅ `item_field_values`
   - ✅ `custom_fields`
   - ✅ `projects`

### Step 2: Verify Realtime is Enabled

1. In Supabase Dashboard, go to **Settings → API**
2. Scroll to **Realtime** section
3. Ensure "Enable Realtime" is **ON**

### Step 3: Check Policies

Real-time requires proper RLS policies. Check that your tables have SELECT policies:

```sql
-- Check if policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 🧪 Testing Real-Time

### Method 1: Use Test HTML File

1. Open `test-realtime-v2.html` in a browser
2. Click "Test Insert Item" or "Test Update Item"
3. You should see real-time events in the logs

### Method 2: Test with Two Browser Windows

1. Open your app in two different browser windows
2. Make changes in one window
3. Changes should appear in the other window immediately

### Method 3: Check Browser Console

The app now logs all real-time events. Check for:
- `🔌 Realtime connection status: Connected`
- `✅ Successfully subscribed to realtime`
- `🔄 Items change detected`
- `🔄 Columns change detected`

## 🔍 Common Issues

### Issue: Changes not appearing in real-time

**Solutions:**
1. Check browser console for errors
2. Verify replication is enabled in Supabase
3. Use the manual "🔄 Refresh" button (in development mode)
4. Check if the "Live" badge shows in the app header

### Issue: "CHANNEL_ERROR" in console

**Solutions:**
1. Check your Supabase subscription limits
2. Verify your API keys are correct
3. Check if real-time is enabled in Supabase settings

### Issue: Changes appear for others but not yourself

**This was the main issue - now fixed!** The `self: false` configuration was preventing users from seeing their own changes.

## 📊 How Real-Time Works Now

1. **Channel Creation**: Each project gets its own channel (`project-{projectId}`)
2. **Smart Filtering**: Items are filtered by checking if they belong to the current project
3. **Immediate Updates**: Users see their own changes AND others' changes
4. **Error Recovery**: Automatic reconnection on connection loss

## 🚀 Performance Notes

- Real-time subscriptions are created per project
- Old subscriptions are cleaned up when switching projects
- Callbacks are optimized to prevent unnecessary re-renders
- Initial data refresh happens after subscription success

## 💡 Debug Mode Features

In development mode, you have:
- **🔄 Refresh** button for manual data refresh
- **Test** button in the Live badge to test connection
- Detailed console logging of all real-time events

## ✨ Verification Steps

1. Open browser console (F12)
2. Look for: `✅ Successfully subscribed to realtime for project: [ID]`
3. Create/edit an item
4. Look for: `🔄 Items change detected`
5. Item should update immediately in the UI

If you see the logs but UI doesn't update, the issue is with React rendering.
If you don't see the logs, the issue is with Supabase real-time configuration.