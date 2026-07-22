import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Edit3, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, ConfirmationDialog, DateField, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';

const DRAFT_KEY = 'marketing-weekly-plan-draft';
const requiredProductPurposes = new Set(['Product Demo', 'Product Presentation', 'Quotation Submission', 'Quotation Discussion', 'New Requirement', 'Recycler Hiring', 'Tender Meeting', 'Tender Submission']);
const optionalProductPurposes = ['Service Visit', 'Customer Meeting', 'Follow-up Visit', 'Payment Follow-up', 'Document Collection', 'Site Inspection', 'Other'];
const exampleRows = [
  ['2026-08-03', 'Tirunelveli', 'Product Demo', ['Whale Super Sucker'], 'Super Sucker'],
  ['2026-08-04', 'Thoothukudi', 'New Requirement', ['Whale Super Sucker', 'Whale Recycler'], 'New Super Sucker, New Requirements, Recycler Hiring'],
  ['2026-08-05', 'Dindigul', 'Service Visit', [], 'Service, New Requirements'],
  ['2026-08-06', 'Madurai', 'Recycler Hiring', ['Whale Super Sucker', 'Whale Recycler'], 'Super Sucker, Recycler Hiring'],
  ['2026-08-07', 'Sivakasi', 'New Requirement', [], 'Water Tanker'],
  ['2026-08-08', 'Sivagangai', 'Service Visit', [], 'Service'],
  ['2026-08-10', 'Nagercoil', 'New Requirement', [], 'New Requirements']
].map(([visitDate, area, visitPurpose, products, requirement], index) => ({ id: `weekly-example-${index + 1}`, visitDate, expectedTime: '10:00 AM', area, state: 'Tamil Nadu', district: area, city: area, customerId: '', customerName: '', visitPurpose, products, requirement, customProductOrRequirement: requiredProductPurposes.has(visitPurpose) && !products.length ? requirement : '', priority: 'Medium', status: 'Draft', notes: '' }));

