import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationBell } from '@/components/NotificationBell';
import { apiClient } from '@/lib/api';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    getNotificationStats: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  }
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification bell with zero count initially', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 0,
      total_count: 5,
    });

    await act(async () => {
      render(<NotificationBell />);
    });
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument(); // Zero count should be hidden
  });

  it('displays unread count badge when there are notifications', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 3,
      total_count: 5,
    });

    render(<NotificationBell />);
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('opens notification dropdown when clicked', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 2,
      total_count: 2,
    });
    
    vi.mocked(apiClient.getNotifications).mockResolvedValue({
      notifications: [
        {
          id: 1,
          type: 'follow',
          title: 'New Follower',
          message: 'Alice started following you',
          is_read: false,
          created_at: '2024-01-01T10:00:00Z',
          related_user: {
            id: 2,
            username: 'alice',
            display_name: 'Alice',
          }
        }
      ],
      total: 1,
      page: 1,
      per_page: 10,
      has_next: false,
      has_prev: false,
    });

    render(<NotificationBell />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('New Follower')).toBeInTheDocument();
      expect(screen.getByText('Alice started following you')).toBeInTheDocument();
    });
  });

  it('marks notification as read when clicked', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 1,
      total_count: 1,
    });
    
    vi.mocked(apiClient.getNotifications).mockResolvedValue({
      notifications: [
        {
          id: 1,
          type: 'follow',
          title: 'New Follower',
          message: 'Alice started following you',
          is_read: false,
          created_at: '2024-01-01T10:00:00Z',
        }
      ],
      total: 1,
      page: 1,
      per_page: 10,
      has_next: false,
      has_prev: false,
    });

    vi.mocked(apiClient.markNotificationRead).mockResolvedValue({});

    render(<NotificationBell />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      const notification = screen.getByText('New Follower');
      fireEvent.click(notification);
    });

    expect(apiClient.markNotificationRead).toHaveBeenCalledWith(1);
  });

  it('shows mark all as read button when there are unread notifications', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 3,
      total_count: 3,
    });
    
    vi.mocked(apiClient.getNotifications).mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      per_page: 10,
      has_next: false,
      has_prev: false,
    });

    render(<NotificationBell />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });
  });

  it('handles mark all as read action', async () => {
    vi.mocked(apiClient.getNotificationStats).mockResolvedValue({
      unread_count: 2,
      total_count: 2,
    });
    
    vi.mocked(apiClient.getNotifications).mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      per_page: 10,
      has_next: false,
      has_prev: false,
    });

    vi.mocked(apiClient.markAllNotificationsRead).mockResolvedValue({});

    render(<NotificationBell />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      const markAllButton = screen.getByText('Mark all as read');
      fireEvent.click(markAllButton);
    });

    expect(apiClient.markAllNotificationsRead).toHaveBeenCalled();
  });
});