import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScrollPositionTracking } from '@/hooks/useScrollPositionTracking';

// Mock WebSocket
const mockSend = vi.fn();
const mockClose = vi.fn();
let mockWebSocketInstance: any;

global.WebSocket = vi.fn().mockImplementation((url: string) => {
  mockWebSocketInstance = {
    url,
    send: mockSend,
    close: mockClose,
    readyState: 1, // WebSocket.OPEN
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };
  return mockWebSocketInstance;
}) as any;

describe('useScrollPositionTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });
  
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
  
  it('should send scroll position updates via WebSocket when user scrolls', async () => {
    const { result } = renderHook(() => 
      useScrollPositionTracking(123, true)
    );
    
    // Wait for WebSocket to be created
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Verify WebSocket was created
    expect(global.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:8000/api/ws/conversations/123?token=test-token'
    );
    
    // Simulate WebSocket open
    act(() => {
      if (mockWebSocketInstance && mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen();
      }
    });
    
    // Simulate scroll
    act(() => {
      result.current.handleScroll({
        scrollTop: 500,
        scrollHeight: 2000,
        clientHeight: 800
      });
    });
    
    // Fast-forward past debounce delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Verify message was sent
    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'scroll_position_update',
        scroll_position: {
          scrollTop: 500,
          scrollHeight: 2000,
          clientHeight: 800,
          scrollPercentage: 25
        }
      })
    );
  });
});