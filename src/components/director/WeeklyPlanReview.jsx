import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FileSpreadsheet, Phone, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTourPlanBatchId, inferPlanType, normalizePlanStatus } from '../../utils/planStatus';

const LIST_PATH = '/director/tour-plans';
const displayDate = (value) => value ? value.split('-').reverse().join('-') : 'Not provided';
const displayValue = (value) => value || 'Not provided';
const destinationName = (entry) => entry.customerName || entry.organizationName || 'Customer not selected';

export const WeeklyPlanReview = () => {
  const { batchId: selectedPlanBatchId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { visitPlans, users, refreshEntity } = useApp();

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

  const selectedPlan = useMemo(
    () => groupedPlans.find((plan) => getTourPlanBatchId(plan) === selectedPlanBatchId) || null,
    [groupedPlans, selectedPlanBatchId]
  );

  useEffect(() => {
    if (!selectedPlanBatchId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedPlanBatchId]);

  const employeeName = (batch) => batch?.employeeName || batch?.fullName
    || users.find((user) => user.employeeId === batch?.employeeId)?.fullName
    || users.find((user) => user.employeeId === batch?.employeeId)?.username
    || batch?.employeeId
    || 'Unknown employee';
  const employeeMobile = (batch) => users.find((user) => user.employeeId === batch?.employeeId)?.mobileNumber || users.find((user) => user.employeeId === batch?.employeeId)?.mobile;
  const listLocation = { pathname: LIST_PATH, search: location.search };
  const handleBack = () => navigate(listLocation);
  const openPlan = (batch) => {
    const canonicalBatchId = getTourPlanBatchId(batch);
    if (canonicalBatchId) navigate({ pathname: `${LIST_PATH}/${canonicalBatchId}`, search: location.search });
  };

  const detailsPanel = selectedPlanBatchId ? createPortal(
    <div className="modal-overlay tour-plan-review-overlay" role="presentation">
      <section className="tour-plan-review-modal" role="dialog" aria-modal="true" aria-labelledby="tour-plan-details-title">
        <header className="modal-header">
          <div>
            <h3 id="tour-plan-details-title">{selectedPlan ? `${employeeName(selectedPlan)} — ${selectedPlan.planType} Plan` : 'Tour Plan Details'}</h3>
            {selectedPlan && <p>{displayDate(selectedPlan.periodFrom)} to {displayDate(selectedPlan.periodTo)}</p>}
          </div>
          <button type="button" className="tour-plan-review-close" onClick={handleBack} aria-label="Close details"><X size={20} /></button>
        </header>

        <div className="modal-body">
          {!selectedPlan ? (
            <div className="tour-plan-not-found" role="alert">
              <h3>This tour plan is not available.</h3>
              <p>It may not be available in the current session. Refresh the data or return to the list.</p>
              <button type="button" className="btn btn-secondary" onClick={() => refreshEntity('visit_plans')}>Refresh</button>
            </div>
          ) : <>
            <dl className="tour-plan-review-summary">
              <div><dt>Employee Name</dt><dd>{employeeName(selectedPlan)}</dd></div>
              <div><dt>Employee ID</dt><dd>{displayValue(selectedPlan.employeeId)}</dd></div>
              <div><dt>Plan Type</dt><dd>{selectedPlan.planType}</dd></div>
              <div><dt>Date Range</dt><dd>{displayDate(selectedPlan.periodFrom)} to {displayDate(selectedPlan.periodTo)}</dd></div>
              <div><dt>Total Visits</dt><dd>{selectedPlan.entries.length}</dd></div>
              <div><dt>Status</dt><dd><span className="badge badge-pending">{normalizePlanStatus(selectedPlan.status)}</span></dd></div>
            </dl>

            <table className="tour-plan-review-table">
              <thead><tr><th>Visit</th><th>Area / Customer</th><th>Purpose / Products</th><th>Requirement / Priority</th><th>Notes / Status</th></tr></thead>
              <tbody>{selectedPlan.entries.map((entry) => <tr key={entry.id}>
                <td>{displayDate(entry.visitDate)}<br /><small>{displayValue(entry.expectedTime)}</small></td>
                <td>{entry.area || entry.city || entry.district || 'Not provided'}<br /><small>{destinationName(entry)}</small></td>
                <td>{displayValue(entry.visitPurpose)}<br /><small>{entry.products?.length ? entry.products.join(', ') : 'Not provided'}</small></td>
                <td>{displayValue(entry.requirement)}<br /><small>{entry.priority || 'Medium'}</small></td>
                <td>{displayValue(entry.notes)}<br /><small>{normalizePlanStatus(entry.status)}</small></td>
              </tr>)}</tbody>
            </table>

            <div className="tour-plan-entry-cards">{selectedPlan.entries.map((entry) => <article key={entry.id} className="tour-plan-entry-card">
              <div><small>Employee Name</small><strong>{employeeName(selectedPlan)}</strong></div>
              <div><small>Employee ID</small><strong>{displayValue(entry.employeeId)}</strong></div>
              <div><small>Visit Date</small><strong>{displayDate(entry.visitDate)}</strong></div>
              <div><small>Expected Time</small><strong>{displayValue(entry.expectedTime)}</strong></div>
              <div><small>Area / City</small><strong>{entry.area || entry.city || entry.district || 'Not provided'}</strong></div>
              <div><small>Customer / Organization</small><strong>{destinationName(entry)}</strong></div>
              <div><small>Visit Purpose</small><strong>{displayValue(entry.visitPurpose)}</strong></div>
              <div><small>Products</small><strong>{entry.products?.length ? entry.products.join(', ') : 'Not provided'}</strong></div>
              <div><small>Requirement</small><strong>{displayValue(entry.requirement)}</strong></div>
              <div><small>Priority</small><strong>{entry.priority || 'Medium'}</strong></div>
              <div><small>Notes</small><strong>{displayValue(entry.notes)}</strong></div>
              <div><small>Status</small><strong>{normalizePlanStatus(entry.status)}</strong></div>
              <div><small>Submitted Date and Time</small><strong>{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString() : 'Not provided'}</strong></div>
            </article>)}</div>
          </>}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleBack}>Back</button>
          {selectedPlan && employeeMobile(selectedPlan) && <button type="button" className="btn btn-primary" onClick={() => { window.location.href = `tel:${employeeMobile(selectedPlan)}`; }}><Phone size={16} /> Call Employee</button>}
        </footer>
      </section>
    </div>,
    document.body
  ) : null;

  return <div>
    <div className="toolbar-bar"><div><h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Marketing Team Tour Plans</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>View submitted weekly and monthly field Marketing schedules</p></div></div>
    <div className="director-kpi-grid"><div><small>Weekly Plans</small><strong>{groupedPlans.filter((batch) => batch.planType === 'Weekly').length}</strong></div><div><small>Monthly Plans</small><strong>{groupedPlans.filter((batch) => batch.planType === 'Monthly').length}</strong></div><div><small>Total Submitted Plans</small><strong>{groupedPlans.length}</strong></div></div>
    <div className="card"><div className="card-header-clean"><h3 className="card-title-clean"><FileSpreadsheet size={18} color="var(--accent-cyan)" /> Tour Plans</h3></div><div className="table-responsive"><table className="custom-table"><thead><tr><th>Employee</th><th>Plan Type</th><th>Period</th><th>Total Visits</th><th>Submitted At</th><th>Status</th><th style={{ textAlign: 'right' }}>Details</th></tr></thead><tbody>
      {groupedPlans.length === 0 && <tr><td colSpan="7"><div className="ds-empty"><h3>No tour plans found.</h3><p>Submitted Marketing plans will appear here automatically.</p></div></td></tr>}
      {groupedPlans.map((batch) => <tr key={batch.batchId}><td><strong>{employeeName(batch)}</strong><small>{batch.employeeId}</small></td><td>{batch.planType}</td><td>{displayDate(batch.periodFrom)} to {displayDate(batch.periodTo)}</td><td>{batch.entries.length}</td><td>{batch.submittedAt ? new Date(batch.submittedAt).toLocaleString() : 'Not provided'}</td><td><span className="badge badge-pending">{normalizePlanStatus(batch.status)}</span></td><td style={{ textAlign: 'right' }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => openPlan(batch)}>View Details</button></td></tr>)}
    </tbody></table></div></div>
    {detailsPanel}
  </div>;
};

export default WeeklyPlanReview;
