import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface UseRealtimeWithResetProps {
  projectId: string;
  onDataChange: () => void;
  enabled?: boolean;
}

export function useRealtimeWithReset({ 
  projectId, 
  onDataChange, 
  enabled = true 
}: UseRealtimeWithResetProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onDataChange);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onDataChange;
  }, [onDataChange]);

  // Manual reset function
  const resetConnection = useCallback(() => {
    console.log('🔄 Manual sync triggered - resetting realtime connection');
    
    // Clean up existing channel
    if (channelRef.current) {
      console.log('🧹 Removing existing channel for reset');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
    
    // Trigger reconnect by updating resetTrigger
    setResetTrigger(prev => prev + 1);
    
    // Refresh data immediately
    callbackRef.current();
    
    toast({
      title: "Syncing...",
      description: "Refreshing data and reconnecting to realtime",
    });
  }, []);

  useEffect(() => {
    if (!enabled || !projectId) {
      console.log('⏸️ Realtime disabled or no projectId');
      return;
    }

    console.log('🚀 Setting up realtime for project:', projectId, 'Reset count:', resetTrigger);
    
    // Clean up any existing channel
    if (channelRef.current) {
      console.log('🧹 Removing existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
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
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'item_comments'
        },
        (payload) => {
          console.log('💬 Comments changed:', payload.eventType);
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'comment_mentions'
        },
        (payload) => {
          console.log('📢 Mentions changed:', payload.eventType);
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
          tables: ['items', 'columns', 'item_assignments', 'item_field_values', 'custom_fields', 'item_comments', 'comment_mentions']
        });
        
        setIsConnected(true);
        
        // Send a presence event to verify connection
        channel.track({
          online_at: new Date().toISOString(),
        }).then(() => {
          console.log('✨ Presence confirmed');
        });
        
        if (resetTrigger > 0) {
          toast({
            title: "Sync complete",
            description: "Real-time connection restored",
          });
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error:', err);
        setIsConnected(false);
        toast({
          title: "Real-time error",
          description: "Live updates may not work. Try clicking Sync.",
          variant: "destructive",
        });
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ Subscription timeout');
        setIsConnected(false);
        toast({
          title: "Connection timeout",
          description: "Click Sync to reconnect",
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
        setIsConnected(false);
      }
    };
  }, [projectId, enabled, resetTrigger]); // Include resetTrigger to force reconnect

  return {
    isConnected,
    resetConnection
  };
}