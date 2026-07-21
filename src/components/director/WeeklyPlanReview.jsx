import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, CheckCircle2, XCircle, MessageSquare, AlertCircle, Eye, X } from 'lucide-react';

export const WeeklyPlanReview = () => {
  const { visitPlans, updateVisitPlanStatus, addDirectorComment } = useApp();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [actionType, setActionType] = useState(''); // 'Approve', 'Reject', 'Request Changes'
  const [reasonNote, setReasonNote] = useState('');

  const handleAction = (plan, type) => {
    setSelectedPlan(plan);
    setActionType(type);
    setReasonNote('');
  };

  const handleConfirmAction = (e) => {
    e.preventDefault();
    if ((actionType === 'Reject' || actionType === 'Request Changes') && !reasonNote.trim()) {
      alert('Reason is required when rejecting or requesting changes.');
      return;
    }

    const newStatus = actionType === 'Approve' ? 'Planned' : actionType === 'Reject' ? 'Cancelled' : 'Rescheduled';
    updateVisitPlanStatus(selectedPlan.id, newStatus);

    if (reasonNote.trim()) {
      addDirectorComment({
        targetEmployeeId: selectedPlan.employeeId,
        targetEmployeeName: selectedPlan.employeeName,
        targetModule: 'Weekly Plan',
        referenceId: selectedPlan.id,
        message: `[${actionType}] ${reasonNote}`
      });
    }

    setSelectedPlan(null);
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Marketing Team Weekly Tour Plans</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Review, Approve, Reject or Request Changes on field marketing schedules</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><FileSpreadsheet size={18} color="var(--accent-cyan)" /> Weekly Planning Grid</h3>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Area / City</th>
                <th>Customer / Organization</th>
                <th>Visit Purpose</th>
                <th>Product / Requirement</th>
                <th>Priority</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Director Review</th>
              </tr>
            </thead>
            <tbody>
              {visitPlans.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.employeeName}</strong></td>
                  <td>{p.visitDate}</td>
                  <td>{p.area || p.city}, {p.district}</td>
                  <td>{p.customerName}</td>
                  <td>{p.visitPurpose}</td>
                  <td>{Array.isArray(p.products) ? p.products.join(', ') : p.products}</td>
                  <td><span className={`badge badge-${p.priority.toLowerCase()}`}>{p.priority}</span></td>
                  <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleAction(p, 'Approve')}
                        title="Approve Plan"
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>

                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => handleAction(p, 'Request Changes')}
                        title="Request Changes"
                      >
                        <MessageSquare size={13} /> Changes
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleAction(p, 'Reject')}
                        title="Reject Plan"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Reason Modal */}
      {selectedPlan && (
        <div className="modal-overlay" onClick={() => setSelectedPlan(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{actionType} Plan - {selectedPlan.customerName}</h3>
              <button onClick={() => setSelectedPlan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmAction}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Target Employee: <strong>{selectedPlan.employeeName}</strong><br />
                  Scheduled Date: <strong>{selectedPlan.visitDate}</strong> ({selectedPlan.expectedTime})
                </p>

                <div className="form-group">
                  <label className="form-label">
                    Director Comment / Note {(actionType === 'Reject' || actionType === 'Request Changes') && '*'}
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide direction or reason for this plan update..."
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlan(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm {actionType}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanReview;
