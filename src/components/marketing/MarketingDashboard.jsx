import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getMarketingRouteById } from '../../routes';
import { Calendar, CheckCircle2, Clock, PlusCircle, MessageSquare, ArrowRight, TrendingUp } from 'lucide-react';
import { normalizePlanStatus } from '../../utils/planStatus';

export const MarketingDashboard = () => {
  const { currentUser, visitPlans, followUps, directorComments } = useApp();
  const navigate = useNavigate();
  const goTo = (id, search = '') => navigate(`${getMarketingRouteById(id).path}${search}`);

  const empId = currentUser?.employeeId || 'EMP001';
  const empName = currentUser?.employeeName || 'Fathima Begum';

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const myTodayVisits = visitPlans.filter(p => p.employeeId === empId && (p.visitDate === '2026-07-21' || p.visitDate === new Date().toISOString().split('T')[0]));
  const myPendingFollowups = followUps.filter(f => f.employeeId === empId && f.status === 'Pending');
  const mySubmittedPlans = visitPlans.filter(p => p.employeeId === empId && normalizePlanStatus(p.status) === 'Submitted').length;

  const myDirectorComments = directorComments.filter(c => c.employeeId === empId);
  const feedbackPreview = [
    ...myDirectorComments.filter((item) => !item.isRead),
    ...myDirectorComments.filter((item) => item.isRead),
  ].slice(0, 3);

  return (
    <div className="marketing-dashboard">
      {/* Dashboard Hero Section (#27187E → #758BFD) */}
      <div className="hero-welcome-card">
        <div className="hero-text">
          <h2>Good Morning, {empName} 👋</h2>
          <p>📅 {todayStr} &nbsp;•&nbsp; Ready for today's field marketing visits?</p>
        </div>

        {/* Quick Action Buttons */}
        <div className="hero-actions">
          <button className="btn btn-action" onClick={() => goTo('visits', '?action=add-visit-plan')}>
            <PlusCircle size={18} /> + Add Visit Plan
          </button>

          <button className="btn btn-secondary" onClick={() => goTo('reports')}>
            <Clock size={18} /> Submit Daily Report
          </button>

          <button className="btn btn-secondary" onClick={() => goTo('follow-ups')}><Clock size={18} /> Add Follow-up</button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stat-grid dashboard-summary-grid">
        <div className="stat-card" onClick={() => goTo('visits', '?view=today')}>
          <div className="stat-icon-wrapper orange"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myTodayVisits.length}</div>
            <div className="stat-label">Today Visits</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            <TrendingUp size={12} /> Active
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('visits', '?view=plans')}>
          <div className="stat-icon-wrapper blue"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{mySubmittedPlans}</div>
            <div className="stat-label">Submitted Plans</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 700 }}>
            Saved
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('follow-ups')}>
          <div className="stat-icon-wrapper orange"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myPendingFollowups.length}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--action-orange)', fontWeight: 700 }}>
            Due Soon
          </div>
        </div>

        <button type="button" className="stat-card" onClick={() => goTo('director-comments')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myDirectorComments.length}</div>
            <div className="stat-label">Director Comments</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            Total feedback
          </div>
        </button>

      </div>

      {/* Main Grid: Today's Schedule & Director Feedback */}
      <div className="dashboard-main-grid">
        {/* Today's Schedule */}
        <div className="card dashboard-schedule-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Calendar size={20} color="var(--primary-blue)" /> Today's Field Visit Schedule</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('visits', '?view=today')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {myTodayVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No field visits scheduled for today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {myTodayVisits.map(v => (
                <div
                  key={v.id}
                  className="dashboard-visit-card"
                  style={{
                    padding: '18px 22px',
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="dashboard-visit-card__header">
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                      🕒 {v.expectedTime}
                    </span>
                    <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                  </div>

                  <h4 style={{ color: 'var(--primary-dark)', fontSize: '1.2rem', marginBottom: '6px', fontWeight: 800 }}>{v.customerName}</h4>
                  <p className="dashboard-visit-card__details">
                    Purpose: <strong>{v.visitPurpose}</strong> &nbsp;|&nbsp; Product: <strong>{Array.isArray(v.products) ? v.products.join(', ') : v.products}</strong>
                  </p>

                  <button className="btn btn-action btn-sm" onClick={() => goTo('visits', '?view=today')}>
                    Update Visit Status
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Director Feedback Side Card */}
        <div className="card dashboard-feedback-panel">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><MessageSquare size={20} color="var(--action-orange)" /> Director Feedback</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('director-comments')}>View All</button>
          </div>

          {myDirectorComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments received yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {feedbackPreview.map(com => (
                <button
                  type="button"
                  key={com.id}
                  className={`dashboard-feedback-card ${com.isRead ? '' : 'is-unread'}`}
                  onClick={() => goTo('director-comments', `?feedbackId=${encodeURIComponent(com.id)}`)}
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 134, 0, 0.08)',
                    border: '1.5px solid rgba(255, 134, 0, 0.3)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div className="dashboard-feedback-card__title">
                    {com.directorName} · {com.targetType}
                  </div>
                  <div className="dashboard-feedback-card__meta"><span>{com.commentType}</span><time>{com.createdAt ? new Date(com.createdAt).toLocaleString('en-IN') : 'Date unavailable'}</time></div>
                  <div className="dashboard-feedback-card__message">{com.message}</div>
                  {!com.isRead && <span className="director-feedback-unread">Unread</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingDashboard;
