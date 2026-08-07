import React, { useMemo, useState } from 'react';
import { BellRing, BriefcaseBusiness, Eye, EyeOff, IdCard, Mail, Phone, Save, ShieldCheck, UserRound, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui';

const provided = (value) => value || 'Not provided';
export const ProfilePage = () => {
  const {
    currentUser,
    showToast,
    desktopNotificationPermission,
    requestDesktopNotificationPermission,
    notificationSoundEnabled,
    setNotificationSoundEnabled,
    testNotificationExperience,
  } = useApp();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [isSaving, setIsSaving] = useState(false);
  const [inlineNotice, setInlineNotice] = useState({ type: '', message: '' });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const profile = useMemo(() => {
    const fullName = currentUser?.fullName || currentUser?.employeeName || currentUser?.username;
    const employeeId = currentUser?.employeeId;
    const mobileNumber = currentUser?.mobileNumber || currentUser?.mobile;
    const email = currentUser?.email;
    const role = currentUser?.role;
    const department = currentUser?.department;
    const designation = currentUser?.designation;
    const status = currentUser?.status;
    const initial = (fullName || '?').trim().charAt(0).toUpperCase() || '?';
    return {
      fullName,
      employeeId,
      mobileNumber,
      email,
      role,
      department,
      designation,
      status,
      initial
    };
  }, [currentUser]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!currentUser || isSaving) return;
    setInlineNotice({ type: '', message: '' });

    if (form.next.length < 8) {
      const message = 'New password must contain at least 8 characters';
      setInlineNotice({ type: 'error', message });
      showToast(message, 'error');
      return;
    }
    if (form.next !== form.confirm) {
      const message = 'New passwords do not match';
      setInlineNotice({ type: 'error', message });
      showToast(message, 'error');
      return;
    }

    setIsSaving(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: form.current
    });
    if (verifyError) {
      setIsSaving(false);
      const message = 'Current password is incorrect';
      setInlineNotice({ type: 'error', message });
      showToast(message, 'error');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: form.next });
    setIsSaving(false);
    if (error) {
      const message = error.message || 'Failed to update password';
      setInlineNotice({ type: 'error', message });
      showToast(message, 'error');
      return;
    }

    setForm({ current: '', next: '', confirm: '' });
    setInlineNotice({ type: 'success', message: 'Password updated successfully' });
    showToast('Password updated successfully', 'success');
  };

  const togglePassword = (field) => {
    setShowPasswords((current) => ({
      ...current,
      [field]: !current[field]
    }));
  };

  const enableDesktopNotifications = async () => {
    const permission = await requestDesktopNotificationPermission();
    if (permission === 'granted') {
      showToast('Desktop notifications enabled.', 'success');
      return;
    }
    if (permission === 'denied') {
      showToast('Desktop notifications were blocked by browser settings.', 'warning');
      return;
    }
    showToast('Desktop notifications are not supported in this browser.', 'error');
  };

  const desktopLabel = desktopNotificationPermission === 'granted'
    ? 'Enabled'
    : desktopNotificationPermission === 'denied'
      ? 'Disabled'
      : desktopNotificationPermission === 'default'
        ? 'Not enabled'
        : 'Unsupported';

  return (
    <div className="ds-page profile-page mp-profile-page">
      <div className="mp-profile-shell">
        <section className="mp-profile-hero" aria-labelledby="profile-hero-title">
          <div className="mp-profile-hero-main">
            <div className="mp-profile-avatar" aria-hidden="true">{profile.initial}</div>
            <div className="mp-profile-identity">
              <h1 id="profile-hero-title">{provided(profile.fullName)}</h1>
              <p>{provided(profile.designation)}</p>
              <div className="mp-profile-meta-row">
                <span>{provided(profile.employeeId)}</span>
                <span>{provided(profile.role)}</span>
              </div>
            </div>
          </div>
          <div className="mp-profile-hero-side">
            <span className="mp-status-badge" role="status" aria-label={`Status: ${provided(profile.status)}`}>
              <span className="mp-status-dot" aria-hidden="true" />
              Status: {provided(profile.status)}
            </span>
            <small>{provided(profile.department)}</small>
          </div>
        </section>

        <section className="mp-profile-info-layout" aria-label="Employee details">
          <article className="mp-profile-card" aria-labelledby="personal-contact-title">
            <header className="mp-card-header">
              <h2 id="personal-contact-title">Personal &amp; Contact Information</h2>
            </header>
            <div className="mp-detail-grid mp-detail-grid--personal">
              <div className="mp-detail-item">
                <span className="mp-detail-label"><UserRound size={14} aria-hidden="true" /> Full Name</span>
                <strong className="mp-detail-value">{provided(profile.fullName)}</strong>
              </div>
              <div className="mp-detail-item">
                <span className="mp-detail-label"><IdCard size={14} aria-hidden="true" /> Employee ID</span>
                <strong className="mp-detail-value">{provided(profile.employeeId)}</strong>
              </div>
              <div className="mp-detail-item">
                <span className="mp-detail-label"><Phone size={14} aria-hidden="true" /> Mobile Number</span>
                <strong className="mp-detail-value">{provided(profile.mobileNumber)}</strong>
              </div>
              <div className="mp-detail-item">
                <span className="mp-detail-label"><Mail size={14} aria-hidden="true" /> Email</span>
                <strong className="mp-detail-value mp-detail-value--email">{provided(profile.email)}</strong>
              </div>
            </div>
          </article>

          <article className="mp-profile-card" aria-labelledby="work-info-title">
            <header className="mp-card-header">
              <h2 id="work-info-title">Work Information</h2>
            </header>
            <div className="mp-detail-grid mp-detail-grid--work">
              <div className="mp-tile">
                <span className="mp-detail-label"><BriefcaseBusiness size={14} aria-hidden="true" /> Role</span>
                <strong className="mp-detail-value">{provided(profile.role)}</strong>
                <span className="mp-chip mp-chip--role">{provided(profile.role)}</span>
              </div>
              <div className="mp-tile">
                <span className="mp-detail-label">Department</span>
                <strong className="mp-detail-value">{provided(profile.department)}</strong>
              </div>
              <div className="mp-tile">
                <span className="mp-detail-label">Designation</span>
                <strong className="mp-detail-value">{provided(profile.designation)}</strong>
              </div>
              <div className="mp-tile">
                <span className="mp-detail-label">Status</span>
                <strong className="mp-detail-value">{provided(profile.status)}</strong>
                <span className="mp-chip mp-chip--status">Status: {provided(profile.status)}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="mp-profile-card mp-security-card" aria-labelledby="security-title">
          <header className="mp-card-header">
            <h2 id="security-title"><ShieldCheck size={18} aria-hidden="true" /> Security</h2>
            <p>Change your account password.</p>
          </header>

          <form className="mp-security-form" onSubmit={handleSave}>
            <div className="mp-password-field">
              <label htmlFor="current-password">Current Password</label>
              <div className="mp-password-input-wrap">
                <input
                  id="current-password"
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.current}
                  onChange={(event) => update('current', event.target.value)}
                />
                <button
                  type="button"
                  className="mp-password-toggle"
                  onClick={() => togglePassword('current')}
                  aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                >
                  {showPasswords.current ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="mp-password-field">
              <label htmlFor="new-password">New Password</label>
              <div className="mp-password-input-wrap">
                <input
                  id="new-password"
                  type={showPasswords.next ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.next}
                  onChange={(event) => update('next', event.target.value)}
                />
                <button
                  type="button"
                  className="mp-password-toggle"
                  onClick={() => togglePassword('next')}
                  aria-label={showPasswords.next ? 'Hide password' : 'Show password'}
                >
                  {showPasswords.next ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              <small>Password must contain at least 8 characters.</small>
            </div>

            <div className="mp-password-field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <div className="mp-password-input-wrap">
                <input
                  id="confirm-password"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(event) => update('confirm', event.target.value)}
                />
                <button
                  type="button"
                  className="mp-password-toggle"
                  onClick={() => togglePassword('confirm')}
                  aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                >
                  {showPasswords.confirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {inlineNotice.message && (
              <div
                className={`mp-security-banner mp-security-banner--${inlineNotice.type === 'success' ? 'success' : 'error'}`}
                role="status"
                aria-live="polite"
              >
                {inlineNotice.type === 'success' ? '✓ ' : ''}
                {inlineNotice.message}
              </div>
            )}

            <div className="mp-security-actions">
              <Button type="submit" loading={isSaving} className="mp-security-submit">
                <Save size={16} aria-hidden="true" /> {isSaving ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </section>

        <section className="mp-profile-card" aria-labelledby="notification-settings-title">
          <header className="mp-card-header">
            <h2 id="notification-settings-title"><BellRing size={18} aria-hidden="true" /> Notification Settings</h2>
            <p>Enable desktop alerts and control notification sound.</p>
          </header>
          <div className="mp-notification-settings">
            <div className="mp-setting-row">
              <div>
                <strong>Desktop Notifications</strong>
                <p>Status: {desktopLabel}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={enableDesktopNotifications}
                disabled={desktopNotificationPermission === 'granted' || desktopNotificationPermission === 'unsupported'}
              >
                Enable Notifications
              </Button>
            </div>

            <div className="mp-setting-row">
              <div>
                <strong>Notification Sound</strong>
                <p>{notificationSoundEnabled ? 'On' : 'Off'}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNotificationSoundEnabled(!notificationSoundEnabled)}
              >
                {notificationSoundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                {notificationSoundEnabled ? 'Sound On' : 'Sound Off'}
              </Button>
            </div>

            <div className="mp-setting-row">
              <div>
                <strong>Test Notification</strong>
                <p>Local preview only. No database record will be created.</p>
              </div>
              <Button type="button" onClick={() => testNotificationExperience()}>
                Test Notification
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
export default ProfilePage;
