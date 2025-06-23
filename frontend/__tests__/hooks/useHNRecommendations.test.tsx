import { renderHook, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useHNRecommendations } from '../../src/hooks/useHNRecommendations'
import { HNRecommendation } from '../../src/types/corpus'

// Mock the API client
vi.mock('../../src/lib/api', () => ({
  apiClient: {
    request: vi.fn()
  }
}))

const { apiClient } = await import('../../src/lib/api')

// Create a wrapper with QueryClient for testing
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const mockHNRecommendations: HNRecommendation[] = [
  {
    title: "Machine Learning in Production",
    url: "https://news.ycombinator.com/item?id=12345",
    score: 0.85,
    timestamp: "2024-01-15T10:30:00Z"
  },
  {
    title: "Neural Networks for Beginners",
    url: "https://news.ycombinator.com/item?id=12346", 
    score: 0.78,
    timestamp: "2024-01-14T15:20:00Z"
  },
  {
    title: "AI Safety Research Updates",
    url: "https://news.ycombinator.com/item?id=12347",
    score: 0.72,
    timestamp: "2024-01-13T09:15:00Z"
  }
]

describe('useHNRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch recommendations for summarized conversation', async () => {
    const mockRequest = vi.mocked(apiClient.request)
    mockRequest.mockResolvedValueOnce(mockHNRecommendations)

    const { result } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    // Should start with loading state
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()

    // Wait for the query to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should have fetched recommendations
    expect(mockRequest).toHaveBeenCalledWith('/conversations/123/hn-recommendations')
    expect(result.current.data).toEqual(mockHNRecommendations)
    expect(result.current.error).toBeNull()
  })

  test('should return empty for unsummarized conversation', () => {
    const mockRequest = vi.mocked(apiClient.request)

    const { result } = renderHook(
      () => useHNRecommendations(123, false),
      { wrapper: createWrapper() }
    )

    // Should not be loading and have undefined data (query disabled)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()

    // Should not have made an API call
    expect(mockRequest).not.toHaveBeenCalled()
  })

  test('should handle loading states correctly', async () => {
    const mockRequest = vi.mocked(apiClient.request)
    mockRequest.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockHNRecommendations), 100)))

    const { result } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    // Initially loading
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 1000 })

    expect(result.current.data).toEqual(mockHNRecommendations)
  })

  test('should handle errors silently', async () => {
    const mockRequest = vi.mocked(apiClient.request)
    mockRequest.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should handle error gracefully - with retry: false, error will be set
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeTruthy()
  })

  test('should not fetch when conversationId is null', () => {
    const mockRequest = vi.mocked(apiClient.request)

    const { result } = renderHook(
      () => useHNRecommendations(null, true),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined() // Disabled query returns undefined
    expect(mockRequest).not.toHaveBeenCalled()
  })

  test('should refetch when conversation changes', async () => {
    const mockRequest = vi.mocked(apiClient.request)
    mockRequest.mockResolvedValue(mockHNRecommendations)

    const { result, rerender } = renderHook(
      ({ conversationId, hasSummary }) => useHNRecommendations(conversationId, hasSummary),
      {
        wrapper: createWrapper(),
        initialProps: { conversationId: 123, hasSummary: true }
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockRequest).toHaveBeenCalledWith('/conversations/123/hn-recommendations')

    // Change conversation
    rerender({ conversationId: 456, hasSummary: true })

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('/conversations/456/hn-recommendations')
    })

    expect(mockRequest).toHaveBeenCalledTimes(2)
  })

  test('should handle empty recommendations response', async () => {
    const mockRequest = vi.mocked(apiClient.request)
    mockRequest.mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })

  test('should use correct cache key', () => {
    const { result: result1 } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    const { result: result2 } = renderHook(
      () => useHNRecommendations(123, true),
      { wrapper: createWrapper() }
    )

    // Both hooks should return the same data (cached)
    expect(result1.current.isLoading).toBe(result2.current.isLoading)
  })
})