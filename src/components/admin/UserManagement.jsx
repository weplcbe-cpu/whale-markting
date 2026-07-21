import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserPlus, Edit, Shield, UserX, UserCheck, X, Trash2 } from 'lucide-react';

export const UserManagement = () => {
  const { users, addUser, updateUser, toggleUserStatus, deleteUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    employeeName: '',
    employeeId: '',
    mobile: '',
    email: '',
    role: 'Marketing Team',
    username: '',
    password: '',
    department: 'Marketing',
    designation: 'Marketing Executive'
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenAdd = () => {
    setFormError('');
    setFormData({
      employeeName: '',
      employeeId: `EMP00${users.length + 1}`,
      mobile: '',
      email: '',
      role: 'Marketing Team',
      username: '',
      password: '',
      department: 'Marketing',
      designation: 'Marketing Executive'
    });
    setEditingUser(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setFormError('');
    setEditingUser(user);
    setFormData({
      employeeName: user.employeeName,
      employeeId: user.employeeId,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      username: user.username,
      password: '',
      department: user.department || 'Marketing',
      designation: user.designation || 'Executive'
    });
    setIsAddModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (editingUser) {
      // `profiles` has no `password` column — passwords live in Supabase Auth
      // and are never edited from this screen, so strip it from the payload.
      const { password, ...profileFields } = formData;
      setIsSubmitting(true);
      await updateUser(editingUser.id, profileFields);
      setIsSubmitting(false);
      setIsAddModalOpen(false);
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const result = await addUser(formData);
    setIsSubmitting(false);
    if (result?.success) {
      setIsAddModalOpen(false);
    } else {
      // Keep the modal open and show the exact error so the Admin can fix
      // the offending field (duplicate email/employee ID, weak password, etc.)
      setFormError(result?.error || 'Failed to create user');
    }
  };

  return (
    <div>
      {/* Header & Filter Toolbar */}
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <div className="input-with-icon" style={{ minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search Name, ID, Username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Director">Director</option>
            <option value="Marketing Team">Marketing Team</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} /> Add New User
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Shield size={18} color="var(--accent-cyan)" /> User Directory & Permissions</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showing {filteredUsers.length} Users</span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.employeeId}</strong></td>
                  <td>
                    <div>{u.employeeName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.designation}</div>
                  </td>
                  <td><code>{u.username}</code></td>
                  <td>
                    <span className={`badge ${u.role === 'Admin' ? 'badge-high' : u.role === 'Director' ? 'badge-rescheduled' : 'badge-planned'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>{u.mobile}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'Active' ? 'badge-approved' : 'badge-rejected'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(u)}
                        title="Edit User"
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        className={`btn btn-sm ${u.status === 'Active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleUserStatus(u.id)}
                        title={u.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                      >
                        {u.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeletingUser(u)}
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit Employee User' : 'Add New Employee User'}</h3>
              <button
                onClick={() => !isSubmitting && setIsAddModalOpen(false)}
                disabled={isSubmitting}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {formError && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid var(--accent-red, #ef4444)',
                      color: 'var(--accent-red, #ef4444)',
                      fontSize: '0.85rem'
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Employee Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.employeeName}
                    onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Marketing Team">Marketing Team</option>
                    <option value="Director">Director</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={isSubmitting} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save User Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Delete User</h3>
              <button onClick={() => setDeletingUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-main)' }}>
                Are you sure you want to permanently delete <strong>{deletingUser.employeeName}</strong> ({deletingUser.employeeId})? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingUser(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  deleteUser(deletingUser.id);
                  setDeletingUser(null);
                }}
              >
                <Trash2 size={14} /> Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
