import { normalizePlanStatus } from './planStatus.js';

export const WEEKLY_VISIT_PLAN_DRAFT_KEY = 'marketing-weekly-plan-draft';
export const MONTHLY_VISIT_PLAN_DRAFT_KEY = 'marketing-next-month-plan-draft';

const DATABASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isDatabaseVisitPlanId = (value) => DATABASE_ID_PATTERN.test(String(value || ''));

export const isUnsavedVisitPlanDraft = (row) =>
  Boolean(row) &&
  !row.databaseId &&
  !isDatabaseVisitPlanId(row.id) &&
  normalizePlanStatus(row.status) === 'Draft';

export const readVisitPlanDraft = (key, defaults = {}) => {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    return {
      ...defaults,
      ...cached,
      rows: Array.isArray(cached?.rows)
        ? cached.rows.filter(isUnsavedVisitPlanDraft)
        : [],
    };
  } catch {
    return { ...defaults, rows: [] };
  }
};

export const writeVisitPlanDraft = (key, rows, metadata = {}) => {
  const unsavedRows = (rows || []).filter(isUnsavedVisitPlanDraft);
  if (unsavedRows.length) {
    localStorage.setItem(key, JSON.stringify({ ...metadata, rows: unsavedRows }));
  } else {
    localStorage.removeItem(key);
  }
};

const identityValues = (value) =>
  new Set([
    value?.id,
    value?.databaseId,
    value?.clientId,
    value?.localId,
    value?.submissionKey,
    value?.submission_key,
  ].filter(Boolean).map(String));

export const removeVisitPlanFromDraftCaches = (target) => {
  if (typeof localStorage === 'undefined') return;
  const targetIds = identityValues(target);
  const targetBatchId = target?.batchId || target?.batch_id;

  [WEEKLY_VISIT_PLAN_DRAFT_KEY, MONTHLY_VISIT_PLAN_DRAFT_KEY].forEach((key) => {
    try {
      const cached = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(cached?.rows)) return;
      const rows = cached.rows.filter((row) => {
        const sameIdentity = [...identityValues(row)].some((id) => targetIds.has(id));
        const sameBatch = Boolean(target?.deleteBatch && targetBatchId &&
          (row.batchId === targetBatchId || row.batch_id === targetBatchId));
        return !sameIdentity && !sameBatch && isUnsavedVisitPlanDraft(row);
      });
      if (rows.length) localStorage.setItem(key, JSON.stringify({ ...cached, rows }));
      else localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  });
};
