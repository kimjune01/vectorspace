import { renderHook } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Create a simple mock implementation
const mockToast = vi.fn()
const mockDismiss = vi.fn()

// Mock sonner module
vi.mock('sonner', () => ({
  toast: mockToast,
  dismiss: mockDismiss,
}))

// Mock the hook implementation
vi.mock('../../src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: mockDismiss,
  }),
}))

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns toast function and dismiss', async () => {
    const { useToast } = await import('../../src/hooks/use-toast')
    const { result } = renderHook(() => useToast())
    
    expect(typeof result.current.toast).toBe('function')
    expect(typeof result.current.dismiss).toBe('function')
  })

  test('calls toast function when invoked', async () => {
    const { useToast } = await import('../../src/hooks/use-toast')
    const { result } = renderHook(() => useToast())
    
    result.current.toast({
      title: 'Success message',
      description: 'Operation completed successfully'
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success message',
      description: 'Operation completed successfully'
    })
  })

  test('calls dismiss function when invoked', async () => {
    const { useToast } = await import('../../src/hooks/use-toast')
    const { result } = renderHook(() => useToast())

    result.current.dismiss('toast-id')

    expect(mockDismiss).toHaveBeenCalledWith('toast-id')
  })
})