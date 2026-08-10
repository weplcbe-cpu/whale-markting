import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Check, Clock, Eye, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, DateField, EmptyState, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';
import { EntityDetailsModal } from '../common/details';

const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not provided';
const blankForm = () => ({ customerId: '', customerName: '', followUpDate: new Date().toISOString().slice(0, 10), type: 'Phone Call', purpose: '', priority: 'High', notes: '' });
const statusTone = (status) => status === 'Completed' ? 'success' : status === 'In Progress' ? 'info' : status === 'Cancelled' ? 'neutral' : 'warning';

export const FollowUpManagement = () => {
  const { currentUser, followUps, addFollowUp, updateFollowUp, startFollowUp, rescheduleFollowUp, completeFollowUp, deleteFollowUp } = useApp();
  const [filterView, setFilterView] = useState('All');
  const [editor, setEditor] = useState(null);
  const [formData, setFormData] = useState(blankForm);
  const [originalFormData, setOriginalFormData] = useState(blankForm);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [reschedule, setReschedule] = useState({ followUpDate: '', reason: '' });
  const [completion, setCompletion] = useState({ outcome: '', notes: '', another: 'No', nextDate: '' });
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const empId = currentUser?.employeeId || '';
  const allFollowUps = useMemo(() => followUps.filter((item) => item.employeeId === empId), [followUps, empId]);
  const counts = useMemo(() => Object.fromEntries(['All', 'Pending', 'In Progress', 'Completed'].map((status) => [status, status === 'All' ? allFollowUps.length : allFollowUps.filter((item) => item.status === status).length])), [allFollowUps]);
  const visible = allFollowUps.filter((item) => filterView === 'All' || item.status === filterView);
  const today = new Date().toISOString().slice(0, 10);
  const relatedFollowUp = followUps.find((item) => item.id === searchParams.get('followUpId') && item.employeeId === empId);
  const closeRelated = () => { const next = new URLSearchParams(searchParams); next.delete('followUpId'); setSearchParams(next, { replace: true }); };
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const openAdd = () => { const next = blankForm(); setFormData(next); setOriginalFormData(next); setEditor({ mode: 'add' }); };
  const openEdit = (row) => { const next = { customerId: row.customerId || '', customerName: row.customerName || '', followUpDate: row.followUpDate || '', type: row.type || 'Phone Call', purpose: row.purpose || '', priority: row.priority || 'Medium', notes: row.notes || '' }; setFormData(next); setOriginalFormData(next); setEditor({ mode: 'edit', row }); };
  const hasUnsavedEditorChanges = Boolean(editor) && JSON.stringify(formData) !== JSON.stringify(originalFormData);
  const closeEditor = () => { if (hasUnsavedEditorChanges) setDiscardOpen(true); else setEditor(null); };
  const discardEditor = () => { setDiscardOpen(false); setEditor(null); setFormData(blankForm()); };
  const openAction = (type, row) => { setAction({ type, row }); if (type === 'reschedule') setReschedule({ followUpDate: '', reason: '' }); if (type === 'complete') setCompletion({ outcome: '', notes: '', another: 'No', nextDate: '' }); };
  const run = async (operation) => { setBusy(true); try { await operation(); setAction(null); } catch { /* Context presents the safe error. */ } finally { setBusy(false); } };
  const save = async (event) => { event.preventDefault(); setBusy(true); try { if (editor.mode === 'edit') await updateFollowUp(editor.row.id, { ...formData, customerId: formData.customerId?.trim() || null }); else await addFollowUp(formData); setEditor(null); setFormData(blankForm()); } catch { /* Preserve the draft. */ } finally { setBusy(false); } };
  const complete = () => run(async () => { await completeFollowUp(action.row.id, completion.outcome, completion.notes); if (completion.another === 'Yes') await addFollowUp({ customerId: action.row.customerId || '', customerName: action.row.customerName || '', followUpDate: completion.nextDate, type: action.row.type, purpose: `Next action after: ${completion.outcome}`, priority: action.row.priority, notes: completion.notes }); });
  const detail = (row) => setAction({ type: 'details', row });
  const columns = [
    { key: 'customerName', label: 'Organization / Person', render: (row) => <strong>{row.customerName || 'Not provided'}</strong> },
    { key: 'followUpDate', label: 'Due Date', render: (row) => <span className={['Pending', 'In Progress'].includes(row.status) && row.followUpDate < today ? 'follow-up-overdue' : ''}>{dateLabel(row.followUpDate)}{['Pending', 'In Progress'].includes(row.status) && row.followUpDate < today && <small>Overdue</small>}</span> },
    { key: 'type', label: 'Type', render: (row) => <Badge>{row.type}</Badge> },
    { key: 'purpose', label: 'Purpose / Objective' },
    { key: 'priority', label: 'Priority', render: (row) => <Badge tone={row.priority === 'High' ? 'danger' : 'neutral'}>{row.priority}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: 'actions', label: 'Actions', render: (row) => <div className="follow-up-actions">
      {row.status === 'Pending' && <Button title="Start" aria-label={`Start ${row.customerName || 'follow-up'}`} onClick={() => openAction('start', row)}><Play size={15} /> Start</Button>}
      {row.status === 'In Progress' && <Button title="Complete" aria-label={`Complete ${row.customerName || 'follow-up'}`} onClick={() => openAction('complete', row)}><Check size={15} /> Complete</Button>}
      <Button variant="secondary" title="View details" aria-label={`View ${row.customerName || 'follow-up'} details`} onClick={() => detail(row)}><Eye size={15} /></Button>
      {row.status === 'Pending' && <Button variant="secondary" title="Edit" aria-label={`Edit ${row.customerName || 'follow-up'}`} onClick={() => openEdit(row)}><Pencil size={15} /></Button>}
      {['Pending', 'In Progress'].includes(row.status) && <Button variant="secondary" title="Reschedule" aria-label={`Reschedule ${row.customerName || 'follow-up'}`} onClick={() => openAction('reschedule', row)}><CalendarClock size={15} /></Button>}
      {row.status === 'Pending' && <Button variant="danger" title="Delete" aria-label={`Delete ${row.customerName || 'follow-up'}`} onClick={() => openAction('delete', row)}><Trash2 size={15} /></Button>}
    </div> }
  ];
  return <div className="ds-page follow-up-page"><PageHeader title="Follow-ups" description="Keep every field commitment visible and on schedule." actions={<Button onClick={openAdd}><Plus size={16} /> Add Follow-up</Button>} />
    <div className="ds-segmented follow-up-filters" aria-label="Filter follow-ups">{['All', 'Pending', 'In Progress', 'Completed'].map((filter) => <button key={filter} type="button" className={filterView === filter ? 'active' : ''} aria-pressed={filterView === filter} onClick={() => setFilterView(filter)}><span>{filter}</span><span className="follow-up-filters__count">{counts[filter]}</span></button>)}</div>
    <DataTable caption="My scheduled follow-ups" columns={columns} rows={visible} empty={<EmptyState icon={Clock} title="No follow-ups scheduled" description="Add a follow-up to keep the next action on track." action={<Button onClick={openAdd}>Add Follow-up</Button>} />} />

    <Modal open={Boolean(editor)} onClose={closeEditor} title={editor?.mode === 'edit' ? 'Edit Follow-up' : 'Schedule New Follow-up'} footer={<><Button variant="secondary" onClick={closeEditor}>Cancel</Button><Button loading={busy} type="submit" form="follow-up-form">{editor?.mode === 'edit' ? 'Save Changes' : 'Schedule Follow-up'}</Button></>}>
      <form id="follow-up-form" onSubmit={save} className="ds-form-grid"><FormField className="ds-field--full" label="Organization / Person (Optional)" value={formData.customerName} onChange={(event) => update('customerName', event.target.value)} /><DateField label="Follow-up Date" required value={formData.followUpDate} onChange={(event) => update('followUpDate', event.target.value)} /><SelectField label="Follow-up Type" value={formData.type} onChange={(event) => update('type', event.target.value)}>{['Phone Call', 'Physical Visit', 'Email', 'Quotation', 'Product Demo'].map((type) => <option key={type}>{type}</option>)}</SelectField><TextArea className="ds-field--full" label="Purpose / Notes" required rows={3} value={formData.purpose} onChange={(event) => update('purpose', event.target.value)} /><SelectField label="Priority" value={formData.priority} onChange={(event) => update('priority', event.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField><TextArea label="Internal Notes" value={formData.notes} onChange={(event) => update('notes', event.target.value)} /></form>
    </Modal>

    <Modal open={action?.type === 'start'} onClose={() => setAction(null)} title="Start Follow-up?" size="sm" className="follow-up-confirm-modal" footer={<><Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button><Button loading={busy} onClick={() => run(() => startFollowUp(action.row.id))}>Start Follow-up</Button></>}><div className="follow-up-confirm"><p>Are you ready to start this follow-up?</p><div className="follow-up-confirm__meta"><span>{action?.row.customerName || 'Not provided'}</span><i aria-hidden="true">•</i><span>{dateLabel(action?.row.followUpDate)}</span></div></div></Modal>
    <Modal open={action?.type === 'delete'} onClose={() => setAction(null)} title="Delete Follow-up?" size="sm" className="follow-up-confirm-modal" footer={<><Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => run(() => deleteFollowUp(action.row.id))}>Delete Follow-up</Button></>}><div className="follow-up-confirm"><p>Are you sure you want to delete this follow-up?</p><div className="follow-up-confirm__meta"><span>{action?.row.customerName || 'Not provided'}</span><i aria-hidden="true">•</i><span>{dateLabel(action?.row.followUpDate)}</span></div></div></Modal>
    <Modal open={action?.type === 'reschedule'} onClose={() => setAction(null)} title="Reschedule Follow-up" size="sm" footer={<><Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button><Button loading={busy} disabled={!reschedule.followUpDate || !reschedule.reason.trim()} onClick={() => run(() => rescheduleFollowUp(action.row, reschedule.followUpDate, reschedule.reason))}>Reschedule</Button></>}><div className="ds-form-grid"><div className="ds-field ds-field--full"><span>Current Date</span><strong>{dateLabel(action?.row.followUpDate)}</strong></div><DateField label="New Follow-up Date" required value={reschedule.followUpDate} onChange={(event) => setReschedule((current) => ({ ...current, followUpDate: event.target.value }))} /><TextArea label="Reason" required value={reschedule.reason} onChange={(event) => setReschedule((current) => ({ ...current, reason: event.target.value }))} /></div></Modal>
    <Modal open={action?.type === 'complete'} onClose={() => setAction(null)} title="Complete Follow-up" footer={<><Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button><Button loading={busy} disabled={!completion.outcome.trim() || (completion.another === 'Yes' && !completion.nextDate)} onClick={complete}>Complete Follow-up</Button></>}><div className="ds-form-grid"><TextArea className="ds-field--full" label="Outcome / Result" required value={completion.outcome} onChange={(event) => setCompletion((current) => ({ ...current, outcome: event.target.value }))} /><TextArea className="ds-field--full" label="Next Action / Notes" value={completion.notes} onChange={(event) => setCompletion((current) => ({ ...current, notes: event.target.value }))} /><SelectField label="Need another follow-up?" value={completion.another} onChange={(event) => setCompletion((current) => ({ ...current, another: event.target.value }))}><option>No</option><option>Yes</option></SelectField>{completion.another === 'Yes' && <DateField label="Next Follow-up Date" required value={completion.nextDate} onChange={(event) => setCompletion((current) => ({ ...current, nextDate: event.target.value }))} />}</div></Modal>
    <Modal open={action?.type === 'details'} onClose={() => setAction(null)} title="Follow-up Details" size="lg" className="follow-up-details-modal" footer={<Button variant="secondary" onClick={() => setAction(null)}>Close</Button>}><dl className="follow-up-details">{action?.row && [['Organization / Person', action.row.customerName], ['Created Date', action.row.createdAt ? new Date(action.row.createdAt).toLocaleString() : 'Not provided'], ['Due Date', dateLabel(action.row.followUpDate)], ['Type', action.row.type], ['Priority', action.row.priority], ['Status', <Badge key="status" tone={statusTone(action.row.status)}>{action.row.status}</Badge>], ['Purpose / Objective', action.row.purpose], ['Internal Notes', action.row.notes], ['Started At', action.row.startedAt ? new Date(action.row.startedAt).toLocaleString() : null], ['Rescheduled At', action.row.rescheduledAt ? new Date(action.row.rescheduledAt).toLocaleString() : null], ['Completed At', action.row.completedAt ? new Date(action.row.completedAt).toLocaleString() : null], ['Outcome / Result', action.row.outcome], ['Completion Notes', action.row.completionNotes], ['Previous Date', action.row.previousFollowUpDate ? dateLabel(action.row.previousFollowUpDate) : null], ['Reschedule Reason', action.row.rescheduleReason]].filter(([, value]) => value).map(([label, value]) => <div className="follow-up-details__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Modal>
    <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard Changes?" size="sm" className="follow-up-confirm-modal" footer={<><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep Editing</Button><Button variant="danger" onClick={discardEditor}>Discard Changes</Button></>}><div className="follow-up-confirm"><p>You have unsaved changes. Do you want to discard them?</p></div></Modal>
    {relatedFollowUp ? <EntityDetailsModal open={Boolean(searchParams.get('followUpId'))} onClose={closeRelated} type="followUp" entity={relatedFollowUp} /> : searchParams.get('followUpId') ? <Modal open title="Follow-up Details" onClose={closeRelated} footer={<Button variant="secondary" onClick={closeRelated}>Close</Button>}><div className="ds-error">This related record was deleted.</div></Modal> : null}
  </div>;
};

export default FollowUpManagement;
