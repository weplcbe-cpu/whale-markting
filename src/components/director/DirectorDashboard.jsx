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
import { formatSafeDate, formatUpdateDate } from '../../utils/dateUtils';

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
    directorComments = [],
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

  // Normalized & Deduplicated Recent Team Updates (from 5 update sources)
  const recentUpdatesList = useMemo(() => {
    const list = [];

    // 1. Notifications
    (notifications || []).forEach((n) => {
      list.push({
        id: `notif-${n.id || Math.random()}`,
        title: n.title || n.type || 'Notification Update',
        employeeName: n.employeeName || n.senderName || n.userLabel || 'Marketing Rep',
        organization: n.area || n.district || '',
        createdAt: n.createdAt || n.created_at || n.timestamp,
        ...n,
      });
    });

    // 2. Visit Plans
    (visitPlans || []).forEach((p) => {
      list.push({
        id: `plan-${p.id}`,
        title: `Visit Plan: ${p.area || p.customerName || 'Field Visit'}`,
        employeeName: p.employeeName || 'Marketing Rep',
        organization: p.customerName || p.area || p.district || '',
        createdAt: p.submittedAt || p.submitted_at || p.createdAt || p.created_at || p.visitDate || p.visit_date,
        ...p,
      });
    });

    // 3. Daily & Visit Reports
    [...(dailyReports || []), ...(visitReports || [])].forEach((r) => {
      list.push({
        id: `report-${r.id}`,
        title: `Daily Report Submitted`,
        employeeName: r.employeeName || 'Marketing Rep',
        organization: r.area || r.district || '',
        createdAt: r.submittedAt || r.submitted_at || r.reportDate || r.report_date || r.visitDate || r.createdAt,
        ...r,
      });
    });

    // 4. Follow-ups
    (followUps || []).forEach((f) => {
      list.push({
        id: `fol-${f.id}`,
        title: `Follow-up: ${f.customerName || 'Client Follow-up'}`,
        employeeName: f.employeeName || 'Marketing Rep',
        organization: f.customerName || f.area || '',
        createdAt: f.updatedAt || f.updated_at || f.createdAt || f.created_at || f.followUpDate || f.follow_up_date,
        ...f,
      });
    });

    // 5. Director Comments
    (directorComments || []).forEach((c) => {
      list.push({
        id: `comment-${c.id}`,
        title: `Director Comment: ${c.targetType || 'Feedback'}`,
        employeeName: c.authorName || c.employeeName || 'Director',
        organization: c.area || c.comment || '',
        createdAt: c.createdAt || c.created_at || c.timestamp,
        ...c,
      });
    });

    // Sort descending by timestamp
    list.sort((a, b) => {
      const candidateA = a.createdAt || a.created_at || a.submittedAt || a.submitted_at || a.visitDate || a.reportDate || a.followUpDate || a.timestamp;
      const candidateB = b.createdAt || b.created_at || b.submittedAt || b.submitted_at || b.visitDate || b.reportDate || b.followUpDate || b.timestamp;
      const timeA = candidateA ? new Date(candidateA).getTime() : 0;
      const timeB = candidateB ? new Date(candidateB).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const item of list) {
      const key = `${item.title}-${item.employeeName}-${item.createdAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
      if (unique.length >= 4) break;
    }

    return unique;
  }, [notifications, visitPlans, dailyReports, visitReports, followUps, directorComments]);

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
              {recentUpdatesList.map((update) => {
                const dateStr = formatUpdateDate(update);
                return (
                  <div
                    key={update.id}
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
                        {update.title || update.type || 'Team Activity Update'}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {update.employeeName || update.senderName || 'Team Member'} {update.organization ? `• ${update.organization}` : ''}
                      </span>
                    </div>
                    {dateStr ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </span>
                    ) : null}
                  </div>
                );
              })}
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






