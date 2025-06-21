import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Calendar, ArrowLeft, Settings, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useApiWithErrorHandling } from '@/contexts/ErrorContext';
import { FollowButton } from '@/components/FollowButton';

interface UserProfile {
  id: number;
  username: string;
  display_name: string;
  bio?: string;
  profile_image_url?: string;
  profile_image_data?: string;
  stripe_pattern_seed: number;
  conversation_count: number;
  conversations_last_24h: number;
  created_at: string;
  recent_conversations: Conversation[];
}

interface FollowStats {
  followers_count: number;
  following_count: number;
}

interface Conversation {
  id: number;
  title: string;
  summary?: string;
  created_at: string;
  view_count: number;
  is_archived: boolean;
  is_public?: boolean;
  is_hidden_from_profile?: boolean;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { handleApiCall } = useApiWithErrorHandling();

  const isOwnProfile = currentUser && currentUser.username === username;

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  useEffect(() => {
    if (profile) {
      fetchFollowStats(profile.id);
    }
  }, [profile]);

  const fetchFollowStats = async (userId: number) => {
    const stats = await handleApiCall(
      () => apiClient.getUserFollowStats(userId),
      () => fetchFollowStats(userId)
    );
    
    if (stats) {
      setFollowStats(stats);
    }
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    if (!username) {
      setError('Username is required');
      setIsLoading(false);
      return;
    }
    
    const profileData = await handleApiCall(
      () => apiClient.getUserProfile(username),
      fetchProfile // Retry callback
    );
    
    if (profileData) {
      setProfile(profileData);
      setConversations(profileData.recent_conversations || []);
      setError(''); // Clear any previous errors
    } else {
      // handleApiCall returns null on BackendError (handled by dialog)
      // Only set error for non-backend errors or when dialog is dismissed
      setError('Failed to load profile');
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const getProfileImage = () => {
    if (profile?.profile_image_data) {
      return profile.profile_image_data;
    }
    if (profile?.profile_image_url) {
      return profile.profile_image_url;
    }
    return undefined;
  };

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

  if (error || !profile) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'The profile you\'re looking for doesn\'t exist.'}
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>

        {/* Profile Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={getProfileImage()} />
                <AvatarFallback className="text-lg">
                  {getInitials(profile.display_name || profile.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                  {isOwnProfile ? (
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <FollowButton 
                      targetUserId={profile.id}
                      onFollowChange={(isFollowing) => {
                        if (followStats) {
                          setFollowStats({
                            ...followStats,
                            followers_count: followStats.followers_count + (isFollowing ? 1 : -1)
                          });
                        }
                      }}
                      size="sm"
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {formatDate(profile.created_at)}</span>
                  </div>
                </div>
                {profile.bio && (
                  <p className="text-muted-foreground mb-4">{profile.bio}</p>
                )}
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{profile.conversation_count}</div>
                    <div className="text-sm text-muted-foreground">Total Conversations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{profile.conversations_last_24h}</div>
                    <div className="text-sm text-muted-foreground">Last 24 Hours</div>
                  </div>
                  {followStats && (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{followStats.followers_count}</div>
                        <div className="text-sm text-muted-foreground">Followers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{followStats.following_count}</div>
                        <div className="text-sm text-muted-foreground">Following</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Tabs defaultValue="public" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="public">Public Conversations</TabsTrigger>
            {isOwnProfile && <TabsTrigger value="private">Private Conversations</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="public" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {conversations.filter(conv => conv.is_public !== false).length > 0 ? (
                conversations
                  .filter(conv => conv.is_public !== false)
                  .map((conversation) => (
                    <Card 
                      key={conversation.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/chat/${conversation.id}`)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg line-clamp-2">{conversation.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(conversation.created_at)}</span>
                          <Badge variant="secondary" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {conversation.view_count} views
                          </Badge>
                        </div>
                      </CardHeader>
                      {conversation.summary && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {conversation.summary}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No public conversations</h3>
                  <p className="text-muted-foreground">
                    {isOwnProfile 
                      ? 'Start a conversation and make it public to share with the community!'
                      : 'This user hasn\'t shared any public conversations yet.'
                    }
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="private" className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {conversations.filter(conv => conv.is_public === false).length > 0 ? (
                  conversations
                    .filter(conv => conv.is_public === false)
                    .map((conversation) => (
                      <Card 
                        key={conversation.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/chat/${conversation.id}`)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg line-clamp-2">{conversation.title}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDate(conversation.created_at)}</span>
                            <Badge variant="secondary" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {conversation.view_count} views
                            </Badge>
                          </div>
                        </CardHeader>
                        {conversation.summary && (
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {conversation.summary}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No private conversations</h3>
                    <p className="text-muted-foreground">
                      Your private conversations will appear here.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}