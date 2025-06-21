// API Response Types - Prevents data structure mismatches

export interface PaginatedResponse<T = unknown> {
  data: T;
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface Conversation {
  id: number;
  title: string;
  user_id: number;
  is_public: boolean;
  is_hidden_from_profile: boolean;
  created_at: string;
  updated_at?: string;
  last_message_at: string;
  token_count: number;
  summary_public?: string;
  archived_at?: string;
  view_count: number;
}

export interface ConversationsResponse extends PaginatedResponse<Conversation> {
  conversations: Conversation[];
}

export interface Message {
  id: number;
  conversation_id: number;
  from_user_id: number;
  role: 'user' | 'assistant' | 'system';
  message_type: 'system' | 'chat' | 'visitor_message';
  content: string;
  timestamp: string;
  token_count: number;
  from_user_username?: string;
  from_user_display_name?: string;
}

export interface ConversationDetail extends Conversation {
  author_username: string;
  author_display_name: string;
  messages: Message[];
  participant_count: number;
}

export interface SearchResult {
  id: number;
  title: string;
  summary: string;
  created_at: string;
  view_count: number;
  similarity_score?: number;
  author: {
    username: string;
    display_name: string;
  };
}

export interface SearchResponse {
  conversations: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total_found: number;
    has_more: boolean;
    is_anonymous: boolean;
  };
  query: string;
}

export interface DiscoverResponse {
  conversations: SearchResult[];
  total_found: number;
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  bio?: string;
  profile_image?: string;
  created_at: string;
  conversation_count: number;
  conversations_last_24h: number;
  stripe_pattern_seed: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail?: string;
  message?: string;
  status?: number;
}

// Enhanced error types for better error handling
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  detail: string | ValidationError[];
  message?: string;
  status_code: number;
  error_type?: 'validation' | 'authentication' | 'authorization' | 'not_found' | 'server_error';
}

// Request body types for API calls
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  display_name: string;
  email: string;
  password: string;
  bio?: string;
}

export interface ConversationCreateRequest {
  title: string;
  description?: string;
  is_public?: boolean;
}

export interface MessageCreateRequest {
  content: string;
  role?: 'user' | 'assistant' | 'system';
  message_type?: 'chat' | 'system' | 'visitor_message';
  parent_message_id?: number;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

// Response types for actions
export interface ConversationCreateResponse extends Conversation {}

export interface MessageCreateResponse extends Message {}

export interface SimilarConversationsResponse {
  conversations: Conversation[];
  total: number;
}

// Utility type for API endpoints that might return either single items or arrays
export type ApiResponse<T> = T;

// ========================================
// SOCIAL FEATURES API TYPES
// ========================================

// Re-export social types for convenience
export type {
  // Follow System
  FollowCreate,
  Follow,
  UserFollowStats,
  FollowerUser,
  PaginatedFollowers,
  PaginatedFollowing,
  
  // Curation
  SaveConversationRequest,
  SavedConversation,
  UpdateSavedConversationRequest,
  CollectionCreate,
  CollectionUpdate,
  Collection,
  CollectionWithItems,
  AddToCollectionRequest,
  PaginatedSavedConversations,
  PaginatedCollections,
  
  // Human Chat
  HumanMessageCreate,
  HumanMessage,
  HumanChatRoomInfo,
  
  // Collaboration
  CollaborationInvite,
  Collaborator,
  CollaborationInviteNotification,
  PromptSuggestion,
  AcceptCollaborationRequest,
  
  // Notifications
  Notification,
  NotificationUpdate,
  PaginatedNotifications,
  
  // Discovery
  DiscoverPerson,
  FollowingActivity,
  
  // WebSocket
  SocialWebSocketMessage,
  HumanChatMessage,
  UserJoinedRoom,
  UserLeftRoom,
  PromptSuggestionMessage,
  CollaborationInviteMessage,
} from './social';

// API endpoint type definitions for social features
export interface SocialApiEndpoints {
  // Follow System
  'POST /api/users/{id}/follow': {
    request: FollowCreate;
    response: Follow;
  };
  'DELETE /api/users/{id}/follow': {
    request: void;
    response: { message: string };
  };
  'GET /api/users/{id}/followers': {
    request: { page?: number; per_page?: number };
    response: PaginatedFollowers;
  };
  'GET /api/users/{id}/following': {
    request: { page?: number; per_page?: number };
    response: PaginatedFollowing;
  };
  'GET /api/users/{id}/follow-stats': {
    request: void;
    response: UserFollowStats;
  };
  
  // Curation
  'POST /api/conversations/{id}/save': {
    request: SaveConversationRequest;
    response: SavedConversation;
  };
  'DELETE /api/conversations/{id}/save': {
    request: void;
    response: { message: string };
  };
  'PUT /api/saved-conversations/{id}': {
    request: UpdateSavedConversationRequest;
    response: SavedConversation;
  };
  'GET /api/users/{id}/saved-conversations': {
    request: { page?: number; per_page?: number; tags?: string };
    response: PaginatedSavedConversations;
  };
  'POST /api/collections': {
    request: CollectionCreate;
    response: Collection;
  };
  'GET /api/users/{id}/collections': {
    request: { page?: number; per_page?: number };
    response: PaginatedCollections;
  };
  'GET /api/collections/{id}': {
    request: void;
    response: CollectionWithItems;
  };
  'PUT /api/collections/{id}': {
    request: CollectionUpdate;
    response: Collection;
  };
  'DELETE /api/collections/{id}': {
    request: void;
    response: { message: string };
  };
  'POST /api/collections/{id}/add': {
    request: AddToCollectionRequest;
    response: { message: string };
  };
  
