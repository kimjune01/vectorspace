import { useState, useEffect, useRef } from 'react';
import type { WebSocketMessage } from './useWebSocket';

interface PresenceUser {
  user_id: number;
  username: string;
  joined_at: number;
  last_seen?: number;
  current_message_index?: number;
  current_message_id?: string;
}

export function usePresence(conversationId: string | null) {
  const [participants, setParticipants] = useState<PresenceUser[]>([]);
  const [messageViewers, setMessageViewers] = useState<Map<string, PresenceUser[]>>(new Map());
  const participantsRef = useRef<Map<number, PresenceUser>>(new Map());
  const messageViewersRef = useRef<Map<string, PresenceUser[]>>(new Map());

  const handlePresenceUpdate = (message: WebSocketMessage) => {
    if (message.type !== 'presence_update' && message.type !== 'scroll_update') return;
    
    if (message.type === 'presence_update') {
      if (message.action === 'joined' && message.user_id && message.username) {
        // Add or update participant
        participantsRef.current.set(message.user_id, {
          user_id: message.user_id,
          username: message.username,
          joined_at: (message.timestamp as number) || Date.now(),
          last_seen: (message.timestamp as number) || Date.now()
        });
      } else if (message.action === 'left' && message.user_id) {
        // Remove participant
        participantsRef.current.delete(message.user_id);
        
        // Remove from all message viewers
        for (const [messageId, viewers] of messageViewersRef.current.entries()) {
          const filteredViewers = viewers.filter(v => v.user_id !== message.user_id);
          if (filteredViewers.length > 0) {
            messageViewersRef.current.set(messageId, filteredViewers);
          } else {
            messageViewersRef.current.delete(messageId);
          }
        }
      }
      
      // Update state with new array
      setParticipants(Array.from(participantsRef.current.values()));
      setMessageViewers(new Map(messageViewersRef.current));
    } else if (message.type === 'scroll_update' && message.user_id && message.username) {
      // Handle scroll position updates
      const participant = participantsRef.current.get(message.user_id);
      if (participant && 'current_message_index' in message && 'current_message_id' in message) {
        // Update participant's current message
        const updatedParticipant = {
          ...participant,
          current_message_index: message.current_message_index as number,
          current_message_id: message.current_message_id as string,
          last_seen: (message.timestamp as number) || Date.now()
        };
        participantsRef.current.set(message.user_id, updatedParticipant);
        
        // Update message viewers mapping
        const currentMessageId = message.current_message_id as string;
        if (currentMessageId) {
          // Remove user from all other messages
          for (const [messageId, viewers] of messageViewersRef.current.entries()) {
            if (messageId !== currentMessageId) {
              const filteredViewers = viewers.filter(v => v.user_id !== message.user_id);
              if (filteredViewers.length > 0) {
                messageViewersRef.current.set(messageId, filteredViewers);
              } else {
                messageViewersRef.current.delete(messageId);
              }
            }
          }
          
          // Add user to current message
          const existingViewers = messageViewersRef.current.get(currentMessageId) || [];
          const otherViewers = existingViewers.filter(v => v.user_id !== message.user_id);
          messageViewersRef.current.set(currentMessageId, [...otherViewers, updatedParticipant]);
        }
        
        setParticipants(Array.from(participantsRef.current.values()));
        setMessageViewers(new Map(messageViewersRef.current));
      }
    }
  };

  // Clear participants when conversation changes
  useEffect(() => {
    participantsRef.current.clear();
    messageViewersRef.current.clear();
    setParticipants([]);
    setMessageViewers(new Map());
  }, [conversationId]);

  // Send scroll position update
  const updateScrollPosition = (messageIndex: number | null, messageId: string | null) => {
    // This would be handled by the parent component to send via WebSocket
    return { messageIndex, messageId };
  };
  
  // Get viewers for a specific message
  const getMessageViewers = (messageId: string): PresenceUser[] => {
    return messageViewers.get(messageId) || [];
  };

  return {
    participants,
    participantCount: participants.length,
    messageViewers,
    handlePresenceUpdate,
    updateScrollPosition,
    getMessageViewers
  };
}