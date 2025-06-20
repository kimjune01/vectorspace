import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, BackendError } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, display_name: string, email: string, password: string, bio?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (username: string, password: string) => {
    console.log('AuthContext: Attempting login for user:', username);
    try {
      const response = await apiClient.login(username, password);
      console.log('AuthContext: Login successful, setting user:', response.user);
      setUser(response.user);
    } catch (error) {
      if (error instanceof BackendError) {
        // For authentication errors (401, 403), convert to regular error
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw new Error('Invalid username or password');
        }
        // For other client errors (400-499), convert to regular error  
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw new Error(error.message || 'Authentication failed');
        }
        // For server errors (5xx) and network issues, let BackendError bubble up
        // This will trigger the global error dialog
      }
      // Re-throw the error (either BackendError for connectivity issues, or converted Error for auth issues)
      throw error;
    }
  };

  const register = async (username: string, display_name: string, email: string, password: string, bio?: string) => {
    try {
      const response = await apiClient.register(username, display_name, email, password, bio);
      setUser(response.user);
    } catch (error) {
      if (error instanceof BackendError) {
        // For registration errors (400, 409 conflict, etc.), convert to regular error
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw new Error(error.message || 'Registration failed');
        }
        // For server errors (5xx) and network issues, let BackendError bubble up
      }
      throw error;
    }
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await apiClient.getProfile();
      setUser(profile);
    } catch {
      // Token might be invalid, clear auth state
      setUser(null);
      apiClient.setToken(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      console.log('AuthContext initializing with token:', !!token);
      if (token) {
        try {
          console.log('Attempting to refresh profile...');
          // Ensure the API client has the token set
          apiClient.setToken(token);
          await refreshProfile();
          console.log('Profile refreshed successfully');
        } catch (error) {
          console.error('Failed to refresh profile:', error);
          // Token is invalid, try auto-login
          await attemptAutoLogin();
        }
      } else {
        console.log('No token found, attempting auto-login');
        await attemptAutoLogin();
      }
      setIsLoading(false);
    };

    const attemptAutoLogin = async () => {
      // Only attempt auto-login if explicitly enabled via environment variable
      const autoLoginEnabled = import.meta.env.VITE_AUTO_LOGIN === 'true';
      
      if (!autoLoginEnabled) {
        console.log('Auto-login disabled (set VITE_AUTO_LOGIN=true to enable)');
        return;
      }
      
      try {
        console.log('Attempting auto-login with default test user...');
        const response = await apiClient.login('testuser', 'testpass');
        console.log('Auto-login successful');
        setUser(response.user);
      } catch (error) {
        // Silently fail auto-login - don't show error dialogs for this
        console.error('Auto-login failed:', error);
      }
    };

    initAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}