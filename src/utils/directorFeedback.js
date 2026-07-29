const LEGACY_SYSTEM_MESSAGES = new Set([
  'approve',
  'approved',
  'reject',
  'rejected',
  'request changes',
  'changes requested',
  'tour plan rejected',
  'tour plan approved',
  'awaiting approval',
  'submitted for approval',
]);

const normalizeTargetType = (value) => {
  const type = String(value || 'General').trim();
  const aliases = {
    'Visit Plans': 'Visit Plan',
    'Tour Plans': 'Tour Plan',
    'Visit Reports': 'Visit Report',
    'Daily Reports': 'Daily Report',
    'Follow-ups': 'Follow-up',
    Tenders: 'Tender',
  };
  return aliases[type] || type;
};

export const normalizeDirectorFeedback = (row = {}) => {
  const rawMessage = String(row.message || row.comment || '').trim();
  const isLegacySystemMessage = LEGACY_SYSTEM_MESSAGES.has(rawMessage.toLowerCase());
  const targetType = normalizeTargetType(row.targetType || row.targetModule);
  return {
    ...row,
    id: row.id,
    directorId: row.directorId || null,
    directorName: row.directorName || row.author || 'Director',
    targetType,
    targetId: row.targetId || row.referenceId || null,
    targetTitle: row.targetTitle || `${targetType} feedback`,
    message: isLegacySystemMessage ? 'Legacy Review Note' : rawMessage,
    commentType: isLegacySystemMessage
      ? 'Director Review Update'
      : row.commentType || 'General Comment',
    createdAt: row.createdAt,
    isRead: Boolean(row.isRead),
    readAt: row.readAt || null,
    employeeId: row.employeeId || row.targetEmployeeId || null,
    targetEmployeeName: row.targetEmployeeName || null,
    isLegacy: isLegacySystemMessage,
  };
};

export const normalizeDirectorFeedbackList = (rows = []) => {
  const seenIds = new Set();
  const seenFallbacks = new Set();
  return rows
    .map(normalizeDirectorFeedback)
    .filter((feedback) => {
      if (feedback.id) {
        if (seenIds.has(feedback.id)) return false;
        seenIds.add(feedback.id);
        return true;
      }
      const fallback = [
        feedback.targetType,
        feedback.targetId,
        feedback.createdAt,
        feedback.message,
      ].join('|');
      if (seenFallbacks.has(fallback)) return false;
      seenFallbacks.add(fallback);
      return true;
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const directorFeedbackRoute = (feedback) => {
  const id = encodeURIComponent(feedback.targetId || '');
  switch (feedback.targetType) {
    case 'Tour Plan':
      return '/marketing/visits?view=weekly';
    case 'Visit Plan':
      return `/marketing/visits?view=plans&planId=${id}`;
    case 'Visit Report':
      return `/marketing/reports?reportId=${id}`;
    case 'Daily Report':
      return `/marketing/reports?view=daily&reportId=${id}`;
    case 'Follow-up':
      return `/marketing/follow-ups?followUpId=${id}`;
    case 'Tender':
      return `/marketing/tenders?tenderId=${id}`;
    default:
      return null;
  }
};

export const isLegacyApprovalNotification = (notification) => {
  const text = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  return [
    'tour plan rejected',
    'tour plan approved',
    'request changes',
    'changes requested',
    'awaiting approval',
    'submitted for approval',
    'director approval',
  ].some((phrase) => text.includes(phrase));
};
