export const getLocalDateKey = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeDateKey = (value) => {
  if (value instanceof Date) return getLocalDateKey(value);
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const standardMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (standardMatch) return `${standardMatch[1]}-${standardMatch[2]}-${standardMatch[3]}`;

  const legacyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (legacyMatch) return `${legacyMatch[3]}-${legacyMatch[2]}-${legacyMatch[1]}`;

  return null;
};

export const formatSafeDate = (inputDate) => {
  if (!inputDate) return 'Date unavailable';

  try {
    let dateObj;

    if (inputDate instanceof Date) {
      dateObj = inputDate;
    } else if (typeof inputDate === 'number') {
      dateObj = new Date(inputDate);
    } else if (typeof inputDate === 'string') {
      const trimmed = inputDate.trim();
      if (!trimmed) return 'Date unavailable';

      // Parse standard date or ISO string
      dateObj = new Date(trimmed);

      // Fallback for custom string formats like DD-MM-YYYY
      if (isNaN(dateObj.getTime())) {
        const datePart = trimmed.split(/[\sT]+/)[0];
        const parts = datePart.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length <= 2 && parts[2].length === 4) {
            dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else if (parts[0].length === 4) {
            dateObj = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
          }
        }
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Date unavailable';
    }

    const year = dateObj.getFullYear();
    if (year < 2000 || year > 2100) {
      return 'Date unavailable';
    }

    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Date unavailable';
  }
};

/**
 * Safely resolves the first valid timestamp from an update item and formats it as:
 * "31 Jul 2026, 10:45 AM" or "31 Jul 2026".
 * If no valid timestamp exists, returns null (hides date instead of displaying fallback text).
 */
export const formatUpdateDate = (update) => {
  if (!update) return null;

  // Extract candidate timestamp fields in order of priority (both camelCase and snake_case)
  const candidate =
    update.createdAt ||
    update.created_at ||
    update.updatedAt ||
    update.updated_at ||
    update.submittedAt ||
    update.submitted_at ||
    update.visitDate ||
    update.visit_date ||
    update.reportDate ||
    update.report_date ||
    update.followUpDate ||
    update.follow_up_date ||
    update.timestamp ||
    update.date ||
    (typeof update === 'string' || typeof update === 'number' || update instanceof Date ? update : null);

  if (!candidate) return null;

  try {
    let dateObj;

    if (candidate instanceof Date) {
      dateObj = candidate;
    } else if (typeof candidate === 'number') {
      dateObj = new Date(candidate);
    } else if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) return null;

      dateObj = new Date(trimmed);

      if (isNaN(dateObj.getTime())) {
        const datePart = trimmed.split(/[\sT]+/)[0];
        const parts = datePart.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length <= 2 && parts[2].length === 4) {
            dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else if (parts[0].length === 4) {
            dateObj = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
          }
        }
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return null;
    }

    const year = dateObj.getFullYear();
    if (year < 2000 || year > 2100) {
      return null;
    }

    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();

    if (hours !== 0 || minutes !== 0 || seconds !== 0) {
      const formattedTime = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${formattedDate}, ${formattedTime}`;
    }

    return formattedDate;
  } catch {
    return null;
  }
};
