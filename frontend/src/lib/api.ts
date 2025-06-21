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
  SimilarConversationsResponse,
  CorpusHealthResponse,
  CorpusCollectionsResponse,
  CorpusSearchResponse,
  CorpusCollectionStats,
  CorpusDebugStatus
} from '@/types/api';

// Use environment variable in production, fallback to proxy in development
const API_BASE_URL = import.meta.env.PROD && import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

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

  // Follow system endpoints
  async followUser(userId: number) {
    return this.request(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  async unfollowUser(userId: number) {
    return this.request(`/users/${userId}/follow`, {
      method: 'DELETE',
    });
  }

  async getUserFollowers(userId: number, page: number = 1, perPage: number = 20) {
    return this.request(`/users/${userId}/followers?page=${page}&per_page=${perPage}`);
  }

  async getUserFollowing(userId: number, page: number = 1, perPage: number = 20) {
    return this.request(`/users/${userId}/following?page=${page}&per_page=${perPage}`);
  }

  async getUserFollowStats(userId: number) {
    return this.request(`/users/${userId}/follow-stats`);
  }

  async checkIfFollowing(userId: number) {
    return this.request<{ is_following: boolean }>(`/users/me/is-following/${userId}`);
  }

  // Notification endpoints
  async getNotifications(page: number = 1, perPage: number = 20, unreadOnly: boolean = false) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      unread_only: unreadOnly.toString()
    });
    return this.request(`/notifications?${params}`);
  }

  async getNotificationStats() {
    return this.request(`/notifications/stats`);
  }

  async markNotificationRead(notificationId: number) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead() {
    return this.request(`/notifications/read-all`, {
      method: 'POST',
    });
  }

  async deleteNotification(notificationId: number) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Curation endpoints
  async saveConversation(conversationId: number, data?: {tags?: string[], personal_note?: string}) {
    return this.request(`/curation/conversations/${conversationId}/save`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async unsaveConversation(conversationId: number) {
    return this.request(`/curation/conversations/${conversationId}/save`, {
      method: 'DELETE',
    });
  }

  async checkIfSaved(conversationId: number) {
    return this.request<{ is_saved: boolean }>(`/curation/saved/check/${conversationId}`);
  }

  async getSavedConversations(page: number = 1, perPage: number = 20, tag?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    });
    if (tag) params.append('tag', tag);
    return this.request(`/curation/saved?${params}`);
  }

  async updateSavedConversation(savedId: number, data: {tags?: string[], personal_note?: string}) {
    return this.request(`/curation/saved/${savedId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createCollection(data: {name: string, description?: string, is_public?: boolean, conversation_ids?: number[]}) {
    return this.request(`/curation/collections`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyCollections(page: number = 1, perPage: number = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    });
    return this.request(`/curation/collections?${params}`);
  }

  async getCollectionDetails(collectionId: number) {
    return this.request(`/curation/collections/${collectionId}`);
  }

  async updateCollection(collectionId: number, data: {name?: string, description?: string, is_public?: boolean}) {
    return this.request(`/curation/collections/${collectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async addToCollection(collectionId: number, conversationIds: number[]) {
    return this.request(`/curation/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({conversation_ids: conversationIds}),
    });
  }

  async removeFromCollection(collectionId: number, conversationId: number) {
    return this.request(`/curation/collections/${collectionId}/items/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async deleteCollection(collectionId: number) {
    return this.request(`/curation/collections/${collectionId}`, {
      method: 'DELETE',
    });
  }

  // Human chat endpoints
  async sendHumanMessage(conversationId: number, content: string) {
    return this.request(`/human-chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getHumanMessages(conversationId: number, limit: number = 50, beforeId?: number) {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    if (beforeId) params.append('before_id', beforeId.toString());
    
    return this.request(`/human-chat/conversations/${conversationId}/messages?${params}`);
  }

  async getHumanChatInfo(conversationId: number) {
    return this.request(`/human-chat/conversations/${conversationId}/chat-info`);
  }

  async deleteHumanMessage(conversationId: number, messageId: number) {
    return this.request(`/human-chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async joinChatRoom(conversationId: number) {
    return this.request(`/human-chat/conversations/${conversationId}/join`, {
      method: 'POST',
    });
  }

  async leaveChatRoom(conversationId: number) {
    return this.request(`/human-chat/conversations/${conversationId}/leave`, {
      method: 'POST',
    });
  }

  async getOnlineUsers(conversationId: number) {
    return this.request(`/human-chat/conversations/${conversationId}/online-users`);
  }

  // Corpus service endpoints
  async getCorpusHealth(): Promise<CorpusHealthResponse> {
    return this.request<CorpusHealthResponse>(`/corpus/health`);
  }

  async getCorpusCollections(): Promise<CorpusCollectionsResponse> {
    return this.request<CorpusCollectionsResponse>(`/corpus/collections`);
  }

  async searchSimilarContent(queryTexts: string[], collections: string[] = ["hackernews"], limit: number = 5, minSimilarity: number = 0.75): Promise<CorpusSearchResponse> {
    return this.request<CorpusSearchResponse>(`/corpus/similarity/search`, {
      method: 'POST',
      body: JSON.stringify({
        query_texts: queryTexts,
        collections,
        limit,
        min_similarity: minSimilarity
      }),
    });
  }

  async getCorpusCollectionStats(collectionName: string): Promise<CorpusCollectionStats> {
    return this.request<CorpusCollectionStats>(`/corpus/collections/${collectionName}/stats`);
  }

  async getCorpusDebugStatus(): Promise<CorpusDebugStatus> {
    return this.request<CorpusDebugStatus>(`/corpus/debug/status`);
  }

  // Collaboration endpoints
  async createPromptSuggestion(conversationId: number, data: {
    suggested_prompt: string;
    reasoning?: string;
    original_message_id?: number;
    target_position?: number;
  }) {
    return this.request(`/collaboration/conversations/${conversationId}/suggestions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPromptSuggestions(conversationId: number, statusFilter?: string) {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    return this.request(`/collaboration/conversations/${conversationId}/suggestions?${params}`);
  }

  async updateSuggestionStatus(suggestionId: number, status: string) {
    return this.request(`/collaboration/suggestions/${suggestionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async voteOnSuggestion(suggestionId: number, isUpvote: boolean) {
    return this.request(`/collaboration/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ is_upvote: isUpvote }),
    });
  }

  async inviteCollaborator(conversationId: number, data: {
    invitee_username: string;
    collaboration_type: string;
    permissions: string;
    message?: string;
  }) {
    return this.request(`/collaboration/conversations/${conversationId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyCollaborationInvitations(pendingOnly: boolean = true) {
    const params = new URLSearchParams();
    params.append('pending_only', pendingOnly.toString());
    return this.request(`/collaboration/my-invitations?${params}`);
  }

  async respondToCollaborationInvitation(invitationId: number, accept: boolean) {
    return this.request(`/collaboration/invitations/${invitationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  }

  async getCollaborationStats(conversationId: number) {
    return this.request(`/collaboration/conversations/${conversationId}/stats`);
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