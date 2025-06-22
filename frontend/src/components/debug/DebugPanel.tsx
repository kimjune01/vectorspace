import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  const debugInfo = {
    'Auth State': {
      'Is Authenticated': isAuthenticated ? '✅' : '❌',
      'Is Loading': isLoading ? '⏳' : '✅',
      'Has User': user ? '✅' : '❌',
      'Username': user?.username || 'None',
      'Display Name': user?.display_name || 'None',
    },
    'Storage': {
      'Has Token': localStorage.getItem('auth_token') ? '✅' : '❌',
      'Token Preview': localStorage.getItem('auth_token')?.substring(0, 20) + '...' || 'None',
      'Token Length': localStorage.getItem('auth_token')?.length.toString() || '0',
    },
    'Environment': {
      'API Base URL': '/api (proxy)',
      'Node Env': process.env.NODE_ENV || 'unknown',
      'Protocol': window.location.protocol,
      'Host': window.location.host,
    },
    'Current Page': {
      'URL': window.location.href,
      'Path': window.location.pathname,
      'Search': window.location.search || 'None',
    }
  };

  const handleLogToConsole = () => {
    console.group('🐛 Debug Panel State');
    Object.entries(debugInfo).forEach(([category, items]) => {
      console.group(category);
      Object.entries(items).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      console.groupEnd();
    });
    console.groupEnd();
  };

  const handleTestApiCall = async () => {
    try {
      console.log('🧪 Testing API call...');
      const response = await fetch('/api/health');
      console.log('✅ API Test Response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (error) {
      console.error('❌ API Test Failed:', error);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-lg transition-colors"
        title="Debug Panel - Development Only"
      >
        🐛 Debug
      </button>
      
      {isOpen && (
        <div className="absolute bottom-12 left-0 bg-gray-900 text-white p-4 rounded-lg shadow-xl text-xs w-80 max-h-96 overflow-auto border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-blue-300">Debug Panel</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {Object.entries(debugInfo).map(([category, items]) => (
            <div key={category} className="mb-3">
              <h4 className="text-yellow-300 font-semibold border-b border-gray-700 pb-1 mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {Object.entries(items).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start">
                    <span className="text-gray-300 mr-2">{key}:</span>
                    <span className="text-green-300 text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="border-t border-gray-700 pt-3 space-y-2">
            <button
              onClick={handleLogToConsole}
              className="w-full bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs transition-colors"
            >
              📋 Log to Console
            </button>
            <button
              onClick={handleTestApiCall}
              className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-xs transition-colors"
            >
              🧪 Test API Call
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-xs transition-colors"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
};