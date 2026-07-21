import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Key, Save } from 'lucide-react';

export const ProfilePage = () => {
  const { currentUser, updateUser, showToast } = useApp();
  const [password, setPassword] = useState(currentUser?.password || 'password123');

  const handleSave = (e) => {
    e.preventDefault();
    if (currentUser) {
      updateUser(currentUser.id, { password });
      showToast('Password updated successfully', 'success');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><User size={18} color="var(--accent-cyan)" /> My Employee Profile</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', marginBottom: '24px' }}>
          <div><strong>Name:</strong> {currentUser?.employeeName}</div>
          <div><strong>Employee ID:</strong> <code>{currentUser?.employeeId}</code></div>
          <div><strong>Role:</strong> <span className="badge badge-planned">{currentUser?.role}</span></div>
          <div><strong>Mobile:</strong> {currentUser?.mobile}</div>
          <div><strong>Email:</strong> {currentUser?.email}</div>
          <div><strong>Department:</strong> {currentUser?.department || 'Marketing'}</div>
          <div><strong>Designation:</strong> {currentUser?.designation}</div>
        </div>

        <form onSubmit={handleSave} style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} color="var(--accent-amber)" /> Change Password
          </h4>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="text"
              className="form-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
