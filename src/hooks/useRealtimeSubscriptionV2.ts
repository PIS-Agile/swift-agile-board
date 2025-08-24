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
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !projectId) {
      console.log('🔌 Realtime disabled or no projectId');
      return;
    }

    console.log('🔌 Setting up realtime subscription for project:', projectId);

    // Clean up any existing subscription
    const cleanup = () => {
      if (channelRef.current) {
        console.log('🧹 Removing existing channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };

    cleanup();

    // Create a simpler channel without complex config that might cause issues
    const channelName = `project-${projectId}`;
    console.log('📡 Creating channel:', channelName);
    
    const channel = supabase.channel(channelName);

    // Subscribe to items changes
    // Note: items don't have project_id directly, they belong to columns
    // So we listen to all items and filter on the client side
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items'
      },
      async (payload) => {
        console.log('🔄 Items change detected:', {
          type: payload.eventType,
          old: payload.old,
          new: payload.new
        });
        
        // Check if this item belongs to our project
        // by checking if its column belongs to our project
        if (payload.new?.column_id || payload.old?.column_id) {
          const columnId = payload.new?.column_id || payload.old?.column_id;
          
          // Quick check if this column belongs to our project
          const { data: column } = await supabase
            .from('columns')
            .select('project_id')
            .eq('id', columnId)
            .single();
          
          if (column?.project_id === projectId) {
            console.log('✅ Item belongs to current project, updating...');
            onItemsChange();
          } else {
            console.log('⏭️ Item belongs to different project, ignoring');
          }
        }
      }
    );

    // Subscribe to columns changes for this project
    channel.on(
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
          data: payload.new || payload.old
        });
        onColumnsChange();
      }
    );

    // Subscribe to item assignments
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'item_assignments'
      },
      async (payload) => {
        console.log('🔄 Item assignments change detected');
        
        // Check if the item belongs to our project
        const itemId = payload.new?.item_id || payload.old?.item_id;
        if (itemId) {
          const { data: item } = await supabase
            .from('items')
            .select('column_id')
            .eq('id', itemId)
            .single();
          
          if (item?.column_id) {
            const { data: column } = await supabase
              .from('columns')
              .select('project_id')
              .eq('id', item.column_id)
              .single();
            
            if (column?.project_id === projectId) {
              console.log('✅ Assignment belongs to current project');
              onItemsChange();
            }
          }
        }
      }
    );

    // Subscribe to item field values
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'item_field_values'
      },
      async (payload) => {
        console.log('🔄 Custom field values change detected');
        
        // Check if the item belongs to our project
        const itemId = payload.new?.item_id || payload.old?.item_id;
        if (itemId) {
          const { data: item } = await supabase
            .from('items')
            .select('column_id')
            .eq('id', itemId)
            .single();
          
          if (item?.column_id) {
            const { data: column } = await supabase
              .from('columns')
              .select('project_id')
              .eq('id', item.column_id)
              .single();
            
            if (column?.project_id === projectId) {
              console.log('✅ Field value belongs to current project');
              onItemsChange();
            }
          }
        }
      }
    );

    // Subscribe to custom fields changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'custom_fields',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        console.log('🔄 Custom fields change detected');
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
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          console.log('🔄 Project change detected');
          onProjectsChange();
        }
      );
    }

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('📡 Subscription status:', status, err);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime for project:', projectId);
        isSubscribedRef.current = true;
        
        // Force an initial update to make sure we have the latest data
        setTimeout(() => {
          console.log('🔄 Triggering initial data refresh');
          onItemsChange();
          onColumnsChange();
        }, 100);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error:', err);
        isSubscribedRef.current = false;
        toast({
          title: "Real-time connection error",
          description: "Live updates may not work. Please refresh the page.",
          variant: "destructive",
        });
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ Subscription timeout');
        isSubscribedRef.current = false;
        toast({
          title: "Real-time connection timeout",
          description: "Attempting to reconnect...",
          variant: "destructive",
        });
      } else if (status === 'CLOSED') {
        console.log('🔒 Channel closed');
        isSubscribedRef.current = false;
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up realtime subscription');
      cleanup();
    };
  }, [projectId, enabled]); // Remove callback dependencies to prevent re-subscriptions

  // Use a separate effect to update callbacks
  useEffect(() => {
    if (channelRef.current && isSubscribedRef.current) {
      // Callbacks are captured in the closure, no need to re-subscribe
      console.log('📝 Callbacks updated for existing subscription');
    }
  }, [onItemsChange, onColumnsChange, onProjectsChange]);

  return {
    isConnected: isSubscribedRef.current
  };
}