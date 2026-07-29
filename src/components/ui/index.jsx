import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Inbox, LoaderCircle, X } from 'lucide-react';
import { useModalLayer } from './modalLayer';

export const ModalPortal = ({ open = true, children, className = '', onClose, closeOnBackdrop = true, closeOnEscape = closeOnBackdrop }) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  useModalLayer(open);
  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => {
      (dialogRef.current?.querySelector('input, select, textarea, button') || dialogRef.current)?.focus?.();
    });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [closeOnEscape, onClose, open]);
  if (!open) return null;
  const dialog = React.cloneElement(React.Children.only(children), {
    ref: dialogRef,
    role: children.props.role || 'dialog',
    'aria-modal': children.props['aria-modal'] || 'true',
    tabIndex: children.props.tabIndex ?? -1
  });
  return createPortal(
    <div
      className={`modal-overlay ${className}`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      {dialog}
    </div>,
    document.body
  );
};

const FieldLabel = ({ htmlFor, label, required }) => <label htmlFor={htmlFor}>{label}{required && <span className="ds-required" aria-hidden="true"> *</span>}</label>;

export const PageHeader = ({ title, description, actions }) => (
  <div className="ds-page-header">
    <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {actions && <div className="ds-page-actions">{actions}</div>}
  </div>
);

export const SectionCard = ({ title, description, actions, children, className = '' }) => (
  <section className={`ds-section-card ${className}`}>
    {(title || actions) && <header className="ds-section-card__header"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{actions}</header>}
    <div className="ds-section-card__body">{children}</div>
  </section>
);

export const FormField = ({ label, hint, error, id, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return <div className={`ds-field ${className}`}><FieldLabel htmlFor={inputId} label={label} required={props.required} /><input id={inputId} {...props} />{hint && <small>{hint}</small>}{error && <span className="ds-field__error">{error}</span>}</div>;
};

export const SelectField = ({ label, hint, error, id, children, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return <div className={`ds-field ${className}`}><FieldLabel htmlFor={inputId} label={label} required={props.required} /><select id={inputId} {...props}>{children}</select>{hint && <small>{hint}</small>}{error && <span className="ds-field__error">{error}</span>}</div>;
};

export const DateField = (props) => <FormField type="date" {...props} />;

export const TextArea = ({ label, hint, error, id, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return <div className={`ds-field ${className}`}><FieldLabel htmlFor={inputId} label={label} required={props.required} /><textarea id={inputId} {...props} />{hint && <small>{hint}</small>}{error && <span className="ds-field__error">{error}</span>}</div>;
};

export const Button = ({ variant = 'primary', loading = false, children, className = '', disabled, ...props }) => (
  <button className={`ds-button ds-button--${variant} ${className}`} disabled={disabled || loading} {...props}>
    {loading && <LoaderCircle size={16} className="ds-spin" aria-hidden="true" />}{children}
  </button>
);

export const Badge = ({ tone = 'neutral', children }) => <span className={`ds-badge ds-badge--${tone}`}>{children}</span>;

export const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) => (
  <div className="ds-empty"><Icon size={32} aria-hidden="true" /><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>
);

export const LoadingState = ({ label = 'Loading…' }) => <div className="ds-state"><LoaderCircle className="ds-spin" aria-hidden="true" />{label}</div>;
export const ErrorBanner = ({ children, action }) => <div className="ds-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{children}</span>{action}</div>;

export const Modal = ({ open, title, subtitle, children, footer, onClose, dirty = false, closeLabel = 'Close dialog', size = 'md' }) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  useModalLayer(open);
  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!dirty || window.confirm('Discard your unsaved changes?')) onClose(); return; }
      if (event.key === 'Tab') { const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]; if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector('input, select, textarea, button')?.focus());
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [dirty, onClose, open]);

  if (!open) return null;
  const requestClose = () => { if (!dirty || window.confirm('Discard your unsaved changes?')) onClose(); };
  return createPortal(
    <div className="ds-modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !dirty) requestClose();
    }}>
      <section ref={dialogRef} className={`ds-modal ds-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ds-modal__header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="ds-icon-button" onClick={requestClose} aria-label={closeLabel}><X size={20} /></button></header>
        <div className="ds-modal__body">{children}</div>
        {footer && <footer className="ds-modal__footer">{footer}</footer>}
      </section>
    </div>, document.body
  );
};

export const Drawer = (props) => <Modal {...props} size="drawer" />;

export const Stepper = ({ steps, current }) => { const progress = Math.round(((current + 1) / steps.length) * 100); return <div className="ds-progress"><div className="ds-progress__meta"><strong>Step {current + 1} of {steps.length}</strong><span>{progress}%</span></div><div className="ds-progress__bar"><span style={{ width: `${progress}%` }} /></div><ol className="ds-stepper" aria-label={`Step ${current + 1} of ${steps.length}`}>{steps.map((step, index) => <li key={step} className={index < current ? 'complete' : index === current ? 'current' : 'pending'}><span>{index < current ? <Check size={18} /> : index + 1}</span><strong>{step}</strong></li>)}</ol></div>; };

export const DataTable = ({ columns, rows, rowKey = 'id', empty, caption }) => rows.length === 0 ? (empty || <EmptyState />) : (
  <div className="ds-table-wrap"><table className="ds-table">{caption && <caption className="sr-only">{caption}</caption>}<thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[rowKey]}>{columns.map(column => <td key={column.key} data-label={column.label}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
);

export const ConfirmationDialog = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onClose, danger = false, confirming = false }) => <Modal open={open} title={title} onClose={confirming ? () => {} : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={confirming}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={confirming}>{confirming ? 'Deleting…' : confirmLabel}</Button></>}><p>{message}</p></Modal>;
