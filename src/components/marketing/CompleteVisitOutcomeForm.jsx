import React, { useCallback, useRef, useState } from 'react';
import { Check, Clock3, FileText, Hourglass, MonitorPlay, ThumbsDown, ThumbsUp, Upload, X } from 'lucide-react';
import { ModalPortal } from '../ui';
import CalendarDatePicker from './CalendarDatePicker';

const RESPONSES = [
  { label: 'Interested', icon: ThumbsUp },
  { label: 'Need Quotation', icon: FileText },
  { label: 'Need Demo', icon: MonitorPlay },
  { label: 'Need Follow-up', icon: Clock3 },
  { label: 'Decision Pending', icon: Hourglass },
  { label: 'Not Interested', icon: ThumbsDown },
];

const todayDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const CompleteVisitOutcomeForm = ({ visit, form, onChange, onCustomerResponse, onFollowUpToggle, onDateChange, onClose, onSubmit, submitting }) => {
  const fileInputRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback((incoming) => {
    const allowed = [...incoming].filter((file) => /\.(jpe?g|png|pdf)$/i.test(file.name) && file.size <= 10 * 1024 * 1024);
    setFiles((previous) => {
      const unique = new Map(previous.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
      allowed.forEach((file) => unique.set(`${file.name}-${file.size}-${file.lastModified}`, file));
      return [...unique.values()];
    });
  }, []);

  return (
    <ModalPortal onClose={onClose} closeOnBackdrop={false} closeOnEscape>
      <div className="modal-content complete-visit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><h3>Complete Visit Outcome Form</h3><p>Record the customer outcome and next steps.</p></div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close complete visit form"><X size={20} /></button>
        </div>
        <form className="complete-visit-outcome-form" onSubmit={onSubmit}>
          <div className="modal-body complete-visit-body">
            <div className="complete-visit-customer"><span>Customer</span><strong>{visit.customerName || 'Customer not specified'}</strong></div>

            <fieldset className="complete-visit-section complete-response-section">
              <legend className="form-label">Customer Response *</legend>
              <div className="complete-response-grid" role="radiogroup" aria-label="Customer response">
                {RESPONSES.map(({ label, icon: Icon }) => {
                  const selected = form.customerResponse === label;
                  return <button type="button" role="radio" aria-checked={selected} className={selected ? 'selected' : ''} key={label} onClick={() => onCustomerResponse(label)}><Icon size={17} /><span>{label}</span>{selected && <Check className="complete-response-check" size={15} />}</button>;
                })}
              </div>
            </fieldset>

            <div className="form-group complete-visit-section">
              <div className="complete-field-label"><label className="form-label" htmlFor="complete-discussion-notes">Discussion Notes *</label><span>{form.discussionNotes.length} characters</span></div>
              <textarea id="complete-discussion-notes" name="discussionNotes" className="form-textarea" required rows={5} placeholder="Enter meeting notes, customer feedback, and key requirements..." value={form.discussionNotes} onChange={onChange} />
            </div>

            <div className="form-group complete-visit-section">
              <label className="form-label" htmlFor="complete-next-action">Next Action</label>
              <input id="complete-next-action" name="nextAction" type="text" className="form-input" placeholder="e.g. Send quotation, schedule demo, or call the customer" value={form.nextAction} onChange={onChange} />
            </div>

            <div className="complete-follow-up complete-visit-section">
              <div className="complete-follow-up-toggle-row">
                <div><strong>Follow-up Required</strong><span>Schedule the next customer action</span></div>
                <button type="button" className={`complete-toggle${form.isFollowUpRequired ? ' selected' : ''}`} role="switch" aria-checked={form.isFollowUpRequired} aria-label="Follow-up Required" onClick={() => { const enabled = !form.isFollowUpRequired; onFollowUpToggle(enabled); setCalendarOpen(enabled); }}><span /></button>
              </div>
              {form.isFollowUpRequired && <div className="form-group complete-follow-up-date"><label className="form-label">Follow-up Date</label><CalendarDatePicker value={form.followUpDate} min={todayDateKey()} open={calendarOpen} onOpenChange={setCalendarOpen} onChange={onDateChange} /></div>}
            </div>

            <div className="form-group complete-visit-section">
              <label className="form-label">Attachments</label>
              <input ref={fileInputRef} className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={(event) => addFiles(event.target.files)} />
              <div className={`complete-upload-zone${dragging ? ' dragging' : ''}`} role="button" tabIndex={0} aria-label="Choose visit report attachments" onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click(); } }} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
                <span className="complete-upload-icon"><Upload size={23} /></span><strong>Drag and drop files here</strong><span>or <u>Browse Files</u></span><small>JPG, PNG, PDF • Max 10 MB</small>
              </div>
              {files.length > 0 && <div className="complete-file-list" aria-label="Selected files">{files.map((file) => <span key={`${file.name}-${file.size}-${file.lastModified}`}><FileText size={15} /><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={14} /></button></span>)}</div>}
            </div>
          </div>
          <div className="modal-footer complete-visit-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" className="btn btn-success" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Visit Report'}</button></div>
        </form>
      </div>
    </ModalPortal>
  );
};

export default CompleteVisitOutcomeForm;
