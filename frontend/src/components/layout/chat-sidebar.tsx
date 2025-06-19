"use client";

import React, { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircleIcon, MessageSquareIcon, Loader2, AlertTriangleIcon, SearchIcon, XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationsResponse, SearchResponse } from '@/types/api';
import { EnhancedError } from '@/components/debug/EnhancedError';
import ChatSessionItem from './ChatSessionItem';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  originalConversation?: any; // Store the full conversation object
}

// For search results
interface SearchResultMessage {
  id: string;
  content: string;
  createdAt: string;
  sessionId: string;
  session: { // Assuming session object is nested as defined in search API
    id: string;
    title: string;
  };
}

interface ChatSidebarProps {
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  currentSessionId: string | null;
  onSearchResultSelect: (messageId: string, sessionId: string) => void;
  onConversationSelect?: (conversation: any) => void;
}

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-300 dark:bg-yellow-500 text-black rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

// Skeleton Loader for Sidebar Items
const SkeletonSidebarItem = () => (
  <div className="flex flex-col items-start p-2.5 space-y-1.5 w-full">
    <div className="h-4 bg-muted/60 rounded w-3/4 animate-pulse"></div>
    <div className="h-3 bg-muted/50 rounded w-1/2 animate-pulse"></div>
  </div>
);

export default function ChatSidebar({ onSessionSelect, onNewChat, currentSessionId, onSearchResultSelect, onConversationSelect }: ChatSidebarProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // To know if a search has been performed

  // Fetch initial sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setSessionsError(null);
      try {
        // TypeScript now ensures we get the correct response structure
        const response: ConversationsResponse = await apiClient.getConversations();
        
        // TypeScript compiler ensures `conversations` property exists and is an array
        const conversations = response.conversations;
        
        // Transform conversation data to match ChatSession interface
        const sessions = conversations.map(conv => ({
          id: conv.id.toString(),
          title: conv.title,
          updatedAt: conv.updated_at || conv.created_at,
          originalConversation: conv // Store the full conversation object
        }));
        setSessions(sessions);
      } catch (err) {
        const errorContext = {
          component: 'ChatSidebar',
          action: 'fetchSessions',
          authState: { isAuthenticated, authLoading, hasUser: !!user },
          endpoint: '/conversations/',
          error: err instanceof Error ? err.message : String(err)
        };
        
        console.error('ChatSidebar: Failed to fetch conversations', errorContext);
        setSessionsError(err instanceof Error ? err.message : 'Could not load chats');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    // Only fetch sessions when authenticated and not loading auth state
    if (isAuthenticated && !authLoading && user) {
      fetchSessions();
    } else if (!authLoading && !isAuthenticated) {
      // User is not authenticated, clear sessions and show appropriate state
      setSessions([]);
      setIsLoadingSessions(false);
      setSessionsError(null);
    }
  }, [isAuthenticated, authLoading, user]);

  const handleSearchSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      // TypeScript ensures we get the correct search response structure
      const data: SearchResponse = await apiClient.searchConversations(searchQuery, 20);
      setSearchResults(data.conversations || []);
      if (data.conversations.length === 0) {
        // setSearchError("No results found."); // Or handle as empty results
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const renderContent = () => {
    if (hasSearched) {
      // Display search results
      if (isSearching) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </motion.div>
        );
      }
      if (searchError) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EnhancedError 
              error={`Search failed: ${searchError}`}
              context={{
                component: 'ChatSidebar',
                action: 'searchConversations',
                searchQuery,
                authState: { isAuthenticated, authLoading, hasUser: !!user },
                endpoint: '/search',
                originalError: searchError
              }}
              onRetry={() => handleSearchSubmit()}
            />
          </motion.div>
        );
      }
      if (searchResults.length === 0) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 px-3">
            <SearchIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-foreground">No results for "{truncateText(searchQuery, 30)}"</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search term.</p>
          </motion.div>
        );
      }
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          <AnimatePresence>
            {searchResults.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                exit={{ opacity: 0, x: -20 }} // Slide out on clear/new search
                layout // Animate layout changes
              >
                <Button
                  variant="ghost"
                  className="w-full h-auto py-2.5 px-3 text-left flex flex-col items-start group"
                  onClick={() => onSearchResultSelect(msg.id, msg.session.id)}
                >
                  <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 w-full flex justify-between items-center mb-0.5">
                    <span className="truncate max-w-[70%]">In: {truncateText(msg.session.title, 20)}</span>
                    <span>{formatDisplayDate(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-foreground group-hover:text-foreground leading-snug line-clamp-2">
                    <HighlightMatch text={truncateText(msg.content, 120)} query={searchQuery} />
                  </p>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      );
    } else {
      // Display session list
      if (isLoadingSessions) {
        return (
          <div className="space-y-1 pt-2">
            {[...Array(5)].map((_, i) => <SkeletonSidebarItem key={i} />)}
          </div>
        );
      }
      if (sessionsError) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EnhancedError 
              error={sessionsError === "Failed to fetch sessions: 401" ? "Unauthorized. Please log in again." : "Could not load chats."}
              context={{
                component: 'ChatSidebar',
                action: 'fetchSessions',
                authState: { isAuthenticated, authLoading, hasUser: !!user },
                endpoint: '/conversations/',
                originalError: sessionsError
              }}
              onRetry={() => {
                const fetchSessions = async () => {
                  setIsLoadingSessions(true);
                  setSessionsError(null);
                  try {
                    const response: ConversationsResponse = await apiClient.getConversations();
                    const conversations = response.conversations;
                    const sessions = conversations.map(conv => ({
                      id: conv.id.toString(),
                      title: conv.title,
                      updatedAt: conv.updated_at || conv.created_at
                    }));
                    setSessions(sessions);
                  } catch (err) {
                    setSessionsError(err instanceof Error ? err.message : 'Could not load chats');
                  } finally {
                    setIsLoadingSessions(false);
                  }
                };
                fetchSessions();
              }}
            />
          </motion.div>
        );
      }
      if (sessions.length === 0) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 px-3">
            <MessageSquareIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No chat sessions yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Start a new chat to see it here.</p>
          </motion.div>
        );
      }
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          <AnimatePresence>
            {sessions.map((session, index) => (
              <ChatSessionItem
                key={session.id}
                session={session}
                index={index}
                currentSessionId={currentSessionId}
                onSessionSelect={onSessionSelect}
                onDelete={(sessionId) => {
                  // Remove session from local state
                  setSessions(prev => prev.filter(s => s.id !== sessionId));
                  // TODO: Add API call to delete session from backend
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      );
    }
  };


  return (
    <div className="h-full w-full sm:w-64 md:w-72 flex flex-col bg-background border-r border-border/60">
      <div className="p-3 border-b border-border/60 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start text-sm hover:bg-muted/50"
          onClick={() => { clearSearch(); onNewChat(); }} // Clear search when starting new chat
        >
          <PlusCircleIcon className="mr-2 h-4 w-4" />
          New Chat
        </Button>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Input
              type="search"
              placeholder="Search messages..."
              className="w-full text-sm h-9 pl-8 pr-8" // Added pr-8 for clear button
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') handleSearchSubmit();
                if (e.key === 'Escape') clearSearch();
              }}
            />
            <SearchIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={clearSearch}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-3">
         {renderContent()}
        </div>
      </ScrollArea>
    </div>
  );
}
