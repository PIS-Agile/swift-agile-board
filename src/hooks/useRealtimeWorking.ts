import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface UseRealtimeWorkingProps {
  projectId: string;
  onDataChange: () => void;
  enabled?: boolean;
}

export function useRealtimeWorking({ 
  projectId, 
  onDataChange, 
  enabled = true 
}: UseRealtimeWorkingProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onDataChange);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    if (!enabled || !projectId) {
      console.log('⏸️ Realtime disabled or no projectId');
      return;
    }

    console.log('🚀 Setting up realtime for project:', projectId);
    
    // Clean up any existing channel
    if (channelRef.current) {
      console.log('🧹 Removing existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create unique channel name
    const channelName = `project_${projectId}_${Date.now()}`;
    console.log('📡 Creating channel:', channelName);
    
    // Create the channel
    const channel = supabase
      .channel(channelName, {
        config: {
          presence: {
            key: projectId,
          },
        },
      })
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'items' 
        },
        (payload) => {
          console.log('📦 Items changed:', {
            type: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            name: payload.new?.name || payload.old?.name,
            column: payload.new?.column_id || payload.old?.column_id
          });
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'columns',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('📊 Columns changed:', {
            type: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            name: payload.new?.name || payload.old?.name
          });
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'item_assignments' 
        },
        (payload) => {
          console.log('👥 Assignments changed:', payload.eventType);
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'item_field_values' 
        },
        (payload) => {
          console.log('📝 Field values changed:', payload.eventType);
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'custom_fields',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('⚙️ Custom fields changed:', payload.eventType);
          callbackRef.current();
        }
      );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('📡 Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime!');
        console.log('👂 Listening for changes on:', {
          channel: channelName,
          projectId: projectId,
          tables: ['items', 'columns', 'item_assignments', 'item_field_values', 'custom_fields']
        });
        
        // Send a presence event to verify connection
        channel.track({
          online_at: new Date().toISOString(),
        }).then(() => {
          console.log('✨ Presence confirmed');
        });
        
        toast({
          title: "Real-time connected",
          description: "Live updates are now active",
        });
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error:', err);
        toast({
          title: "Real-time error",
          description: "Live updates may not work. Please refresh.",
          variant: "destructive",
        });
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ Subscription timeout');
        toast({
          title: "Connection timeout",
          description: "Reconnecting...",
          variant: "destructive",
        });
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log('🔚 Cleaning up realtime subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, enabled]); // Only depend on projectId and enabled

  return {
    isConnected: channelRef.current?.state === 'joined'
  };
}