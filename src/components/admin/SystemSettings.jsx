import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Save, ShieldCheck } from 'lucide-react';

export const SystemSettings = () => {
  const { companyInfo, showToast, logActivity } = useApp();
  const [timeLimit, setTimeLimit] = useState(companyInfo?.reportEditTimeLimitHours ?? 24);
  const [companyName, setCompanyName] = useState(companyInfo?.name ?? '');

  const handleSave = (e) => {
    e.preventDefault();
    logActivity(`Updated system settings (Edit Limit: ${timeLimit} Hours)`, 'Settings');
    showToast('System Settings updated successfully', 'success');
  };

  return (
    <div style={{ maxWidth: '750px' }}>
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Settings size={18} color="var(--accent-cyan)" /> System Configuration & Rules</h3>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              type="text"
              className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Marketing Report Edit Time Limit (Hours)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="number"
                className="form-input"
                style={{ width: '120px' }}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                After report submission, marketing staff can edit for up to <strong>{timeLimit} hours</strong>. After that, report is automatically locked.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="var(--accent-emerald)" /> Security & Access Rules
            </h4>
            <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <li>Role Auto-Identification enabled on Login Page (Username/EmpID).</li>
              <li>GPS location tracking: <strong>Disabled</strong> per privacy protocol.</li>
              <li>Marketing team access limited to own customer & visit records.</li>
            </ul>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SystemSettings;
