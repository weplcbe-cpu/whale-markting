const PLAN_STATUS_MAP = {
  submitted: 'Submitted',
  'submitted for approval': 'Submitted',
  'submitted for director approval': 'Submitted',
  pending: 'Submitted',
  'pending approval': 'Submitted',
  pendingapproval: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  'changes requested': 'Changes Requested',
  draft: 'Draft',
  planned: 'Planned',
  started: 'Started',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled'
};

export const normalizePlanStatus = (status) => {
  const value = String(status || '').trim();
  return PLAN_STATUS_MAP[value.toLowerCase()] || value || 'Draft';
};

export const inferPlanType = (plan) => {
  if (plan?.planType === 'Monthly' || plan?.planType === 'Weekly') return plan.planType;
  if (!plan?.periodFrom || !plan?.periodTo) return 'Weekly';
  const from = new Date(`${plan.periodFrom}T00:00:00`);
  const to = new Date(`${plan.periodTo}T00:00:00`);
  return (to - from) / 86400000 > 7 ? 'Monthly' : 'Weekly';
};

export const isSubmittedPlan = (plan) => normalizePlanStatus(plan?.status) === 'Submitted';

export const isPendingPlan = isSubmittedPlan;

export const getTourPlanBatchId = (plan) =>
  plan?.planBatchId ??
  plan?.plan_batch_id ??
  plan?.batchId ??
  plan?.batch_id ??
  null;
