import React, { useMemo, useState } from 'react';
import { Building2, ChevronDown, Edit3, Landmark, MapPin, Plus, Power, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, ConfirmationDialog, FormField, Modal, SelectField, StatusBadge } from '../ui';

const emptyDistrict = () => ({ kind: 'district', id: '', name: '', active: true });
const emptyLocation = () => ({ kind: 'location', id: '', districtId: '', name: '', locationType: '', active: true });

const matchesName = (value, name) => String(value || '').trim().toLocaleLowerCase() === String(name || '').trim().toLocaleLowerCase();
const statusTone = (active) => active ? 'success' : 'danger';

export const MasterDataManagement = () => {
  const { districts = [], locations = [], manageLocationMaster } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [record, setRecord] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(null);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredLocations = useMemo(() => locations.filter((location) => {
    const districtName = location.district?.districtName || '';
    const matchesSearch = !normalizedSearch || `${districtName} ${location.locationName}`.toLocaleLowerCase().includes(normalizedSearch);
    const matchesType = typeFilter === 'All' || location.locationType === typeFilter;
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active') === (location.active !== false);
    return matchesSearch && matchesType && matchesStatus;
  }), [locations, normalizedSearch, statusFilter, typeFilter]);
  const districtRows = useMemo(() => districts
    .filter((district) => {
      const districtLocations = filteredLocations.filter((location) => location.districtId === district.id);
      return districtLocations.length > 0 || (!normalizedSearch && typeFilter === 'All' && statusFilter === 'All');
    })
    .map((district) => {
      const districtLocations = filteredLocations.filter((location) => location.districtId === district.id);
      return {
        ...district,
        locations: districtLocations,
        corporations: districtLocations.filter((location) => location.locationType === 'Corporation').length,
        municipalities: districtLocations.filter((location) => location.locationType === 'Municipality').length,
      };
    })
    .sort((left, right) => left.districtName.localeCompare(right.districtName)), [districts, filteredLocations, normalizedSearch, statusFilter, typeFilter]);
  const totals = useMemo(() => ({
    districts: districts.length,
    corporations: locations.filter((location) => location.locationType === 'Corporation').length,
    municipalities: locations.filter((location) => location.locationType === 'Municipality').length,
    locations: locations.length,
  }), [districts, locations]);

  const openDistrict = (district = null) => {
    setErrors({});
    setRecord(district ? { kind: 'district', id: district.id, name: district.districtName, active: district.active !== false } : emptyDistrict());
  };
  const openLocation = (location = null) => {
    setErrors({});
    setRecord(location ? {
      kind: 'location',
      id: location.id,
      districtId: location.districtId,
      name: location.locationName,
      locationType: location.locationType,
      active: location.active !== false,
    } : emptyLocation());
  };
  const updateRecord = (field, value) => {
    setRecord((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };
  const validate = () => {
    const next = {};
    const trimmedName = record.name.trim();
    if (!trimmedName) next.name = `${record.kind === 'district' ? 'District' : 'Location'} name is required.`;
    if (record.kind === 'location') {
      if (!record.districtId) next.districtId = 'Select a district.';
      if (!record.locationType) next.locationType = 'Select a location type.';
    }
    if (trimmedName && record.kind === 'district' && districts.some((district) => district.id !== record.id && matchesName(district.districtName, trimmedName))) {
      next.name = 'A district with this name already exists.';
    }
    if (trimmedName && record.kind === 'location' && locations.some((location) => location.id !== record.id && location.districtId === record.districtId && matchesName(location.locationName, trimmedName))) {
      next.name = 'A location with this name already exists in this district.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const isEdit = Boolean(record.id);
      const action = record.kind === 'district'
        ? isEdit ? 'update_district' : 'create_district'
        : isEdit ? 'update_location' : 'create_location';
      await manageLocationMaster(action, {
        id: record.id || null,
        district_id: record.kind === 'location' ? record.districtId : null,
        name: record.name.trim(),
        location_type: record.kind === 'location' ? record.locationType : null,
        active: record.active,
      });
      setRecord(null);
    } catch (error) {
      const messages = {
        LOCATION_DUPLICATE: record.kind === 'district' ? 'A district with this name already exists.' : 'A location with this name already exists in this district.',
        LOCATION_HAS_VISIT_HISTORY: 'The district or location type cannot change because visit records exist.',
        LOCATION_RENAME_ASSIGNMENT_CONFLICT: 'This name conflicts with an assigned visit place.',
        DISTRICT_HAS_LOCATIONS: 'Deactivate this district instead; it still contains locations.',
      };
      setErrors({ form: messages[error?.message] || 'Unable to save this record. Please try again.' });
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async () => {
    if (!deactivating) return;
    setSaving(true);
    try {
      await manageLocationMaster('set_location_active', { id: deactivating.id, active: false });
      setDeactivating(null);
    } catch (error) {
      setErrors({ form: error?.message || 'Unable to deactivate this location.' });
    } finally {
      setSaving(false);
    }
  };
  const toggleLocation = async (location) => {
    if (location.active !== false) {
      setDeactivating(location);
      return;
    }
    try {
      await manageLocationMaster('set_location_active', { id: location.id, active: true });
    } catch (error) {
      setErrors({ form: error?.message || 'Unable to activate this location.' });
    }
  };

  return (
    <div className="location-master ds-page">
      <header className="location-master__header">
        <div>
          <div className="location-master__eyebrow"><MapPin size={16} /> Master Data</div>
          <h2>Location Master</h2>
          <p>Manage districts, corporations, municipalities and visit places.</p>
        </div>
        <div className="location-master__actions">
          <Button variant="secondary" onClick={() => openDistrict()}><Plus size={16} /> Add District</Button>
          <Button onClick={() => openLocation()}><Plus size={16} /> Add Location</Button>
        </div>
      </header>

      <section className="location-master__summary" aria-label="Location summary">
        <article><small>Districts</small><strong>{totals.districts}</strong></article>
        <article><small>Corporations</small><strong>{totals.corporations}</strong></article>
        <article><small>Municipalities</small><strong>{totals.municipalities}</strong></article>
        <article><small>Total Locations</small><strong>{totals.locations}</strong></article>
      </section>

      <section className="location-master__filters" aria-label="Location filters">
        <label className="location-master__search"><Search size={17} /><span className="sr-only">Search locations</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search district or location" /></label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by location type"><option value="All">All types</option><option value="Corporation">Corporation</option><option value="Municipality">Municipality</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="All">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
      </section>

      {errors.form && <div className="ds-error location-master__error" role="alert">{errors.form}</div>}
      <section className="location-master__list" aria-label="District locations">
        {districtRows.map((district) => (
          <details className="location-master__district" key={district.id}>
            <summary>
              <div><strong>{district.districtName}</strong><StatusBadge tone={statusTone(district.active !== false)}>{district.active !== false ? 'Active' : 'Inactive'}</StatusBadge></div>
              <div className="location-master__counts"><span>{district.corporations} Corporation</span><span>{district.municipalities} Municipality</span><span>{district.locations.length} Locations</span><ChevronDown size={18} aria-hidden="true" /></div>
            </summary>
            <div className="location-master__district-body">
              <div className="location-master__district-actions"><Button variant="secondary" onClick={() => openDistrict(district)}><Edit3 size={15} /> Edit District</Button></div>
              {['Corporation', 'Municipality'].map((type) => {
                const rows = district.locations.filter((location) => location.locationType === type);
                return <section className="location-master__type-group" key={type}>
                  <h3>{type === 'Corporation' ? <Building2 size={17} /> : <Landmark size={17} />}{type}</h3>
                  {rows.length ? rows.map((location) => <div className="location-master__row" key={location.id}>
                    <div className="location-master__row-details">
                      <strong>{location.locationName}</strong>
                      <span>{type}</span>
                    </div>
                    <div className="location-master__row-controls">
                      <StatusBadge tone={statusTone(location.active !== false)}>{location.active !== false ? 'Active' : 'Inactive'}</StatusBadge>
                      <div className="location-master__row-actions">
                        <button type="button" onClick={() => openLocation(location)} title={`Edit ${location.locationName}`} aria-label={`Edit ${location.locationName}`}><Edit3 size={16} /><span>Edit</span></button>
                        <button type="button" onClick={() => toggleLocation(location)} title={location.active !== false ? `Deactivate ${location.locationName}` : `Activate ${location.locationName}`} aria-label={location.active !== false ? `Deactivate ${location.locationName}` : `Activate ${location.locationName}`}><Power size={16} /><span>{location.active !== false ? 'Deactivate' : 'Activate'}</span></button>
                      </div>
                    </div>
                  </div>) : <p className="location-master__empty">No {type.toLocaleLowerCase()} locations match these filters.</p>}
                </section>;
              })}
            </div>
          </details>
        ))}
        {!districtRows.length && <div className="location-master__empty-state">No districts or locations match the current filters.</div>}
      </section>

      <Modal
        open={Boolean(record)}
        onClose={() => !saving && setRecord(null)}
        title={record?.kind === 'district' ? (record.id ? 'Edit District' : 'Add District') : (record?.id ? 'Edit Location' : 'Add Location')}
        subtitle={record?.kind === 'district' ? 'Keep district names clear and unique.' : 'Set the district, type and availability for this visit place.'}
        footer={<><Button variant="secondary" onClick={() => setRecord(null)} disabled={saving}>Cancel</Button><Button type="submit" form="location-master-form" loading={saving}>{record?.kind === 'district' ? 'Save District' : 'Save Location'}</Button></>}
      >
        {record && <form id="location-master-form" className="location-master__form" onSubmit={save}>
          {errors.form && <div className="ds-error" role="alert">{errors.form}</div>}
          {record.kind === 'location' && <SelectField label="District" required value={record.districtId} error={errors.districtId} onChange={(event) => updateRecord('districtId', event.target.value)}>
            <option value="">Select a district</option>
            {districts.filter((district) => district.active !== false || district.id === record.districtId).map((district) => <option key={district.id} value={district.id}>{district.districtName}</option>)}
          </SelectField>}
          {record.kind === 'location' && <SelectField label="Location Type" required value={record.locationType} error={errors.locationType} onChange={(event) => updateRecord('locationType', event.target.value)}><option value="">Select a type</option><option value="Corporation">Corporation</option><option value="Municipality">Municipality</option></SelectField>}
          <FormField label={record.kind === 'district' ? 'District Name' : 'Location Name'} required value={record.name} error={errors.name} onChange={(event) => updateRecord('name', event.target.value)} />
          <SelectField label="Status" value={String(record.active)} onChange={(event) => updateRecord('active', event.target.value === 'true')}><option value="true">Active</option><option value="false">Inactive</option></SelectField>
        </form>}
      </Modal>

      <ConfirmationDialog
        open={Boolean(deactivating)}
        title="Deactivate Location"
        message={deactivating ? `Deactivate ${deactivating.locationName}? This location will no longer appear in new Visit Plans. Existing plans, reports and follow-ups will remain unchanged.` : ''}
        confirmLabel="Deactivate"
        danger
        confirming={saving}
        onClose={() => setDeactivating(null)}
        onConfirm={changeStatus}
      />
    </div>
  );
};

export default MasterDataManagement;
