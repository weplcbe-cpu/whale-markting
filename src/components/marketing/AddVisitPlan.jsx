import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, DateField, FormField, Modal, SelectField, TextArea } from '../ui';

const DRAFT_KEY = 'marketing-visit-plan-draft';
const ORGANIZATION_TYPES = ['Corporation', 'Municipality', 'Government Department', 'Private Company', 'Contractor', 'Dealer', 'Consultant', 'Other'];
const PURPOSES = ['Product Demo', 'Product Presentation', 'Service Visit', 'Follow-up Visit', 'New Requirement', 'Quotation Discussion', 'Payment Follow-up', 'General Visit', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PRODUCT_REQUIRED_PURPOSES = new Set(['Product Demo', 'Product Presentation', 'New Requirement', 'Quotation Discussion']);

const todayIso = () => new Date().toISOString().slice(0, 10);
const roundedTime = () => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  if (date.getMinutes() === 60) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  }
  const hour24 = date.getHours();
  return {
    hour: String(hour24 % 12 || 12).padStart(2, '0'),
    minute: String(date.getMinutes()).padStart(2, '0'),
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
};
const formatDate = (value) => value
  ? value.split('-').reverse().join('-')
  : '';
const emptyPlan = () => ({
  visitDate: todayIso(),
  visitPlace: '',
  destinationType: 'General Visit',
  organizationName: '',
  organizationType: '',
  customOrganizationType: '',
  contactPerson: '',
  mobileNumber: '',
  visitPurpose: 'General Visit',
  customVisitPurpose: '',
  selectedProducts: [],
  priority: 'Medium',
  requirement: '',
  notes: '',
  ...roundedTime(),
});

