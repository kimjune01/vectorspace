import { useEffect, useRef, useState } from 'react';
import useWebSocketLib, { ReadyState } from 'react-use-websocket';

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
  const {
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const { sendMessage: libSendMessage, lastMessage, readyState } = useWebSocketLib(
    url,
    {
      share: true, // Share connections across components
      shouldReconnect: () => true,
      reconnectInterval,
      reconnectAttempts: maxReconnectAttempts,
      filter: (message) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.data);
          
          // Handle ping messages by responding with pong
          if (data.type === 'ping') {
            libSendMessage(JSON.stringify({
              type: 'pong',
              timestamp: data.timestamp
            }));
            return false; // Don't pass ping messages to the application
          }
          
          return true; // Pass other messages
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          return false;
        }
      },
      onOpen: () => {
        onOpen?.();
      },
      onClose: () => {
        onClose?.();
      },
      onError: (error) => {
        onError?.(error);
      }
    },
    Boolean(url) // Only connect if URL is provided
  );

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message: WebSocketMessage = JSON.parse(lastMessage.data);
        onMessage?.(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, onMessage]);

  // Map ReadyState to our connection status
  const connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 
    readyState === ReadyState.CONNECTING ? 'connecting' :
    readyState === ReadyState.OPEN ? 'connected' :
    readyState === ReadyState.CLOSING || readyState === ReadyState.CLOSED ? 'disconnected' :
    'error';

  const isConnected = readyState === ReadyState.OPEN;

  const sendMessage = (message: any) => {
    if (readyState === ReadyState.OPEN) {
      libSendMessage(JSON.stringify(message));
      return true;
    }
    return false;
  };

  // These are no-ops since react-use-websocket handles connection management
  const connect = () => {};
  const disconnect = () => {};

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
  };
}