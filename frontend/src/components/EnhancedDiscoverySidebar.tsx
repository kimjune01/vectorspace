import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  MessageSquare, 
  User, 
  Eye,
  Sparkles,
  Heart,
  BookmarkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation } from '@/types';
import type { SearchResult } from '@/types/api';

interface EnhancedDiscoverySidebarProps {
  currentConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
}

export default function EnhancedDiscoverySidebar({
  currentConversation,
  onConversationSelect,
  onNewChat
}: EnhancedDiscoverySidebarProps) {
  const { user } = useAuth();
  const [similarConversations, setSimilarConversations] = useState<SearchResult[]>([]);
  const [recentConversations, setRecentConversations] = useState<SearchResult[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentConversation?.summary_public) {
      fetchSimilarConversations();
    }
    fetchRecentConversations();
    fetchHnTopics();
  }, [currentConversation]);

  const fetchSimilarConversations = async () => {
    if (!currentConversation?.summary_public) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.searchConversations(currentConversation.summary_public, 1);
      // Filter out the current conversation
      const filtered = response.conversations.filter(c => c.id !== currentConversation.id);
      setSimilarConversations(filtered.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch similar conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentConversations = async () => {
    try {
      const response = await apiClient.discoverConversations(10);
      setRecentConversations(response.conversations.slice(0, 6));
    } catch (error) {
      console.error('Failed to fetch recent conversations:', error);
    }
  };

  const fetchHnTopics = async () => {
    try {
      // Use current conversation summary if available for semantic similarity
      const conversationSummary = currentConversation?.summary_public;
      
      const response = await apiClient.getHnTopics(conversationSummary, 5);
      setTrendingTopics(response.topics);
    } catch (error) {
      console.error('Failed to fetch HN topics:', error);
      // Fallback to static topics if API fails
      const fallbackTopics = [
        'AI & Machine Learning', 'Startup Stories', 'Open Source',
        'Programming Languages', 'Tech Industry'
      ];
      setTrendingTopics(fallbackTopics);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const ConversationCard = ({ conversation }: { conversation: SearchResult }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group cursor-pointer"
      onClick={() => window.location.href = `/chat/${conversation.id}`}
    >
      <Card className="p-3 hover:shadow-sm transition-shadow border-l-2 border-l-transparent hover:border-l-blue-500">
        <CardContent className="p-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
              {conversation.title}
            </h4>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>{conversation.author?.display_name || 'Unknown'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>{conversation.view_count}</span>
              </div>
            </div>
            {conversation.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {conversation.summary}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const TrendingTopicBadge = ({ topic }: { topic: string }) => (
    <Badge 
      variant="secondary" 
      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
      onClick={() => window.location.href = `/discover?q=${encodeURIComponent(topic)}`}
    >
      <TrendingUp className="h-3 w-3 mr-1" />
      {topic}
    </Badge>
  );

  return (
    <div className="w-80 border-l bg-background/50 flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Discovery
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          
          {/* Similar to Current Chat */}
          {currentConversation && similarConversations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <h3 className="font-medium text-sm">Similar to Current Chat</h3>
                <Badge variant="outline" className="text-xs">
                  {similarConversations.length}
                </Badge>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {similarConversations.map((conversation) => (
                    <ConversationCard key={conversation.id} conversation={conversation} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* HN Topics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <h3 className="font-medium text-sm">From Hacker News</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTopics.map((topic) => (
                <TrendingTopicBadge key={topic} topic={topic} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Recent from Community */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-green-500" />
              <h3 className="font-medium text-sm">Recent from Community</h3>
              <Badge variant="outline" className="text-xs">
                {recentConversations.length}
              </Badge>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {recentConversations.map((conversation) => (
                  <ConversationCard key={conversation.id} conversation={conversation} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t">
            <div className="space-y-2">
              {user && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/saved">
                      <BookmarkIcon className="h-4 w-4 mr-1" />
                      Saved
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/discover">
                      <Eye className="h-4 w-4 mr-1" />
                      Explore
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </ScrollArea>
    </div>
  );
}