export const AddVisitPlan = ({ open = true, onClose = () => {}, plan = null }) => {
  const {
    currentUser,
    products,
    visitPlans,
    employeeVisitPlaces,
    addVisitPlan,
    showToast,
  } = useApp();
  const initialData = useMemo(() => ({
    ...emptyPlan(),
    ...(plan ? {
      ...plan,
      visitPlace: plan.area || plan.city || '',
      selectedProducts: plan.products || [],
    } : {}),
  }), [plan]);
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saved');
  const [organizationMode, setOrganizationMode] = useState('new');
  const submissionKey = useRef(plan?.submissionKey || crypto.randomUUID());
  const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  const assignedPlaces = useMemo(() => employeeVisitPlaces
    .filter((item) => item.employeeId === currentUser?.employeeId && item.isActive !== false)
    .map((item) => item.placeName)
    .filter((place, index, list) => place && list.indexOf(place) === index)
    .sort(), [currentUser?.employeeId, employeeVisitPlaces]);
  const activeProducts = products.filter((product) => !product.status || product.status === 'Active');
  const recentOrganizations = useMemo(() => {
    const seen = new Set();
    return visitPlans
      .filter((item) => item.employeeId === currentUser?.employeeId)
      .filter((item) => item.organizationName || item.customerName)
      .filter((item) => {
        const name = item.organizationName || item.customerName;
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [currentUser?.employeeId, visitPlans]);

  const update = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const changeVisitType = (destinationType) => {
    setFormData((current) => ({
      ...current,
      destinationType,
      ...(destinationType === 'General Visit' ? {
        organizationName: '',
        organizationType: '',
        customOrganizationType: '',
        contactPerson: '',
        mobileNumber: '',
      } : {}),
    }));
    setErrors((current) => ({ ...current, destinationType: undefined, mobileNumber: undefined }));
  };
  const toggleProduct = (name) => update(
    'selectedProducts',
    formData.selectedProducts.includes(name)
      ? formData.selectedProducts.filter((item) => item !== name)
      : [...new Set([...formData.selectedProducts, name])],
  );
  const choosePreviousOrganization = (organization) => {
    setOrganizationMode('previous');
    setFormData((current) => ({
      ...current,
      organizationName: organization.organizationName || organization.customerName || '',
      organizationType: organization.organizationType || '',
      contactPerson: organization.contactPerson || '',
      mobileNumber: String(organization.mobileNumber || '').replace(/\D/g, '').slice(0, 10),
    }));
    setErrors((current) => ({ ...current, mobileNumber: undefined }));
  };
  const expectedTime = `${formData.hour}:${formData.minute} ${formData.period}`;
  const validate = () => {
    const nextErrors = {};
    if (!formData.visitDate) nextErrors.visitDate = 'Visit Date is required.';
    if (!formData.hour || !formData.minute || !formData.period) nextErrors.expectedTime = 'Expected Time is required.';
    if (!formData.visitPlace) nextErrors.visitPlace = assignedPlaces.length
      ? 'Select your assigned visit place.'
      : 'No visit places are assigned to your account. Please contact Admin.';
    if (!formData.destinationType) nextErrors.destinationType = 'Visit Type is required.';
    if (!formData.visitPurpose || (formData.visitPurpose === 'Other' && !formData.customVisitPurpose.trim())) nextErrors.visitPurpose = 'Visit Purpose is required.';
    if (formData.mobileNumber && formData.mobileNumber.length !== 10) nextErrors.mobileNumber = 'Enter a valid 10-digit mobile number.';
    if (PRODUCT_REQUIRED_PURPOSES.has(formData.visitPurpose) && !formData.selectedProducts.length) {
      nextErrors.selectedProducts = 'Select at least one product for this visit purpose.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const payload = () => ({
    visitDate: formData.visitDate,
    expectedTime,
    destinationType: formData.destinationType,
    organizationName: formData.organizationName || null,
    organizationType: formData.organizationType === 'Other'
      ? formData.customOrganizationType
      : formData.organizationType,
    contactPerson: formData.contactPerson || null,
    mobileNumber: formData.mobileNumber || null,
    area: formData.visitPlace,
    city: formData.visitPlace,
    state: 'Tamil Nadu',
    visitPurpose: formData.visitPurpose === 'Other'
      ? formData.customVisitPurpose
      : formData.visitPurpose,
    products: formData.selectedProducts,
    priority: formData.priority,
    requirement: formData.requirement || null,
    notes: formData.notes || null,
    submissionKey: submissionKey.current,
  });
  const saveDraft = (notify = true) => {
    validate();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...formData,
      submissionKey: submissionKey.current,
    }));
    setDraftStatus('saved');
    if (notify) showToast?.('Visit plan draft saved.', 'success');
  };
  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const saved = await addVisitPlan(payload());
      if (!saved) throw new Error('The visit plan was not saved.');
      localStorage.removeItem(DRAFT_KEY);
      submissionKey.current = crypto.randomUUID();
      showToast?.('Visit plan submitted successfully.', 'success');
      onClose();
    } catch (error) {
      setErrors((current) => ({ ...current, form: error?.message || 'Unable to submit the visit plan.' }));
      saveDraft(false);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const saved = !plan && localStorage.getItem(DRAFT_KEY);
    if (!saved) {
      setFormData(initialData);
      setErrors({});
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      submissionKey.current = parsed.submissionKey || crypto.randomUUID();
      setFormData({ ...initialData, ...parsed });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      setFormData(initialData);
    }
  }, [initialData, open, plan]);

  useEffect(() => {
    if (!open || !dirty) return undefined;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, submissionKey: submissionKey.current }));
      setDraftStatus('saved');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, formData, open]);

  const footer = <>
    <div className="ds-draft-status" role="status">{draftStatus === 'saving' ? 'Saving…' : <><Check size={16} /> Draft saved</>}</div>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="ghost" onClick={() => saveDraft(true)}>Save Draft</Button>
    <Button onClick={submit} loading={submitting} disabled={submitting || !assignedPlaces.length}><Save size={16} /> Submit Visit Plan</Button>
  </>;

  return <Modal open={open} onClose={onClose} dirty={dirty} title="Create Visit Plan" subtitle="Complete the plan using the selections below." footer={footer} size="visit-plan">
    {errors.form && <div className="form-error ds-field--full" role="alert">{errors.form}</div>}
    <div className="ds-form-grid visit-plan-sheet">
      <DateField label="Visit Date" required min={todayIso()} value={formData.visitDate} onChange={(event) => update('visitDate', event.target.value)} error={errors.visitDate} hint={formData.visitDate ? `Selected: ${formatDate(formData.visitDate)}` : undefined} />
      <div className="ds-field">
        <label>Expected Time <span className="ds-required">*</span></label>
        <div className="visit-time-picker">
          <select aria-label="Hour" value={formData.hour} onChange={(event) => update('hour', event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => <option key={hour}>{hour}</option>)}</select>
          <select aria-label="Minute" value={formData.minute} onChange={(event) => update('minute', event.target.value)}>{['00', '15', '30', '45'].map((minute) => <option key={minute}>{minute}</option>)}</select>
          <select aria-label="AM or PM" value={formData.period} onChange={(event) => update('period', event.target.value)}><option>AM</option><option>PM</option></select>
        </div>
        {errors.expectedTime && <span className="ds-field__error">{errors.expectedTime}</span>}
      </div>

      <SelectField label="Visit Place" hint={assignedPlaces.length ? 'Select your assigned visit place.' : 'No visit places are assigned to your account. Please contact Admin.'} required disabled={!assignedPlaces.length} value={formData.visitPlace} onChange={(event) => update('visitPlace', event.target.value)} error={errors.visitPlace}>
        <option value="">Select visit place</option>
        {assignedPlaces.map((place) => <option key={place}>{place}</option>)}
      </SelectField>
      <fieldset className="ds-field visit-toggle-field">
        <legend>Visit Type <span className="ds-required">*</span></legend>
        <div className="visit-toggle-group">
          {['New Organization', 'General Visit'].map((type) => <button type="button" key={type} className={formData.destinationType === type ? 'selected' : ''} onClick={() => changeVisitType(type)}>{type}</button>)}
        </div>
        {errors.destinationType && <span className="ds-field__error">{errors.destinationType}</span>}
      </fieldset>

      {formData.destinationType === 'New Organization' && <>
        <div className="ds-field ds-field--full">
          <label>Organization details</label>
          <div className="visit-toggle-group visit-organization-mode">
            <button type="button" className={organizationMode === 'previous' ? 'selected' : ''} onClick={() => setOrganizationMode('previous')}>Use Previous Organization</button>
            <button type="button" className={organizationMode === 'new' ? 'selected' : ''} onClick={() => setOrganizationMode('new')}>Enter New Organization</button>
          </div>
        </div>
        {organizationMode === 'previous' && recentOrganizations.length > 0 && <SelectField className="ds-field--full" label="Recent Organization" value="" onChange={(event) => choosePreviousOrganization(recentOrganizations[Number(event.target.value)])}>
          <option value="">Select a previous organization</option>
          {recentOrganizations.map((organization, index) => <option key={`${organization.id}-${index}`} value={index}>{organization.organizationName || organization.customerName}</option>)}
        </SelectField>}
        {organizationMode === 'previous' && !recentOrganizations.length && <div className="ds-summary ds-field--full">No previous organizations are available. Choose Enter New Organization.</div>}
        <FormField label="Organization Name" value={formData.organizationName} onChange={(event) => update('organizationName', event.target.value)} />
        <SelectField label="Organization Type" value={formData.organizationType} onChange={(event) => update('organizationType', event.target.value)}><option value="">Select organization type</option>{ORGANIZATION_TYPES.map((type) => <option key={type}>{type}</option>)}</SelectField>
        {formData.organizationType === 'Other' && <FormField className="ds-field--full" label="Other Organization Type" value={formData.customOrganizationType} onChange={(event) => update('customOrganizationType', event.target.value)} />}
        <FormField label="Contact Person" value={formData.contactPerson} onChange={(event) => update('contactPerson', event.target.value)} />
        <FormField label="Mobile Number" type="tel" inputMode="numeric" maxLength={10} value={formData.mobileNumber} onChange={(event) => update('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} error={errors.mobileNumber} />
      </>}

      <SelectField label="Visit Purpose" required value={formData.visitPurpose} onChange={(event) => update('visitPurpose', event.target.value)} error={errors.visitPurpose}>{PURPOSES.map((purpose) => <option key={purpose}>{purpose}</option>)}</SelectField>
      <fieldset className="ds-field visit-toggle-field">
        <legend>Priority</legend>
        <div className="visit-toggle-group visit-priority-group">{PRIORITIES.map((priority) => <button type="button" key={priority} className={formData.priority === priority ? 'selected' : ''} onClick={() => update('priority', priority)}>{priority}</button>)}</div>
      </fieldset>
      {formData.visitPurpose === 'Other' && <FormField className="ds-field--full" label="Other Visit Purpose" value={formData.customVisitPurpose} onChange={(event) => { update('customVisitPurpose', event.target.value); setErrors((current) => ({ ...current, visitPurpose: undefined })); }} />}

      <fieldset className="ds-field ds-field--full visit-products-field">
        <legend>Products</legend>
        <div className="visit-product-grid">
          {activeProducts.map((product) => {
            const selected = formData.selectedProducts.includes(product.name);
            return <button type="button" key={product.id} className={selected ? 'selected' : ''} onClick={() => toggleProduct(product.name)}>{selected && <Check size={17} />}<span>{product.name}</span></button>;
          })}
        </div>
        {!activeProducts.length && <small>No active products are configured.</small>}
        {errors.selectedProducts && <span className="ds-field__error">{errors.selectedProducts}</span>}
      </fieldset>

      <TextArea className="ds-field--full" label="Requirement / Objective (Optional)" placeholder="Add a short requirement or visit objective..." rows={3} value={formData.requirement} onChange={(event) => update('requirement', event.target.value)} />
      <details className="visit-more-details ds-field--full">
        <summary><ChevronDown size={18} /> More Details</summary>
        <TextArea label="Notes (Optional)" rows={3} value={formData.notes} onChange={(event) => update('notes', event.target.value)} />
      </details>
    </div>
  </Modal>;
};

export default AddVisitPlan;
