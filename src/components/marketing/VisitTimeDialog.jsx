import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { to12HourTime, to24HourTime } from '../../utils/timeUtils';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

const parseTime = (value) => {
  const match = to12HourTime(value).match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
  return match ? { hour: match[1], minute: match[2], period: match[3] } : { hour: '12', minute: '00', period: 'AM' };
};

export const VisitTimeDialog = ({ value, onCancel, onConfirm }) => {
  const [step, setStep] = useState('hour');
  const [draft, setDraft] = useState(() => parseTime(value));
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const modalBody = document.querySelector('.ds-modal--visit-plan .ds-modal__body');
    const previousBodyOverflow = document.body.style.overflow;
    const previousModalOverflow = modalBody?.style.overflow;
    document.body.style.overflow = 'hidden';
    if (modalBody) modalBody.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
      if (modalBody) modalBody.style.overflow = previousModalOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel]);

  const values = step === 'hour' ? HOURS : MINUTES;
  const selected = step === 'hour' ? draft.hour : draft.minute;
  const handAngle = step === 'hour'
    ? (Number(draft.hour) % 12) * 30
    : (Number(draft.minute) / 5) * 30;
  const displayTime = to12HourTime(`${draft.hour}:${draft.minute} ${draft.period}`);

  const selectValue = (nextValue) => {
    if (step === 'hour') {
      setDraft((current) => ({ ...current, hour: nextValue }));
      setStep('minute');
      return;
    }
    setDraft((current) => ({ ...current, minute: nextValue }));
  };

  const confirm = () => onConfirm(to24HourTime(displayTime));

  return createPortal(
    <div className="clock-dialog-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        ref={dialogRef}
        className="clock-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="clock-dialog-header">
          <h3 id={titleId}>Select Visit Time</h3>
          <button type="button" aria-label="Close time picker" onClick={onCancel}><X size={18} /></button>
        </header>

        <div className="clock-dialog-display" aria-live="polite">
          <button type="button" className={step === 'hour' ? 'selected' : ''} onClick={() => setStep('hour')} aria-label="Select hour">{draft.hour}</button>
          <span>:</span>
          <button type="button" className={step === 'minute' ? 'selected' : ''} onClick={() => setStep('minute')} aria-label="Select minute">{draft.minute}</button>
          <strong>{draft.period}</strong>
        </div>

        <div className="clock-dialog-face" aria-label={step === 'hour' ? 'Choose an hour' : 'Choose minutes'}>
          <span className="clock-dialog-hand" style={{ transform: `translateX(-50%) rotate(${handAngle}deg)` }} aria-hidden="true" />
          <span className="clock-dialog-center" aria-hidden="true" />
          {values.map((item, index) => {
            const angle = step === 'hour' ? (Number(item) % 12) * 30 : index * 30;
            return (
              <button
                type="button"
                key={item}
                className={selected === item ? 'selected' : ''}
                style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(var(--clock-dialog-size) * -0.42)) rotate(${-angle}deg)` }}
                aria-label={step === 'hour' ? `${Number(item)} o'clock` : `${item} minutes`}
                aria-pressed={selected === item}
                onClick={() => selectValue(item)}
              >
                {step === 'hour' ? Number(item) : item}
              </button>
            );
          })}
        </div>

        <div className="clock-dialog-period" role="group" aria-label="AM or PM">
          {['AM', 'PM'].map((period) => (
            <button
              type="button"
              key={period}
              className={draft.period === period ? 'selected' : ''}
              aria-pressed={draft.period === period}
              onClick={() => setDraft((current) => ({ ...current, period }))}
            >
              {period}
            </button>
          ))}
        </div>

        <footer className="clock-dialog-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={confirm}>Set Time</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default VisitTimeDialog;
