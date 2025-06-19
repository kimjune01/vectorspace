import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { ThemeProvider, useTheme } from '../../src/components/theme-provider'

// Test component to use the theme hook
const TestComponent = () => {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        Set System
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset document classes
    document.documentElement.className = ''
  })

  test('provides default theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')
  })

  test('uses custom default theme', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
  })

  test('reads theme from localStorage', () => {
    const mockGetItem = vi.fn().mockReturnValue('light')
    Object.defineProperty(window, 'localStorage', {
      value: { ...localStorage, getItem: mockGetItem },
      writable: true,
    })
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
  })

  test('uses custom storage key', () => {
    const mockGetItem = vi.fn().mockReturnValue('dark')
    Object.defineProperty(window, 'localStorage', {
      value: { ...localStorage, getItem: mockGetItem },
      writable: true,
    })
    
    render(
      <ThemeProvider storageKey="custom-theme-key">
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
  })

  test('changes theme and updates localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByTestId('set-dark'))
    
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(localStorage.setItem).toHaveBeenCalledWith('vectorspace-theme', 'dark')
  })

  test('applies theme class to document element', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveClass('dark')
    
    fireEvent.click(screen.getByTestId('set-light'))
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  test('handles system theme with dark preference', () => {
    // Mock dark system preference
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider defaultTheme="system">
        <TestComponent />
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveClass('dark')
  })

  test('handles system theme with light preference', () => {
    // Mock light system preference
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query !== '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider defaultTheme="system">
        <TestComponent />
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveClass('light')
  })

  test('throws error when useTheme is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within a ThemeProvider')
    
    consoleSpy.mockRestore()
  })
})