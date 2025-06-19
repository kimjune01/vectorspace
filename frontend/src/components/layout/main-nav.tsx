import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function MainNav() {
  const { user, logout, isLoading } = useAuth();

  return (
    <nav className="bg-card shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-foreground">
              VectorSpace
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : user ? (
              <>
                <Link
                  to="/chat"
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  Chat
                </Link>
                <Link
                  to="/discover"
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  Discover
                </Link>
                <Link
                  to="/profile"
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  Profile
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                >
                  Logout ({user.email || user.username})
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
