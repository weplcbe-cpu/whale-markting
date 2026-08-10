import { normalizePlanStatus } from './planStatus';

export const getVisitExecutionState = (visit, now = Date.now()) => {
  const status = normalizePlanStatus(visit?.status);
  if (status !== 'In Progress') {
    if (['Submitted', 'Planned', 'Approved', 'Rescheduled'].includes(status)) {
      const current = new Date(now);
      const today = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const visitDate = String(visit?.visitDate || visit?.visit_date || '').slice(0, 10);
      if (visitDate > today) return 'Upcoming';
      if (visitDate === today) return 'Today';
      return 'Scheduled';
    }
    return status;
  }
  const deadline = new Date(visit?.closeDeadline || visit?.close_deadline).getTime();
  return Number.isFinite(deadline) && now > deadline ? 'Closure Overdue' : 'In Progress';
};

export const formatVisitTimer = (visit, now = Date.now()) => {
  const deadline = new Date(visit?.closeDeadline || visit?.close_deadline).getTime();
  if (!Number.isFinite(deadline)) return 'Closure deadline unavailable';
  const difference = deadline - now;
  const totalMinutes = Math.floor(Math.abs(difference) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return difference < 0 ? `${hours}h ${minutes}m overdue` : `${hours}h ${minutes}m remaining`;
};

export const formatVisitDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString([], {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};
