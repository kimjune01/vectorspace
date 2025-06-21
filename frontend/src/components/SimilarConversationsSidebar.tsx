import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  PlusCircle, 
  MessageSquare, 
  Clock, 
  User, 
  Eye, 
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  WifiOff,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api';
import type { Conversation } from '@/types';
import type { SearchResult, CorpusSearchResult, CorpusHealthResponse } from '@/types/api';

interface SimilarConversationsSidebarProps {
  currentConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
}

export default function SimilarConversationsSidebar({
  currentConversation,
  onConversationSelect,
  onNewChat
}: SimilarConversationsSidebarProps) {
  // Internal conversations state
  const [similarConversations, setSimilarConversations] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // External corpus state
  const [externalResults, setExternalResults] = useState<CorpusSearchResult[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [corpusAvailable, setCorpusAvailable] = useState(false);
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [showExternalContent, setShowExternalContent] = useState(true);
  const [corpusDocCount, setCorpusDocCount] = useState(0);

  useEffect(() => {
    if (currentConversation?.summary_public) {
      fetchSimilarConversations();
      checkCorpusHealth();
    } else {
      setSimilarConversations([]);
      setExternalResults([]);
    }
  }, [currentConversation?.id, currentConversation?.summary_public]);

  const fetchSimilarConversations = async () => {
    if (!currentConversation?.id) return;

    try {
      setIsLoading(true);
      setError(undefined);
      
      const data = await apiClient.getSimilarConversations(currentConversation.id.toString(), 20);
      // Transform Conversation[] to SearchResult[] format
      const searchResults: SearchResult[] = data.conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        summary: conv.summary_public || '',
        created_at: conv.created_at,
        view_count: conv.view_count,
        similarity_score: 0.8, // Default similarity since it's not in Conversation type
        author: {
          username: 'user',
          display_name: 'User'
        }
      }));
      setSimilarConversations(searchResults);
    } catch (error) {
      console.error('Error fetching similar conversations:', error);
      setError('Failed to load similar conversations');
    } finally {
      setIsLoading(false);
    }
  };

  // Check corpus service health and availability
  const checkCorpusHealth = async () => {
    try {
      const health = await apiClient.getCorpusHealth();
      const isAvailable = health.status === 'healthy';
      
      setCorpusAvailable(isAvailable);
      setCorpusError(isAvailable ? null : health.error || 'Corpus service unavailable');

      if (isAvailable) {
        try {
          const collections = await apiClient.getCorpusCollections();
          if (collections.collections.includes('hackernews')) {
            const stats = await apiClient.getCorpusCollectionStats('hackernews');
            setCorpusDocCount(stats.stats.document_count);
          }
        } catch (e) {
          console.warn('Could not fetch corpus stats:', e);
        }

        // If corpus is available and we want to show external content, fetch it
        if (showExternalContent && currentConversation?.summary_public) {
          fetchExternalResults();
        }
      }
    } catch (error) {
      console.warn('Corpus health check failed:', error);
      setCorpusAvailable(false);
      setCorpusError(error instanceof Error ? error.message : 'Corpus service error');
    }
  };

  // Fetch external corpus results
  const fetchExternalResults = async () => {
    if (!corpusAvailable || !currentConversation?.summary_public) return;

    setExternalLoading(true);
    setExternalError(null);

    try {
      const results = await apiClient.searchSimilarContent(
        [currentConversation.summary_public],
        ['hackernews'],
        5,
        0.7
      );

      setExternalResults(results.results || []);
    } catch (err) {
      console.error('Failed to fetch external results:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error loading external content';
      setExternalError(errorMessage);
      setExternalResults([]);

      // If corpus becomes unavailable, update status
      if (errorMessage.includes('connect') || errorMessage.includes('timeout')) {
        setCorpusAvailable(false);
        setCorpusError(errorMessage);
      }
    } finally {
      setExternalLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await Promise.all([
      fetchSimilarConversations(),
      checkCorpusHealth()
    ]);
  };

  const handleConversationClick = (similarConv: SearchResult) => {
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
        className="space-y-4"
      >
        {/* Internal Conversations Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <div className="text-xs font-medium text-muted-foreground">
              Similar Conversations ({similarConversations.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-6 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
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
                className="mb-3"
              >
                <Card 
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-l-4 border-l-blue-500"
                  onClick={() => handleConversationClick(conv)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm line-clamp-2 flex-1">
                        {conv.title}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className="ml-2 text-xs"
                      >
                        {Math.round((conv.similarity_score || 0) * 100)}%
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
        </div>

        {/* External Content Section */}
        {showExternalContent && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between px-2 mb-3">
                <div className="flex items-center space-x-2">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    External Discussions
                  </span>
                  {externalLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <Badge variant="secondary" className="text-xs">
                    Hacker News
                  </Badge>
                </div>
                {corpusAvailable ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500" />
                )}
              </div>

              <AnimatePresence>
                {externalError ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-4"
                  >
                    <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{externalError}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchExternalResults()}
                      className="mt-2 text-xs"
                    >
                      Retry
                    </Button>
                  </motion.div>
                ) : !corpusAvailable ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-4"
                  >
                    <WifiOff className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      External content discovery unavailable
                    </p>
                    {corpusError && (
                      <p className="text-xs text-red-500 mt-1">
                        {corpusError}
                      </p>
                    )}
                  </motion.div>
                ) : externalResults.length === 0 && !externalLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-4"
                  >
                    <Info className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No related external content found</p>
                  </motion.div>
                ) : (
                  externalResults.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0, 
                        transition: { delay: index * 0.05 } 
                      }}
                      exit={{ opacity: 0, x: -20 }}
                      layout
                      className="mb-3"
                    >
                      <Card className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-orange-500">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm line-clamp-2 flex-1">
                              {result.title}
                            </h4>
                            <div className="flex items-center space-x-1 ml-2">
                              <Badge variant="outline" className="text-xs">
                                {Math.round(result.similarity_score * 100)}%
                              </Badge>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {result.content.substring(0, 150)}...
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <div className="flex items-center space-x-2">
                              <span>@{result.author}</span>
                              <Badge variant="secondary" className="text-xs">
                                {result.platform}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1">
                              {result.score && <span>↑{result.score}</span>}
                              {result.comment_count && <span>💬{result.comment_count}</span>}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(result.url, '_blank');
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on {result.platform}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-background border-r border-border/60">
      {/* Header */}
      <div className="p-3 border-b border-border/60 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start text-sm hover:bg-muted/50"
          onClick={onNewChat}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>

        {/* Corpus Status Indicator */}
        {currentConversation?.summary_public && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              {corpusAvailable ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500" />
              )}
              <span className="text-xs font-medium">
                External Content {corpusAvailable ? 'Connected' : 'Unavailable'}
              </span>
              {corpusAvailable && corpusDocCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {corpusDocCount} posts
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExternalContent(!showExternalContent)}
                className="h-6 px-2 text-xs"
              >
                {showExternalContent ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
        )}
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