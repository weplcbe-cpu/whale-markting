import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Save, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, FormField, Modal, SelectField, TextArea } from '../ui';
import { to12HourTime, to24HourTime } from '../../utils/timeUtils';
import VisitDatePicker from './VisitDatePicker';
import VisitTimeDialog from './VisitTimeDialog';

const LEGACY_DRAFT_KEY = 'marketing-visit-plan-draft';
const DEFAULT_ORGANIZATION_TYPES = ['Corporation', 'Municipality', 'Government Department', 'Private Company', 'Contractor', 'Dealer', 'Consultant', 'Other'];
const DEFAULT_PURPOSES = ['Product Demo', 'Product Presentation', 'Service Visit', 'Follow-up Visit', 'New Requirement', 'Quotation Discussion', 'Payment Follow-up', 'General Visit', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STEPS = [
  { key: 1, label: 'Visit Schedule', shortLabel: 'Schedule' },
  { key: 2, label: 'Customer Details', shortLabel: 'Customer' },
  { key: 3, label: 'Visit Details', shortLabel: 'Details' },
];

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
  const match = to12HourTime(value).match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
  if (!match) return {};
  return {
    hour: match[1],
    minute: match[2],
    period: match[3].toUpperCase(),
  };
};

const emptyPlan = () => ({
  visitDate: todayIso(),
  visitPlace: '',
  district: '',
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
    locations = [],
    assignedPlacesLoading,
    refreshEntity,
    orgTypes = [],
    purposes = [],
    addVisitPlan,
    updateEditableVisitPlan,
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
      organizationName: plan.organizationName || plan.customerName || '',
      organizationType: plan.organizationType || '',
      customOrganizationType: '',
      contactPerson: plan.contactPerson || '',
      mobileNumber: plan.mobileNumber || '',
      visitPurpose: plan.visitPurpose || '',
      customVisitPurpose: '',
      selectedProducts: Array.isArray(plan.products) ? plan.products : (plan.products ? [plan.products] : []),
      priority: plan.priority || 'Medium',
      requirement: plan.requirement || '',
      notes: plan.notes || '',
      isFollowUpRequired: Boolean(plan.isFollowUpRequired),
      ...parseExpectedTime(plan.expectedTime),
    } : {}),
  }), [plan]);

  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState('saved');
  const [currentStep, setCurrentStep] = useState(1);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const submissionKey = useRef(plan?.submissionKey || crypto.randomUUID());
  const timeTriggerRef = useRef(null);
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
  const availableAssignedPlaces = useMemo(() => assignedPlaces.flatMap((place) => {
    const normalizedPlace = place.trim().toLocaleLowerCase();
    const matchingLocations = locations.filter((item) => item.locationName?.trim().toLocaleLowerCase() === normalizedPlace);
    const masterFound = matchingLocations.length > 0;
    const masterActive = matchingLocations.some((item) => item.active !== false);
    const included = !masterFound || masterActive;
    if (import.meta.env.DEV) console.log('Marketing assigned place eligibility', {
      placeName: place,
      assignedActive: true,
      masterFound,
      masterActive,
      included,
    });
    if (!included) return [];
    const location = matchingLocations.find((item) => item.active !== false);
    return [{ place, districtName: location?.district?.districtName || 'Assigned Visit Places' }];
  }), [assignedPlaces, locations]);
  const assignedPlaceGroups = useMemo(() => availableAssignedPlaces.reduce((groups, option) => {
    const { place, districtName } = option;
    groups.set(districtName, [...(groups.get(districtName) || []), { place, districtName }]);
    return groups;
  }, new Map()), [availableAssignedPlaces]);

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

  const expectedTime = to12HourTime(`${formData.hour}:${formData.minute} ${formData.period}`);
  const time24 = to24HourTime(expectedTime);

  const setTime24 = (value) => {
    const time = parseExpectedTime(value);
    setFormData((current) => ({ ...current, hour: time.hour || '', minute: time.minute || '', period: time.period || '' }));
    setErrors((current) => ({ ...current, expectedTime: undefined }));
  };

  const handleNativeTimeChange = (event) => setTime24(event.target.value);

  const closeTimeDialog = () => {
    setIsTimeDialogOpen(false);
    window.requestAnimationFrame(() => timeTriggerRef.current?.focus());
  };

  const setStepErrors = (fields, nextErrors) => {
    setErrors((current) => {
      const merged = { ...current };
      fields.forEach((field) => {
        merged[field] = undefined;
      });
      Object.entries(nextErrors).forEach(([field, message]) => {
        merged[field] = message;
      });
      return merged;
    });
    return Object.keys(nextErrors).length === 0;
  };

  const focusStepError = (field) => {
    const selectors = {
      visitDate: '.visit-date-trigger',
      expectedTime: '#visit-time-button',
      visitPlace: '#visit-place',
      mobileNumber: '#visit-mobile-number',
      visitPurpose: '#visit-purpose',
    };
    if (!selectors[field]) return;
    window.requestAnimationFrame(() => {
      document.querySelector(selectors[field])?.focus?.();
    });
  };

  const validateScheduleStep = () => {
    const nextErrors = {};
    if (!formData.visitDate) nextErrors.visitDate = 'Please select a visit date.';
    if (!formData.hour || !formData.minute || !formData.period) nextErrors.expectedTime = 'Please select the visit time.';
    if (!formData.visitPlace) {
      nextErrors.visitPlace = assignedPlaces.length
        ? 'Select your assigned visit place.'
        : 'No visit places are assigned to your account. Please contact Admin.';
    }
    const valid = setStepErrors(['visitDate', 'expectedTime', 'visitPlace'], nextErrors);
    if (!valid) focusStepError(Object.keys(nextErrors)[0]);
    return valid;
  };

  const validateCustomerStep = () => {
    const nextErrors = {};
    if (formData.mobileNumber && formData.mobileNumber.length !== 10) {
      nextErrors.mobileNumber = 'Enter a valid 10-digit mobile number.';
    }
    const valid = setStepErrors(['mobileNumber'], nextErrors);
    if (!valid) focusStepError('mobileNumber');
    return valid;
  };

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
    district: formData.district || null,
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
    if (!draftKey || plan) return;
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
      const saved = plan
        ? await updateEditableVisitPlan(plan.id, payload())
        : await addVisitPlan(payload());
      if (!saved) throw new Error('The visit plan was not saved.');
      if (draftKey && !plan) {
        localStorage.removeItem(draftKey);
      }
      submissionKey.current = crypto.randomUUID();
      onClose();
    } catch (error) {
      setErrors((current) => ({ ...current, form: error?.message || 'Unable to submit the visit plan.' }));
      if (!plan) saveDraft(false);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshEntity?.('employee_visit_places');
    if (plan) {
      setFormData(initialData);
      setErrors({});
      return;
    }
    if (!draftKey) {
      setFormData(initialData);
      setErrors({});
      return;
    }
    const saved = localStorage.getItem(draftKey);
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
  }, [draftKey, initialData, open, plan, refreshEntity]);

  useEffect(() => {
    if (!open || !dirty || !draftKey || plan) return undefined;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ ...formData, submissionKey: submissionKey.current }));
      setDraftStatus('saved');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, draftKey, formData, open, plan]);

  useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
  }, [open]);

  const continueStep = () => {
    if (currentStep === 1) {
      if (!validateScheduleStep()) return;
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (!validateCustomerStep()) return;
      setCurrentStep(3);
    }
  };

  const footer = (
    <div className="visit-plan-footer-shell">
      {!plan ? (
        <div className="ds-draft-status" role="status">
          {draftStatus === 'saving' ? 'Saving…' : <><Check size={16} /> Draft saved</>}
        </div>
      ) : <div />}
      <div className="visit-plan-footer-actions">
        {currentStep === 1 && (
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        )}
        {currentStep > 1 && (
          <Button variant="secondary" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={submitting}>Back</Button>
        )}
        {!plan && <Button variant="ghost" onClick={() => saveDraft(true)} disabled={submitting}>Save Draft</Button>}
        {currentStep < 3 ? (
          <Button onClick={continueStep} disabled={submitting || assignedPlacesLoading}>Continue</Button>
        ) : (
          <Button onClick={submit} loading={submitting} disabled={submitting || assignedPlacesLoading || !availableAssignedPlaces.length}>
            <Save size={16} /> {plan ? 'Update Visit Plan' : 'Submit Visit Plan'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={plan ? 'Edit Visit Plan' : 'Create Visit Plan'}
      subtitle={plan ? 'Update your scheduled customer visit details.' : 'Plan and schedule your customer visit.'}
      footer={footer}
      size="visit-plan"
    >
      {errors.form && <div className="form-error ds-field--full" role="alert">{errors.form}</div>}

      <div className="visit-plan-wizard">
        <ol className="visit-plan-stepper" aria-label="Create Visit Plan steps">
          {STEPS.map((step, index) => {
            const status = currentStep > step.key ? 'complete' : currentStep === step.key ? 'active' : 'upcoming';
            return (
              <li key={step.key} className={`visit-plan-stepper-item is-${status}`}>
                <button
                  type="button"
                  className="visit-plan-stepper-trigger"
                  onClick={() => {
                    if (step.key < currentStep) setCurrentStep(step.key);
                  }}
                  disabled={step.key > currentStep}
                  aria-current={currentStep === step.key ? 'step' : undefined}
                >
                  <span className="visit-plan-stepper-dot" aria-hidden="true">{currentStep > step.key ? <Check size={14} /> : step.key}</span>
                  <span className="visit-plan-stepper-label-wrap">
                    <span className="visit-plan-stepper-label visit-plan-stepper-label--full">{step.label}</span>
                    <span className="visit-plan-stepper-label visit-plan-stepper-label--short">{step.shortLabel}</span>
                  </span>
                </button>
                {index < STEPS.length - 1 && <span className="visit-plan-stepper-connector" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <section className="visit-plan-step-panel" key={currentStep}>
          {currentStep === 1 && (
            <>
              <div className="ds-form-grid visit-plan-sheet visit-plan-step-grid">
                <header className="visit-plan-step-header">
                  <h3>Visit Schedule</h3>
                  <p>Choose when and where the customer visit will take place.</p>
                </header>
                <div className="ds-field">
                  <label>Visit Date <span className="ds-required">*</span></label>
                  <VisitDatePicker value={formData.visitDate} min={todayIso()} error={errors.visitDate} onChange={(visitDate) => update('visitDate', visitDate)} />
                  {errors.visitDate && <span className="ds-field__error">{errors.visitDate}</span>}
                </div>

                <div className="ds-field">
                  <label htmlFor="visit-time-button">Visit Time <span className="ds-required">*</span></label>
                  <button
                    ref={timeTriggerRef}
                    id="visit-time-button"
                    type="button"
                    className={`visit-time-button${errors.expectedTime ? ' visit-time-button--error' : ''}`}
                    aria-haspopup="dialog"
                    aria-expanded={isTimeDialogOpen}
                    onClick={() => setIsTimeDialogOpen(true)}
                  >
                    <Clock size={19} aria-hidden="true" />
                    <span>{to12HourTime(time24) || 'Select visit time'}</span>
                  </button>
                  <input
                    id="visit-time"
                    type="time"
                    name="visitTime"
                    value={time24}
                    onChange={handleNativeTimeChange}
                    step="300"
                    required
                    tabIndex={-1}
                    className="visually-hidden-time-input"
                    aria-invalid={Boolean(errors.expectedTime)}
                  />
                  {isTimeDialogOpen && (
                    <VisitTimeDialog
                      value={time24}
                      onCancel={closeTimeDialog}
                      onConfirm={(nextTime) => {
                        setTime24(nextTime);
                        closeTimeDialog();
                      }}
                    />
                  )}
                  {errors.expectedTime && <span className="ds-field__error">{errors.expectedTime}</span>}
                </div>

                <SelectField
                  className="ds-field--full visit-place-select-wrap"
                  label="Visit Place"
                  id="visit-place"
                  required
                  disabled={assignedPlacesLoading || !availableAssignedPlaces.length}
                  value={formData.visitPlace}
                  onChange={(event) => {
                    const place = event.target.value;
                    const location = locations.find((item) => item.active !== false && item.locationName?.toLocaleLowerCase() === place.toLocaleLowerCase());
                    setFormData((current) => ({ ...current, visitPlace: place, district: location?.district?.districtName || '' }));
                    setErrors((current) => ({ ...current, visitPlace: undefined }));
                  }}
                  error={errors.visitPlace}
                  hint={assignedPlacesLoading ? 'Loading assigned places...' : undefined}
                >
                  <option value="">-- Select assigned place --</option>
                  {[...assignedPlaceGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([districtName, places]) => <optgroup key={districtName} label={districtName}>{places.map(({ place }) => <option key={place} value={place}>{place}</option>)}</optgroup>)}
                </SelectField>
                <small className="visit-place-helper">Only assigned visit places are listed.</small>

                {!assignedPlacesLoading && !availableAssignedPlaces.length && (
                  <div className="visit-place-warning" role="alert">
                    ⚠️ No visit places are assigned to your account. Please contact your Administrator to assign visit places.
                  </div>
                )}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="ds-form-grid visit-plan-sheet visit-plan-step-grid">
                <header className="visit-plan-step-header">
                  <h3>Customer Details</h3>
                  <p>Add the customer and contact information for this visit.</p>
                </header>
                <div>
                  <FormField
                    label="Customer / Organization Name"
                    placeholder="e.g. Acme Health Corp"
                    value={formData.organizationName}
                    onChange={(event) => update('organizationName', event.target.value)}
                  />
                  {recentOrganizations.length > 0 && (
                    <div className="visit-org-quick-picks">
                      <small>Quick select previous:</small>
                      <div>
                        {recentOrganizations.map((org, idx) => (
                          <button key={idx} type="button" className="btn btn-secondary btn-sm" onClick={() => choosePreviousOrganization(org)}>
                            {org.organizationName || org.customerName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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

                <FormField
                  label="Contact Person"
                  placeholder="e.g. John Doe"
                  value={formData.contactPerson}
                  onChange={(event) => update('contactPerson', event.target.value)}
                />

                <FormField
                  id="visit-mobile-number"
                  label="Mobile Number"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={formData.mobileNumber}
                  onChange={(event) => update('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                  error={errors.mobileNumber}
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="ds-form-grid visit-plan-sheet visit-plan-step-grid">
                <header className="visit-plan-step-header">
                  <h3>Visit Details</h3>
                  <p>Define the purpose, priority and products for this visit.</p>
                </header>
                <SelectField
                  className="ds-field--full"
                  id="visit-purpose"
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

                <fieldset className="ds-field ds-field--full visit-priority-fieldset">
                  <legend>Priority</legend>
                  <div className="visit-priority-segmented" role="group" aria-label="Priority">
                    {PRIORITIES.map((priority) => (
                      <button
                        type="button"
                        key={priority}
                        className={formData.priority === priority ? `selected ${priority === 'Urgent' ? 'urgent' : ''}` : ''}
                        onClick={() => update('priority', priority)}
                        aria-pressed={formData.priority === priority}
                      >
                        {formData.priority === priority && <Check size={14} aria-hidden="true" />}
                        {priority}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="ds-field ds-field--full visit-products-field">
                  <legend>Products Interested</legend>
                  <p className="visit-products-copy">Select one or more products relevant to this visit.</p>

                  {formData.selectedProducts.length > 0 && (
                    <div className="visit-product-chips">
                      {formData.selectedProducts.map((pName) => (
                        <span key={pName}>
                          {pName}
                          <button type="button" onClick={() => removeProductChip(pName)} title={`Remove ${pName}`} aria-label={`Remove ${pName}`}>
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
                          aria-pressed={selected}
                        >
                          {selected && <Check size={16} aria-hidden="true" />}
                          <span>{product.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!activeProducts.length && <small>No active products are configured in master catalog.</small>}
                  {errors.selectedProducts && <span className="ds-field__error">{errors.selectedProducts}</span>}
                </fieldset>

                <TextArea
                  className="ds-field--full visit-plan-long-textarea"
                  label="Requirement / Objective"
                  placeholder="Brief visit objective or specific product requirement..."
                  rows={4}
                  value={formData.requirement}
                  onChange={(event) => update('requirement', event.target.value)}
                />

                <div className="ds-field ds-field--full visit-followup-toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isFollowUpRequired}
                      onChange={(e) => update('isFollowUpRequired', e.target.checked)}
                    />
                    Follow-up Required
                  </label>
                </div>

                <TextArea
                  className="ds-field--full visit-plan-long-textarea"
                  label="Notes (Optional)"
                  placeholder="Additional notes for this visit..."
                  rows={4}
                  value={formData.notes}
                  onChange={(event) => update('notes', event.target.value)}
                />
                <div className="visit-plan-form-end-spacer" aria-hidden="true" />
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default AddVisitPlan;
