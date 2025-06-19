// API Types - Updated to match backend schemas exactly

export interface User {
  id: number
  username: string
  display_name: string
  email: string
  bio?: string
  conversation_count: number
  conversations_last_24h: number
  profile_image_url?: string
  stripe_pattern_seed: number
}

export interface Conversation {
  id: number
  user_id: number
  title: string
  summary_public?: string
  token_count: number
  created_at: string
  last_message_at: string
  archived_at?: string
  is_public: boolean
  is_hidden_from_profile: boolean
  view_count: number
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
  participant_count: number
}

export interface Message {
  id: number
  conversation_id: number
  from_user_id?: number
  from_user_username?: string
  from_user_display_name?: string
  role: 'user' | 'assistant' | 'system'
  message_type: 'chat' | 'system' | 'visitor_message'
  content: string
  token_count: number
  parent_message_id?: number
  timestamp: string
}

// Auth Types
export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  display_name: string
  email: string
  password: string
  bio?: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  user: User
}

// API Response Types
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}