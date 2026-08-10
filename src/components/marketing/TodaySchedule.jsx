import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Play, CheckCircle2, XCircle, Calendar, MapPin, X, Eye, Edit3, Trash2, Send } from 'lucide-react';
import { normalizePlanStatus } from '../../utils/planStatus';
import { getLocalDateKey, normalizeDateKey } from '../../utils/dateUtils';
import { formatVisitDateTime, formatVisitTimer, getVisitExecutionState } from '../../utils/visitLifecycle';
import { EntityDetailsModal } from '../common/details';

const LEGACY_DETAIL_PRESENTATION = false;
import { isDatabaseVisitPlanId } from '../../utils/visitPlanDraftCache';
import { ConfirmationDialog, ModalPortal } from '../ui';
import CompleteVisitOutcomeForm from './CompleteVisitOutcomeForm';

const LEGACY_STATUSES = new Set([
  'approved',
  'rejected',
  'changes requested',
  'pending approval',
  'submitted for director approval'
]);

const todayDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const cleanDisplayValue = (value) => {
  const text = String(value ?? '').trim();
  return text && !['null', 'undefined'].includes(text.toLowerCase()) ? text : '';
};

const formatVisitLocation = (visit) => {
  const fullAddress = cleanDisplayValue(visit.fullAddress);
  if (fullAddress) return fullAddress;
  return [...new Set([visit.area, visit.city, visit.district].map(cleanDisplayValue).filter(Boolean))].join(', ') || 'Location not provided';
};

