import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, CheckCircle2, XCircle, AlertTriangle, Eye, Search, Filter } from 'lucide-react';

export const CustomerApprovals = () => {
  const { customers, approveCustomer, rejectCustomer } = useApp();
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCust, setSelectedCust] = useState(null);

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <div className="input-with-icon" style={{ minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search Organization, District, Person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="All">All Customer Statuses</option>
            <option value="Pending Verification">Pending Verification</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Building2 size={18} color="var(--accent-cyan)" /> Customer Master Database & Verification</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{filteredCustomers.length} Records</span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Contact Person</th>
                <th>Created By</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.organizationName}</strong>
                    {c.isTenderRelated && (
                      <span className="badge badge-medium" style={{ marginLeft: '6px', fontSize: '0.68rem' }}>Tender</span>
                    )}
                  </td>
                  <td>{c.organizationType}</td>
                  <td>{c.city}, {c.district}</td>
                  <td>
                    <div>{c.contactPerson}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.mobile}</div>
                  </td>
                  <td>{c.createdByName}</td>
                  <td>
                    <span className={`badge ${
                      c.status === 'Approved' ? 'badge-approved' :
                      c.status === 'Pending Verification' ? 'badge-started' :
                      'badge-rejected'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCust(c)} title="View Details">
                        <Eye size={14} />
                      </button>

                      {c.status === 'Pending Verification' && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => approveCustomer(c.id)}
                            title="Approve Customer"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => rejectCustomer(c.id)}
                            title="Reject Customer"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCust && (
        <div className="modal-overlay" onClick={() => setSelectedCust(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customer Profile - {selectedCust.organizationName}</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><strong>Organization Type:</strong> {selectedCust.organizationType}</div>
              <div><strong>Contact Person:</strong> {selectedCust.contactPerson} ({selectedCust.mobile})</div>
              <div><strong>Address:</strong> {selectedCust.address}, {selectedCust.city}, {selectedCust.district}, {selectedCust.state} - {selectedCust.pincode}</div>
              <div><strong>Interested Products:</strong> {Array.isArray(selectedCust.interestedProducts) ? selectedCust.interestedProducts.join(', ') : selectedCust.interestedProducts}</div>
              <div><strong>Created By:</strong> {selectedCust.createdByName} on {selectedCust.createdDate}</div>
              <div><strong>Notes:</strong> {selectedCust.notes}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCust(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerApprovals;
