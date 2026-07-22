import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FileSpreadsheet, Loader2, MessageSquare, X, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTourPlanBatchId, inferPlanType, isPendingPlan, normalizePlanStatus } from '../../utils/planStatus';

const LIST_PATH = '/director/tour-plans';
const displayDate = (value) => value ? value.split('-').reverse().join('-') : 'Not provided';

export const WeeklyPlanReview = () => {
  const { batchId: selectedPlanBatchId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { visitPlans, users, refreshEntity, requestTourPlanChanges, reviewTourPlanBatch, showToast } = useApp();
  const [reviewAction, setReviewAction] = useState('Review');
  const [reasonNote, setReasonNote] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupedPlans = useMemo(() => {
    const grouped = new Map();
    visitPlans.forEach((plan) => {
      const canonicalBatchId = getTourPlanBatchId(plan);
      if (!canonicalBatchId) return;
      if (!grouped.has(canonicalBatchId)) {
        grouped.set(canonicalBatchId, {
          ...plan,
          batchId: canonicalBatchId,
          entries: [],
          planType: inferPlanType(plan),
          status: normalizePlanStatus(plan.status)
        });
      }
      grouped.get(canonicalBatchId).entries.push(plan);
    });
    return [...grouped.values()].sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)));
  }, [visitPlans]);

  const pendingBatches = useMemo(() => groupedPlans.filter(isPendingPlan), [groupedPlans]);
  const selectedPlan = useMemo(
    () => groupedPlans.find((plan) => getTourPlanBatchId(plan) === selectedPlanBatchId) || null,
    [groupedPlans, selectedPlanBatchId]
  );

  useEffect(() => {
    setReviewAction('Review');
    setReasonNote('');
    setSubmitError('');
  }, [selectedPlanBatchId]);

  useEffect(() => {
    if (!selectedPlanBatchId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedPlanBatchId]);

  useEffect(() => {
    if (selectedPlanBatchId && !selectedPlan && import.meta.env.DEV) {
      console.warn('Tour plan batch was not found in current data:', selectedPlanBatchId);
    }
  }, [selectedPlan, selectedPlanBatchId]);

  const employeeName = (batch) => batch?.fullName || users.find((user) => user.employeeId === batch?.employeeId)?.fullName || users.find((user) => user.employeeId === batch?.employeeId)?.username || batch?.employeeId || 'Unknown employee';
  const listLocation = { pathname: LIST_PATH, search: location.search };
  const handleBack = () => {
    if (isSubmitting) return;
    setReviewAction('Review');
    setReasonNote('');
    setSubmitError('');
    navigate(listLocation);
  };
  const openPlan = (batch) => {
    const canonicalBatchId = getTourPlanBatchId(batch);
    setSubmitError('');
    if (!canonicalBatchId) return;
    navigate({ pathname: `${LIST_PATH}/${canonicalBatchId}`, search: location.search });
  };
  const selectAction = (action) => {
    setReviewAction(action);
    setReasonNote('');
    setSubmitError('');
  };

  const validateReview = () => {
    const trimmedComment = reasonNote.trim();
    if (!selectedPlanBatchId) return 'Tour plan reference is missing. Return to the plan list and reopen it.';
    if (!selectedPlan) return 'This tour plan is no longer available.';
    if (!selectedPlan.employeeId) return 'The Marketing employee reference is missing for this tour plan.';
    if (normalizePlanStatus(selectedPlan.status) !== 'Pending Approval') return 'This tour plan has already been reviewed.';
    if (reviewAction === 'Reject' && !trimmedComment) return 'Please enter a reason for rejecting this plan.';
    if (reviewAction === 'Request Changes' && !trimmedComment) return 'Please enter the required changes.';
    return '';
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setSubmitError('');
    const validationError = validateReview();
    if (validationError) { setSubmitError(validationError); return; }

    const trimmedComment = reasonNote.trim();
    if (import.meta.env.DEV) console.log('Tour plan review:', { selectedPlanBatchId, action: reviewAction, employeeId: selectedPlan.employeeId });
    setIsSubmitting(true);
    try {
      const result = reviewAction === 'Request Changes'
        ? await requestTourPlanChanges(selectedPlanBatchId, trimmedComment)
        : await reviewTourPlanBatch(selectedPlanBatchId, reviewAction === 'Approve' ? 'Approved' : 'Rejected', trimmedComment);
      if (!result?.success || result.updatedEntries !== selectedPlan.entries.length) {
        throw new Error('The complete tour plan could not be updated. Please refresh and try again.');
      }
      showToast(reviewAction === 'Approve' ? 'Tour plan approved successfully.' : reviewAction === 'Reject' ? 'Tour plan rejected successfully.' : 'Changes requested successfully.', 'success');
      navigate(listLocation, { replace: true });
    } catch (error) {
      setSubmitError(error?.message || 'Unable to update this tour plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadingLabel = reviewAction === 'Approve' ? 'Approving…' : reviewAction === 'Reject' ? 'Rejecting…' : 'Requesting Changes…';

  const reviewPanel = selectedPlanBatchId ? createPortal(
    <div className="modal-overlay tour-plan-review-overlay" role="presentation">
      <section className="tour-plan-review-modal" role="dialog" aria-modal="true" aria-labelledby="tour-plan-review-title">
        <header className="modal-header">
          <div>
            <h3 id="tour-plan-review-title">{selectedPlan ? `${employeeName(selectedPlan)} — ${selectedPlan.planType} Plan` : 'Tour Plan Review'}</h3>
            {selectedPlan && <p>{displayDate(selectedPlan.periodFrom)} to {displayDate(selectedPlan.periodTo)}</p>}
          </div>
          <button type="button" className="tour-plan-review-close" disabled={isSubmitting} onClick={handleBack} aria-label="Close review"><X size={20} /></button>
        </header>

        <div className="modal-body">
          {!selectedPlan ? (
            <div className="tour-plan-not-found" role="alert">
              <h3>This tour plan is no longer available.</h3>
              <p>It may have been removed or is not available in your current session.</p>
              <button type="button" className="btn btn-secondary" onClick={() => refreshEntity('visit_plans')}>Retry</button>
            </div>
          ) : (
            <>
              <dl className="tour-plan-review-summary">
                <div><dt>Employee</dt><dd>{employeeName(selectedPlan)}</dd></div>
                <div><dt>Employee ID</dt><dd>{selectedPlan.employeeId || 'Not provided'}</dd></div>
                <div><dt>Plan Type</dt><dd>{selectedPlan.planType}</dd></div>
                <div><dt>Date Range</dt><dd>{displayDate(selectedPlan.periodFrom)} to {displayDate(selectedPlan.periodTo)}</dd></div>
                <div><dt>Entries</dt><dd>{selectedPlan.entries.length}</dd></div>
                <div><dt>Status</dt><dd><span className="badge badge-pending">{normalizePlanStatus(selectedPlan.status)}</span></dd></div>
              </dl>

              <table className="tour-plan-review-table">
                <colgroup><col className="date-column" /><col className="area-column" /><col /><col className="priority-column" /></colgroup>
                <thead><tr><th>Date</th><th>Area</th><th>Projects / Requirement</th><th>Priority</th></tr></thead>
                <tbody>{selectedPlan.entries.map((entry) => <tr key={entry.id}><td>{displayDate(entry.visitDate)}</td><td>{entry.area || entry.city || entry.district || 'Not provided'}</td><td>{entry.products?.length ? entry.products.join(', ') : entry.requirement || 'Not provided'}</td><td>{entry.priority || 'Medium'}</td></tr>)}</tbody>
              </table>

              <div className="tour-plan-entry-cards">{selectedPlan.entries.map((entry) => <article key={entry.id} className="tour-plan-entry-card"><div><small>Date</small><strong>{displayDate(entry.visitDate)}</strong></div><div><small>Area</small><strong>{entry.area || entry.city || entry.district || 'Not provided'}</strong></div><div><small>Projects / Requirement</small><strong>{entry.products?.length ? entry.products.join(', ') : entry.requirement || 'Not provided'}</strong></div><div><small>Priority</small><strong>{entry.priority || 'Medium'}</strong></div></article>)}</div>

              {reviewAction !== 'Review' && <div className="form-group tour-plan-review-comment"><label className="form-label" htmlFor="tour-plan-review-comment">Director Comment / Note {(reviewAction === 'Reject' || reviewAction === 'Request Changes') && '*'}</label><textarea id="tour-plan-review-comment" className="form-textarea" rows={3} value={reasonNote} disabled={isSubmitting} onChange={(event) => { setReasonNote(event.target.value); setSubmitError(''); }} aria-describedby={submitError ? 'tour-plan-review-error' : undefined} />{submitError && <div id="tour-plan-review-error" className="form-error" role="alert">{submitError}</div>}</div>}
              {reviewAction === 'Review' && submitError && <div id="tour-plan-review-error" className="form-error" role="alert">{submitError}</div>}
            </>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" disabled={isSubmitting} onClick={handleBack}>Back</button>
          {selectedPlan && normalizePlanStatus(selectedPlan.status) === 'Pending Approval' && <div className="tour-plan-review-actions">{reviewAction === 'Review' ? <><button type="button" className="btn btn-danger" onClick={() => selectAction('Reject')}><XCircle size={16} /> Reject</button><button type="button" className="btn btn-warning" onClick={() => selectAction('Request Changes')}><MessageSquare size={16} /> Request Changes</button><button type="button" className="btn btn-success" onClick={() => selectAction('Approve')}><CheckCircle2 size={16} /> Approve</button></> : <><button type="button" className="btn btn-secondary" disabled={isSubmitting} onClick={() => selectAction('Review')}>Change Action</button><button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={handleConfirm}>{isSubmitting && <Loader2 className="ds-spin" size={16} />}{isSubmitting ? loadingLabel : `Confirm ${reviewAction}`}</button></>}</div>}
          {selectedPlan && normalizePlanStatus(selectedPlan.status) !== 'Pending Approval' && <div className="form-error" role="status">This tour plan has already been reviewed.</div>}
        </footer>
      </section>
    </div>,
    document.body
  ) : null;

  return <div>
    <div className="toolbar-bar"><div><h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Marketing Team Tour Plans</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Review weekly and monthly field marketing schedules</p></div></div>
    <div className="director-kpi-grid"><div><small>Weekly Plans Awaiting Review</small><strong>{pendingBatches.filter((batch) => batch.planType === 'Weekly').length}</strong></div><div><small>Monthly Plans Awaiting Review</small><strong>{pendingBatches.filter((batch) => batch.planType === 'Monthly').length}</strong></div><div><small>Total Plans Awaiting Review</small><strong>{pendingBatches.length}</strong></div></div>
    <div className="card"><div className="card-header-clean"><h3 className="card-title-clean"><FileSpreadsheet size={18} color="var(--accent-cyan)" /> Tour Plans Review</h3></div><div className="table-responsive"><table className="custom-table"><thead><tr><th>Employee</th><th>Plan Type</th><th>Period</th><th>Total Entries</th><th>Submitted At</th><th>Status</th><th style={{ textAlign: 'right' }}>Review</th></tr></thead><tbody>
      {pendingBatches.length === 0 && <tr><td colSpan="7"><div className="ds-empty"><h3>No tour plans are awaiting review.</h3><p>Submitted Marketing plans will appear here automatically.</p></div></td></tr>}
      {pendingBatches.map((batch) => <tr key={batch.batchId}><td><strong>{employeeName(batch)}</strong><small>{batch.employeeId}</small></td><td>{batch.planType}</td><td>{displayDate(batch.periodFrom)} to {displayDate(batch.periodTo)}</td><td>{batch.entries.length}</td><td>{batch.submittedAt ? new Date(batch.submittedAt).toLocaleString() : 'Not provided'}</td><td><span className="badge badge-pending">{normalizePlanStatus(batch.status)}</span></td><td style={{ textAlign: 'right' }}><button type="button" className="btn btn-primary btn-sm" onClick={() => openPlan(batch)}>Review</button></td></tr>)}
    </tbody></table></div></div>
    {reviewPanel}
  </div>;
};

export default WeeklyPlanReview;
