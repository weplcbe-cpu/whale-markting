import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, DateField, FormField, Modal, SearchableCustomerSelect, SelectField, Stepper, TextArea } from '../ui';

const DRAFT_KEY = 'marketing-visit-plan-draft';
const DESTINATIONS = ['Existing Customer', 'New Organization', 'No Customer / General Visit'];
const productRelated = (purpose) => /(product|demo|quotation|sales)/i.test(purpose || '');
const emptyPlan = (purposes) => ({
  visitDate: new Date().toISOString().slice(0, 10),
  expectedTime: '10:30 AM',
  destinationType: 'Existing Customer',
  customerId: '',
  customerName: '',
  organizationName: '',
  organizationType: '',
  contactPerson: '',
  mobileNumber: '',
  state: 'Tamil Nadu',
  district: '',
  city: '',
  area: '',
  visitPurpose: purposes[0] || '',
  selectedProducts: [],
  requirement: '',
  priority: 'Medium',
  notes: ''
});

export const AddVisitPlan = ({ open = true, onClose = () => {} }) => {
  const { customers, products, purposes, addVisitPlan, showToast } = useApp();
  const navigate = useNavigate();
  const initialData = useMemo(() => emptyPlan(purposes), [purposes]);
  const [formData, setFormData] = useState(initialData);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saved');
  const [error, setError] = useState('');
  const submissionKey = useRef(crypto.randomUUID());
  const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
  const update = (field, value) => {
    setError('');
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const validateStep = (targetStep = step) => {
    if (targetStep === 0 && (!formData.visitDate || !formData.expectedTime || !formData.area.trim())) return 'Enter the visit date, expected time, and area or city.';
    if (targetStep === 1 && formData.destinationType === 'Existing Customer' && !formData.customerId) return 'Choose an existing customer, or select another destination type.';
    if (targetStep === 1 && formData.destinationType === 'New Organization' && !formData.organizationName.trim()) return 'Enter the organization name.';
    if (targetStep === 2 && (!formData.visitPurpose || !formData.requirement.trim())) return 'Enter the visit purpose and requirement or objective.';
    if (targetStep === 2 && productRelated(formData.visitPurpose) && !formData.selectedProducts.length && !formData.requirement.trim()) return 'Select a product or describe the custom requirement.';
    return '';
  };

  const next = () => {
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    setStep((current) => current + 1);
  };

  const selectCustomer = (id) => {
    const customer = customers.find((item) => String(item.id) === id);
    if (!customer) return;
    setError('');
    setFormData((current) => ({
      ...current,
      customerId: customer.id,
      customerName: customer.organizationName || customer.customerName || '',
      organizationName: customer.organizationName || '',
      organizationType: customer.organizationType || '',
      contactPerson: customer.contactPerson || '',
      mobileNumber: customer.mobileNumber || customer.mobile || '',
      area: customer.area || customer.city || current.area,
      district: customer.district || '',
      city: customer.city || ''
    }));
  };

  const changeDestination = (destinationType) => {
    setError('');
    setFormData((current) => ({
      ...current,
      destinationType,
      customerId: destinationType === 'Existing Customer' ? current.customerId : '',
      customerName: destinationType === 'Existing Customer' ? current.customerName : '',
      organizationName: destinationType === 'New Organization' ? current.organizationName : '',
      organizationType: destinationType === 'No Customer / General Visit' ? '' : current.organizationType,
      contactPerson: destinationType === 'No Customer / General Visit' ? '' : current.contactPerson,
      mobileNumber: destinationType === 'No Customer / General Visit' ? '' : current.mobileNumber
    }));
  };

  const toggleProduct = (name) => update('selectedProducts', formData.selectedProducts.includes(name)
    ? formData.selectedProducts.filter((item) => item !== name)
    : [...formData.selectedProducts, name]);

  const saveDraft = useCallback((notify = true) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    setDraftStatus('saved');
    if (notify) showToast?.('Visit plan draft saved', 'success');
  }, [formData, showToast]);

  const submit = async () => {
    if (submitting) return;
    const validation = validateStep(2);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const saved = await addVisitPlan({ ...formData, products: formData.selectedProducts, submissionKey: submissionKey.current });
      if (!saved) throw new Error('The visit plan was not saved.');
      localStorage.removeItem(DRAFT_KEY);
      submissionKey.current = crypto.randomUUID();
      showToast?.('Visit plan submitted for Director approval.', 'success');
      onClose();
    } catch (submissionError) {
      setError(submissionError?.message || 'Unable to submit the visit plan. Your draft has been preserved.');
      saveDraft(false);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) {
      setFormData(initialData);
      setStep(0);
      return;
    }
    try {
      setFormData({ ...initialData, ...JSON.parse(saved) });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [initialData, open]);

  useEffect(() => {
    if (!open || !dirty) return undefined;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => saveDraft(false), 700);
    return () => window.clearTimeout(timer);
  }, [dirty, open, saveDraft]);

  const destinationName = formData.destinationType === 'Existing Customer'
    ? formData.customerName
    : formData.destinationType === 'New Organization'
      ? formData.organizationName
      : 'General visit';

  const footer = <>
    <div className="ds-draft-status" role="status">{draftStatus === 'saving' ? 'Saving…' : <><Check size={16} /> Draft saved</>}</div>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="ghost" onClick={() => saveDraft()}>Save Draft</Button>
    {step > 0 && <Button variant="secondary" onClick={() => { setError(''); setStep(step - 1); }}>Back</Button>}
    {step < 3
      ? <Button onClick={next}>Continue</Button>
      : <Button onClick={submit} loading={submitting} disabled={submitting}><Save size={16} /> Submit for Director Approval</Button>}
  </>;

  return <Modal open={open} onClose={onClose} dirty={dirty} title="Create Visit Plan" subtitle="Tell the Director where you are going, whom you will meet, and why." footer={footer}>
    <Stepper steps={['Date, time & area', 'Destination', 'Purpose & requirement', 'Review & submit']} current={step} />
    {error && <div className="form-error ds-field--full" role="alert">{error}</div>}
    <div key={step} className="ds-step-panel">
      {step === 0 && <div className="ds-form-grid">
        <DateField label="Visit Date" required value={formData.visitDate} onChange={(event) => update('visitDate', event.target.value)} />
        <FormField label="Expected Time" required value={formData.expectedTime} onChange={(event) => update('expectedTime', event.target.value)} />
        <FormField className="ds-field--full" label="Where are you going?" hint="Area / City" required value={formData.area} onChange={(event) => update('area', event.target.value)} />
      </div>}

      {step === 1 && <div className="ds-form-grid">
        <SelectField className="ds-field--full" label="Visit Destination Type" required value={formData.destinationType} onChange={(event) => changeDestination(event.target.value)}>
          {DESTINATIONS.map((destination) => <option key={destination}>{destination}</option>)}
        </SelectField>
        {formData.destinationType === 'Existing Customer' && <>
          {customers.length
            ? <SearchableCustomerSelect customers={customers} value={formData.customerId} onChange={selectCustomer} onAddCustomer={() => { onClose(); navigate('/marketing/customers?action=add-customer'); }} required hint="Search existing customers. Add Customer remains optional." />
            : <div className="ds-summary ds-field--full"><strong>No customers are available yet.</strong><span>Select New Organization or General Visit to continue, or add a customer when needed.</span></div>}
          {formData.customerId && <div className="ds-summary ds-field--full"><strong>{formData.customerName}</strong><span>{formData.contactPerson || 'Contact not provided'} · {formData.mobileNumber || 'Mobile not provided'}</span><span>{formData.area || formData.city || 'Area not provided'}</span></div>}
        </>}
        {formData.destinationType === 'New Organization' && <>
          <FormField label="Organization Name" required value={formData.organizationName} onChange={(event) => update('organizationName', event.target.value)} />
          <FormField label="Organization Type" value={formData.organizationType} onChange={(event) => update('organizationType', event.target.value)} />
          <FormField label="Who are you meeting?" hint="Contact Person" value={formData.contactPerson} onChange={(event) => update('contactPerson', event.target.value)} />
          <FormField label="Mobile Number" value={formData.mobileNumber} onChange={(event) => update('mobileNumber', event.target.value)} />
          <div className="ds-summary ds-field--full"><span>This organization stays on this visit plan. It will not be added as a customer automatically.</span></div>
        </>}
        {formData.destinationType === 'No Customer / General Visit' && <div className="ds-summary ds-field--full"><strong>No customer is required.</strong><span>Use this for service, inspection, collection, area survey, and general Marketing visits.</span></div>}
      </div>}

      {step === 2 && <div className="ds-form-grid">
        <SelectField label="Why are you visiting?" required value={formData.visitPurpose} onChange={(event) => update('visitPurpose', event.target.value)}>
          {!purposes.length && <option value="">No configured purposes — enter one below</option>}
          {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
        </SelectField>
        {!purposes.length && <FormField label="Visit Purpose" required value={formData.visitPurpose} onChange={(event) => update('visitPurpose', event.target.value)} />}
        <SelectField label="Priority" value={formData.priority} onChange={(event) => update('priority', event.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField>
        <fieldset className="ds-field ds-field--full"><legend>What product or requirement is involved?</legend>
          {products.length
            ? <div className="ds-choice-grid">{products.map((product) => <label className="ds-choice" key={product.id}><input type="checkbox" checked={formData.selectedProducts.includes(product.name)} onChange={() => toggleProduct(product.name)} /><span>{product.name}</span></label>)}</div>
            : <p className="ds-field-hint">No products are configured. Describe the custom requirement below.</p>}
        </fieldset>
        <TextArea className="ds-field--full" label="Requirement / Objective" required rows={4} value={formData.requirement} onChange={(event) => update('requirement', event.target.value)} />
        <TextArea className="ds-field--full" label="Notes" value={formData.notes} onChange={(event) => update('notes', event.target.value)} />
      </div>}

      {step === 3 && <div className="ds-review"><h3>Review visit plan</h3><dl>
        <dt>Where</dt><dd>{formData.area} · {destinationName || 'Not provided'}</dd>
        <dt>When</dt><dd>{formData.visitDate} at {formData.expectedTime}</dd>
        <dt>Whom</dt><dd>{formData.contactPerson || (formData.destinationType === 'No Customer / General Visit' ? 'General visit' : 'Not provided')}{formData.mobileNumber ? ` · ${formData.mobileNumber}` : ''}</dd>
        <dt>Why</dt><dd>{formData.visitPurpose}</dd>
        <dt>Products</dt><dd>{formData.selectedProducts.join(', ') || 'Custom / no configured product'}</dd>
        <dt>Requirement</dt><dd>{formData.requirement}</dd>
        <dt>Priority</dt><dd>{formData.priority}</dd>
      </dl></div>}
    </div>
  </Modal>;
};
