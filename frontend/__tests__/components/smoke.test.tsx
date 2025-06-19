import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import App from '../../src/App'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/card'

describe('Component Smoke Tests', () => {
  test('App renders without crashing', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /vectorspace/i })).toBeInTheDocument()
  })

  test('Button component renders', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  test('Card components render without errors', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
        </CardHeader>
        <CardContent>
          Test Content
        </CardContent>
      </Card>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })
})