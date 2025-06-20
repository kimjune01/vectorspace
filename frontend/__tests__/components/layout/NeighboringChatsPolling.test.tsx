import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NeighboringChatsPanel from '@/components/layout/NeighboringChatsPanel';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NeighboringChatsPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockProps = {
    conversationId: 123,
    onConversationSelect: vi.fn(),
  };

  describe('Polling with 15-second throttle', () => {
    it('should poll for neighboring chats every 15 seconds', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          conversations: [
            {
              id: 456,
              title: 'Similar conversation',
              summary: 'Test summary',
              similarity_score: 0.8,
              author: { username: 'testuser' }
            }
          ]
        })
      });

      render(<NeighboringChatsPanel {...mockProps} />);

      // Wait for initial fetch using fake timers
      await act(async () => {
        vi.advanceTimersByTime(100); // Allow initial effect to run
        await vi.runAllTimersAsync(); // Run any pending timers
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fast-forward 14 seconds - should not poll yet
      act(() => {
        vi.advanceTimersByTime(14000);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fast-forward to 15 seconds - should poll now
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Fast-forward another 15 seconds - should poll again
      await act(async () => {
        vi.advanceTimersByTime(15000);
        await vi.runAllTimersAsync();
      });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should stop polling when conversation ID changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversations: [] })
      });

      const { rerender } = render(<NeighboringChatsPanel {...mockProps} />);

      // Wait for initial fetch
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Change conversation ID
      await act(async () => {
        rerender(<NeighboringChatsPanel {...mockProps} conversationId={999} />);
      });

      // Should fetch for new conversation
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/999/similar?limit=20',
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );

      // Fast-forward 15 seconds
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });

      // Should only poll for the new conversation (999), not the old one (123)
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toContain('/api/conversations/999/similar');
    });

    it('should stop polling when component unmounts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversations: [] })
      });

      const { unmount } = render(<NeighboringChatsPanel {...mockProps} />);

      // Wait for initial fetch
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Unmount component
      unmount();

      // Fast-forward 15 seconds - should not poll anymore
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial fetch
    });

    it('should handle API errors gracefully and continue polling', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ conversations: [] })
        });

      render(<NeighboringChatsPanel {...mockProps} />);

      // Wait for initial fetch to complete
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fast-forward 15 seconds - should retry
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should display newly found neighboring conversations after polling', async () => {
      // Initially no conversations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversations: [] })
      });

      render(<NeighboringChatsPanel {...mockProps} />);

      // Wait for initial load to complete
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      // Check initial state
      expect(screen.getByText(/no similar conversations found/i)).toBeInTheDocument();

      // Mock new similar conversation appearing after 15 seconds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          conversations: [
            {
              id: 789,
              title: 'Newly similar conversation',
              summary: 'This became similar after summary update',
              similarity_score: 0.9,
              author: { username: 'anotheruser' }
            }
          ]
        })
      });

      // Fast-forward 15 seconds to trigger polling
      await act(async () => {
        vi.advanceTimersByTime(15000);
        await vi.runAllTimersAsync();
      });

      // Should display the new conversation
      expect(screen.getByText('Newly similar conversation')).toBeInTheDocument();
    });
  });
});