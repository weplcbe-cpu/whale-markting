import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserPlus, Building2, AlertTriangle, CheckCircle2, Search, Eye } from 'lucide-react';

export const CustomerManagement = ({ activeTab, setActiveTab }) => {
  const { customers, orgTypes, products, addCustomer } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const [formData, setFormData] = useState({
    organizationName: '',
    organizationType: 'Municipal Corporation',
    contactPerson: '',
    mobile: '',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    city: 'Coimbatore',
    address: '',
    pincode: '',
    interestedProducts: ['Whale Super Sucker'],
    isTenderRelated: false,
    notes: ''
  });

  const handleOrgNameChange = (val) => {
    setFormData({ ...formData, organizationName: val });
    
    // Duplicate Check Warning
    const exists = customers.find(c => c.organizationName.toLowerCase().trim() === val.toLowerCase().trim());
    if (exists) {
      setDuplicateWarning(`Warning: Customer "${exists.organizationName}" already exists in ${exists.district}!`);
    } else {
      setDuplicateWarning('');
    }
  };

  const handleProductToggle = (prodName) => {
    const current = formData.interestedProducts;
    if (current.includes(prodName)) {
      setFormData({ ...formData, interestedProducts: current.filter(p => p !== prodName) });
    } else {
      setFormData({ ...formData, interestedProducts: [...current, prodName] });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.organizationName.trim()) return;

    addCustomer(formData);
    setFormData({
      organizationName: '',
      organizationType: 'Municipal Corporation',
      contactPerson: '',
      mobile: '',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Coimbatore',
      address: '',
      pincode: '',
      interestedProducts: ['Whale Super Sucker'],
      isTenderRelated: false,
      notes: ''
    });
    setDuplicateWarning('');
    if (setActiveTab) setActiveTab('my-customers');
  };

  return (
    <div>
      {activeTab === 'add-customer' ? (
        <div className="card" style={{ maxWidth: '750px', margin: '0 auto' }}>
          <div className="card-header-clean">
            <h3 className="card-title-clean"><UserPlus size={18} color="var(--accent-cyan)" /> Create New Customer Record</h3>
          </div>

          {duplicateWarning && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              <span>{duplicateWarning}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section 1: Organization & Contact Details */}
            <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1.5px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--primary-dark)', fontSize: '0.95rem', fontWeight: 800, marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Organization & Contact Details
              </h4>
              <div className="form-grid-12">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label">Organization Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Coimbatore Municipal Corporation"
                      value={formData.organizationName}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Official company, municipality, or department name</span>
                  </div>
                </div>

                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label">Organization Type *</label>
                    <select
                      className="form-select"
                      value={formData.organizationType}
                      onChange={(e) => setFormData({ ...formData, organizationType: e.target.value })}
                    >
                      {orgTypes.map((ot, i) => (
                        <option key={i} value={ot}>{ot}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label">Contact Person Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mr. Sundaram (Executive Engineer)"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label">Mobile Number (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="10-digit mobile number"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Location Details */}
            <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1.5px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--primary-dark)', fontSize: '0.95rem', fontWeight: 800, marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Location & Address
              </h4>
              <div className="form-grid-12">
                <div className="col-4">
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-4">
                  <div className="form-group">
                    <label className="form-label">District *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-4">
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-12">
                  <div className="form-group">
                    <label className="form-label">Full Office Address</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Street, landmark, building number..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Product Interest */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--primary-dark)', fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Machinery Product Interest (Tap to Select)
              </h4>
              <div className="form-grid-12">
                {products.map(p => {
                  const isChecked = formData.interestedProducts.includes(p.name);
                  return (
                    <div
                      key={p.id}
                      className="col-4"
                      onClick={() => handleProductToggle(p.name)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isChecked ? 'var(--primary-blue)' : 'var(--border-color)'}`,
                        background: isChecked ? 'rgba(117, 139, 253, 0.1)' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.9rem',
                        fontWeight: isChecked ? 700 : 600,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <span style={{ color: isChecked ? 'var(--primary-dark)' : 'var(--text-main)' }}>{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end', borderTop: '1.5px solid var(--border-color)', paddingTop: '20px' }}>
              <button type="submit" className="btn btn-action btn-lg">
                + Submit New Customer Record
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Building2 size={18} color="var(--accent-cyan)" /> My Customer Directory</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('add-customer')}>
              <UserPlus size={14} /> + Add Customer
            </button>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Organization Name</th>
                  <th>Type</th>
                  <th>District / City</th>
                  <th>Contact Person</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.organizationName}</strong></td>
                    <td>{c.organizationType}</td>
                    <td>{c.city}, {c.district}</td>
                    <td>{c.contactPerson} ({c.mobile})</td>
                    <td>
                      <span className={`badge ${c.status === 'Approved' ? 'badge-approved' : 'badge-started'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
