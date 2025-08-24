import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface UseRealtimeSubscriptionProps {
  projectId: string;
  onItemsChange: () => void;
  onColumnsChange: () => void;
  onProjectsChange?: () => void;
  enabled?: boolean;
}

export function useRealtimeSubscription({
  projectId,
  onItemsChange,
  onColumnsChange,
  onProjectsChange,
  enabled = true
}: UseRealtimeSubscriptionProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !projectId) {
      console.log('Realtime disabled or no projectId');
      return;
    }

    console.log('Setting up realtime subscription for project:', projectId);

    // Clean up any existing subscription
    if (channelRef.current) {
      console.log('Removing existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create a new channel for this project
    const channel = supabase
      .channel(`project-room-${projectId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: projectId },
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
        },
        (payload) => {
          console.log('🔄 Items change detected:', payload);
          console.log('Event type:', payload.eventType);
          console.log('Table:', payload.table);
          console.log('Record:', payload.new || payload.old);
          // Always call the callback for any items change
          onItemsChange();
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
          console.log('🔄 Columns change detected:', payload);
          onColumnsChange();
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
          console.log('🔄 Item assignments change detected:', payload);
          onItemsChange();
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
          console.log('🔄 Custom field values change detected:', payload);
          onItemsChange();
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
          console.log('🔄 Custom fields change detected:', payload);
          onItemsChange();
        }
      );

    // Add projects subscription if callback provided
    if (onProjectsChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          console.log('🔄 Projects change detected:', payload);
          onProjectsChange();
        }
      );
    }

    // Subscribe and handle connection states
    channel.subscribe((status) => {
      console.log('📡 Realtime subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime changes for project:', projectId);
        
        // Send a test presence message to verify connection
        channel.track({
          user: 'test',
          online_at: new Date().toISOString(),
        });
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime subscription error');
        toast({
          title: "Real-time connection error",
          description: "Live updates may not work. Please refresh the page.",
          variant: "destructive",
        });
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ Realtime subscription timed out');
        toast({
          title: "Real-time connection timeout",
          description: "Attempting to reconnect...",
          variant: "destructive",
        });
      } else if (status === 'CLOSED') {
        console.log('🔒 Realtime subscription closed');
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up realtime subscription for project:', projectId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, enabled, onItemsChange, onColumnsChange, onProjectsChange]);

  return {
    isConnected: channelRef.current?.state === 'joined'
  };
}