const blankRow = () => ({ id: `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, visitDate: '', expectedTime: '10:00 AM', area: '', state: 'Tamil Nadu', district: '', city: '', customerId: '', customerName: '', visitPurpose: '', products: [], requirement: '', customProductOrRequirement: '', priority: 'Medium', status: 'Draft', notes: '' });
const normalizeRow = (row) => ({ ...blankRow(), ...row, products: Array.isArray(row.products) ? row.products : row.productName ? [row.productName] : [] });
const getErrors = (row) => ({ visitDate: !row.visitDate ? 'Visit date is required.' : '', area: !row.area?.trim() ? 'Area or city is required.' : '', visitPurpose: !row.visitPurpose ? 'Visit purpose is required.' : '', products: requiredProductPurposes.has(row.visitPurpose) && !row.products.length && !row.customProductOrRequirement?.trim() ? 'Select at least one product or add another requirement.' : '', requirement: !row.requirement?.trim() ? 'Requirement or project is required.' : '' });
const hasErrors = (row) => Object.values(getErrors(row)).some(Boolean);
const displayDate = (date) => date ? date.split('-').reverse().join('-') : 'Date not set';

const ProductMultiSelect = ({ products, value, onChange, optional, customValue, onCustomChange, error }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState('bottom');
  const [showOther, setShowOther] = useState(Boolean(customValue));
  const rootRef = useRef(null);
  const selectedProducts = value;
  const options = products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()));
  const toggle = (productName) => onChange(selectedProducts.includes(productName) ? selectedProducts.filter((name) => name !== productName) : [...selectedProducts, productName]);
  const remove = (name) => onChange(selectedProducts.filter((item) => item !== name));

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const updatePlacement = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const reserved = window.innerWidth <= 575 ? 90 : 24;
      const spaceBelow = window.innerHeight - rect.bottom - reserved;
      const spaceAbove = rect.top;
      setPlacement(spaceBelow < 320 && spaceAbove > spaceBelow ? 'top' : 'bottom');
    };
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    return () => window.removeEventListener('resize', updatePlacement);
  }, [open]);

  useEffect(() => { setActive((current) => Math.min(current, Math.max(options.length - 1, 0))); }, [options.length]);

  return <div className="ds-field ds-week-product-field" ref={rootRef}>
    <label htmlFor="weekly-product-search">Products{!optional && <span className="ds-required"> *</span>}</label>
    <div className={`ds-multi-select ${error ? 'has-error' : ''}`}>
      {selectedProducts.map((name) => <span className="ds-multi-chip" key={name}>{name}<button type="button" onClick={() => remove(name)} aria-label={`Remove ${name}`}><X size={14} /></button></span>)}
      <div className="ds-multi-search"><Search size={17} aria-hidden="true" /><input id="weekly-product-search" value={query} placeholder="Search products" role="combobox" aria-expanded={open} aria-controls="weekly-product-options" aria-autocomplete="list" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, options.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
        if (event.key === 'Enter' && open && options[active]) { event.preventDefault(); toggle(options[active].name); }
        if (event.key === 'Escape') setOpen(false);
      }} /></div>
    </div>
    {open && <><div className="ds-multi-overlay" onClick={() => setOpen(false)} aria-hidden="true" /><div className={`ds-multi-panel ${placement === 'top' ? 'placement-top' : ''}`}>
      <div className="ds-multi-panel__header"><span>Search products</span>{selectedProducts.length > 0 && <span className="ds-multi-count">{selectedProducts.length} product{selectedProducts.length === 1 ? '' : 's'} selected</span>}</div>
      <div className="ds-multi-list" id="weekly-product-options" role="listbox" aria-multiselectable="true">
        {options.map((product, index) => { const isSelected = selectedProducts.includes(product.name); return <button type="button" role="option" aria-selected={isSelected} key={product.id} className={`ds-multi-option ${isSelected ? 'selected' : ''} ${index === active ? 'active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => toggle(product.name)}>{isSelected && <Check size={15} aria-hidden="true" />}<span>{product.name}</span></button>; })}
        {options.length === 0 && <p className="ds-multi-empty">No products found</p>}
      </div>
      <div className="ds-multi-panel__footer"><Button type="button" variant="secondary" onClick={() => onChange([])} disabled={!selectedProducts.length}>Clear All</Button><Button type="button" onClick={() => setOpen(false)}>Done</Button></div>
    </div></>}
    <button className="ds-add-other" type="button" onClick={() => setShowOther((current) => !current)}>+ Add Other Product / Requirement</button>
    {showOther && <FormField label="Other Product / Requirement" value={customValue} onChange={(event) => onCustomChange(event.target.value)} hint="This remains part of this visit and will not be added to Product Master." />}
    {optional && <small>Product selection is optional for this visit purpose.</small>}
    {error && <span className="ds-field__error">{error}</span>}
  </div>;
};

export const WeeklyPlanningSheet = () => {
  const { currentUser, customers, products, purposes, addTourPlanBatch, showToast } = useApp();
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; } }, []);
  const [weekFrom, setWeekFrom] = useState(saved?.weekFrom || '2026-08-03');
  const [weekTo, setWeekTo] = useState(saved?.weekTo || '2026-08-10');
  const [status, setStatus] = useState('Draft');
  const [rows, setRows] = useState(() => (saved?.rows?.length ? saved.rows : exampleRows).map(normalizeRow));
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const purposeOptions = [...new Set([...purposes, ...requiredProductPurposes, ...optionalProductPurposes])];
  const invalidRows = rows.filter(hasErrors);
  const update = (id, field, value) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const addRow = () => { const row = blankRow(); setRows((current) => [...current, row]); setEditing(row.id); };
  const duplicate = (row) => { const copy = { ...row, id: blankRow().id, status: 'Draft' }; setRows((current) => [...current, copy]); setEditing(copy.id); };
  const remove = () => { setRows((current) => current.filter((row) => row.id !== deleting)); setDeleting(null); showToast('Visit entry removed', 'info'); };
  const saveDraft = () => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ weekFrom, weekTo, rows })); setStatus('Draft'); showToast('Weekly plan saved as draft', 'info'); };
  const review = () => { setShowErrors(true); setReviewing(true); };
  const submit = async () => {
    setShowErrors(true);
    if (invalidRows.length) return;
    const payload = rows.map((row) => { const custom = row.customProductOrRequirement?.trim(); const requirement = custom && !row.requirement.toLowerCase().includes(custom.toLowerCase()) ? `${row.requirement} — ${custom}` : row.requirement; return { ...row, products: row.products, district: row.district || row.area, city: row.city || row.area, requirement, status: 'Pending Approval' }; });
    try {
      await addTourPlanBatch({ rows: payload, planType: 'Weekly', periodFrom: weekFrom, periodTo: weekTo });
      setRows((current) => current.map((row) => ({ ...row, status: normalizePlanStatus('Submitted') })));
      setStatus('Submitted for Director Approval');
      setReviewing(false);
      showToast(`Weekly plan with ${rows.length} visits submitted for approval`, 'success');
    } catch {
      // Preserve the review and all entered values when persistence fails.
    }
  };

  return <div className="ds-page ds-weekly-plan"><PageHeader title="Weekly Visit Planning" description="Create and review the upcoming week’s field visit schedule." actions={<Badge tone={status === 'Draft' ? 'neutral' : 'success'}>{status}</Badge>} />
    <section className="ds-week-header"><div><small>Employee Name</small><strong>{currentUser?.employeeName || currentUser?.fullName || 'Marketing Employee'}</strong></div><DateField label="Week From" value={weekFrom} onChange={(event) => setWeekFrom(event.target.value)} /><DateField label="Week To" value={weekTo} onChange={(event) => setWeekTo(event.target.value)} /><div><small>Plan Status</small><Badge tone={status === 'Draft' ? 'neutral' : 'success'}>{status}</Badge></div></section>
    <div className="ds-visit-list">{rows.map((row, index) => { const errors = getErrors(row); return <article className={`ds-visit-row ${showErrors && hasErrors(row) ? 'has-errors' : ''}`} key={row.id}><div className="ds-week-card-summary"><span className="ds-monthly-row__number">{index + 1}</span><div><small>Date & Time</small><strong>{displayDate(row.visitDate)} · {row.expectedTime}</strong></div><div><small>Area / Customer</small><strong>{row.area || 'Area not set'}</strong><span>{row.customerName || 'Customer not selected'}</span></div><div><small>Purpose</small><strong>{row.visitPurpose || 'Purpose not set'}</strong><span>{row.requirement || 'Requirement not set'}</span></div><div className="ds-week-products"><small>Products</small><div>{row.products.length ? row.products.map((name) => <Badge key={name}>{name}</Badge>) : <span>Optional / none</span>}</div></div><div><small>Priority / Status</small><Badge tone={row.priority === 'High' ? 'danger' : 'neutral'}>{row.priority}</Badge> <Badge>{row.status}</Badge></div><div className="ds-visit-row__actions"><Button variant="secondary" aria-label={`Edit visit ${index + 1}`} onClick={() => setEditing(editing === row.id ? null : row.id)}><Edit3 size={16} /></Button><Button variant="secondary" aria-label={`Duplicate visit ${index + 1}`} onClick={() => duplicate(row)}><Copy size={16} /></Button><Button variant="danger" aria-label={`Delete visit ${index + 1}`} onClick={() => setDeleting(row.id)}><Trash2 size={16} /></Button></div></div>
      {editing === row.id && <div className="ds-week-editor"><div className="ds-form-grid"><DateField label="Visit Date" required value={row.visitDate} error={showErrors ? errors.visitDate : ''} onChange={(event) => update(row.id, 'visitDate', event.target.value)} /><FormField label="Expected Time" value={row.expectedTime} onChange={(event) => update(row.id, 'expectedTime', event.target.value)} /><FormField label="Area / City" required value={row.area} error={showErrors ? errors.area : ''} onChange={(event) => update(row.id, 'area', event.target.value)} /><SelectField label="Customer / Organization" value={row.customerId} onChange={(event) => { const customer = customers.find((item) => String(item.id) === event.target.value); update(row.id, 'customerId', customer?.id || ''); update(row.id, 'customerName', customer?.organizationName || ''); }}><option value="">Customer not selected</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.organizationName}</option>)}</SelectField><SelectField className="ds-field--full" label="Visit Purpose" required value={row.visitPurpose} error={showErrors ? errors.visitPurpose : ''} onChange={(event) => update(row.id, 'visitPurpose', event.target.value)}><option value="">Select visit purpose</option>{purposeOptions.map((purpose) => <option key={purpose}>{purpose}</option>)}</SelectField><ProductMultiSelect products={products} value={row.products} onChange={(value) => update(row.id, 'products', value)} optional={!requiredProductPurposes.has(row.visitPurpose)} customValue={row.customProductOrRequirement} onCustomChange={(value) => update(row.id, 'customProductOrRequirement', value)} error={showErrors ? errors.products : ''} /><TextArea className="ds-field--full" label="Requirement / Project" required rows={3} value={row.requirement} error={showErrors ? errors.requirement : ''} onChange={(event) => update(row.id, 'requirement', event.target.value)} hint="Examples: Service, New Requirements, Recycler Hiring, Water Tanker" /><SelectField label="Priority" value={row.priority} onChange={(event) => update(row.id, 'priority', event.target.value)}><option>High</option><option>Medium</option><option>Low</option></SelectField><TextArea label="Notes" rows={3} value={row.notes} onChange={(event) => update(row.id, 'notes', event.target.value)} /></div></div>}</article>; })}</div>
    <div className="ds-sticky-actions"><Button variant="secondary" onClick={addRow}><Plus size={16} /> Add Visit Entry</Button><Button variant="secondary" onClick={saveDraft}>Save Draft</Button><Button onClick={review}>Review Plan</Button></div>
    <Modal open={reviewing} onClose={() => setReviewing(false)} title="Review Weekly Plan" subtitle={`${weekFrom} to ${weekTo}`} footer={<><Button variant="secondary" onClick={() => setReviewing(false)}>Back to Edit</Button><Button onClick={submit} disabled={invalidRows.length > 0}><Send size={16} /> Submit for Director Approval</Button></>}><div className="ds-week-review">{invalidRows.length > 0 && <div className="ds-error" role="alert">{invalidRows.length} visit {invalidRows.length === 1 ? 'has' : 'have'} missing required information. Return to edit the highlighted cards.</div>}<div className="ds-week-review__head"><strong>Date</strong><strong>Area</strong><strong>Purpose</strong><strong>Products</strong><strong>Requirement</strong><strong>Priority</strong></div>{rows.map((row) => <div className={hasErrors(row) ? 'has-errors' : ''} key={row.id}><span>{displayDate(row.visitDate)}</span><span>{row.area || 'Missing'}</span><span>{row.visitPurpose || 'Missing'}</span><span>{row.products.join(', ') || 'Optional / none'}</span><span>{row.requirement || 'Missing'}</span><Badge tone={row.priority === 'High' ? 'danger' : 'neutral'}>{row.priority}</Badge></div>)}</div></Modal>
    <ConfirmationDialog open={Boolean(deleting)} title="Delete visit?" message="This visit will be removed from the weekly plan." confirmLabel="Delete Visit" danger onClose={() => setDeleting(null)} onConfirm={remove} />
  </div>;
};

export default WeeklyPlanningSheet;
