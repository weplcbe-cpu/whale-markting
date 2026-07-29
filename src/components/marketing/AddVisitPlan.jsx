import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, DateField, FormField, Modal, SelectField, Stepper, TextArea } from '../ui';

const DRAFT_KEY = 'marketing-visit-plan-draft';
const DESTINATIONS = ['New Organization', 'General Visit'];
const productRelated = (purpose) => /(product|demo|quotation|sales)/i.test(purpose || '');
const emptyPlan = (purposes) => ({
  visitDate: new Date().toISOString().slice(0, 10),
  expectedTime: '10:30 AM',
  destinationType: 'New Organization',
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
  const { products, purposes, addVisitPlan, showToast } = useApp();
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
    if (targetStep === 2 && !formData.visitPurpose) return 'Enter the visit purpose.';
    if (targetStep === 2 && productRelated(formData.visitPurpose) && !formData.selectedProducts.length) return 'Select at least one product for this visit purpose.';
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

  const changeDestination = (destinationType) => {
    setError('');
    setFormData((current) => ({
      ...current,
      destinationType,
      customerId: destinationType === 'Existing Customer' ? current.customerId : '',
      customerName: destinationType === 'Existing Customer' ? current.customerName : '',
      organizationName: destinationType === 'New Organization' ? current.organizationName : '',
      organizationType: destinationType === 'General Visit' ? '' : current.organizationType,
      contactPerson: destinationType === 'General Visit' ? '' : current.contactPerson,
      mobileNumber: destinationType === 'General Visit' ? '' : current.mobileNumber
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
      showToast?.('Visit Plan Submitted Successfully.', 'success');
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
      : <Button onClick={submit} loading={submitting} disabled={submitting}><Save size={16} /> Submit Visit Plan</Button>}
  </>;

  return <Modal open={open} onClose={onClose} dirty={dirty} title="Create Visit Plan" subtitle="Enter where you are going, whom you will meet, and why." footer={footer}>
    <Stepper steps={['Date, time & area', 'Destination', 'Purpose & requirement', 'Review & submit']} current={step} />
    {error && <div className="form-error ds-field--full" role="alert">{error}</div>}
    <div key={step} className="ds-step-panel">
      {step === 0 && <div className="ds-form-grid">
        <DateField label="Visit Date" required value={formData.visitDate} onChange={(event) => update('visitDate', event.target.value)} />
        <FormField label="Expected Time" required value={formData.expectedTime} onChange={(event) => update('expectedTime', event.target.value)} />
        <FormField className="ds-field--full" label="Where are you going?" hint="Area / City" required value={formData.area} onChange={(event) => update('area', event.target.value)} />
      </div>}

      {step === 1 && <div className="ds-form-grid">
        <SelectField className="ds-field--full" label="Visit Type" value={formData.destinationType} onChange={(event) => changeDestination(event.target.value)}>
          {DESTINATIONS.map((destination) => <option key={destination}>{destination}</option>)}
        </SelectField>
        {formData.destinationType === 'New Organization' && <>
          <div className="ds-summary ds-field--full"><strong>Organization / Person to Meet (Optional)</strong></div>
          <FormField label="Organization Name (Optional)" value={formData.organizationName} onChange={(event) => update('organizationName', event.target.value)} />
          <FormField label="Organization Type" value={formData.organizationType} onChange={(event) => update('organizationType', event.target.value)} />
          <FormField label="Who are you meeting?" hint="Contact Person" value={formData.contactPerson} onChange={(event) => update('contactPerson', event.target.value)} />
          <FormField label="Mobile Number" value={formData.mobileNumber} onChange={(event) => update('mobileNumber', event.target.value)} />
          <div className="ds-summary ds-field--full"><span>This organization is stored only with this visit plan.</span></div>
        </>}
        {formData.destinationType === 'General Visit' && <div className="ds-summary ds-field--full"><strong>No organization is required.</strong><span>Use this for service, inspection, collection, area survey, and general Marketing visits.</span></div>}
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
        <TextArea className="ds-field--full" label="Requirement / Objective (Optional)" rows={4} value={formData.requirement} onChange={(event) => update('requirement', event.target.value)} />
        <TextArea className="ds-field--full" label="Notes (Optional)" value={formData.notes} onChange={(event) => update('notes', event.target.value)} />
      </div>}

      {step === 3 && <div className="ds-review"><h3>Review Visit Plan</h3><dl>
        <dt>Where</dt><dd>{formData.area} · {destinationName || 'Not provided'}</dd>
        <dt>When</dt><dd>{formData.visitDate} at {formData.expectedTime}</dd>
        <dt>Whom</dt><dd>{formData.contactPerson || (formData.destinationType === 'General Visit' ? 'General visit' : 'Not provided')}{formData.mobileNumber ? ` · ${formData.mobileNumber}` : ''}</dd>
        <dt>Why</dt><dd>{formData.visitPurpose}</dd>
        <dt>Products</dt><dd>{formData.selectedProducts.join(', ') || 'Custom / no configured product'}</dd>
        <dt>Requirement (Optional)</dt><dd>{formData.requirement || 'Not provided'}</dd>
        <dt>Priority</dt><dd>{formData.priority}</dd>
      </dl></div>}
    </div>
  </Modal>;
};
