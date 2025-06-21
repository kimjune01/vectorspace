import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollectionsList } from '@/components/CollectionsList';
import { BookmarkButton } from '@/components/BookmarkButton';
import { 
  Search, 
  Tag, 
  Calendar, 
  MessageSquare, 
  User, 
  Filter,
  Edit3,
  Trash2,
  FolderPlus,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface SavedConversation {
  id: number;
  user_id: number;
  conversation_id: number;
  saved_at: string;
  tags: string[];
  personal_note: string | null;
  conversation_title: string;
  conversation_summary: string | null;
  conversation_author: string;
}

interface Collection {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export default function SavedConversationsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [editTagsContent, setEditTagsContent] = useState('');
  const [showCollections, setShowCollections] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Extract unique tags from all saved conversations
  const allTags = Array.from(
    new Set(savedConversations.flatMap(conv => conv.tags))
  ).sort();

  useEffect(() => {
    if (user) {
      fetchSavedConversations();
      fetchCollections();
    }
  }, [user, currentPage, selectedTag]);

  const fetchSavedConversations = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getSavedConversations(
        currentPage, 
        20, 
        selectedTag || undefined
      ) as any;
      setSavedConversations(response.saved_conversations || []);
      setTotalPages(Math.ceil((response.total || 0) / 20));
    } catch (error) {
      setError('Failed to load saved conversations');
      console.error('Error fetching saved conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await apiClient.getMyCollections(1, 50) as any;
      setCollections(response.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedTag) params.set('tag', selectedTag);
    setSearchParams(params);
    
    // Filter conversations locally for immediate feedback
    const filtered = savedConversations.filter(conv => 
      searchQuery ? (
        conv.conversation_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.conversation_summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.personal_note?.toLowerCase().includes(searchQuery.toLowerCase())
      ) : true
    );
    setSavedConversations(filtered);
  };

  const handleUnsave = async (conversationId: number) => {
    try {
      await apiClient.unsaveConversation(conversationId);
      setSavedConversations(prev => 
        prev.filter(conv => conv.conversation_id !== conversationId)
      );
    } catch (error) {
      console.error('Failed to unsave conversation:', error);
    }
  };

  const handleUpdateNote = async (savedId: number) => {
    try {
      await apiClient.updateSavedConversation(savedId, {
        personal_note: editNoteContent
      });
      setSavedConversations(prev => 
        prev.map(conv => 
          conv.id === savedId 
            ? { ...conv, personal_note: editNoteContent }
            : conv
        )
      );
      setEditingNote(null);
      setEditNoteContent('');
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleUpdateTags = async (savedId: number) => {
    try {
      const tags = editTagsContent.split(',').map(tag => tag.trim()).filter(Boolean);
      await apiClient.updateSavedConversation(savedId, { tags });
      setSavedConversations(prev => 
        prev.map(conv => 
          conv.id === savedId 
            ? { ...conv, tags }
            : conv
        )
      );
      setEditingTags(null);
      setEditTagsContent('');
    } catch (error) {
      console.error('Failed to update tags:', error);
    }
  };

  const startEditingNote = (conv: SavedConversation) => {
    setEditingNote(conv.id);
    setEditNoteContent(conv.personal_note || '');
  };

  const startEditingTags = (conv: SavedConversation) => {
    setEditingTags(conv.id);
    setEditTagsContent(conv.tags.join(', '));
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Login Required</h1>
          <p className="text-muted-foreground mb-4">
            Please log in to view your saved conversations.
          </p>
          <Button asChild>
            <Link to="/login">Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">My Saved Conversations</h1>
              <p className="text-muted-foreground">
                {savedConversations.length} saved conversations
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showCollections ? "default" : "outline"}
              onClick={() => setShowCollections(!showCollections)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Collections
            </Button>
          </div>
        </div>

        {/* Collections View */}
        {showCollections && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>My Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <CollectionsList collections={collections as any} onUpdate={fetchCollections} />
            </CardContent>
          </Card>
        )}

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search titles, summaries, and notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Filter by Tag</label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved Conversations */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-16 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive">{error}</p>
              <Button onClick={fetchSavedConversations} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : savedConversations.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-semibold mb-2">No saved conversations</h3>
              <p className="text-muted-foreground mb-4">
                Start saving conversations you find interesting to build your personal collection.
              </p>
              <Button asChild>
                <Link to="/">Discover Conversations</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {savedConversations.map((conv) => (
              <Card key={conv.id} className="overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Link 
                          to={`/chat/${conv.conversation_id}`}
                          className="text-lg font-semibold hover:underline"
                        >
                          {conv.conversation_title}
                        </Link>
                        <BookmarkButton 
                          conversationId={conv.conversation_id}
                          initialIsSaved={true}
                          size="sm"
                          onSaveChange={(isSaved) => {
                            if (!isSaved) {
                              setSavedConversations(prev => 
                                prev.filter(c => c.conversation_id !== conv.conversation_id)
                              );
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {conv.conversation_author}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Saved {new Date(conv.saved_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conversation Summary */}
                  {conv.conversation_summary && (
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">{conv.conversation_summary}</p>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4" />
                      <span className="text-sm font-medium">Tags</span>
                      {editingTags !== conv.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingTags(conv)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {editingTags === conv.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editTagsContent}
                          onChange={(e) => setEditTagsContent(e.target.value)}
                          placeholder="tag1, tag2, tag3"
                          className="text-sm"
                        />
                        <Button size="sm" onClick={() => handleUpdateTags(conv.id)}>
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setEditingTags(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {conv.tags.length > 0 ? (
                          conv.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No tags</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Personal Note */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm font-medium">Personal Note</span>
                      {editingNote !== conv.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingNote(conv)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {editingNote === conv.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          placeholder="Add your thoughts about this conversation..."
                          className="text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateNote(conv.id)}>
                            Save Note
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingNote(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        {conv.personal_note ? (
                          <p className="text-sm whitespace-pre-wrap">{conv.personal_note}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No personal note added yet
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button 
                  variant="outline" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}