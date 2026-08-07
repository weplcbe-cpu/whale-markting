import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Bell, Calendar, Clock, Download, FileText, MapPin, Package, Printer, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, PageHeader, SectionCard, SelectField, TextArea } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';
import { filterActiveNotifications } from '../../utils/notificationUtils';
import { AnalyticsTabs } from './AnalyticsTabs';
import { CompanyLogo } from '../common/CompanyLogo';
import { getPendingDailyReports, getPendingFollowUps } from '../../utils/reportSelectors';
import { DirectorDailyReports } from './DirectorDailyReports';
import { CallEmployeeButton, EntityDetailsModal } from '../common/details';

const today = () => new Date().toISOString().slice(0, 10);
const text = (value) => value || 'Not provided';
const productText = (row) => Array.isArray(row.products) ? row.products.join(', ') : (row.products || row.requirement || 'Not provided');
const destinationText = (row) => row.customerName || row.organizationName || 'Organization not provided';
const statusTone = (status) => ['Submitted', 'Completed', 'Approved', 'Won'].includes(normalizePlanStatus(status)) ? 'success' : ['Cancelled', 'Rejected', 'Lost', 'Overdue'].includes(normalizePlanStatus(status)) ? 'danger' : ['Pending', 'Changes Requested'].includes(normalizePlanStatus(status)) ? 'warning' : 'neutral';

