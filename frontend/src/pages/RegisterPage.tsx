import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <MessageSquare className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">VectorSpace</h1>
          <p className="text-muted-foreground text-sm">AI Conversation Discovery</p>
        </div>
        
        <RegisterForm />
      </div>
    </div>
  );
}