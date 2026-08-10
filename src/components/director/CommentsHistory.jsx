import React, { useMemo, useState } from 'react';
import { MessageSquare, Pencil, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolveDirectorFeedbackRecord } from '../../utils/directorFeedback';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';
import { EntityDetailsModal } from '../common/details';

const COMMENT_TYPES = ['General Comment', 'Need More Details', 'High Priority', 'Follow-up Required', 'Correction Required'];
const TARGET_TYPES = ['Visit Plan', 'Tour Plan', 'Visit Report', 'Daily Report', 'Follow-up'];
const INITIAL_FEEDBACK_FORM = { employeeId: '', targetType: 'Visit Plan', targetId: '', commentType: 'General Comment', message: '' };
const TARGET_TYPE_PLURALS = { 'Visit Plan': 'Visit Plans', 'Tour Plan': 'Tour Plans', 'Visit Report': 'Visit Reports', 'Daily Report': 'Daily Reports', 'Follow-up': 'Follow-ups' };
const displayDate = (value) => {
  if (!value) return 'Date not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const CommentsHistory = () => {
  const {
    directorComments, users, visitPlans, visitReports, dailyReports, followUps,
    currentUser, dataLoading, addDirectorComment, updateDirectorComment, deleteDirectorComment, refreshEntity, lastUpdated,
  } = useApp();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('All');
  const [selected, setSelected] = useState(null);
  const [newComment, setNewComment] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editForm, setEditForm] = useState({ commentType: '', message: '' });
  const [discardOpen, setDiscardOpen] = useState(false);
  const [addDiscardOpen, setAddDiscardOpen] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(INITIAL_FEEDBACK_FORM);
  const comments = useMemo(() => directorComments
    .filter((item) => module === 'All' || item.targetType === module)
    .filter((item) => `${item.message} ${item.targetEmployeeName || ''} ${item.targetType}`.toLowerCase().includes(search.toLowerCase())), [directorComments, module, search]);
  const marketing = users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role));
  const employeeRecords = useMemo(() => {
    const employeeId = form.employeeId;
    if (!employeeId) return [];
    if (form.targetType === 'Visit Plan') return visitPlans.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${displayDate(item.visitDate)} • ${item.area || item.city || item.location || 'Location not provided'} • ${item.purpose || item.visitType || 'Product Visit'}` }));
    if (form.targetType === 'Tour Plan') {
      const seen = new Set();
      return visitPlans.filter((item) => item.employeeId === employeeId && item.batchId).filter((item) => !seen.has(item.batchId) && seen.add(item.batchId)).map((item) => ({ id: item.batchId, title: `${item.planType || 'Tour Plan'} • ${item.area || item.city || item.location || 'Locations not provided'} • ${displayDate(item.periodFrom || item.visitDate)}` }));
    }
    if (form.targetType === 'Visit Report') return visitReports.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${displayDate(item.visitDate || item.submittedAt)} • ${item.customerName || item.organization || item.organisation || 'Organization not provided'}` }));
    if (form.targetType === 'Daily Report') return dailyReports.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: displayDate(item.date || item.reportDate || item.submittedAt) }));
    if (form.targetType === 'Follow-up') return followUps.filter((item) => item.employeeId === employeeId).map((item) => ({ id: item.id, title: `${item.customerName || item.organization || item.organisation || 'Organization not provided'} • ${displayDate(item.followUpDate)} • ${item.type || item.followUpType || 'Follow-up'}` }));
    return [];
  }, [dailyReports, followUps, form.employeeId, form.targetType, visitPlans, visitReports]);
  const update = (field, value) => { if (['employeeId', 'targetType', 'targetId'].includes(field)) setRelatedError(''); setForm((current) => ({ ...current, [field]: value, ...(['employeeId', 'targetType'].includes(field) ? { targetId: '' } : {}) })); };
  const addDirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FEEDBACK_FORM);
  const resetAddForm = () => { setForm(INITIAL_FEEDBACK_FORM); setRelatedError(''); setNewComment(false); };
  const closeAddForm = () => { if (addDirty) setAddDiscardOpen(true); else resetAddForm(); };
  const relatedState = (item) => resolveDirectorFeedbackRecord(item, { visitPlans, visitReports, dailyReports, followUps }).state;
  const canManage = (item) => currentUser?.role === 'Admin' || item.directorId === currentUser?.id;
  const openEdit = (item) => { setEditTarget(item); setEditForm({ commentType: item.commentType, message: item.message }); setSelected(null); };
  const editDirty = Boolean(editTarget) && (editForm.commentType !== editTarget.commentType || editForm.message !== editTarget.message);
  const closeEdit = () => { if (editDirty) setDiscardOpen(true); else setEditTarget(null); };
  const saveEdit = async (event) => { event.preventDefault(); setBusy(true); try { const updated = await updateDirectorComment(editTarget.id, editForm); setEditTarget(null); setSelected(updated); } catch { /* Context shows a safe error. */ } finally { setBusy(false); } };
  const confirmDelete = async () => { setBusy(true); try { await deleteDirectorComment(deleteTarget.id); if (selected?.id === deleteTarget.id) setSelected(null); setDeleteTarget(null); } catch { /* Context shows a safe error. */ } finally { setBusy(false); } };
  const submit = async (event) => {
    event.preventDefault();
    const employee = marketing.find((item) => item.employeeId === form.employeeId);
    const record = employeeRecords.find((item) => item.id === form.targetId);
    if (!record) { setRelatedError('Please select a related record.'); return; }
    if (!employee || !form.message.trim()) return;
    await addDirectorComment({
      employeeId: employee.employeeId,
      targetEmployeeName: employee.fullName || employee.employeeName,
      targetType: form.targetType,
      targetId: record.id,
      targetTitle: record.title,
      commentType: form.commentType,
      message: form.message.trim(),
    });
    resetAddForm();
  };
  const columns = [
    { key: 'type', label: 'Target', render: (row) => <><Badge>{row.targetType}</Badge><small>{row.targetTitle}</small></> },
    { key: 'comment', label: 'Feedback', render: (row) => <><strong>{row.commentType}</strong><small>{row.message}</small></> },
    { key: 'employee', label: 'Employee', render: (row) => row.targetEmployeeName || row.employeeId || 'Not provided' },
    { key: 'date', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : 'Not provided' },
    { key: 'read', label: 'Status', render: (row) => <Badge tone={row.isRead ? 'success' : 'warning'}>{row.isRead ? 'Read' : 'Unread'}</Badge> },
    { key: 'action', label: 'Action', render: (row) => <div className="director-feedback-actions"><Button variant="secondary" onClick={() => setSelected(row)}>View Details</Button>{canManage(row) && <><Button variant="secondary" aria-label={`Edit feedback for ${row.targetEmployeeName || row.employeeId}`} onClick={() => openEdit(row)}><Pencil size={15} /> Edit</Button><Button variant="danger" aria-label={`Delete feedback for ${row.targetEmployeeName || row.employeeId}`} onClick={() => setDeleteTarget(row)}><Trash2 size={15} /> Delete</Button></>}</div> },
  ];
  return <div className="ds-page">
    <PageHeader title="Director Feedback" description={`Communication shared with Marketing. Last updated ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not available'}.`} actions={<Button onClick={() => setNewComment(true)}>Add Feedback</Button>} />
    <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search feedback" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Target type" value={module} onChange={(event) => setModule(event.target.value)}><option>All</option>{TARGET_TYPES.map((item) => <option key={item}>{item}</option>)}</SelectField></div>
    <DataTable rows={comments} columns={columns} empty={<EmptyState icon={MessageSquare} title="No Director feedback found" description="Clear filters, refresh, or add feedback for a Marketing record." action={<Button onClick={() => refreshEntity('director_comments')}>Retry</Button>} />} />
    <EntityDetailsModal open={Boolean(selected)} onClose={() => setSelected(null)} type="feedback" entity={selected} relatedState={selected ? relatedState(selected) : null} primaryAction={selected && canManage(selected) ? <><Button variant="secondary" onClick={() => openEdit(selected)}><Pencil size={15} /> Edit</Button><Button variant="danger" onClick={() => setDeleteTarget(selected)}><Trash2 size={15} /> Delete</Button></> : null} />
    <Modal open={newComment} onClose={closeAddForm} title="Add Director Feedback" className="director-feedback-form-modal" footer={<><Button variant="secondary" onClick={closeAddForm}>Cancel</Button><Button type="submit" form="director-feedback-form">Send Feedback</Button></>}>
      <form id="director-feedback-form" onSubmit={submit} className="ds-form-grid">
        <SelectField className="ds-field--full" label="Marketing Employee" required value={form.employeeId} onChange={(event) => update('employeeId', event.target.value)}><option value="">Select employee</option>{marketing.map((employee) => <option key={employee.id} value={employee.employeeId}>{employee.fullName || employee.employeeName}</option>)}</SelectField>
        <SelectField className="ds-field--full" label="Target Type" required value={form.targetType} onChange={(event) => update('targetType', event.target.value)}>{TARGET_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField>
        <SelectField className="ds-field--full" label="Related Record" required disabled={dataLoading || !form.employeeId || employeeRecords.length === 0} error={relatedError} value={form.targetId} onInvalid={(event) => { event.preventDefault(); setRelatedError('Please select a related record.'); }} onChange={(event) => update('targetId', event.target.value)}><option value="">{dataLoading ? 'Loading records...' : !form.employeeId ? 'Select an employee first' : employeeRecords.length === 0 ? `No ${TARGET_TYPE_PLURALS[form.targetType]} available` : `Select ${form.targetType}`}</option>{employeeRecords.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</SelectField>
        <SelectField className="ds-field--full" label="Feedback Type" value={form.commentType} onChange={(event) => update('commentType', event.target.value)}>{COMMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField>
        <TextArea className="ds-field--full" label="Feedback" required value={form.message} onChange={(event) => update('message', event.target.value)} />
      </form>
    </Modal>
    <Modal open={Boolean(editTarget)} onClose={closeEdit} title="Edit Director Feedback" className="director-feedback-form-modal" footer={<><Button variant="secondary" onClick={closeEdit}>Cancel</Button><Button loading={busy} type="submit" form="director-feedback-edit-form">Save Changes</Button></>}>
      <form id="director-feedback-edit-form" onSubmit={saveEdit} className="ds-form-grid"><div className="director-feedback-readonly"><span>Marketing Employee</span><strong>{editTarget?.targetEmployeeName || editTarget?.employeeId}</strong></div><div className="director-feedback-readonly"><span>Target Type</span><strong>{editTarget?.targetType}</strong></div><div className="director-feedback-readonly ds-field--full"><span>Related Record</span><strong>{editTarget?.targetTitle || (relatedState(editTarget) === 'deleted' ? 'Related record deleted' : editTarget?.targetId)}</strong></div><SelectField className="ds-field--full" label="Feedback Type" value={editForm.commentType} onChange={(event) => setEditForm((current) => ({ ...current, commentType: event.target.value }))}>{COMMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField><TextArea className="ds-field--full" label="Feedback Message" required rows={5} value={editForm.message} onChange={(event) => setEditForm((current) => ({ ...current, message: event.target.value }))} /></form>
    </Modal>
    <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard Changes?" className="director-feedback-confirm-modal" footer={<><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep Editing</Button><Button variant="danger" onClick={() => { setDiscardOpen(false); setEditTarget(null); }}>Discard Changes</Button></>}><p className="director-feedback-confirm-message">You have unsaved changes. Do you want to discard them?</p></Modal>
    <Modal open={addDiscardOpen} onClose={() => setAddDiscardOpen(false)} title="Discard Changes?" className="director-feedback-confirm-modal" footer={<><Button variant="secondary" onClick={() => setAddDiscardOpen(false)}>Keep Editing</Button><Button variant="danger" onClick={() => { setAddDiscardOpen(false); resetAddForm(); }}>Discard Changes</Button></>}><p className="director-feedback-confirm-message">You have unsaved changes. Do you want to discard them?</p></Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Director Feedback?" className="director-feedback-confirm-modal" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={confirmDelete}>Delete Feedback</Button></>}><div className="director-feedback-delete-copy"><p>Are you sure you want to delete this feedback?</p><span>Employee: <strong>{deleteTarget?.targetEmployeeName || deleteTarget?.employeeId}</strong></span><span>Target: <strong>{deleteTarget?.targetType}</strong></span></div></Modal>
  </div>;
};
export default CommentsHistory;