export const DirectorOperations = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser, users, products, visitPlans, visitReports, dailyReports, followUps, notifications, addDirectorComment, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);
  const [comment, setComment] = useState('');
  const marketing = users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role));
  const employeeName = (employeeId, fallback) => fallback || marketing.find((user) => user.employeeId === employeeId)?.fullName || marketing.find((user) => user.employeeId === employeeId)?.username || employeeId || 'Not provided';
  const employeeMobile = (employeeId) => marketing.find((user) => user.employeeId === employeeId)?.mobileNumber || marketing.find((user) => user.employeeId === employeeId)?.mobile;
  const matches = (row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  const addComment = async () => { if (!commentTarget || !comment.trim()) return; await addDirectorComment({ targetEmployeeId: commentTarget.employeeId || commentTarget.createdBy || commentTarget.assignedEmployeeId, targetEmployeeName: employeeName(commentTarget.employeeId || commentTarget.createdBy || commentTarget.assignedEmployeeId, commentTarget.fullName), targetModule: commentTarget.module, referenceId: String(commentTarget.id), message: comment.trim() }); setComment(''); setCommentTarget(null); };
  const commentButton = (row, module) => <Button variant="secondary" onClick={() => setCommentTarget({ ...row, module })}>Comment</Button>;
  const detailModal = <EntityDetailsModal open={Boolean(selected)} onClose={() => setSelected(null)} entity={selected?.entity} type={selected?.type} title={selected?.title} primaryAction={selected?.employeePhone ? <CallEmployeeButton phone={selected.employeePhone} /> : null} />;
  const commentModal = <Modal open={Boolean(commentTarget)} onClose={() => setCommentTarget(null)} title="Add Director Comment" subtitle={commentTarget?.module} footer={<><Button variant="secondary" onClick={() => setCommentTarget(null)}>Cancel</Button><Button onClick={addComment} disabled={!comment.trim()}>Send Comment</Button></>}><TextArea label="Comment" required value={comment} onChange={(event) => setComment(event.target.value)} /></Modal>;

  useEffect(() => {
    if (location.pathname !== '/director/visit-plans') return;
    const planId = searchParams.get('planId');
    const row = visitPlans.find((plan) => String(plan.id) === planId);
    if (!row) return;
    const employee = users.find((user) => user.employeeId === row.employeeId);
    setSelected({
      type: 'visitPlan',
      employeePhone: employee?.mobileNumber || employee?.mobile,
      entity: { ...row, fullName: row.employeeName || row.fullName || employee?.fullName || employee?.username },
    });
  }, [location.pathname, searchParams, users, visitPlans]);

  const filterBar = <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Submitted</option><option>Planned</option><option>Started</option><option>Completed</option><option>Cancelled</option><option>Changes Requested</option></SelectField></div>;

  if (location.pathname === '/director/today-schedule') {
    const rows = visitPlans.filter((row) => row.visitDate === today()).filter(matches).filter((row) => status === 'All' || normalizePlanStatus(row.status) === status);
    const columns = [
      { key: 'employee', label: 'Employee', render: (row) => <><strong>{employeeName(row.employeeId, row.employeeName || row.fullName)}</strong><small>{text(row.employeeId)}</small></> }, { key: 'date', label: 'Visit Date', render: (row) => text(row.visitDate) }, { key: 'time', label: 'Expected Time', render: (row) => text(row.expectedTime) }, { key: 'area', label: 'Area / City', render: (row) => row.area || row.city || row.district || 'Not provided' }, { key: 'customer', label: 'Customer / Organization', render: destinationText }, { key: 'purpose', label: 'Visit Purpose', render: (row) => text(row.visitPurpose) }, { key: 'product', label: 'Products', render: productText }, { key: 'requirement', label: 'Requirement', render: (row) => text(row.requirement) }, { key: 'priority', label: 'Priority', render: (row) => text(row.priority) }, { key: 'notes', label: 'Notes', render: (row) => text(row.notes) }, { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{normalizePlanStatus(row.status)}</Badge> }, { key: 'actions', label: 'Details', render: (row) => <Button variant="secondary" onClick={() => setSelected({ type: 'visitPlan', employeePhone: employeeMobile(row.employeeId), entity: { ...row, fullName: employeeName(row.employeeId, row.employeeName || row.fullName) } })}>View Details</Button> }
    ];
    return <div className="ds-page"><PageHeader title="Today’s Team Schedule" description="Read-only live status for every Marketing employee’s visits today." />{filterBar}<DataTable rows={rows} columns={columns} empty={<EmptyState icon={Calendar} title="No team visits scheduled today" description="Today’s submitted visit plans will appear here." />} />{detailModal}</div>;
  }

  if (location.pathname === '/director/visit-plans') {
    const rows = visitPlans
      .filter(matches)
      .filter((row) => employeeFilter === 'All' || row.employeeId === employeeFilter)
      .filter((row) => !dateFilter || row.visitDate === dateFilter)
      .filter((row) => !areaFilter || String(row.area || row.city || row.district || '').toLowerCase().includes(areaFilter.toLowerCase()))
      .filter((row) => status === 'All' || normalizePlanStatus(row.status) === status);
    const visitFilterBar = <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Employee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option>All</option>{marketing.map((employee) => <option key={employee.id} value={employee.employeeId}>{employee.fullName || employee.username || employee.employeeId}</option>)}</SelectField><FormField label="Date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /><FormField label="Area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} /><SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Submitted</option><option>Draft</option><option>Planned</option><option>Started</option><option>Completed</option><option>Cancelled</option></SelectField></div>;
    const columns = [{ key: 'employee', label: 'Employee', render: (row) => <><strong>{employeeName(row.employeeId, row.employeeName || row.fullName)}</strong><small>{text(row.employeeId)}</small></> }, { key: 'date', label: 'Visit Date', render: (row) => text(row.visitDate) }, { key: 'time', label: 'Expected Time', render: (row) => text(row.expectedTime) }, { key: 'area', label: 'Area / City', render: (row) => row.area || row.city || row.district || 'Not provided' }, { key: 'customer', label: 'Customer / Organization', render: (row) => row.customerName || row.organizationName || 'Customer not selected' }, { key: 'purpose', label: 'Visit Purpose', render: (row) => text(row.visitPurpose) }, { key: 'products', label: 'Products', render: productText }, { key: 'requirement', label: 'Requirement', render: (row) => text(row.requirement) }, { key: 'priority', label: 'Priority', render: (row) => text(row.priority) }, { key: 'notes', label: 'Notes', render: (row) => text(row.notes) }, { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{normalizePlanStatus(row.status)}</Badge> }, { key: 'actions', label: 'Details', render: (row) => <Button variant="secondary" onClick={() => setSelected({ type: 'visitPlan', employeePhone: employeeMobile(row.employeeId), entity: { ...row, fullName: employeeName(row.employeeId, row.employeeName || row.fullName) } })}>View Details</Button> }];
    return <div className="ds-page"><PageHeader title="Visit Plans" description="View individual Marketing visit plans and complete destination details." />{visitFilterBar}<DataTable rows={rows} columns={columns} empty={<EmptyState icon={Calendar} title="No visit plans found" />} />{detailModal}</div>;
  }

  if (location.pathname === '/director/daily-reports') {
    const defaultRows = getPendingDailyReports(dailyReports);
    const rows = (status === 'All' ? defaultRows : dailyReports.filter((row) => String(row.status).toLowerCase() === status.toLowerCase())).filter(matches);
    const dailyReportFilterBar = <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Submitted</option><option>Draft</option><option>Reviewed</option><option>Locked</option><option>Reopened</option></SelectField></div>;
    return <div className="ds-page daily-reports-page"><PageHeader title="Daily Reports" description="Review submitted daily summaries. Locking, reopening, editing, and deletion remain Admin-only." /><DirectorDailyReports rows={rows} filterBar={dailyReportFilterBar} employeeName={employeeName} initialReportId={searchParams.get('reportId')} onComment={(row) => setCommentTarget({ ...row, module: 'Daily Report' })} />{commentModal}</div>;
  }

  if (location.pathname === '/director/follow-ups') {
    const defaultRows = getPendingFollowUps(followUps);
    const rows = (status === 'All' ? defaultRows : followUps.filter((row) => String(row.status).toLowerCase() === status.toLowerCase())).filter(matches);
    const columns = [{ key: 'employee', label: 'Employee', render: (row) => employeeName(row.employeeId, row.fullName || row.employeeName) }, { key: 'customer', label: 'Organization / Person', render: (row) => text(row.customerName) }, { key: 'date', label: 'Follow-up Date', render: (row) => row.followUpDate }, { key: 'type', label: 'Type', render: (row) => text(row.followUpType || row.type) }, { key: 'purpose', label: 'Purpose', render: (row) => text(row.purpose) }, { key: 'priority', label: 'Priority', render: (row) => text(row.priority) }, { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{text(row.status)}</Badge> }, { key: 'actions', label: 'Actions', render: (row) => <div className="ds-page-actions"><Button variant="secondary" onClick={() => setSelected({ type: 'followUp', entity: { ...row, fullName: employeeName(row.employeeId, row.fullName || row.employeeName) } })}>View</Button>{commentButton(row, 'Follow-up')}</div> }];
    return <div className="ds-page"><PageHeader title="Follow-up Monitoring" description="Monitor today, upcoming, overdue, and completed Marketing follow-ups." />{filterBar}<DataTable rows={rows} columns={columns} empty={<EmptyState icon={Clock} title="No follow-ups found" />} />{detailModal}{commentModal}</div>;
  }

  if (location.pathname === '/director/analytics/products') {
    const rows = products.map((product) => { const visits = visitPlans.filter((plan) => (plan.products || []).includes(product.name)); return { id: product.id, name: product.name, visits: visits.length, requirements: visits.filter((plan) => plan.requirement).length, demos: visits.filter((plan) => /demo/i.test(plan.visitPurpose || '')).length, quotations: visitReports.filter((report) => report.isQuotationRequired && (report.interestedProducts || []).includes(product.name)).length, followups: followUps.filter((followUp) => String(followUp.notes || followUp.purpose || '').includes(product.name) && followUp.status === 'Pending').length }; }).filter(matches);
    const columns = [{ key: 'name', label: 'Product' }, { key: 'visits', label: 'Total Visits' }, { key: 'requirements', label: 'New Requirements' }, { key: 'demos', label: 'Demo Requests' }, { key: 'quotations', label: 'Quotation Requests' }, { key: 'followups', label: 'Pending Follow-ups' }];
    return <div className="ds-page"><PageHeader title="Analytics" description="Product-wise Marketing demand and opportunity indicators." /><AnalyticsTabs />{filterBar}<DataTable rows={rows} columns={columns} empty={<EmptyState icon={Package} title="No product activity found" />} /></div>;
  }

  if (location.pathname === '/director/analytics/areas') {
    const areas = [...new Set(visitPlans.map((row) => row.area || row.city || row.district).filter(Boolean))];
    const rows = areas.map((area) => ({ id: area, area, state: 'Tamil Nadu', visits: visitPlans.filter((row) => [row.area, row.city, row.district].includes(area)).length, requirements: visitPlans.filter((row) => [row.area, row.city, row.district].includes(area) && row.requirement).length })).filter(matches);
    return <div className="ds-page"><PageHeader title="Analytics" description="Area-wise visits and requirements." /><AnalyticsTabs />{filterBar}<DataTable rows={rows} columns={[{ key: 'area', label: 'District / City / Area' }, { key: 'state', label: 'State' }, { key: 'visits', label: 'Visits' }, { key: 'requirements', label: 'Requirements' }]} empty={<EmptyState icon={MapPin} title="No area activity found" />} /></div>;
  }

  if (location.pathname === '/director/reports') {
    const rows = visitPlans.filter(matches).map((row) => ({ id: row.id, employee: employeeName(row.employeeId, row.fullName), date: row.visitDate, area: row.area || row.city || row.district, customer: row.customerName, products: productText(row), status: normalizePlanStatus(row.status) }));
    const downloadCsv = () => { const header = ['Employee', 'Date', 'Area', 'Organization', 'Products', 'Status']; const csv = [header, ...rows.map((row) => [row.employee, row.date, row.area, row.customer, row.products, row.status])].map((values) => values.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'director-team-report.csv'; link.click(); URL.revokeObjectURL(url); showToast('Report exported successfully.', 'success'); };
    return <div className="ds-page"><div className="report-brand"><CompanyLogo /><span>Whale Enterprise PVT Ltd</span></div><PageHeader title="Director Reports" description="Team, employee, area, product, organization, follow-up, and visit reporting." actions={<><Button variant="secondary" onClick={downloadCsv}><Download size={16} /> Excel / CSV</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> PDF / Print</Button></>} />{filterBar}<DataTable rows={rows} columns={[{ key: 'employee', label: 'Employee' }, { key: 'date', label: 'Date' }, { key: 'area', label: 'Area' }, { key: 'customer', label: 'Organization' }, { key: 'products', label: 'Products' }, { key: 'status', label: 'Status' }]} empty={<EmptyState icon={FileText} title="No report data found" />} /></div>;
  }

  const rows = filterActiveNotifications(notifications).filter((notification) => !notification.userId || notification.userId === currentUser?.employeeId).filter((notification) => !`${notification.type || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase().includes('tender')).filter(matches);
  return <div className="ds-page"><PageHeader title="Notifications" description="View plan, visit, report, follow-up, and Admin updates." actions={<Badge tone="warning">{rows.filter((row) => !row.isRead).length} unread</Badge>} /><SectionCard><DataTable rows={rows} columns={[{ key: 'title', label: 'Notification', render: (row) => <><strong>{text(row.title)}</strong><small>{text(row.message)}</small></> }, { key: 'type', label: 'Type', render: (row) => text(row.type) }, { key: 'time', label: 'Time', render: (row) => row.timestamp || row.createdAt }, { key: 'status', label: 'Status', render: (row) => <Badge tone={row.isRead ? 'neutral' : 'warning'}>{row.isRead ? 'Read' : 'Unread'}</Badge> }, { key: 'action', label: 'Details', render: (row) => <Button variant="secondary" onClick={() => setSelected({ type: 'notification', entity: row })}>View Details</Button> }]} empty={<EmptyState icon={Bell} title="No notifications" />} /></SectionCard>{detailModal}</div>;
};

export default DirectorOperations;
