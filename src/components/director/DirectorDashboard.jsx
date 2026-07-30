import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, FileText, Phone, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, EmptyState, Modal, PageHeader, SectionCard } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';

const dateValue = (value) => value ? String(value).slice(0, 10) : '';

export const DirectorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, users, visitPlans, visitReports, dailyReports, followUps, activityLogs, lastUpdated, dataLoading } = useApp();
  const [period, setPeriod] = useState('Today');
  const [selectedPlan, setSelectedPlan] = useState(null);
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
  const submittedPlans = scopedPlans
    .filter((plan) => ['Submitted', 'Planned', 'Started', 'Completed', 'Rescheduled', 'Approved'].includes(normalizePlanStatus(plan.status)))
    .sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)));
  const scopedFollowUps = followUps.filter((item) => inPeriod(item.followUpDate));
  const pendingFollowUps = scopedFollowUps.filter((item) => item.status !== 'Completed');
  const scopedReports = dailyReports.filter((report) => inPeriod(report.date || report.reportDate || report.createdAt));
  const pendingReports = scopedReports.filter((report) => !['Approved', 'Completed'].includes(report.status));
  const employeeFor = (employeeId) => marketing.find((user) => user.employeeId === employeeId);
  const nameFor = (employeeId, fallback) => fallback || employeeFor(employeeId)?.fullName || employeeFor(employeeId)?.username || employeeId || 'Not provided';
  const destinationFor = (plan) => plan.customerName || plan.organizationName || 'Organization not provided';
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const cards = [
    ['Total Marketing Team', marketing.length, Users, '/director/team'],
    [`${period} Visits`, scopedPlans.length, Calendar, period === 'Today' ? '/director/today-schedule' : '/director/visit-plans'],
    ['Completed Visits', completedPlans.length, CheckCircle2, '/director/visit-reports'],
    ['Pending Visits', pendingPlans.length, Clock, '/director/visit-plans'],
    ['Submitted Plans', submittedPlans.length, FileText, '/director/visit-plans'],
    ['Pending Follow-ups', pendingFollowUps.length, Clock, '/director/follow-ups'],
    ['Pending Reports', pendingReports.length, FileText, '/director/daily-reports']
  ];

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

    <SectionCard title="Submitted Plans and Updates" description={`Submitted Marketing visit plans for ${period.toLowerCase()}`} actions={<Button variant="secondary" onClick={() => navigate('/director/visit-plans')}>View All</Button>}><DataTable rows={submittedPlans.slice(0, 5)} columns={[
      { key: 'employee', label: 'Employee', render: (row) => <><strong>{nameFor(row.employeeId, row.employeeName || row.fullName)}</strong><small>{row.employeeId || 'Not provided'}</small></> },
      { key: 'date', label: 'Visit Date', render: (row) => row.visitDate || 'Not provided' },
      { key: 'time', label: 'Expected Time', render: (row) => row.expectedTime || 'Not provided' },
      { key: 'area', label: 'Area / City', render: (row) => row.area || row.city || row.district || 'Not provided' },
      { key: 'destination', label: 'Customer / Organization', render: destinationFor },
      { key: 'purpose', label: 'Visit Purpose', render: (row) => row.visitPurpose || 'Not provided' },
      { key: 'products', label: 'Products', render: (row) => row.products?.length ? row.products.join(', ') : 'Not provided' },
      { key: 'requirement', label: 'Requirement', render: (row) => row.requirement || 'Not provided' },
      { key: 'priority', label: 'Priority', render: (row) => row.priority || 'Medium' },
      { key: 'submitted', label: 'Submitted Time', render: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'Not provided' },
      { key: 'status', label: 'Status', render: (row) => <Badge tone="success">{normalizePlanStatus(row.status)}</Badge> },
      { key: 'details', label: 'Details', render: (row) => <Button variant="secondary" onClick={() => setSelectedPlan(row)}>View Details</Button> }
    ]} empty={<EmptyState icon={CheckCircle2} title="No submitted visit plans yet." />} /></SectionCard>

    <Modal open={Boolean(selectedPlan)} onClose={() => setSelectedPlan(null)} title="Visit Plan Details" footer={<><Button variant="secondary" onClick={() => setSelectedPlan(null)}>Close</Button>{employeeFor(selectedPlan?.employeeId)?.mobileNumber && <Button onClick={() => { window.location.href = `tel:${employeeFor(selectedPlan.employeeId).mobileNumber}`; }}><Phone size={16} /> Call Employee</Button>}</>}>
      {selectedPlan && <div className="director-detail-grid">{Object.entries({
        'Employee Name': nameFor(selectedPlan.employeeId, selectedPlan.employeeName || selectedPlan.fullName),
        'Employee ID': selectedPlan.employeeId,
        'Visit Date': selectedPlan.visitDate,
        Time: selectedPlan.expectedTime,
        'Area / City': selectedPlan.area || selectedPlan.city || selectedPlan.district,
        'Customer / Organization': destinationFor(selectedPlan),
        'Contact Person': selectedPlan.contactPerson,
        'Mobile Number': selectedPlan.mobileNumber,
        Purpose: selectedPlan.visitPurpose,
        Products: selectedPlan.products?.length ? selectedPlan.products.join(', ') : null,
        Requirement: selectedPlan.requirement,
        Priority: selectedPlan.priority,
        Notes: selectedPlan.notes,
        'Current Status': normalizePlanStatus(selectedPlan.status),
        'Submitted Date and Time': selectedPlan.submittedAt ? new Date(selectedPlan.submittedAt).toLocaleString() : null
      }).map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || 'Not provided'}</strong></div>)}</div>}
    </Modal>

    <SectionCard title="Today Team Schedule" actions={<Button variant="secondary" onClick={() => navigate('/director/today-schedule')}>View All</Button>}><DataTable rows={visitPlans.filter((plan) => plan.visitDate === todayValue).slice(0, 5)} columns={[{ key: 'employee', label: 'Employee', render: (row) => nameFor(row.employeeId, row.fullName) }, { key: 'time', label: 'Time', render: (row) => row.expectedTime || 'Not provided' }, { key: 'area', label: 'Area', render: (row) => row.area || row.city || row.district || 'Not provided' }, { key: 'customer', label: 'Customer / Organization', render: (row) => row.customerName || row.organizationName || 'General visit' }, { key: 'purpose', label: 'Purpose', render: (row) => row.visitPurpose || 'Not provided' }, { key: 'requirement', label: 'Requirement', render: (row) => row.requirement || 'Not provided' }, { key: 'priority', label: 'Priority', render: (row) => row.priority || 'Medium' }, { key: 'status', label: 'Status', render: (row) => <Badge>{normalizePlanStatus(row.status)}</Badge> }]} empty={<EmptyState icon={Calendar} title="No visits scheduled today" />} /></SectionCard>

    <SectionCard title="Marketing Team" actions={<Button variant="secondary" onClick={() => navigate('/director/team')}>View All</Button>}><DataTable rows={teamRows} columns={[{ key: 'employee', label: 'Employee', render: (row) => <><strong>{row.employee}</strong><small>{row.employeeId}</small></> }, { key: 'visits', label: 'Visits' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'action', label: 'Action', render: () => <Button variant="secondary" onClick={() => navigate('/director/team')}>View</Button> }]} empty={<EmptyState icon={Users} title="No active Marketing employees" />} /></SectionCard>

    <SectionCard title="Pending Follow-ups" actions={<Button variant="secondary" onClick={() => navigate('/director/follow-ups')}>View All</Button>}>{pendingFollowUps.slice(0, 5).map((item) => <div className="director-summary-row" key={item.id}><span><strong>{nameFor(item.employeeId, item.fullName || item.employeeName)}</strong><small>{item.customerName || 'Not provided'} · {item.followUpDate || 'No due date'}</small></span><Badge tone="warning">{item.priority || 'Pending'}</Badge></div>)}{!pendingFollowUps.length && <EmptyState icon={Clock} title="No pending follow-ups" />}</SectionCard>

    <div className="director-dashboard-columns"><SectionCard title="Recent Reports" actions={<Button variant="secondary" onClick={() => navigate('/director/visit-reports')}>View All</Button>}>{recentReports.map((item) => <div className="director-summary-row" key={`${item.reportType}-${item.id}`}><span><strong>{nameFor(item.employeeId, item.fullName || item.employeeName)}</strong><small>{item.date || item.visitDate || 'No date'} · {item.reportType}</small></span><Badge>{item.status || 'Submitted'}</Badge></div>)}{!recentReports.length && <EmptyState icon={FileText} title="No recent reports" />}</SectionCard><SectionCard title="Recent Activity" actions={<Button variant="secondary" onClick={() => navigate('/director/notifications')}>View Updates</Button>}>{activityLogs.slice(0, 5).map((item) => <div className="director-summary-row" key={item.id}><span><strong>{item.action || item.description || 'Portal activity'}</strong><small>{item.module || 'Activity'} · {item.timestamp || item.createdAt || 'Recently'}</small></span></div>)}{!activityLogs.length && <EmptyState icon={Clock} title="No recent activity" />}</SectionCard></div>
  </div>;
};

export default DirectorDashboard;
