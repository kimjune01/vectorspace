import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ArrowLeft, Settings, Archive, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import type { ConversationDetail } from '@/types';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (id) {
      fetchConversation();
    }
  }, [id]);

  const fetchConversation = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      const data = await apiClient.getConversation(id);
      setConversation(data);
      setEditTitle(data.title);
      setEditDescription(''); // ConversationDetail doesn't have description
    } catch (error) {
      setError('Failed to load conversation');
      console.error('Error fetching conversation:', error);
    } finally {
      setIsLoading(false);
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
      await apiClient.deleteConversation(conversation.id.toString());
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

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-4">
            Please sign in to participate in conversations.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate('/login')}>Sign In</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background/60 backdrop-blur-xl border-b border-border/40 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Chat
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
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToggleVisibility}>
                {conversation.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive}>
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <Card className="h-[600px]">
          <ChatInterface 
            conversationId={conversation.id.toString()}
            onNewMessage={() => {
              // Update message count by refetching or updating messages array
              fetchConversation();
            }}
          />
        </Card>
      </div>
    </div>
  );
}