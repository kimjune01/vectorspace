import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import type { Collection } from '@/types/social';
import { Plus, BookOpen, Lock, Globe, Calendar } from 'lucide-react';

interface CollectionsListProps {
  collections?: Collection[];
  onCreateCollection?: () => void;
  onCollectionClick?: (collection: Collection) => void;
  onUpdate?: () => Promise<void>;
}

export function CollectionsList({ collections: propCollections, onCreateCollection, onCollectionClick, onUpdate }: CollectionsListProps) {
  const [collections, setCollections] = useState<Collection[]>(propCollections || []);
  const [isLoading, setIsLoading] = useState(!propCollections);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (propCollections) {
      setCollections(propCollections);
      setIsLoading(false);
    } else {
      loadCollections();
    }
  }, [propCollections]);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getMyCollections(1, 50);
      setCollections(response.collections || []);
      setError(null);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to load collections';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">My Collections</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Error Loading Collections</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadCollections}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Collections</h2>
        <Button onClick={onCreateCollection} className="gap-2">
          <Plus className="h-4 w-4" />
          New Collection
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Collections Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first collection to organize your saved conversations.
          </p>
          <Button onClick={onCreateCollection} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Collection
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Card 
              key={collection.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onCollectionClick?.(collection)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{collection.name}</CardTitle>
                  <div className="flex items-center gap-1 mt-1">
                    {collection.is_public ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Updated {formatDate(collection.updated_at)}</span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {collection.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {collection.items_count} {collection.items_count === 1 ? 'conversation' : 'conversations'}
                  </Badge>
                  
                  <Badge variant={collection.is_public ? "default" : "outline"} className="text-xs">
                    {collection.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}