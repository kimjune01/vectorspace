import React, { useState } from 'react';
import { AlertTriangleIcon, RefreshCwIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

interface EnhancedErrorProps {
  error: string;
  context?: Record<string, any>;
  onRetry?: () => void;
  className?: string;
}

export const EnhancedError: React.FC<EnhancedErrorProps> = ({ 
  error, 
  context, 
  onRetry,
  className = ""
}) => {
  const [showContext, setShowContext] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  
  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const enhancedContext = {
    ...context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine
  };

  return (
    <div className={`p-3 m-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertTriangleIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <p className="font-semibold">Error:</p>
        </div>
        <div className="flex items-center space-x-2">
          {isDev && context && (
            <button
              onClick={() => setShowContext(!showContext)}
              className="flex items-center text-xs opacity-75 hover:opacity-100 transition-opacity"
              title="Toggle debug context"
            >
              {showContext ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              Debug
            </button>
          )}
          {onRetry && (
            <button 
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs hover:bg-destructive/80 disabled:opacity-50 flex items-center transition-colors"
              title="Retry the failed operation"
            >
              <RefreshCwIcon className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
        </div>
      </div>
      
      <p className="mt-2 pl-6 leading-relaxed">{error}</p>
      
      {isDev && context && showContext && (
        <div className="mt-3 border-t border-destructive/20 pt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs opacity-75 font-semibold">Debug Context (Development)</span>
            <button
              onClick={() => console.log('🐛 Error Context:', enhancedContext)}
              className="text-xs opacity-75 hover:opacity-100 underline"
            >
              Log to Console
            </button>
          </div>
          <pre className="p-2 bg-black/20 rounded text-xs overflow-auto max-h-40 leading-relaxed">
            {JSON.stringify(enhancedContext, null, 2)}
          </pre>
        </div>
      )}
      
      {isDev && !context && (
        <div className="mt-2 pl-6 text-xs opacity-75">
          💡 Tip: Pass context prop for better debugging information
        </div>
      )}
    </div>
  );
};