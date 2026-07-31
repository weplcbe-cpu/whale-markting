import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Edit3, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, ConfirmationDialog, DateField, FormField, Modal, PageHeader } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';
import {
  MONTHLY_VISIT_PLAN_DRAFT_KEY,
  isDatabaseVisitPlanId,
  isUnsavedVisitPlanDraft,
  readVisitPlanDraft,
  writeVisitPlanDraft,
} from '../../utils/visitPlanDraftCache';

const projectOptions = ['Super Sucker', 'New Super Sucker', 'New Requirements', 'Recycler Hiring', 'Service', 'Water Tanker'];
const displayDate = (value) => value ? value.split('-').reverse().join('-') : 'Select date';
const rowSignature = (row) => `${row.plannedDate || ''}|${String(row.area || '').trim().toLowerCase()}|${[...(row.projects || [])].sort().join('|').toLowerCase()}`;
const toMonthlyRow = (plan) => ({
  id: plan.id,
  databaseId: plan.id,
  clientId: plan.submissionKey || null,
  batchId: plan.batchId || null,
  area: plan.area || plan.city || plan.district || '',
  projects: Array.isArray(plan.products) ? plan.products : plan.products ? [plan.products] : [],
  plannedDate: plan.visitDate || '',
  status: plan.status || 'Draft'
});
const getDefaultMonthRange = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    monthFrom: nextMonth.toISOString().split('T')[0],
    monthTo: lastDayOfNextMonth.toISOString().split('T')[0]
  };
};

const readDraft = () => {
  return readVisitPlanDraft(MONTHLY_VISIT_PLAN_DRAFT_KEY, getDefaultMonthRange());
};
const localDraftRows = (entries) => entries.filter(isUnsavedVisitPlanDraft);
const persistDraftRows = (entries, monthFrom, monthTo) => {
  writeVisitPlanDraft(MONTHLY_VISIT_PLAN_DRAFT_KEY, entries, { monthFrom, monthTo });
};

const ProjectMultiSelect = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const options = projectOptions.filter((project) => project.toLowerCase().includes(query.toLowerCase()));
  const toggle = (project) => onChange(value.includes(project) ? value.filter((item) => item !== project) : [...value, project]);
  return <div className="ds-field ds-project-select"><label htmlFor="monthly-project-search">Projects / Requirements <span className="ds-required">*</span></label><div className="ds-project-select__control" onClick={() => setOpen(true)}>{value.map((project) => <span key={project}>{project}<button type="button" aria-label={`Remove ${project}`} onClick={(event) => { event.stopPropagation(); toggle(project); }}>×</button></span>)}<div><Search size={17} /><input id="monthly-project-search" value={query} placeholder={value.length ? 'Add another project' : 'Search projects'} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && options[0]) { event.preventDefault(); toggle(options[0]); setQuery(''); } }} /></div></div>{open && <div className="ds-project-select__menu" role="listbox">{options.map((project) => <button type="button" role="option" aria-selected={value.includes(project)} key={project} onClick={() => toggle(project)}>{value.includes(project) && <Check size={16} />}{project}</button>)}{options.length === 0 && <p>No matching projects</p>}</div>}<small>Select one or more projects for this visit date.</small></div>;
};

