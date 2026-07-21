import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, Plus, X } from 'lucide-react';

export const TenderManagement = () => {
  const { currentUser, tenders, addTender } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const empId = currentUser?.employeeId || 'EMP001';
  const myTenders = tenders.filter(t => !t.assignedEmployeeId || t.assignedEmployeeId === empId);

  const [formData, setFormData] = useState({
    tenderName: '',
    tenderNumber: '',
    department: '',
    closingDate: '2026-08-20',
    tenderValue: '₹ 1,50,00,000',
    requiredProducts: ['Whale Super Sucker'],
    notes: ''
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.tenderName.trim()) return;
    addTender(formData);
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Tender Opportunities Monitoring</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Log new tender enquiries & track progression</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Add Tender Enquiry
        </button>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><FileText size={18} color="var(--accent-cyan)" /> Tender Records</h3>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Tender Name / Ref</th>
                <th>Department</th>
                <th>Closing Date</th>
                <th>Tender Value</th>
                <th>Products Required</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myTenders.map(t => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.tenderName}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.tenderNumber}</div>
                  </td>
                  <td>{t.department}</td>
                  <td>{t.closingDate}</td>
                  <td><strong style={{ color: 'var(--accent-emerald)' }}>{t.tenderValue}</strong></td>
                  <td>{Array.isArray(t.requiredProducts) ? t.requiredProducts.join(', ') : t.requiredProducts}</td>
                  <td><span className="badge badge-planned">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Log New Tender Opportunity</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tender Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Procurement of 4 Recycler Machines"
                    value={formData.tenderName}
                    onChange={(e) => setFormData({ ...formData, tenderName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tender Number / Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MDU/SMART/2026/089"
                    value={formData.tenderNumber}
                    onChange={(e) => setFormData({ ...formData, tenderNumber: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department / Issuing Authority</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Madurai Corporation"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tender Closing Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={formData.closingDate}
                    onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Tender</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderManagement;
