import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeProps {
  projectId: string;
  onDataChange: () => void;
  enabled?: boolean;
}

export function useRealtimeSimple({ projectId, onDataChange, enabled = true }: UseRealtimeProps) {
  useEffect(() => {
    if (!enabled || !projectId) return;

    console.log('🔄 Setting up realtime for project:', projectId);
    
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      // Create a simple channel that listens to all changes
      channel = supabase
        .channel(`room:${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          (payload) => {
            console.log('📦 Items changed:', payload.eventType);
            onDataChange();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'columns' },
          (payload) => {
            console.log('📊 Columns changed:', payload.eventType);
            onDataChange();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'item_assignments' },
          (payload) => {
            console.log('👥 Assignments changed:', payload.eventType);
            onDataChange();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'item_field_values' },
          (payload) => {
            console.log('📝 Field values changed:', payload.eventType);
            onDataChange();
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime status:', status);
        });
    };

    setupSubscription();

    return () => {
      console.log('🧹 Cleaning up realtime subscription');
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [projectId, enabled, onDataChange]);
}