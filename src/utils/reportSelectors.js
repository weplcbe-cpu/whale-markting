const normalizedStatus = (value) => String(value || '').trim().toLowerCase();

const REVIEWED_REPORT_STATUSES = new Set(['approved', 'reviewed', 'closed']);
const CLOSED_FOLLOW_UP_STATUSES = new Set(['completed', 'cancelled', 'closed']);

export const getPendingVisitReports = (reports = []) => reports.filter((report) => {
  const reviewStatus = normalizedStatus(report.reviewStatus || report.status);
  return !reviewStatus || !REVIEWED_REPORT_STATUSES.has(reviewStatus);
});

export const getPendingDailyReports = (reports = []) => reports.filter((report) => {
  const status = normalizedStatus(report.status);
  return !status || !REVIEWED_REPORT_STATUSES.has(status) && status !== 'completed';
});

// Pending follow-ups include overdue, due-today, and future work. Only terminal
// statuses are excluded, so the dashboard and default Director page stay equal.
export const getPendingFollowUps = (followUps = []) => followUps.filter(
  (followUp) => !CLOSED_FOLLOW_UP_STATUSES.has(normalizedStatus(followUp.status))
);
