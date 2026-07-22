import React from 'react';
import { Award } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, DataTable, EmptyState, PageHeader, SectionCard } from '../ui';
import { AnalyticsTabs } from './AnalyticsTabs';

export const PerformanceAnalytics = () => {
  const { users, visitPlans, visitReports, dailyReports, customers, followUps, tenders } = useApp();
  const marketingReps = users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active');
  const rows = marketingReps.map((rep) => {
    const plans = visitPlans.filter((item) => item.employeeId === rep.employeeId);
    const completed = plans.filter((item) => item.status === 'Completed').length;
    const cancelled = plans.filter((item) => item.status === 'Cancelled').length;
    const reports = [...visitReports, ...dailyReports].filter((item) => item.employeeId === rep.employeeId).length;
    const employeeFollowUps = followUps.filter((item) => item.employeeId === rep.employeeId);
    const completedFollowUps = employeeFollowUps.filter((item) => item.status === 'Completed').length;
    const newCustomers = customers.filter((item) => item.employeeId === rep.employeeId || item.createdByEmployeeId === rep.employeeId).length;
    const quotations = visitReports.filter((item) => item.employeeId === rep.employeeId && item.isQuotationRequired).length;
    const opportunities = tenders.filter((item) => item.assignedEmployeeId === rep.employeeId).length;
    const pending = plans.filter((item) => !['Completed', 'Cancelled'].includes(item.status)).length + employeeFollowUps.filter((item) => item.status !== 'Completed').length;
    const completionRate = plans.length ? completed / plans.length * 100 : 0;
    const reportRate = plans.length ? Math.min(100, reports / plans.length * 100) : 0;
    const followUpRate = employeeFollowUps.length ? completedFollowUps / employeeFollowUps.length * 100 : 0;
    const opportunityScore = Math.min(100, (newCustomers + quotations + opportunities) * 12.5);
    const score = Math.max(0, Math.min(100, Math.round(completionRate * .35 + reportRate * .25 + followUpRate * .2 + opportunityScore * .2 - Math.min(15, pending * 2))));
    return { id: rep.id, employee: rep.fullName || rep.username || 'Not provided', employeeId: rep.employeeId, plans: plans.length, completed, cancelled, reports, completedFollowUps, newCustomers, quotations, opportunities, pending, score };
  });

  return <div className="ds-page"><PageHeader title="Analytics" description="Balanced, live Marketing performance indicators." /><AnalyticsTabs /><SectionCard title="Marketing Team Performance" description="Score = visit completion 35% + report submission 25% + follow-up completion 20% + new opportunities 20%, with a pending-work deduction." actions={<span className="analytics-formula-info" title="The score combines visit completion, reports, follow-ups, new customers, quotation requirements, tender opportunities, and pending work." aria-label="Performance score formula information">ⓘ Formula</span>}><DataTable rows={rows} columns={[{ key: 'employee', label: 'Employee', render: (row) => <><strong>{row.employee}</strong><small>{row.employeeId}</small></> }, { key: 'plans', label: 'Total Plans' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'reports', label: 'Reports' }, { key: 'completedFollowUps', label: 'Follow-ups' }, { key: 'newCustomers', label: 'Customers' }, { key: 'opportunities', label: 'Tenders' }, { key: 'pending', label: 'Pending' }, { key: 'score', label: 'Score', render: (row) => <Badge tone={row.score >= 80 ? 'success' : row.score >= 60 ? 'warning' : 'danger'}>{row.score} / 100</Badge> }]} empty={<EmptyState icon={Award} title="No Marketing performance data" />} /></SectionCard></div>;
};

export default PerformanceAnalytics;
