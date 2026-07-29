import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, DateField, EmptyState, FormField, Modal, PageHeader, Stepper, TextArea } from '../ui';

const DRAFT_KEY = 'marketing-tender-draft';
export const TenderManagement = () => {
  const { currentUser, tenders, addTender, showToast } = useApp();
  const initialData = useMemo(() => ({ tenderName: '', tenderNumber: '', department: '', closingDate: '', tenderValue: '', requiredProducts: ['Whale Super Sucker'], notes: '' }), []);
  const [formData, setFormData] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const myTenders = tenders.filter((item) => !item.assignedEmployeeId || item.assignedEmployeeId === (currentUser?.employeeId || 'EMP001'));
  const relatedTender = myTenders.find((item) => item.id === searchParams.get('tenderId'));
  const closeRelated = () => { const next = new URLSearchParams(searchParams); next.delete('tenderId'); setSearchParams(next, { replace: true }); };
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const saveDraft = () => { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); showToast?.('Tender draft saved', 'success'); };
  const submit = async () => { if (!formData.tenderName.trim()) return; await addTender(formData); localStorage.removeItem(DRAFT_KEY); setIsModalOpen(false); };
  const columns = [{ key: 'name', label: 'Tender Name / Ref', render: (row) => <><strong>{row.tenderName}</strong><small>{row.tenderNumber}</small></> },
    { key: 'department', label: 'Department' }, { key: 'closingDate', label: 'Closing Date' }, { key: 'tenderValue', label: 'Tender Value' },
    { key: 'products', label: 'Products Required', render: (row) => Array.isArray(row.requiredProducts) ? row.requiredProducts.join(', ') : row.requiredProducts },
    { key: 'status', label: 'Status', render: (row) => <Badge tone="info">{row.status}</Badge> }];
  return <div className="ds-page"><PageHeader title="Tender Opportunities" description="Log new tender enquiries and track their progression."
    actions={<Button onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Tender Enquiry</Button>} />
    <DataTable columns={columns} rows={myTenders} empty={<EmptyState title="No tender opportunities" description="Add an enquiry to begin tracking its closing date and requirements." action={<Button onClick={() => setIsModalOpen(true)}>Add Tender Enquiry</Button>} />} />
    <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} dirty={JSON.stringify(formData) !== JSON.stringify(initialData)} title="Log Tender Opportunity" subtitle="Capture the tender details and review them before saving."
      footer={<><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button variant="ghost" onClick={saveDraft}>Save Draft</Button>{step > 0 && <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>}{step === 0 ? <Button onClick={() => setStep(1)} disabled={!formData.tenderName || !formData.closingDate}>Continue</Button> : <Button onClick={submit}>Save Tender</Button>}</>}>
      <Stepper steps={['Tender details', 'Requirements & review']} current={step} />
      {step === 0 ? <div className="ds-form-grid"><FormField className="ds-field--full" label="Tender Name" required value={formData.tenderName} onChange={(e) => update('tenderName', e.target.value)} /><FormField label="Tender Number / Reference" value={formData.tenderNumber} onChange={(e) => update('tenderNumber', e.target.value)} /><DateField label="Closing Date" required value={formData.closingDate} onChange={(e) => update('closingDate', e.target.value)} /><FormField className="ds-field--full" label="Department / Issuing Authority" value={formData.department} onChange={(e) => update('department', e.target.value)} /></div>
        : <div className="ds-form-grid"><FormField label="Tender Value" value={formData.tenderValue} onChange={(e) => update('tenderValue', e.target.value)} /><FormField label="Products Required" value={formData.requiredProducts.join(', ')} onChange={(e) => update('requiredProducts', e.target.value.split(',').map((value) => value.trim()).filter(Boolean))} hint="Separate multiple products with commas" /><TextArea className="ds-field--full" label="Notes" rows={3} value={formData.notes} onChange={(e) => update('notes', e.target.value)} /><div className="ds-review ds-field--full"><h3>Review tender</h3><dl><dt>Name</dt><dd>{formData.tenderName}</dd><dt>Reference</dt><dd>{formData.tenderNumber || '—'}</dd><dt>Authority</dt><dd>{formData.department || '—'}</dd><dt>Closing date</dt><dd>{formData.closingDate}</dd><dt>Value</dt><dd>{formData.tenderValue || '—'}</dd></dl></div></div>}
    </Modal>
    <Modal open={Boolean(searchParams.get('tenderId'))} onClose={closeRelated} title="Tender Details" footer={<Button variant="secondary" onClick={closeRelated}>Close</Button>}>
      {relatedTender ? <div className="director-feedback-detail"><div><small>Tender</small><strong>{relatedTender.tenderName}</strong></div><div><small>Reference</small><strong>{relatedTender.tenderNumber || 'Not provided'}</strong></div><div><small>Closing Date</small><strong>{relatedTender.closingDate}</strong></div><p>{relatedTender.notes || 'No additional notes.'}</p></div> : <div className="ds-error">This related record is no longer available.</div>}
    </Modal>
  </div>;
};
export default TenderManagement;
