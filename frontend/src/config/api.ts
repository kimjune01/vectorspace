/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints, timeouts, and settings.
 * This makes it easier to manage API configuration across the application.
 */

/**
 * API base URLs for different environments
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  CORPUS_BASE_URL: '/api/corpus',
  WEBSOCKET_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws',
  
  // Request timeouts (in milliseconds)
  TIMEOUT: {
    DEFAULT: 10000,     // 10 seconds
    UPLOAD: 30000,      // 30 seconds for file uploads
    WEBSOCKET: 5000,    // 5 seconds for WebSocket connection
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_DELAY: 1000, // Start with 1 second
    BACKOFF_MULTIPLIER: 2, // Double the delay each time
  },
  
  // Pagination defaults
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  
  // Cache configuration
  CACHE: {
    STALE_TIME: 5 * 60 * 1000, // 5 minutes
    CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  }
} as const;

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
  },
  
  // Users
  USERS: {
    PROFILE: (username: string) => `/users/profile/${username}`,
    UPDATE_PROFILE: '/users/profile',
    UPLOAD_IMAGE: '/users/profile/image',
    STATS: (userId: number) => `/users/${userId}/stats`,
  },
  
  // Conversations
  CONVERSATIONS: {
    LIST: '/conversations',
    CREATE: '/conversations',
    DETAILS: (id: number) => `/conversations/${id}`,
    MESSAGES: (id: number) => `/conversations/${id}/messages`,
    ARCHIVE: (id: number) => `/conversations/${id}/archive`,
    SIMILAR: (id: number) => `/conversations/${id}/similar`,
    JOIN: (id: number) => `/conversations/${id}/join`,
    LEAVE: (id: number) => `/conversations/${id}/leave`,
    WEBSOCKET: (id: number) => `/ws/conversations/${id}`,
  },
  
  // Search and Discovery
  SEARCH: {
    CONVERSATIONS: '/search/conversations',
    USERS: '/search/users',
    SIMILAR: '/discover/similar',
  },
  
  // Social Features
  SOCIAL: {
    FOLLOW: (userId: number) => `/users/${userId}/follow`,
    FOLLOWERS: (userId: number) => `/users/${userId}/followers`,
    FOLLOWING: (userId: number) => `/users/${userId}/following`,
    SAVE_CONVERSATION: (id: number) => `/conversations/${id}/save`,
    COLLECTIONS: '/collections',
    NOTIFICATIONS: '/notifications',
  },
  
  // Corpus/External Content
  CORPUS: {
    HEALTH: '/corpus/health',
    SEARCH: '/corpus/search',
    COLLECTIONS: '/corpus/collections',
    STATS: (collection: string) => `/corpus/collections/${collection}/stats`,
  }
} as const;

/**
 * HTTP status codes with semantic meaning
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Request headers for different content types
 */
export const REQUEST_HEADERS = {
  JSON: {
    'Content-Type': 'application/json',
  },
  FORM_DATA: {
    // Don't set Content-Type for FormData - browser will set it with boundary
  },
  TEXT: {
    'Content-Type': 'text/plain',
  }
} as const;