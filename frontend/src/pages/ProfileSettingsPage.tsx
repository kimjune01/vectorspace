import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useApiWithErrorHandling } from '@/contexts/ErrorContext';

interface ProfileUpdateData {
  display_name?: string;
  bio?: string;
}

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { handleApiCall } = useApiWithErrorHandling();
  
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    setDisplayName(user.display_name || '');
    setBio(user.bio || '');
  }, [user, navigate]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    const updateData: ProfileUpdateData = {};
    
    if (displayName !== user.display_name) {
      updateData.display_name = displayName;
    }
    
    if (bio !== user.bio) {
      updateData.bio = bio;
    }
    
    if (Object.keys(updateData).length === 0) {
      // No changes made
      navigate(`/profile/${user.username}`);
      return;
    }
    
    const updatedUser = await handleApiCall(
      () => apiClient.updateProfile(updateData),
      handleSave
    );
    
    if (updatedUser) {
      await refreshProfile();
      navigate(`/profile/${user.username}`);
    }
    
    setIsLoading(false);
  };

  const handleCancel = () => {
    navigate(`/profile/${user?.username}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
              />
              <p className="text-sm text-muted-foreground">
                This is how your name will appear to other users.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                maxLength={200}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                {bio.length}/200 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={user.username}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Username cannot be changed.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}