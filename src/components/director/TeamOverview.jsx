import React, { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button, DataTable, EmptyState, FormField, PageHeader, SectionCard, SelectField } from '../ui';
import { EntityDetailsModal } from '../common/details';
import { getDistrictCoverage, getEmployeeAssignedDistricts, getEmployeeAssignedLocalBodies, getTerritoryCoverage } from '../../utils/territorySelectors';

export const TeamOverview = () => {
  const { users, visitPlans, visitReports, dailyReports, followUps, directorComments, territoryAssignments, lastUpdated } = useApp();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('This Week');
  const [selected, setSelected] = useState(null);
  const marketing = useMemo(() => users.filter((user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active').filter((user) => `${user.fullName || user.employeeName || ''} ${user.employeeId || ''} ${user.designation || ''}`.toLowerCase().includes(search.toLowerCase())), [search, users]);
  const metrics = (employeeId) => { const plans = visitPlans.filter((item) => item.employeeId === employeeId); return { today: plans.filter((item) => item.visitDate === new Date().toISOString().slice(0, 10)).length, plans: plans.length, completed: plans.filter((item) => String(item.status).toLowerCase() === 'completed').length, followups: followUps.filter((item) => item.employeeId === employeeId && String(item.status).toLowerCase() === 'pending').length }; };
  const columns = [{ key: 'name', label: 'Employee', render: (row) => <><strong>{row.fullName || row.employeeName || row.username || 'Not provided'}</strong><small>{row.employeeId || 'Not provided'} · {row.designation || 'Not provided'}</small></> }, { key: 'contact', label: 'Contact', render: (row) => <>{row.mobileNumber || row.mobile || 'Not provided'}<small>{row.email || 'Not provided'}</small></> }, { key: 'today', label: 'Today Visits', render: (row) => metrics(row.employeeId).today }, { key: 'weekly', label: 'Plans', render: (row) => metrics(row.employeeId).plans }, { key: 'completed', label: 'Completed', render: (row) => metrics(row.employeeId).completed }, { key: 'followups', label: 'Pending Follow-ups', render: (row) => metrics(row.employeeId).followups }, { key: 'action', label: 'Action', render: (row) => <Button variant="secondary" onClick={() => setSelected(row)}>View Details</Button> }];
  const selectedMetrics = selected ? metrics(selected.employeeId) : null;
  const selectedAssignments = selected ? getEmployeeAssignedLocalBodies(territoryAssignments, selected.employeeId) : [];
  const selectedDistricts = selected ? getEmployeeAssignedDistricts(territoryAssignments, selected.employeeId) : [];
  const territoryCoverage = selected ? getTerritoryCoverage(territoryAssignments, visitPlans, selected.employeeId, 'monthly') : null;
  const districtRows = selectedDistricts.map((district) => {
    const assigned = selectedAssignments.filter((assignment) => assignment.districtId === district.id);
    const names = new Set(assigned.map((assignment) => assignment.localBodyName));
    const plans = visitPlans.filter((plan) => plan.employeeId === selected.employeeId && plan.district === district.districtName && new Date(plan.visitDate).getMonth() === new Date().getMonth());
    const completed = plans.filter((plan) => String(plan.status).toLowerCase() === 'completed').length;
    const coverage = getDistrictCoverage(territoryAssignments, visitPlans, selected.employeeId, district.id, 'monthly');
    return { id: district.id, district: district.districtName, assigned: names.size, planned: plans.length, completed, pending: Math.max(0, names.size - completed), coverage: coverage.percentage };
  });
  return <div className="ds-page"><PageHeader title="Marketing Team" description={`Active Marketing employees and current workload. Last updated ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not available'}.`} />
    <div className="director-filter-bar"><div className="director-search"><Search size={17} /><FormField label="Search employee" value={search} onChange={(event) => setSearch(event.target.value)} /></div><SelectField label="Period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>This Week</option><option>This Month</option></SelectField></div>
    <DataTable columns={columns} rows={marketing} empty={<EmptyState icon={Users} title="No active Marketing employees found" description="Clear the search or refresh the portal data." action={<Button onClick={() => setSearch('')}>Clear Search</Button>} />} />
    {selected && selectedAssignments.length > 0 && <SectionCard title={`Assigned Territory: ${selectedAssignments[0]?.zone?.zoneName || 'Territory'}`} description={`${territoryCoverage.label}: ${territoryCoverage.percentage}%`}>
      <div className="director-detail-grid">
        <div><small>Districts</small><strong>{selectedDistricts.length}</strong></div>
        <div><small>Corporations</small><strong>{selectedAssignments.filter((assignment) => assignment.localBodyType === 'Corporation').length}</strong></div>
        <div><small>Municipalities</small><strong>{selectedAssignments.filter((assignment) => assignment.localBodyType === 'Municipality').length}</strong></div>
        <div><small>Total Locations</small><strong>{selectedAssignments.length}</strong></div>
        <div><small>Monthly Coverage</small><strong>{territoryCoverage.percentage}%</strong></div>
      </div>
      <DataTable rows={districtRows} columns={[{ key: 'district', label: 'District' }, { key: 'assigned', label: 'Assigned Locations' }, { key: 'planned', label: 'Planned' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'coverage', label: 'Coverage', render: (row) => `${row.coverage}%` }]} />
    </SectionCard>}
    <EntityDetailsModal open={Boolean(selected)} onClose={() => setSelected(null)} type="employee" entity={selected ? { ...selected, metrics: { ...selectedMetrics, visitReports: visitReports.filter((item) => item.employeeId === selected.employeeId).length, dailyReports: dailyReports.filter((item) => item.employeeId === selected.employeeId).length, comments: directorComments.filter((item) => item.targetEmployeeId === selected.employeeId).length } } : null} />
  </div>;
};
export default TeamOverview;
