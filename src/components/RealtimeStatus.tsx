import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function RealtimeStatus() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Check the realtime connection status
    const checkConnection = () => {
      const channels = supabase.getChannels();
      const hasConnected = channels.some(channel => channel.state === 'joined');
      
      if (hasConnected) {
        setStatus('connected');
        setLastUpdate(new Date());
      } else if (channels.length > 0) {
        setStatus('connecting');
      } else {
        setStatus('disconnected');
      }
    };

    // Check immediately
    checkConnection();

    // Check periodically
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    console.log('🧪 Testing realtime connection...');
    
    // Get all active channels
    const channels = supabase.getChannels();
    console.log('Active channels:', channels.map(c => ({
      topic: c.topic,
      state: c.state,
      joined: c.isJoined()
    })));

    // Test database connection
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Database connection error:', error);
    } else {
      console.log('✅ Database connection successful');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={status === 'connected' ? 'default' : status === 'connecting' ? 'secondary' : 'destructive'}
        className="text-xs"
      >
        {status === 'connected' && <Wifi className="h-3 w-3 mr-1" />}
        {status === 'disconnected' && <WifiOff className="h-3 w-3 mr-1" />}
        {status === 'connecting' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
        {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting...' : 'Offline'}
      </Badge>
      
      {process.env.NODE_ENV === 'development' && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleTestConnection}
          className="text-xs h-6 px-2"
        >
          Test
        </Button>
      )}
      
      {lastUpdate && status === 'connected' && (
        <span className="text-xs text-muted-foreground">
          Last sync: {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}