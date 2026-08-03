import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDateKey = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};
const displayDate = (value) => {
  const date = parseDateKey(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : 'Select visit date';
};

export const VisitDatePicker = ({ value, min, error, onChange }) => {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const dayRefs = useRef(new Map());
  const selected = parseDateKey(value);
  const minimum = parseDateKey(min) || parseDateKey(localDateKey());
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('below');
  const [visibleMonth, setVisibleMonth] = useState(() => selected || minimum);
  const [focusedKey, setFocusedKey] = useState(() => localDateKey(selected || minimum));
  const todayKey = localDateKey();

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    return [
      ...Array.from({ length: new Date(year, month, 1).getDay() }, () => null),
      ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openCalendar = () => {
    const startingDate = selected || minimum;
    setVisibleMonth(startingDate);
    setFocusedKey(localDateKey(startingDate));
    const bounds = rootRef.current?.getBoundingClientRect();
    setPlacement(bounds && window.innerHeight - bounds.bottom < 380 && bounds.top > 380 ? 'above' : 'below');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.requestAnimationFrame(() => dayRefs.current.get(focusedKey)?.focus());
    return () => window.cancelAnimationFrame(timer);
  }, [focusedKey, open, visibleMonth]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const moveFocus = (amount) => {
    const current = parseDateKey(focusedKey) || selected || minimum;
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount);
    const safeNext = next < minimum ? minimum : next;
    setFocusedKey(localDateKey(safeNext));
    setVisibleMonth(new Date(safeNext.getFullYear(), safeNext.getMonth(), 1));
  };

  const selectDate = (date) => {
    onChange(localDateKey(date));
    close();
  };

  const changeMonth = (amount) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    const firstSelectable = nextMonth < new Date(minimum.getFullYear(), minimum.getMonth(), 1)
      ? minimum
      : nextMonth;
    setVisibleMonth(new Date(firstSelectable.getFullYear(), firstSelectable.getMonth(), 1));
    setFocusedKey(localDateKey(firstSelectable));
  };

  const previousDisabled = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    <= new Date(minimum.getFullYear(), minimum.getMonth(), 1);

  return (
    <div ref={rootRef} className="visit-date-picker">
      <button ref={triggerRef} type="button" className={`visit-date-trigger${error ? ' visit-date-trigger--error' : ''}`} aria-label={`Visit Date, ${displayDate(value)}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => open ? close() : openCalendar()}>
        <CalendarDays size={19} aria-hidden="true" /><span>{displayDate(value)}</span>
      </button>
      {open && <>
        <button className="visit-date-backdrop" type="button" aria-label="Close calendar" onClick={close} />
        <div className={`visit-date-popover visit-date-popover--${placement}`} role="dialog" aria-label="Choose visit date" onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-7); }
          if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(7); }
        }}>
          <div className="visit-date-header">
            <button type="button" aria-label="Previous month" disabled={previousDisabled} onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></button>
            <h3>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(visibleMonth)}</h3>
            <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={19} /></button>
          </div>
          <div className="visit-date-grid" role="grid">
            {WEEKDAYS.map((weekday) => <span key={weekday} className="visit-date-weekday" role="columnheader">{weekday}</span>)}
            {days.map((date, index) => date ? (() => {
              const key = localDateKey(date);
              const disabled = date < minimum;
              return <button ref={(node) => node ? dayRefs.current.set(key, node) : dayRefs.current.delete(key)} type="button" role="gridcell" key={key} className={`${key === value ? 'selected ' : ''}${key === todayKey ? 'today' : ''}`} disabled={disabled} tabIndex={key === focusedKey ? 0 : -1} aria-selected={key === value} aria-label={new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date)} onFocus={() => setFocusedKey(key)} onClick={() => selectDate(date)}>{date.getDate()}</button>;
            })() : <span key={`blank-${index}`} role="gridcell" aria-hidden="true" />)}
          </div>
          <button type="button" className="visit-date-today" onClick={() => selectDate(parseDateKey(todayKey))}>Today</button>
        </div>
      </>}
    </div>
  );
};

export default VisitDatePicker;
