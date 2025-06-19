import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '../../../src/components/ui/card'

describe('Card Components', () => {
  test('Card renders with correct classes', () => {
    render(<Card data-testid="card">Card content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm')
  })

  test('CardHeader renders correctly', () => {
    render(<CardHeader data-testid="header">Header content</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
    expect(header).toHaveTextContent('Header content')
  })

  test('CardTitle renders correctly', () => {
    render(<CardTitle data-testid="title">Card Title</CardTitle>)
    const title = screen.getByTestId('title')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight')
    expect(title).toHaveTextContent('Card Title')
  })

  test('CardDescription renders correctly', () => {
    render(<CardDescription data-testid="description">Card description</CardDescription>)
    const description = screen.getByTestId('description')
    expect(description).toBeInTheDocument()
    expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    expect(description).toHaveTextContent('Card description')
  })

  test('CardContent renders correctly', () => {
    render(<CardContent data-testid="content">Card content</CardContent>)
    const content = screen.getByTestId('content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass('p-6', 'pt-0')
    expect(content).toHaveTextContent('Card content')
  })

  test('CardFooter renders correctly', () => {
    render(<CardFooter data-testid="footer">Footer content</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    expect(footer).toHaveTextContent('Footer content')
  })

  test('complete card structure renders correctly', () => {
    render(
      <Card data-testid="complete-card">
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Test content goes here</p>
        </CardContent>
        <CardFooter>
          <p>Footer content</p>
        </CardFooter>
      </Card>
    )

    expect(screen.getByTestId('complete-card')).toBeInTheDocument()
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByText('Test content goes here')).toBeInTheDocument()
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  test('components accept custom className', () => {
    render(
      <Card className="custom-card" data-testid="custom-card">
        <CardHeader className="custom-header" data-testid="custom-header">
          <CardTitle className="custom-title" data-testid="custom-title">Title</CardTitle>
        </CardHeader>
      </Card>
    )

    expect(screen.getByTestId('custom-card')).toHaveClass('custom-card')
    expect(screen.getByTestId('custom-header')).toHaveClass('custom-header')
    expect(screen.getByTestId('custom-title')).toHaveClass('custom-title')
  })
})