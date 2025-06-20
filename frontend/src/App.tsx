import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorProvider } from './contexts/ErrorContext'
import HomePage from './pages/HomePage'
import DiscoverPage from './pages/DiscoverPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import { DebugPanel } from './components/debug/DebugPanel'
import { useApiLogger } from './hooks/useApiLogger'

const queryClient = new QueryClient()

function App() {
  // Enable API logging in development
  useApiLogger();

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <AuthProvider>
          <Router>
          <div className="min-h-screen bg-background text-foreground">
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/chat/:id" element={<ChatPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
              </Routes>
            </main>
            {/* Debug tools - only visible in development */}
            <DebugPanel />
          </div>
          </Router>
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthProvider>
      </ErrorProvider>
    </QueryClientProvider>
  )
}

export default App