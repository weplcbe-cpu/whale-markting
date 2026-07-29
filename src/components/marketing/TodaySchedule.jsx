import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Play, CheckCircle2, XCircle, Calendar, MapPin, X, Upload, Eye, Edit3, Trash2, Send } from 'lucide-react';
import { normalizePlanStatus } from '../../utils/planStatus';
import { ConfirmationDialog, ModalPortal } from '../ui';

const LEGACY_STATUSES = new Set([
  'approved',
  'rejected',
  'changes requested',
  'pending approval',
  'submitted for director approval'
]);

export const TodaySchedule = () => {
  const {
    currentUser,
    visitPlans,
    updateVisitPlanStatus,
    rescheduleVisitPlan,
    submitVisitReport,
    deleteVisitPlanEntry,
    updateEditableVisitPlan,
    resubmitVisitPlan,
    showToast
  } = useApp();

  const empId = currentUser?.employeeId || 'EMP001';
  const myTodayVisits = visitPlans.filter(p => p.employeeId === empId);

  // Modals state
  const [startVisitModal, setStartVisitModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [busyAction, setBusyAction] = useState('');

  // Form states
  const [cancelReason, setCancelReason] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('10:00 AM');
  const [reschedReason, setReschedReason] = useState('');

  // Complete Visit Form State
  const [completeForm, setCompleteForm] = useState({
    meetingCompleted: true,
    actualTime: '10:30 AM - 11:45 AM',
    customerResponse: 'Interested',
    discussionNotes: '',
    requirementDetails: '',
    nextAction: '',
    isFollowUpRequired: true,
    followUpDate: '2026-07-25',
    isQuotationRequired: false,
    isTenderRelated: false,
    finalStatus: 'Completed'
  });

  const handleConfirmStart = (visit) => {
    updateVisitPlanStatus(visit.id, 'Started', { startTime: new Date().toLocaleTimeString() });
    setStartVisitModal(null);
  };

  const handleConfirmCancel = (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    updateVisitPlanStatus(cancelModal.id, 'Cancelled', { cancelReason });
    setCancelModal(null);
    setCancelReason('');
  };

  const handleConfirmReschedule = (e) => {
    e.preventDefault();
    if (!reschedDate || !reschedReason.trim()) return;
    rescheduleVisitPlan(rescheduleModal.id, reschedDate, reschedTime, reschedReason);
    setRescheduleModal(null);
  };

  const handleConfirmComplete = (e) => {
    e.preventDefault();
    submitVisitReport({
      visitPlanId: completeModal.id,
      customerName: completeModal.customerName,
      visitDate: completeModal.visitDate,
      ...completeForm
    });
    setCompleteModal(null);
  };

  const openEditor = (visit) => setEditModal({
    id: visit.id,
    visitDate: visit.visitDate || '',
    expectedTime: visit.expectedTime || '',
    area: visit.area || visit.city || '',
    visitPurpose: visit.visitPurpose || '',
    requirement: visit.requirement || '',
    notes: visit.notes || ''
  });

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editModal || busyAction) return;
    setBusyAction(`edit-${editModal.id}`);
    try {
      await updateEditableVisitPlan(editModal.id, editModal);
      setEditModal(null);
    } catch (error) {
      showToast(error?.message || 'Unable to update the visit plan.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleDelete = async () => {
    if (busyAction || !deletingPlan) return;
    const visit = deletingPlan;
    setBusyAction(`delete-${visit.id}`);
    try {
      await deleteVisitPlanEntry(visit.id);
      showToast('Visit plan permanently deleted.', 'success');
      setDeletingPlan(null);
    } catch (error) {
      showToast(error?.message || 'Unable to delete the visit plan.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleResubmit = async (visit) => {
    if (busyAction) return;
    setBusyAction(`submit-${visit.id}`);
    try {
      await resubmitVisitPlan(visit.id);
    } catch (error) {
      showToast(error?.message || 'Unable to submit the visit plan.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const renderActions = (visit) => {
    const status = normalizePlanStatus(visit.status);
    const rawStatus = String(visit.status || '').trim().toLowerCase();
    const pending = busyAction.endsWith(visit.id);
    if (LEGACY_STATUSES.has(rawStatus)) {
      return <>
        <button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(visit)}><Eye size={14} /> View Details</button>
        <button className="btn btn-danger btn-sm" disabled={pending || !visit.id} onClick={() => setDeletingPlan(visit)}><Trash2 size={14} /> Delete</button>
      </>;
    }
    if (['Completed', 'Cancelled'].includes(status)) {
      return <button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(visit)}><Eye size={14} /> View Details</button>;
    }
    if (status === 'Submitted') {
      return <>
        <button className="btn btn-primary" onClick={() => setStartVisitModal(visit)}><Play size={16} /> Start Visit</button>
        <button className="btn btn-warning btn-sm" onClick={() => setRescheduleModal(visit)}><Calendar size={14} /> Reschedule</button>
        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(visit)}><XCircle size={14} /> Cancel Visit</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(visit)}><Eye size={14} /> View Details</button>
      </>;
    }
    if (status === 'Started') {
      return <>
        <button className="btn btn-success" onClick={() => setCompleteModal(visit)}><CheckCircle2 size={16} /> Complete Visit</button>
        <button className="btn btn-warning btn-sm" onClick={() => setRescheduleModal(visit)}><Calendar size={14} /> Reschedule</button>
        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(visit)}><XCircle size={14} /> Cancel Visit</button>
      </>;
    }
    if (status === 'Rescheduled') {
      return <>
        <button className="btn btn-warning btn-sm" onClick={() => setRescheduleModal(visit)}><Calendar size={14} /> Edit Date/Time</button>
        <button className="btn btn-primary" onClick={() => setStartVisitModal(visit)}><Play size={16} /> Start Visit</button>
        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(visit)}><XCircle size={14} /> Cancel Visit</button>
      </>;
    }
    if (status === 'Draft') {
      return <>
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => openEditor(visit)}><Edit3 size={14} /> Edit</button>
        <button className="btn btn-danger btn-sm" disabled={pending || !visit.id} onClick={() => setDeletingPlan(visit)}><Trash2 size={14} /> Delete</button>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => handleResubmit(visit)}><Send size={14} /> Submit Visit Plan</button>
      </>;
    }
    return <button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(visit)}><Eye size={14} /> View Details</button>;
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Today's Scheduled Field Visits</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Available actions are based on each visit plan's current status.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {myTodayVisits.map(visit => (
          <div key={visit.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    🕒 {visit.expectedTime}
                  </span>
                  <span className={`badge badge-${visit.status.toLowerCase()}`}>{visit.status}</span>
                  <span className={`badge badge-${visit.priority.toLowerCase()}`}>{visit.priority} Priority</span>
                </div>

                <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '4px' }}>{visit.customerName}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {visit.fullAddress || `${visit.city}, ${visit.district}`}
                </p>

                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <div><strong>Visit Purpose:</strong> {visit.visitPurpose}</div>
                  <div><strong>Products Interested:</strong> {Array.isArray(visit.products) ? visit.products.join(', ') : visit.products}</div>
                  <div><strong>Requirement Notes:</strong> {visit.requirement}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="field-visit-actions">
                {renderActions(visit)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {detailsModal && (
        <ModalPortal onClose={() => setDetailsModal(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header"><h3>Visit Plan Details</h3><button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(null)}><X size={16} /></button></div>
            <div className="modal-body" style={{ display: 'grid', gap: '10px' }}>
              <div><strong>Status:</strong> {normalizePlanStatus(detailsModal.status)}</div>
              <div><strong>Visit Date:</strong> {detailsModal.visitDate || 'Not provided'}</div>
              <div><strong>Expected Time:</strong> {detailsModal.expectedTime || 'Not provided'}</div>
              <div><strong>Area / City:</strong> {detailsModal.area || detailsModal.city || 'Not provided'}</div>
              <div><strong>Customer / Organization:</strong> {detailsModal.customerName || detailsModal.organizationName || 'Not provided'}</div>
              <div><strong>Visit Purpose:</strong> {detailsModal.visitPurpose || 'Not provided'}</div>
              <div><strong>Products:</strong> {Array.isArray(detailsModal.products) ? detailsModal.products.join(', ') || 'Not provided' : detailsModal.products || 'Not provided'}</div>
              <div><strong>Requirement:</strong> {detailsModal.requirement || 'Not provided'}</div>
              <div><strong>Notes:</strong> {detailsModal.notes || 'Not provided'}</div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDetailsModal(null)}>Close</button></div>
          </div>
        </ModalPortal>
      )}

      {editModal && (
        <ModalPortal onClose={() => setEditModal(null)} closeOnBackdrop={false}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header"><h3>Edit Visit Plan</h3></div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'grid', gap: '12px' }}>
                <label className="form-group"><span className="form-label">Visit Date *</span><input className="form-input" type="date" required value={editModal.visitDate} onChange={(event) => setEditModal({ ...editModal, visitDate: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Expected Time *</span><input className="form-input" required value={editModal.expectedTime} onChange={(event) => setEditModal({ ...editModal, expectedTime: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Area / City *</span><input className="form-input" required value={editModal.area} onChange={(event) => setEditModal({ ...editModal, area: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Visit Purpose *</span><input className="form-input" required value={editModal.visitPurpose} onChange={(event) => setEditModal({ ...editModal, visitPurpose: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Requirement / Objective (Optional)</span><textarea className="form-textarea" rows={3} value={editModal.requirement} onChange={(event) => setEditModal({ ...editModal, requirement: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Notes (Optional)</span><textarea className="form-textarea" rows={3} value={editModal.notes} onChange={(event) => setEditModal({ ...editModal, notes: event.target.value })} /></label>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={Boolean(busyAction)}>Save Changes</button></div>
            </form>
          </div>
        </ModalPortal>
      )}

      <ConfirmationDialog
        open={Boolean(deletingPlan)}
        title="Delete this visit plan permanently?"
        message="This action cannot be undone."
        confirmLabel="Delete Visit Plan"
        danger
        confirming={Boolean(deletingPlan && busyAction === `delete-${deletingPlan.id}`)}
        onClose={() => {
          if (!busyAction) setDeletingPlan(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Start Visit Modal */}
      {startVisitModal && (
        <ModalPortal onClose={() => setStartVisitModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Start Field Visit</h3>
            </div>
            <div className="modal-body">
              <p>Confirm starting visit for <strong>{startVisitModal.customerName}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStartVisitModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleConfirmStart(startVisitModal)}>Confirm Start</button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Cancel Visit Modal */}
      {cancelModal && (
        <ModalPortal onClose={() => setCancelModal(null)} closeOnBackdrop={false}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Cancel Visit - {cancelModal.customerName}</h3>
            </div>
            <form onSubmit={handleConfirmCancel}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Cancellation Reason *</label>
                  <textarea
                    className="form-textarea"
                    required
                    rows={3}
                    placeholder="Enter reason for cancellation..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCancelModal(null)}>Back</button>
                <button type="submit" className="btn btn-danger">Confirm Cancellation</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Reschedule Visit Modal */}
      {rescheduleModal && (
        <ModalPortal onClose={() => setRescheduleModal(null)} closeOnBackdrop={false}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Reschedule Visit</h3>
            </div>
            <form onSubmit={handleConfirmReschedule}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={reschedDate}
                    onChange={(e) => setReschedDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Time</label>
                  <input
                    type="text"
                    className="form-input"
                    value={reschedTime}
                    onChange={(e) => setReschedTime(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reschedule Reason *</label>
                  <textarea
                    className="form-textarea"
                    required
                    rows={3}
                    placeholder="Enter reason for reschedule..."
                    value={reschedReason}
                    onChange={(e) => setReschedReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRescheduleModal(null)}>Back</button>
                <button type="submit" className="btn btn-primary">Confirm Reschedule</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Complete Visit Outcome Modal */}
      {completeModal && (
        <ModalPortal onClose={() => setCompleteModal(null)} closeOnBackdrop={false}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Complete Visit Outcome Form</h3>
              <button onClick={() => setCompleteModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmComplete}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><strong>Customer:</strong> {completeModal.customerName}</div>

                <div className="form-group">
                  <label className="form-label">Customer Response (Tap one option) *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {[
                      { label: 'Interested', icon: '👍', color: 'var(--accent-emerald)' },
                      { label: 'Need Quotation', icon: '📄', color: 'var(--primary)' },
                      { label: 'Need Demo', icon: '📽️', color: 'var(--accent-cyan)' },
                      { label: 'Need Follow-up', icon: '🕒', color: 'var(--accent-amber)' },
                      { label: 'Decision Pending', icon: '⏳', color: 'var(--accent-purple)' },
                      { label: 'Not Interested', icon: '👎', color: 'var(--accent-rose)' }
                    ].map(item => {
                      const isSelected = completeForm.customerResponse === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setCompleteForm({ ...completeForm, customerResponse: item.label })}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: `2px solid ${isSelected ? item.color : 'var(--border-color)'}`,
                            background: isSelected ? 'var(--primary-light)' : 'var(--bg-input)',
                            color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Discussion Notes *</label>
                  <textarea
                    className="form-textarea"
                    required
                    rows={3}
                    placeholder="Enter meeting notes and customer feedback..."
                    value={completeForm.discussionNotes}
                    onChange={(e) => setCompleteForm({ ...completeForm, discussionNotes: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Next Action</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Send formal quotation by Friday"
                    value={completeForm.nextAction}
                    onChange={(e) => setCompleteForm({ ...completeForm, nextAction: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Follow-up Required?</label>
                    <select
                      className="form-select"
                      value={completeForm.isFollowUpRequired ? 'Yes' : 'No'}
                      onChange={(e) => setCompleteForm({ ...completeForm, isFollowUpRequired: e.target.value === 'Yes' })}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {completeForm.isFollowUpRequired && (
                    <div className="form-group">
                      <label className="form-label">Follow-up Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={completeForm.followUpDate}
                        onChange={(e) => setCompleteForm({ ...completeForm, followUpDate: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Upload Site Photo / Document Mock</label>
                  <div style={{ border: '2px dashed var(--border-color)', padding: '16px', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
                    <Upload size={24} color="var(--accent-cyan)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Click to upload site photos or demonstration documents</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCompleteModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success">Submit Visit Report</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
