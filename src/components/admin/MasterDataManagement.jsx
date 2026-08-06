import React from 'react';
import { Layers, Target } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MasterDataManagement = () => {
  const { orgTypes = [], purposes = [] } = useApp();

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h2>Master Data</h2>
          <p>Reference values used in visit planning and reporting.</p>
        </div>
      </div>
      <div className="master-data-grid">
        <section className="card master-list-card">
          <h3><Target size={18} /> Visit Purposes</h3>
          <div>{purposes.map((purpose) => <span key={purpose}>{purpose}</span>)}</div>
        </section>
        <section className="card master-list-card">
          <h3><Layers size={18} /> Organization Types</h3>
          <div>{orgTypes.map((type) => <span key={type}>{type}</span>)}</div>
        </section>
      </div>
    </div>
  );
};

export default MasterDataManagement;
