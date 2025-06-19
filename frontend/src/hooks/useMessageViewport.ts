import { useEffect, useRef, useCallback, useState } from 'react';
import { debounce } from 'lodash-es';

interface ViewportInfo {
  messageIndex: number | null;
  messageId: string | null;
  isManuallySelected: boolean;
}

interface UseMessageViewportOptions {
  messages: any[];
  conversationId: string | null;
  onViewportChange?: (messageIndex: number | null, messageId: string | null) => void;
  debounceMs?: number;
}

export function useMessageViewport({
  messages,
  conversationId,
  onViewportChange,
  debounceMs = 300
}: UseMessageViewportOptions) {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    messageIndex: null,
    messageId: null,
    isManuallySelected: false
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isManualSelectionRef = useRef(false);

  // Register a message element
  const registerMessage = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element);
    } else {
      messageRefs.current.delete(messageId);
    }
  }, []);

  // Calculate which message is in the center of the viewport
  const calculateViewportMessage = useCallback((): { messageIndex: number; messageId: string } | null => {
    if (!containerRef.current || messages.length === 0 || isManualSelectionRef.current) {
      return null;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const viewportCenter = containerRect.top + containerRect.height / 2;

    let closestMessage: { messageIndex: number; messageId: string } | null = null;
    let closestDistance = Infinity;

    messages.forEach((message, index) => {
      const messageElement = messageRefs.current.get(message.id);
      if (!messageElement) return;

      const messageRect = messageElement.getBoundingClientRect();
      const messageCenter = messageRect.top + messageRect.height / 2;
      const distance = Math.abs(messageCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMessage = { messageIndex: index, messageId: message.id };
      }
    });

    return closestMessage;
  }, [messages]);

  // Debounced scroll handler
  const debouncedScrollHandler = useCallback(
    debounce(() => {
      const result = calculateViewportMessage();
      if (result) {
        const newViewportInfo = {
          messageIndex: result.messageIndex,
          messageId: result.messageId,
          isManuallySelected: false
        };
        
        setViewportInfo(prev => {
          // Only update if something actually changed
          if (prev.messageIndex !== result.messageIndex) {
            onViewportChange?.(result.messageIndex, result.messageId);
            return newViewportInfo;
          }
          return prev;
        });
      }
    }, debounceMs),
    [calculateViewportMessage, onViewportChange, debounceMs]
  );

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isManualSelectionRef.current) {
        debouncedScrollHandler();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      debouncedScrollHandler.cancel();
    };
  }, [debouncedScrollHandler]);

  // Manual message selection
  const selectMessage = useCallback((messageIndex: number, messageId: string) => {
    isManualSelectionRef.current = true;
    
    const newViewportInfo = {
      messageIndex,
      messageId,
      isManuallySelected: true
    };
    
    setViewportInfo(newViewportInfo);
    onViewportChange?.(messageIndex, messageId);

    // Clear manual selection after 5 seconds
    setTimeout(() => {
      isManualSelectionRef.current = false;
      // Trigger immediate recalculation
      const result = calculateViewportMessage();
      if (result) {
        setViewportInfo({
          messageIndex: result.messageIndex,
          messageId: result.messageId,
          isManuallySelected: false
        });
        onViewportChange?.(result.messageIndex, result.messageId);
      }
    }, 5000);
  }, [calculateViewportMessage, onViewportChange]);

  // Reset when conversation changes
  useEffect(() => {
    setViewportInfo({
      messageIndex: null,
      messageId: null,
      isManuallySelected: false
    });
    isManualSelectionRef.current = false;
    messageRefs.current.clear();
  }, [conversationId]);

  // Initial calculation when messages change
  useEffect(() => {
    if (messages.length > 0 && !isManualSelectionRef.current) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        debouncedScrollHandler();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length, debouncedScrollHandler]);

  return {
    containerRef,
    registerMessage,
    selectMessage,
    viewportInfo,
    clearManualSelection: () => {
      isManualSelectionRef.current = false;
    }
  };
}