import React, { useEffect, useMemo, useRef } from 'react';
import { BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const AUTO_CLOSE_MS = 7000;

export const RealtimeNotificationToasts = () => {
  const navigate = useNavigate();
  const {
    realtimeNotifications,
    dismissRealtimeNotification,
    markNotificationRead,
    openNotificationTarget,
  } = useApp();

  const timersRef = useRef(new Map());

  const visibleRows = useMemo(() => (realtimeNotifications || []).slice(0, 3), [realtimeNotifications]);

  useEffect(() => {
    visibleRows.forEach((notification) => {
      if (timersRef.current.has(notification.id)) return;
      const timer = window.setTimeout(() => {
        dismissRealtimeNotification(notification.id);
        timersRef.current.delete(notification.id);
      }, AUTO_CLOSE_MS);
      timersRef.current.set(notification.id, timer);
    });

    const visibleIds = new Set(visibleRows.map((notification) => String(notification.id)));
    timersRef.current.forEach((timer, id) => {
      if (!visibleIds.has(String(id))) {
        window.clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });

    return undefined;
  }, [dismissRealtimeNotification, visibleRows]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    const handler = async (event) => {
      const notification = event.detail?.notification;
      const path = event.detail?.path;
      if (!notification || !path) return;
      if (notification.id && !String(notification.id).startsWith('local-test-')) {
        await markNotificationRead(notification.id);
      }
      navigate(path);
      if (notification.id) dismissRealtimeNotification(notification.id);
    };
    window.addEventListener('kw:open-notification', handler);
    return () => {
      window.removeEventListener('kw:open-notification', handler);
    };
  }, [dismissRealtimeNotification, markNotificationRead, navigate]);

  const viewNotification = (notification) => {
    if (!notification) return;
    openNotificationTarget(notification);
  };

  if (!visibleRows.length) return null;

  return (
    <div className="kw-realtime-toast-stack" role="status" aria-live="polite" aria-label="Realtime notifications">
      {visibleRows.map((notification) => (
        <article key={notification.id} className="kw-realtime-toast">
          <div className="kw-realtime-toast__icon" aria-hidden="true"><BellRing size={18} /></div>
          <div className="kw-realtime-toast__content">
            <strong>{notification.title || 'New Notification'}</strong>
            <p>{notification.message || 'You have a new update.'}</p>
            <div className="kw-realtime-toast__actions">
              <button type="button" onClick={() => viewNotification(notification)}>View</button>
              <button type="button" onClick={() => dismissRealtimeNotification(notification.id)}>Dismiss</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default RealtimeNotificationToasts;
