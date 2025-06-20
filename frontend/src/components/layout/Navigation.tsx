import { Link, useLocation } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { User, Settings, LogOut, MessageSquare, Search, Home, UserPlus, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NewConversationDialog } from '@/components/NewConversationDialog'

export default function Navigation() {
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6" />
            <span className="text-lg font-semibold">VectorSpace</span>
            {user?.username === 'testuser' && (
              <Badge variant="secondary" className="text-xs">DEV</Badge>
            )}
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link to="/">
              <Button 
                variant={isActive('/') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center space-x-1"
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Button>
            </Link>
            
            <Link to="/discover">
              <Button 
                variant={isActive('/discover') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center space-x-1"
              >
                <Search className="h-4 w-4" />
                <span>Discover</span>
              </Button>
            </Link>

            {isAuthenticated && (
              <NewConversationDialog>
                <Button size="sm" variant="outline" className="flex items-center space-x-1">
                  <Plus className="h-4 w-4" />
                  <span>New Chat</span>
                </Button>
              </NewConversationDialog>
            )}
          </div>

          {/* User Menu / Auth */}
          <div className="flex items-center space-x-2">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link to={`/profile/${user?.username}`}>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-1 hover:bg-accent">
                    <User className="h-4 w-4" />
                    <span>{user?.display_name || user?.username || 'Account'}</span>
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="px-2">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                    <LogOut className="h-4 w-4" />
                    <span>Sign In</span>
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="flex items-center space-x-1">
                    <UserPlus className="h-4 w-4" />
                    <span>Sign Up</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}