export const NextMonthPlan = () => {
  const { currentUser, visitPlans, addTourPlanBatch, deleteVisitPlanEntry, dataLoading, showToast } = useApp();
  const initialDraft = useMemo(readDraft, []);
  const [rows, setRows] = useState(initialDraft.rows);
  const [monthFrom, setMonthFrom] = useState(initialDraft.monthFrom);
  const [monthTo, setMonthTo] = useState(initialDraft.monthTo);
  const [planStatus, setPlanStatus] = useState('Draft');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const monthlyPlans = useMemo(() => visitPlans
    .filter((plan) => plan.employeeId === currentUser?.employeeId && plan.visitDate >= monthFrom && plan.visitDate <= monthTo)
    .sort((a, b) => String(a.visitDate || '').localeCompare(String(b.visitDate || ''))), [currentUser?.employeeId, monthFrom, monthTo, visitPlans]);
  const currentMonthlyPlan = [...monthlyPlans].sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)))[0];
  useEffect(() => {
    if (dataLoading) return;
    const databaseRows = monthlyPlans.map(toMonthlyRow);
    const databaseSignatures = new Set(databaseRows.map(rowSignature));
    setRows((current) => {
      const unsavedRows = localDraftRows(current).filter((row) => !databaseSignatures.has(rowSignature(row)));
      persistDraftRows(unsavedRows, monthFrom, monthTo);
      return [...databaseRows, ...unsavedRows];
    });
    setPlanStatus(currentMonthlyPlan ? normalizePlanStatus(currentMonthlyPlan.status) : 'Draft');
  }, [currentMonthlyPlan, dataLoading, monthFrom, monthTo, monthlyPlans]);
  const valid = useMemo(() => rows.length > 0 && rows.every((row) => row.area.trim() && row.plannedDate && row.projects.length), [rows]);
  const update = (id, field, value) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const add = () => { const row = { id: `monthly-${Date.now()}`, area: '', projects: [], plannedDate: '', status: 'Draft' }; setRows((current) => [...current, row]); setEditing(row.id); };
  const duplicate = (row) => { const { databaseId: _databaseId, batchId: _batchId, clientId: _clientId, localId: _localId, submissionKey: _submissionKey, rawStatus: _rawStatus, ...draft } = row; const copy = { ...draft, id: `monthly-${Date.now()}`, clientId: crypto.randomUUID(), status: 'Draft' }; setRows((current) => [...current, copy]); setEditing(copy.id); };
  const remove = async () => {
    if (!deleting || isDeleting) return;
    setIsDeleting(true);
    try {
      const databaseId = deleting.databaseId || (isDatabaseVisitPlanId(deleting.id) ? deleting.id : null);
      if (databaseId) await deleteVisitPlanEntry(databaseId);
      const nextRows = rows.filter((row) => row.id !== deleting.id && row.databaseId !== databaseId);
      persistDraftRows(nextRows, monthFrom, monthTo);
      setRows(nextRows);
      setDeleting(null);
      setEditing((current) => current === deleting.id ? null : current);
      setValidationAttempted(false);
      if (!nextRows.length) setPlanStatus('Draft');
      showToast?.('Visit plan deleted permanently.', 'success');
    } catch (error) {
      showToast?.(error?.message || 'Unable to delete the visit plan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };
  const saveDraft = () => { persistDraftRows(rows, monthFrom, monthTo); setPlanStatus('Draft'); showToast?.('Monthly plan draft saved.', 'success'); };
  const review = () => {
    setValidationAttempted(true);
    if (valid) setReviewing(true);
  };
  const submit = async () => {
    if (!valid) return;
    try {
      await addTourPlanBatch({ planType: 'Monthly', periodFrom: monthFrom, periodTo: monthTo, rows: rows.map((row) => ({ visitDate: row.plannedDate, area: row.area, district: row.area, city: row.area, products: row.projects, requirement: row.projects.join(', '), priority: 'Medium', status: 'Submitted' })) });
      const submittedRows = rows.map((row) => ({ ...row, status: normalizePlanStatus('Submitted') }));
      setRows(submittedRows);
      setPlanStatus('Submitted');
      setReviewing(false);
      localStorage.removeItem(MONTHLY_VISIT_PLAN_DRAFT_KEY);
      showToast?.('Monthly plan submitted successfully.', 'success');
    } catch {
      // Preserve the review and all entered values when persistence fails.
    }
  };

  return <div className="ds-page ds-monthly-plan"><PageHeader title="Next Month Plan" description="Plan August field activity and submit it to the shared visit schedule." actions={<Badge tone={planStatus === 'Draft' ? 'neutral' : 'success'}>{planStatus}</Badge>} />
    <section className="ds-monthly-header" aria-label="Monthly plan information"><div><small>Employee Name</small><strong>{currentUser?.employeeName || currentUser?.fullName || 'Marketing Employee'}</strong></div><div><small>Month</small><strong>August 2026</strong></div><DateField label="Month From" value={monthFrom} onChange={(event) => setMonthFrom(event.target.value)} /><DateField label="Month To" value={monthTo} onChange={(event) => setMonthTo(event.target.value)} /><div><small>Plan Status</small><Badge tone={planStatus === 'Draft' ? 'neutral' : 'success'}>{planStatus}</Badge></div></section>
    <div className="ds-monthly-list" role="list">{rows.map((row, index) => <article className="ds-monthly-row" role="listitem" key={row.id}><div className="ds-monthly-row__summary"><span className="ds-monthly-row__number">{index + 1}</span><div><small>Planned Date</small><strong>{displayDate(row.plannedDate)}</strong></div><div><small>Area</small><strong>{row.area || 'Enter area'}</strong></div><div className="ds-monthly-projects"><small>Projects / Requirements</small><div>{row.projects.map((project) => <Badge key={project}>{project}</Badge>)}</div></div><Badge tone={normalizePlanStatus(row.status) === 'Submitted' ? 'success' : 'neutral'}>{row.status}</Badge><div className="ds-monthly-row__actions"><Button variant="secondary" aria-label={`Edit plan ${index + 1}`} onClick={() => setEditing(editing === row.id ? null : row.id)}><Edit3 size={16} /></Button><Button variant="secondary" aria-label={`Duplicate plan ${index + 1}`} onClick={() => duplicate(row)}><Copy size={16} /></Button><Button variant="danger" aria-label={`Delete plan ${index + 1}`} disabled={isDeleting} onClick={() => setDeleting(row)}><Trash2 size={16} /></Button><Button variant="ghost" aria-label={editing === row.id ? 'Collapse editor' : 'Expand editor'} onClick={() => setEditing(editing === row.id ? null : row.id)}><ChevronDown size={17} /></Button></div></div>{editing === row.id && <div className="ds-monthly-row__editor"><DateField label="Planned Date" required value={row.plannedDate} onChange={(event) => update(row.id, 'plannedDate', event.target.value)} /><FormField label="Area" required value={row.area} onChange={(event) => update(row.id, 'area', event.target.value)} /><ProjectMultiSelect value={row.projects} onChange={(projects) => update(row.id, 'projects', projects)} /></div>}</article>)}</div>
    {!rows.length && <div className="ds-empty"><h3>No next month plan entries</h3><p>Add a plan entry to begin.</p></div>}
    <div className="ds-sticky-actions"><Button variant="secondary" onClick={add}><Plus size={16} /> Add New Plan Entry</Button><Button variant="secondary" onClick={saveDraft}>Save Draft</Button><Button onClick={review} disabled={!rows.length}>Review Plan</Button></div>
    {validationAttempted && !valid && rows.length > 0 && <p className="ds-validation-note">Complete the date, area, and at least one project for every entry before review.</p>}
    <Modal open={reviewing} onClose={() => setReviewing(false)} title="Review Next Month Plan" subtitle={`${rows.length} plan entries · August 2026`} footer={<><Button variant="secondary" onClick={() => setReviewing(false)}>Back to Edit</Button><Button onClick={submit}><Send size={16} /> Submit Visit Plan</Button></>}><div className="ds-monthly-review">{rows.map((row, index) => <div key={row.id}><span>{index + 1}</span><strong>{displayDate(row.plannedDate)} · {row.area}</strong><p>{row.projects.join(', ')}</p></div>)}</div></Modal>
    <ConfirmationDialog open={Boolean(deleting)} title="Delete Visit Plan?" message="This visit plan will be permanently removed." confirmLabel="Delete" confirming={isDeleting} danger onClose={() => { if (!isDeleting) setDeleting(null); }} onConfirm={remove} />
  </div>;
};

export default NextMonthPlan;
