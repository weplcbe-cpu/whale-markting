import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, Clock, Edit3, Lock, Save } from 'lucide-react';
import { Button, Modal } from '../ui';

export const DailyReportSubmit = () => {
  const {
    currentUser,
    visitPlans,
    dailyReports,
    followUps,
    submitDailyReport,
    updateDailyReport,
    companyInfo
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const empId = currentUser?.employeeId || 'EMP001';
  const todayStr = new Date().toISOString().split('T')[0];

  const reportIdFromUrl = searchParams.get('reportId');
  const closeRelated = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('reportId');
    setSearchParams(next, { replace: true });
  };

  // Form State
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [formData, setFormData] = useState({
    date: todayStr,
    importantDiscussion: '',
    pendingActions: '',
    tomorrowPlan: '',
    remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync selectedDate with formData.date
  const handleDateChange = (dateValue) => {
    setSelectedDate(dateValue);
    setFormData((prev) => ({ ...prev, date: dateValue }));
    setIsEditing(false);
  };

  // Locate existing report for the current employee and selected date / URL reportId
  const existingReport = useMemo(() => {
    if (reportIdFromUrl) {
      const matched = dailyReports.find(
        (r) => String(r.id) === String(reportIdFromUrl) && r.employeeId === empId
      );
      if (matched) return matched;
    }
    return dailyReports.find(
      (r) => r.employeeId === empId && (r.date === selectedDate || r.reportDate === selectedDate || r.submittedAt?.slice(0, 10) === selectedDate)
    ) || null;
  }, [dailyReports, empId, reportIdFromUrl, selectedDate]);

  // Calculations for current selected date
  const targetDateStr = existingReport?.date || selectedDate;
  const targetVisits = visitPlans.filter((p) => p.employeeId === empId && p.visitDate === targetDateStr);
  const plannedCount = existingReport?.plannedVisits ?? targetVisits.length;
  const completedCount = existingReport?.completedVisits ?? targetVisits.filter((p) => p.status === 'Completed').length;
  const cancelledCount = existingReport?.cancelledVisits ?? targetVisits.filter((p) => p.status === 'Cancelled').length;
  const followupsCompletedCount = existingReport?.followUpsCompleted ?? followUps.filter((f) => f.employeeId === empId && f.status === 'Completed').length;

  // 24-Hour Edit Time Limit Rule
  const limitHours = companyInfo?.reportEditTimeLimitHours ?? 24;
  const isLocked = Boolean(existingReport?.isLocked || existingReport?.status === 'Locked');
  const submittedTimestamp = existingReport ? new Date(existingReport.submittedAt || existingReport.createdAt || existingReport.date).getTime() : NaN;
  const isWithinEditLimit = !isNaN(submittedTimestamp) ? (Date.now() - submittedTimestamp) <= (limitHours * 3600 * 1000) : true;
  const canEdit = Boolean(existingReport) && !isLocked && isWithinEditLimit;

  // Prepare edit form when user clicks "Edit Report"
  const startEditing = () => {
    if (!existingReport || !canEdit) return;
    setFormData({
      date: existingReport.date || selectedDate,
      importantDiscussion: existingReport.importantDiscussion || '',
      pendingActions: existingReport.pendingActions || '',
      tomorrowPlan: existingReport.tomorrowPlan || '',
      remarks: existingReport.remarks || ''
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        plannedVisits: plannedCount,
        completedVisits: completedCount,
        cancelledVisits: cancelledCount,
        followUpsCompleted: followupsCompletedCount,
        importantDiscussion: formData.importantDiscussion.trim(),
        pendingActions: formData.pendingActions?.trim() || null,
        tomorrowPlan: formData.tomorrowPlan?.trim() || null,
        remarks: formData.remarks?.trim() || null
      };

      let saved;
      if (isEditing && existingReport?.id) {
        saved = await updateDailyReport(existingReport.id, payload);
      } else {
        saved = await submitDailyReport(payload);
      }

      setSubmitting(false);
      setIsEditing(false);

      if (saved?.id) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('reportId', String(saved.id));
        setSearchParams(nextParams, { replace: true });
      }
    } catch {
      setSubmitting(false);
    }
  };

  // Determine whether to render View mode or Form mode
  const showViewMode = Boolean(existingReport) && !isEditing;

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="card">
        {/* Header */}
        <div className="card-header-clean" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title-clean">
            <Clock size={18} color="var(--accent-cyan)" />
            {showViewMode ? 'Daily Summary Report' : isEditing ? 'Edit Daily Summary Report' : 'Submit Daily Summary Report'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showViewMode && (
              <span className={`badge ${isLocked ? 'badge-rejected' : 'badge-completed'}`}>
                {isLocked ? 'Locked' : 'Submitted'}
              </span>
            )}
            <span className="badge badge-planned">Edit Limit: {limitHours} Hours</span>
          </div>
        </div>

        {/* Status Notice Banner when report exists */}
        {showViewMode && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-md)',
              background: isLocked
                ? 'rgba(244, 63, 94, 0.1)'
                : isWithinEditLimit
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${
                isLocked
                  ? 'rgba(244, 63, 94, 0.3)'
                  : isWithinEditLimit
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(245, 158, 11, 0.3)'
              }`,
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLocked ? (
                <Lock size={16} color="#fb7185" />
              ) : isWithinEditLimit ? (
                <CheckCircle2 size={16} color="#34d399" />
              ) : (
                <Clock size={16} color="#fbbf24" />
              )}
              <span>
                {isLocked
                  ? 'This daily report has been locked by Admin and cannot be modified.'
                  : isWithinEditLimit
                  ? `Daily report submitted for ${existingReport.date || selectedDate}. You can edit it within ${limitHours} hours of submission.`
                  : `The ${limitHours}-hour edit window for this report has expired. Report is read-only.`}
              </span>
            </div>

            {canEdit && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={startEditing}>
                <Edit3 size={14} /> Edit Report
              </button>
            )}
          </div>
        )}

        {/* Date Selector Row if not locked into a URL reportId */}
        {!reportIdFromUrl && (
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Report Date</label>
            <input
              type="date"
              className="form-input"
              style={{ maxWidth: '220px' }}
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>
        )}

        {/* Auto Calculated Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Planned</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{plannedCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#34d399' }}>Completed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{completedCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#fb7185' }}>Cancelled</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fb7185' }}>{cancelledCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#c084fc' }}>Follow-ups</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c084fc' }}>{followupsCompletedCount}</div>
          </div>
        </div>

        {/* VIEW MODE */}
        {showViewMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Important Key Discussions</div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                {existingReport.importantDiscussion}
              </p>
            </div>

            {existingReport.pendingActions && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Pending Actions / Urgent Tasks</div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {existingReport.pendingActions}
                </p>
              </div>
            )}

            {existingReport.tomorrowPlan && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Tomorrow's Tour Plan</div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {existingReport.tomorrowPlan}
                </p>
              </div>
            )}

            {existingReport.remarks && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Remarks / Internal Notes</div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {existingReport.remarks}
                </p>
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Submitted at: {existingReport.submittedAt ? new Date(existingReport.submittedAt).toLocaleString('en-IN') : 'Not available'}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {canEdit && (
                <button type="button" className="btn btn-primary" onClick={startEditing}>
                  <Edit3 size={16} /> Edit Report
                </button>
              )}
            </div>
          </div>
        ) : (
          /* EDIT / FORM MODE */
          <form onSubmit={handleSubmit}>
            {!reportIdFromUrl && (
              <div className="form-group">
                <label className="form-label">Report Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Important Key Discussions *</label>
              <textarea
                className="form-textarea"
                required
                rows={3}
                placeholder="Highlight key municipal/corporate discussions held today..."
                value={formData.importantDiscussion}
                onChange={(e) => setFormData({ ...formData, importantDiscussion: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Pending Actions / Urgent Tasks</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Detail pending quotation submissions or customer queries..."
                value={formData.pendingActions}
                onChange={(e) => setFormData({ ...formData, pendingActions: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tomorrow's Tour Plan</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Outline target clients & areas for tomorrow..."
                value={formData.tomorrowPlan}
                onChange={(e) => setFormData({ ...formData, tomorrowPlan: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {isEditing && (
                <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={submitting}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Save size={16} /> {submitting ? (isEditing ? 'Updating...' : 'Submitting...') : isEditing ? 'Update Daily Report' : 'Submit Daily Report'}
              </button>
            </div>
          </form>
        )}
      </div>

      {reportIdFromUrl && !existingReport ? (
        <Modal open title="Report Details" onClose={closeRelated} footer={<Button variant="secondary" onClick={closeRelated}>Close</Button>}>
          <div className="ds-error">This related record was deleted or is not available.</div>
        </Modal>
      ) : null}
    </div>
  );
};

export default DailyReportSubmit;
