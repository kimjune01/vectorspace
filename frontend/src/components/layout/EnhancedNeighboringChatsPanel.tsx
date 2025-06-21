"use client";

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquareIcon, 
  Loader2, 
  AlertTriangleIcon, 
  ClockIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  InfoIcon,
  CheckCircleIcon,
  XCircleIcon,
  WifiOffIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api';
import type { 
  EnhancedSimilarConversation, 
  CorpusSearchResult, 
  CorpusHealthResponse 
} from '@/types/api';

interface SimilarConversation {
  id: number;
  title: string;
  summary: string;
  similarity_score: number;
  author: {
    username: string;
  };
}

interface EnhancedNeighboringChatsPanelProps {
  conversationId: number;
  onConversationSelect: (conversationId: number) => void;
}

interface CorpusStatus {
  available: boolean;
  error?: string;
  collections: string[];
  document_count: number;
}

export default function EnhancedNeighboringChatsPanel({ 
  conversationId, 
  onConversationSelect 
}: EnhancedNeighboringChatsPanelProps) {
  // Internal conversations state
  const [internalConversations, setInternalConversations] = useState<SimilarConversation[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);

  // External corpus state
  const [externalResults, setExternalResults] = useState<CorpusSearchResult[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [corpusStatus, setCorpusStatus] = useState<CorpusStatus>({
    available: false,
    collections: [],
    document_count: 0
  });

  // UI state
  const [showExternalContent, setShowExternalContent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Check corpus service health and availability
  const checkCorpusHealth = async (): Promise<CorpusStatus> => {
    try {
      const health = await apiClient.getCorpusHealth();
      const collections = await apiClient.getCorpusCollections();
      
      let totalDocs = 0;
      if (collections.collections.length > 0) {
        try {
          // Get stats for hackernews collection
          const stats = await apiClient.getCorpusCollectionStats('hackernews');
          totalDocs = stats.stats.document_count;
        } catch (e) {
          console.warn('Could not fetch corpus stats:', e);
        }
      }

      return {
        available: health.status === 'healthy',
        collections: collections.collections,
        document_count: totalDocs
      };
    } catch (error) {
      console.error('Corpus health check failed:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Corpus service unavailable',
        collections: [],
        document_count: 0
      };
    }
  };

  // Fetch internal similar conversations
  const fetchInternalConversations = async () => {
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
        setInternalConversations(data.conversations || []);
        setInternalError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setInternalError(err instanceof Error ? err.message : 'Error loading similar conversations');
        setInternalConversations([]);
      }
    } finally {
      if (mountedRef.current) {
        setInternalLoading(false);
      }
    }
  };

  // Fetch external corpus results
  const fetchExternalResults = async (conversationSummary?: string) => {
    if (!corpusStatus.available) return;

    setExternalLoading(true);
    setExternalError(null);

    try {
      // Use conversation summary or a generic query
      const queryTexts = conversationSummary 
        ? [conversationSummary] 
        : ["AI artificial intelligence machine learning programming software development"];

      const results = await apiClient.searchSimilarContent(
        queryTexts,
        ['hackernews'],
        5,
        0.7
      );

      if (mountedRef.current) {
        setExternalResults(results.results || []);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Error loading external content';
        setExternalError(errorMessage);
        setExternalResults([]);
        
        // If corpus becomes unavailable, update status
        if (errorMessage.includes('connect') || errorMessage.includes('timeout')) {
          setCorpusStatus(prev => ({ ...prev, available: false, error: errorMessage }));
        }
      }
    } finally {
      if (mountedRef.current) {
        setExternalLoading(false);
      }
    }
  };

  // Fetch conversation summary for external search
  const fetchConversationSummary = async (): Promise<string | undefined> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const conversation = await response.json();
        return conversation.summary_public;
      }
    } catch (error) {
      console.warn('Could not fetch conversation summary:', error);
    }
    return undefined;
  };

  // Combined fetch function
  const fetchAllData = async () => {
    // Always fetch internal conversations
    await fetchInternalConversations();

    // Check corpus status and fetch external if available
    const status = await checkCorpusHealth();
    setCorpusStatus(status);

    if (status.available && showExternalContent) {
      const summary = await fetchConversationSummary();
      await fetchExternalResults(summary);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Toggle external content visibility
  const toggleExternalContent = () => {
    setShowExternalContent(!showExternalContent);
    if (!showExternalContent && corpusStatus.available) {
      fetchConversationSummary().then(fetchExternalResults);
    }
  };

  // Setup polling
  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchAllData();
      }
    }, 30000); // 30 seconds for enhanced version
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Effects
  useEffect(() => {
    mountedRef.current = true;
    fetchAllData();
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [conversationId]);

  // Format external result for display
  const formatExternalResult = (result: CorpusSearchResult): EnhancedSimilarConversation => ({
    corpus_id: result.id,
    title: result.title,
    summary: result.content.substring(0, 200) + '...',
    similarity_score: result.similarity_score,
    author: { username: result.author },
    url: result.url,
    platform: result.platform,
    timestamp: result.timestamp,
    comment_count: result.comment_count,
    score: result.score,
    source: 'external' as const
  });

  // Render corpus status indicator
  const renderCorpusStatus = () => (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
      <div className="flex items-center space-x-2">
        {corpusStatus.available ? (
          <CheckCircleIcon className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOffIcon className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-medium">
          External Content {corpusStatus.available ? 'Connected' : 'Unavailable'}
        </span>
        {corpusStatus.available && (
          <Badge variant="secondary" className="text-xs">
            {corpusStatus.document_count} posts
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExternalContent}
          className="h-8 px-2"
        >
          {showExternalContent ? 'Hide' : 'Show'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 px-2"
        >
          <RefreshCwIcon className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );

  // Render conversation item
  const renderConversationItem = (conv: SimilarConversation, index: number) => (
    <motion.div
      key={conv.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className="mb-3 cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500"
        onClick={() => onConversationSelect(conv.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
              {conv.title}
            </h4>
            <Badge variant="outline" className="ml-2 text-xs">
              {Math.round(conv.similarity_score * 100)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
            {conv.summary}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">@{conv.author.username}</span>
            <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Render external content item
  const renderExternalItem = (result: CorpusSearchResult, index: number) => (
    <motion.div
      key={result.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="mb-3 cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-orange-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
              {result.title}
            </h4>
            <div className="flex items-center space-x-1 ml-2">
              <Badge variant="outline" className="text-xs">
                {Math.round(result.similarity_score * 100)}%
              </Badge>
              <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
            {result.content.substring(0, 150)}...
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">@{result.author}</span>
              <Badge variant="secondary" className="text-xs">
                {result.platform}
              </Badge>
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {result.score && <span>↑{result.score}</span>}
              {result.comment_count && <span>💬{result.comment_count}</span>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              window.open(result.url, '_blank');
            }}
          >
            <ExternalLinkIcon className="h-3 w-3 mr-1" />
            View on {result.platform}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Main render
  return (
    <div className="h-full flex flex-col">
      {/* Header with corpus status */}
      {renderCorpusStatus()}

      <ScrollArea className="flex-1 px-1">
        <div className="space-y-4">
          {/* Internal Conversations Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Similar Conversations</h3>
              {internalLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            <AnimatePresence>
              {internalError ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <AlertTriangleIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{internalError}</p>
                </motion.div>
              ) : internalConversations.length === 0 && !internalLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <MessageSquareIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No similar conversations yet</p>
                </motion.div>
              ) : (
                internalConversations.map(renderConversationItem)
              )}
            </AnimatePresence>
          </div>

          {/* External Content Section */}
          {showExternalContent && corpusStatus.available && (
            <>
              <Separator />
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <ExternalLinkIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">External Discussions</h3>
                  {externalLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Badge variant="secondary" className="text-xs">
                    Hacker News
                  </Badge>
                </div>

                <AnimatePresence>
                  {externalError ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-4"
                    >
                      <AlertTriangleIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
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
                  ) : externalResults.length === 0 && !externalLoading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-4"
                    >
                      <InfoIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No related external content found</p>
                    </motion.div>
                  ) : (
                    externalResults.map(renderExternalItem)
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Corpus unavailable message */}
          {!corpusStatus.available && (
            <div className="text-center py-4">
              <WifiOffIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                External content discovery unavailable
              </p>
              {corpusStatus.error && (
                <p className="text-xs text-red-500 mt-1">
                  {corpusStatus.error}
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}