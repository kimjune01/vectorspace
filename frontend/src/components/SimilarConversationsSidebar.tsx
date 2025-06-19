import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, MessageSquare, Clock, User, Eye, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api';
import type { Conversation } from '@/types';

interface SimilarConversationsSidebarProps {
  currentConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
}

interface SimilarConversation {
  id: number;
  title: string;
  summary: string;
  created_at: string;
  view_count: number;
  similarity_score: number;
  author: {
    username: string;
    display_name: string;
  };
}

export default function SimilarConversationsSidebar({
  currentConversation,
  onConversationSelect,
  onNewChat
}: SimilarConversationsSidebarProps) {
  const [similarConversations, setSimilarConversations] = useState<SimilarConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentConversation?.summary_public) {
      fetchSimilarConversations();
    } else {
      setSimilarConversations([]);
    }
  }, [currentConversation?.id, currentConversation?.summary_public]);

  const fetchSimilarConversations = async () => {
    if (!currentConversation?.id) return;

    try {
      setIsLoading(true);
      setError(undefined);
      
      const data = await apiClient.getSimilarConversations(currentConversation.id.toString(), 20);
      // The API returns conversations already sorted by similarity score
      setSimilarConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching similar conversations:', error);
      setError('Failed to load similar conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationClick = (similarConv: SimilarConversation) => {
    // Convert SimilarConversation to Conversation type
    const conversation: Conversation = {
      id: similarConv.id,
      title: similarConv.title,
      user_id: 0, // Not available in similar conversation data
      is_public: true, // Similar conversations are always public
      is_hidden_from_profile: false,
      created_at: similarConv.created_at,
      last_message_at: similarConv.created_at,
      summary_public: similarConv.summary,
      archived_at: undefined,
      view_count: similarConv.view_count,
      token_count: 0 // Not available in similar conversation data
    };
    
    onConversationSelect(conversation);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm"
        >
          <div className="flex items-center mb-2">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-xs">{error}</p>
        </motion.div>
      );
    }

    if (!currentConversation) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="text-center py-10 px-3"
        >
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Welcome to VectorSpace</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start a conversation to discover similar chats from the community
          </p>
        </motion.div>
      );
    }

    if (!currentConversation.summary_public) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="text-center py-10 px-3"
        >
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Building Summary</h3>
          <p className="text-sm text-muted-foreground">
            Similar conversations will appear here once your chat is summarized
          </p>
        </motion.div>
      );
    }

    if (similarConversations.length === 0) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="text-center py-10 px-3"
        >
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">No Similar Conversations</h3>
          <p className="text-sm text-muted-foreground">
            This conversation is unique! Keep chatting to discover connections.
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="space-y-3"
      >
        <div className="text-xs font-medium text-muted-foreground px-2 mb-4">
          Similar Conversations ({similarConversations.length})
        </div>
        <AnimatePresence>
          {similarConversations.map((conv, index) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                transition: { delay: index * 0.05 } 
              }}
              exit={{ opacity: 0, x: -20 }}
              layout
            >
              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20"
                onClick={() => handleConversationClick(conv)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm line-clamp-2 flex-1">
                      {conv.title}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className="ml-2 text-xs"
                    >
                      {Math.round(conv.similarity_score * 100)}%
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {conv.summary}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[100px]">
                        {conv.author.display_name || conv.author.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{conv.view_count}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(conv.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-background border-r border-border/60">
      {/* Header */}
      <div className="p-3 border-b border-border/60">
        <Button
          variant="outline"
          className="w-full justify-start text-sm hover:bg-muted/50"
          onClick={onNewChat}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-grow">
        <div className="p-3">
          {renderContent()}
        </div>
      </ScrollArea>
    </div>
  );
}