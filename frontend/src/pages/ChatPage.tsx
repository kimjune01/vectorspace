import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ArrowLeft, Archive, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import type { ConversationDetail } from '@/types/api';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [tempConversationData, setTempConversationData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchConversation();
    }
  }, [id]);

  const fetchConversation = async () => {
    if (!id) return;
    
    // Check if this is a temporary conversation
    if (id.startsWith('temp-')) {
      const tempData = localStorage.getItem(`temp-conversation-${id}`);
      if (tempData) {
        const parsed = JSON.parse(tempData);
        setIsTemporary(true);
        setTempConversationData(parsed);
        setEditTitle(parsed.title);
        setEditDescription(parsed.description || '');
        
        // Create a minimal conversation-like object for display
        setConversation({
          id: parseInt(id.replace('temp-', '')),
          title: parsed.title,
          user_id: user?.id || 0,
          author_username: user?.username || '',
          author_display_name: user?.display_name || '',
          is_public: parsed.isPublic,
          is_hidden_from_profile: false,
          messages: [],
          participant_count: 1,
          view_count: 0,
          token_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        } as ConversationDetail);
        
        setIsLoading(false);
        return;
      } else {
        setError('Temporary conversation data not found');
        setIsLoading(false);
        return;
      }
    }
    
    try {
      setIsLoading(true);
      const data = await apiClient.getConversation(id);
      setConversation(data);
      setEditTitle(data.title);
      setEditDescription(''); // ConversationDetail doesn't have description
      setIsTemporary(false);
    } catch (error) {
      setError('Failed to load conversation');
      console.error('Error fetching conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const createActualConversation = async (firstMessage?: string) => {
    if (!isTemporary || !tempConversationData || !user) return null;
    
    try {
      const actualConversation = await apiClient.createConversation(
        tempConversationData.title,
        tempConversationData.description
      );
      
      // Clean up temporary data
      localStorage.removeItem(`temp-conversation-${id}`);
      
      // Store the first message to send after redirect if provided
      if (firstMessage) {
        localStorage.setItem(`pending-message-${actualConversation.id}`, firstMessage);
      }
      
      // Update the URL to use the real conversation ID
      navigate(`/chat/${actualConversation.id}`, { replace: true });
      
      return actualConversation;
    } catch (error) {
      console.error('Failed to create actual conversation:', error);
      throw error;
    }
  };


  const handleSaveEdit = async () => {
    if (!conversation) return;
    
    try {
      // Note: This would need to be implemented in the API client
      // await apiClient.updateConversation(conversation.id, { title: editTitle, description: editDescription });
      setConversation({ ...conversation, title: editTitle });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  };

  const handleToggleVisibility = async () => {
    if (!conversation) return;
    
    try {
      // Note: This would need to be implemented in the API client
      // await apiClient.updateConversation(conversation.id, { is_public: !conversation.is_public });
      setConversation({ ...conversation, is_public: !conversation.is_public });
    } catch (error) {
      console.error('Failed to update visibility:', error);
    }
  };

  const handleArchive = async () => {
    if (!conversation) return;
    
    try {
      await apiClient.archiveConversation(conversation.id.toString());
      navigate('/');
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const isOwner = user && conversation && user.id === conversation.user_id;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Conversation Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'The conversation you\'re looking for doesn\'t exist or you don\'t have access to it.'}
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Note: Login is now optional - users can view and participate in conversations without authentication

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background/60 backdrop-blur-xl border-b border-border/40 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-bold"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold">{conversation.title}</h1>
                {/* ConversationDetail doesn't have description field */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={conversation.is_public ? 'default' : 'secondary'}>
                    {conversation.is_public ? (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Public
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Private
                      </>
                    )}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {conversation.messages.length} messages
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Bookmark button for authenticated users */}
            {user && (
              <BookmarkButton 
                conversationId={conversation.id}
                size="sm"
              />
            )}
            
            {/* Owner controls */}
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={handleToggleVisibility}>
                  {conversation.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handleArchive}>
                  <Archive className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="h-[600px] overflow-hidden">
          
          <div className="h-full">
            <ChatInterface 
              conversationId={isTemporary ? id! : conversation.id.toString()}
              initialMessages={conversation.messages || []}
              isTemporary={isTemporary}
              onCreateConversation={createActualConversation}
              onNewMessage={() => {
                // Message count will be updated by WebSocket, no need to refetch
              }}
              onTitleUpdate={(newTitle) => {
                // Update conversation title when received via WebSocket
                if (conversation) {
                  setConversation({ ...conversation, title: newTitle });
                  setEditTitle(newTitle);
                }
              }}
            />
          </div>
        </Card>

      </div>
    </div>
  );
}