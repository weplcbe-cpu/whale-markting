import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Edit3, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, ConfirmationDialog, DateField, FormField, Modal, PageHeader } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';

const DRAFT_KEY = 'marketing-next-month-plan-draft';
const projectOptions = ['Super Sucker', 'New Super Sucker', 'New Requirements', 'Recycler Hiring', 'Service', 'Water Tanker'];
const seedRows = [
  ['Tirunelveli', ['Super Sucker'], '2026-08-03'],
  ['Thoothukudi', ['New Super Sucker', 'New Requirements', 'Recycler Hiring'], '2026-08-04'],
  ['Dindigul', ['Service', 'New Requirements'], '2026-08-05'],
  ['Madurai', ['Super Sucker', 'Recycler Hiring'], '2026-08-06'],
  ['Sivakasi', ['Water Tanker'], '2026-08-07'],
  ['Sivagangai', ['Service'], '2026-08-08'],
  ['Nagercoil', ['New Requirements'], '2026-08-10']
].map(([area, projects, plannedDate], index) => ({ id: `monthly-${index + 1}`, area, projects, plannedDate, status: 'Draft' }));
const displayDate = (value) => value ? value.split('-').reverse().join('-') : 'Select date';

const ProjectMultiSelect = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const options = projectOptions.filter((project) => project.toLowerCase().includes(query.toLowerCase()));
  const toggle = (project) => onChange(value.includes(project) ? value.filter((item) => item !== project) : [...value, project]);
  return <div className="ds-field ds-project-select"><label htmlFor="monthly-project-search">Projects / Requirements <span className="ds-required">*</span></label><div className="ds-project-select__control" onClick={() => setOpen(true)}>{value.map((project) => <span key={project}>{project}<button type="button" aria-label={`Remove ${project}`} onClick={(event) => { event.stopPropagation(); toggle(project); }}>×</button></span>)}<div><Search size={17} /><input id="monthly-project-search" value={query} placeholder={value.length ? 'Add another project' : 'Search projects'} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && options[0]) { event.preventDefault(); toggle(options[0]); setQuery(''); } }} /></div></div>{open && <div className="ds-project-select__menu" role="listbox">{options.map((project) => <button type="button" role="option" aria-selected={value.includes(project)} key={project} onClick={() => toggle(project)}>{value.includes(project) && <Check size={16} />}{project}</button>)}{options.length === 0 && <p>No matching projects</p>}</div>}<small>Select one or more projects for this visit date.</small></div>;
};

