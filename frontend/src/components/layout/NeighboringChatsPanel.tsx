"use client";

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareIcon, Loader2, AlertTriangleIcon, ClockIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SimilarConversation {
  id: number;
  title: string;
  summary: string;
  similarity_score: number;
  author: {
    username: string;
  };
}

interface NeighboringChatsPanelProps {
  conversationId: number;
  onConversationSelect: (conversationId: number) => void;
}

export default function NeighboringChatsPanel({ 
  conversationId, 
  onConversationSelect 
}: NeighboringChatsPanelProps) {
  const [conversations, setConversations] = useState<SimilarConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchSimilarConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/conversations/${conversationId}/similar?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch similar conversations: ${response.status}`);
      }

      const data = await response.json();
      
      if (mountedRef.current) {
        setConversations(data.conversations || []);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error loading similar conversations');
        setConversations([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const startPolling = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new polling interval (15 seconds)
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchSimilarConversations();
      }
    }, 15000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    setError(null);

    // Fetch initial data
    fetchSimilarConversations();
    
    // Start polling
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [conversationId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  const formatSimilarityScore = (score: number) => {
    return Math.round(score * 100);
  };

  const truncateText = (text: string, maxLength = 120) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex items-center justify-center py-8 text-muted-foreground"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>Finding similar conversations...</span>
        </motion.div>
      );
    }

    if (error) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="p-3 m-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs"
        >
          <div className="flex items-center">
            <AlertTriangleIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <p className="font-semibold">Error loading similar conversations</p>
          </div>
          <p className="mt-1 pl-6">{error}</p>
        </motion.div>
      );
    }

    if (conversations.length === 0) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-center py-10 px-3"
        >
          <MessageSquareIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium text-foreground">No similar conversations found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Similar conversations will appear here as your chat develops
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
        <AnimatePresence>
          {conversations.map((conv, index) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
              exit={{ opacity: 0, x: -20 }}
              layout
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent 
                  className="p-3"
                  onClick={() => onConversationSelect(conv.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                      {conv.title}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className="ml-2 text-xs px-1.5 py-0.5 flex-shrink-0"
                    >
                      {formatSimilarityScore(conv.similarity_score)}%
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {truncateText(conv.summary)}
                  </p>
                  
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>by {conv.author.username}</span>
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border/60">
        <h3 className="text-sm font-medium text-foreground">Similar Conversations</h3>
        <div className="flex items-center text-xs text-muted-foreground">
          <ClockIcon className="h-3 w-3 mr-1" />
          <span>Updates every 15s</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3">
          {renderContent()}
        </div>
      </ScrollArea>
    </div>
  );
}