export const TodaySchedule = () => {
  const {
    currentUser,
    visitPlans,
    updateVisitPlanStatus,
    startVisit,
    rescheduleVisitPlan,
    submitVisitReport,
    deleteVisitPlanEntry,
    inspectCompletedVisitDelete,
    getVisitReportForPlan,
    deleteCompletedVisit,
    updateEditableVisitPlan,
    resubmitVisitPlan,
    showToast
  } = useApp();

  const empId = currentUser?.employeeId || 'EMP001';
  const myTodayVisits = visitPlans.filter((plan) =>
    plan.employeeId === empId && normalizeDateKey(plan.visitDate) === getLocalDateKey()
  );
  const [timerNow, setTimerNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setTimerNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Modals state
  const [startVisitModal, setStartVisitModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [completedDeletingPlan, setCompletedDeletingPlan] = useState(null);
  const [completedDeleteImpact, setCompletedDeleteImpact] = useState(null);
  const [completedDeleteStage, setCompletedDeleteStage] = useState('initial');
  const [checkingDeleteImpact, setCheckingDeleteImpact] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const completeSubmittingRef = useRef(false);

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
    followUpDate: todayDateKey(),
    isQuotationRequired: false,
    finalStatus: 'Completed'
  });

  const handleCloseCompleteModal = useCallback(() => {
    setCompleteModal(null);
  }, []);

  const handleCompleteFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setCompleteForm((previous) => ({
      ...previous,
      [name]: name === 'isFollowUpRequired' ? value === 'Yes' : value,
    }));
  }, []);

  const handleCustomerResponse = useCallback((customerResponse) => {
    setCompleteForm((previous) => ({ ...previous, customerResponse }));
  }, []);

  const handleFollowUpToggle = useCallback((enabled) => {
    setCompleteForm((previous) => ({
      ...previous,
      isFollowUpRequired: enabled,
      followUpDate: enabled ? (previous.followUpDate || todayDateKey()) : '',
    }));
  }, []);

  const handleFollowUpDateChange = useCallback((followUpDate) => {
    setCompleteForm((previous) => ({ ...previous, followUpDate }));
  }, []);

  const handleConfirmStart = async (visit) => {
    if (busyAction) return;
    setBusyAction(`start-${visit.id}`);
    try {
      await startVisit(visit.id);
      setStartVisitModal(null);
    } catch {
      // Keep the confirmation visible so the employee can review the error.
    } finally {
      setBusyAction('');
    }
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

  const handleConfirmComplete = async (e) => {
    e.preventDefault();
    if (!completeModal || completeSubmittingRef.current) return;
    completeSubmittingRef.current = true;
    setBusyAction('complete-visit');
    try {
      const saved = await submitVisitReport({
        visitPlanId: completeModal.id,
        customerName: completeModal.customerName,
        visitDate: completeModal.visitDate,
        ...completeForm
      });
      if (saved?.id) {
        setCompleteModal(null);
      }
    } catch {
      // AppContext shows the mapped safe error; retain the modal and its values.
    } finally {
      completeSubmittingRef.current = false;
      setBusyAction('');
    }
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
      showToast(error?.message || 'Unable to delete this visit plan.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const closeCompletedDelete = () => {
    if (busyAction) return;
    setCompletedDeletingPlan(null);
    setCompletedDeleteImpact(null);
    setCompletedDeleteStage('initial');
  };

  const requestCompletedDelete = async (visit) => {
    if (busyAction || checkingDeleteImpact) return;
    setCompletedDeletingPlan(visit);
    setCompletedDeleteImpact(null);
    setCompletedDeleteStage('initial');
    setCheckingDeleteImpact(true);
    try {
      setCompletedDeleteImpact(await inspectCompletedVisitDelete(visit.id));
    } catch (error) {
      showToast(error?.message || 'Unable to inspect this completed visit.', 'error');
      setCompletedDeletingPlan(null);
    } finally {
      setCheckingDeleteImpact(false);
    }
  };

  const handleCompletedDelete = async () => {
    if (busyAction || checkingDeleteImpact || !completedDeletingPlan || !completedDeleteImpact) return;
    if (completedDeleteStage === 'initial' && completedDeleteImpact.hasRelatedData) {
      setCompletedDeleteStage('related');
      return;
    }
    setBusyAction(`delete-${completedDeletingPlan.id}`);
    try {
      await deleteCompletedVisit(completedDeletingPlan.id);
      showToast('Completed visit deleted successfully.', 'success');
      setCompletedDeletingPlan(null);
      setCompletedDeleteImpact(null);
      setCompletedDeleteStage('initial');
    } catch (error) {
      showToast(error?.message || 'Unable to delete this completed visit. No data was removed.', 'error');
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

  const openVisitDetails = async (visit) => {
    setDetailsModal({ ...visit, visitReport: null, detailsError: null });
    if (normalizePlanStatus(visit.status) !== 'Completed') return;
    setDetailsLoading(true);
    try {
      const report = await getVisitReportForPlan(visit.id, visit.visitReportId || visit.reportId);
      setDetailsModal((current) => current?.id === visit.id
        ? { ...current, visitReport: report, detailsError: report ? null : 'legacy' }
        : current);
    } catch (error) {
      const detailsError = error?.message === 'VISIT_REPORT_ACCESS_DENIED' ? 'permission' : 'network';
      setDetailsModal((current) => current?.id === visit.id ? { ...current, detailsError } : current);
    } finally {
      setDetailsLoading(false);
    }
  };

  const renderActions = (visit) => {
    const status = normalizePlanStatus(visit.status);
    const rawStatus = String(visit.rawStatus || visit.status || '').trim().toLowerCase();
    const pending = busyAction.endsWith(visit.id);
    const isMarketingOwner =
      ['Marketing', 'Marketing Team'].includes(currentUser?.role) &&
      visit.employeeId === currentUser?.employeeId;
    const canDelete =
      isMarketingOwner &&
      isDatabaseVisitPlanId(visit.id) &&
      (
        ['Draft', 'Submitted', 'Rescheduled', 'Cancelled'].includes(status) ||
        LEGACY_STATUSES.has(rawStatus)
      );
    const deleteButton = canDelete ? (
      <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => setDeletingPlan(visit)}>
        <Trash2 size={14} /> Delete
      </button>
    ) : null;
    const detailsButton = (
      <button className="btn btn-secondary btn-sm" onClick={() => openVisitDetails(visit)}>
        <Eye size={14} /> View Details
      </button>
    );
    if (LEGACY_STATUSES.has(rawStatus)) {
      return <>
        {detailsButton}
        {deleteButton}
      </>;
    }
    if (status === 'Completed') {
      return <>
        {detailsButton}
        {isMarketingOwner && isDatabaseVisitPlanId(visit.id) && (
          <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => requestCompletedDelete(visit)}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </>;
    }
    if (status === 'Cancelled') {
      return <>{detailsButton}{deleteButton}</>;
    }
    if (status === 'Submitted' || status === 'Planned' || status === 'Approved') {
      return <>
        <button className="btn btn-primary" onClick={() => setStartVisitModal(visit)}><Play size={16} /> Start Visit</button>
        <button className="btn btn-warning btn-sm" onClick={() => setRescheduleModal(visit)}><Calendar size={14} /> Reschedule</button>
        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(visit)}><XCircle size={14} /> Cancel Visit</button>
        {detailsButton}
        {deleteButton}
      </>;
    }
    if (status === 'Started' || status === 'In Progress') {
      return <>
        <button className="btn btn-success" onClick={() => setCompleteModal(visit)}><CheckCircle2 size={16} /> Close Visit</button>
        {detailsButton}
      </>;
    }
    if (status === 'Rescheduled') {
      return <>
        <button className="btn btn-warning btn-sm" onClick={() => setRescheduleModal(visit)}><Calendar size={14} /> Edit Date/Time</button>
        <button className="btn btn-primary" onClick={() => setStartVisitModal(visit)}><Play size={16} /> Start Visit</button>
        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(visit)}><XCircle size={14} /> Cancel Visit</button>
        {detailsButton}
        {deleteButton}
      </>;
    }
    if (status === 'Draft') {
      return <>
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => openEditor(visit)}><Edit3 size={14} /> Edit</button>
        {deleteButton}
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => handleResubmit(visit)}><Send size={14} /> Submit Visit Plan</button>
      </>;
    }
    return detailsButton;
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
                  <span className={`badge badge-${String(getVisitExecutionState(visit, timerNow)).toLowerCase().replaceAll(' ', '-')}`}>{getVisitExecutionState(visit, timerNow)}</span>
                  <span className={`badge badge-${visit.priority.toLowerCase()}`}>{visit.priority} Priority</span>
                </div>

                <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '4px' }}>{visit.customerName}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {formatVisitLocation(visit)}
                </p>

                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <div><strong>Visit Purpose:</strong> {visit.visitPurpose}</div>
                  <div><strong>Products Interested:</strong> {Array.isArray(visit.products) ? visit.products.join(', ') : visit.products}</div>
                  <div><strong>Requirement Notes:</strong> {visit.requirement}</div>
                  {normalizePlanStatus(visit.status) === 'In Progress' && <div className={`visit-execution-timer${getVisitExecutionState(visit, timerNow) === 'Closure Overdue' ? ' visit-execution-timer--overdue' : ''}`}>
                    <strong>Visit In Progress</strong>
                    <span>Started At: {formatVisitDateTime(visit.startedAt)}</span>
                    <span>Closure deadline: {formatVisitDateTime(visit.closeDeadline)}</span>
                    <b>{formatVisitTimer(visit, timerNow)}</b>
                  </div>}
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

      <EntityDetailsModal open={Boolean(detailsModal)} onClose={() => setDetailsModal(null)} type="visitPlan" entity={detailsModal} notice={detailsLoading ? 'Loading submitted visit report…' : detailsModal?.detailsError === 'legacy' ? 'This legacy completed visit does not contain a submitted visit report.' : detailsModal?.detailsError === 'permission' ? 'You are not authorized to view this visit report.' : detailsModal?.detailsError === 'network' ? 'The visit report could not be loaded. Please retry.' : null} />
      {LEGACY_DETAIL_PRESENTATION && detailsModal && (
        <ModalPortal onClose={() => setDetailsModal(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header"><h3>Visit Plan Details</h3><button className="btn btn-secondary btn-sm" onClick={() => setDetailsModal(null)}><X size={16} /></button></div>
            <div className="modal-body" style={{ display: 'grid', gap: '10px' }}>
              {detailsLoading && <div role="status">Loading submitted visit report…</div>}
              {!detailsLoading && detailsModal.detailsError === 'legacy' && <div className="ds-error">This legacy completed visit does not contain a submitted visit report.</div>}
              {!detailsLoading && detailsModal.detailsError === 'permission' && <div className="ds-error">You are not authorized to view this visit report.</div>}
              {!detailsLoading && detailsModal.detailsError === 'network' && <div className="ds-error">The visit report could not be loaded. Please retry.</div>}
              <div><strong>Status:</strong> {normalizePlanStatus(detailsModal.status)}</div>
              <div><strong>Visit Date:</strong> {detailsModal.visitDate || 'Not provided'}</div>
              <div><strong>Expected Time:</strong> {detailsModal.expectedTime || 'Not provided'}</div>
              <div><strong>Area / City:</strong> {detailsModal.area || detailsModal.city || 'Not provided'}</div>
              <div><strong>Customer / Organization:</strong> {detailsModal.customerName || detailsModal.organizationName || 'Not provided'}</div>
              <div><strong>Visit Purpose:</strong> {detailsModal.visitPurpose || 'Not provided'}</div>
              <div><strong>Products:</strong> {Array.isArray(detailsModal.products) ? detailsModal.products.join(', ') || 'Not provided' : detailsModal.products || 'Not provided'}</div>
              <div><strong>Requirement:</strong> {detailsModal.requirement || 'Not provided'}</div>
              <div><strong>Notes:</strong> {detailsModal.notes || 'Not provided'}</div>
              {detailsModal.visitReport && <>
                <div><strong>Customer Response:</strong> {detailsModal.visitReport.customerResponse || 'Not provided'}</div>
                <div><strong>Discussion Notes:</strong> {detailsModal.visitReport.discussionNotes || 'Not provided'}</div>
                <div><strong>Next Action:</strong> {detailsModal.visitReport.nextAction || 'Not provided'}</div>
                <div><strong>Follow-up Date:</strong> {detailsModal.visitReport.followUpDate || 'Not required'}</div>
                <div><strong>Submitted At:</strong> {detailsModal.visitReport.submittedAt ? new Date(detailsModal.visitReport.submittedAt).toLocaleString() : 'Not provided'}</div>
              </>}
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

      {completedDeletingPlan && (
        <ModalPortal onClose={closeCompletedDelete} closeOnBackdrop={false} closeOnEscape={!busyAction}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header"><h3>Delete Completed Visit?</h3></div>
            <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
              <p>
                {completedDeleteStage === 'related'
                  ? 'Related report data was found. Confirm once more to permanently delete the visit and all linked records.'
                  : 'This will permanently remove the completed visit and its related report data. This action cannot be undone.'}
              </p>
              <div className="card" style={{ display: 'grid', gap: '7px', padding: '14px' }}>
                <div><strong>Visit place:</strong> {formatVisitLocation(completedDeletingPlan)}</div>
                <div><strong>Visit date:</strong> {cleanDisplayValue(completedDeletingPlan.visitDate) || 'Not provided'}</div>
                <div><strong>Visit time:</strong> {cleanDisplayValue(completedDeletingPlan.expectedTime) || 'Not provided'}</div>
                <div><strong>Customer / organization:</strong> {cleanDisplayValue(completedDeletingPlan.customerName || completedDeletingPlan.organizationName) || 'Not provided'}</div>
              </div>
              {checkingDeleteImpact && <p role="status">Checking related records…</p>}
              {completedDeleteImpact?.hasRelatedData && (
                <div className="alert alert-warning" role="status">
                  Related data: {completedDeleteImpact.reportCount || 0} report, {completedDeleteImpact.followUpCount || 0} follow-up, {completedDeleteImpact.notificationCount || 0} notification, {completedDeleteImpact.commentCount || 0} feedback item.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeCompletedDelete} disabled={Boolean(busyAction)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleCompletedDelete} disabled={Boolean(busyAction) || checkingDeleteImpact || !completedDeleteImpact}>
                {busyAction === `delete-${completedDeletingPlan.id}`
                  ? 'Deleting…'
                  : completedDeleteStage === 'initial' && completedDeleteImpact?.hasRelatedData
                    ? 'Continue'
                    : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

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
              <button className="btn btn-primary" disabled={busyAction === `start-${startVisitModal.id}`} onClick={() => handleConfirmStart(startVisitModal)}>{busyAction === `start-${startVisitModal.id}` ? 'Starting…' : 'Start Visit'}</button>
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
        <CompleteVisitOutcomeForm
          visit={completeModal}
          form={completeForm}
          onChange={handleCompleteFormChange}
          onCustomerResponse={handleCustomerResponse}
          onFollowUpToggle={handleFollowUpToggle}
          onDateChange={handleFollowUpDateChange}
          onClose={handleCloseCompleteModal}
          onSubmit={handleConfirmComplete}
          submitting={busyAction === 'complete-visit'}
        />
      )}
    </div>
  );
};
