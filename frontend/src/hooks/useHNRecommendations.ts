import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { HNRecommendation } from '../types/corpus'

/**
 * Hook to fetch Hacker News recommendations for a conversation.
 * Only fetches if the conversation has a summary.
 */
export function useHNRecommendations(
  conversationId: number | null,
  hasSummary: boolean
) {
  return useQuery<HNRecommendation[], Error>({
    queryKey: ['hn-recommendations', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return []
      }
      
      const response = await apiClient.request<HNRecommendation[]>(`/conversations/${conversationId}/hn-recommendations`)
      return response || []
    },
    enabled: !!conversationId && hasSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in older versions)
    retry: false, // Don't retry on errors to avoid spamming logs
    initialData: undefined // Remove initialData to allow proper loading states
  })
}