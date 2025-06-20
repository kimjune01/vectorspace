import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext'
import { mockApiResponses, mockUser } from '../../src/test/mocks/api'

// Mock the API client
vi.mock('../../src/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setToken: vi.fn(),
    getProfile: vi.fn(),
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
        onClick={() => register('newuser', 'New User', 'new@example.com', 'password')}
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
    
    // Create a proper localStorage mock that actually stores values
    const storage: Record<string, string> = {}
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
      removeItem: vi.fn((key: string) => { delete storage[key] }),
      clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]) }),
    }
    
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
  })

  test('provides initial state with no user', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
  })

  test('restores user from localStorage on mount', async () => {
    // Set up mocks before localStorage
    const mockApiClient = apiClient as any
    mockApiClient.setToken.mockClear()
    mockApiClient.getProfile.mockResolvedValue(mockUser)
    
    // Set localStorage after mocks are ready
    localStorage.setItem('auth_token', 'mock-token')
    
    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
    })

    // Wait for the async initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    }, { timeout: 3000 })
    
    expect(mockApiClient.setToken).toHaveBeenCalledWith('mock-token')
    expect(mockApiClient.getProfile).toHaveBeenCalled()
  })

  test('handles successful login', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.login.mockResolvedValueOnce(mockApiResponses.auth)

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

    expect(mockApiClient.login).toHaveBeenCalledWith('test@example.com', 'password')
  })

  test('handles login failure', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.login.mockRejectedValueOnce(new Error('Invalid credentials'))

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

    // The error is thrown and handled by the calling component, not logged in context
    expect(mockApiClient.login).toHaveBeenCalledWith('test@example.com', 'password')
  })

  test('handles successful registration', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.register.mockResolvedValueOnce(mockApiResponses.auth)

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

    expect(mockApiClient.register).toHaveBeenCalledWith('newuser', 'New User', 'new@example.com', 'password', undefined)
  })

  test('handles registration failure', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.register.mockRejectedValueOnce(new Error('Email already exists'))

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

    // The error is thrown and handled by the calling component, not logged in context
    expect(mockApiClient.register).toHaveBeenCalledWith('newuser', 'New User', 'new@example.com', 'password', undefined)
  })

  test('handles logout', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.setToken.mockClear()
    mockApiClient.getProfile.mockResolvedValue(mockUser)
    mockApiClient.logout.mockResolvedValueOnce({})

    // Start with logged in user
    localStorage.setItem('auth_token', 'mock-token')

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
    })

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    // Wait for user to be restored
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    }, { timeout: 3000 })

    // Logout
    fireEvent.click(screen.getByTestId('logout-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })
    
    expect(mockApiClient.logout).toHaveBeenCalled()
  })

  test('throws error when useAuth is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')
    
    consoleSpy.mockRestore()
  })

  test('handles malformed user data in localStorage', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.setToken = vi.fn()
    mockApiClient.getProfile = vi.fn().mockRejectedValue(new Error('Invalid token'))

    localStorage.setItem('auth_token', 'invalid-token')

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Should fail to load user and fall back to no-user state
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })
  })
})