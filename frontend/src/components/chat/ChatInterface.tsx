import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { Send, Bot, User, Loader2, LogIn } from 'lucide-react';
import { useWebSocket, type WebSocketMessage } from '@/hooks/useWebSocket';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: Message[];
  isTemporary?: boolean;
  onCreateConversation?: (firstMessage?: string) => Promise<any>;
  onNewMessage?: () => void;
  onTitleUpdate?: (newTitle: string) => void;
}

export function ChatInterface({ conversationId, initialMessages = [], isTemporary = false, onCreateConversation, onNewMessage, onTitleUpdate }: ChatInterfaceProps) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const wsUrl = conversationId && isAuthenticated && !isTemporary ? apiClient.getWebSocketUrl(conversationId) : null;

  const { isConnected, connectionStatus, sendMessage } = useWebSocket(wsUrl, {
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });

  // Update messages when initialMessages prop changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Check for pending message to send when conversation loads
  useEffect(() => {
    if (!isTemporary && conversationId && isConnected) {
      const pendingMessage = localStorage.getItem(`pending-message-${conversationId}`);
      if (pendingMessage) {
        localStorage.removeItem(`pending-message-${conversationId}`);
        setNewMessage(pendingMessage);
        // Auto-send the pending message after a brief delay
        setTimeout(() => {
          sendMessage({
            type: 'send_message',
            content: pendingMessage,
          });
        }, 500);
      }
    }
  }, [conversationId, isConnected, isTemporary, sendMessage]);

  const handleWebSocketMessage = (wsMessage: WebSocketMessage) => {
    if (wsMessage.type === 'new_message') {
      const msgData = wsMessage.message;
      if (msgData) {
        const message: Message = {
          id: msgData.id,
          conversation_id: msgData.conversation_id,
          from_user_id: msgData.from_user_id || undefined,
          from_user_username: msgData.from_user_username,
          from_user_display_name: msgData.from_user_display_name,
          role: msgData.role as 'user' | 'assistant' | 'system',
          message_type: msgData.message_type as 'system' | 'chat' | 'visitor_message',
          content: msgData.content,
          token_count: 0,
          parent_message_id: msgData.parent_message_id,
          timestamp: msgData.timestamp,
        };
        
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
        onNewMessage?.();
        
        // If this was a user message, set loading for AI response
        if (msgData.role === 'user') {
          setIsLoading(true);
        }
      }
    }
    
    if (wsMessage.type === 'ai_response_complete') {
      setIsLoading(false);
    }
    
    if (wsMessage.type === 'ai_response_error') {
      setIsLoading(false);
    }
    
    if (wsMessage.type === 'title_updated') {
      console.log('Title updated:', wsMessage.new_title);
      if (wsMessage.new_title) {
        onTitleUpdate?.(wsMessage.new_title);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    if (!isAuthenticated) return;
    
    // Prevent double sends while loading
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // If this is a temporary conversation, create the actual conversation first
      if (isTemporary && onCreateConversation) {
        await onCreateConversation(newMessage.trim());
        // The conversation creation will redirect to the new URL,
        // so we don't need to send the message here
        return;
      }
      
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const success = sendMessage({
        type: 'send_message',
        content: newMessage,
      });

      if (success) {
        setNewMessage('');
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          {isTemporary ? (
            <>
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium">Draft Conversation</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></div>
              <span className="text-sm font-medium">
                {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isTemporary && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
              Not saved yet
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {messages.length} messages
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {!isAuthenticated ? (
            <div className="text-center py-8">
              <LogIn className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-2">
                Sign in to participate in conversations
              </p>
              <p className="text-xs text-muted-foreground">
                You can browse public conversations without an account
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                Start a conversation with AI
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
                data-role={message.role}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <div className={`flex flex-col gap-1 ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <Card className={`p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      {message.role === 'assistant' ? (
                        <MarkdownContent 
                          content={message.content} 
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </Card>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                </div>
                <Card className="p-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </Card>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isAuthenticated ? "Type your message..." : "Sign in to send messages"}
            disabled={!isAuthenticated || !isConnected || isLoading}
            className="flex-1"
            data-testid="message-input"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isAuthenticated || !newMessage.trim() || !isConnected || isLoading}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isAuthenticated 
            ? "Press Enter to send, Shift+Enter for new line"
            : "Sign in to participate in conversations"
          }
        </p>
      </div>
    </div>
  );
}