import React, { useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { Button, FormField, PageHeader, SectionCard } from '../ui';

const provided = (value) => value || 'Not provided';
export const ProfilePage = () => {
  const { currentUser, showToast } = useApp();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const handleSave = async (event) => { event.preventDefault(); if (!currentUser || isSaving) return; if (form.next.length < 8) { showToast('New password must contain at least 8 characters', 'error'); return; } if (form.next !== form.confirm) { showToast('New passwords do not match', 'error'); return; } setIsSaving(true); const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: form.current }); if (verifyError) { setIsSaving(false); showToast('Current password is incorrect', 'error'); return; } const { error } = await supabase.auth.updateUser({ password: form.next }); setIsSaving(false); if (error) { showToast(error.message || 'Failed to update password', 'error'); return; } setForm({ current: '', next: '', confirm: '' }); showToast('Password updated successfully', 'success'); };
  const fields = { 'Full Name': currentUser?.fullName || currentUser?.employeeName || currentUser?.username, 'Employee ID': currentUser?.employeeId, 'Mobile Number': currentUser?.mobileNumber || currentUser?.mobile, Email: currentUser?.email, Role: currentUser?.role, Department: currentUser?.department, Designation: currentUser?.designation, Status: currentUser?.status };
  return <div className="ds-page profile-page"><PageHeader title="My Profile" description="Your employee details and account security." /><SectionCard title="Employee Profile"><div className="director-detail-grid">{Object.entries(fields).map(([label, value]) => <div key={label}><small>{label}</small><strong>{provided(value)}</strong></div>)}</div></SectionCard><SectionCard title="Change Password" description="Use at least 8 characters. Your current password is required for verification."><form className="ds-form-grid" onSubmit={handleSave}><FormField label="Current Password" type={showPasswords ? 'text' : 'password'} required autoComplete="current-password" value={form.current} onChange={(event) => update('current', event.target.value)} /><FormField label="New Password" type={showPasswords ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={form.next} onChange={(event) => update('next', event.target.value)} hint="Minimum 8 characters" /><FormField label="Confirm Password" type={showPasswords ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={form.confirm} onChange={(event) => update('confirm', event.target.value)} /><div className="ds-sticky-actions"><Button type="button" variant="secondary" onClick={() => setShowPasswords((current) => !current)}>{showPasswords ? <EyeOff size={16} /> : <Eye size={16} />} {showPasswords ? 'Hide' : 'Show'} Passwords</Button><Button type="submit" loading={isSaving}><Save size={16} /> Update Password</Button></div></form></SectionCard></div>;
};
export default ProfilePage;
