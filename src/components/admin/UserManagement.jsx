import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { UserPlus, Edit, Shield, UserX, UserCheck, X, Trash2, AlertCircle, Search } from 'lucide-react';
import { ModalPortal } from '../ui';
import { useModalLayer } from '../ui/modalLayer';

const UNKNOWN_ADD_USER_ERROR = 'Unable to create user. Please check the Edge Function logs and try again.';

const getCaughtErrorMessage = (error, fallback = UNKNOWN_ADD_USER_ERROR) => {
  if (!(error instanceof Error) || typeof error.message !== 'string') return fallback;
  const message = error.message.trim();
  return message && message !== '{}' ? message : fallback;
};

export const UserManagement = () => {
  const { users, employeeVisitPlaces, locations = [], addUser, updateUser, toggleUserStatus, deleteUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isPlacePickerOpen, setIsPlacePickerOpen] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');
  const [selectedPlaceNames, setSelectedPlaceNames] = useState([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialFormDataRef = useRef(null);
  const submitLockRef = useRef(false);
  const userModalMode = editingUser ? 'edit' : 'create';

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
    designation: 'Marketing Executive',
    assignedVisitPlaces: []
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const isFormDirty = isAddModalOpen && initialFormDataRef.current !== null &&
    JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
  const hasUnsavedChanges = isFormDirty;
  useModalLayer(isAddModalOpen);

  useEffect(() => {
    if (!isAddModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || isSubmitting) return;
      event.preventDefault();
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
      } else if (hasUnsavedChanges) {
        setShowDiscardConfirm(true);
      } else {
        setIsAddModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isAddModalOpen, isSubmitting, showDiscardConfirm]);

  useEffect(() => {
    if (!isAddModalOpen || !hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isAddModalOpen]);

  const closeModal = () => {
    setShowDiscardConfirm(false);
    setIsAddModalOpen(false);
    setFormError('');
  };

  const requestClose = () => {
    if (isSubmitting) return;
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    closeModal();
  };

  const updateFormField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (formError) setFormError('');
  };
  const locationGroups = useMemo(() => locations
    .filter((location) => location.active !== false)
    .filter((location) => `${location.district?.districtName || ''} ${location.locationName || ''}`.toLocaleLowerCase().includes(placeSearch.trim().toLocaleLowerCase()))
    .reduce((groups, location) => {
      const districtName = location.district?.districtName || 'Other locations';
      groups.set(districtName, [...(groups.get(districtName) || []), location]);
      return groups;
    }, new Map()), [locations, placeSearch]);
  const openPlacePicker = () => {
    setPlaceSearch('');
    setSelectedPlaceNames(formData.assignedVisitPlaces);
    setIsPlacePickerOpen(true);
  };
  const toggleSelectedPlace = (placeName) => setSelectedPlaceNames((current) => current.some((place) => place.toLocaleLowerCase() === placeName.toLocaleLowerCase())
    ? current.filter((place) => place.toLocaleLowerCase() !== placeName.toLocaleLowerCase())
    : [...current, placeName]);
  const assignSelectedPlaces = () => {
    updateFormField('assignedVisitPlaces', selectedPlaceNames);
    setIsPlacePickerOpen(false);
  };
  const removeAssignedPlace = (place) => updateFormField(
    'assignedVisitPlaces',
    formData.assignedVisitPlaces.filter((item) => item.toLocaleLowerCase() !== place.toLocaleLowerCase()),
  );

  const handleOpenAdd = () => {
    setFormError('');
    const nextFormData = {
      employeeName: '',
      employeeId: `EMP00${users.length + 1}`,
      mobile: '',
      email: '',
      role: 'Marketing Team',
      username: '',
      password: '',
      department: 'Marketing',
      designation: 'Marketing Executive',
      assignedVisitPlaces: []
    };
    setFormData(nextFormData);
    initialFormDataRef.current = nextFormData;
    setEditingUser(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setFormError('');
    setEditingUser(user);
    const nextFormData = {
      employeeName: user.employeeName,
      employeeId: user.employeeId,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      username: user.username,
      password: '',
      department: user.department || 'Marketing',
      designation: user.designation || 'Executive',
      assignedVisitPlaces: employeeVisitPlaces
        .filter((item) => item.employeeId === user.employeeId && item.isActive !== false)
        .map((item) => item.placeName)
    };
    setFormData(nextFormData);
    initialFormDataRef.current = nextFormData;
    setIsAddModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setFormError('');

    if (!editingUser && formData.role === 'Marketing Team' && !formData.assignedVisitPlaces.length) {
      setFormError('Assign at least one visit place for a Marketing user.');
      return;
    }

    if (editingUser) {
      // `profiles` has no `password` column — passwords live in Supabase Auth
      // and are never edited from this screen, so strip it from the payload.
      const normalizedVisitPlaces = formData.assignedVisitPlaces
        .map((place) => place.trim())
        .filter(Boolean)
        .filter((place, index, places) => places.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === place.toLocaleLowerCase(),
        ) === index);
      const { password: _password, ...profileFields } = {
        ...formData,
        assignedVisitPlaces: normalizedVisitPlaces,
      };
      if (import.meta.env.DEV) console.log('Admin edit selected visit place chips', normalizedVisitPlaces);
      submitLockRef.current = true;
      setIsSubmitting(true);
      try {
        const result = await updateUser(editingUser.id, profileFields);
        if (result?.success === false) {
          throw new Error(result.error || 'Unable to update this user. Please try again.');
        }
        if (result?.success === true) closeModal();
      } catch (error) {
        setFormError(getCaughtErrorMessage(error, 'Unable to update this user. Please try again.'));
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await addUser(formData);
      if (result?.success) {
        closeModal();
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Add user workflow failed:', { name: error?.name, message: error?.message });
      setFormError(getCaughtErrorMessage(error));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
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
      {isAddModalOpen && createPortal(
        <div className="user-modal-overlay" role="presentation">
          <section className="user-modal admin-user-modal" data-mode={userModalMode} role="dialog" aria-modal="true" aria-labelledby="user-modal-title" aria-describedby="user-modal-subtitle">
            <header className="user-modal__header">
              <div>
                <h2 id="user-modal-title">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                <p id="user-modal-subtitle">{editingUser ? 'Update employee profile details' : 'Create login access and employee profile'}</p>
              </div>
              <button
                type="button"
                className="user-modal__close"
                onClick={requestClose}
                disabled={isSubmitting}
                aria-label="Close modal"
                title="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form className="user-modal__form" onSubmit={handleSave}>
              <div className="user-modal__body admin-user-modal__body">
                <div className="admin-user-modal__grid">
                {formError && (
                  <div className="form-error" role="alert">
                    <AlertCircle size={18} aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Employee Name <span className="required-marker">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.employeeName}
                    onChange={(e) => updateFormField('employeeName', e.target.value)}
                  />
                </div>

                {formData.role === 'Marketing Team' && (
                  <div className="form-group user-places-field">
                    <label className="form-label">Assigned Visit Places <span className="required-marker">*</span></label>
                    <div className="user-places-input"><button type="button" className="btn btn-secondary" onClick={openPlacePicker}><Search size={16} /> Add Place</button></div>
                    <div className="user-places-chips">
                      {formData.assignedVisitPlaces.map((place) => (
                        <button type="button" key={place} onClick={() => removeAssignedPlace(place)} title={`Remove ${place}`}>
                          {place} <X size={14} />
                        </button>
                      ))}
                    </div>
                    {!formData.assignedVisitPlaces.length && <small>Assign one or more places before saving this Marketing user.</small>}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Employee ID <span className="required-marker">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.employeeId}
                    onChange={(e) => updateFormField('employeeId', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number <span className="required-marker">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    inputMode="tel"
                    pattern="\+?[0-9][0-9\s-]{6,19}"
                    value={formData.mobile}
                    onChange={(e) => updateFormField('mobile', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address <span className="required-marker">*</span></label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={formData.email}
                    onChange={(e) => updateFormField('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role <span className="required-marker">*</span></label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => updateFormField('role', e.target.value)}
                  >
                    <option value="Marketing Team">Marketing Team</option>
                    <option value="Director">Director</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Username <span className="required-marker">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.username}
                    onChange={(e) => updateFormField('username', e.target.value)}
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">Password <span className="required-marker">*</span></label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => updateFormField('password', e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.designation}
                    onChange={(e) => updateFormField('designation', e.target.value)}
                  />
                </div>
                </div>
              </div>

              <footer className="user-modal__footer">
                <button type="button" className="btn btn-secondary" disabled={isSubmitting} onClick={requestClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating User...' : 'Save User Record'}
                </button>
              </footer>
            </form>
          </section>

          {showDiscardConfirm && (
            <div className="discard-confirm-overlay" role="presentation">
              <div className="modal-content discard-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-dialog-title" aria-describedby="discard-dialog-message">
                <div className="modal-header">
                  <h3 id="discard-dialog-title">Discard changes?</h3>
                </div>
                <div className="modal-body">
                  <p id="discard-dialog-message">You have unsaved changes. Do you want to discard them?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDiscardConfirm(false)}>Keep Editing</button>
                  <button type="button" className="btn btn-danger" onClick={closeModal}>Discard Changes</button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {isPlacePickerOpen && (
        <ModalPortal onClose={() => setIsPlacePickerOpen(false)}>
          <section className="modal-content location-picker" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header location-picker__header"><div><h3>Assigned Visit Places</h3><p>Select active visit places to assign to this employee.</p></div><button type="button" className="location-picker__close" onClick={() => setIsPlacePickerOpen(false)} aria-label="Close"><X size={18} /></button></header>
            <div className="modal-body location-picker__body">
              <label className="assignment-picker-search"><span>Search locations</span><div><Search size={16} /><input className="form-input" value={placeSearch} onChange={(event) => setPlaceSearch(event.target.value)} placeholder="Search district or location name..." /></div></label>
              <div className="location-picker__groups">
                {[...locationGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([districtName, districtLocations]) => <section key={districtName}><header><h4>{districtName}</h4><span>{districtLocations.length} {districtLocations.length === 1 ? 'location' : 'locations'}</span></header>{districtLocations.sort((left, right) => left.locationName.localeCompare(right.locationName)).map((location) => {
                  const selected = selectedPlaceNames.some((place) => place.toLocaleLowerCase() === location.locationName.toLocaleLowerCase());
                  return <label className={`assignment-location-row${selected ? ' selected' : ''}`} key={location.id}><input type="checkbox" checked={selected} onChange={() => toggleSelectedPlace(location.locationName)} aria-label={`Assign ${location.locationName}`} /><span className="assignment-location-main"><span className="assignment-location-name">{location.locationName}</span><span className="assignment-location-type">{location.locationType}</span></span></label>;
                })}</section>)}
                {!locationGroups.size && <p className="location-picker__empty">No active locations are available.</p>}
              </div>
            </div>
            <footer className="modal-footer location-picker__footer"><button type="button" className="btn btn-secondary" onClick={() => setIsPlacePickerOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={assignSelectedPlaces} disabled={!selectedPlaceNames.length}>Assign Selected ({selectedPlaceNames.length})</button></footer>
          </section>
        </ModalPortal>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <ModalPortal onClose={() => setDeletingUser(null)}>
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
        </ModalPortal>
      )}
    </div>
  );
};

export default UserManagement;
