import { describe, test, expect } from 'vitest'
import { cn } from '../../src/lib/utils'

describe('cn utility function', () => {
  test('combines class names correctly', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  test('handles conditional classes', () => {
    const result = cn('base', true && 'conditional', false && 'hidden')
    expect(result).toBe('base conditional')
  })

  test('handles undefined and null values', () => {
    const result = cn('base', undefined, null, 'valid')
    expect(result).toBe('base valid')
  })

  test('merges conflicting Tailwind classes correctly', () => {
    // tailwind-merge should resolve conflicts
    const result = cn('p-4', 'p-6')
    expect(result).toBe('p-6') // Later class should win
  })

  test('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  test('handles array of classes', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  test('handles objects with boolean values', () => {
    const result = cn({
      'base-class': true,
      'conditional-class': false,
      'active-class': true
    })
    expect(result).toBe('base-class active-class')
  })

  test('complex example with mixed inputs', () => {
    const isActive = true
    const isDisabled = false
    
    const result = cn(
      'btn',
      'px-4 py-2',
      isActive && 'active',
      isDisabled && 'disabled',
      { 'rounded-md': true, 'shadow-lg': false },
      ['text-white', 'bg-blue-500']
    )
    
    expect(result).toContain('btn')
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
    expect(result).toContain('active')
    expect(result).toContain('rounded-md')
    expect(result).toContain('text-white')
    expect(result).toContain('bg-blue-500')
    expect(result).not.toContain('disabled')
    expect(result).not.toContain('shadow-lg')
  })

  test('handles duplicate classes', () => {
    const result = cn('class1', 'class2', 'class1')
    // Should deduplicate classes
    expect(result.split(' ').filter(c => c === 'class1')).toHaveLength(1)
  })
})