import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import MessagePresenceAvatars from './MessagePresenceAvatars';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

interface PresenceUser {
  user_id: number;
  username: string;
  joined_at: number;
  last_seen?: number;
  current_message_index?: number;
  current_message_id?: string;
}

interface MessageWithPresenceProps {
  message: Message;
  messageIndex: number;
  viewers: PresenceUser[];
  currentUserId?: number;
  isCurrentlyViewed?: boolean;
  onRegister: (messageId: string, element: HTMLDivElement | null) => void;
  onMessageClick: (messageIndex: number, messageId: string) => void;
}

export default function MessageWithPresence({
  message,
  messageIndex,
  viewers,
  currentUserId,
  isCurrentlyViewed = false,
  onRegister,
  onMessageClick
}: MessageWithPresenceProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';

  useEffect(() => {
    onRegister(message.id, messageRef.current);
    return () => onRegister(message.id, null);
  }, [message.id, onRegister]);

  return (
    <motion.div
      ref={messageRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative group flex items-start space-x-3 p-4 rounded-lg transition-all duration-200 cursor-pointer hover:bg-muted/50 ${
        isCurrentlyViewed ? 'bg-primary/5 ring-2 ring-primary/20' : ''
      } ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      onClick={() => onMessageClick(messageIndex, message.id)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className={`h-8 w-8 ${isUser ? 'bg-primary' : 'bg-muted'}`}>
          <AvatarFallback className={isUser ? 'text-primary-foreground' : 'text-muted-foreground'}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Message Content */}
      <div className={`flex-1 space-y-2 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block max-w-[80%] rounded-lg px-4 py-2 ${
          isUser 
            ? 'bg-primary text-primary-foreground ml-auto' 
            : 'bg-muted'
        }`}>
          {message.role === 'assistant' ? (
            <MarkdownContent 
              content={message.content} 
              className="text-sm break-words"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </div>
        
        <div className={`text-xs text-muted-foreground ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Presence Avatars */}
      {viewers.length > 0 && (
        <div className={`absolute ${isUser ? 'left-0' : 'right-0'} top-2`}>
          <MessagePresenceAvatars
            messageIndex={messageIndex}
            messageId={message.id}
            users={viewers}
            currentUserId={currentUserId}
            isCurrentlyViewed={isCurrentlyViewed}
          />
        </div>
      )}

      {/* Selection Indicator */}
      {isCurrentlyViewed && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`absolute ${isUser ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full`}
        />
      )}
    </motion.div>
  );
}