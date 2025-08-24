# IMPORTANT: Enable Real-time in Supabase Dashboard

Real-time updates are not working because they need to be enabled in your Supabase dashboard. 

## Steps to Enable Real-time:

1. **Go to your Supabase Dashboard**: https://app.supabase.com

2. **Navigate to Database → Replication**

3. **Enable Real-time for these tables:**
   - ✅ items
   - ✅ columns  
   - ✅ projects
   - ✅ item_assignments
   - ✅ profiles
   - ✅ custom_fields
   - ✅ item_field_values

4. **For each table, click on it and toggle "Enable Realtime" to ON**

5. **Important: Make sure "Enable Realtime" is turned on for the ENTIRE DATABASE** (there's a main toggle at the top)

## Alternative: Run this SQL in Supabase SQL Editor:

```sql
-- Enable the Realtime extension
CREATE EXTENSION IF NOT EXISTS "supabase_realtime";

-- Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- Create publication for all tables
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- Set replica identity to FULL for all tables
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.columns REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.item_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.custom_fields REPLICA IDENTITY FULL;
ALTER TABLE public.item_field_values REPLICA IDENTITY FULL;
```

## Verify Real-time is Working:

1. Open the app in two different browsers/computers
2. Check the header for the "Live" badge (should show green when connected)
3. Open browser console (F12) and look for:
   - `✅ Successfully subscribed to realtime changes`
   - `🔄 Items change detected` when making changes
4. Make a change in one browser - it should appear in the other instantly

## Troubleshooting:

If real-time still doesn't work after enabling:

1. **Check Supabase Dashboard → Settings → API**
   - Make sure "Realtime" is enabled in project settings

2. **Check browser console for errors**
   - Look for WebSocket connection errors
   - Check for "CHANNEL_ERROR" messages

3. **Try refreshing both browser tabs**

4. **Check your Supabase plan**
   - Free tier has limitations on concurrent connections
   - Make sure you haven't exceeded connection limits

## Connection Status Indicator

The app now shows a real-time connection status in the header:
- 🟢 **Live** - Connected and receiving updates
- 🟡 **Connecting...** - Establishing connection
- 🔴 **Offline** - Not connected

Click the "Test" button (in development mode) to debug connection issues.