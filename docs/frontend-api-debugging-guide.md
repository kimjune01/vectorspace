# Frontend API Debugging Guide for Claude Code

## Overview

This guide captures proven debugging methodologies and common patterns discovered during a complex "Could not load chats" investigation in a React + FastAPI application. These techniques can be applied to similar frontend-backend integration issues.

## Key Debugging Methodology

### 1. Start with Systematic Layer Testing

When facing API integration issues, test each layer independently:

```bash
# 1. Test backend API directly
curl -X GET "http://localhost:8000/api/conversations/" \
  -H "Authorization: Bearer $(curl -s -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}' | jq -r '.access_token')"

# 2. Test through frontend proxy
curl -i http://localhost:5173/api/conversations/

# 3. Test with auth headers through proxy
curl -i "http://localhost:5173/api/conversations/" -H "Authorization: Bearer $TOKEN"
```

**Lesson**: Always verify each layer works independently before debugging integration issues.

### 2. Use Progressive Debugging with Visual Feedback

When console logging fails or is unreliable, add visual debug information directly to the UI:

```tsx
// Add debug info to error display
if (sessionsError) {
  return (
    <div className="error-display">
      <p>DEBUG: {sessionsError}</p>
      <p>Auth: {isAuthenticated ? 'Y' : 'N'}, Loading: {authLoading ? 'Y' : 'N'}, User: {user ? 'Y' : 'N'}</p>
    </div>
  );
}
```

**Lesson**: Visual debugging in the UI is more reliable than console logs during React hot reload scenarios.

### 3. Identify Data Structure Mismatches Early

The most common API integration issue is expecting different data structures:

```tsx
// ❌ Wrong - assuming direct array
const conversations = await apiClient.getConversations();
const sessions = conversations.map(conv => ({ ... })); // Error: conversations.map is not a function

// ✅ Correct - handle API response object
const response = await apiClient.getConversations();
const conversations = response.conversations || [];
const sessions = conversations.map(conv => ({ ... }));
```

**Lesson**: Always log the actual API response structure before processing it.

## Common Issue Patterns and Solutions

### Pattern 1: Vite Development Proxy Issues

**Symptoms**: API calls return HTML instead of JSON, or 404 errors in development

**Root Cause**: Frontend dev server not configured to proxy API calls to backend

**Solution**:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true, // Important for WebSocket support
      },
    },
  },
});

// src/lib/api.ts
const API_BASE_URL = '/api'; // Use relative URL for proxy
```

### Pattern 2: React Authentication Timing Issues

**Symptoms**: API calls fail with "Not authenticated" despite user being logged in

**Root Cause**: Component making API calls before authentication state is properly set

**Solution**:
```tsx
useEffect(() => {
  const fetchData = async () => {
    // API call logic
  };

  // Wait for authentication to complete
  if (isAuthenticated && !authLoading && user) {
    fetchData();
  } else if (!authLoading && !isAuthenticated) {
    // Handle unauthenticated state
    clearData();
  }
}, [isAuthenticated, authLoading, user]); // Proper dependencies
```

### Pattern 3: API Response Structure Mismatches

**Symptoms**: "X.map is not a function" or similar type errors

**Root Cause**: Frontend expects different data structure than backend provides

**Debugging Strategy**:
```tsx
// 1. Log the actual response structure
const response = await apiClient.getData();
console.log('API Response structure:', response);

// 2. Handle the actual structure
const data = response.data || response.items || response.results || [];

// 3. Add defensive programming
if (!Array.isArray(data)) {
  console.error('Expected array but got:', typeof data, data);
  return;
}
```

## Essential Debugging Tools and Techniques

### 1. Layer-by-Layer Testing

Always test in this order:
1. **Backend API directly** (curl/Postman)
2. **Frontend proxy** (curl to frontend dev server)
3. **Authentication flow** (manual token testing)
4. **Component integration** (temporary bypassing of auth checks)
5. **Full integration** (normal app flow)

### 2. Temporary Debug Modifications

Use these temporary modifications for debugging:

```tsx
// Temporarily disable authentication checks
useEffect(() => {
  // TEMP: Skip auth check for debugging
  fetchData();
}, []); // Empty dependency array

