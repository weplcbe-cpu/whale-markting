import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { ModalPortal } from '../ui';

export const ProductManagement = () => {
  const { products, addProduct, toggleProductStatus } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', category: 'Vacuum Machinery' });

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    addProduct(formData);
    setFormData({ name: '', code: '', category: 'Vacuum Machinery' });
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Whale Machinery Product Catalog</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Manage products available for field marketing visit plans</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {products.map(prod => (
          <div key={prod.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span className="badge badge-planned">{prod.code || 'KW-EQUIP'}</span>
                <span className={`badge ${prod.status === 'Active' ? 'badge-approved' : 'badge-rejected'}`}>
                  {prod.status}
                </span>
              </div>

              <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '4px' }}>{prod.name}</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{prod.category}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Display Order: #{prod.displayOrder}</span>
              <button
                className={`btn btn-sm ${prod.status === 'Active' ? 'btn-danger' : 'btn-success'}`}
                onClick={() => toggleProductStatus(prod.id)}
              >
                {prod.status === 'Active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {prod.status === 'Active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <ModalPortal onClose={() => setIsModalOpen(false)} closeOnBackdrop={false}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Add Product to Catalog</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Whale Super Sucker Ultra"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Product Code / Model</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. KW-SS09"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Vacuum Tanker">Vacuum Tanker</option>
                    <option value="Combined Unit">Combined Unit</option>
                    <option value="Heavy Duty Sucker">Heavy Duty Sucker</option>
                    <option value="Water Recycler">Water Recycler</option>
                    <option value="Jetting Unit">Jetting Unit</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ProductManagement;
