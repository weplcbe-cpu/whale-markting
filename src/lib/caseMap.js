// Generic snake_case <-> camelCase converters for mapping Supabase rows
// (snake_case columns) to the camelCase object shape the rest of the app
// already expects (matching the original mock data shape), and back again
// when writing to the database. Only top-level keys are converted — nested
// jsonb fields (e.g. rescheduleHistory, replies) are already authored in
// camelCase by the app and are passed through untouched.

const snakeToCamel = (str) => str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const camelToSnake = (str) => str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export const rowToCamel = (row) => {
  if (!row) return row;
  const out = {};
  for (const key of Object.keys(row)) {
    out[snakeToCamel(key)] = row[key];
  }
  return out;
};

export const rowsToCamel = (rows) => (rows || []).map(rowToCamel);

export const objToSnakeRow = (obj) => {
  if (!obj) return obj;
  const out = {};
  for (const key of Object.keys(obj)) {
    out[camelToSnake(key)] = obj[key];
  }
  return out;
};
