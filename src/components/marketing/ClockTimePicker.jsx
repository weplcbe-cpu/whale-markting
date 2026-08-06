import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoPlacement, autoUpdate, computePosition, offset, shift, size } from '@floating-ui/dom';
import { Clock, X } from 'lucide-react';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

export const ClockTimePicker = ({ hour, minute, period, error, onChange }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('hour');
  const [draft, setDraft] = useState({ hour, minute, period });
  const fieldRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const dialogId = useId();
  const [position, setPosition] = useState({ top: 16, left: 16 });

  useEffect(() => {
    if (!open) setDraft({ hour, minute, period });
  }, [hour, minute, open, period]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = async () => {
      if (!fieldRef.current || !dialogRef.current) return;
      try {
        const { x, y } = await computePosition(fieldRef.current, dialogRef.current, {
          strategy: 'fixed',
          middleware: [
            offset(12),
            autoPlacement({ padding: 16 }),
            shift({ padding: 16 }),
            size({
              padding: 16,
              apply({ availableWidth, availableHeight, elements }) {
                Object.assign(elements.floating.style, {
                  maxWidth: `${Math.max(0, availableWidth)}px`,
                  maxHeight: `${Math.max(0, availableHeight)}px`,
                });
              },
            }),
          ],
        });
        setPosition({ top: y, left: x });
      } catch (positionError) {
        if (import.meta.env.DEV) console.error('[ClockTimePicker] floating position failed', positionError);
      }
    };

    const modalBody = fieldRef.current?.closest('.ds-modal__body');
    const previousBodyOverflow = document.body.style.overflow;
    const previousModalOverflow = modalBody?.style.overflow;
    document.body.style.overflow = 'hidden';
    if (modalBody) modalBody.style.overflow = 'hidden';

    let frame = window.requestAnimationFrame(() => {
      updatePosition();
      dialogRef.current?.focus();
    });
    const cleanupAutoUpdate = autoUpdate(fieldRef.current, dialogRef.current, () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanupAutoUpdate();
      document.body.style.overflow = previousBodyOverflow;
      if (modalBody) modalBody.style.overflow = previousModalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const trapPickerFocus = (event) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
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
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  };

  const openPicker = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraft({ hour, minute, period });
    setStep('hour');
    setOpen(true);
  };

  const confirm = () => {
    if (!draft.hour || !draft.minute || !draft.period) return;
    onChange(draft);
    close();
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
      close();
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

  return (
    <div className="clock-time-field">
      <button
        ref={fieldRef}
        type="button"
        className={`clock-time-trigger${error ? ' clock-time-trigger--error' : ''}`}
        aria-label={`Visit Time, ${hour}:${minute} ${period}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={openPicker}
      >
        <Clock size={19} aria-hidden="true" />
        <span>{hour}:{minute} {period}</span>
      </button>

      {open && createPortal(
        <div className="clock-time-layer" role="presentation">
          <button className="clock-time-backdrop" type="button" aria-label="Close time picker" onClick={close} />
          <div
            ref={dialogRef}
            className="clock-time-popover"
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ '--clock-popover-top': `${position.top}px`, '--clock-popover-left': `${position.left}px` }}
          >
            <header className="clock-time-header"><h3 id={titleId}>Select Visit Time</h3><button type="button" onClick={close} aria-label="Close time picker"><X size={18} /></button></header>
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
              <button type="button" onClick={close}>Cancel</button>
              <button type="button" className="primary" onClick={confirm}>Set Time</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ClockTimePicker;
