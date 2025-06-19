import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EnhancedSidebar from '@/components/layout/EnhancedSidebar';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
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

describe('EnhancedSidebar', () => {
  const mockProps = {
    onSessionSelect: vi.fn(),
    onNewChat: vi.fn(),
    currentSessionId: null,
    onSearchResultSelect: vi.fn(),
  };

  describe('Two-Tab Interface', () => {
    it('should show Neighboring Chats and My Chats tabs', () => {
      render(<EnhancedSidebar {...mockProps} />);
      
      expect(screen.getByRole('tab', { name: /neighboring chats/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /my chats/i })).toBeInTheDocument();
    });

    it('should default to Neighboring Chats tab', () => {
      render(<EnhancedSidebar {...mockProps} />);
      
      const neighboringTab = screen.getByRole('tab', { name: /neighboring chats/i });
      expect(neighboringTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch between tabs correctly', async () => {
      const user = userEvent.setup();
      render(<EnhancedSidebar {...mockProps} />);
      
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
    it('should show neighboring chats content by default', () => {
      render(<EnhancedSidebar {...mockProps} />);
      
      expect(screen.getByText(/similar conversations will appear here/i)).toBeInTheDocument();
    });

    it('should show my chats content when My Chats tab is selected', async () => {
      const user = userEvent.setup();
      render(<EnhancedSidebar {...mockProps} />);
      
      const myChatsTab = screen.getByRole('tab', { name: /my chats/i });
      await user.click(myChatsTab);
      
      // Wait for the tab content to be visible
      await waitFor(() => {
        expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
      });
    });
  });
});