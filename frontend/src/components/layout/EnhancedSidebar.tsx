"use client";

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import ChatSidebar from './chat-sidebar';
import SimilarConversationsSidebar from '../SimilarConversationsSidebar';
import type { Conversation } from '@/types';

interface EnhancedSidebarProps {
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  currentSessionId: string | null;
  onSearchResultSelect: (messageId: string, sessionId: string) => void;
  currentConversation?: Conversation | null;
  onConversationSelect?: (conversation: Conversation) => void;
}

export default function EnhancedSidebar({ 
  onSessionSelect, 
  onNewChat, 
  currentSessionId, 
  onSearchResultSelect,
  currentConversation,
  onConversationSelect 
}: EnhancedSidebarProps) {
  const [activeTab, setActiveTab] = useState('neighboring');
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const THROTTLE_DURATION = 15000; // 15 seconds

  // Auto-update neighboring chats with throttling
  useEffect(() => {
    if (!currentConversation?.summary_public) {
      return;
    }

    // Clear any existing interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // Set up periodic updates
    updateIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateTime >= THROTTLE_DURATION) {
        setLastUpdateTime(now);
        // The SimilarConversationsSidebar will fetch on its own when currentConversation changes
      }
    }, THROTTLE_DURATION);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [currentConversation?.summary_public, lastUpdateTime]);

  return (
    <div className="h-full w-full sm:w-64 md:w-72 flex flex-col bg-background border-r border-border/60">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="p-3 border-b border-border/60">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="neighboring"
              role="tab"
              aria-selected={activeTab === 'neighboring'}
            >
              Neighboring Chats
            </TabsTrigger>
            <TabsTrigger 
              value="my-chats"
              role="tab" 
              aria-selected={activeTab === 'my-chats'}
            >
              My Chats
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="neighboring" className="h-full m-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="h-full"
              key={`${currentConversation?.id}-${lastUpdateTime}`} // Force re-render on updates
            >
              {currentConversation && onConversationSelect ? (
                <SimilarConversationsSidebar
                  currentConversation={currentConversation}
                  onConversationSelect={onConversationSelect}
                  onNewChat={onNewChat}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">Similar conversations will appear here</p>
                    <p className="text-xs mt-2">Start chatting to see neighboring conversations</p>
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="my-chats" className="h-full m-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="h-full"
            >
              <ChatSidebar
                onSessionSelect={onSessionSelect}
                onNewChat={onNewChat}
                currentSessionId={currentSessionId}
                onSearchResultSelect={onSearchResultSelect}
                onConversationSelect={onConversationSelect}
              />
            </motion.div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}