export const NextMonthPlan = () => {
  const { currentUser, visitPlans, directorComments, addTourPlanBatch, showToast } = useApp();
  const [rows, setRows] = useState(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY))?.rows || seedRows; } catch { return seedRows; } });
  const [monthFrom, setMonthFrom] = useState('2026-08-01');
  const [monthTo, setMonthTo] = useState('2026-08-31');
  const [planStatus, setPlanStatus] = useState('Draft');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const currentMonthlyPlan = useMemo(() => visitPlans
    .filter((plan) => plan.employeeId === currentUser?.employeeId && plan.planType === 'Monthly' && plan.periodFrom === monthFrom && plan.periodTo === monthTo)
    .sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)))[0], [currentUser?.employeeId, monthFrom, monthTo, visitPlans]);
  const reviewComment = directorComments.find((comment) => comment.referenceId === currentMonthlyPlan?.batchId && comment.targetModule === 'Tour Plan');
  useEffect(() => {
    if (!currentMonthlyPlan) return;
    const status = normalizePlanStatus(currentMonthlyPlan.status);
    setPlanStatus(status === 'Pending Approval' ? 'Submitted for Director Approval' : status === 'Approved' ? 'Approved by Director' : status === 'Rejected' ? 'Rejected by Director' : status);
    setRows((current) => current.map((row) => ({ ...row, status })));
  }, [currentMonthlyPlan]);
  const valid = useMemo(() => rows.length > 0 && rows.every((row) => row.area.trim() && row.plannedDate && row.projects.length), [rows]);
  const update = (id, field, value) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const add = () => { const row = { id: `monthly-${Date.now()}`, area: '', projects: [], plannedDate: '', status: 'Draft' }; setRows((current) => [...current, row]); setEditing(row.id); };
  const duplicate = (row) => { const copy = { ...row, id: `monthly-${Date.now()}`, status: 'Draft' }; setRows((current) => [...current, copy]); setEditing(copy.id); };
  const remove = () => { setRows((current) => current.filter((row) => row.id !== deleting)); setDeleting(null); };
  const saveDraft = () => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, monthFrom, monthTo })); setPlanStatus('Draft'); showToast?.('Monthly plan draft saved.', 'success'); };
  const submit = async () => {
    if (!valid) return;
    try {
      await addTourPlanBatch({ planType: 'Monthly', periodFrom: monthFrom, periodTo: monthTo, rows: rows.map((row) => ({ visitDate: row.plannedDate, area: row.area, district: row.area, city: row.area, products: row.projects, requirement: row.projects.join(', '), priority: 'Medium', status: 'Pending Approval' })) });
      const submittedRows = rows.map((row) => ({ ...row, status: normalizePlanStatus('Submitted') }));
      setRows(submittedRows);
      setPlanStatus('Submitted for Director Approval');
      setReviewing(false);
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows: submittedRows, monthFrom, monthTo }));
      showToast?.('Monthly plan submitted successfully.', 'success');
    } catch {
      // Preserve the review and all entered values when persistence fails.
    }
  };

  return <div className="ds-page ds-monthly-plan"><PageHeader title="Next Month Plan" description="Plan August field activity and submit it for Director approval." actions={<Badge tone={planStatus === 'Draft' ? 'neutral' : 'success'}>{planStatus}</Badge>} />
    {normalizePlanStatus(currentMonthlyPlan?.status) === 'Changes Requested' && <section className="ds-section-card"><div className="ds-section-card__header"><div><h3>Director Comment</h3><p>{reviewComment?.message || currentMonthlyPlan?.reviewComment || 'Changes were requested for this plan.'}</p></div><Badge tone="warning">Changes Requested</Badge></div></section>}
    <section className="ds-monthly-header" aria-label="Monthly plan information"><div><small>Employee Name</small><strong>{currentUser?.employeeName || currentUser?.fullName || 'Marketing Employee'}</strong></div><div><small>Month</small><strong>August 2026</strong></div><DateField label="Month From" value={monthFrom} onChange={(event) => setMonthFrom(event.target.value)} /><DateField label="Month To" value={monthTo} onChange={(event) => setMonthTo(event.target.value)} /><div><small>Plan Status</small><Badge tone={planStatus === 'Draft' ? 'neutral' : 'success'}>{planStatus}</Badge></div></section>
    <div className="ds-monthly-list" role="list">{rows.map((row, index) => <article className="ds-monthly-row" role="listitem" key={row.id}><div className="ds-monthly-row__summary"><span className="ds-monthly-row__number">{index + 1}</span><div><small>Planned Date</small><strong>{displayDate(row.plannedDate)}</strong></div><div><small>Area</small><strong>{row.area || 'Enter area'}</strong></div><div className="ds-monthly-projects"><small>Projects / Requirements</small><div>{row.projects.map((project) => <Badge key={project}>{project}</Badge>)}</div></div><Badge tone={row.status === 'Submitted' ? 'success' : 'neutral'}>{row.status}</Badge><div className="ds-monthly-row__actions"><Button variant="secondary" aria-label={`Edit plan ${index + 1}`} onClick={() => setEditing(editing === row.id ? null : row.id)}><Edit3 size={16} /></Button><Button variant="secondary" aria-label={`Duplicate plan ${index + 1}`} onClick={() => duplicate(row)}><Copy size={16} /></Button><Button variant="danger" aria-label={`Delete plan ${index + 1}`} onClick={() => setDeleting(row.id)}><Trash2 size={16} /></Button><Button variant="ghost" aria-label={editing === row.id ? 'Collapse editor' : 'Expand editor'} onClick={() => setEditing(editing === row.id ? null : row.id)}><ChevronDown size={17} /></Button></div></div>{editing === row.id && <div className="ds-monthly-row__editor"><DateField label="Planned Date" required value={row.plannedDate} onChange={(event) => update(row.id, 'plannedDate', event.target.value)} /><FormField label="Area" required value={row.area} onChange={(event) => update(row.id, 'area', event.target.value)} /><ProjectMultiSelect value={row.projects} onChange={(projects) => update(row.id, 'projects', projects)} /></div>}</article>)}</div>
    <div className="ds-sticky-actions"><Button variant="secondary" onClick={add}><Plus size={16} /> Add New Plan Entry</Button><Button variant="secondary" onClick={saveDraft}>Save Draft</Button><Button onClick={() => setReviewing(true)} disabled={!valid}>Review Plan</Button></div>
    {!valid && <p className="ds-validation-note">Complete the date, area, and at least one project for every entry before review.</p>}
    <Modal open={reviewing} onClose={() => setReviewing(false)} title="Review Next Month Plan" subtitle={`${rows.length} plan entries · August 2026`} footer={<><Button variant="secondary" onClick={() => setReviewing(false)}>Back to Edit</Button><Button onClick={submit}><Send size={16} /> Submit for Director Approval</Button></>}><div className="ds-monthly-review">{rows.map((row, index) => <div key={row.id}><span>{index + 1}</span><strong>{displayDate(row.plannedDate)} · {row.area}</strong><p>{row.projects.join(', ')}</p></div>)}</div></Modal>
    <ConfirmationDialog open={Boolean(deleting)} title="Delete plan entry?" message="This monthly plan entry will be removed." confirmLabel="Delete Entry" danger onClose={() => setDeleting(null)} onConfirm={remove} />
  </div>;
};

export default NextMonthPlan;
