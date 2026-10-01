import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Zap,
  Wallet,
  Star,
  CheckCheck,
  ChevronRight,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../../utils/constants.js';
import { notificationService } from '../../services/notificationService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getNotificationMeta = (notification) => {
  const type = notification.type || '';
  switch (type) {
    case 'NEW_MESSAGE':
      return {
        icon: MessageSquare,
        iconBg: 'bg-blue-50 text-blue-600',
        route: notification.data?.chatId ? `/chats/${notification.data.chatId}` : '/chats',
        category: 'Message',
      };
    case 'BOOKING_CONFIRMED':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-50 text-emerald-600',
        route: '/my-bookings',
        category: 'Booking',
      };
    case 'BOOKING_CANCELLED':
      return {
        icon: AlertCircle,
        iconBg: 'bg-rose-50 text-rose-600',
        route: '/my-bookings',
        category: 'Cancellation',
      };
    case 'UPCOMING_SESSION':
    case 'CHARGING_STARTED':
    case 'CHARGING_COMPLETED':
      return {
        icon: Zap,
        iconBg: 'bg-amber-50 text-amber-600',
        route: '/my-bookings',
        category: 'Charging',
      };
    case 'PAYMENT_VERIFIED':
    case 'PAYMENT_CONFIRMED':
      return {
        icon: Wallet,
        iconBg: 'bg-teal-50 text-teal-600',
        route: '/wallet',
        category: 'Payment',
      };
    case 'REVIEW_REMINDER':
      return {
        icon: Star,
        iconBg: 'bg-amber-50 text-amber-600',
        route: '/my-bookings',
        category: 'Review',
      };
    default:
      return {
        icon: Bell,
        iconBg: 'bg-slate-100 text-slate-600',
        route: '/driver/dashboard',
        category: 'Alert',
      };
  }
};

const NotificationDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications();
      const list = res.data?.notifications || [];
      setNotifications(list);
      const count = typeof res.data?.unreadCount === 'number'
        ? res.data.unreadCount
        : list.filter((n) => !n.isRead).length;
      setUnreadCount(count);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?._id) return;
    fetchNotifications();

    // Setup realtime Socket.IO listener for notifications
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('connect', () => {
      socket.emit('register:user', user._id);
    });

    socket.on('notification:received', (newNotif) => {
      if (!newNotif) return;
      setNotifications((prev) => {
        // Prevent duplicates
        const exists = prev.some((n) => String(n._id) === String(newNotif._id));
        if (exists) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off('connect');
      socket.off('notification:received');
      socket.disconnect();
    };
  }, [user?._id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif) => {
    const { route } = getNotificationMeta(notif);
    
    // Mark as read locally and remotely
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.warn('Failed to mark notification read', err);
      }
    }

    setIsOpen(false);
    if (route) {
      navigate(route);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all notifications read', err);
    }
  };

  const displayedNotifications = showAll ? notifications : notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-evsathi-slate hover:text-evsathi-dark hover:bg-evsathi-soft/40 transition-colors focus:outline-none"
        aria-label="Notifications"
        title="Driver Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-evsathi-mint/40 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2 flex items-center justify-between border-b border-evsathi-soft/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-evsathi-dark uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-evsathi-teal hover:text-teal-700 flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500 font-medium">
                No new notifications
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const meta = getNotificationMeta(notif);
                const IconComponent = meta.icon;
                const isUnread = !notif.isRead;

                return (
                  <button
                    key={notif._id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                      isUnread ? 'bg-teal-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    {/* Notification Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread Indicator */}
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0 mt-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 5 && (
            <div className="pt-2 pb-1 px-4 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-xs font-semibold text-evsathi-teal hover:text-teal-700 flex items-center gap-1 transition-colors py-1"
              >
                <span>{showAll ? 'Show fewer' : 'View all notifications'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-90' : ''}`} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
