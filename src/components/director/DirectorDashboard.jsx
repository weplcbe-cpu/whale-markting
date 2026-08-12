import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatSafeDate, getLocalDateKey, normalizeDateKey } from '../../utils/dateUtils';
import { filterActiveNotifications } from '../../utils/notificationUtils';
import { getPendingDailyReports, getPendingFollowUps, getPendingVisitReports } from '../../utils/reportSelectors';

export const DirectorDashboard = () => {
  const navigate = useNavigate();

  const {
    currentUser,
    users = [],
    visitPlans = [],
    visitReports = [],
    dailyReports = [],
    followUps = [],
    notifications = [],
    dataLoading,
    lastUpdated,
  } = useApp();

  const now = new Date();
  const todayValue = getLocalDateKey(now);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = formatSafeDate(now);

  // Metrics
  const marketingTeamCount = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    ).length;
  }, [users]);

  const todayScheduledVisits = visitPlans.filter(
    (plan) => normalizeDateKey(plan.visitDate || plan.visit_date) === todayValue
  );

  const pendingVisitReportsList = useMemo(() => getPendingVisitReports(visitReports), [visitReports]);
  const pendingDailyReportsList = useMemo(() => getPendingDailyReports(dailyReports), [dailyReports]);
  const pendingFollowUpsList = useMemo(() => getPendingFollowUps(followUps), [followUps]);
  const completedVisits = todayScheduledVisits.filter(p => p.status === 'Completed').length;

  // Normalized Recent Team Updates (from notifications, plans, reports)
  const recentUpdatesList = useMemo(() => {
    const list = [];
    filterActiveNotifications(notifications || []).forEach((n) => {
      list.push({
        id: `notif-${n.id || Math.random()}`,
        action: n.title || n.type || 'Team Notification',
        userLabel: n.employeeName || n.senderName || 'Marketing Rep',
        timestamp: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        rawTime: n.createdAt ? new Date(n.createdAt).getTime() : 0,
      });
    });
    (visitPlans || []).slice(0, 5).forEach((p) => {
      list.push({
        id: `plan-${p.id}`,
        action: `Visit Plan: ${p.customerName || p.area || 'Field Visit'} (${p.status || 'Planned'})`,
        userLabel: p.employeeName || 'Marketing Rep',
        timestamp: p.visitTime || p.expectedTime || 'Today',
        rawTime: 100,
      });
    });
    [...(dailyReports || []), ...(visitReports || [])].slice(0, 5).forEach((r) => {
      list.push({
        id: `report-${r.id}`,
        action: `Daily Report Submitted`,
        userLabel: r.fullName || r.employeeName || 'Marketing Employee',
        timestamp: 'Today',
        rawTime: 200,
      });
    });

    list.sort((a, b) => b.rawTime - a.rawTime);
    return list.slice(0, 5);
  }, [notifications, visitPlans, dailyReports, visitReports]);

  if (dataLoading && !lastUpdated) {
    return (
      <div className="admin-dashboard director-dashboard">
        <div className="hero-welcome-card kw-glass-card" style={{ opacity: 0.7, padding: '24px' }}>
          <div className="hero-text">
            <h2>Loading Director Portal…</h2>
            <p>Fetching latest field activities</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard director-dashboard">
      {/* Hero Welcome Banner */}
      <div className="hero-welcome-card director-hero kw-glass-card" style={{ marginBottom: '20px', padding: '24px 28px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div className="hero-text">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0' }}>{greeting}, {currentUser?.fullName || 'Director'} 👋</h2>
          <p style={{ margin: 0, fontSize: '0.92rem', opacity: 0.85 }}>📅 {formattedDate} &nbsp;•&nbsp; Executive overview of marketing team performance &amp; field schedules.</p>
        </div>

        <div className="hero-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn ds-button ds-button--primary" onClick={() => navigate('/director/today-schedule')}>
            <Calendar size={16} /> Today's Schedule
          </button>
          <button className="btn ds-button ds-button--secondary" onClick={() => navigate('/director/daily-reports')}>
            <FileText size={16} /> Review Reports
          </button>
          <button className="btn ds-button ds-button--secondary" onClick={() => navigate('/director/team')}>
            <Users size={16} /> Team Roster
          </button>
        </div>
      </div>

      {/* Master KPI Stat Cards Row */}
      <div className="stat-grid">
        <div className="stat-card kw-glass-card" onClick={() => navigate('/director/team')}>
          <div className="stat-icon-wrapper blue"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{marketingTeamCount}</div>
            <div className="stat-label">Marketing Team Members</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="stat-icon-wrapper amber"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{todayScheduledVisits.length}</div>
            <div className="stat-label">Today Team Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{completedVisits}</div>
            <div className="stat-label">Completed Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="stat-icon-wrapper purple"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingVisitReportsList.length + pendingDailyReportsList.length}</div>
            <div className="stat-label">Pending Reports Review</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="stat-icon-wrapper rose"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingFollowUpsList.length}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Team Schedule & Recent Team Updates */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Today's Team Field Schedule Oversight */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Calendar size={18} color="var(--primary-blue)" /> Today's Team Field Schedule</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/director/today-schedule')}>
              View All Schedule <ArrowRight size={14} />
            </button>
          </div>

          {todayScheduledVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, padding: '16px 0' }}>No team field visits scheduled for today.</p>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Marketing Rep</th>
                    <th>Time</th>
                    <th>Customer / Organization</th>
                    <th>Purpose / Location</th>
                    <th>Product</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayScheduledVisits.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.employeeName || 'Rep'}</strong></td>
                      <td>{v.expectedTime || v.visitTime || '—'}</td>
                      <td><strong>{v.customerName || v.area || 'Client Visit'}</strong></td>
                      <td>{v.visitPurpose || v.district || 'Field Visit'}</td>
                      <td>{Array.isArray(v.products) ? v.products.join(', ') : (v.products || '—')}</td>
                      <td>
                        <span className={`badge badge-${(v.status || 'planned').toLowerCase()}`}>{v.status || 'Planned'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Team Updates Stream */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Clock size={18} color="var(--action-orange)" /> Recent Team Updates</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/director/notifications')}>Activity</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentUpdatesList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No recent team updates.</p>
            ) : (
              recentUpdatesList.map(log => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--kw-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--color-primary)'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.action}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{log.userLabel}</span>
                    <span>{log.timestamp}</span>
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

export default DirectorDashboard;
