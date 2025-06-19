import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext'
import { mockApiResponses, mockUser } from '../../src/test/mocks/api'

// Mock the API client
vi.mock('../../src/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  }
}))

const { apiClient } = await import('../../src/lib/api')

// Test component to use the auth hook
const TestComponent = () => {
  const { user, login, logout, register, isLoading } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <button 
        onClick={() => login('test@example.com', 'password')}
        data-testid="login-btn"
      >
        Login
      </button>
      <button 
        onClick={() => register('newuser', 'new@example.com', 'password')}
        data-testid="register-btn"
      >
        Register
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('provides initial state with no user', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
  })

  test('restores user from localStorage on mount', async () => {
    localStorage.setItem('token', 'mock-token')
    localStorage.setItem('user', JSON.stringify(mockUser))
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    })
  })

  test('handles successful login', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockResolvedValueOnce(mockApiResponses.auth)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    fireEvent.click(screen.getByTestId('login-btn'))

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password'
    })
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mock-token')
    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser))
  })

  test('handles login failure', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockRejectedValueOnce(new Error('Invalid credentials'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    fireEvent.click(screen.getByTestId('login-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    expect(consoleSpy).toHaveBeenCalledWith('Login failed:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  test('handles successful registration', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockResolvedValueOnce(mockApiResponses.auth)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    fireEvent.click(screen.getByTestId('register-btn'))

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password'
    })
  })

  test('handles registration failure', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockRejectedValueOnce(new Error('Email already exists'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    fireEvent.click(screen.getByTestId('register-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    expect(consoleSpy).toHaveBeenCalledWith('Registration failed:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  test('handles logout', async () => {
    // Start with logged in user
    localStorage.setItem('token', 'mock-token')
    localStorage.setItem('user', JSON.stringify(mockUser))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for user to be restored
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    })

    // Logout
    fireEvent.click(screen.getByTestId('logout-btn'))

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('user')
  })

  test('throws error when useAuth is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')
    
    consoleSpy.mockRestore()
  })

  test('handles malformed user data in localStorage', () => {
    localStorage.setItem('token', 'mock-token')
    localStorage.setItem('user', 'invalid-json')

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('user')
    
    consoleSpy.mockRestore()
  })
})