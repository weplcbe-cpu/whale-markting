import React, { useMemo, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, DateField, EmptyState, Modal, PageHeader, SelectField, TextArea } from '../ui';

export const FollowUpManagement = () => {
  const { currentUser, customers, followUps, addFollowUp } = useApp();
  const [filterView, setFilterView] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialData = useMemo(() => ({ customerId: customers[0]?.id || '', customerName: customers[0]?.organizationName || '',
    followUpDate: new Date().toISOString().slice(0, 10), type: 'Phone Call', purpose: '', priority: 'High', notes: '' }), [customers]);
  const [formData, setFormData] = useState(initialData);
  const empId = currentUser?.employeeId || 'EMP001';
  const myFollowups = followUps.filter((item) => item.employeeId === empId && (filterView === 'All' || item.status === filterView));
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const save = async (event) => { event.preventDefault(); await addFollowUp(formData); setIsModalOpen(false); };
  const columns = [
    { key: 'customerName', label: 'Customer', render: (row) => <strong>{row.customerName}</strong> }, { key: 'followUpDate', label: 'Due Date' },
    { key: 'type', label: 'Type', render: (row) => <Badge>{row.type}</Badge> }, { key: 'purpose', label: 'Purpose / Objective' },
    { key: 'priority', label: 'Priority', render: (row) => <Badge tone={row.priority === 'High' ? 'danger' : 'neutral'}>{row.priority}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'Completed' ? 'success' : 'warning'}>{row.status}</Badge> }
  ];
  return <div className="ds-page"><PageHeader title="Follow-ups" description="Keep every customer commitment visible and on schedule."
    actions={<Button onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Follow-up</Button>} />
    <div className="ds-segmented" aria-label="Filter follow-ups">{['All', 'Pending'].map((filter) => <button key={filter} className={filterView === filter ? 'active' : ''} onClick={() => setFilterView(filter)}>{filter}{filter === 'All' ? ` (${myFollowups.length})` : ''}</button>)}</div>
    <DataTable caption="My scheduled follow-ups" columns={columns} rows={myFollowups} empty={<EmptyState icon={Clock} title="No follow-ups scheduled" description="Add a follow-up to keep the next customer action on track." action={<Button onClick={() => setIsModalOpen(true)}>Add Follow-up</Button>} />} />
    <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} dirty={JSON.stringify(formData) !== JSON.stringify(initialData)} title="Schedule New Follow-up" subtitle="Add the next action for a customer."
      footer={<><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit" form="follow-up-form">Schedule Follow-up</Button></>}>
      <form id="follow-up-form" onSubmit={save} className="ds-form-grid"><SelectField className="ds-field--full" label="Customer" required value={formData.customerId} onChange={(e) => { const customer = customers.find((item) => String(item.id) === e.target.value); if (customer) setFormData((current) => ({ ...current, customerId: customer.id, customerName: customer.organizationName })); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.organizationName}</option>)}</SelectField><DateField label="Follow-up Date" required value={formData.followUpDate} onChange={(e) => update('followUpDate', e.target.value)} /><SelectField label="Follow-up Type" value={formData.type} onChange={(e) => update('type', e.target.value)}>{['Phone Call', 'Physical Visit', 'Email', 'Quotation', 'Product Demo', 'Tender'].map((type) => <option key={type}>{type}</option>)}</SelectField><TextArea className="ds-field--full" label="Purpose / Notes" required rows={3} value={formData.purpose} onChange={(e) => update('purpose', e.target.value)} /><details className="ds-more ds-field--full"><summary>More options</summary><div className="ds-form-grid"><SelectField label="Priority" value={formData.priority} onChange={(e) => update('priority', e.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField><TextArea label="Internal notes" value={formData.notes} onChange={(e) => update('notes', e.target.value)} /></div></details></form>
    </Modal>
  </div>;
};

export default FollowUpManagement;
