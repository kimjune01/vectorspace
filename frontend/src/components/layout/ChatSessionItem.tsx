import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { MoreVertical, Trash2, Bug } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  originalConversation?: any;
}

interface ChatSessionItemProps {
  session: ChatSession;
  index: number;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

const ChatSessionItem: React.FC<ChatSessionItemProps> = ({
  session,
  index,
  currentSessionId,
  onSessionSelect,
  onDelete
}) => {
  const [showDebugModal, setShowDebugModal] = useState(false);
  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date >= today) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (date >= yesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const formatMetadata = () => {
    const metadata = {
      "Session ID": session.id,
      "Title": session.title,
      "Last Updated": session.updatedAt,
      "Created At": session.originalConversation?.created_at || "N/A",
      "Visibility": session.originalConversation?.is_public ? "Public" : "Private",
      "User ID": session.originalConversation?.user_id || "N/A",
      "Summary": session.originalConversation?.summary_public || "N/A",
      "Archive Status": session.originalConversation?.archived_at ? "Archived" : "Active",
      "Archived At": session.originalConversation?.archived_at || "N/A",
      "Token Count": session.originalConversation?.token_count || "N/A",
      "View Count": session.originalConversation?.view_count || "N/A",
      "Hidden from Profile": session.originalConversation?.is_hidden_from_profile ? "Yes" : "No",
      "Last Message At": session.originalConversation?.last_message_at || "N/A"
    };

    return Object.entries(metadata)
      .filter(([_, value]) => value !== "N/A" && value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(session.id);
    }
  };

  const handleDebug = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDebugModal(true);
  };

  return (
    <>
      <motion.div
        key={session.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0, transition: { delay: index * 0.03 } }}
        exit={{ opacity: 0, x: -20 }}
        layout
        className="relative group"
      >
        <Button
          variant={currentSessionId === session.id ? "secondary" : "ghost"}
          className="w-full justify-start items-center text-sm h-auto py-2.5 px-3 pr-10"
          onClick={() => onSessionSelect(session.id)}
          title={session.title}
        >
          <div className="flex flex-col items-start text-left flex-grow overflow-hidden">
            <span className="font-medium text-foreground group-hover:text-foreground truncate w-full">
              {truncateText(session.title, 25)}
            </span>
            <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 mt-0.5">
              {formatDisplayDate(session.updatedAt)}
            </span>
          </div>
        </Button>
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={handleDebug} className="text-xs">
                <Bug className="mr-2 h-3 w-3" />
                Debug
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-xs text-destructive">
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Session Debug Information</DialogTitle>
            <DialogDescription>
              Metadata for session: {truncateText(session.title, 50)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 w-full rounded-md border p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {formatMetadata()}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatSessionItem;