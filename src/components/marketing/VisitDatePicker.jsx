import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_WIDTH = 320;
const CALENDAR_FALLBACK_HEIGHT = 360;
const VIEWPORT_PADDING = 12;
const CALENDAR_GAP = 8;
const MOBILE_BREAKPOINT = 640;
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
  const popoverRef = useRef(null);
  const dayRefs = useRef(new Map());
  const selected = parseDateKey(value);
  const minimum = parseDateKey(min) || parseDateKey(localDateKey());
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('below');
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
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

  const computePlacement = useCallback(() => {
    if (!open) return;
    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    if (!triggerBounds) return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobileLayout(mobile);
    if (mobile) {
      setPlacement('mobile');
      setPopoverStyle({});
      return;
    }

    const panelWidth = Math.min(CALENDAR_WIDTH, window.innerWidth - (VIEWPORT_PADDING * 2));
    const panelHeight = popoverRef.current?.offsetHeight || CALENDAR_FALLBACK_HEIGHT;
    const spaceBelow = window.innerHeight - triggerBounds.bottom - VIEWPORT_PADDING;
    const spaceAbove = triggerBounds.top - VIEWPORT_PADDING;
    const openAbove = spaceBelow < (panelHeight + CALENDAR_GAP) && spaceAbove > (panelHeight + CALENDAR_GAP);

    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - panelHeight);
    const top = openAbove
      ? Math.max(VIEWPORT_PADDING, triggerBounds.top - panelHeight - CALENDAR_GAP)
      : Math.min(maxTop, triggerBounds.bottom + CALENDAR_GAP);
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, triggerBounds.left),
      Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - panelWidth),
    );

    setPlacement(openAbove ? 'above' : 'below');
    setPopoverStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(panelWidth)}px`,
    });
  }, [open]);

  const openCalendar = () => {
    const startingDate = selected || minimum;
    setVisibleMonth(startingDate);
    setFocusedKey(localDateKey(startingDate));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const modalBody = document.querySelector('.ds-modal--visit-plan .ds-modal__body');
    const previousBodyOverflow = document.body.style.overflow;
    const previousModalOverflow = modalBody?.style.overflow;
    const previousModalScrollTop = modalBody?.scrollTop ?? 0;
    document.body.style.overflow = 'hidden';
    if (modalBody) modalBody.style.overflow = 'hidden';

    const timer = window.requestAnimationFrame(() => {
      computePlacement();
      dayRefs.current.get(focusedKey)?.focus();
    });
    const recalc = () => computePlacement();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);

    return () => {
      window.cancelAnimationFrame(timer);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
      document.body.style.overflow = previousBodyOverflow;
      if (modalBody) {
        modalBody.style.overflow = previousModalOverflow;
        modalBody.scrollTop = previousModalScrollTop;
      }
    };
  }, [computePlacement, focusedKey, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [open]);

  useEffect(() => {
    if (!open || isMobileLayout) return undefined;
    const timer = window.requestAnimationFrame(() => dayRefs.current.get(focusedKey)?.focus());
    return () => window.cancelAnimationFrame(timer);
  }, [focusedKey, isMobileLayout, open, visibleMonth]);

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

  const calendar = open ? (
    <div className="visit-date-layer" role="presentation">
      <button className="visit-date-backdrop" type="button" aria-label="Close calendar" onClick={close} />
      <div
        ref={popoverRef}
        className={`visit-date-popover visit-date-popover--${isMobileLayout ? 'mobile' : placement}`}
        style={isMobileLayout ? undefined : popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose visit date"
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-7); }
          if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(7); }
        }}
      >
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
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="visit-date-picker">
      <button ref={triggerRef} type="button" className={`visit-date-trigger${error ? ' visit-date-trigger--error' : ''}`} aria-label={`Visit Date, ${displayDate(value)}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => open ? close() : openCalendar()}>
        <CalendarDays size={19} aria-hidden="true" /><span>{displayDate(value)}</span>
      </button>
      {open && createPortal(calendar, document.body)}
    </div>
  );
};

export default VisitDatePicker;
