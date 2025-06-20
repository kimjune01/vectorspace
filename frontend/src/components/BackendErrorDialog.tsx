import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServerCrash, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';

interface BackendErrorDialogProps {
  isOpen: boolean;
  onRetry: () => void;
  errorType: 'network' | 'server' | 'timeout';
  lastAttempt?: Date;
}

export function BackendErrorDialog({ 
  isOpen, 
  onRetry, 
  errorType, 
  lastAttempt 
}: BackendErrorDialogProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryCountdown, setAutoRetryCountdown] = useState<number | null>(null);

  const getErrorInfo = () => {
    switch (errorType) {
      case 'network':
        return {
          icon: Wifi,
          title: 'Network Connection Error',
          description: 'Unable to connect to VectorSpace servers. Please check your internet connection.',
          suggestion: 'Check your network connection and try again.'
        };
      case 'server':
        return {
          icon: ServerCrash,
          title: 'Backend Service Unavailable',
          description: 'VectorSpace backend servers are currently down for maintenance or experiencing issues.',
          suggestion: 'Our team has been notified. Please try again in a few minutes.'
        };
      case 'timeout':
        return {
          icon: AlertTriangle,
          title: 'Request Timeout',
          description: 'The server is taking too long to respond.',
          suggestion: 'The servers may be experiencing high load. Please try again.'
        };
      default:
        return {
          icon: AlertTriangle,
          title: 'Connection Error',
          description: 'Something went wrong connecting to VectorSpace.',
          suggestion: 'Please try again.'
        };
    }
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setAutoRetryCountdown(null);
    onRetry();
  };

  // Auto-retry countdown for server errors
  useEffect(() => {
    if (isOpen && errorType === 'server' && retryCount < 3) {
      const timer = setTimeout(() => {
        setAutoRetryCountdown(30);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, errorType, retryCount]);

  useEffect(() => {
    if (autoRetryCountdown === null) return;

    if (autoRetryCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoRetryCountdown(prev => prev! - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto retry when countdown reaches 0
      handleRetry();
    }
  }, [autoRetryCountdown]);

  // Reset retry count when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setRetryCount(0);
      setAutoRetryCountdown(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <IconComponent className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-xl">{errorInfo.title}</DialogTitle>
          <DialogDescription className="text-base">
            {errorInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {errorInfo.suggestion}
            </AlertDescription>
          </Alert>

          {lastAttempt && (
            <p className="text-sm text-muted-foreground text-center">
              Last attempt: {lastAttempt.toLocaleTimeString()}
            </p>
          )}

          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Retry attempts: {retryCount}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleRetry} 
              className="w-full"
              disabled={autoRetryCountdown !== null}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {autoRetryCountdown !== null 
                ? `Auto retry in ${autoRetryCountdown}s...` 
                : 'Try Again'
              }
            </Button>

            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>

          {errorType === 'server' && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Status updates: <a 
                  href="https://status.vectorspace.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Check server status
                </a>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}