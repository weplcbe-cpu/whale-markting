import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { UserPlus, Edit, Shield, UserX, UserCheck, X, Trash2, AlertCircle, Plus, ChevronDown } from 'lucide-react';
import { ModalPortal } from '../ui';
import { useModalLayer } from '../ui/modalLayer';

const UNKNOWN_ADD_USER_ERROR = 'Unable to create user. Please check the Edge Function logs and try again.';

const getCaughtErrorMessage = (error, fallback = UNKNOWN_ADD_USER_ERROR) => {
  if (!(error instanceof Error) || typeof error.message !== 'string') return fallback;
  const message = error.message.trim();
  return message && message !== '{}' ? message : fallback;
};

const territoryDraftSignature = (draft) => JSON.stringify(Object.values(draft)
  .map(({ localBodyId, priority, visitCycle, active }) => ({ localBodyId, priority, visitCycle, active: active !== false }))
  .sort((left, right) => String(left.localBodyId).localeCompare(String(right.localBodyId))));

export const UserManagement = () => {
  const { users, employeeVisitPlaces, territoryAssignments, territoryLocalBodies, addUser, updateUser, replaceEmployeeTerritoryAssignments, toggleUserStatus, deleteUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [placeInput, setPlaceInput] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [territoryDraft, setTerritoryDraft] = useState({});
  const [isSavingTerritory, setIsSavingTerritory] = useState(false);
  const initialFormDataRef = useRef(null);
  const initialTerritoryDraftRef = useRef({});
  const submitLockRef = useRef(false);

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

  const isSundarTerritoryEditor = editingUser?.employeeId === 'EMP004' && formData.role === 'Marketing Team';
  const sundarAssignments = useMemo(() => territoryAssignments.filter((assignment) => assignment.employeeId === 'EMP004'), [territoryAssignments]);
  const territoryZoneId = sundarAssignments[0]?.zoneId || '';
  const territoryZoneName = sundarAssignments[0]?.zone?.zoneName || 'South Tamil Nadu Zone';
  const territoryDistricts = useMemo(() => {
    const groups = new Map();
    territoryLocalBodies.forEach((localBody) => {
      const districtName = localBody.district?.districtName || 'Unassigned district';
      if (!groups.has(districtName)) groups.set(districtName, []);
      groups.get(districtName).push(localBody);
    });
    return [...groups.entries()]
      .map(([districtName, localBodies]) => ({
        districtName,
        localBodies: [...localBodies].sort((left, right) => left.localBodyName.localeCompare(right.localBodyName)),
      }))
      .sort((left, right) => left.districtName.localeCompare(right.districtName));
  }, [territoryLocalBodies]);
  const territoryTotals = useMemo(() => {
    const assigned = Object.values(territoryDraft).filter((assignment) => assignment.active !== false);
    return {
      districts: new Set(assigned.map((assignment) => assignment.districtName)).size,
      corporations: assigned.filter((assignment) => assignment.localBodyType === 'Corporation').length,
      municipalities: assigned.filter((assignment) => assignment.localBodyType === 'Municipality').length,
      locations: assigned.length,
    };
  }, [territoryDraft]);

  const isFormDirty = isAddModalOpen && initialFormDataRef.current !== null &&
    JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
  const isTerritoryDirty = isSundarTerritoryEditor &&
    territoryDraftSignature(territoryDraft) !== territoryDraftSignature(initialTerritoryDraftRef.current);
  const hasUnsavedChanges = isFormDirty || isTerritoryDirty;
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
  const availablePlaceNames = [...new Set(employeeVisitPlaces.map((item) => item.placeName))].sort();
  const addAssignedPlace = () => {
    const place = placeInput.trim();
    if (!place || formData.assignedVisitPlaces.includes(place)) return;
    updateFormField('assignedVisitPlaces', [...formData.assignedVisitPlaces, place]);
    setPlaceInput('');
  };
  const removeAssignedPlace = (place) => updateFormField(
    'assignedVisitPlaces',
    formData.assignedVisitPlaces.filter((item) => item !== place),
  );

  const updateTerritoryDraft = (localBody, updates) => {
    setTerritoryDraft((current) => ({
      ...current,
      [localBody.id]: {
        localBodyId: localBody.id,
        districtName: localBody.district?.districtName,
        localBodyType: localBody.localBodyType,
        priority: localBody.localBodyType === 'Corporation' ? 'A' : 'B',
        visitCycle: localBody.localBodyType === 'Corporation' ? 'Monthly' : 'Bi-Monthly',
        active: true,
        ...current[localBody.id],
        ...updates,
      },
    }));
  };

  const setDistrictAssignments = (localBodies, active) => {
    localBodies.forEach((localBody) => updateTerritoryDraft(localBody, { active }));
  };

  const saveTerritoryAssignments = async () => {
    if (!territoryZoneId) {
      setFormError('Territory zone data is not available. Refresh and try again.');
      return;
    }
    setFormError('');
    setIsSavingTerritory(true);
    try {
      const assignments = Object.values(territoryDraft)
        .filter((assignment) => assignment.active !== false)
        .map((assignment) => ({ ...assignment, zoneId: territoryZoneId }));
      await replaceEmployeeTerritoryAssignments('EMP004', assignments);
      const selectedIds = new Set(assignments.map((assignment) => assignment.localBodyId));
      const assignedVisitPlaces = territoryLocalBodies
        .filter((localBody) => selectedIds.has(localBody.id))
        .map((localBody) => localBody.localBodyName);
      setFormData((current) => ({
        ...current,
        assignedVisitPlaces,
      }));
      initialTerritoryDraftRef.current = Object.fromEntries(assignments.map((assignment) => [assignment.localBodyId, assignment]));
      initialFormDataRef.current = { ...initialFormDataRef.current, assignedVisitPlaces };
    } catch (error) {
      setFormError(getCaughtErrorMessage(error, 'Unable to save territory assignments. Please try again.'));
    } finally {
      setIsSavingTerritory(false);
    }
  };

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
    setTerritoryDraft({});
    initialTerritoryDraftRef.current = {};
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
    const nextTerritoryDraft = Object.fromEntries(
      territoryAssignments
        .filter((assignment) => assignment.employeeId === user.employeeId)
        .map((assignment) => [assignment.localBodyId, {
          localBodyId: assignment.localBodyId,
          districtName: assignment.districtName,
          localBodyType: assignment.localBodyType,
          priority: assignment.priority,
          visitCycle: assignment.visitCycle,
          active: assignment.active !== false,
        }]),
      );
      setTerritoryDraft(nextTerritoryDraft);
      initialTerritoryDraftRef.current = nextTerritoryDraft;
    initialFormDataRef.current = nextFormData;
    setIsAddModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setFormError('');

    if (isTerritoryDirty) {
      setFormError('You have unsaved territory changes. Save the territory assignment before continuing.');
      return;
    }

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
          <section className={`user-modal admin-user-modal user-modal--${editingUser ? 'edit' : 'create'}`} role="dialog" aria-modal="true" aria-labelledby="user-modal-title" aria-describedby="user-modal-subtitle">
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
              <div className="user-modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                {formData.role === 'Marketing Team' && !isSundarTerritoryEditor && (
                  <div className="form-group user-places-field">
                    <label className="form-label">Assigned Visit Places <span className="required-marker">*</span></label>
                    <div className="user-places-input">
                      <input
                        type="search"
                        className="form-input"
                        list="visit-place-suggestions"
                        placeholder="Search or enter a place"
                        value={placeInput}
                        onChange={(event) => setPlaceInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addAssignedPlace();
                          }
                        }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={addAssignedPlace}><Plus size={16} /> Add</button>
                      <datalist id="visit-place-suggestions">
                        {availablePlaceNames.map((place) => <option value={place} key={place} />)}
                      </datalist>
                    </div>
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

                {isSundarTerritoryEditor && (
                  <section className="territory-assignment-field" aria-labelledby="territory-assignment-heading">
                    <div className="territory-assignment__heading">
                      <div>
                        <h3 id="territory-assignment-heading">Assigned Territory</h3>
                        <p>{territoryZoneName}</p>
                      </div>
                      <div className="territory-assignment__header-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDistrictAssignments(territoryLocalBodies, true)} disabled={isSavingTerritory || !territoryLocalBodies.length}>Select All Locations</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDistrictAssignments(territoryLocalBodies, false)} disabled={isSavingTerritory || !territoryLocalBodies.length}>Clear All</button>
                      </div>
                    </div>
                    <div className="territory-summary-grid">
                      <span><strong>{territoryTotals.districts}</strong> Districts</span>
                      <span><strong>{territoryTotals.corporations}</strong> Corporations</span>
                      <span><strong>{territoryTotals.municipalities}</strong> Municipalities</span>
                      <span><strong>{territoryTotals.locations}</strong> Locations</span>
                    </div>
                    <div className="territory-district-list">
                      {territoryDistricts.map(({ districtName, localBodies }) => {
                        const assignedCount = localBodies.filter((localBody) => territoryDraft[localBody.id]?.active !== false).length;
                        return <details key={districtName} className="territory-district-card">
                          <summary aria-label={`${districtName}, ${assignedCount} of ${localBodies.length} assigned. Expand or collapse.`}>
                            <span>{districtName}</span>
                            <small>{assignedCount} / {localBodies.length} assigned</small>
                            <ChevronDown aria-hidden="true" size={16} />
                          </summary>
                          <div className="territory-district-card__actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDistrictAssignments(localBodies, true)}>Select Entire District</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDistrictAssignments(localBodies, false)}>Clear District</button>
                          </div>
                          <div className="territory-location-list">
                            {localBodies.map((localBody) => {
                              const assignment = territoryDraft[localBody.id];
                              const assigned = assignment?.active !== false;
                              return <div className="territory-location-row" key={localBody.id}>
                                <label><input type="checkbox" checked={assigned} onChange={(event) => updateTerritoryDraft(localBody, { active: event.target.checked })} /> <span>{localBody.localBodyName}</span></label>
                                <span className={`territory-type-badge territory-type-badge--${localBody.localBodyType.toLowerCase()}`}>{localBody.localBodyType}</span>
                                <select aria-label={`${localBody.localBodyName} priority`} disabled={!assigned} value={assignment?.priority || (localBody.localBodyType === 'Corporation' ? 'A' : 'B')} onChange={(event) => updateTerritoryDraft(localBody, { priority: event.target.value })}><option value="A">Priority A</option><option value="B">Priority B</option><option value="C">Priority C</option></select>
                                <select aria-label={`${localBody.localBodyName} visit cycle`} disabled={!assigned} value={assignment?.visitCycle || (localBody.localBodyType === 'Corporation' ? 'Monthly' : 'Bi-Monthly')} onChange={(event) => updateTerritoryDraft(localBody, { visitCycle: event.target.value })}><option value="Monthly">Monthly</option><option value="Bi-Monthly">Bi-Monthly</option><option value="Quarterly">Quarterly</option></select>
                              </div>;
                            })}
                          </div>
                        </details>;
                      })}
                    </div>
                    <div className="territory-assignment__footer">
                      <button type="button" className="btn btn-primary" onClick={saveTerritoryAssignments} disabled={isSavingTerritory || !territoryLocalBodies.length}>{isSavingTerritory ? 'Saving Territory...' : 'Save Territory Assignment'}</button>
                    </div>
                  </section>
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
