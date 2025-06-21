import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { HumanMessage, HumanChatRoomInfo } from '@/types/social';
import { Send, Users, MessageCircle, X } from 'lucide-react';

interface HumanChatPanelProps {
  conversationId: number;
  currentUserId: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function HumanChatPanel({ 
  conversationId, 
  currentUserId, 
  isOpen, 
  onToggle 
}: HumanChatPanelProps) {
  const [messages, setMessages] = useState<HumanMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canChat, setCanChat] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadChatInfo();
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isOpen, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatInfo = async () => {
    try {
      const response = await api.get(`/human-chat/conversations/${conversationId}/chat-info`);
      const chatInfo: HumanChatRoomInfo = response.data;
      
      setMessages(chatInfo.recent_messages);
      setOnlineUsers(chatInfo.online_users);
      setCanChat(chatInfo.can_chat);
    } catch (error: any) {
      console.error('Failed to load chat info:', error);
      toast({
        title: "Error",
        description: "Failed to load chat information",
        variant: "destructive",
      });
    }
  };

  const connectWebSocket = () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token available for WebSocket');
        return;
      }

      const wsUrl = `ws://localhost:8000/api/ws/conversations/${conversationId}?token=${encodeURIComponent(token)}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Human chat WebSocket connected');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Human chat WebSocket disconnected');
        setIsConnected(false);
      };

      wsRef.current.onerror = (error) => {
        console.error('Human chat WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'human_message':
        const newMessage: HumanMessage = data.data;
        setMessages(prev => [...prev, newMessage]);
        break;
      
      case 'message_deleted':
        const { message_id } = data.data;
        setMessages(prev => prev.filter(msg => msg.id !== message_id));
        break;
      
      case 'user_joined':
        const joinedUserId = data.data.user_id;
        setOnlineUsers(prev => [...new Set([...prev, joinedUserId])]);
        break;
      
      case 'user_left':
        const leftUserId = data.data.user_id;
        setOnlineUsers(prev => prev.filter(id => id !== leftUserId));
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isLoading || !canChat) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post(`/human-chat/conversations/${conversationId}/messages`, {
        content: newMessage.trim()
      });
      
      // Message will be added via WebSocket, so just clear the input
      setNewMessage('');
      
      toast({
        title: "Message sent",
        description: "Your message has been sent to the chat",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to send message';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/human-chat/conversations/${conversationId}/messages/${messageId}`);
      
      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to delete message';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50 shadow-lg gap-2"
      >
        <MessageCircle className="h-4 w-4" />
        Chat
        {onlineUsers.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {onlineUsers.length}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 h-96 z-50 shadow-xl flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Chat
            {isConnected ? (
              <Badge variant="default" className="text-xs">
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Disconnected
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{onlineUsers.length} online</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-3">
        {/* Messages */}
        <ScrollArea className="flex-1 pr-3 mb-3">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.user_id === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-2 rounded-lg ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className="text-xs font-medium mb-1">
                          {message.user_display_name}
                        </div>
                      )}
                      <div className="text-sm">{message.content}</div>
                      <div className="flex items-center justify-between mt-1">
                        <div className={`text-xs ${
                          isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {formatTime(message.sent_at)}
                        </div>
                        {isOwnMessage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMessage(message.id)}
                            className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        {canChat ? (
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading || !isConnected}
              className="flex-1"
              maxLength={500}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newMessage.trim() || isLoading || !isConnected}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-2">
            Chat is not available for this conversation
          </div>
        )}
      </CardContent>
    </Card>
  );
}