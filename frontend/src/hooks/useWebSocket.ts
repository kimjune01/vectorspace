import { useEffect, useRef, useState } from 'react';

export interface WebSocketMessage {
  type: 'message' | 'new_message' | 'ai_response_chunk' | 'ai_response_complete' | 'ai_response_error' | 'error' | 'conversation_archived' | 'presence_update' | 'connection_established' | 'scroll_update' | 'title_updated' | 'ping' | 'pong';
  content?: string;
  user_id?: number;
  username?: string;
  display_name?: string;
  timestamp?: string | number;
  message_id?: string;
  action?: 'joined' | 'left';
  conversation_id?: number;
  connection_id?: string;
  current_message_index?: number;
  current_message_id?: string;
  new_title?: string;
  message?: {
    id: number;
    conversation_id: number;
    from_user_id?: number;
    from_user_username?: string;
    from_user_display_name?: string;
    role: string;
    message_type: string;
    content: string;
    parent_message_id?: number;
    timestamp: string;
  };
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const connect = () => {
    if (!url || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔌 Attempting to connect to WebSocket:', url);
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle ping messages by responding with pong
          if (message.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: message.timestamp
            }));
            return; // Don't pass ping messages to the application
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onClose?.();

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
        setConnectionStatus('error');
        onError?.(error);
      };
    } catch (error) {
      setConnectionStatus('error');
      console.error('WebSocket connection error:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const sendMessage = (message: any) => {
    console.log('🔌 useWebSocket sendMessage called with:', message);
    console.log('🔌 WebSocket state:', { 
      exists: !!wsRef.current, 
      readyState: wsRef.current?.readyState,
      OPEN: WebSocket.OPEN 
    });
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket is OPEN, sending message...');
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('🔌 Message sent successfully');
        return true;
      } catch (error) {
        console.error('🔌 Error sending message:', error);
        return false;
      }
    } else {
      console.log('🔌 WebSocket not ready - readyState:', wsRef.current?.readyState);
      return false;
    }
  };

  useEffect(() => {
    console.log('🔌 useWebSocket useEffect triggered, url:', url);
    
    // Don't reconnect if we're already connected to the same URL
    if (url && wsRef.current?.url === url && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('🔌 Already connected to same URL, skipping reconnection');
      return;
    }
    
    if (url) {
      console.log('🔌 Connecting to URL:', url);
      connect();
    } else {
      console.log('🔌 No URL, disconnecting');
      disconnect();
    }

    return () => {
      console.log('🔌 useWebSocket cleanup, disconnecting');
      disconnect();
    };
  }, [url]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
    wsRef, // Expose the ref for debugging
  };
}