import { renderHook } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { useToast } from '../../src/hooks/use-toast'

// Mock sonner
const mockToast = vi.fn()
const mockDismiss = vi.fn()

vi.mock('sonner', () => ({
  toast: mockToast,
}))

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns toast function and dismiss', () => {
    const { result } = renderHook(() => useToast())
    
    expect(typeof result.current.toast).toBe('function')
    expect(typeof result.current.dismiss).toBe('function')
  })

  test('calls sonner toast with default variant', () => {
    const { result } = renderHook(() => useToast())
    
    result.current.toast({
      title: 'Success message',
      description: 'Operation completed successfully'
    })

    expect(mockToast).toHaveBeenCalledWith('Success message', {
      description: 'Operation completed successfully'
    })
  })

  test('calls sonner toast.error with destructive variant', () => {
    const { result } = renderHook(() => useToast())
    
    // Mock toast.error
    const mockError = vi.fn()
    ;(sonnerToast as any).error = mockError

    result.current.toast({
      title: 'Error message',
      description: 'Something went wrong',
      variant: 'destructive'
    })

    expect(mockError).toHaveBeenCalledWith('Error message', {
      description: 'Something went wrong',
      variant: 'destructive'
    })
  })

  test('handles toast without description', () => {
    const { result } = renderHook(() => useToast())
    
    result.current.toast({
      title: 'Simple message'
    })

    expect(sonnerToast).toHaveBeenCalledWith('Simple message', {
      title: 'Simple message'
    })
  })

  test('passes through additional props', () => {
    const { result } = renderHook(() => useToast())
    
    result.current.toast({
      title: 'Message',
      description: 'Description',
      duration: 5000,
      action: 'Custom action'
    })

    expect(sonnerToast).toHaveBeenCalledWith('Message', {
      description: 'Description',
      duration: 5000,
      action: 'Custom action'
    })
  })

  test('dismiss function is available', () => {
    const { result } = renderHook(() => useToast())
    
    // Mock dismiss function
    const mockDismiss = vi.fn()
    ;(sonnerToast as any).dismiss = mockDismiss

    result.current.dismiss('toast-id')

    expect(mockDismiss).toHaveBeenCalledWith('toast-id')
  })
})