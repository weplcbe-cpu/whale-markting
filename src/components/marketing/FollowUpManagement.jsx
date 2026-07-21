import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, Plus, CheckCircle2, Phone, X } from 'lucide-react';

export const FollowUpManagement = () => {
  const { currentUser, customers, followUps, addFollowUp } = useApp();
  const [filterView, setFilterView] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const empId = currentUser?.employeeId || 'EMP001';
  const myFollowups = followUps.filter(f => f.employeeId === empId);

  const [formData, setFormData] = useState({
    customerId: customers[0]?.id || '',
    customerName: customers[0]?.organizationName || '',
    followUpDate: '2026-07-24',
    type: 'Phone Call',
    purpose: '',
    priority: 'High',
    notes: ''
  });

  const handleSave = (e) => {
    e.preventDefault();
    addFollowUp(formData);
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <button
            className={`btn btn-sm ${filterView === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterView('All')}
          >
            All Follow-ups ({myFollowups.length})
          </button>
          <button
            className={`btn btn-sm ${filterView === 'Pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterView('Pending')}
          >
            Pending
          </button>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Add Follow-up
        </button>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Clock size={18} color="var(--accent-cyan)" /> My Scheduled Follow-ups</h3>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Type</th>
                <th>Purpose / Objective</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myFollowups.map(f => (
                <tr key={f.id}>
                  <td><strong>{f.customerName}</strong></td>
                  <td>{f.followUpDate}</td>
                  <td><span className="badge badge-planned">{f.type}</span></td>
                  <td>{f.purpose}</td>
                  <td><span className={`badge badge-${f.priority.toLowerCase()}`}>{f.priority}</span></td>
                  <td><span className={`badge ${f.status === 'Completed' ? 'badge-completed' : 'badge-started'}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Schedule New Follow-up</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer *</label>
                  <select
                    className="form-select"
                    value={formData.customerId}
                    onChange={(e) => {
                      const c = customers.find(cust => cust.id === e.target.value);
                      if (c) setFormData({ ...formData, customerId: c.id, customerName: c.organizationName });
                    }}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.organizationName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-up Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-up Type</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="Physical Visit">Physical Visit</option>
                    <option value="Email">Email</option>
                    <option value="Quotation">Quotation</option>
                    <option value="Product Demo">Product Demo</option>
                    <option value="Tender">Tender</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Purpose / Notes *</label>
                  <textarea
                    className="form-textarea"
                    required
                    rows={2}
                    placeholder="Details of what needs to be followed up..."
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Follow-up</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpManagement;
