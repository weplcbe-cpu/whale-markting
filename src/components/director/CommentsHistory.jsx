import React, { useMemo, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';
import { EntityDetailsModal } from '../common/details';

const COMMENT_TYPES = ['General Comment', 'Need More Details', 'High Priority', 'Follow-up Required', 'Correction Required'];
const TARGET_TYPES = ['Visit Plan', 'Tour Plan', 'Visit Report', 'Daily Report', 'Follow-up'];

export const CommentsHistory = () => {
  const {
    directorComments, users, visitPlans, visitReports, dailyReports, followUps,
    addDirectorComment, refreshEntity, lastUpdated,
  } = useApp();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('All');
  const [selected, setSelected] = useState(null);
  const [newComment, setNewComment] = useState(false);
  const [form, setForm] = useState({ employeeId: '', targetType: 'Visit Plan', targetId: '', commentType: 'General Comment', message: '' });
  const comments = useMemo(() => directorComments
    .filter((item) => module === 'All' || item.targetType === module)
    .filter((item) => `${item.message} ${item.targetEmployeeName || ''} ${item.targetType}`.toLowerCase().includes(search.toLowerCase())), [directorComments, module, search]);
  const marketing = users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role));
  const employeeRecords = useMemo(() => {
    const employeeId = form.employeeId;
    if (!employeeId) return [];
    if (form.targetType === 'Visit Plan') return visitPlans.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${item.visitDate || 'No date'} · ${item.area || item.city || 'Visit Plan'}` }));
    if (form.targetType === 'Tour Plan') {
      const seen = new Set();
      return visitPlans.filter((item) => item.employeeId === employeeId && item.batchId).filter((item) => !seen.has(item.batchId) && seen.add(item.batchId)).map((item) => ({ id: item.batchId, title: `${item.planType || 'Tour'} Plan · ${item.periodFrom || item.visitDate}` }));
    }
    if (form.targetType === 'Visit Report') return visitReports.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${item.submittedAt || item.visitDate || 'Visit Report'} · ${item.customerName || 'Report'}` }));
    if (form.targetType === 'Daily Report') return dailyReports.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `Daily Report · ${item.date || item.submittedAt || ''}` }));
    if (form.targetType === 'Follow-up') return followUps.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${item.followUpDate || ''} · ${item.customerName || item.purpose || 'Follow-up'}` }));
    return [];
  }, [dailyReports, followUps, form.employeeId, form.targetType, visitPlans, visitReports]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value, ...(['employeeId', 'targetType'].includes(field) ? { targetId: '' } : {}) }));
  const submit = async (event) => {
    event.preventDefault();
    const employee = marketing.find((item) => item.employeeId === form.employeeId);
    const record = employeeRecords.find((item) => item.id === form.targetId);
    if (!employee || !record || !form.message.trim()) return;
    await addDirectorComment({
      employeeId: employee.employeeId,
      targetEmployeeName: employee.fullName || employee.employeeName,
      targetType: form.targetType,
      targetId: record.id,
      targetTitle: record.title,
      commentType: form.commentType,
      message: form.message.trim(),
    });
    setForm({ employeeId: '', targetType: 'Visit Plan', targetId: '', commentType: 'General Comment', message: '' });
    setNewComment(false);
  };
  const columns = [
    { key: 'type', label: 'Target', render: (row) => <><Badge>{row.targetType}</Badge><small>{row.targetTitle}</small></> },
    { key: 'comment', label: 'Feedback', render: (row) => <><strong>{row.commentType}</strong><small>{row.message}</small></> },
    { key: 'employee', label: 'Employee', render: (row) => row.targetEmployeeName || row.employeeId || 'Not provided' },
    { key: 'date', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : 'Not provided' },
    { key: 'read', label: 'Status', render: (row) => <Badge tone={row.isRead ? 'success' : 'warning'}>{row.isRead ? 'Read' : 'Unread'}</Badge> },
    { key: 'action', label: 'Action', render: (row) => <Button variant="secondary" onClick={() => setSelected(row)}>View Details</Button> },
  ];
  return <div className="ds-page">
    <PageHeader title="Director Feedback" description={`Communication shared with Marketing. Last updated ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not available'}.`} actions={<Button onClick={() => setNewComment(true)}>Add Feedback</Button>} />
    <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search feedback" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Target type" value={module} onChange={(event) => setModule(event.target.value)}><option>All</option>{TARGET_TYPES.map((item) => <option key={item}>{item}</option>)}</SelectField></div>
    <DataTable rows={comments} columns={columns} empty={<EmptyState icon={MessageSquare} title="No Director feedback found" description="Clear filters, refresh, or add feedback for a Marketing record." action={<Button onClick={() => refreshEntity('director_comments')}>Retry</Button>} />} />
    <EntityDetailsModal open={Boolean(selected)} onClose={() => setSelected(null)} type="feedback" entity={selected} relatedState={selected?.targetType === 'Tender' ? 'deleted' : null} />
    <Modal open={newComment} onClose={() => setNewComment(false)} title="Add Director Feedback" footer={<><Button variant="secondary" onClick={() => setNewComment(false)}>Cancel</Button><Button type="submit" form="director-feedback-form">Send Feedback</Button></>}>
      <form id="director-feedback-form" onSubmit={submit} className="ds-form-grid">
        <SelectField className="ds-field--full" label="Marketing Employee" required value={form.employeeId} onChange={(event) => update('employeeId', event.target.value)}><option value="">Select employee</option>{marketing.map((employee) => <option key={employee.id} value={employee.employeeId}>{employee.fullName || employee.employeeName}</option>)}</SelectField>
        <SelectField label="Target Type" value={form.targetType} onChange={(event) => update('targetType', event.target.value)}>{TARGET_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField>
        <SelectField label="Feedback Type" value={form.commentType} onChange={(event) => update('commentType', event.target.value)}>{COMMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField>
        <SelectField className="ds-field--full" label="Related Record" required value={form.targetId} onChange={(event) => update('targetId', event.target.value)}><option value="">Select record</option>{employeeRecords.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</SelectField>
        <TextArea className="ds-field--full" label="Feedback" required value={form.message} onChange={(event) => update('message', event.target.value)} />
      </form>
    </Modal>
  </div>;
};
export default CommentsHistory;
