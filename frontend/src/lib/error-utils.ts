/**
 * Error Handling Utilities
 * 
 * Centralized error handling and logging utilities to improve debugging
 * and provide consistent error messages across the application.
 */

import type { ApiError, ApiErrorResponse } from '@/types/api';

/**
 * Error types for better categorization
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION', 
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Enhanced error class with additional context
 */
export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType = ErrorType.UNKNOWN,
    public statusCode?: number,
    public originalError?: unknown,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Parse API error response into structured format
 */
export function parseApiError(error: unknown): AppError {
  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError(
      'Network connection failed. Please check your internet connection.',
      ErrorType.NETWORK,
      undefined,
      error
    );
  }
  
  // Handle Response objects from fetch
  if (error && typeof error === 'object' && 'status' in error) {
    const response = error as Response;
    
    switch (response.status) {
      case 401:
        return new AppError(
          'Authentication required. Please log in.',
          ErrorType.AUTHENTICATION,
          401,
          error
        );
      case 403:
        return new AppError(
          'You do not have permission to perform this action.',
          ErrorType.AUTHORIZATION,
          403,
          error
        );
      case 404:
        return new AppError(
          'The requested resource was not found.',
          ErrorType.NOT_FOUND,
          404,
          error
        );
      case 422:
        return new AppError(
          'Invalid data provided. Please check your input.',
          ErrorType.VALIDATION,
          422,
          error
        );
      case 500:
        return new AppError(
          'Internal server error. Please try again later.',
          ErrorType.SERVER,
          500,
          error
        );
      default:
        return new AppError(
          `Request failed with status ${response.status}`,
          ErrorType.UNKNOWN,
          response.status,
          error
        );
    }
  }
  
  // Handle structured API error responses
  if (error && typeof error === 'object' && 'detail' in error) {
    const apiError = error as ApiErrorResponse;
    
    return new AppError(
      typeof apiError.detail === 'string' 
        ? apiError.detail 
        : 'Validation errors occurred',
      apiError.error_type === 'validation' ? ErrorType.VALIDATION : ErrorType.SERVER,
      apiError.status_code,
      error
    );
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorType.UNKNOWN,
      undefined,
      error
    );
  }
  
  // Handle unknown error types
  return new AppError(
    'An unexpected error occurred',
    ErrorType.UNKNOWN,
    undefined,
    error
  );
}

/**
 * Log error with context for debugging
 */
export function logError(
  error: AppError | Error | unknown,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    context,
    ...(error instanceof AppError ? {
      message: error.message,
      type: error.type,
      statusCode: error.statusCode,
      originalError: error.originalError,
      errorContext: error.context
    } : {
      message: error instanceof Error ? error.message : String(error),
      type: 'UNKNOWN',
      originalError: error
    })
  };
  
  console.error('Application Error:', logData);
  
  // In development, also log the full error for debugging
  if (import.meta.env.DEV) {
    console.error('Full error object:', error);
  }
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: AppError | Error | unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AppError | Error | unknown): boolean {
  if (error instanceof AppError) {
    return [ErrorType.NETWORK, ErrorType.SERVER].includes(error.type);
  }
  
  return false;
}