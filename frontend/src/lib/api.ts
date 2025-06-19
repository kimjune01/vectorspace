import type { 
  ConversationsResponse, 
  ConversationDetail, 
  SearchResponse, 
  AuthResponse, 
  User,
  ApiError 
} from '@/types/api';

const API_BASE_URL = '/api';

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
      const response = await window.fetch(url, config);

      if (!response.ok) {
        let error: ApiError;
        try {
          error = await response.json();
        } catch {
          error = { message: `HTTP ${response.status}` };
        }
        throw new Error(error.detail || error.message || 'API request failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  }

  // Auth endpoints
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(response.access_token);
    return response;
  }

  async register(username: string, display_name: string, email: string, password: string, bio?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, display_name, email, password, bio }),
    });
    this.setToken(response.access_token);
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
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

  async createConversation(title: string, description?: string) {
    return this.request<any>('/conversations/', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  async deleteConversation(id: string) {
    return this.request(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  // Search endpoints
  async searchConversations(query: string, limit: number = 20): Promise<SearchResponse> {
    return this.request<SearchResponse>(`/search?query=${encodeURIComponent(query)}&limit=${limit}`, {
      method: 'POST',
    });
  }

  async getSimilarConversations(conversationId: string, limit: number = 20) {
    return this.request<any>(`/conversations/${conversationId}/similar?limit=${limit}`, {
      method: 'GET',
    });
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