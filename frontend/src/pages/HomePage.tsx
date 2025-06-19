import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Send, User, Bot, Menu, LogOut, Loader2, AlertTriangle, Settings, Search, UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import type { Conversation } from '@/types';
import SimilarConversationsSidebar from '@/components/SimilarConversationsSidebar';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to login if not authenticated (but wait for auth to load)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('HomePage: Redirecting to login - not authenticated');
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewConversation = async () => {
    if (!input.trim()) return;
    
    try {
      setError(null);
      setIsLoading(true);
      
      // Create new conversation
      const conversation = await apiClient.createConversation(
        `Chat ${new Date().toLocaleDateString()}`,
        undefined
      );
      
      setCurrentConversation(conversation);
      await sendMessage(conversation.id);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setError('Failed to start new conversation');
    }
  };

  const sendMessage = async (conversationId?: string) => {
    if (!input.trim()) return;
    
    const targetConversationId = conversationId || currentConversation?.id;
    if (!targetConversationId) {
      await startNewConversation();
      return;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    setInput('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Connect to WebSocket for real-time AI responses
      const wsUrl = apiClient.getWebSocketUrl(targetConversationId.toString());
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWs(websocket);
        
        // Send the user message
        websocket.send(JSON.stringify({
          type: 'message',
          content: messageContent
        }));
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            const aiMessage: Message = {
              id: data.id || Date.now().toString(),
              content: data.content,
              role: 'assistant',
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMessage]);
          } else if (data.type === 'error') {
            setError(data.message || 'An error occurred');
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error occurred');
      };
      
      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setWs(null);
        setIsLoading(false);
      };
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentConversation) {
      await sendMessage();
    } else {
      await startNewConversation();
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    setError(null);
    ws?.close();
    setWs(null);
    setIsSidebarOpen(false);
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    setError(null);
    ws?.close();
    setWs(null);
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

  // Show login redirect message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Welcome to VectorSpace</h1>
          <p className="text-muted-foreground mb-4">Please sign in to start chatting</p>
          <div className="flex gap-2 justify-center">
            <Link to="/login">
              <Button>Sign In</Button>
            </Link>
            <Link to="/register">
              <Button variant="outline">Sign Up</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <SimilarConversationsSidebar
      currentConversation={currentConversation}
      onConversationSelect={handleConversationSelect}
      onNewChat={handleNewChat}
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
          </div>
          <div className="flex items-center space-x-3">
            <p className="text-xs sm:text-sm text-muted-foreground hidden md:block">
              Welcome, {user?.username}!
            </p>
            
            {/* Settings Dropdown Menu */}
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
          </div>
        </motion.header>

        {/* Messages Area */}
        <ScrollArea className="flex-grow relative">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/5 to-background/10" />
          </div>
          <div className="p-4 sm:p-6 space-y-6 relative z-10">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} transition-all duration-500 ease-out`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] sm:max-w-[70%] ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      {message.role === 'assistant' ? (
                        <Avatar className="w-8 h-8 border-2 border-primary/20">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot size={18}/>
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Avatar className="w-8 h-8 border-2 border-muted-foreground/20">
                          <AvatarFallback className="bg-muted-foreground/10 text-muted-foreground">
                            <User size={18}/>
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="flex-1"
                    >
                      <Card className={`
                        rounded-xl shadow-lg transition-shadow hover:shadow-xl
                        ${message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : 'bg-card/50 backdrop-blur-sm text-card-foreground rounded-bl-none'
                        }
                      `}>
                        <CardContent className="p-3 text-sm leading-relaxed">
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                            {message.content}
                          </div>
                          <p className={`text-xs mt-2 ${
                            message.role === 'user'
                              ? 'text-primary-foreground/70 text-right'
                              : 'text-muted-foreground/70 text-left'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                </motion.div>
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