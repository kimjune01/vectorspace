import { useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresence } from '@/hooks/usePresence';

interface PresenceIndicatorProps {
  conversationId: string | null;
  currentUserId?: number;
  onPresenceUpdate?: (message: any) => void;
}

export default function PresenceIndicator({ conversationId, currentUserId, onPresenceUpdate }: PresenceIndicatorProps) {
  const { participants, participantCount, handlePresenceUpdate } = usePresence(conversationId);
  
  // Pass presence update handler to parent
  useEffect(() => {
    if (onPresenceUpdate) {
      onPresenceUpdate(handlePresenceUpdate);
    }
  }, [onPresenceUpdate, handlePresenceUpdate]);
  
  // Filter out current user from display
  const otherParticipants = participants.filter(p => p.user_id !== currentUserId);
  const displayedParticipants = otherParticipants.slice(0, 5); // Show max 5 avatars
  const hiddenCount = Math.max(0, otherParticipants.length - 5);

  if (!conversationId || otherParticipants.length === 0) {
    return null;
  }

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (userId: number) => {
    // Generate consistent color based on user ID
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[userId % colors.length];
  };

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-1">
        <AnimatePresence mode="popLayout">
          {displayedParticipants.map((participant, index) => (
            <motion.div
              key={participant.user_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: index * 0.05
              }}
              style={{ zIndex: displayedParticipants.length - index }}
              className={index > 0 ? "-ml-2" : ""}
            >
              <Tooltip>
                <TooltipTrigger>
                  <Avatar 
                    className={`h-6 w-6 md:h-7 md:w-7 border-2 border-background hover:scale-110 transition-transform cursor-default ${getAvatarColor(participant.user_id)}`}
                  >
                    <AvatarFallback className="text-white text-xs font-medium">
                      {getInitials(participant.username)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{participant.username} is viewing this conversation</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {hiddenCount > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="-ml-2"
          >
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant="secondary" 
                  className="h-6 w-6 md:h-7 md:w-7 rounded-full p-0 text-xs border-2 border-background flex items-center justify-center"
                >
                  +{hiddenCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>{hiddenCount} more {hiddenCount === 1 ? 'person' : 'people'} viewing</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}
        
        {participantCount > 1 && (
          <span className="text-xs text-muted-foreground ml-2">
            {participantCount} viewing
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}