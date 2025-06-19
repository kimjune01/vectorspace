import { vi } from 'vitest'

export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}

export const mockConversation = {
  id: '1',
  title: 'Test Conversation',
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:00:00Z',
  archived: false,
  visibility: 'public' as const,
  user_id: 'user1',
  summary: 'Test conversation summary',
}

export const mockMessage = {
  id: '1',
  content: 'Test message',
  sender_type: 'user' as const,
  sender_id: 'user1',
  timestamp: '2023-12-01T10:00:00Z',
  conversation_id: '1',
}

export const mockUser = {
  id: 'user1',
  username: 'testuser',
  email: 'test@example.com',
  created_at: '2023-12-01T10:00:00Z',
  profile_image: null,
}

// Mock successful API responses
export const mockApiResponses = {
  conversations: {
    data: [mockConversation],
    pagination: { page: 1, limit: 10, total: 1, total_pages: 1 }
  },
  messages: {
    data: [mockMessage],
    pagination: { page: 1, limit: 50, total: 1, total_pages: 1 }
  },
  user: mockUser,
  auth: {
    access_token: 'mock-token',
    token_type: 'bearer',
    user: mockUser
  }
}