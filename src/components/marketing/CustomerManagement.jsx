import React, { useMemo, useState } from 'react';
import { AlertTriangle, UserPlus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, PageHeader, SelectField, TextArea } from '../ui';

export const CustomerManagement = () => {
  const { customers, orgTypes, products, addCustomer } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const open = searchParams.get('action') === 'add-customer';
  const initialData = useMemo(() => ({ organizationName: '', organizationType: 'Municipal Corporation', contactPerson: '', mobile: '', state: 'Tamil Nadu', district: 'Coimbatore', city: 'Coimbatore', address: '', pincode: '', interestedProducts: ['Whale Super Sucker'], isTenderRelated: false, notes: '' }), []);
  const [formData, setFormData] = useState(initialData);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const close = () => { const next = new URLSearchParams(searchParams); next.delete('action'); setSearchParams(next); };
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));
  const changeName = (value) => { update('organizationName', value); const match = customers.find((item) => item.organizationName.toLowerCase().trim() === value.toLowerCase().trim()); setDuplicateWarning(match ? `Customer “${match.organizationName}” already exists in ${match.district}.` : ''); };
  const toggleProduct = (name) => update('interestedProducts', formData.interestedProducts.includes(name) ? formData.interestedProducts.filter((item) => item !== name) : [...formData.interestedProducts, name]);
  const submit = async (event) => { event.preventDefault(); if (!formData.organizationName.trim()) return; await addCustomer(formData); setFormData(initialData); setDuplicateWarning(''); close(); };
  const columns = [{ key: 'organizationName', label: 'Organization', render: (row) => <strong>{row.organizationName}</strong> }, { key: 'organizationType', label: 'Type' }, { key: 'location', label: 'District / City', render: (row) => `${row.city}, ${row.district}` }, { key: 'contact', label: 'Contact', render: (row) => `${row.contactPerson} (${row.mobile})` }, { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'Approved' ? 'success' : 'warning'}>{row.status}</Badge> }];
  return <div className="ds-page"><PageHeader title="Customers" description="Manage your customer and organization directory." actions={<Button onClick={() => setSearchParams({ action: 'add-customer' })}><UserPlus size={16} /> Add Customer</Button>} />
    <DataTable columns={columns} rows={customers} empty={<EmptyState title="No customers yet" description="Create the first customer record to start planning visits." action={<Button onClick={() => setSearchParams({ action: 'add-customer' })}>Add Customer</Button>} />} />
    <Modal open={open} onClose={close} dirty={JSON.stringify(formData) !== JSON.stringify(initialData)} title="Create New Customer" subtitle="Capture the organization and primary contact details."
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" form="customer-form">Submit Customer Record</Button></>}>
      {duplicateWarning && <div className="ds-error" role="alert"><AlertTriangle size={18} /><span>{duplicateWarning}</span></div>}
      <form id="customer-form" className="ds-form-grid" onSubmit={submit}><FormField className="ds-field--full" label="Organization Name" required value={formData.organizationName} onChange={(e) => changeName(e.target.value)} /><SelectField label="Organization Type" value={formData.organizationType} onChange={(e) => update('organizationType', e.target.value)}>{orgTypes.map((type) => <option key={type}>{type}</option>)}</SelectField><FormField label="Contact Person" required value={formData.contactPerson} onChange={(e) => update('contactPerson', e.target.value)} /><FormField label="Mobile Number" required value={formData.mobile} onChange={(e) => update('mobile', e.target.value)} /><FormField label="State" value={formData.state} onChange={(e) => update('state', e.target.value)} /><FormField label="District" value={formData.district} onChange={(e) => update('district', e.target.value)} /><FormField label="City" value={formData.city} onChange={(e) => update('city', e.target.value)} /><FormField label="Pincode" value={formData.pincode} onChange={(e) => update('pincode', e.target.value)} /><TextArea className="ds-field--full" label="Address" rows={3} value={formData.address} onChange={(e) => update('address', e.target.value)} /><fieldset className="ds-field ds-field--full"><legend>Interested Products</legend><div className="ds-choice-grid">{products.map((product) => <label className="ds-choice" key={product.id}><input type="checkbox" checked={formData.interestedProducts.includes(product.name)} onChange={() => toggleProduct(product.name)} /><span>{product.name}</span></label>)}</div></fieldset><details className="ds-more ds-field--full"><summary>More options</summary><TextArea label="Notes" rows={3} value={formData.notes} onChange={(e) => update('notes', e.target.value)} /></details></form>
    </Modal>
  </div>;
};
export default CustomerManagement;
