import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Check, 
  X, 
  Clock,
  MessageSquare,
  User,
  Calendar,
  Plus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface CollaborationInvitation {
  id: number;
  conversation_id: number;
  conversation_title?: string;
  inviter_username: string;
  invitee_username: string;
  collaboration_type: 'prompt_suggestion' | 'conversation_edit' | 'co_creation';
  permissions: string;
  message?: string;
  is_accepted?: boolean;
  created_at: string;
  expires_at?: string;
}

interface CollaborationInvitePanelProps {
  conversationId: number;
  isOwner: boolean;
  onCollaborationChange?: () => void;
}

export function CollaborationInvitePanel({ 
  conversationId, 
  isOwner, 
  onCollaborationChange 
}: CollaborationInvitePanelProps) {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<CollaborationInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<CollaborationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [error, setError] = useState('');

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    invitee_username: '',
    collaboration_type: 'prompt_suggestion' as const,
    permissions: 'suggest',
    message: ''
  });

  useEffect(() => {
    if (user) {
      fetchMyInvitations();
    }
  }, [user]);

  const fetchMyInvitations = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.request('/collaboration/my-invitations?pending_only=true');
      setMyInvitations(response || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteForm.invitee_username.trim()) return;

    try {
      const response = await apiClient.request(`/collaboration/conversations/${conversationId}/invite`, {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });

      setInviteForm({
        invitee_username: '',
        collaboration_type: 'prompt_suggestion',
        permissions: 'suggest',
        message: ''
      });
      setShowInviteForm(false);
      
      if (onCollaborationChange) {
        onCollaborationChange();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to send invitation');
      console.error('Error sending invitation:', error);
    }
  };

  const handleRespondToInvitation = async (invitationId: number, accept: boolean) => {
    try {
      await apiClient.request(`/collaboration/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });

      // Remove from pending invitations
      setMyInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      if (onCollaborationChange) {
        onCollaborationChange();
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
    }
  };

  const getCollaborationTypeLabel = (type: string) => {
    switch (type) {
      case 'prompt_suggestion': return 'Prompt Suggestions';
      case 'conversation_edit': return 'Conversation Editing';
      case 'co_creation': return 'Co-Creation';
      default: return type;
    }
  };

  const getPermissionsLabel = (permissions: string) => {
    switch (permissions) {
      case 'suggest': return 'Can Suggest';
      case 'edit': return 'Can Edit';
      case 'co_create': return 'Co-Creator';
      default: return permissions;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Login to view collaboration features</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Owner Invite Panel */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Collaborators
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showInviteForm ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Username to Invite
                  </label>
                  <Input
                    value={inviteForm.invitee_username}
                    onChange={(e) => setInviteForm(prev => ({ 
                      ...prev, 
                      invitee_username: e.target.value 
                    }))}
                    placeholder="Enter username..."
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Collaboration Type
                  </label>
                  <Select 
                    value={inviteForm.collaboration_type} 
                    onValueChange={(value: any) => setInviteForm(prev => ({ 
                      ...prev, 
                      collaboration_type: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prompt_suggestion">Prompt Suggestions</SelectItem>
                      <SelectItem value="conversation_edit">Conversation Editing</SelectItem>
                      <SelectItem value="co_creation">Co-Creation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Permissions
                  </label>
                  <Select 
                    value={inviteForm.permissions} 
                    onValueChange={(value) => setInviteForm(prev => ({ 
                      ...prev, 
                      permissions: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggest">Can Suggest Only</SelectItem>
                      <SelectItem value="edit">Can Edit Content</SelectItem>
                      <SelectItem value="co_create">Full Co-Creator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Invitation Message (Optional)
                  </label>
                  <Textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm(prev => ({ 
                      ...prev, 
                      message: e.target.value 
                    }))}
                    placeholder="Add a personal message to your invitation..."
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSendInvite}
                    disabled={!inviteForm.invitee_username.trim()}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invitation
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowInviteForm(false);
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowInviteForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Invite Collaborator
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Pending Invitations */}
      {myInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations ({myInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-3">
                {myInvitations.map((invitation) => (
                  <Card key={invitation.id} className="border border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">
                              {invitation.conversation_title || `Conversation #${invitation.conversation_id}`}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <User className="h-4 w-4" />
                              <span>from {invitation.inviter_username}</span>
                              <Calendar className="h-4 w-4 ml-2" />
                              <span>{new Date(invitation.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Type:</span>
                            <p className="text-muted-foreground">
                              {getCollaborationTypeLabel(invitation.collaboration_type)}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Permissions:</span>
                            <p className="text-muted-foreground">
                              {getPermissionsLabel(invitation.permissions)}
                            </p>
                          </div>
                        </div>

                        {/* Message */}
                        {invitation.message && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <span className="font-medium text-sm">Message:</span>
                            <p className="text-sm text-muted-foreground mt-1">
                              {invitation.message}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleRespondToInvitation(invitation.id, true)}
                            className="flex-1"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespondToInvitation(invitation.id, false)}
                            className="flex-1"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No Invitations Message */}
      {!isOwner && myInvitations.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No pending collaboration invitations</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll see invitations to collaborate on conversations here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}