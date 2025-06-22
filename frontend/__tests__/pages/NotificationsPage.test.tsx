import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { apiClient } from '@/lib/api';
import type { NotificationListResponse, Notification } from '@/types/social';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: () => <div data-testid="bell-icon" />,
  User: () => <div data-testid="user-icon" />,
  MessageSquare: () => <div data-testid="message-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Check: () => <div data-testid="check-icon" />,
  MoreHorizontal: () => <div data-testid="more-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
}));

const mockNotifications: Notification[] = [
  {
    id: 1,
    type: 'follow',
    title: 'New Follower',
    message: 'Alice started following you',
    is_read: false,
    created_at: '2024-01-15T10:00:00Z',
    related_user_id: 2,
    related_user: {
      id: 2,
      username: 'alice',
      display_name: 'Alice Smith',
      profile_image: null,
    },
    related_conversation_id: null,
  },
  {
    id: 2,
    type: 'collaboration_invite',
    title: 'Collaboration Invite',
    message: 'Bob invited you to collaborate on a conversation',
    is_read: true,
    created_at: '2024-01-14T15:30:00Z',
    related_user_id: 3,
    related_user: {
      id: 3,
      username: 'bob',
      display_name: 'Bob Johnson',
      profile_image: null,
    },
    related_conversation_id: 123,
  },
  {
    id: 3,
    type: 'new_conversation',
    title: 'New Conversation',
    message: 'Someone mentioned you in a conversation',
    is_read: false,
    created_at: '2024-01-13T09:45:00Z',
    related_user_id: null,
    related_user: null,
    related_conversation_id: 456,
  },
];

const mockApiResponse: NotificationListResponse = {
  notifications: mockNotifications,
  total: 3,
  page: 1,
  per_page: 20,
  has_next: false,
  has_prev: false,
};

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.getNotifications as any).mockResolvedValue(mockApiResponse);
  });

  describe('Initial Load', () => {
    it('should render page title and loading state initially', async () => {
      // Make the API call take some time to see loading state
      (apiClient.getNotifications as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockApiResponse), 100))
      );

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Loading notifications...')).toBeInTheDocument();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading notifications...')).not.toBeInTheDocument();
      });
    });

    it('should fetch and display notifications on mount', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(apiClient.getNotifications).toHaveBeenCalledWith(1, 20, false);
      });

      await waitFor(() => {
        expect(screen.getByText('New Follower')).toBeInTheDocument();
        expect(screen.getByText('Alice started following you')).toBeInTheDocument();
        expect(screen.getByText('Collaboration Invite')).toBeInTheDocument();
        expect(screen.getByText('New Conversation')).toBeInTheDocument();
      });
    });

    it('should show empty state when no notifications', async () => {
      (apiClient.getNotifications as any).mockResolvedValue({
        ...mockApiResponse,
        notifications: [],
        total: 0,
      });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument();
        expect(screen.getByText('When you receive notifications, they will appear here.')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should have filter tabs for All and Unread', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Unread')).toBeInTheDocument();
      });
    });

    it('should filter notifications when Unread tab is clicked', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Unread'));
      });
      
      await waitFor(() => {
        expect(apiClient.getNotifications).toHaveBeenCalledTimes(2);
        expect(apiClient.getNotifications).toHaveBeenLastCalledWith(1, 20, true);
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    it('should show Mark All as Read button when there are unread notifications', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Mark All as Read')).toBeInTheDocument();
      });
    });

    it('should mark individual notification as read when clicked', async () => {
      (apiClient.markNotificationRead as any).mockResolvedValue({ message: 'Success' });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('New Follower')).toBeInTheDocument();
      });

      // Click on unread notification
      const unreadNotification = screen.getByText('New Follower').closest('[data-testid="notification-item"]');
      expect(unreadNotification).toBeInTheDocument();
      
      await act(async () => {
        fireEvent.click(unreadNotification!);
      });
      
      await waitFor(() => {
        expect(apiClient.markNotificationRead).toHaveBeenCalledWith(1);
      });
    });

    it('should mark all notifications as read when Mark All as Read is clicked', async () => {
      (apiClient.markAllNotificationsRead as any).mockResolvedValue({ message: 'Success' });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Mark All as Read')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Mark All as Read'));
      });
      
      await waitFor(() => {
        expect(apiClient.markAllNotificationsRead).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete option in notification dropdown menu', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('New Follower')).toBeInTheDocument();
      });

      // Click on more options button
      const moreButtons = screen.getAllByTestId('more-icon');
      await act(async () => {
        fireEvent.click(moreButtons[0]);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('should delete notification when delete is clicked', async () => {
      (apiClient.deleteNotification as any).mockResolvedValue({ message: 'Success' });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('New Follower')).toBeInTheDocument();
      });

      // Click on more options button and then delete
      const moreButtons = screen.getAllByTestId('more-icon');
      await act(async () => {
        fireEvent.click(moreButtons[0]);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });
      
      await waitFor(() => {
        expect(apiClient.deleteNotification).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Pagination', () => {
    it('should show pagination when there are more notifications', async () => {
      (apiClient.getNotifications as any).mockResolvedValue({
        ...mockApiResponse,
        total: 25,
        has_next: true,
      });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });
    });

    it('should load next page when Next button is clicked', async () => {
      (apiClient.getNotifications as any).mockResolvedValue({
        ...mockApiResponse,
        total: 25,
        has_next: true,
      });

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Next'));
      });
      
      await waitFor(() => {
        expect(apiClient.getNotifications).toHaveBeenCalledWith(2, 20, false);
      });
    });
  });

  describe('Notification Types and Icons', () => {
    it('should display correct icons for different notification types', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user-icon')).toBeInTheDocument(); // follow
        expect(screen.getByTestId('users-icon')).toBeInTheDocument(); // collaboration_invite
        expect(screen.getByTestId('message-icon')).toBeInTheDocument(); // new_conversation
      });
    });

    it('should show unread indicator for unread notifications', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        // Should have unread indicators for notifications with is_read: false
        const unreadIndicators = screen.getAllByTestId('unread-indicator');
        expect(unreadIndicators).toHaveLength(2); // notifications 1 and 3 are unread
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (apiClient.getNotifications as any).mockRejectedValue(new Error('API Error'));

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
      });
    });

    it('should handle mark as read errors gracefully', async () => {
      (apiClient.markNotificationRead as any).mockRejectedValue(new Error('API Error'));

      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('New Follower')).toBeInTheDocument();
      });

      const unreadNotification = screen.getByText('New Follower').closest('[data-testid="notification-item"]');
      await act(async () => {
        fireEvent.click(unreadNotification!);
      });
      
      // Should show error toast (mocked)
      await waitFor(() => {
        expect(apiClient.markNotificationRead).toHaveBeenCalled();
      });
    });
  });

  describe('Time Formatting', () => {
    it('should display relative time for notifications', async () => {
      await act(async () => {
        render(<NotificationsPage />);
      });
      
      await waitFor(() => {
        // Should show relative time like "2d ago", etc.
        expect(screen.getByText(/ago/)).toBeInTheDocument();
      });
    });
  });
});