import React from 'react';

export const COMPANY_LOGO_SRC = '/whale-enterprise-logo.png';

export const CompanyLogo = ({ className = '', ...props }) => (
  <img
    src={COMPANY_LOGO_SRC}
    alt="Whale Enterprise company logo"
    className={`company-logo ${className}`.trim()}
    {...props}
  />
);

export const BrandedLoadingScreen = ({ label = 'Loading application…' }) => (
  <div className="app-loading-screen" role="status" aria-live="polite">
    <CompanyLogo className="app-loading-logo" />
    <span>{label}</span>
  </div>
);
