import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Lightbulb, 
  Users, 
  MessageSquare,
  Eye,
  BarChart3,
  UserPlus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PromptSuggestionPanel } from './PromptSuggestionPanel';
import { CollaborationInvitePanel } from './CollaborationInvitePanel';

interface CollaborationStats {
  total_suggestions: number;
  pending_suggestions: number;
  accepted_suggestions: number;
  active_collaborators: number;
  total_votes: number;
}

interface CollaborationToolbarProps {
  conversationId: number;
  isOwner: boolean;
  isPublic: boolean;
  stats?: CollaborationStats;
  onSuggestionApplied?: (suggestion: any) => void;
  onStatsUpdate?: () => void;
}

export function CollaborationToolbar({ 
  conversationId, 
  isOwner, 
  isPublic,
  stats,
  onSuggestionApplied,
  onStatsUpdate
}: CollaborationToolbarProps) {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handlePanelToggle = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border/40 bg-muted/20">
      {/* Collaboration Status Indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" />
        <span>{isPublic ? 'Public' : 'Private'} Conversation</span>
        {stats && stats.active_collaborators > 0 && (
          <Badge variant="secondary" className="text-xs">
            {stats.active_collaborators} collaborator{stats.active_collaborators !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="flex-1" />

      {/* Collaboration Tools */}
      <div className="flex items-center gap-1">
        {/* Prompt Suggestions */}
        <Popover open={activePanel === 'suggestions'} onOpenChange={(open) => !open && setActivePanel(null)}>
          <PopoverTrigger asChild>
            <Button
              variant={activePanel === 'suggestions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handlePanelToggle('suggestions')}
              className="relative"
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              Suggestions
              {stats && stats.pending_suggestions > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                >
                  {stats.pending_suggestions}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <PromptSuggestionPanel
              conversationId={conversationId}
              isOwner={isOwner}
              onSuggestionApplied={onSuggestionApplied}
            />
          </PopoverContent>
        </Popover>

        {/* Collaboration Management */}
        {isOwner && (
          <Popover open={activePanel === 'collaboration'} onOpenChange={(open) => !open && setActivePanel(null)}>
            <PopoverTrigger asChild>
              <Button
                variant={activePanel === 'collaboration' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handlePanelToggle('collaboration')}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Collaborate
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <Tabs defaultValue="invite" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invite">Invite</TabsTrigger>
                  <TabsTrigger value="manage">Manage</TabsTrigger>
                </TabsList>
                <TabsContent value="invite" className="p-4">
                  <CollaborationInvitePanel
                    conversationId={conversationId}
                    isOwner={isOwner}
                    onCollaborationChange={onStatsUpdate}
                  />
                </TabsContent>
                <TabsContent value="manage" className="p-4">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Collaboration management</p>
                    <p className="text-xs">View and manage active collaborators</p>
                  </div>
                </TabsContent>
              </Tabs>
            </PopoverContent>
          </Popover>
        )}

        {/* Stats Display */}
        {stats && (stats.total_suggestions > 0 || stats.active_collaborators > 0) && (
          <Popover open={activePanel === 'stats'} onOpenChange={(open) => !open && setActivePanel(null)}>
            <PopoverTrigger asChild>
              <Button
                variant={activePanel === 'stats' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handlePanelToggle('stats')}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Stats
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-medium">Collaboration Stats</h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.total_suggestions}
                    </div>
                    <div className="text-muted-foreground">Suggestions</div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.accepted_suggestions}
                    </div>
                    <div className="text-muted-foreground">Accepted</div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.active_collaborators}
                    </div>
                    <div className="text-muted-foreground">Collaborators</div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.total_votes}
                    </div>
                    <div className="text-muted-foreground">Votes</div>
                  </div>
                </div>

                {stats.pending_suggestions > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">
                        {stats.pending_suggestions} suggestion{stats.pending_suggestions !== 1 ? 's' : ''} pending review
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}