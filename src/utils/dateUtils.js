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
