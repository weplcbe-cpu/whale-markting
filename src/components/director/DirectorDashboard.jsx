import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatSafeDate } from '../../utils/dateUtils';

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

  const now = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = formatSafeDate(now);

  // Metrics
  const marketingTeamCount = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    ).length;
  }, [users]);

  const todayScheduledVisits = useMemo(
    () => visitPlans.filter((plan) => plan.visitDate === todayValue),
    [visitPlans, todayValue]
  );

  const pendingReportsList = useMemo(() => {
    const all = [...dailyReports, ...visitReports];
    return all.filter((r) => !['approved', 'completed'].includes(String(r.status).toLowerCase()));
  }, [dailyReports, visitReports]);

  const pendingFollowUpsList = useMemo(
    () => followUps.filter((item) => String(item.status).toLowerCase() !== 'completed'),
    [followUps]
  );

  // Deduplicated Recent Team Updates (max 4 distinct items with valid dates)
  const recentUpdatesList = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const notif of notifications) {
      const key = `${notif.title || notif.type}-${notif.message || notif.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(notif);
      }
      if (result.length >= 4) break;
    }
    return result;
  }, [notifications]);

  if (dataLoading && !lastUpdated) {
    return (
      <div className="marketing-dashboard director-dashboard">
        <div className="hero-welcome-card" style={{ opacity: 0.7 }}>
          <div className="hero-text">
            <h2>Loading Director Portal…</h2>
            <p>Fetching latest field activities</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-dashboard director-dashboard">
      {/* 1. Simple Welcome Banner (No Duplicate Action Buttons) */}
      <div className="hero-welcome-card">
        <div className="hero-text">
          <h2>{greeting}, {currentUser?.fullName || 'Director'} 👋</h2>
          <p>📅 {formattedDate} &nbsp;•&nbsp; Monitor your marketing team and field activities.</p>
        </div>
      </div>

      {/* 2. 4 Compact White KPI Stat Cards */}
      <div className="stat-grid dashboard-summary-grid">
        <div className="stat-card" onClick={() => navigate('/director/team')}>
          <div className="stat-icon-wrapper blue"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{marketingTeamCount}</div>
            <div className="stat-label">Total Marketing Team</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            <TrendingUp size={12} /> Active Reps
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="stat-icon-wrapper orange"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{todayScheduledVisits.length}</div>
            <div className="stat-label">Today Visits</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--action-orange)', fontWeight: 700 }}>
            Scheduled Today
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="stat-icon-wrapper purple"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingReportsList.length}</div>
            <div className="stat-label">Pending Reports</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 700 }}>
            Review Needed
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="stat-icon-wrapper green"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingFollowUpsList.length}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            Action Required
          </div>
        </div>
      </div>

      {/* 3. Main Content: Today's Team Field Schedule & Recent Team Updates */}
      <div className="dashboard-main-grid" style={{ marginBottom: '16px' }}>
        {/* Today's Team Field Schedule */}
        <div className="card dashboard-schedule-card" style={{ minHeight: '180px', maxHeight: '230px', overflow: 'hidden' }}>
          <div className="card-header-clean" style={{ marginBottom: '12px' }}>
            <h3 className="card-title-clean">
              <Calendar size={20} color="var(--primary-blue)" /> Today's Team Field Schedule
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/today-schedule')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {todayScheduledVisits.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 8px', color: 'var(--text-muted)' }}>
              <Calendar size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>No team field visits scheduled for today.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayScheduledVisits.slice(0, 4).map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--primary-dark)', fontSize: '0.9rem', display: 'block' }}>
                      {plan.customerName || plan.area || 'Client Visit'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <User size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      {plan.employeeName || 'Rep'} • {plan.visitTime || 'Scheduled'} • {plan.area || plan.district || 'Territory'}
                    </span>
                  </div>
                  <span className={`badge badge-${String(plan.status || 'planned').toLowerCase()}`}>
                    {plan.status || 'Planned'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Team Updates */}
        <div className="card dashboard-feedback-card" style={{ minHeight: '180px', maxHeight: '230px', overflow: 'hidden' }}>
          <div className="card-header-clean" style={{ marginBottom: '12px' }}>
            <h3 className="card-title-clean">
              <MessageSquare size={20} color="var(--primary-blue)" /> Recent Team Updates
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/notifications')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recentUpdatesList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 8px', color: 'var(--text-muted)' }}>
              <MessageSquare size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>No recent team activity updates.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentUpdatesList.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--primary-dark)', fontSize: '0.86rem', display: 'block' }}>
                      {notif.title || notif.type || 'Team Activity Update'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {notif.employeeName || notif.senderName || 'Team Member'} {notif.area ? `• ${notif.area}` : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatSafeDate(notif.created_at || notif.timestamp || notif.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Second Row: Pending Reports & Follow-ups Due */}
      <div className="dashboard-main-grid">
        {/* Pending Reports */}
        <div className="card" style={{ minHeight: '160px' }}>
          <div className="card-header-clean" style={{ marginBottom: '12px' }}>
            <h3 className="card-title-clean">
              <FileText size={20} color="var(--primary-blue)" /> Pending Reports
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/daily-reports')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {pendingReportsList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 8px', color: 'var(--text-muted)' }}>
              <FileText size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>No pending reports for review.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingReportsList.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary-dark)' }}>
                    {r.employeeName || 'Rep Report'} • {formatSafeDate(r.reportDate || r.visitDate || r.submittedAt)}
                  </span>
                  <span className="badge badge-planned" style={{ fontSize: '0.72rem' }}>Pending Review</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups Due */}
        <div className="card" style={{ minHeight: '160px' }}>
          <div className="card-header-clean" style={{ marginBottom: '12px' }}>
            <h3 className="card-title-clean">
              <Clock size={20} color="var(--primary-blue)" /> Follow-ups Due
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/follow-ups')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {pendingFollowUpsList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 8px', color: 'var(--text-muted)' }}>
              <Clock size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>No follow-ups due.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingFollowUpsList.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary-dark)' }}>
                    {f.customerName || 'Client Follow-up'} • {formatSafeDate(f.followUpDate || f.dueDate)}
                  </span>
                  <span className="badge badge-started" style={{ fontSize: '0.72rem' }}>Action Due</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;






