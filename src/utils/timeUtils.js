const TWELVE_HOUR_TIME = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;
const TWENTY_FOUR_HOUR_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const to24HourTime = (value) => {
  const time = String(value || '').trim();
  if (TWENTY_FOUR_HOUR_TIME.test(time)) return time;

  const match = time.match(TWELVE_HOUR_TIME);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();
  const hour24 = period === 'AM' ? hour % 12 : (hour % 12) + 12;
  return `${String(hour24).padStart(2, '0')}:${minute}`;
};

export const to12HourTime = (value) => {
  const time = String(value || '').trim();
  const twelveHourMatch = time.match(TWELVE_HOUR_TIME);
  if (twelveHourMatch) return `${twelveHourMatch[1].padStart(2, '0')}:${twelveHourMatch[2]} ${twelveHourMatch[3].toUpperCase()}`;

  const twentyFourHourMatch = time.match(TWENTY_FOUR_HOUR_TIME);
  if (!twentyFourHourMatch) return '';

  const hour24 = Number(twentyFourHourMatch[1]);
  const hour = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${String(hour).padStart(2, '0')}:${twentyFourHourMatch[2]} ${period}`;
};