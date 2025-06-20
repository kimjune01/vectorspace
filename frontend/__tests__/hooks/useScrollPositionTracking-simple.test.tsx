import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScrollPositionTracking } from '@/hooks/useScrollPositionTracking';

// Create a proper WebSocket mock
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  send = vi.fn();
  close = vi.fn();
  
  constructor(url: string) {
    this.url = url;
    // Start as connecting, then immediately open for testing
    this.readyState = WebSocket.CONNECTING;
    // Use queueMicrotask instead of setTimeout to work better with fake timers
    queueMicrotask(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    });
  }
}

// Mock the global WebSocket
const originalWebSocket = global.WebSocket;
let mockWebSocketInstance: MockWebSocket;

// Stable options to prevent useEffect dependency issues
const stableOptions = { debounceMs: 100, reconnectDelay: 3000 };

describe('useScrollPositionTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock localStorage.getItem to return our test token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue('test-token'),
        setItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
    
    // Mock WebSocket constructor
    global.WebSocket = vi.fn().mockImplementation((url: string) => {
      mockWebSocketInstance = new MockWebSocket(url);
      return mockWebSocketInstance;
    }) as any;
  });
  
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });
  
  it('should create WebSocket connection and handle scroll', async () => {
    const { result } = renderHook(() => 
      useScrollPositionTracking(123, true, stableOptions)
    );
    
    // Wait for microtasks to complete (WebSocket connection)
    await act(async () => {
      await Promise.resolve(); // Wait for queueMicrotask
    });
    
    // Verify WebSocket was created with correct URL
    expect(global.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:8000/api/ws/conversations/123?token=test-token'
    );
    
    // Check connection state
    expect(result.current.isConnected).toBe(true);
    
    // Test scroll functionality
    act(() => {
      result.current.handleScroll({
        scrollTop: 500,
        scrollHeight: 2000,
        clientHeight: 800
      });
    });
    
    // Fast-forward past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    
    // Verify message was sent
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
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
  }, 10000);
});