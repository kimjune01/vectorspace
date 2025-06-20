import type { 
  ConversationsResponse, 
  ConversationDetail, 
  SearchResponse,
  DiscoverResponse, 
  AuthResponse, 
  User,
  ApiErrorResponse,
  LoginRequest,
  RegisterRequest,
  ConversationCreateRequest,
  ConversationCreateResponse,
  SimilarConversationsResponse
} from '@/types/api';

const API_BASE_URL = '/api';

export class BackendError extends Error {
  public readonly statusCode: number;
  public readonly errorType: 'network' | 'server' | 'timeout' | 'client_error' | 'server_error';
  public readonly timestamp: Date;

  constructor(message: string, statusCode: number, errorType: 'network' | 'server' | 'timeout' | 'client_error' | 'server_error') {
    super(message);
    this.name = 'BackendError';
    this.statusCode = statusCode;
    this.errorType = this.normalizeErrorType(errorType, statusCode);
    this.timestamp = new Date();
  }

  private normalizeErrorType(type: string, statusCode: number): 'network' | 'server' | 'timeout' {
    if (statusCode === 0) return type as 'network' | 'timeout';
    if (statusCode >= 500) return 'server';
    if (statusCode === 408 || statusCode === 504) return 'timeout';
    return 'network'; // Default for 4xx and other issues
  }

  public isNetworkError(): boolean {
    return this.errorType === 'network' || this.statusCode === 0;
  }

  public isServerError(): boolean {
    return this.errorType === 'server' || this.statusCode >= 500;
  }

  public isTimeoutError(): boolean {
    return this.errorType === 'timeout' || this.statusCode === 408 || this.statusCode === 504;
  }
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Check if localStorage is available (client-side)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
      console.log('API Client initialized with token:', !!this.token);
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
        console.log('Token set in localStorage:', token.substring(0, 10) + '...');
      } else {
        localStorage.removeItem('auth_token');
        console.log('Token removed from localStorage');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && {
          Authorization: `Bearer ${this.token}`,
        }),
        ...options.headers,
      },
    };

    try {
      console.log('Making API request:', { url, config });
      const response = await fetch(url, config);

      if (!response.ok) {
        let error: ApiErrorResponse;
        try {
          error = await response.json();
        } catch {
          error = { 
            detail: `HTTP ${response.status}`, 
            status_code: response.status,
            error_type: response.status >= 500 ? 'server_error' : 'client_error' as any
          };
        }
        const errorMessage = Array.isArray(error.detail) 
          ? error.detail.map(e => e.message).join(', ')
          : error.detail || error.message || 'API request failed';
        
        // Create enhanced error with backend connectivity info
        const enhancedError = new BackendError(errorMessage, response.status, 'server_error');
        throw enhancedError;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof BackendError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network connectivity issue
        throw new BackendError('Unable to connect to backend servers', 0, 'network');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        // Request timeout
        throw new BackendError('Request timed out', 0, 'timeout');
      }
      if (error instanceof Error) {
        throw new BackendError(error.message, 0, 'network');
      }
      throw new BackendError('Unknown network error', 0, 'network');
    }
  }

  // Auth endpoints
  async login(username: string, password: string): Promise<AuthResponse> {
    const loginData: LoginRequest = { username, password };
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });
    this.setToken(response.access_token);
    return response;
  }

  async register(username: string, display_name: string, email: string, password: string, bio?: string): Promise<AuthResponse> {
    const registerData: RegisterRequest = { username, display_name, email, password, bio };
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData),
    });
    this.setToken(response.access_token);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/users/me');
  }

  // Conversation endpoints
  async getConversations(): Promise<ConversationsResponse> {
    const response = await this.request<ConversationsResponse>('/conversations/');
    
    // Runtime validation in development - would have caught our bug immediately!
    if (process.env.NODE_ENV === 'development') {
      if (!response.conversations || !Array.isArray(response.conversations)) {
        console.error('🚨 API Response Validation Failed:', {
          endpoint: '/conversations/',
          expected: 'object with conversations array',
          received: typeof response,
          responseKeys: Object.keys(response || {}),
          actualResponse: response
        });
        throw new Error(`Invalid API response structure from /conversations/. Expected {conversations: [...]} but got ${typeof response}`);
      }
    }
    
    return response;
  }

  async getConversation(id: string): Promise<ConversationDetail> {
    return this.request<ConversationDetail>(`/conversations/${id}`);
  }

  async createConversation(title: string, description?: string): Promise<ConversationCreateResponse> {
    const createData: ConversationCreateRequest = { title, description };
    return this.request<ConversationCreateResponse>('/conversations/', {
      method: 'POST',
      body: JSON.stringify(createData),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    return this.request<void>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  // Search endpoints
  async searchConversations(query: string, limit: number = 20): Promise<SearchResponse> {
    return this.request<SearchResponse>(`/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async discoverConversations(limit: number = 20): Promise<DiscoverResponse> {
    return this.request<DiscoverResponse>(`/discover?limit=${limit}`);
  }

  async getSimilarConversations(conversationId: string, limit: number = 20): Promise<SimilarConversationsResponse> {
    return this.request<SimilarConversationsResponse>(`/conversations/${conversationId}/similar?limit=${limit}`, {
      method: 'GET',
    });
  }

  // User profile endpoints
  async getUserProfile(username: string) {
    return this.request<User & { recent_conversations: any[] }>(`/users/profile/${username}`);
  }

  // WebSocket URL helper
  getWebSocketUrl(conversationId: string): string {
    // Get WebSocket URL from environment or default to backend
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/api/ws';
    
    if (!this.token) {
      throw new Error('Authentication token required for WebSocket connection');
    }
    return `${wsBaseUrl}/conversations/${conversationId}?token=${encodeURIComponent(this.token)}`;
  }
}

export const apiClient = new ApiClient();