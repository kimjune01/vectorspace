/**
 * TypeScript types for social features.
 * These types match the backend Pydantic schemas.
 */

// ========================================
// FOLLOW SYSTEM TYPES
// ========================================

export interface FollowCreate {
  following_id: number;
}

export interface Follow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: string;
}

export interface UserFollowStats {
  followers_count: number;
  following_count: number;
}

export interface FollowerUser {
  id: number;
  username: string;
  display_name: string;
  bio?: string;
  profile_image_data?: string;
  stripe_pattern_seed: number;
  followed_at: string;
}

export interface PaginatedFollowers {
  followers: FollowerUser[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedFollowing {
  following: FollowerUser[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

// ========================================
// CURATION TYPES
// ========================================

export interface SaveConversationRequest {
  tags?: string[];
  personal_note?: string;
}

export interface SavedConversation {
  id: number;
  user_id: number;
  conversation_id: number;
  saved_at: string;
  tags: string[];
  personal_note?: string;
  conversation_title: string;
  conversation_summary?: string;
  conversation_author: string;
}

export interface UpdateSavedConversationRequest {
  tags?: string[];
  personal_note?: string;
}

export interface CollectionCreate {
  name: string;
  description?: string;
  is_public?: boolean;
  conversation_ids?: number[];
}

export interface CollectionUpdate {
  name?: string;
  description?: string;
  is_public?: boolean;
}

export interface Collection {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items_count: number;
}

export interface CollectionWithItems {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items: SavedConversation[];
}

export interface AddToCollectionRequest {
  conversation_ids: number[];
}

export interface PaginatedSavedConversations {
  saved_conversations: SavedConversation[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedCollections {
  collections: Collection[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

// ========================================
// HUMAN CHAT TYPES
// ========================================

export interface HumanMessageCreate {
  content: string;
}

export interface HumanMessage {
  id: number;
  conversation_id: number;
  user_id: number;
  content: string;
  sent_at: string;
  expires_at: string;
  user_username: string;
  user_display_name: string;
  user_profile_image_data?: string;
}

export interface HumanChatRoomInfo {
  conversation_id: number;
  online_users: number[];
  can_chat: boolean;
  recent_messages: HumanMessage[];
}

// ========================================
// COLLABORATION TYPES
// ========================================

export interface CollaborationInvite {
  user_ids: number[];
  message?: string;
}

export interface Collaborator {
  id: number;
  conversation_id: number;
  user_id: number;
  invited_by_id: number;
  invited_at: string;
  accepted_at?: string;
  left_at?: string;
  can_suggest_prompts: boolean;
  user_username: string;
  user_display_name: string;
  user_profile_image_data?: string;
}

export interface CollaborationInviteNotification {
  id: number;
  conversation_id: number;
  conversation_title: string;
  conversation_author: string;
  invited_by_username: string;
  invited_by_display_name: string;
  invited_at: string;
  message?: string;
}

export interface PromptSuggestion {
  suggested_prompt: string;
  context_note?: string;
}

export interface AcceptCollaborationRequest {
  accept?: boolean;
}

// ========================================
// NOTIFICATION TYPES
// ========================================

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_user_id?: number;
  related_user?: {
    id: number;
    username: string;
    display_name: string;
    profile_image_data?: string;
  };
  related_conversation_id?: number;
}

export interface NotificationUpdate {
  read?: boolean;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface NotificationStatsResponse {
  unread_count: number;
  total_count: number;
}

// ========================================
// DISCOVERY TYPES
// ========================================

export interface DiscoverPerson {
  id: number;
  username: string;
  display_name: string;
  bio?: string;
  profile_image_data?: string;
  stripe_pattern_seed: number;
  common_topics: string[];
  recent_conversations_count: number;
  is_following: boolean;
}

export interface FollowingActivity {
  type: string; // 'new_conversation', 'saved_conversation'
  user_id: number;
  user_username: string;
  user_display_name: string;
  conversation_id?: number;
  conversation_title?: string;
  activity_at: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

// ========================================
// WEBSOCKET MESSAGE TYPES
// ========================================

export interface HumanChatMessage {
  type: 'human_message';
  data: HumanMessage;
}

export interface UserJoinedRoom {
  type: 'user_joined';
  data: {
    user_id: number;
    username: string;
    display_name: string;
  };
}

export interface UserLeftRoom {
  type: 'user_left';
  data: {
    user_id: number;
    username: string;
  };
}

export interface PromptSuggestionMessage {
  type: 'prompt_suggestion';
  data: {
    from_user_id: number;
    from_username: string;
    suggested_prompt: string;
    context_note?: string;
  };
}

export interface CollaborationInviteMessage {
  type: 'collaboration_invite';
  data: CollaborationInviteNotification;
}

export type SocialWebSocketMessage = 
  | HumanChatMessage 
  | UserJoinedRoom 
  | UserLeftRoom 
  | PromptSuggestionMessage
  | CollaborationInviteMessage;

// ========================================
// COMPONENT PROP TYPES
// ========================================

export interface FollowButtonProps {
  targetUserId: number;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline';
}

export interface BookmarkButtonProps {
  conversationId: number;
  initialIsSaved?: boolean;
  onSaveChange?: (isSaved: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}

export interface HumanChatPanelProps {
  conversationId: number;
  currentUserId: number;
  canChat: boolean;
  onJoinChat?: () => void;
}

export interface CollaborationPanelProps {
  conversationId: number;
  isOwner: boolean;
  collaborators: Collaborator[];
  onInviteCollaborators?: () => void;
}

export interface NotificationBellProps {
  unreadCount: number;
  onNotificationClick?: (notification: Notification) => void;
}

// ========================================
// HOOK RETURN TYPES
// ========================================

export interface UseFollowReturn {
  isFollowing: boolean;
  isLoading: boolean;
  error: string | null;
  follow: () => Promise<void>;
  unfollow: () => Promise<void>;
  toggleFollow: () => Promise<void>;
}

export interface UseSavedConversationReturn {
  isSaved: boolean;
  isLoading: boolean;
  error: string | null;
  saveConversation: (data?: SaveConversationRequest) => Promise<void>;
  unsaveConversation: () => Promise<void>;
  updateSavedConversation: (data: UpdateSavedConversationRequest) => Promise<void>;
}

export interface UseHumanChatReturn {
  messages: HumanMessage[];
  onlineUsers: number[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  joinRoom: () => void;
  leaveRoom: () => void;
}

export interface UseCollaborationReturn {
  collaborators: Collaborator[];
  invitations: CollaborationInviteNotification[];
  isLoading: boolean;
  error: string | null;
  inviteCollaborators: (data: CollaborationInvite) => Promise<void>;
  acceptInvitation: (inviteId: number) => Promise<void>;
  leaveCollaboration: (conversationId: number) => Promise<void>;
  suggestPrompt: (conversationId: number, data: PromptSuggestion) => Promise<void>;
}