import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { BackendError } from '@/lib/api';
import { BackendErrorDialog } from '@/components/BackendErrorDialog';

interface ErrorContextType {
  showBackendError: (error: BackendError, retryCallback?: () => void) => void;
  clearError: () => void;
  isErrorDialogOpen: boolean;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [currentError, setCurrentError] = useState<BackendError | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [retryCallback, setRetryCallback] = useState<(() => void) | null>(null);

  const showBackendError = useCallback((error: BackendError, retry?: () => void) => {
    setCurrentError(error);
    setRetryCallback(() => retry || null);
    setIsDialogOpen(true);
  }, []);

  const clearError = useCallback(() => {
    setCurrentError(null);
    setRetryCallback(null);
    setIsDialogOpen(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (retryCallback) {
      retryCallback();
    }
    clearError();
  }, [retryCallback, clearError]);

  const getErrorType = (): 'network' | 'server' | 'timeout' => {
    if (!currentError) return 'network';
    
    if (currentError.isTimeoutError()) return 'timeout';
    if (currentError.isServerError()) return 'server';
    return 'network';
  };

  return (
    <ErrorContext.Provider value={{
      showBackendError,
      clearError,
      isErrorDialogOpen: isDialogOpen
    }}>
      {children}
      
      {currentError && (
        <BackendErrorDialog
          isOpen={isDialogOpen}
          onRetry={handleRetry}
          errorType={getErrorType()}
          lastAttempt={currentError.timestamp}
        />
      )}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

// Hook for handling API calls with automatic error handling
export function useApiWithErrorHandling() {
  const { showBackendError } = useError();

  const handleApiCall = useCallback(
    async <T,>(
      apiCall: () => Promise<T>,
      retryCallback?: () => void
    ): Promise<T | null> => {
    try {
      return await apiCall();
    } catch (error) {
      if (error instanceof BackendError) {
        showBackendError(error, retryCallback);
        return null;
      }
      // Re-throw non-backend errors
      throw error;
    }
  }, [showBackendError]);

  return { handleApiCall };
}