// Add extensive logging
const response = await apiClient.getData();
console.log('Response type:', typeof response);
console.log('Response keys:', Object.keys(response));
console.log('Is array?', Array.isArray(response));
```

### 3. Visual State Debugging

Add temporary visual indicators:

```tsx
// Show component state visually
return (
  <div>
    {/* Temporary debug display */}
    <div style={{background: 'yellow', fontSize: '10px'}}>
      Auth: {isAuthenticated ? 'YES' : 'NO'} | 
      Loading: {isLoading ? 'YES' : 'NO'} | 
      Data: {data?.length || 0} items
    </div>
    {/* Normal component content */}
  </div>
);
```

## Common Gotchas and Solutions

### 1. React Strict Mode Double Execution

**Issue**: useEffect runs twice in development, causing duplicate API calls

**Solution**: Use cleanup functions and flags
```tsx
useEffect(() => {
  let cancelled = false;
  
  const fetchData = async () => {
    if (cancelled) return;
    // API call logic
  };
  
  fetchData();
  
  return () => { cancelled = true; };
}, [dependencies]);
```

### 2. Hot Module Reload State Issues

**Issue**: Component state becomes inconsistent during development

**Solution**: Add key debugging and refresh when needed
```tsx
// Force remount if needed
<Component key={`debug-${Date.now()}`} />
```

### 3. Authentication Token Timing

**Issue**: API client created before token is available

**Solution**: Ensure token is set in API client initialization
```typescript
// In AuthContext
useEffect(() => {
  if (token) {
    apiClient.setToken(token); // Explicitly set token
  }
}, [token]);
```

## Debugging Checklist

When facing frontend API issues, go through this checklist:

- [ ] **Backend works independently** (test with curl)
- [ ] **Frontend proxy configured** (vite.config.ts has proxy settings)
- [ ] **API URLs are relative** (use `/api/...` not `http://localhost:8000/api/...`)
- [ ] **Authentication state is ready** (check isAuthenticated, authLoading, user)
- [ ] **API response structure matches expectations** (log actual response)
- [ ] **Component dependencies are correct** (useEffect dependency array)
- [ ] **Error handling captures real errors** (log actual error objects)
- [ ] **Visual debugging added** (show state in UI temporarily)

## Advanced Debugging Techniques

### Using Puppeteer for Systematic Testing

```javascript
// Test API integration systematically
await page.goto('http://localhost:5173');
await page.click('text=My Chats');
await page.waitForTimeout(2000);

const hasError = await page.locator('text=Could not load').isVisible();
if (hasError) {
  // Capture state for debugging
  await page.screenshot({ path: 'debug-error.png' });
}
```

### Network Tab Analysis

When console debugging fails:
1. Open browser dev tools
2. Check Network tab for actual HTTP requests
3. Verify request URLs, headers, and response bodies
4. Look for proxy redirects or unexpected responses

## Prevention Strategies

### 1. Type Safety

```typescript
// Define clear interfaces for API responses
interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

// Use in API client
async getConversations(): Promise<ConversationsResponse> {
  return this.request<ConversationsResponse>('/conversations/');
}
```

### 2. Defensive API Client Design

```typescript
class ApiClient {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      // Log the actual response for debugging
      const text = await response.text();
      console.error('API Error Response:', text);
      throw new Error(`API Error: ${response.status} - ${text}`);
    }
    
    return response.json();
  }
}
```

### 3. Component Error Boundaries

```tsx
// Add error boundaries around API-dependent components
<ErrorBoundary fallback={<div>Something went wrong loading chats</div>}>
  <ChatSidebar />
</ErrorBoundary>
```

## Key Takeaways

1. **Start Simple**: Test each layer independently before debugging integration
2. **Visual Debug**: Use UI debugging when console logs are unreliable
3. **Check Data Structures**: Always verify API response format matches expectations
4. **Authentication Timing**: Ensure auth state is ready before making API calls
5. **Proxy Configuration**: Properly configure development proxy for API calls
6. **Progressive Enhancement**: Add debugging incrementally, don't change everything at once

## Emergency Debugging Commands

```bash
# Quick checks for common issues
lsof -ti:8000  # Check if backend is running
lsof -ti:5173  # Check if frontend is running
curl -i http://localhost:5173/api/health  # Test proxy
grep -r "API_BASE_URL" src/  # Check API configuration
```

This guide provides a systematic approach to debugging complex frontend-backend integration issues, based on real-world experience with React, Vite, and FastAPI applications.