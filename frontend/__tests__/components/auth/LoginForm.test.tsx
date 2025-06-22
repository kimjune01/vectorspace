import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { LoginForm } from '../../../src/components/auth/LoginForm'
import { AuthProvider, AuthContext } from '../../../src/contexts/AuthContext'
import { mockApiResponses } from '../../../src/test/mocks/api'

// Mock the API client
vi.mock('../../../src/lib/api', () => ({
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

const { apiClient } = await import('../../../src/lib/api')

// Wrapper component for providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the login method to return proper auth response for auto-login
    apiClient.login = vi.fn().mockResolvedValue(mockApiResponses.auth)
    apiClient.register = vi.fn().mockResolvedValue(mockApiResponses.auth)
    apiClient.getProfile = vi.fn().mockResolvedValue(mockApiResponses.user)
  })

  test('renders login form correctly', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  test('validates required fields', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    // HTML5 validation prevents form submission with empty required fields
    expect(usernameInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })

  test('accepts username input', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    const usernameInput = screen.getByLabelText(/username/i)
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })

    expect(usernameInput).toHaveValue('testuser')
  })

  test('accepts password input', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    const passwordInput = screen.getByLabelText(/password/i)
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })

    expect(passwordInput).toHaveValue('testpass')
  })

  test('submits form with valid data', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.login.mockResolvedValueOnce(mockApiResponses.auth)

    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(screen.getByText(/signing in/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockApiClient.login).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  test('handles login error', async () => {
    // Mock the AuthContext login function to throw an error
    const mockLogin = vi.fn().mockRejectedValueOnce(new Error('Invalid credentials'))
    
    // Create a custom test wrapper with mocked auth context
    const TestWrapperWithMockAuth = ({ children }: { children: React.ReactNode }) => {
      const mockAuthValue = {
        user: null,
        isLoading: false,
        login: mockLogin,
        register: vi.fn(),
        logout: vi.fn(),
        refreshProfile: vi.fn(),
      }
      return (
        <BrowserRouter>
          <AuthContext.Provider value={mockAuthValue}>
            {children}
          </AuthContext.Provider>
        </BrowserRouter>
      )
    }

    await act(async () => {
      render(
        <TestWrapperWithMockAuth>
          <LoginForm />
        </TestWrapperWithMockAuth>
      )
    })

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
    
    expect(mockLogin).toHaveBeenCalledWith('testuser', 'wrongpassword')
  })

  // Password visibility toggle feature not implemented in LoginForm component
  // test('toggles password visibility', () => { ... })

  test('disables submit button during submission', async () => {
    const mockApiClient = apiClient as any
    // Mock a slow response
    mockApiClient.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Only the submit button is disabled, not the input fields
    expect(submitButton).toBeDisabled()
    expect(usernameInput).not.toBeDisabled()
    expect(passwordInput).not.toBeDisabled()
  })

  test('has accessible form labels and structure', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )
    })

    // Check form elements exist and are properly labeled
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)

    expect(usernameInput).toHaveAttribute('type', 'text')
    expect(usernameInput).toHaveAttribute('id', 'username')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('id', 'password')
    
    // Check that form submission works
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).toHaveAttribute('type', 'submit')
  })
})