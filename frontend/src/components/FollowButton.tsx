import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import type { FollowButtonProps } from '@/types/social';

export function FollowButton({
  targetUserId,
  initialIsFollowing = false,
  onFollowChange,
  size = 'sm',
  variant = 'default'
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const { toast } = useToast();

  // Check follow status on mount if not provided
  useEffect(() => {
    if (!hasCheckedStatus && !initialIsFollowing) {
      checkFollowStatus();
    }
  }, [targetUserId, hasCheckedStatus, initialIsFollowing]);

  const checkFollowStatus = async () => {
    try {
      const response = await apiClient.request(`/users/me/is-following/${targetUserId}`) as any;
      setIsFollowing(response.is_following);
      setHasCheckedStatus(true);
    } catch (error) {
      console.error('Failed to check follow status:', error);
      setHasCheckedStatus(true);
    }
  };

  const handleFollow = async () => {
    setIsLoading(true);
    try {
      await apiClient.request(`/users/${targetUserId}/follow`, { method: 'POST' });
      setIsFollowing(true);
      onFollowChange?.(true);
      
      toast({
        title: "Following",
        description: "You are now following this user",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to follow user';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setIsLoading(true);
    try {
      await apiClient.request(`/users/${targetUserId}/follow`, { method: 'DELETE' });
      setIsFollowing(false);
      onFollowChange?.(false);
      
      toast({
        title: "Unfollowed",
        description: "You are no longer following this user",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to unfollow user';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (isFollowing) {
      handleUnfollow();
    } else {
      handleFollow();
    }
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={isFollowing ? 'hover:bg-destructive hover:text-destructive-foreground' : ''}
    >
      {isLoading ? (
        'Loading...'
      ) : isFollowing ? (
        'Following'
      ) : (
        'Follow'
      )}
    </Button>
  );
}