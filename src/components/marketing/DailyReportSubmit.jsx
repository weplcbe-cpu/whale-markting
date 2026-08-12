import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { Button, PageHeader } from '../ui';

export const DailyReportSubmit = () => {
  const {
    currentUser,
    visitPlans,
    dailyReports,
    followUps,
    submitDailyReport
  } = useApp();
  const navigate = useNavigate();

  const empId = currentUser?.employeeId || 'EMP001';
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [formData, setFormData] = useState({
    date: todayStr,
    importantDiscussion: '',
    pendingActions: '',
    tomorrowPlan: '',
    remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Check if a report already exists for the selected date
  const existingReportForDate = useMemo(() => {
    if (!formData.date) return null;
    return dailyReports.find(
      (r) =>
        r.employeeId === empId &&
        (r.date === formData.date || r.reportDate === formData.date || r.submittedAt?.slice(0, 10) === formData.date)
    ) || null;
  }, [dailyReports, empId, formData.date]);

  // Calculations for current selected date
  const targetVisits = visitPlans.filter((p) => p.employeeId === empId && p.visitDate === formData.date);
  const plannedCount = targetVisits.length;
  const completedCount = targetVisits.filter((p) => p.status === 'Completed').length;
  const cancelledCount = targetVisits.filter((p) => p.status === 'Cancelled').length;
  const followupsCompletedCount = followUps.filter((f) => f.employeeId === empId && f.status === 'Completed').length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || existingReportForDate) return;

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

      const saved = await submitDailyReport(payload);
      setSubmitting(false);

      // Reset form state after DB success
      setFormData({
        date: todayStr,
        importantDiscussion: '',
        pendingActions: '',
        tomorrowPlan: '',
        remarks: ''
      });

      // Navigate immediately to My Daily Reports page / new report details
      if (saved?.id) {
        navigate(`/marketing/reports/daily/${saved.id}`, { replace: true });
      } else {
        navigate('/marketing/reports/daily', { replace: true });
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="ds-page" style={{ maxWidth: '750px', margin: '0 auto' }}>
      <PageHeader
        title="Submit Daily Summary Report"
        description="Outline your field activities, discussions, and tomorrow's tour plan."
        actions={
          <Button variant="secondary" onClick={() => navigate('/marketing/reports/daily')}>
            <ArrowLeft size={16} /> Back to My Reports
          </Button>
        }
      />

      <div className="card kw-glass-card">
        {/* Date Selector Row */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">Report Date *</label>
          <input
            type="date"
            className="form-input"
            style={{ maxWidth: '220px' }}
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        {/* Auto Calculated Summary Cards for Selected Date */}
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

        {/* DUPLICATE REPORT PREVENTION CHECK */}
        {existingReportForDate ? (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--text-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} color="#34d399" />
              <strong style={{ fontSize: '1rem' }}>
                Daily report already submitted for {formData.date}.
              </strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
              You have already submitted a daily report for this date. Duplicate submissions for the same date are not allowed.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Button onClick={() => navigate(`/marketing/reports/daily/${existingReportForDate.id}`)}>
                View Submitted Report
              </Button>
              <Button variant="secondary" onClick={() => navigate('/marketing/reports/daily')}>
                Back to My Reports
              </Button>
            </div>
          </div>
        ) : (
          /* FORM ONLY */
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Important Key Discussions *</label>
              <textarea
                className="form-textarea"
                required
                rows={4}
                placeholder="Highlight key municipal/corporate discussions held today..."
                value={formData.importantDiscussion}
                onChange={(e) => setFormData({ ...formData, importantDiscussion: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Pending Actions / Urgent Tasks</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Detail pending quotation submissions or customer queries..."
                value={formData.pendingActions}
                onChange={(e) => setFormData({ ...formData, pendingActions: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tomorrow's Tour Plan</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Outline target clients & areas for tomorrow..."
                value={formData.tomorrowPlan}
                onChange={(e) => setFormData({ ...formData, tomorrowPlan: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" type="button" onClick={() => navigate('/marketing/reports/daily')} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                <Save size={16} /> {submitting ? 'Submitting...' : 'Submit Daily Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DailyReportSubmit;
