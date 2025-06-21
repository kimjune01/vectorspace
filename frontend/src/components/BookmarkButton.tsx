import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { BookmarkButtonProps } from '@/types/social';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export function BookmarkButton({
  conversationId,
  initialIsSaved = false,
  onSaveChange,
  size = 'default'
}: BookmarkButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const { toast } = useToast();

  // Check saved status on mount if not provided
  useEffect(() => {
    if (!hasCheckedStatus && !initialIsSaved) {
      checkSavedStatus();
    }
  }, [conversationId, hasCheckedStatus, initialIsSaved]);

  const checkSavedStatus = async () => {
    try {
      const response = await api.get(`/curation/saved/check/${conversationId}`);
      setIsSaved(response.data.is_saved);
      setHasCheckedStatus(true);
    } catch (error) {
      console.error('Failed to check saved status:', error);
      setHasCheckedStatus(true);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await api.post(`/curation/conversations/${conversationId}/save`);
      setIsSaved(true);
      onSaveChange?.(true);
      
      toast({
        title: "Saved",
        description: "Conversation saved to your collection",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to save conversation';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsave = async () => {
    setIsLoading(true);
    try {
      await api.delete(`/curation/conversations/${conversationId}/save`);
      setIsSaved(false);
      onSaveChange?.(false);
      
      toast({
        title: "Removed",
        description: "Conversation removed from your collection",
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to remove conversation';
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
    if (isSaved) {
      handleUnsave();
    } else {
      handleSave();
    }
  };

  return (
    <Button
      variant={isSaved ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={`gap-2 ${isSaved ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
    >
      {isLoading ? (
        <>
          <Bookmark className="h-4 w-4 animate-pulse" />
          {size !== 'sm' && 'Saving...'}
        </>
      ) : isSaved ? (
        <>
          <BookmarkCheck className="h-4 w-4" />
          {size !== 'sm' && 'Saved'}
        </>
      ) : (
        <>
          <Bookmark className="h-4 w-4" />
          {size !== 'sm' && 'Save'}
        </>
      )}
    </Button>
  );
}