import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getMarketingRouteById } from '../../routes';
import { Calendar, CheckCircle2, Clock, PlusCircle, MessageSquare, ArrowRight, FileText, AlertTriangle } from 'lucide-react';

export const MarketingDashboard = () => {
  const { currentUser, visitPlans = [], followUps = [], directorComments = [], dailyReports = [] } = useApp();
  const navigate = useNavigate();
  const goTo = (id, search = '') => navigate(`${getMarketingRouteById(id)?.path || '/marketing/dashboard'}${search}`);

  const empId = currentUser?.employeeId || 'EMP001';
  const empName = currentUser?.fullName || currentUser?.employeeName || 'Marketing Executive';

  const todayIso = new Date().toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const myTodayVisits = visitPlans.filter(p => p.employeeId === empId && (p.visitDate === todayIso || p.visit_date === todayIso));
  const myCompletedVisits = myTodayVisits.filter(p => p.status === 'Completed').length;
  const myPendingVisits = myTodayVisits.filter(p => ['Planned', 'Started', 'Pending'].includes(p.status)).length;
  const myPendingFollowups = followUps.filter(f => f.employeeId === empId && f.status === 'Pending').length;
  const myDirectorComments = directorComments.filter(c => c.employeeId === empId);
  const myTodayReport = dailyReports.find(r => r.employeeId === empId && (r.reportDate === todayIso || r.report_date === todayIso));
  const dailyReportStatus = myTodayReport ? (myTodayReport.status || 'Submitted') : 'Not Started';

  const feedbackPreview = [
    ...myDirectorComments.filter((item) => !item.isRead),
    ...myDirectorComments.filter((item) => item.isRead),
  ].slice(0, 5);

  return (
    <div className="admin-dashboard marketing-dashboard">
      {/* Dashboard Hero Section */}
      <div className="hero-welcome-card kw-glass-card" style={{ marginBottom: '20px', padding: '24px 28px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div className="hero-text">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0' }}>Good Morning, {empName} 👋</h2>
          <p style={{ margin: 0, fontSize: '0.92rem', opacity: 0.85 }}>📅 {todayStr} &nbsp;•&nbsp; Ready for today's field marketing visits?</p>
        </div>

        {/* Quick Action Buttons */}
        <div className="hero-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn ds-button ds-button--primary" onClick={() => goTo('visits', '?action=add-visit-plan')}>
            <PlusCircle size={16} /> + Add Visit Plan
          </button>
          <button className="btn ds-button ds-button--secondary" onClick={() => navigate('/marketing/reports/daily/submit')}>
            <FileText size={16} /> Submit Daily Report
          </button>
          <button className="btn ds-button ds-button--secondary" onClick={() => goTo('follow-ups')}>
            <Clock size={16} /> Add Follow-up
          </button>
        </div>
      </div>

      {/* Master KPI Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card kw-glass-card" onClick={() => goTo('visits', '?view=today')}>
          <div className="stat-icon-wrapper blue"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myTodayVisits.length}</div>
            <div className="stat-label">Today Visit Plans</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => goTo('visits', '?view=today')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myCompletedVisits}</div>
            <div className="stat-label">Completed Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => goTo('visits', '?view=today')}>
          <div className="stat-icon-wrapper rose"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myPendingVisits}</div>
            <div className="stat-label">Pending Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => goTo('follow-ups')}>
          <div className="stat-icon-wrapper purple"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myPendingFollowups}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => goTo('director-comments')}>
          <div className="stat-icon-wrapper amber"><MessageSquare size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myDirectorComments.length}</div>
            <div className="stat-label">Director Comments</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule Oversight & Director Feedback */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Today's Schedule Oversight */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Calendar size={18} color="var(--primary-blue)" /> Today's Field Visit Schedule</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('visits', '?view=today')}>
              View All Plans <ArrowRight size={14} />
            </button>
          </div>

          {myTodayVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, padding: '16px 0' }}>No field visits scheduled for today.</p>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Customer / Organization</th>
                    <th>Purpose</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myTodayVisits.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.expectedTime || v.visitTime || '—'}</strong></td>
                      <td><strong>{v.customerName}</strong></td>
                      <td>{v.visitPurpose}</td>
                      <td>{Array.isArray(v.products) ? v.products.join(', ') : (v.products || '—')}</td>
                      <td>
                        <span className={`badge badge-${(v.status || 'planned').toLowerCase()}`}>{v.status}</span>
                      </td>
                      <td>
                        <button className="btn ds-button ds-button--secondary btn-sm" onClick={() => goTo('visits', '?view=today')} style={{ minHeight: '32px', padding: '0 10px', fontSize: '0.78rem' }}>
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Director Feedback & Report Status Panel */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><MessageSquare size={18} color="var(--action-orange)" /> Director Feedback</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('director-comments')}>View All</button>
          </div>

          {/* Daily Report Status Banner */}
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(36, 85, 232, 0.08)', border: '1px solid rgba(36, 85, 232, 0.18)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <small style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, opacity: 0.75 }}>Today's Daily Report</small>
              <strong style={{ fontSize: '0.95rem' }}>{dailyReportStatus}</strong>
            </div>
            <span className={`badge badge-${dailyReportStatus === 'Submitted' ? 'approved' : 'planned'}`}>{dailyReportStatus}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {feedbackPreview.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No comments received yet.</p>
            ) : (
              feedbackPreview.map(com => (
                <div
                  key={com.id}
                  onClick={() => goTo('director-comments', `?feedbackId=${encodeURIComponent(com.id)}`)}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--kw-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${com.isRead ? 'var(--color-primary)' : 'var(--action-orange)'}`,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{com.directorName || 'Director'} · {com.targetType || 'Feedback'}</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px', opacity: 0.9 }}>{com.message}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{com.commentType}</span>
                    <span>{com.createdAt ? new Date(com.createdAt).toLocaleDateString('en-IN') : 'Recent'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingDashboard;
