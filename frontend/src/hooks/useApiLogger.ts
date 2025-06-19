import { useEffect, useRef } from 'react';

interface LoggedRequest {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  status?: number;
  ok?: boolean;
  error?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
}

export const useApiLogger = () => {
  const originalFetch = useRef<typeof fetch>();
  const requestLog = useRef<LoggedRequest[]>([]);

  useEffect(() => {
    // Only enable in development
    if (process.env.NODE_ENV !== 'development') return;

    // Store original fetch
    originalFetch.current = window.fetch;
    
    // Override fetch with logging
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [url, options = {}] = args;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      // Parse request details
      const method = options.method || 'GET';
      const isApiCall = typeof url === 'string' && url.includes('/api');
      
      // Only log API calls to avoid noise
      if (!isApiCall) {
        return originalFetch.current!.apply(window, args);
      }

      const logEntry: LoggedRequest = {
        id: requestId,
        url: typeof url === 'string' ? url : url.toString(),
        method,
        startTime,
        requestHeaders: options.headers ? 
          Object.fromEntries(
            options.headers instanceof Headers ? 
              options.headers.entries() : 
              Object.entries(options.headers)
          ) : undefined,
        requestBody: options.body ? 
          (typeof options.body === 'string' ? 
            (() => {
              try { return JSON.parse(options.body as string); } 
              catch { return options.body; }
            })() : 
            options.body
          ) : undefined
      };

      // Log request
      console.group(`🌐 API ${method}: ${logEntry.url}`);
      console.log('📤 Request:', {
        method,
        headers: logEntry.requestHeaders,
        body: logEntry.requestBody
      });
      
      try {
        const response = await originalFetch.current!.apply(window, args);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Clone response to avoid consuming the stream
        const responseClone = response.clone();
        let responseBody;
        const contentType = response.headers.get('content-type');
        
        try {
          if (contentType?.includes('application/json')) {
            responseBody = await responseClone.json();
          } else {
            responseBody = await responseClone.text();
          }
        } catch {
          responseBody = '[Unable to parse response body]';
        }
        
        // Update log entry
        logEntry.endTime = endTime;
        logEntry.status = response.status;
        logEntry.ok = response.ok;
        logEntry.responseHeaders = Object.fromEntries(response.headers.entries());
        logEntry.responseBody = responseBody;
        
        // Log response
        if (response.ok) {
          console.log(`📥 Response (${duration}ms):`, { 
            status: response.status,
            headers: logEntry.responseHeaders,
            body: responseBody
          });
        } else {
          console.error(`❌ Error Response (${duration}ms):`, { 
            status: response.status,
            headers: logEntry.responseHeaders,
            body: responseBody
          });
        }
        
        // Add to request log
        requestLog.current = [...requestLog.current.slice(-9), logEntry]; // Keep last 10
        
        console.groupEnd();
        return response;
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Update log entry with error
        logEntry.endTime = endTime;
        logEntry.error = error instanceof Error ? error.message : String(error);
        
        console.error(`💥 Network Error (${duration}ms):`, error);
        
        // Add to request log
        requestLog.current = [...requestLog.current.slice(-9), logEntry];
        
        console.groupEnd();
        throw error;
      }
    };

    // Add global debug function
    (window as any).debugApiLog = () => {
      console.group('🔍 API Request Log');
      if (requestLog.current.length === 0) {
        console.log('No API requests logged yet');
      } else {
        requestLog.current.forEach((req, index) => {
          const duration = req.endTime ? req.endTime - req.startTime : 'pending';
          const status = req.status ? `${req.status} ${req.ok ? '✅' : '❌'}` : req.error ? '💥 ERROR' : '⏳ PENDING';
          
          console.group(`${index + 1}. ${req.method} ${req.url} - ${status} (${duration}ms)`);
          console.log('Request:', { headers: req.requestHeaders, body: req.requestBody });
          if (req.responseBody) {
            console.log('Response:', { headers: req.responseHeaders, body: req.responseBody });
          }
          if (req.error) {
            console.error('Error:', req.error);
          }
          console.groupEnd();
        });
      }
      console.groupEnd();
    };

    // Cleanup function
    return () => {
      if (originalFetch.current) {
        window.fetch = originalFetch.current;
      }
      delete (window as any).debugApiLog;
    };
  }, []);

  // Return debug utilities
  return {
    getRequestLog: () => requestLog.current,
    clearLog: () => { requestLog.current = []; },
    logToConsole: () => (window as any).debugApiLog?.()
  };
};