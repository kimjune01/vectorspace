import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import LoginForm from '../../../src/components/auth/LoginForm'
import { AuthProvider } from '../../../src/contexts/AuthContext'
import { mockApiResponses } from '../../../src/test/mocks/api'

// Mock the API client
vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
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
  })

  test('renders login form correctly', () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  test('validates required fields', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  test('validates email format', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
    })
  })

  test('validates password length', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(passwordInput, { target: { value: '123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
    })
  })

  test('submits form with valid data', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockResolvedValueOnce(mockApiResponses.auth)

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(screen.getByText(/signing in/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      })
    })
  })

  test('handles login error', async () => {
    const mockApiClient = apiClient as any
    mockApiClient.post.mockRejectedValueOnce(new Error('Invalid credentials'))

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  test('toggles password visibility', () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const passwordInput = screen.getByLabelText(/password/i)
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })

    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('disables form during submission', async () => {
    const mockApiClient = apiClient as any
    // Mock a slow response
    mockApiClient.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(emailInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
  })

  test('has accessible form labels and structure', () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    )

    const form = screen.getByRole('form')
    expect(form).toBeInTheDocument()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
  })
})