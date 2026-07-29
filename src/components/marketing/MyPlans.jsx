import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Calendar, List, Eye, Target, X, Building2 } from 'lucide-react';
import { ModalPortal } from '../ui';

export const MyPlans = () => {
  const { currentUser, visitPlans } = useApp();
  const [filterView, setFilterView] = useState('All');
  const [viewMode, setViewMode] = useState('calendar'); // Cards or Table
  const [selectedPlanModal, setSelectedPlanModal] = useState(null);
  const [searchParams] = useSearchParams();

  const empId = currentUser?.employeeId || 'EMP001';
  let myPlans = visitPlans.filter(p => p.employeeId === empId);

  useEffect(() => {
    const planId = searchParams.get('planId');
    if (planId) setSelectedPlanModal(visitPlans.find((plan) => plan.id === planId && plan.employeeId === empId) || null);
  }, [empId, searchParams, visitPlans]);

  if (filterView === 'Today') {
    myPlans = myPlans.filter(p => p.visitDate === '2026-07-21' || p.visitDate === new Date().toISOString().split('T')[0]);
  }

  return (
    <div>
      {/* Filter & View Mode Toolbar */}
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <button
            className={`btn btn-sm ${filterView === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterView('All')}
          >
            All Plans ({visitPlans.filter(p => p.employeeId === empId).length})
          </button>
          <button
            className={`btn btn-sm ${filterView === 'Today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterView('Today')}
          >
            Today's Visits
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar size={14} /> Cards View
          </button>

          <button
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} /> Table Grid
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Calendar size={20} color="var(--primary-blue)" /> My Scheduled Field Visit Plans</h3>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{myPlans.length} Total Plans</span>
        </div>

        {viewMode === 'calendar' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {myPlans.map(p => (
              <div key={p.id} className="animated-plan-card">
                <div className="plan-card-header">
                  <span className="plan-date-chip">📅 {p.visitDate} &nbsp;•&nbsp; 🕒 {p.expectedTime || '10:00 AM'}</span>
                  <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                </div>

                <h4 className="plan-customer-title">{p.customerName || 'Coimbatore Municipal Corp'}</h4>

                <div className="plan-purpose-tag">
                  <Target size={14} color="var(--primary-blue)" /> Purpose: <strong>{p.visitPurpose}</strong>
                </div>

                <div className="plan-products-row">
                  {Array.isArray(p.products) ? (
                    p.products.map((prod, idx) => (
                      <span key={idx} className="plan-product-chip">{prod}</span>
                    ))
                  ) : (
                    <span className="plan-product-chip">{p.products}</span>
                  )}
                </div>

                <div className="plan-card-footer">
                  <span className={`badge badge-${p.priority ? p.priority.toLowerCase() : 'high'}`}>
                    {p.priority || 'High'} Priority
                  </span>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedPlanModal(p)}
                  >
                    <Eye size={14} /> Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Visit Date</th>
                  <th>Expected Time</th>
                  <th>Customer / Organization</th>
                  <th>Visit Purpose</th>
                  <th>Products Interested</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {myPlans.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.visitDate}</strong></td>
                    <td>{p.expectedTime}</td>
                    <td><strong>{p.customerName}</strong></td>
                    <td>{p.visitPurpose}</td>
                    <td>{Array.isArray(p.products) ? p.products.join(', ') : p.products}</td>
                    <td><span className={`badge badge-${p.priority ? p.priority.toLowerCase() : 'high'}`}>{p.priority || 'High'}</span></td>
                    <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedPlanModal(p)}
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Details Modal */}
      {selectedPlanModal && (
        <ModalPortal onClose={() => setSelectedPlanModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="var(--primary-blue)" /> Field Visit Details
              </h3>
              <button
                onClick={() => setSelectedPlanModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(117, 139, 253, 0.08)', padding: '14px 18px', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled Date & Time</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                    📅 {selectedPlanModal.visitDate} at {selectedPlanModal.expectedTime || '10:00 AM'}
                  </div>
                </div>
                <span className={`badge badge-${selectedPlanModal.status.toLowerCase()}`}>{selectedPlanModal.status}</span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>AREA / CITY</label>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '2px' }}>
                  {selectedPlanModal.area || selectedPlanModal.city || 'Not provided'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>ORGANIZATION / PERSON</label>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '2px' }}>
                  {selectedPlanModal.customerName || selectedPlanModal.organizationName || selectedPlanModal.contactPerson || 'Not provided'}
                </div>
              </div>

              <div className="form-grid-12" style={{ gap: '14px' }}>
                <div className="col-6">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>VISIT PURPOSE</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '2px' }}>
                    {selectedPlanModal.visitPurpose}
                  </div>
                </div>

                <div className="col-6">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRIORITY LEVEL</label>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`badge badge-${selectedPlanModal.priority ? selectedPlanModal.priority.toLowerCase() : 'high'}`}>
                      {selectedPlanModal.priority || 'High'} Priority
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  INTERESTED KAISER WHALE PRODUCTS
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Array.isArray(selectedPlanModal.products) ? (
                    selectedPlanModal.products.map((prod, i) => (
                      <span key={i} className="plan-product-chip" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                        {prod}
                      </span>
                    ))
                  ) : (
                    <span className="plan-product-chip" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                      {selectedPlanModal.products}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>REQUIREMENT</label>
                <div style={{ fontSize: '0.95rem', color: 'var(--primary-dark)', marginTop: '2px' }}>
                  {selectedPlanModal.requirement || 'Not provided'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>NOTES</label>
                <div style={{ fontSize: '0.95rem', color: 'var(--primary-dark)', marginTop: '2px' }}>
                  {selectedPlanModal.notes || 'Not provided'}
                </div>
              </div>

              {selectedPlanModal.outcomeNotes && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '14px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669' }}>Completed Outcome Notes:</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--primary-dark)', marginTop: '4px', fontWeight: 600 }}>
                    "{selectedPlanModal.outcomeNotes}"
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedPlanModal(null)}>
                Close
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
