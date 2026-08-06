import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

export const ClockTimePicker = ({ value, onCancel, onConfirm }) => {
  const [step, setStep] = useState('hour');
  const [draft, setDraft] = useState(value);
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const trapPickerFocus = (event) => {
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
    window.addEventListener('keydown', trapPickerFocus, true);
    return () => window.removeEventListener('keydown', trapPickerFocus, true);
  }, [onCancel]);

  const confirm = () => {
    if (!draft.hour || !draft.minute || !draft.period) return;
    onConfirm(draft);
  };

  const moveValue = (direction) => {
    if (step === 'hour') {
      const current = Math.max(0, HOURS.indexOf(draft.hour));
      setDraft((value) => ({ ...value, hour: HOURS[(current + direction + HOURS.length) % HOURS.length] }));
    } else {
      const current = Math.max(0, MINUTES.indexOf(draft.minute));
      setDraft((value) => ({ ...value, minute: MINUTES[(current + direction + MINUTES.length) % MINUTES.length] }));
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.target === dialogRef.current && event.key === 'Enter') {
      event.preventDefault();
      confirm();
    } else if (event.target === dialogRef.current && ['ArrowRight', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      moveValue(1);
    } else if (event.target === dialogRef.current && ['ArrowLeft', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      moveValue(-1);
    }
  };

  const values = step === 'hour' ? HOURS : MINUTES;
  const selected = step === 'hour' ? draft.hour : draft.minute;
  const handAngle = step === 'hour'
    ? (Number(draft.hour) % 12) * 30
    : (Number(draft.minute) / 5) * 30;

  return createPortal(
    <div className="clock-time-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div
            ref={dialogRef}
            className="clock-time-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
          >
            <header className="clock-time-header"><h3 id={titleId}>Select Visit Time</h3><button type="button" onClick={onCancel} aria-label="Close time picker"><X size={18} /></button></header>
            <div className="clock-time-display" aria-live="polite">
              <button type="button" className={step === 'hour' ? 'selected' : ''} onClick={() => setStep('hour')} aria-label="Select hour">
                {draft.hour}
              </button>
              <span>:</span>
              <button type="button" className={step === 'minute' ? 'selected' : ''} onClick={() => setStep('minute')} aria-label="Select minute">
                {draft.minute}
              </button>
              <strong>{draft.period}</strong>
            </div>

            <div className="clock-face" aria-label={step === 'hour' ? 'Choose an hour' : 'Choose minutes'}>
              <span className="clock-hand" style={{ transform: `translateX(-50%) rotate(${handAngle}deg)` }} aria-hidden="true" />
              <span className="clock-center" aria-hidden="true" />
              {values.map((value, index) => {
                const angle = step === 'hour' ? (Number(value) % 12) * 30 : index * 30;
                return (
                  <button
                    type="button"
                    key={value}
                    className={selected === value ? 'selected' : ''}
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(var(--clock-face-size) * -0.42)) rotate(${-angle}deg)` }}
                    aria-label={step === 'hour' ? `${Number(value)} o'clock` : `${value} minutes`}
                    aria-pressed={selected === value}
                    onClick={() => {
                      if (step === 'hour') {
                        setDraft((current) => ({ ...current, hour: value }));
                        setStep('minute');
                      } else {
                        setDraft((current) => ({ ...current, minute: value }));
                      }
                    }}
                  >
                    {step === 'hour' ? Number(value) : value}
                  </button>
                );
              })}
            </div>

            <div className="clock-period" role="group" aria-label="AM or PM">
              {['AM', 'PM'].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={draft.period === value ? 'selected' : ''}
                  aria-pressed={draft.period === value}
                  onClick={() => setDraft((current) => ({ ...current, period: value }))}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="clock-time-actions">
              <button type="button" onClick={onCancel}>Cancel</button>
              <button type="button" className="primary" onClick={confirm}>Set Time</button>
            </div>
      </div>
    </div>,
    document.body,
  );
};

export default ClockTimePicker;
