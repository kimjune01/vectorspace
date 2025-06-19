import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

interface PresenceUser {
  user_id: number;
  username: string;
  joined_at: number;
  last_seen?: number;
}

interface MessagePresenceAvatarsProps {
  messageIndex: number;
  messageId: string;
  users: PresenceUser[];
  currentUserId?: number;
  isCurrentlyViewed?: boolean;
}

export default function MessagePresenceAvatars({ 
  users, 
  currentUserId,
  isCurrentlyViewed = false 
}: MessagePresenceAvatarsProps) {
  // Filter out current user and limit to 3 avatars
  const otherUsers = users.filter(u => u.user_id !== currentUserId);
  const displayedUsers = otherUsers.slice(0, 3);
  const hiddenCount = Math.max(0, otherUsers.length - 3);

  if (otherUsers.length === 0) {
    return null;
  }

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (userId: number) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[userId % colors.length];
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
        className={`absolute right-0 top-0 flex items-center space-x-1 ${
          isCurrentlyViewed ? 'bg-primary/10 rounded-md p-1' : ''
        }`}
      >
        <AnimatePresence mode="popLayout">
          {displayedUsers.map((user, index) => (
            <motion.div
              key={user.user_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 35,
                delay: index * 0.05
              }}
              className={index > 0 ? "-ml-1" : ""}
              style={{ zIndex: displayedUsers.length - index }}
            >
              <Tooltip>
                <TooltipTrigger>
                  <Avatar 
                    className={`h-5 w-5 border-2 border-background hover:scale-110 transition-transform cursor-default ${getAvatarColor(user.user_id)} ${
                      isCurrentlyViewed ? 'ring-2 ring-primary/50' : ''
                    }`}
                  >
                    <AvatarFallback className="text-white text-xs font-medium">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  <p>{user.username} is reading this message</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {hiddenCount > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="-ml-1 text-xs text-muted-foreground bg-muted rounded-full h-5 w-5 flex items-center justify-center border-2 border-background"
          >
            +{hiddenCount}
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}