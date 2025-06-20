import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { Input } from '../../../src/components/ui/input'

describe('Input Component', () => {
  test('renders with default properties', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border')
  })

  test('handles value changes', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test input' } })
    
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('test input')
  })

  test('can be disabled', () => {
    render(<Input disabled placeholder="Disabled input" />)
    const input = screen.getByPlaceholderText('Disabled input')
    
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
  })

  test('supports different input types', () => {
    const { rerender } = render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')

    rerender(<Input type="password" />)
    const passwordInput = document.querySelector('input[type="password"]')
    expect(passwordInput).toHaveAttribute('type', 'password')

    rerender(<Input type="number" />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  test('applies custom className', () => {
    render(<Input className="custom-class" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  test('handles focus and blur events', () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    
    const input = screen.getByRole('textbox')
    
    fireEvent.focus(input)
    expect(handleFocus).toHaveBeenCalledTimes(1)
    
    fireEvent.blur(input)
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })
})