const isEmpty = (value) => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0);

const parseDate = (value) => {
  if (isEmpty(value)) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const hasDisplayValue = (value) => !isEmpty(value);
export const formatEmptyValue = (value) => isEmpty(value) ? '—' : Array.isArray(value) ? value.join(', ') : String(value).trim();
export const formatMetric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const formatBoolean = (value, type = 'yesNo') => {
  const labels = { locked: ['Locked', 'Unlocked'], active: ['Active', 'Inactive'], required: ['Required', 'Not required'], yesNo: ['Yes', 'No'] };
  return (labels[type] || labels.yesNo)[value ? 0 : 1];
};
export const formatDisplayDate = (value) => {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : '—';
};
export const formatDisplayDateTime = (value) => {
  const date = parseDate(value);
  if (!date) return '—';
  return `${formatDisplayDate(date)} • ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date)}`;
};
export const formatProducts = (products) => Array.isArray(products) ? products.filter(hasDisplayValue) : hasDisplayValue(products) ? [products] : [];
export const formatLocation = (...parts) => [...new Set(parts.filter(hasDisplayValue).map((part) => String(part).trim()))].join(', ') || '—';
export const truncateReference = (id) => {
  const value = formatEmptyValue(id);
  return value === '—' || value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-7)}`;
};
export const formatFieldLabel = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
