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
import { formatSafeDate, formatUpdateDate, getLocalDateKey, normalizeDateKey } from '../../utils/dateUtils';
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
    directorComments = [],
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

  // Keep today's KPI and schedule on the live context value. Realtime can update
  // the contents independently of the other dashboard feeds, so this derived
  // subset must not be retained behind a memoized array identity.
  const todayScheduledVisits = visitPlans.filter(
    (plan) => normalizeDateKey(plan.visitDate || plan.visit_date) === todayValue
  );

  const pendingVisitReportsList = useMemo(() => getPendingVisitReports(visitReports), [visitReports]);
  const pendingDailyReportsList = useMemo(() => getPendingDailyReports(dailyReports), [dailyReports]);

  const pendingFollowUpsList = useMemo(
    () => getPendingFollowUps(followUps),
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
        employeeName: r.fullName || r.employeeName || 'Marketing Employee',
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

  if (import.meta.env.DEV) {
    console.log('[Director Dashboard]', {
      visitPlansLength: visitPlans.length,
      todayScheduledVisitsLength: todayScheduledVisits.length,
      notificationsLength: notifications.length,
      directorCommentsLength: directorComments.length,
    });
  }

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
      <div className="hero-welcome-card director-hero">
        <div className="hero-text">
          <h2>{greeting}, {currentUser?.fullName || 'Director'} 👋</h2>
          <p>📅 {formattedDate} &nbsp;•&nbsp; Monitor your marketing team and field activities.</p>
        </div>
      </div>

      {/* 2. 4 Compact White KPI Stat Cards */}
      <div className="stat-grid dashboard-summary-grid director-kpi-row">
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
            <div className="stat-value">{pendingVisitReportsList.length}</div>
            <div className="stat-label">Pending Visit Reports</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 700 }}>
            Review Needed
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="stat-icon-wrapper purple"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingDailyReportsList.length}</div>
            <div className="stat-label">Pending Daily Reports</div>
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

      {/* 3. All four cards in a single 2-column × 2-row grid */}
      <div className="director-cards-grid">
        {/* Today's Team Field Schedule */}
        <div className="card director-fit-card">
          <div className="card-header-clean" style={{ marginBottom: '8px' }}>
            <h3 className="card-title-clean">
              <Calendar size={18} color="var(--primary-blue)" /> Today's Team Field Schedule
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/today-schedule')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {todayScheduledVisits.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 8px', color: 'var(--text-muted)' }}>
              <Calendar size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>No team field visits scheduled for today.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {todayScheduledVisits.slice(0, 3).map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--primary-dark)', fontSize: '0.84rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {plan.customerName || plan.area || 'Client Visit'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <User size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                      {plan.employeeName || 'Rep'} • {plan.visitTime || 'Scheduled'} • {plan.area || plan.district || 'Territory'}
                    </span>
                  </div>
                  <span className={`badge badge-${String(plan.status || 'planned').toLowerCase()}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>
                    {plan.status || 'Planned'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Team Updates (Vertical Activity Timeline) */}
        <div className="card director-fit-card">
          <div className="card-header-clean" style={{ marginBottom: '8px' }}>
            <h3 className="card-title-clean">
              <MessageSquare size={18} color="var(--primary-blue)" /> Recent Team Updates
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/notifications')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recentUpdatesList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 8px', color: 'var(--text-muted)' }}>
              <MessageSquare size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>No recent team updates.</span>
            </div>
          ) : (
            <div className="timeline-container" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {recentUpdatesList.map((update, idx) => {
                const formatted = formatUpdateDate(update);
                let dateDisplay = null;
                let timeDisplay = null;
                if (formatted) {
                  const parts = formatted.split(', ');
                  dateDisplay = parts[0];
                  timeDisplay = parts[1] || null;
                }

                const isLast = idx === recentUpdatesList.length - 1;

                return (
                  <div
                    key={update.id || idx}
                    className="timeline-row"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '7px 0',
                      borderBottom: isLast ? 'none' : '1px solid var(--border-color, #f1f5f9)',
                      position: 'relative',
                    }}
                  >
                    {/* Timeline node */}
                    <div className="timeline-left" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <MessageSquare size={11} />
                      </div>
                      {!isLast && (
                        <div style={{ width: '2px', position: 'absolute', top: '22px', bottom: '-7px', backgroundColor: '#E2E8F0', zIndex: 1 }} />
                      )}
                    </div>

                    {/* Title + Employee */}
                    <div className="timeline-center" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <strong style={{ color: 'var(--primary-dark, #0F172A)', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                        {update.title || update.type || 'Team Activity Update'}
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {update.employeeName || update.senderName || 'Team Member'}
                        {update.organization ? ` • ${update.organization}` : ''}
                      </span>
                    </div>

                    {/* Date & Time */}
                    {(dateDisplay || timeDisplay) && (
                      <div className="timeline-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, lineHeight: 1.25 }}>
                        {dateDisplay && (
                          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--primary-dark, #0F172A)', whiteSpace: 'nowrap' }}>
                            {dateDisplay}
                          </span>
                        )}
                        {timeDisplay && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', whiteSpace: 'nowrap' }}>
                            {timeDisplay}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Reports */}
        <div className="card director-fit-card">
          <div className="card-header-clean" style={{ marginBottom: '8px' }}>
            <h3 className="card-title-clean">
              <FileText size={18} color="var(--primary-blue)" /> Pending Visit Reports
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/visit-reports')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {pendingVisitReportsList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 8px', color: 'var(--text-muted)' }}>
              <FileText size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>No pending reports for review.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pendingVisitReportsList.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {r.fullName || r.employeeName || 'Marketing Employee'} • {formatSafeDate(r.reportDate || r.visitDate || r.submittedAt)}
                  </span>
                  <span className="badge badge-planned" style={{ fontSize: '0.7rem', flexShrink: 0 }}>Pending Review</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups Due */}
        <div className="card director-fit-card">
          <div className="card-header-clean" style={{ marginBottom: '8px' }}>
            <h3 className="card-title-clean">
              <Clock size={18} color="var(--primary-blue)" /> Follow-ups Due
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/director/follow-ups')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {pendingFollowUpsList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 8px', color: 'var(--text-muted)' }}>
              <Clock size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>No follow-ups due.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pendingFollowUpsList.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {f.customerName || 'Client Follow-up'} • {formatSafeDate(f.followUpDate || f.dueDate)}
                  </span>
                  <span className="badge badge-started" style={{ fontSize: '0.7rem', flexShrink: 0 }}>Action Due</span>
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

