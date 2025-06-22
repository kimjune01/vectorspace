import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import EnhancedSidebar from '@/components/layout/EnhancedSidebar';
import { AuthProvider } from '@/contexts/AuthContext';
import { mockApiResponses } from '@/test/mocks/api';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setToken: vi.fn(),
    getProfile: vi.fn(),
    discoverConversations: vi.fn(),
    getConversations: vi.fn(),
    searchConversations: vi.fn(),
  }
}));

// Mock the ChatSidebar component to avoid API calls
vi.mock('@/components/layout/chat-sidebar', () => ({
  default: () => (
    <div data-testid="chat-sidebar">
      <input placeholder="Search messages..." />
      <button>New Chat</button>
    </div>
  ),
}));

const { apiClient } = await import('@/lib/api');

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('EnhancedSidebar', () => {
  const mockProps = {
    onSessionSelect: vi.fn(),
    onNewChat: vi.fn(),
    currentSessionId: null,
    onSearchResultSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the login method to return proper auth response for auto-login
    apiClient.login = vi.fn().mockResolvedValue(mockApiResponses.auth);
    apiClient.register = vi.fn().mockResolvedValue(mockApiResponses.auth);
    apiClient.getProfile = vi.fn().mockResolvedValue(mockApiResponses.user);
    apiClient.discoverConversations = vi.fn().mockResolvedValue({ conversations: [], total: 0 });
    apiClient.getConversations = vi.fn().mockResolvedValue({ conversations: [], total: 0 });
    apiClient.searchConversations = vi.fn().mockResolvedValue({ conversations: [], total: 0 });
  });

  describe('Two-Tab Interface', () => {
    it('should show Neighboring Chats and My Chats tabs', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <EnhancedSidebar {...mockProps} />
          </TestWrapper>
        );
      });
      
      expect(screen.getByRole('tab', { name: /neighboring chats/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /my chats/i })).toBeInTheDocument();
    });

    it('should default to Neighboring Chats tab', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <EnhancedSidebar {...mockProps} />
          </TestWrapper>
        );
      });
      
      const neighboringTab = screen.getByRole('tab', { name: /neighboring chats/i });
      expect(neighboringTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch between tabs correctly', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(
          <TestWrapper>
            <EnhancedSidebar {...mockProps} />
          </TestWrapper>
        );
      });
      
      // Switch to My Chats
      const myChatsTab = screen.getByRole('tab', { name: /my chats/i });
      await user.click(myChatsTab);
      
      await waitFor(() => {
        expect(myChatsTab).toHaveAttribute('aria-selected', 'true');
      });
      
      // Switch back to Neighboring Chats
      const neighboringTab = screen.getByRole('tab', { name: /neighboring chats/i });
      await user.click(neighboringTab);
      
      await waitFor(() => {
        expect(neighboringTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Tab Content', () => {
    it('should show neighboring chats content by default', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <EnhancedSidebar {...mockProps} />
          </TestWrapper>
        );
      });
      
      expect(screen.getByText(/similar conversations will appear here/i)).toBeInTheDocument();
    });

    it('should show my chats content when My Chats tab is selected', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(
          <TestWrapper>
            <EnhancedSidebar {...mockProps} />
          </TestWrapper>
        );
      });
      
      const myChatsTab = screen.getByRole('tab', { name: /my chats/i });
      await user.click(myChatsTab);
      
      // Wait for the tab content to be visible
      await waitFor(() => {
        expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
      });
    });
  });
});