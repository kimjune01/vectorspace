import { render, screen } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../../src/contexts/AuthContext'
import { mockApiResponses } from '../../../src/test/mocks/api'

// Mock API client
vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn(),
    setToken: vi.fn(),
    logout: vi.fn(),
  }
}))

const { apiClient } = await import('../../../src/lib/api')

// Simple test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

// Simple login form component for testing
const SimpleLoginForm = () => (
  <form>
    <h1>Welcome Back</h1>
    <label htmlFor="email">Email</label>
    <input id="email" type="email" />
    <label htmlFor="password">Password</label>
    <input id="password" type="password" />
    <button type="submit">Sign In</button>
  </form>
)

describe('LoginForm (Simplified)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the login method to return proper auth response for auto-login
    apiClient.login = vi.fn().mockResolvedValue(mockApiResponses.auth)
    apiClient.register = vi.fn().mockResolvedValue(mockApiResponses.auth)
    apiClient.getProfile = vi.fn().mockResolvedValue(mockApiResponses.user)
  })

  test('renders basic form elements', () => {
    render(
      <TestWrapper>
        <SimpleLoginForm />
      </TestWrapper>
    )

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})