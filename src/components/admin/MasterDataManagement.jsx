import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Target, Layers, Plus, Trash2 } from 'lucide-react';

export const MasterDataManagement = () => {
  const { orgTypes, purposes } = useApp();
  const [activeTab, setActiveTab] = useState('purposes');
  const [newPurpose, setNewPurpose] = useState('');
  const [newOrgType, setNewOrgType] = useState('');

  return (
    <div>
      <div className="toolbar-bar" style={{ justifyContent: 'flex-start', gap: '12px' }}>
        <button
          className={`btn ${activeTab === 'purposes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('purposes')}
        >
          <Target size={16} /> Visit Purposes ({purposes.length})
        </button>

        <button
          className={`btn ${activeTab === 'orgTypes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('orgTypes')}
        >
          <Layers size={16} /> Organization Types ({orgTypes.length})
        </button>
      </div>

      {activeTab === 'purposes' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Target size={18} color="var(--accent-cyan)" /> Visit Purposes Master List</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {purposes.map((p, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'orgTypes' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Layers size={18} color="var(--accent-amber)" /> Organization Types Master List</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {orgTypes.map((o, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDataManagement;
