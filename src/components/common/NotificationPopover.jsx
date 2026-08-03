import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarCheck,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquare,
  X,
} from 'lucide-react';

const notificationKind = (notification) => {
  const value = `${notification?.type || ''} ${notification?.title || ''}`.toLowerCase();
  if (value.includes('follow')) return 'followUp';
  if (value.includes('comment') || value.includes('feedback')) return 'comment';
  if (value.includes('daily') && value.includes('report')) return 'dailyReport';
  if (value.includes('visit') && value.includes('report')) return 'visitReport';
  if (value.includes('report')) return 'visitReport';
  if (value.includes('plan') && (value.includes('updated') || value.includes('review'))) return 'planUpdated';
  if (value.includes('plan') || value.includes('visit')) return 'visitPlan';
  return 'system';
};

const TITLES = {
  visitPlan: 'Visit Plan Submitted',
  visitReport: 'Visit Report Submitted',
  dailyReport: 'Daily Report Submitted',
  followUp: 'Follow-up Due',
  comment: 'Director Comment',
  planUpdated: 'Plan Updated',
  system: 'System Alert',
};

const ICONS = {
  visitPlan: CalendarCheck,
  visitReport: FileText,
  dailyReport: FileText,
  followUp: Clock3,
  comment: MessageSquare,
  planUpdated: CalendarCheck,
  system: AlertCircle,
};

const timestampValue = (notification) => notification?.createdAt || notification?.timestamp || '';

const formatTimestamp = (notification) => {
  const value = timestampValue(notification);
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
  return `${day} • ${time}`;
};

const notificationMeta = (notification) => [
  notification?.employeeName,
  notification?.organizationName || notification?.customerName,
].filter(Boolean).join(' • ');

const newestFirst = (left, right) => {
  const leftTime = new Date(timestampValue(left)).getTime() || 0;
  const rightTime = new Date(timestampValue(right)).getTime() || 0;
  return rightTime - leftTime;
};

export const NotificationPopover = ({
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onOpenNotification,
  onViewAll,
  bellRef,
}) => {
  const [filter, setFilter] = useState('all');
  const popoverRef = useRef(null);

  const rows = useMemo(() => {
    const unique = Array.from(new Map(notifications.map((item) => [item.id, item])).values());
    return unique
      .sort(newestFirst)
      .filter((item) => filter === 'all' || !item.isRead)
      .slice(0, 5);
  }, [filter, notifications]);

  const close = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => bellRef.current?.focus());
  }, [bellRef, onClose]);

  useEffect(() => {
    const container = popoverRef.current;
    if (!container) return undefined;
    container.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...container.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  const markAllRead = async () => {
    await Promise.all(notifications.filter((item) => !item.isRead).map((item) => onMarkRead(item.id)));
  };

  return (
    <>
      <button type="button" className="notification-sheet-backdrop" aria-label="Close notifications" onClick={close} />
      <section
        ref={popoverRef}
        className="notification-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-popover-title"
        tabIndex={-1}
      >
        <header className="notification-popover__header">
          <h2 id="notification-popover-title">Notifications</h2>
          <span className="notification-unread-count">{unreadCount} Unread</span>
          <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={!unreadCount}>
            Mark all as read
          </button>
          <button type="button" className="notification-close" aria-label="Close notifications" onClick={close}>
            <X size={18} />
          </button>
        </header>

        <div className="notification-filters" role="tablist" aria-label="Filter notifications">
          {['all', 'unread'].map((value) => (
            <button
              type="button"
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? 'selected' : ''}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>

        <div className="notification-list" aria-live="polite">
          {!rows.length ? (
            <div className="notification-empty">
              <span><Bell size={22} /></span>
              <strong>{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</strong>
              <p>{filter === 'unread' ? 'You’re all caught up.' : 'New updates will appear here.'}</p>
            </div>
          ) : rows.map((notification) => {
            const kind = notificationKind(notification);
            const Icon = ICONS[kind];
            const dateTime = formatTimestamp(notification);
            const meta = notificationMeta(notification);
            return (
              <button
                type="button"
                className={`notification-row${notification.isRead ? '' : ' notification-row--unread'}`}
                key={notification.id}
                aria-label={`${TITLES[kind]}. ${notification.message || ''}`}
                onClick={() => onOpenNotification(notification, kind)}
              >
                <span className="notification-row__icon"><Icon size={19} /></span>
                <span className="notification-row__content">
                  <strong>{TITLES[kind]}</strong>
                  {notification.message && <span className="notification-row__message">{notification.message}</span>}
                  {meta && <span className="notification-row__meta">{meta}</span>}
                  {dateTime && <time dateTime={timestampValue(notification)}>{dateTime}</time>}
                </span>
                <span className="notification-row__tail">
                  {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
                  <ChevronRight size={17} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>

        <footer className="notification-popover__footer">
          <button type="button" onClick={onViewAll}>View All Notifications <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </>
  );
};

export default NotificationPopover;
