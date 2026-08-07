const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  if (typeof value === 'string') {
    const legacyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (legacyMatch) {
      const [, day, month, year, hourRaw, minute, meridiem] = legacyMatch;
      let hour = Number(hourRaw) % 12;
      if (String(meridiem).toUpperCase() === 'PM') hour += 12;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

export const notificationTimestamp = (notification) => {
  const parsed = parseDateSafe(notification?.createdAt || notification?.created_at || notification?.updatedAt || notification?.updated_at || notification?.timestamp);
  return parsed ? parsed.getTime() : 0;
};

export const isActiveNotification = (notification, now = Date.now()) => {
  const createdAt = notificationTimestamp(notification);
  if (!createdAt) return false;
  return now - createdAt < DAY_IN_MS;
};

export const filterActiveNotifications = (notifications, now = Date.now()) => (
  (Array.isArray(notifications) ? notifications : []).filter((item) => isActiveNotification(item, now))
);

export const getNotificationRoute = (notification, role) => {
  const text = `${notification?.type || ''} ${notification?.title || ''}`.toLowerCase();
  const reference = notification?.referenceId || notification?.reference_id;

  if (role === 'Marketing Team') {
    if (text.includes('comment') || text.includes('director_feedback') || text.includes('director feedback')) {
      return `/marketing/director-comments${reference ? `?feedbackId=${encodeURIComponent(reference)}` : ''}`;
    }
    if (text.includes('report')) return '/marketing/reports';
    return '/marketing/visits';
  }

  if (role === 'Admin') {
    if (text.includes('user') || text.includes('employee')) return '/admin/users';
    return '/admin/reports';
  }

  if (text.includes('new visit plan submitted') || (text.includes('visit') && text.includes('plan'))) {
    return `/director/visit-plans${reference ? `?planId=${encodeURIComponent(reference)}` : ''}`;
  }
  if (text.includes('daily') && text.includes('report')) {
    return `/director/daily-reports${reference ? `?reportId=${encodeURIComponent(reference)}` : ''}`;
  }
  if (text.includes('visit') && text.includes('report')) {
    return `/director/visit-reports${reference ? `?reportId=${encodeURIComponent(reference)}` : ''}`;
  }
  if (text.includes('follow')) {
    return `/director/follow-ups${reference ? `?followUpId=${encodeURIComponent(reference)}` : ''}`;
  }
  if (text.includes('comment') || text.includes('feedback')) {
    return `/director/comments${reference ? `?commentId=${encodeURIComponent(reference)}` : ''}`;
  }
  if (text.includes('plan')) return '/director/tour-plans';
  return '/director/notifications';
};


