import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Lightbulb, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  X, 
  MessageSquare,
  User,
  Calendar,
  Filter,
  Plus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface PromptSuggestion {
  id: number;
  conversation_id: number;
  suggester_id: number;
  suggester_username: string;
  suggester_display_name: string;
  original_message_id?: number;
  suggested_prompt: string;
  reasoning?: string;
  target_position?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'integrated';
  votes_up: number;
  votes_down: number;
  score: number;
  created_at: string;
  updated_at: string;
}

interface PromptSuggestionPanelProps {
  conversationId: number;
  isOwner: boolean;
  onSuggestionApplied?: (suggestion: PromptSuggestion) => void;
}

export function PromptSuggestionPanel({ 
  conversationId, 
  isOwner, 
  onSuggestionApplied 
}: PromptSuggestionPanelProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState('');

  // Create suggestion form state
  const [newSuggestion, setNewSuggestion] = useState({
    suggested_prompt: '',
    reasoning: '',
    target_position: 0
  });

  useEffect(() => {
    fetchSuggestions();
  }, [conversationId, statusFilter]);

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status_filter', statusFilter);
      }
      
      const response = await apiClient.request(`/collaboration/conversations/${conversationId}/suggestions?${params}`);
      setSuggestions(response as any || []);
    } catch (error) {
      setError('Failed to load suggestions');
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSuggestion = async () => {
    if (!newSuggestion.suggested_prompt.trim()) return;

    try {
      const response = await apiClient.request(`/collaboration/conversations/${conversationId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(newSuggestion),
      });

      setSuggestions(prev => [response as any, ...prev]);
      setNewSuggestion({ suggested_prompt: '', reasoning: '', target_position: 0 });
      setShowCreateForm(false);
    } catch (error) {
      setError('Failed to create suggestion');
      console.error('Error creating suggestion:', error);
    }
  };

  const handleVote = async (suggestionId: number, isUpvote: boolean) => {
    try {
      await apiClient.request(`/collaboration/suggestions/${suggestionId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ is_upvote: isUpvote }),
      });
      
      // Refresh suggestions to get updated vote counts
      fetchSuggestions();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleUpdateStatus = async (suggestionId: number, status: string) => {
    try {
      await apiClient.request(`/collaboration/suggestions/${suggestionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      
      setSuggestions(prev => 
        prev.map(s => 
          s.id === suggestionId 
            ? { ...s, status: status as any }
            : s
        )
      );

      // If accepted and callback provided, call it
      if (status === 'accepted' && onSuggestionApplied) {
        const suggestion = suggestions.find(s => s.id === suggestionId);
        if (suggestion) {
          onSuggestionApplied(suggestion);
        }
      }
    } catch (error) {
      console.error('Error updating suggestion status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'default';
      case 'rejected': return 'destructive';
      case 'integrated': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <Check className="h-3 w-3" />;
      case 'rejected': return <X className="h-3 w-3" />;
      case 'integrated': return <Lightbulb className="h-3 w-3" />;
      default: return null;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Login to view and create prompt suggestions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Prompt Suggestions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="integrated">Integrated</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={!user}
            >
              <Plus className="h-4 w-4 mr-1" />
              Suggest
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Create Suggestion Form */}
        {showCreateForm && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Suggested Prompt
                  </label>
                  <Textarea
                    value={newSuggestion.suggested_prompt}
                    onChange={(e) => setNewSuggestion(prev => ({ 
                      ...prev, 
                      suggested_prompt: e.target.value 
                    }))}
                    placeholder="Enter your suggested prompt improvement..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Reasoning (Optional)
                  </label>
                  <Textarea
                    value={newSuggestion.reasoning}
                    onChange={(e) => setNewSuggestion(prev => ({ 
                      ...prev, 
                      reasoning: e.target.value 
                    }))}
                    placeholder="Explain why this suggestion would improve the conversation..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Insert Position
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newSuggestion.target_position}
                    onChange={(e) => setNewSuggestion(prev => ({ 
                      ...prev, 
                      target_position: parseInt(e.target.value) || 0 
                    }))}
                    placeholder="0 = beginning"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateSuggestion}
                    disabled={!newSuggestion.suggested_prompt.trim()}
                  >
                    Create Suggestion
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Suggestions List */}
        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-12 bg-muted rounded mb-3"></div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-16"></div>
                      <div className="h-6 bg-muted rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No suggestions yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to suggest an improvement!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="relative">
                  <CardContent className="pt-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{suggestion.suggester_display_name}</span>
                        <Calendar className="h-4 w-4 ml-2" />
                        <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
                      </div>
                      <Badge 
                        variant={getStatusColor(suggestion.status)}
                        className="flex items-center gap-1"
                      >
                        {getStatusIcon(suggestion.status)}
                        {suggestion.status}
                      </Badge>
                    </div>

                    {/* Suggestion Content */}
                    <div className="mb-3">
                      <div className="bg-muted/50 rounded-lg p-3 mb-2">
                        <p className="text-sm font-medium mb-1">Suggested Prompt:</p>
                        <p className="text-sm">{suggestion.suggested_prompt}</p>
                      </div>
                      {suggestion.reasoning && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                          <p className="text-sm font-medium mb-1">Reasoning:</p>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.reasoning}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Voting */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVote(suggestion.id, true)}
                            className="h-7 px-2"
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {suggestion.votes_up}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVote(suggestion.id, false)}
                            className="h-7 px-2"
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            {suggestion.votes_down}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Score: {suggestion.score}
                        </div>
                      </div>

                      {/* Owner Controls */}
                      {isOwner && suggestion.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(suggestion.id, 'accepted')}
                            className="h-7"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(suggestion.id, 'rejected')}
                            className="h-7"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}