import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PlusCircle, Calendar, Building2, Save } from 'lucide-react';

export const AddVisitPlan = ({ setActiveTab }) => {
  const { customers, products, purposes, addVisitPlan } = useApp();

  const [formData, setFormData] = useState({
    visitDate: '2026-07-22',
    expectedTime: '10:30 AM',
    customerId: customers[0]?.id || '',
    customerName: customers[0]?.organizationName || '',
    organizationType: customers[0]?.organizationType || 'Municipal Corporation',
    contactPerson: customers[0]?.contactPerson || '',
    mobile: customers[0]?.mobile || '',
    state: 'Tamil Nadu',
    district: customers[0]?.district || 'Coimbatore',
    city: customers[0]?.city || 'Coimbatore',
    area: 'Town Hall',
    visitPurpose: 'Product Demo',
    selectedProducts: ['Whale Super Sucker'],
    requirement: '',
    priority: 'High',
    isTenderRelated: false,
    notes: ''
  });

  const handleCustomerSelect = (custObj) => {
    setFormData({
      ...formData,
      customerId: custObj.id,
      customerName: custObj.organizationName,
      organizationType: custObj.organizationType,
      contactPerson: custObj.contactPerson,
      mobile: custObj.mobile,
      district: custObj.district,
      city: custObj.city
    });
  };

  const handleProductToggle = (prodName) => {
    const current = formData.selectedProducts;
    if (current.includes(prodName)) {
      setFormData({ ...formData, selectedProducts: current.filter(p => p !== prodName) });
    } else {
      setFormData({ ...formData, selectedProducts: [...current, prodName] });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addVisitPlan({
      ...formData,
      products: formData.selectedProducts
    });
    if (setActiveTab) setActiveTab('my-plans');
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><PlusCircle size={18} color="var(--accent-cyan)" /> Create Single Visit Plan</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid-12" style={{ marginBottom: '24px' }}>
            <div className="col-6">
              <div className="form-group">
                <label className="form-label">Visit Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.visitDate}
                  onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                />
              </div>
            </div>

            <div className="col-6">
              <div className="form-group">
                <label className="form-label">Expected Time *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. 10:30 AM"
                  value={formData.expectedTime}
                  onChange={(e) => setFormData({ ...formData, expectedTime: e.target.value })}
                />
              </div>
            </div>

            <div className="col-12">
              <div className="form-group">
                <label className="form-label">Select Customer / Organization *</label>
                <select
                  className="form-select"
                  value={formData.customerId}
                  onChange={(e) => {
                    const custObj = customers.find(c => c.id === e.target.value);
                    if (custObj) handleCustomerSelect(custObj);
                  }}
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.organizationName} ({c.district})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="col-6">
              <div className="form-group">
                <label className="form-label">Visit Purpose *</label>
                <select
                  className="form-select"
                  value={formData.visitPurpose}
                  onChange={(e) => setFormData({ ...formData, visitPurpose: e.target.value })}
                >
                  {purposes.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="col-6">
              <div className="form-group">
                <label className="form-label">Priority Level *</label>
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Products (Select Multiple) *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '4px' }}>
              {products.map(p => (
                <label key={p.id} className="checkbox-label" style={{ fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.selectedProducts.includes(p.name)}
                    onChange={() => handleProductToggle(p.name)}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Requirement / Objective Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Detail specific requirement or project background..."
              value={formData.requirement}
              onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Submit Visit Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
