import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle, MapPin, Radar, TrendingUp } from 'lucide-react';
import { ModalPortal } from '../ui';
import { CompanyLogo } from '../common/CompanyLogo';

export const LoginPage = () => {
  const { login, requestPasswordReset } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const nextFieldErrors = { email: '', password: '' };
    if (!email.trim()) nextFieldErrors.email = 'Email is required';
    if (!password.trim()) nextFieldErrors.password = 'Password is required';
    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.email || nextFieldErrors.password) {
      return;
    }

    setIsSubmitting(true);
    let res;
    try {
      res = await login(email, password);
    } catch (error) {
      res = { success: false, error: error?.message || 'Login failed. Please try again.' };
    } finally {
      setIsSubmitting(false);
    }
    if (!res.success) {
      setErrorMessage(res.error);
    }
  };

  const openResetModal = () => {
    setResetEmail(email.trim());
    setResetMessage('');
    setForgotModalOpen(true);
  };

  const handlePasswordReset = async () => {
    setResetMessage('');
    setIsResetting(true);
    const res = await requestPasswordReset(resetEmail);
    setIsResetting(false);
    if (!res.success) {
      setResetMessage(res.error);
      return;
    }
    setResetMessage('Reset link sent. Check your inbox, then use the link to set a new password.');
  };

  return (
    <div className="kw-login-page">
      {/* Left brand panel */}
      <div className="kw-login-left">
        <div className="kw-login-left-glow kw-login-left-glow-1" />
        <div className="kw-login-left-glow kw-login-left-glow-2" />
        <div className="kw-login-left-grid" />

        <div className="kw-login-left-content">
          <div className="kw-login-logo-badge">
            <CompanyLogo className="kw-login-logo-img" />
          </div>

          <h1 className="kw-login-left-heading">Marketing Visit Management</h1>
          <p className="kw-login-left-system-text">Official Field Sales &amp; Tour Planning System</p>
          <p className="kw-login-left-tagline">Plan smarter. Visit better. Grow faster.</p>

          <ul className="kw-login-features">
            <li className="kw-login-feature-item">
              <span className="kw-login-feature-icon"><MapPin size={18} /></span>
              <span>Field Visit Planning</span>
            </li>
            <li className="kw-login-feature-item">
              <span className="kw-login-feature-icon"><Radar size={18} /></span>
              <span>Live Team Tracking</span>
            </li>
            <li className="kw-login-feature-item">
              <span className="kw-login-feature-icon"><TrendingUp size={18} /></span>
              <span>Sales Performance Insights</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className="kw-login-right">
        <div className="kw-login-card">
          <div className="kw-login-card-logo">
            <CompanyLogo />
          </div>

          <h2 className="kw-login-card-title">Welcome Back</h2>
          <p className="kw-login-card-subtitle">Sign in to continue to your dashboard</p>

          {errorMessage && (
            <div className="kw-login-alert" role="alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="kw-form-group">
              <label className="kw-form-label" htmlFor="kw-login-email">Email Address</label>
              <div className={`kw-input-wrap ${fieldErrors.email ? 'has-error' : ''}`}>
                <span className="kw-input-icon"><Mail size={18} /></span>
                <input
                  id="kw-login-email"
                  type="email"
                  className="kw-input"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby="kw-login-email-error"
                />
              </div>
              {fieldErrors.email && (
                <span className="kw-field-error" id="kw-login-email-error">{fieldErrors.email}</span>
              )}
            </div>

            <div className="kw-form-group">
              <label className="kw-form-label" htmlFor="kw-login-password">Password</label>
              <div className={`kw-input-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
                <span className="kw-input-icon"><Lock size={18} /></span>
                <input
                  id="kw-login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="kw-input"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="kw-login-password-error"
                />
                <button
                  type="button"
                  className="kw-input-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                  aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span className="kw-field-error" id="kw-login-password-error">{fieldErrors.password}</span>
              )}
            </div>

            <div className="kw-login-options-row">
              <label className="kw-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a
                href="#forgot"
                className="kw-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  openResetModal();
                }}
              >
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="kw-login-submit-btn" disabled={isSubmitting}>
              <Lock size={18} /> {isSubmitting ? 'SIGNING IN...' : 'LOGIN'}
            </button>
          </form>

          <p className="kw-login-footer">
            © 2026 Whale Enterprise PVT Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <ModalPortal onClose={() => setForgotModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Enter your account email and we will send a secure reset link if the account exists.
              </p>
              <div className="kw-form-group" style={{ marginBottom: '12px' }}>
                <label className="kw-form-label" htmlFor="kw-reset-email">Email Address</label>
                <input
                  id="kw-reset-email"
                  type="email"
                  className="kw-input"
                  placeholder="Enter your registered email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {resetMessage && (
                <div className="kw-login-alert" role="status" style={{ marginBottom: '12px' }}>
                  <span>{resetMessage}</span>
                </div>
              )}
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <strong>Need help?</strong> Contact your system administrator if you do not receive the reset email.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePasswordReset} disabled={isResetting}>
                {isResetting ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button className="btn btn-secondary" onClick={() => setForgotModalOpen(false)}>Close</button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
