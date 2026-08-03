import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
const formatDate = (value) => {
  const date = parseDate(value);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : 'Select follow-up date';
};

export const CalendarDatePicker = ({ value, min, open, onOpenChange, onChange }) => {
  const triggerRef = useRef(null);
  const selectedDate = parseDate(value);
  const minDate = parseDate(min) || new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || minDate);

  useEffect(() => {
    if (open) setVisibleMonth(parseDate(value) || parseDate(min) || new Date());
  }, [open, value, min]);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [open]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    return [
      ...Array.from({ length: new Date(year, month, 1).getDay() }, () => null),
      ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const close = () => {
    onOpenChange(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  const previousMonthDisabled = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    <= new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  return (
    <div className="complete-calendar-field">
      <button ref={triggerRef} type="button" className="complete-calendar-trigger" aria-label={`Follow-up Date, ${formatDate(value)}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <CalendarDays size={19} aria-hidden="true" /><span>{formatDate(value)}</span>
      </button>
      {open && (
        <div className="complete-calendar-popover" role="dialog" aria-label="Choose follow-up date" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
          <div className="complete-calendar-header">
            <button type="button" aria-label="Previous month" disabled={previousMonthDisabled} onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <strong>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="complete-calendar-grid" role="grid">
            {WEEKDAYS.map((weekday) => <span key={weekday} className="complete-calendar-weekday">{weekday}</span>)}
            {days.map((date, index) => date ? (
              <button type="button" key={toDateKey(date)} className={toDateKey(date) === value ? 'selected' : ''} disabled={date < minDay} aria-label={new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date)} aria-selected={toDateKey(date) === value} onClick={() => { onChange(toDateKey(date)); close(); }}>{date.getDate()}</button>
            ) : <span key={`blank-${index}`} aria-hidden="true" />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDatePicker;
