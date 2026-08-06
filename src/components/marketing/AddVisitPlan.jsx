import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Save, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, FormField, Modal, SelectField, TextArea } from '../ui';
import ClockTimePicker from './ClockTimePicker';
import VisitDatePicker from './VisitDatePicker';

const LEGACY_DRAFT_KEY = 'marketing-visit-plan-draft';
const DEFAULT_ORGANIZATION_TYPES = ['Corporation', 'Municipality', 'Government Department', 'Private Company', 'Contractor', 'Dealer', 'Consultant', 'Other'];
const DEFAULT_PURPOSES = ['Product Demo', 'Product Presentation', 'Service Visit', 'Follow-up Visit', 'New Requirement', 'Quotation Discussion', 'Payment Follow-up', 'General Visit', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
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

const parseExpectedTime = (value) => {
  const match = String(value || '').trim().match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return {};
  return {
    hour: match[1].padStart(2, '0'),
    minute: match[2],
    period: match[3].toUpperCase(),
  };
};

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
  isFollowUpRequired: false,
  ...roundedTime(),
});

export const AddVisitPlan = ({ open = true, onClose = () => {}, plan = null }) => {
  const {
    currentUser,
    products = [],
    visitPlans = [],
    employeeVisitPlaces = [],
    orgTypes = [],
    purposes = [],
    addVisitPlan,
    showToast,
  } = useApp();

  const draftOwnerId = currentUser?.authUserId || currentUser?.id;
  const draftKey = draftOwnerId
    ? `marketing-visit-plan-draft:${draftOwnerId}`
    : null;

  // Clean legacy non-namespaced key once user identity is established
  useEffect(() => {
    if (draftOwnerId && localStorage.getItem(LEGACY_DRAFT_KEY)) {
      localStorage.removeItem(LEGACY_DRAFT_KEY);
    }
  }, [draftOwnerId]);

  const initialData = useMemo(() => ({
    ...emptyPlan(),
    ...(plan ? {
      ...plan,
      visitPlace: plan.area || plan.city || '',
      district: plan.district || '',
      selectedProducts: plan.products || [],
      ...parseExpectedTime(plan.expectedTime),
    } : {}),
  }), [plan]);

  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saved');
  const submissionKey = useRef(plan?.submissionKey || crypto.randomUUID());
  const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  // Assigned visit places for current logged-in marketing user ONLY
  const assignedPlaces = useMemo(() => {
    if (!currentUser?.employeeId) return [];
    return employeeVisitPlaces
      .filter((item) => item.employeeId === currentUser.employeeId && item.isActive !== false)
      .map((item) => item.placeName?.trim())
      .filter(Boolean)
      .filter((place, index, list) => list.findIndex((candidate) => candidate.toLocaleLowerCase() === place.toLocaleLowerCase()) === index)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  }, [currentUser?.employeeId, employeeVisitPlaces]);

  // Master data lists
  const organizationTypesList = useMemo(() => {
    return (orgTypes && orgTypes.length > 0) ? orgTypes : DEFAULT_ORGANIZATION_TYPES;
  }, [orgTypes]);

  const visitPurposesList = useMemo(() => {
    return (purposes && purposes.length > 0) ? purposes : DEFAULT_PURPOSES;
  }, [purposes]);

  const activeProducts = useMemo(() => {
    return products.filter((product) => !product.status || product.status === 'Active');
  }, [products]);

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
      .slice(0, 5);
  }, [currentUser?.employeeId, visitPlans]);

  const update = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleProduct = (name) => {
    update(
      'selectedProducts',
      formData.selectedProducts.includes(name)
        ? formData.selectedProducts.filter((item) => item !== name)
        : [...formData.selectedProducts, name]
    );
  };

  const removeProductChip = (name) => {
    update('selectedProducts', formData.selectedProducts.filter((item) => item !== name));
  };

  const choosePreviousOrganization = (org) => {
    setFormData((current) => ({
      ...current,
      organizationName: org.organizationName || org.customerName || '',
      organizationType: org.organizationType || '',
      contactPerson: org.contactPerson || '',
      mobileNumber: String(org.mobileNumber || '').replace(/\D/g, '').slice(0, 10),
    }));
    setErrors((current) => ({ ...current, mobileNumber: undefined }));
  };

  const expectedTime = `${formData.hour}:${formData.minute} ${formData.period}`;

  const validate = () => {
    const nextErrors = {};
    if (!formData.visitDate) nextErrors.visitDate = 'Please select a visit date.';
    if (!formData.hour || !formData.minute || !formData.period) nextErrors.expectedTime = 'Please select the visit time.';
    if (!formData.visitPlace) {
      nextErrors.visitPlace = assignedPlaces.length
        ? 'Select your assigned visit place.'
        : 'No visit places are assigned to your account. Please contact Admin.';
    }
    if (!formData.visitPurpose) nextErrors.visitPurpose = 'Visit Purpose is required.';

    if (formData.mobileNumber && formData.mobileNumber.length !== 10) {
      nextErrors.mobileNumber = 'Enter a valid 10-digit mobile number.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const payload = () => ({
    visitDate: formData.visitDate,
    expectedTime,
    destinationType: formData.destinationType || 'General Visit',
    customerName: formData.organizationName || null,
    organizationName: formData.organizationName || null,
    organizationType: formData.organizationType === 'Other'
      ? formData.customOrganizationType
      : formData.organizationType,
    contactPerson: formData.contactPerson || null,
    mobileNumber: formData.mobileNumber || null,
    area: formData.visitPlace,
    city: formData.visitPlace,
    district: null,
    state: 'Tamil Nadu',
    visitPurpose: formData.visitPurpose === 'Other'
      ? formData.customVisitPurpose
      : formData.visitPurpose,
    products: formData.selectedProducts,
    priority: formData.priority || 'Medium',
    requirement: formData.requirement || null,
    notes: formData.notes || null,
    isFollowUpRequired: formData.isFollowUpRequired,
    submissionKey: submissionKey.current,
  });

  const saveDraft = (notify = true) => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify({
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
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }
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
    if (!draftKey) {
      setFormData(initialData);
      setErrors({});
      return;
    }
    const saved = !plan && localStorage.getItem(draftKey);
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
      localStorage.removeItem(draftKey);
      setFormData(initialData);
    }
  }, [draftKey, initialData, open, plan]);

  useEffect(() => {
    if (!open || !dirty || !draftKey) return undefined;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ ...formData, submissionKey: submissionKey.current }));
      setDraftStatus('saved');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, draftKey, formData, open]);

  const footer = (
    <>
      <div className="ds-draft-status" role="status">
        {draftStatus === 'saving' ? 'Saving…' : <><Check size={16} /> Draft saved</>}
      </div>
      <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
      <Button variant="ghost" onClick={() => saveDraft(true)} disabled={submitting}>Save Draft</Button>
      <Button onClick={submit} loading={submitting} disabled={submitting || !assignedPlaces.length}>
        <Save size={16} /> Submit Visit Plan
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      dirty={dirty}
      title="Create Visit Plan"
      subtitle="Fill in the visit plan details below (minimum typing required)."
      footer={footer}
      size="visit-plan"
    >
      {errors.form && <div className="form-error ds-field--full" role="alert">{errors.form}</div>}

      <div className="ds-form-grid visit-plan-sheet">
        {/* Visit Date */}
        <div className="ds-field">
          <label>Visit Date <span className="ds-required">*</span></label>
          <VisitDatePicker value={formData.visitDate} min={todayIso()} error={errors.visitDate} onChange={(visitDate) => update('visitDate', visitDate)} />
          {errors.visitDate && <span className="ds-field__error">{errors.visitDate}</span>}
        </div>

        {/* Visit Time */}
        <div className="ds-field">
          <label>Visit Time <span className="ds-required">*</span></label>
          <ClockTimePicker
            hour={formData.hour}
            minute={formData.minute}
            period={formData.period}
            error={errors.expectedTime}
            onChange={(time) => {
              setFormData((current) => ({ ...current, ...time }));
              setErrors((current) => ({ ...current, expectedTime: undefined }));
            }}
          />
          {errors.expectedTime && <span className="ds-field__error">{errors.expectedTime}</span>}
        </div>

        <div className="ds-field">
          <SelectField
            label="Visit Place"
            required
            disabled={!assignedPlaces.length}
            value={formData.visitPlace}
            onChange={(event) => update('visitPlace', event.target.value)}
            error={errors.visitPlace}
            hint={assignedPlaces.length ? 'Only assigned visit places are listed.' : undefined}
          >
            <option value="">-- Select assigned place --</option>
            {assignedPlaces.map((place) => <option key={place} value={place}>{place}</option>)}
          </SelectField>

          {!assignedPlaces.length && (
            <div className="ds-field--full" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '6px', fontSize: '0.85rem', color: 'var(--accent-rose)' }}>
              ⚠️ No visit places are assigned to your account. Please contact your Administrator to assign visit places.
            </div>
          )}
        </div>

        {/* Customer / Organization Name */}
        <div className="ds-field">
          <FormField
            label="Customer / Organization Name"
            placeholder="e.g. Acme Health Corp"
            value={formData.organizationName}
            onChange={(event) => update('organizationName', event.target.value)}
          />
          {recentOrganizations.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Quick select previous:</small>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {recentOrganizations.map((org, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => choosePreviousOrganization(org)}
                  >
                    {org.organizationName || org.customerName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Organization Type */}
        <SelectField
          label="Organization Type"
          value={formData.organizationType}
          onChange={(event) => update('organizationType', event.target.value)}
        >
          <option value="">-- Select type --</option>
          {organizationTypesList.map((type) => <option key={type} value={type}>{type}</option>)}
        </SelectField>

        {formData.organizationType === 'Other' && (
          <FormField
            className="ds-field--full"
            label="Custom Organization Type"
            value={formData.customOrganizationType}
            onChange={(event) => update('customOrganizationType', event.target.value)}
          />
        )}

        {/* Contact Person */}
        <FormField
          label="Contact Person"
          placeholder="e.g. John Doe"
          value={formData.contactPerson}
          onChange={(event) => update('contactPerson', event.target.value)}
        />

        {/* Mobile Number (10 digits numeric) */}
        <FormField
          label="Mobile Number"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile number"
          value={formData.mobileNumber}
          onChange={(event) => update('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
          error={errors.mobileNumber}
        />

        {/* Visit Purpose */}
        <SelectField
          label="Visit Purpose"
          required
          value={formData.visitPurpose}
          onChange={(event) => update('visitPurpose', event.target.value)}
          error={errors.visitPurpose}
        >
          <option value="">-- Select purpose --</option>
          {visitPurposesList.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
        </SelectField>

        {formData.visitPurpose === 'Other' && (
          <FormField
            className="ds-field--full"
            label="Custom Visit Purpose"
            value={formData.customVisitPurpose}
            onChange={(event) => update('customVisitPurpose', event.target.value)}
          />
        )}

        {/* Priority Selection */}
        <fieldset className="ds-field visit-toggle-field">
          <legend>Priority</legend>
          <div className="visit-toggle-group visit-priority-group">
            {PRIORITIES.map((priority) => (
              <button
                type="button"
                key={priority}
                className={formData.priority === priority ? 'selected' : ''}
                onClick={() => update('priority', priority)}
              >
                {priority}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Products (Multi-select with Removable Chips) */}
        <fieldset className="ds-field ds-field--full visit-products-field">
          <legend>Products (Select multiple)</legend>
          
          {/* Selected Product Chips */}
          {formData.selectedProducts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {formData.selectedProducts.map((pName) => (
                <span
                  key={pName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    background: 'var(--primary-blue)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  {pName}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 0 }}
                    onClick={() => removeProductChip(pName)}
                    title={`Remove ${pName}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="visit-product-grid">
            {activeProducts.map((product) => {
              const selected = formData.selectedProducts.includes(product.name);
              return (
                <button
                  type="button"
                  key={product.id}
                  className={selected ? 'selected' : ''}
                  onClick={() => toggleProduct(product.name)}
                >
                  {selected && <Check size={16} />}
                  <span>{product.name}</span>
                </button>
              );
            })}
          </div>
          {!activeProducts.length && <small style={{ color: 'var(--text-muted)' }}>No active products are configured in master catalog.</small>}
          {errors.selectedProducts && <span className="ds-field__error">{errors.selectedProducts}</span>}
        </fieldset>

        {/* Requirement / Objective */}
        <TextArea
          className="ds-field--full"
          label="Requirement / Objective"
          placeholder="Brief visit objective or specific product requirement..."
          rows={2}
          value={formData.requirement}
          onChange={(event) => update('requirement', event.target.value)}
        />

        {/* Follow-up Required Toggle & Notes */}
        <div className="ds-field ds-field--full" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', font: '600 14px var(--font-primary)' }}>
            <input
              type="checkbox"
              checked={formData.isFollowUpRequired}
              onChange={(e) => update('isFollowUpRequired', e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            Follow-up Required
          </label>
        </div>

        <TextArea
          className="ds-field--full"
          label="Notes (Optional)"
          placeholder="Additional notes for this visit..."
          rows={2}
          value={formData.notes}
          onChange={(event) => update('notes', event.target.value)}
        />
      </div>
    </Modal>
  );
};

export default AddVisitPlan;