  // Human Chat
  'GET /api/conversations/{id}/human-chat': {
    request: { limit?: number };
    response: HumanChatRoomInfo;
  };
  'POST /api/conversations/{id}/human-chat': {
    request: HumanMessageCreate;
    response: HumanMessage;
  };
  
  // Collaboration
  'POST /api/conversations/{id}/invite': {
    request: CollaborationInvite;
    response: { message: string };
  };
  'GET /api/conversations/{id}/collaborators': {
    request: void;
    response: Collaborator[];
  };
  'POST /api/collaboration-invites/{id}/accept': {
    request: AcceptCollaborationRequest;
    response: { message: string };
  };
  'DELETE /api/conversations/{id}/collaborators/{user_id}': {
    request: void;
    response: { message: string };
  };
  'POST /api/conversations/{id}/suggest-prompt': {
    request: PromptSuggestion;
    response: { message: string };
  };
  
  // Notifications
  'GET /api/notifications': {
    request: { page?: number; per_page?: number; unread_only?: boolean };
    response: PaginatedNotifications;
  };
  'PUT /api/notifications/{id}': {
    request: NotificationUpdate;
    response: Notification;
  };
  'PUT /api/notifications/mark-all-read': {
    request: void;
    response: { message: string };
  };
  
  // Discovery
  'GET /api/discover/people': {
    request: { page?: number; per_page?: number };
    response: DiscoverPerson[];
  };
  'GET /api/discover/following-activity': {
    request: { page?: number; per_page?: number };
    response: FollowingActivity[];
  };
}

// Import types from social.ts for type safety
import type {
  FollowCreate, Follow, UserFollowStats,
  PaginatedFollowers, PaginatedFollowing,
  SaveConversationRequest, SavedConversation, UpdateSavedConversationRequest,
  CollectionCreate, CollectionUpdate, Collection, CollectionWithItems,
  AddToCollectionRequest, PaginatedSavedConversations, PaginatedCollections,
  HumanMessageCreate, HumanMessage, HumanChatRoomInfo,
  CollaborationInvite, Collaborator,
  PromptSuggestion, AcceptCollaborationRequest,
  Notification, NotificationUpdate, PaginatedNotifications,
  DiscoverPerson, FollowingActivity
} from './social';

// ========================================
// CORPUS SERVICE API TYPES
// ========================================

export interface CorpusHealthResponse {
  status: string;
  corpus_service: string;
  collections: Record<string, {
    name: string;
    document_count: number;
    last_updated?: string;
  }>;
  error?: string;
}

export interface CorpusCollectionsResponse {
  collections: string[];
  debug: {
    user_id: number;
    corpus_url: string;
  };
}

export interface CorpusSearchResult {
  id: string;
  content: string;
  title: string;
  url: string;
  platform: string;
  author: string;
  timestamp: string;
  score?: number;
  comment_count?: number;
  similarity_score: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface CorpusSearchRequest {
  query_texts: string[];
  collections?: string[];
  limit?: number;
  min_similarity?: number;
}

export interface CorpusSearchResponse {
  results: CorpusSearchResult[];
  query: string[];
  collections_searched: string[];
  total_found: number;
  debug: {
    user_id: number;
    corpus_url: string;
    search_params: CorpusSearchRequest;
  };
}

export interface CorpusCollectionStats {
  collection: string;
  stats: {
    name: string;
    document_count: number;
    last_updated: string;
    size_bytes?: number;
    sample_documents: string[];
  };
  debug: {
    user_id: number;
    corpus_url: string;
  };
}

export interface CorpusDebugStatus {
  corpus_health: {
    status: string;
    corpus_service: string;
    url: string;
    error?: string;
    suggestion?: string;
  };
  integration_config: {
    corpus_service_url: string;
    request_timeout: number;
    current_user: string;
  };
  collections?: string[];
  corpus_debug?: {
    status: string;
    collections?: string[];
    error?: string;
  };
  corpus_api_error?: {
    error: string;
    details: Record<string, string | number | boolean>;
  };
}

// Enhanced neighboring conversation type that includes external corpus results
export interface EnhancedSimilarConversation {
  // Internal conversation fields
  id?: number;
  title: string;
  summary: string;
  similarity_score: number;
  author: {
    username: string;
  };
  
  // External corpus fields
  corpus_id?: string;
  url?: string;
  platform?: string;
  timestamp?: string;
  comment_count?: number;
  score?: number;
  
  // Type discriminator
  source: 'internal' | 'external';
}

export interface EnhancedSimilarConversationsResponse {
  internal_conversations: Conversation[];
  external_conversations: CorpusSearchResult[];
  total_internal: number;
  total_external: number;
  corpus_available: boolean;
  corpus_error?: string;
}