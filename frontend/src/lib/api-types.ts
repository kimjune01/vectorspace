/**
 * API Type Guards and Validation Utilities
 * 
 * This file provides runtime type validation for API responses to ensure
 * type safety between frontend and backend. These guards help catch
 * type mismatches early and provide better error messages.
 */

import type { 
  Conversation, 
  ConversationDetail, 
  User, 
  SearchResult,
  PaginatedResponse 
} from '@/types/api';

/**
 * Type guard to check if response is a valid Conversation
 */
export function isConversation(obj: unknown): obj is Conversation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).id === 'number' &&
    typeof (obj as any).title === 'string' &&
    typeof (obj as any).user_id === 'number' &&
    typeof (obj as any).is_public === 'boolean' &&
    typeof (obj as any).created_at === 'string'
  );
}

/**
 * Type guard to check if response is a valid User
 */
export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).id === 'number' &&
    typeof (obj as any).username === 'string' &&
    typeof (obj as any).display_name === 'string' &&
    typeof (obj as any).email === 'string'
  );
}

/**
 * Type guard to check if response is a valid PaginatedResponse
 */
export function isPaginatedResponse<T>(
  obj: unknown,
  itemGuard: (item: unknown) => item is T
): obj is PaginatedResponse<T[]> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray((obj as any).data) &&
    typeof (obj as any).total === 'number' &&
    typeof (obj as any).page === 'number' &&
    typeof (obj as any).per_page === 'number' &&
    typeof (obj as any).has_next === 'boolean' &&
    (obj as any).data.every(itemGuard)
  );
}

/**
 * Validates and transforms API response data
 * Throws descriptive error if validation fails
 */
export function validateApiResponse<T>(
  data: unknown,
  guard: (obj: unknown) => obj is T,
  context: string
): T {
  if (!guard(data)) {
    console.error(`API validation failed for ${context}:`, data);
    throw new Error(
      `Invalid API response structure for ${context}. ` +
      `Expected valid data format but received: ${typeof data}`
    );
  }
  return data;
}

/**
 * Safe API response parser with fallback
 */
export function parseApiResponse<T>(
  data: unknown,
  guard: (obj: unknown) => obj is T,
  fallback: T,
  context: string
): T {
  try {
    return validateApiResponse(data, guard, context);
  } catch (error) {
    console.warn(`Using fallback for ${context}:`, error);
    return fallback;
  }
}