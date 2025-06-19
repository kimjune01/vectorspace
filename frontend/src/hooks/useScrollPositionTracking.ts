import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollPercentage: number;
}

interface UseScrollPositionTrackingOptions {
  debounceMs?: number;
  reconnectDelay?: number;
  onOtherUserScroll?: (data: OtherUserScrollData) => void;
}

interface OtherUserScrollData {
  user_id: number;
  username: string;
  scroll_position: ScrollPosition;
}

export function useScrollPositionTracking(
  conversationId: number,
  enabled: boolean = true,
  options: UseScrollPositionTrackingOptions = {}
) {
  const {
    debounceMs = 100,
    reconnectDelay = 3000,
    onOtherUserScroll
  } = options;

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPositionRef = useRef<ScrollPosition | null>(null);

  // Send scroll position update
  const sendScrollUpdate = useCallback((position: ScrollPosition) => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      type: 'scroll_position_update',
      scroll_position: position
    };

    websocket.send(JSON.stringify(message));
  }, [websocket]);

  // Handle scroll event with debouncing
  const handleScroll = useCallback((scrollData: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) => {
    const scrollPercentage = (scrollData.scrollTop / scrollData.scrollHeight) * 100;
    
    const position: ScrollPosition = {
      ...scrollData,
      scrollPercentage
    };

    lastScrollPositionRef.current = position;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set new timeout for debounced update
    scrollTimeoutRef.current = setTimeout(() => {
      sendScrollUpdate(position);
    }, debounceMs);
  }, [sendScrollUpdate, debounceMs]);

  // Effect to manage WebSocket connection
  useEffect(() => {
    if (!enabled || !conversationId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = new WebSocket(
      `ws://localhost:8000/api/ws/conversations/${conversationId}?token=${token}`
    );

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected for scroll tracking');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected, attempting reconnect...');
      
      // Don't schedule reconnection here - it would cause infinite loop
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle scroll position updates from other users
        if (data.type === 'user_scroll_position' && onOtherUserScroll) {
          onOtherUserScroll({
            user_id: data.user_id,
            username: data.username,
            scroll_position: data.scroll_position
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    setWebsocket(ws);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.close();
    };
  }, [conversationId, enabled, reconnectDelay, onOtherUserScroll]);

  return {
    websocket,
    isConnected,
    handleScroll,
    lastScrollPosition: lastScrollPositionRef.current
  };
}