import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, DateField, FormField, Modal, SearchableCustomerSelect, SelectField, Stepper, TextArea } from '../ui';

const DRAFT_KEY = 'marketing-visit-plan-draft';

export const AddVisitPlan = ({ open = true, onClose = () => {} }) => {
  const { customers, products, purposes, addVisitPlan, showToast } = useApp();
  const navigate = useNavigate();
  const initialData = useMemo(() => ({ visitDate: new Date().toISOString().slice(0, 10), expectedTime: '10:30 AM', customerId: '', customerName: '', organizationType: '', contactPerson: '', mobile: '', state: 'Tamil Nadu', district: '', city: '', area: '', visitPurpose: purposes[0] || 'Product Demo', selectedProducts: [], requirement: '', priority: 'Medium', isTenderRelated: false, notes: '' }), [purposes]);
  const [formData, setFormData] = useState(initialData);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saved');
  const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
  const canContinue = step !== 0 || Boolean(formData.visitDate && formData.expectedTime && formData.customerId);
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const selectCustomer = (id) => { const customer = customers.find((item) => String(item.id) === id); if (!customer) return; setFormData((current) => ({ ...current, customerId: customer.id, customerName: customer.organizationName, organizationType: customer.organizationType, contactPerson: customer.contactPerson, mobile: customer.mobile, district: customer.district, city: customer.city })); };
  const toggleProduct = (name) => update('selectedProducts', formData.selectedProducts.includes(name) ? formData.selectedProducts.filter((item) => item !== name) : [...formData.selectedProducts, name]);
  const saveDraft = useCallback((notify = true) => { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); setDraftStatus('saved'); if (notify) showToast?.('Visit plan draft saved', 'success'); }, [formData, showToast]);
  const submit = async () => { setSubmitting(true); try { await addVisitPlan({ ...formData, products: formData.selectedProducts }); localStorage.removeItem(DRAFT_KEY); onClose(); } finally { setSubmitting(false); } };
  useEffect(() => { if (!open || !dirty) return undefined; setDraftStatus('saving'); const timer = window.setTimeout(() => saveDraft(false), 700); return () => window.clearTimeout(timer); }, [dirty, open, saveDraft]);
  useEffect(() => { if (!open) return undefined; const shortcuts = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveDraft(); } else if (event.key === 'Enter' && step < 2 && canContinue && !['TEXTAREA', 'BUTTON'].includes(event.target.tagName) && event.target.getAttribute('role') !== 'combobox') { event.preventDefault(); setStep((current) => current + 1); } }; window.addEventListener('keydown', shortcuts); return () => window.removeEventListener('keydown', shortcuts); }, [canContinue, open, saveDraft, step]);

  const footer = <><div className="ds-draft-status" role="status">{draftStatus === 'saving' ? 'Saving…' : <><Check size={16} /> Draft saved</>}</div><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="ghost" onClick={() => saveDraft()}>Save Draft</Button>{step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}{step < 2 ? <div className="ds-primary-action"><Button onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</Button>{!canContinue && <small>Select a customer to continue</small>}</div> : <Button onClick={submit} loading={submitting}><Save size={16} /> Submit Visit Plan</Button>}</>;
  return <Modal open={open} onClose={onClose} dirty={dirty} title="Create Visit Plan" subtitle="Plan the customer visit, add its objective, then review before saving." footer={footer}>
    <Stepper steps={['Date & customer', 'Visit details', 'Review']} current={step} />
    <div key={step} className="ds-step-panel">
      {step === 0 && <div className="ds-form-grid ds-visit-basics"><DateField label="Visit Date" hint="Choose the planned visit date" required value={formData.visitDate} onChange={(event) => update('visitDate', event.target.value)} /><FormField label="Expected Time" hint="Approximate arrival time" required value={formData.expectedTime} onChange={(event) => update('expectedTime', event.target.value)} /><SearchableCustomerSelect customers={customers} value={formData.customerId} onChange={selectCustomer} onAddCustomer={() => { onClose(); navigate('/marketing/customers?action=add-customer'); }} required hint="Search by customer name or organization" />{formData.customerId && <div className="ds-summary ds-field--full"><strong>{formData.customerName}</strong><span>{formData.contactPerson} · {formData.mobile}</span><span>{formData.city}, {formData.district}</span></div>}</div>}
      {step === 1 && <div className="ds-form-grid"><SelectField label="Visit Purpose" required value={formData.visitPurpose} onChange={(event) => update('visitPurpose', event.target.value)}>{purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}</SelectField><SelectField label="Priority" required value={formData.priority} onChange={(event) => update('priority', event.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField><fieldset className="ds-field ds-field--full"><legend>Products</legend><div className="ds-choice-grid">{products.map((product) => <label className="ds-choice" key={product.id}><input type="checkbox" checked={formData.selectedProducts.includes(product.name)} onChange={() => toggleProduct(product.name)} /><span>{product.name}</span></label>)}</div></fieldset><TextArea className="ds-field--full" label="Requirement / Objective" rows={4} value={formData.requirement} onChange={(event) => update('requirement', event.target.value)} /><details className="ds-more ds-field--full"><summary>More details</summary><div className="ds-form-grid"><FormField label="Area" value={formData.area} onChange={(event) => update('area', event.target.value)} /><TextArea label="Internal Notes" value={formData.notes} onChange={(event) => update('notes', event.target.value)} /></div></details></div>}
      {step === 2 && <div className="ds-review"><h3>Review visit plan</h3><dl><dt>Date & time</dt><dd>{formData.visitDate} at {formData.expectedTime}</dd><dt>Customer</dt><dd>{formData.customerName}</dd><dt>Purpose</dt><dd>{formData.visitPurpose}</dd><dt>Products</dt><dd>{formData.selectedProducts.join(', ') || 'None selected'}</dd><dt>Priority</dt><dd>{formData.priority}</dd><dt>Objective</dt><dd>{formData.requirement || '—'}</dd></dl></div>}
    </div>
  </Modal>;
};
