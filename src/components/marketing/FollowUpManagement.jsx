import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, DateField, EmptyState, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';
import { EntityDetailsModal } from '../common/details';

export const FollowUpManagement = () => {
  const { currentUser, followUps, addFollowUp } = useApp();
  const [filterView, setFilterView] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialData = useMemo(() => ({ customerId: '', customerName: '', followUpDate: new Date().toISOString().slice(0, 10), type: 'Phone Call', purpose: '', priority: 'High', notes: '' }), []);
  const [formData, setFormData] = useState(initialData);
  const empId = currentUser?.employeeId || 'EMP001';
  const myFollowups = followUps.filter((item) => item.employeeId === empId && (filterView === 'All' || item.status === filterView));
  const relatedFollowUp = followUps.find((item) => item.id === searchParams.get('followUpId') && item.employeeId === empId);
  const closeRelated = () => { const next = new URLSearchParams(searchParams); next.delete('followUpId'); setSearchParams(next, { replace: true }); };
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const save = async (event) => { event.preventDefault(); await addFollowUp(formData); setIsModalOpen(false); };
  const columns = [
    { key: 'customerName', label: 'Organization / Person', render: (row) => <strong>{row.customerName || 'Not provided'}</strong> },
    { key: 'followUpDate', label: 'Due Date' },
    { key: 'type', label: 'Type', render: (row) => <Badge>{row.type}</Badge> },
    { key: 'purpose', label: 'Purpose / Objective' },
    { key: 'priority', label: 'Priority', render: (row) => <Badge tone={row.priority === 'High' ? 'danger' : 'neutral'}>{row.priority}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'Completed' ? 'success' : 'warning'}>{row.status}</Badge> }
  ];
  return <div className="ds-page"><PageHeader title="Follow-ups" description="Keep every field commitment visible and on schedule." actions={<Button onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Follow-up</Button>} />
    <div className="ds-segmented" aria-label="Filter follow-ups">{['All', 'Pending'].map((filter) => <button key={filter} className={filterView === filter ? 'active' : ''} onClick={() => setFilterView(filter)}>{filter}{filter === 'All' ? ` (${myFollowups.length})` : ''}</button>)}</div>
    <DataTable caption="My scheduled follow-ups" columns={columns} rows={myFollowups} empty={<EmptyState icon={Clock} title="No follow-ups scheduled" description="Add a follow-up to keep the next action on track." action={<Button onClick={() => setIsModalOpen(true)}>Add Follow-up</Button>} />} />
    <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} dirty={JSON.stringify(formData) !== JSON.stringify(initialData)} title="Schedule New Follow-up" subtitle="Add the next action." footer={<><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit" form="follow-up-form">Schedule Follow-up</Button></>}>
      <form id="follow-up-form" onSubmit={save} className="ds-form-grid"><FormField className="ds-field--full" label="Organization / Person (Optional)" value={formData.customerName} onChange={(event) => update('customerName', event.target.value)} /><DateField label="Follow-up Date" required value={formData.followUpDate} onChange={(event) => update('followUpDate', event.target.value)} /><SelectField label="Follow-up Type" value={formData.type} onChange={(event) => update('type', event.target.value)}>{['Phone Call', 'Physical Visit', 'Email', 'Quotation', 'Product Demo'].map((type) => <option key={type}>{type}</option>)}</SelectField><TextArea className="ds-field--full" label="Purpose / Notes" required rows={3} value={formData.purpose} onChange={(event) => update('purpose', event.target.value)} /><SelectField label="Priority" value={formData.priority} onChange={(event) => update('priority', event.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField><TextArea label="Internal Notes" value={formData.notes} onChange={(event) => update('notes', event.target.value)} /></form>
    </Modal>
    {relatedFollowUp ? <EntityDetailsModal open={Boolean(searchParams.get('followUpId'))} onClose={closeRelated} type="followUp" entity={relatedFollowUp} /> : searchParams.get('followUpId') ? <Modal open title="Follow-up Details" onClose={closeRelated} footer={<Button variant="secondary" onClick={closeRelated}>Close</Button>}><div className="ds-error">This related record was deleted.</div></Modal> : null}
  </div>;
};

export default FollowUpManagement;
