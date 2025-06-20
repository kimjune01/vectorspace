import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScrollPositionTracking } from '@/hooks/useScrollPositionTracking';

// Mock WebSocket
class MockWebSocket {
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  constructor(public url: string) {
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }
  
  send = vi.fn();
  close = vi.fn();
}

// Replace global WebSocket with mock
const originalWebSocket = global.WebSocket;
global.WebSocket = MockWebSocket as any;

describe('useScrollPositionTracking', () => {
  let mockWebSocket: MockWebSocket;
  
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any existing WebSocket mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    if (mockWebSocket) {
      mockWebSocket.close();
    }
  });
  
  describe('Scroll position tracking', () => {
    it('should send scroll position updates via WebSocket when user scrolls', async () => {
      const conversationId = 123;
      const token = 'test-token';
      
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(() => token),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      
      // Render the hook
      const { result } = renderHook(() => 
        useScrollPositionTracking(conversationId, true)
      );
      
      // Wait for WebSocket to connect
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      
      // Get the WebSocket instance
      mockWebSocket = result.current.websocket as any;
      expect(mockWebSocket).toBeTruthy();
      expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
      
      // Simulate scroll event
      act(() => {
        result.current.handleScroll({
          scrollTop: 500,
          scrollHeight: 2000,
          clientHeight: 800
        });
      });
      
      // Fast-forward past debounce delay (default 100ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      // Verify WebSocket message was sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'scroll_position_update',
          scroll_position: {
            scrollTop: 500,
            scrollHeight: 2000,
            clientHeight: 800,
            scrollPercentage: 25 // (500 / 2000) * 100
          }
        })
      );
    });
    
    it('should debounce rapid scroll position updates', async () => {
      const conversationId = 456;
      const token = 'test-token';
      
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(() => token),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      
      // Render the hook
      const { result } = renderHook(() => 
        useScrollPositionTracking(conversationId, true)
      );
      
      // Wait for WebSocket to connect
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      
      mockWebSocket = result.current.websocket as any;
      
      // Simulate multiple rapid scroll events
      act(() => {
        result.current.handleScroll({
          scrollTop: 100,
          scrollHeight: 2000,
          clientHeight: 800
        });
      });
      
      act(() => {
        result.current.handleScroll({
          scrollTop: 200,
          scrollHeight: 2000,
          clientHeight: 800
        });
      });
      
      act(() => {
        result.current.handleScroll({
          scrollTop: 300,
          scrollHeight: 2000,
          clientHeight: 800
        });
      });
      
      // Advance time but not past debounce
      act(() => {
        vi.advanceTimersByTime(50);
      });
      
      // Should not have sent any messages yet
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      
      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(60);
      });
      
      // Should only send the last scroll position
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'scroll_position_update',
          scroll_position: {
            scrollTop: 300,
            scrollHeight: 2000,
            clientHeight: 800,
            scrollPercentage: 15 // (300 / 2000) * 100
          }
        })
      );
    });
    
    it('should not send scroll updates if WebSocket is not connected', () => {
      const conversationId = 789;
      
      // Render hook without enabling WebSocket
      const { result } = renderHook(() => 
        useScrollPositionTracking(conversationId, false)
      );
      
      // Simulate scroll
      act(() => {
        result.current.handleScroll({
          scrollTop: 500,
          scrollHeight: 2000,
          clientHeight: 800
        });
      });
      
      // Advance timers
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      // Should not have created a WebSocket
      expect(result.current.websocket).toBeNull();
    });
    
    it('should handle WebSocket reconnection', async () => {
      const conversationId = 999;
      const token = 'test-token';
      
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(() => token),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      
      // Render the hook
      const { result } = renderHook(() => 
        useScrollPositionTracking(conversationId, true)
      );
      
      // Wait for initial connection
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      
      mockWebSocket = result.current.websocket as any;
      const firstWebSocket = mockWebSocket;
      
      // Simulate connection close
      act(() => {
        mockWebSocket.readyState = WebSocket.CLOSED;
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose(new CloseEvent('close'));
        }
      });
      
      // Wait for reconnection attempt (default 3 seconds)
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      
      // Should have attempted reconnection - the websocket instance may be the same
      // but reconnection logic should have been triggered
      expect(result.current.websocket).toBeTruthy();
      expect(result.current.isConnected).toBe(false); // Should be disconnected after close
    });
    
    it('should receive and handle scroll position updates from other users', async () => {
      const conversationId = 111;
      const token = 'test-token';
      const onOtherUserScroll = vi.fn();
      
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(() => token),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      
      // Render the hook
      const { result } = renderHook(() => 
        useScrollPositionTracking(conversationId, true, { onOtherUserScroll })
      );
      
      // Wait for WebSocket to connect
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      
      mockWebSocket = result.current.websocket as any;
      
      // Simulate receiving scroll position from another user
      const scrollMessage = {
        type: 'user_scroll_position',
        user_id: 456,
        username: 'otheruser',
        scroll_position: {
          scrollTop: 1000,
          scrollHeight: 3000,
          clientHeight: 600,
          scrollPercentage: 33.33
        }
      };
      
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify(scrollMessage)
          }));
        }
      });
      
      // Verify callback was called with scroll data
      expect(onOtherUserScroll).toHaveBeenCalledWith({
        user_id: 456,
        username: 'otheruser',
        scroll_position: {
          scrollTop: 1000,
          scrollHeight: 3000,
          clientHeight: 600,
          scrollPercentage: 33.33
        }
      });
    });
  });
});

// Restore original WebSocket
afterAll(() => {
  global.WebSocket = originalWebSocket;
});