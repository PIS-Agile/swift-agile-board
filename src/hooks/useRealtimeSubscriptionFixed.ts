import { useEffect, useRef } from 'react';
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
  const callbacksRef = useRef({ onItemsChange, onColumnsChange, onProjectsChange });
  
  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onItemsChange, onColumnsChange, onProjectsChange };
  }, [onItemsChange, onColumnsChange, onProjectsChange]);

  useEffect(() => {
    if (!enabled || !projectId) {
      console.log('🔌 Realtime disabled or no projectId');
      return;
    }

    console.log('🔌 Setting up realtime subscription for project:', projectId);

    // Clean up any existing subscription
    if (channelRef.current) {
      console.log('🧹 Removing existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create a channel with a unique name for this project
    const channelName = `project_${projectId}_${Date.now()}`;
    console.log('📡 Creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          console.log('🔄 Items change detected:', {
            type: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            name: payload.new?.name || payload.old?.name
          });
          // Call the callback immediately for all item changes
          // The component will handle filtering by project
          callbacksRef.current.onItemsChange();
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
          console.log('🔄 Columns change detected:', {
            type: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            name: payload.new?.name || payload.old?.name
          });
          callbacksRef.current.onColumnsChange();
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
          console.log('🔄 Item assignments change detected');
          callbacksRef.current.onItemsChange();
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
          console.log('🔄 Custom field values change detected');
          callbacksRef.current.onItemsChange();
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
          console.log('🔄 Custom fields change detected');
          callbacksRef.current.onItemsChange();
        }
      );

    // Add projects subscription if callback provided
    if (callbacksRef.current.onProjectsChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          console.log('🔄 Project change detected');
          callbacksRef.current.onProjectsChange?.();
        }
      );
    }

    // Subscribe to the channel
    const subscription = channel.subscribe((status, err) => {
      console.log('📡 Subscription status:', status, err);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime for project:', projectId);
        
        // Force an initial update after a short delay
        setTimeout(() => {
          console.log('🔄 Triggering initial data refresh');
          callbacksRef.current.onItemsChange();
          callbacksRef.current.onColumnsChange();
          if (callbacksRef.current.onProjectsChange) {
            callbacksRef.current.onProjectsChange();
          }
        }, 100);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error:', err);
        toast({
          title: "Real-time connection error",
          description: "Live updates may not work. Please refresh the page.",
          variant: "destructive",
        });
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ Subscription timeout');
        toast({
          title: "Real-time connection timeout",
          description: "Attempting to reconnect...",
          variant: "destructive",
        });
      } else if (status === 'CLOSED') {
        console.log('🔒 Channel closed');
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
  }, [projectId, enabled]);

  return {
    isConnected: channelRef.current?.state === 'joined'
  };
}