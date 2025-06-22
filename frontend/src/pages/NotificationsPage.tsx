import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import type { Notification, NotificationListResponse } from '@/types/social';
import { 
  Bell, 
  User, 
  MessageSquare, 
  Users, 
  Trash2, 
  Check, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const { toast } = useToast();

  const perPage = 20;

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, activeTab]);

  const fetchNotifications = async (page?: number, tab?: 'all' | 'unread') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const targetPage = page ?? currentPage;
      const targetTab = tab ?? activeTab;
      const unreadOnly = targetTab === 'unread';
      const response = await apiClient.getNotifications(targetPage, perPage, unreadOnly) as NotificationListResponse;
      
      setNotifications(response.notifications);
      setTotalPages(Math.ceil(response.total / perPage));
      setHasNext(response.has_next);
      setHasPrev(response.has_prev);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await apiClient.markNotificationRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await apiClient.deleteNotification(notificationId);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <User className="h-4 w-4 text-blue-500" data-testid="user-icon" />;
      case 'collaboration_invite':
        return <Users className="h-4 w-4 text-green-500" data-testid="users-icon" />;
      case 'new_conversation':
        return <MessageSquare className="h-4 w-4 text-purple-500" data-testid="message-icon" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" data-testid="bell-icon" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Loading notifications...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-sm text-destructive">{error}</div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchNotifications()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium">No notifications yet</div>
            <div className="text-sm text-muted-foreground">
              When you receive notifications, they will appear here.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {notifications.map((notification) => (
          <Card 
            key={notification.id} 
            className={`transition-colors ${!notification.is_read ? 'bg-muted/30' : ''}`}
            data-testid="notification-item"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">
                      {notification.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <div 
                          className="w-2 h-2 bg-blue-500 rounded-full" 
                          data-testid="unread-indicator"
                        />
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.message}
                  </p>
                  
                  {notification.related_user && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {notification.related_user.display_name || notification.related_user.username}
                      </span>
                    </div>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" data-testid="more-icon" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!notification.is_read && (
                      <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                        <Check className="h-4 w-4 mr-2" />
                        Mark as read
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => deleteNotification(notification.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            <Check className="h-4 w-4 mr-2" data-testid="check-icon" />
            Mark All as Read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as 'all' | 'unread');
        setCurrentPage(1);
      }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {renderContent()}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={!hasPrev || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={!hasNext || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}