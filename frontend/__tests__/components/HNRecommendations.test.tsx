import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { HNRecommendations } from '../../src/components/HNRecommendations'
import { HNRecommendation } from '../../src/types/corpus'

// Mock window.open
const mockWindowOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true
})

const mockRecommendations: HNRecommendation[] = [
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

describe('HNRecommendations Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing when no recommendations', () => {
    const { container } = render(
      <HNRecommendations 
        recommendations={[]} 
        isLoading={false} 
        error={null} 
      />
    )
    expect(container.firstChild).toBeNull()
  })

  test('shows loading state during fetch', () => {
    render(
      <HNRecommendations 
        recommendations={[]} 
        isLoading={true} 
        error={null} 
      />
    )
    
    expect(screen.getByText('From Hacker News')).toBeInTheDocument()
    expect(screen.getAllByTestId('recommendation-skeleton')).toHaveLength(3)
  })

  test('displays recommendations correctly', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    expect(screen.getByText('From Hacker News')).toBeInTheDocument()
    expect(screen.getByText('Machine Learning in Production')).toBeInTheDocument()
    expect(screen.getByText('Neural Networks for Beginners')).toBeInTheDocument()
    expect(screen.getByText('AI Safety Research Updates')).toBeInTheDocument()
  })

  test('displays maximum 5 recommendations', () => {
    const manyRecommendations = Array.from({ length: 10 }, (_, i) => ({
      title: `Article ${i + 1}`,
      url: `https://news.ycombinator.com/item?id=${12345 + i}`,
      score: 0.8 - (i * 0.05),
      timestamp: "2024-01-15T10:30:00Z"
    }))
    
    render(
      <HNRecommendations 
        recommendations={manyRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const recommendations = screen.getAllByTestId('hn-recommendation')
    expect(recommendations).toHaveLength(5)
  })

  test('opens HN links in new tab on click', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const firstRecommendation = screen.getByText('Machine Learning in Production')
    fireEvent.click(firstRecommendation)
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://news.ycombinator.com/item?id=12345',
      '_blank',
      'noopener,noreferrer'
    )
  })

  test('handles click events for all recommendations', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    // Click each recommendation
    fireEvent.click(screen.getByText('Machine Learning in Production'))
    fireEvent.click(screen.getByText('Neural Networks for Beginners'))
    fireEvent.click(screen.getByText('AI Safety Research Updates'))
    
    expect(mockWindowOpen).toHaveBeenCalledTimes(3)
    expect(mockWindowOpen).toHaveBeenNthCalledWith(1, 
      'https://news.ycombinator.com/item?id=12345', '_blank', 'noopener,noreferrer')
    expect(mockWindowOpen).toHaveBeenNthCalledWith(2,
      'https://news.ycombinator.com/item?id=12346', '_blank', 'noopener,noreferrer')
    expect(mockWindowOpen).toHaveBeenNthCalledWith(3,
      'https://news.ycombinator.com/item?id=12347', '_blank', 'noopener,noreferrer')
  })

  test('applies correct styling classes', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const recommendations = screen.getAllByTestId('hn-recommendation')
    recommendations.forEach(rec => {
      expect(rec).toHaveClass('cursor-pointer')
      expect(rec).toHaveClass('transition-colors')
    })
  })

  test('shows proper accessibility attributes', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const recommendations = screen.getAllByTestId('hn-recommendation')
    recommendations.forEach(rec => {
      expect(rec).toHaveAttribute('role', 'button')
      expect(rec).toHaveAttribute('tabIndex', '0')
    })
  })

  test('handles keyboard navigation', () => {
    render(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const firstRecommendation = screen.getByText('Machine Learning in Production')
    
    // Test Enter key
    fireEvent.keyDown(firstRecommendation, { key: 'Enter', code: 'Enter' })
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://news.ycombinator.com/item?id=12345',
      '_blank',
      'noopener,noreferrer'
    )
    
    // Test Space key
    fireEvent.keyDown(firstRecommendation, { key: ' ', code: 'Space' })
    expect(mockWindowOpen).toHaveBeenCalledTimes(2)
  })

  test('handles error state gracefully', () => {
    const { container } = render(
      <HNRecommendations 
        recommendations={[]} 
        isLoading={false} 
        error={new Error('Network error')} 
      />
    )
    
    // Should not render anything on error
    expect(container.firstChild).toBeNull()
  })

  test('transitions properly when data changes', () => {
    const { rerender } = render(
      <HNRecommendations 
        recommendations={[]} 
        isLoading={true} 
        error={null} 
      />
    )
    
    // Should show loading state
    expect(screen.getAllByTestId('recommendation-skeleton')).toHaveLength(3)
    
    // Update with data
    rerender(
      <HNRecommendations 
        recommendations={mockRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    // Should show actual recommendations
    expect(screen.getByText('Machine Learning in Production')).toBeInTheDocument()
    expect(screen.queryByTestId('recommendation-skeleton')).not.toBeInTheDocument()
  })

  test('truncates long titles appropriately', () => {
    const longTitleRecommendations: HNRecommendation[] = [
      {
        title: "This is a very long title that should be truncated because it exceeds the maximum character limit we want to display in the recommendation badges",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 0.85,
        timestamp: "2024-01-15T10:30:00Z"
      }
    ]
    
    render(
      <HNRecommendations 
        recommendations={longTitleRecommendations} 
        isLoading={false} 
        error={null} 
      />
    )
    
    const recommendation = screen.getByTestId('hn-recommendation')
    expect(recommendation).toHaveClass('truncate')
  })
})