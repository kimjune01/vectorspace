// API Response Types - Prevents data structure mismatches

export interface PaginatedResponse<T> {
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
  content: string;
  timestamp: string;
  token_count: number;
  from_user_username?: string;
  from_user_display_name?: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
  participant_count: number;
}

export interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  sessionId: string;
  session: {
    id: string;
    title: string;
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

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  bio?: string;
  profile_image?: string;
  created_at: string;
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

// Utility type for API endpoints that might return either single items or arrays
export type ApiResponse<T> = T extends any[] ? T : T;