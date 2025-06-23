import React from 'react'
import { Badge } from './ui/badge'
import { Skeleton } from './ui/skeleton'
import { HNRecommendation } from '../types/corpus'
import { cn } from '@/lib/utils'

interface HNRecommendationsProps {
  recommendations: HNRecommendation[]
  isLoading: boolean
  error: Error | null
}

export function HNRecommendations({ 
  recommendations, 
  isLoading, 
  error 
}: HNRecommendationsProps) {
  // Don't render anything if there's an error or no data to show
  if (error || (!isLoading && recommendations.length === 0)) {
    return null
  }

  const handleRecommendationClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleKeyDown = (event: React.KeyboardEvent, url: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRecommendationClick(url)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        From Hacker News
      </h3>
      
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={`skeleton-${index}`}
              data-testid="recommendation-skeleton"
              className="h-6 w-24 rounded-full"
            />
          ))
        ) : (
          // Actual recommendations (limit to 5)
          recommendations.slice(0, 5).map((rec, index) => (
            <Badge
              key={`${rec.url}-${index}`}
              data-testid="hn-recommendation"
              variant="secondary"
              role="button"
              tabIndex={0}
              className={cn(
                "cursor-pointer transition-colors hover:bg-secondary/80 active:bg-secondary/90",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "max-w-[200px] truncate"
              )}
              onClick={() => handleRecommendationClick(rec.url)}
              onKeyDown={(e) => handleKeyDown(e, rec.url)}
              title={rec.title} // Show full title on hover
            >
              {rec.title}
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}