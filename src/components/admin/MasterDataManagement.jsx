import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Edit3, Layers, MapPinned, Plus, Power, Search, Target, Trash2, X } from 'lucide-react';
import { ModalPortal } from '../ui';

const emptyRecord = () => ({ recordType: 'Municipality', id: '', zoneId: '', districtId: '', name: '', active: true });
const recordTypeForRpc = (recordType) => recordType.toLowerCase().replace(' ', '_');

export const MasterDataManagement = () => {
  const { orgTypes, purposes, territoryAssignments, territoryLocalBodies, territoryZones, territoryDistricts, territoryPlanningGroups, manageTerritoryMasterRecord } = useApp();
  const [activeTab, setActiveTab] = useState('territory');
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const territoryRecords = useMemo(() => {
    const activeAssignmentCount = (localBodyId) => territoryAssignments.filter((assignment) => assignment.localBodyId === localBodyId && assignment.active !== false).length;
    const zones = territoryZones.map((zone) => ({ id: zone.id, type: 'Zone', name: zone.zoneName, zoneName: zone.zoneName, active: zone.active !== false }));
    const districts = territoryDistricts.map((district) => ({ id: district.id, type: 'District', name: district.districtName, zoneId: district.zoneId, zoneName: district.zone?.zoneName || '-', active: district.active !== false }));
    const localBodies = territoryLocalBodies.map((localBody) => ({
      id: localBody.id,
      type: localBody.localBodyType,
      name: localBody.localBodyName,
      zoneId: localBody.district?.zoneId,
      zoneName: localBody.district?.zone?.zoneName || '-',
      districtId: localBody.districtId,
      districtName: localBody.district?.districtName || '-',
      active: localBody.active !== false,
      activeAssignments: activeAssignmentCount(localBody.id),
    }));
    const planningGroups = territoryPlanningGroups.map((group) => ({ id: group.id, type: 'Planning Group', name: group.groupName, zoneId: group.zoneId, zoneName: group.zone?.zoneName || '-', active: group.active !== false }));
    return [...zones, ...districts, ...localBodies, ...planningGroups];
  }, [territoryAssignments, territoryDistricts, territoryLocalBodies, territoryPlanningGroups, territoryZones]);
  const filteredRecords = territoryRecords.filter((item) => {
    const text = `${item.name} ${item.districtName || ''} ${item.zoneName || ''}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (districtFilter === 'All' || item.districtId === districtFilter)
      && (typeFilter === 'All' || item.type === typeFilter)
      && (statusFilter === 'All' || (statusFilter === 'Active') === item.active);
  });
  const summary = {
    zones: territoryZones.filter((zone) => zone.active !== false).length,
    districts: territoryDistricts.filter((district) => district.active !== false).length,
    corporations: territoryLocalBodies.filter((body) => body.active !== false && body.localBodyType === 'Corporation').length,
    municipalities: territoryLocalBodies.filter((body) => body.active !== false && body.localBodyType === 'Municipality').length,
  };
  const openCreate = () => { setError(''); setRecord(emptyRecord()); };
  const openEdit = (item) => {
    setError('');
    setRecord({ recordType: item.type, id: item.id, zoneId: item.zoneId || '', districtId: item.districtId || '', name: item.name, active: item.active });
  };
  const saveRecord = async (event) => {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true);
    setError('');
    try {
      await manageTerritoryMasterRecord(record.id ? 'update' : 'create', {
        id: record.id || null,
        record_type: recordTypeForRpc(record.recordType),
        zone_id: record.zoneId || null,
        district_id: record.districtId || null,
        local_body_type: ['Corporation', 'Municipality'].includes(record.recordType) ? record.recordType : null,
        name: record.name.trim(),
        active: record.active,
      });
      setRecord(null);
    } catch (saveError) {
      setError(saveError?.message === 'TERRITORY_DUPLICATE' ? 'A territory record with this name already exists.' : saveError?.message || 'Unable to save this territory record.');
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (item) => {
    try {
      await manageTerritoryMasterRecord('set_active', {
        id: item.id,
        record_type: recordTypeForRpc(item.type),
        local_body_type: ['Corporation', 'Municipality'].includes(item.type) ? item.type : null,
        active: !item.active,
      });
    } catch (actionError) {
      setError(actionError?.message || 'Unable to update territory status.');
    }
  };
  const canDelete = (item) => {
    if (item.activeAssignments > 0) return false;
    if (item.type === 'Zone') return !territoryDistricts.some((district) => district.zoneId === item.id) && !territoryPlanningGroups.some((group) => group.zoneId === item.id);
    if (item.type === 'District') return !territoryLocalBodies.some((body) => body.districtId === item.id);
    return true;
  };
  const deleteRecord = async (item) => {
    try {
      await manageTerritoryMasterRecord('delete', {
        id: item.id,
        record_type: recordTypeForRpc(item.type),
        local_body_type: ['Corporation', 'Municipality'].includes(item.type) ? item.type : null,
      });
    } catch (actionError) {
      setError(actionError?.message === 'TERRITORY_RECORD_IN_USE' ? 'This record has historical or assignment links and must be deactivated instead.' : actionError?.message || 'Unable to delete this territory record.');
    }
  };
  return <div>
    <div className="toolbar-bar territory-master-toolbar">
      <div>
        <h2>Territory Master</h2>
        <p>Manage zones, districts, corporations, and municipalities.</p>
      </div>
      <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Territory Record</button>
    </div>
    <div className="master-tabs" role="tablist" aria-label="Master data sections">
      <button className={`btn ${activeTab === 'territory' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('territory')} role="tab" aria-selected={activeTab === 'territory'}><MapPinned size={16} /> Territory Master</button>
      <button className={`btn ${activeTab === 'purposes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('purposes')} role="tab" aria-selected={activeTab === 'purposes'}><Target size={16} /> Visit Purposes</button>
      <button className={`btn ${activeTab === 'orgTypes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('orgTypes')} role="tab" aria-selected={activeTab === 'orgTypes'}><Layers size={16} /> Organization Types</button>
    </div>
    {activeTab === 'territory' && <>
      <div className="territory-master-summary">
        <span><strong>{summary.zones}</strong> Active Zones</span><span><strong>{summary.districts}</strong> Districts</span><span><strong>{summary.corporations}</strong> Corporations</span><span><strong>{summary.municipalities}</strong> Municipalities</span>
      </div>
      <div className="territory-master-filters">
        <label><Search size={16} /><input className="form-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search territory" /></label>
        <select className="form-select" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}><option value="All">All Districts</option>{territoryDistricts.map((district) => <option key={district.id} value={district.id}>{district.districtName}</option>)}</select>
        <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="All">All Types</option><option>Zone</option><option>District</option><option>Corporation</option><option>Municipality</option><option>Planning Group</option></select>
        <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Active</option><option>Inactive</option><option>All</option></select>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="territory-master-table-wrap"><table className="custom-table territory-master-table"><thead><tr><th>Name</th><th>District</th><th>Type</th><th>Zone</th><th>Active Assignments</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredRecords.map((item) => {
        const deletable = canDelete(item);
        const deleteTitle = deletable ? 'Delete record' : item.activeAssignments ? 'Cannot delete: this location is assigned to an employee.' : 'Cannot delete: this record has dependent territory data.';
        return <tr key={`${item.type}-${item.id}`}><td data-label="Name"><strong>{item.name}</strong></td><td data-label="District">{item.districtName || '-'}</td><td data-label="Type"><span className={`territory-type-badge territory-type-badge--${item.type.toLowerCase().replace(' ', '-')}`}>{item.type}</span></td><td data-label="Zone">{item.zoneName || '-'}</td><td data-label="Active Assignments">{item.activeAssignments || 0}</td><td data-label="Status"><span className={`badge ${item.active ? 'badge-approved' : 'badge-rejected'}`}>{item.active ? 'Active' : 'Inactive'}</span></td><td data-label="Actions"><div className="territory-master-actions"><button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)} title={`Edit ${item.name}`}><Edit3 size={15} /></button><button className="btn btn-secondary btn-sm" onClick={() => changeStatus(item)} title={`${item.active ? 'Deactivate' : 'Activate'} ${item.name}`}><Power size={15} /></button><button className="btn btn-danger btn-sm" onClick={() => deleteRecord(item)} disabled={!deletable} title={deleteTitle}><Trash2 size={15} /></button></div></td></tr>;
      })}</tbody></table></div>
    </>}
    {activeTab === 'purposes' && <div className="card master-list-card"><h3><Target size={18} /> Visit Purposes Master List</h3><div>{purposes.map((purpose) => <span key={purpose}>{purpose}</span>)}</div></div>}
    {activeTab === 'orgTypes' && <div className="card master-list-card"><h3><Layers size={18} /> Organization Types Master List</h3><div>{orgTypes.map((type) => <span key={type}>{type}</span>)}</div></div>}
    {record && <ModalPortal onClose={() => !saving && setRecord(null)} closeOnBackdrop={!saving}><section className="modal-content territory-master-modal" onClick={(event) => event.stopPropagation()}><header className="modal-header"><h3>{record.id ? 'Edit Territory Record' : 'Add Territory Record'}</h3><button className="user-modal__close" type="button" onClick={() => setRecord(null)} disabled={saving} aria-label="Close"><X size={18} /></button></header><form onSubmit={saveRecord}><div className="modal-body territory-master-form">{error && <div className="form-error" role="alert">{error}</div>}<label className="form-group"><span className="form-label">Record Type</span><select className="form-select" value={record.recordType} disabled={Boolean(record.id)} onChange={(event) => setRecord((current) => ({ ...current, recordType: event.target.value, zoneId: '', districtId: '' }))}><option>Zone</option><option>District</option><option>Corporation</option><option>Municipality</option><option>Planning Group</option></select></label>{['District', 'Corporation', 'Municipality', 'Planning Group'].includes(record.recordType) && <label className="form-group"><span className="form-label">Zone</span><select className="form-select" required value={record.zoneId} onChange={(event) => setRecord((current) => ({ ...current, zoneId: event.target.value, districtId: '' }))}><option value="">Select zone</option>{territoryZones.filter((zone) => zone.active !== false || zone.id === record.zoneId).map((zone) => <option key={zone.id} value={zone.id}>{zone.zoneName}</option>)}</select></label>}{['Corporation', 'Municipality'].includes(record.recordType) && <label className="form-group"><span className="form-label">District</span><select className="form-select" required value={record.districtId} onChange={(event) => setRecord((current) => ({ ...current, districtId: event.target.value }))}><option value="">Select district</option>{territoryDistricts.filter((district) => (!record.zoneId || district.zoneId === record.zoneId) && (district.active !== false || district.id === record.districtId)).map((district) => <option key={district.id} value={district.id}>{district.districtName}</option>)}</select></label>}<label className="form-group"><span className="form-label">{record.recordType} Name</span><input className="form-input" required value={record.name} onChange={(event) => setRecord((current) => ({ ...current, name: event.target.value }))} /></label><label className="territory-active-toggle"><input type="checkbox" checked={record.active} onChange={(event) => setRecord((current) => ({ ...current, active: event.target.checked }))} /> Active</label></div><footer className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setRecord(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Territory Record'}</button></footer></form></section></ModalPortal>}
  </div>;
};

export default MasterDataManagement;
