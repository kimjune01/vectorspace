import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Send, User, Menu, LogOut, Loader2, AlertTriangle, Settings, Search, UserIcon, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Conversation } from '@/types';
import EnhancedSidebar from '@/components/layout/EnhancedSidebar';
import PresenceIndicator from '@/components/PresenceIndicator';
import MessageWithPresence from '@/components/MessageWithPresence';
import { useMessageViewport } from '@/hooks/useMessageViewport';
import { usePresence } from '@/hooks/usePresence';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export default function HomePage() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const presenceUpdateHandlerRef = useRef<((message: any) => void) | null>(null);
  
  // Presence and viewport tracking
  const { getMessageViewers, handlePresenceUpdate } = usePresence(currentConversation?.id?.toString() || null);

  // WebSocket connection for real-time chat
  const wsUrl = activeConversationId ? (() => {
    try {
      return apiClient.getWebSocketUrl(activeConversationId);
    } catch (error) {
      console.error('❌ Failed to generate WebSocket URL:', error);
      setError('Authentication error: Please refresh the page');
      return null;
    }
  })() : null;
  const { sendMessage: wsSendMessage, isConnected, connectionStatus, connect: wsConnect, disconnect: wsDisconnect, wsRef } = useWebSocket(wsUrl, {
    onMessage: (message) => {
      console.log('📩 WebSocket message received:', message);
      if (message.type === 'new_message') {
        const msgData = message.message;
        console.log('📝 Processing new_message:', msgData);
        if (msgData) {
          const newMessage: Message = {
            id: msgData.id.toString(),
            content: msgData.content,
            role: msgData.role as 'user' | 'assistant',
            timestamp: msgData.timestamp
          };
          console.log('✅ Adding message to state:', newMessage);
          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) {
              console.log('🚫 Message already exists, skipping:', newMessage.id);
              return prev;
            }
            console.log('➕ Adding new message to messages array');
            return [...prev, newMessage];
          });
        }
      } else if (message.type === 'ai_response_chunk') {
        // Handle streaming AI response
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === message.message_id) {
            // Append to existing AI message
            return prev.map(msg => 
              msg.id === message.message_id 
                ? { ...msg, content: msg.content + message.content }
                : msg
            );
          } else {
            // Create new AI message
            return [...prev, {
              id: message.message_id || Date.now().toString(),
              content: message.content || '',
              role: 'assistant',
              timestamp: new Date().toISOString()
            }];
          }
        });
      } else if (message.type === 'ai_response_complete') {
        console.log('AI response completed');
        setIsLoading(false);
      } else if (message.type === 'error') {
        setError(message.content || 'An error occurred');
        setIsLoading(false);
      } else if (message.type === 'presence_update' || message.type === 'scroll_update') {
        // Handle presence and scroll updates
        presenceUpdateHandlerRef.current?.(message);
      } else if (message.type === 'title_updated') {
        console.log('Title updated:', message.new_title);
        // Update current conversation title
        if (currentConversation && message.conversation_id === currentConversation.id && message.new_title) {
          setCurrentConversation(prev => prev ? { ...prev, title: message.new_title as string } : null);
        }
      } else if (message.type === 'connection_established') {
        console.log('WebSocket connection established:', message);
      }
    },
    onError: () => {
      setError('Connection error occurred');
    },
    onClose: () => {
      console.log('WebSocket disconnected');
      setIsLoading(false);
    }
  });

  // Debug WebSocket connection state
  useEffect(() => {
    console.log('WebSocket state changed:', { 
      activeConversationId, 
      wsUrl, 
      isConnected, 
      connectionStatus 
    });
  }, [activeConversationId, wsUrl, isConnected, connectionStatus]);

  // Handle WebSocket connection establishment for message sending
  useEffect(() => {
    if (activeConversationId && isConnected && pendingMessage) {
      console.log('✅ WebSocket connected for conversation:', activeConversationId, 'sending pending message');
      
      // Send the pending message
      const success = wsSendMessage({
        type: 'send_message',
        content: pendingMessage,
        role: 'user'
      });

      if (success) {
        console.log('✅ Pending message sent successfully');
        setPendingMessage(null);
      } else {
        console.error('❌ Failed to send pending message');
        setError('Failed to send message');
        setIsLoading(false);
        setInput(pendingMessage); // Restore the message to input
        setPendingMessage(null);
      }
    }
  }, [activeConversationId, isConnected, pendingMessage, wsSendMessage]);
  
  const {
    containerRef,
    registerMessage,
    selectMessage,
    viewportInfo
  } = useMessageViewport({
    messages,
    conversationId: currentConversation?.id?.toString() || null,
    onViewportChange: (messageIndex, messageId) => {
      // Send scroll position update via WebSocket
      if (isConnected && messageIndex !== null && messageId !== null) {
        wsSendMessage({
          type: 'scroll_update',
          current_message_index: messageIndex,
          current_message_id: messageId,
          timestamp: Date.now()
        });
      }
    }
  });

  // Initialize presence update handler
  useEffect(() => {
    presenceUpdateHandlerRef.current = handlePresenceUpdate;
  }, [handlePresenceUpdate]);

  // Note: Login is now optional - users can use the app without authentication

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewConversation = async () => {
    if (!input.trim()) return;
    
    if (!isAuthenticated) {
      setError('Please sign in to start a new conversation');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      
      // Create new conversation
      const conversation = await apiClient.createConversation(
        `Chat ${new Date().toLocaleDateString()}`,
        undefined
      );
      
      setCurrentConversation(conversation);
      setActiveConversationId(conversation.id.toString());
      
      // Use the conversation ID directly to avoid race condition
      const conversationId = conversation.id.toString();
      
      // Set the pending message and let useEffect handle sending when connected
      console.log('💾 Setting pending message for new conversation');
      setPendingMessage(input);
      setInput(''); // Clear input immediately
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setError('Failed to start new conversation');
      setIsLoading(false);
    }
  };

  const sendMessage = async (conversationId?: string) => {
    console.log('📨 sendMessage called with:', { conversationId, inputLength: input.trim().length });
    
    if (!input.trim() || !isAuthenticated) {
      return;
    }
    
    const targetConversationId = conversationId || currentConversation?.id;
    if (!targetConversationId) {
      await startNewConversation();
      return;
    }

    // Simply ensure we're connected to the right conversation
    if (activeConversationId !== targetConversationId.toString()) {
      setActiveConversationId(targetConversationId.toString());
      // Give it a moment to connect
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Simple connection check
    if (!isConnected) {
      setError('Connection not ready. Please try again.');
      return;
    }

    // Send message immediately
    const messageContent = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    const success = wsSendMessage({
      type: 'send_message',
      content: messageContent,
      role: 'user'
    });

    if (!success) {
      setError('Failed to send message');
      setIsLoading(false);
      setInput(messageContent);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🎯 Form submitted. Current conversation:', currentConversation?.id);
    if (currentConversation) {
      console.log('📤 Sending message to existing conversation');
      await sendMessage();
    } else {
      console.log('🆕 Starting new conversation');
      await startNewConversation();
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    setError(null);
    setActiveConversationId(null); // This will disconnect WebSocket
    setIsSidebarOpen(false);
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    setError(null);
    setActiveConversationId(conversation.id.toString()); // This will connect to new conversation's WebSocket
    setIsSidebarOpen(false);
    
    try {
      // Load conversation messages
      const conversationData = await apiClient.getConversation(conversation.id.toString());
      const loadedMessages: Message[] = conversationData.messages?.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp
      })) || [];
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation');
    }
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Note: Removed login requirement - users can now access the app without authentication

  const sidebarContent = (
    <EnhancedSidebar
      onSessionSelect={async (sessionId) => {
        // Handle session selection for My Chats tab - load the conversation
        try {
          const conversationData = await apiClient.getConversation(sessionId);
          await handleConversationSelect(conversationData);
        } catch (error) {
          console.error('Failed to load conversation from session select:', error);
          setError('Failed to load conversation');
        }
      }}
      onNewChat={handleNewChat}
      currentSessionId={currentConversation?.id?.toString() || null}
      onSearchResultSelect={(messageId, sessionId) => {
        // Handle search result selection
        console.log('Search result selected:', messageId, sessionId);
      }}
      currentConversation={currentConversation}
      onConversationSelect={handleConversationSelect}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-b from-background to-background/95">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 md:w-72">
          {sidebarContent}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-background/60 backdrop-blur-xl border-b border-border/40 p-3 sm:p-4 flex justify-between items-center sticky top-0 z-30"
        >
          <div className="flex items-center space-x-2">
            {/* Mobile Sidebar Toggle */}
            <div className="md:hidden">
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 sm:w-80 bg-background">
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            </div>
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              {currentConversation ? currentConversation.title : 'VectorSpace'}
            </motion.h1>
            
            {/* Presence Indicator */}
            <PresenceIndicator 
              conversationId={currentConversation?.id?.toString() || null}
              currentUserId={user?.id}
              onPresenceUpdate={(handler) => {
                presenceUpdateHandlerRef.current = handler;
              }}
            />
            
            {/* Mock Summary Generation Button - for testing HN recommendations */}
            {currentConversation && !currentConversation.summary_public && isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    const result = await apiClient.regenerateSummary(currentConversation.id.toString());
                    if (result.success) {
                      // Update current conversation with new summary and title
                      setCurrentConversation(prev => prev ? {
                        ...prev,
                        summary_public: result.summary,
                        title: result.title
                      } : null);
                    }
                  } catch (error) {
                    console.error('Failed to generate summary:', error);
                    setError('Failed to generate summary');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="text-xs"
              >
                📝 Generate Summary
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <>
                <Link 
                  to={`/profile/${user?.username}`}
                  className="text-xs sm:text-sm text-muted-foreground hidden md:block hover:text-foreground transition-colors"
                >
                  {user?.display_name || user?.username}
                </Link>
                
                {/* Settings Dropdown Menu - Authenticated */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-foreground/10 transition-colors"
                        title="Settings & More"
                      >
                        <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </motion.div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        {user?.username}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild>
                      <Link to="/discover" className="flex items-center cursor-pointer">
                        <Search className="mr-2 h-4 w-4" />
                        Discover Conversations
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link to={`/profile/${user?.username}`} className="flex items-center cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={() => logout()}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* Settings Dropdown Menu - Unauthenticated */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-foreground/10 transition-colors"
                      title="Options"
                    >
                      <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    </Button>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>VectorSpace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link to="/discover" className="flex items-center cursor-pointer">
                      <Search className="mr-2 h-4 w-4" />
                      Discover Conversations
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link to="/login" className="flex items-center cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign In
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to="/register" className="flex items-center cursor-pointer">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sign Up
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </motion.header>

        {/* Messages Area with Scroll-based Presence */}
        <ScrollArea className="flex-grow relative" ref={containerRef}>
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/5 to-background/10" />
          </div>
          <div className="p-4 sm:p-6 space-y-4 relative z-10">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <MessageWithPresence
                  key={message.id}
                  message={message}
                  messageIndex={index}
                  viewers={getMessageViewers(message.id)}
                  currentUserId={user?.id}
                  isCurrentlyViewed={viewportInfo.messageId === message.id}
                  onRegister={registerMessage}
                  onMessageClick={selectMessage}
                />
              ))}
            </AnimatePresence>
            
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-full text-muted-foreground"
              >
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Welcome to VectorSpace</h3>
                  <p>Start a conversation and discover similar chats from the community</p>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="p-3 sm:p-4 border-t border-border/40 bg-background/60 backdrop-blur-sm"
            >
              <Card className="bg-destructive/5 border-destructive/30 p-3 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Error</span>
                </div>
                <p className="text-xs text-destructive/90 mt-2 pl-7">{error}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Input */}
        <motion.footer 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-background/60 backdrop-blur-xl border-t border-border/40 p-3 sm:p-4 sticky bottom-0 z-50"
        >
          <form onSubmit={handleSubmit} className="flex items-center space-x-2 sm:space-x-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentConversation ? "Type your message..." : "Start a new conversation..."}
              className="flex-grow h-10 sm:h-11 rounded-full bg-muted/30 focus:bg-muted/50 backdrop-blur-sm border-border/40 focus-visible:ring-ring/50 focus-visible:ring-1 text-sm sm:text-base px-4 transition-all duration-200"
              disabled={isLoading}
              autoFocus
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-full w-10 h-10 sm:w-11 sm:h-11 p-0 flex-shrink-0 bg-primary hover:bg-primary/90 transition-colors"
                title="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </motion.div>
          </form>
        </motion.footer>
      </div>
    </div>
  );
}