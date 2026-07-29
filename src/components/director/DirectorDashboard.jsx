import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, CheckCircle2, Clock, FileText, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, EmptyState, PageHeader, SectionCard } from '../ui';
import { getTourPlanBatchId, isPendingPlan, normalizePlanStatus } from '../../utils/planStatus';

const dateValue = (value) => value ? String(value).slice(0, 10) : '';

export const DirectorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, users, visitPlans, visitReports, dailyReports, followUps, tenders, activityLogs, lastUpdated, dataLoading } = useApp();
  const [period, setPeriod] = useState('Today');
  const now = new Date();
  const todayValue = now.toISOString().slice(0, 10);

  const inPeriod = (value) => {
    const normalized = dateValue(value);
    if (!normalized) return false;
    const date = new Date(`${normalized}T00:00:00`);
    if (period === 'Today') return normalized === todayValue;
    if (period === 'This Week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return date >= start && date < end;
    }
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const marketing = users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active');
  const scopedPlans = visitPlans.filter((plan) => inPeriod(plan.visitDate));
  const completedPlans = scopedPlans.filter((plan) => normalizePlanStatus(plan.status) === 'Completed');
  const pendingPlans = scopedPlans.filter((plan) => !['Completed', 'Cancelled', 'Rejected'].includes(normalizePlanStatus(plan.status)));
  const scopedFollowUps = followUps.filter((item) => inPeriod(item.followUpDate));
  const pendingFollowUps = scopedFollowUps.filter((item) => item.status !== 'Completed');
  const scopedReports = dailyReports.filter((report) => inPeriod(report.date || report.reportDate || report.createdAt));
  const pendingReports = scopedReports.filter((report) => !['Approved', 'Completed'].includes(report.status));
  const scopedTenders = tenders.filter((tender) => inPeriod(tender.closingDate || tender.createdAt));
  const tenderOpportunities = scopedTenders.filter((tender) => !['Won', 'Lost'].includes(tender.status));
  const pendingBatches = useMemo(() => [...new Map(visitPlans.filter(isPendingPlan).map((plan) => [getTourPlanBatchId(plan), plan]).filter(([batchId]) => batchId)).values()], [visitPlans]);
  const nameFor = (employeeId, fallback) => fallback || marketing.find((user) => user.employeeId === employeeId)?.fullName || marketing.find((user) => user.employeeId === employeeId)?.username || employeeId || 'Not provided';
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const cards = [
    ['Total Marketing Team', marketing.length, Users, '/director/team'],
    [`${period} Visits`, scopedPlans.length, Calendar, period === 'Today' ? '/director/today-schedule' : '/director/visit-plans'],
    ['Completed Visits', completedPlans.length, CheckCircle2, '/director/visit-reports'],
    ['Pending Visits', pendingPlans.length, Clock, '/director/visit-plans'],
    ['Submitted Plans', pendingBatches.length, FileText, '/director/tour-plans'],
    ['Pending Follow-ups', pendingFollowUps.length, Clock, '/director/follow-ups'],
    ['Pending Reports', pendingReports.length, FileText, '/director/daily-reports'],
    ['Tender Opportunities', tenderOpportunities.length, Building2, '/director/tenders']
  ];

  const pendingActions = [
    ...pendingBatches.map((plan) => ({ id: `plan-${getTourPlanBatchId(plan)}`, type: `${plan.planType || 'Tour'} Plan`, record: nameFor(plan.employeeId, plan.fullName), status: 'Pending Approval', path: `/director/tour-plans/${getTourPlanBatchId(plan)}` })),
    ...pendingReports.map((report) => ({ id: `report-${report.id}`, type: 'Daily Report', record: nameFor(report.employeeId, report.fullName || report.employeeName), status: report.status || 'Pending', path: '/director/daily-reports' })),
    ...pendingFollowUps.filter((item) => dateValue(item.followUpDate) < todayValue).map((item) => ({ id: `followup-${item.id}`, type: 'Overdue Follow-up', record: item.customerName || nameFor(item.employeeId), status: item.priority || 'Overdue', path: '/director/follow-ups' })),
    ...tenderOpportunities.map((tender) => ({ id: `tender-${tender.id}`, type: 'Tender', record: tender.tenderName || tender.tenderNumber, status: tender.status || 'Open', path: '/director/tenders' }))
  ].slice(0, 5);

  const teamRows = marketing.slice(0, 5).map((employee) => {
    const plans = scopedPlans.filter((plan) => plan.employeeId === employee.employeeId);
    return { id: employee.id, employee: employee.fullName || employee.username || 'Not provided', employeeId: employee.employeeId, visits: plans.length, completed: plans.filter((plan) => normalizePlanStatus(plan.status) === 'Completed').length, pending: plans.filter((plan) => !['Completed', 'Cancelled'].includes(normalizePlanStatus(plan.status))).length };
  });
  const recentReports = [...dailyReports.map((item) => ({ ...item, reportType: 'Daily Report' })), ...visitReports.map((item) => ({ ...item, reportType: 'Visit Report' }))].sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt))).slice(0, 5);

  if (dataLoading && !lastUpdated) return <div className="ds-page director-dashboard-final"><div className="director-dashboard-skeleton" aria-label="Loading Director dashboard">{Array.from({ length: 12 }, (_, index) => <div className="ds-skeleton" key={index} />)}</div></div>;

  return <div className="ds-page director-dashboard-final">
    <PageHeader title={`${greeting}, ${currentUser?.fullName || 'Director'}`} description={`${formattedDate} · Last updated ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'when data loads'}`} />
    <div className="director-period-filter" aria-label="Dashboard date range">{['Today', 'This Week', 'This Month'].map((item) => <Button key={item} variant={period === item ? 'primary' : 'secondary'} onClick={() => setPeriod(item)}>{item}</Button>)}</div>
    <div className="stat-grid">{cards.map(([label, value, Icon, path]) => <button type="button" className="stat-card" key={label} onClick={() => navigate(path)}><div className="stat-icon-wrapper blue"><Icon size={22} /></div><div className="stat-content"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div></button>)}</div>

    <SectionCard title="Submitted Plans and Updates" description="Open Marketing submissions in view-only mode" actions={<Button variant="secondary" onClick={() => navigate('/director/tour-plans')}>View All</Button>}><DataTable rows={pendingActions} columns={[{ key: 'type', label: 'Type' }, { key: 'record', label: 'Plan / Report / Follow-up / Tender' }, { key: 'status', label: 'Status', render: (row) => <Badge tone="warning">{row.status}</Badge> }, { key: 'action', label: 'Details', render: (row) => <Button variant="secondary" onClick={() => navigate(row.path)}>View Details</Button> }]} empty={<EmptyState icon={CheckCircle2} title="No submitted plans or updates" description="New Marketing submissions will appear here." />} /></SectionCard>

    <SectionCard title="Today Team Schedule" actions={<Button variant="secondary" onClick={() => navigate('/director/today-schedule')}>View All</Button>}><DataTable rows={visitPlans.filter((plan) => plan.visitDate === todayValue).slice(0, 5)} columns={[{ key: 'employee', label: 'Employee', render: (row) => nameFor(row.employeeId, row.fullName) }, { key: 'time', label: 'Time', render: (row) => row.expectedTime || 'Not provided' }, { key: 'area', label: 'Area', render: (row) => row.area || row.city || row.district || 'Not provided' }, { key: 'customer', label: 'Customer / Organization', render: (row) => row.customerName || row.organizationName || 'General visit' }, { key: 'purpose', label: 'Purpose', render: (row) => row.visitPurpose || 'Not provided' }, { key: 'requirement', label: 'Requirement', render: (row) => row.requirement || 'Not provided' }, { key: 'priority', label: 'Priority', render: (row) => row.priority || 'Medium' }, { key: 'status', label: 'Status', render: (row) => <Badge>{normalizePlanStatus(row.status)}</Badge> }]} empty={<EmptyState icon={Calendar} title="No visits scheduled today" />} /></SectionCard>

    <SectionCard title="Marketing Team" actions={<Button variant="secondary" onClick={() => navigate('/director/team')}>View All</Button>}><DataTable rows={teamRows} columns={[{ key: 'employee', label: 'Employee', render: (row) => <><strong>{row.employee}</strong><small>{row.employeeId}</small></> }, { key: 'visits', label: 'Visits' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'action', label: 'Action', render: () => <Button variant="secondary" onClick={() => navigate('/director/team')}>View</Button> }]} empty={<EmptyState icon={Users} title="No active Marketing employees" />} /></SectionCard>

    <div className="director-dashboard-columns"><SectionCard title="Pending Follow-ups" actions={<Button variant="secondary" onClick={() => navigate('/director/follow-ups')}>View All</Button>}>{pendingFollowUps.slice(0, 5).map((item) => <div className="director-summary-row" key={item.id}><span><strong>{nameFor(item.employeeId, item.fullName || item.employeeName)}</strong><small>{item.customerName || 'Not provided'} · {item.followUpDate || 'No due date'}</small></span><Badge tone="warning">{item.priority || 'Pending'}</Badge></div>)}{!pendingFollowUps.length && <EmptyState icon={Clock} title="No pending follow-ups" />}</SectionCard><SectionCard title="Tender Opportunities" actions={<Button variant="secondary" onClick={() => navigate('/director/tenders')}>View All</Button>}>{tenderOpportunities.slice(0, 5).map((item) => <div className="director-summary-row" key={item.id}><span><strong>{item.tenderName || item.tenderNumber || 'Not provided'}</strong><small>{item.department || 'Not provided'} · {item.closingDate || 'No closing date'}</small></span><Badge>{item.status || 'Open'}</Badge></div>)}{!tenderOpportunities.length && <EmptyState icon={FileText} title="No tender opportunities" />}</SectionCard></div>

    <div className="director-dashboard-columns"><SectionCard title="Recent Reports" actions={<Button variant="secondary" onClick={() => navigate('/director/visit-reports')}>View All</Button>}>{recentReports.map((item) => <div className="director-summary-row" key={`${item.reportType}-${item.id}`}><span><strong>{nameFor(item.employeeId, item.fullName || item.employeeName)}</strong><small>{item.date || item.visitDate || 'No date'} · {item.reportType}</small></span><Badge>{item.status || 'Submitted'}</Badge></div>)}{!recentReports.length && <EmptyState icon={FileText} title="No recent reports" />}</SectionCard><SectionCard title="Recent Activity" actions={<Button variant="secondary" onClick={() => navigate('/director/notifications')}>View Updates</Button>}>{activityLogs.slice(0, 5).map((item) => <div className="director-summary-row" key={item.id}><span><strong>{item.action || item.description || 'Portal activity'}</strong><small>{item.module || 'Activity'} · {item.timestamp || item.createdAt || 'Recently'}</small></span></div>)}{!activityLogs.length && <EmptyState icon={Clock} title="No recent activity" />}</SectionCard></div>
  </div>;
};

export default DirectorDashboard;
