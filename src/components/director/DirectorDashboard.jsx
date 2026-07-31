import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  MapPin,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';

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
    lastUpdated,
    dataLoading,
  } = useApp();

  const now = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Marketing Team
  const marketingTeam = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    );
  }, [users]);

  // Summaries
  const todayScheduledVisits = useMemo(() => visitPlans.filter((plan) => plan.visitDate === todayValue), [visitPlans, todayValue]);
  const completedPlans = useMemo(() => visitPlans.filter((plan) => normalizePlanStatus(plan.status) === 'Completed'), [visitPlans]);
  const pendingVisits = useMemo(
    () => visitPlans.filter((plan) => !['Completed', 'Cancelled', 'Rejected'].includes(normalizePlanStatus(plan.status))),
    [visitPlans]
  );
  const submittedPlans = useMemo(() => {
    return visitPlans
      .filter((plan) => ['Submitted', 'Planned', 'Started', 'Completed', 'Rescheduled', 'Approved'].includes(normalizePlanStatus(plan.status)))
      .sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)));
  }, [visitPlans]);

  const pendingFollowUps = useMemo(() => followUps.filter((item) => item.status !== 'Completed'), [followUps]);
  const allReports = useMemo(() => [
    ...dailyReports.map((r) => ({ ...r, reportType: 'Daily Report' })),
    ...visitReports.map((r) => ({ ...r, reportType: 'Visit Report' })),
  ], [dailyReports, visitReports]);
  const pendingReports = useMemo(
    () => allReports.filter((r) => !['Approved', 'Completed'].includes(r.status)),
    [allReports]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.isRead),
    [notifications]
  );

  // Helper mappings
  const employeeFor = useCallback((employeeId) => marketingTeam.find((user) => user.employeeId === employeeId), [marketingTeam]);
  const nameFor = useCallback((employeeId, fallback) => fallback || employeeFor(employeeId)?.fullName || employeeFor(employeeId)?.username || employeeId || 'Field Rep', [employeeFor]);

  // 1. Employees Needing Attention
  const employeesNeedingAttention = useMemo(() => {
    return marketingTeam
      .map((emp) => {
        const empReports = pendingReports.filter((r) => r.employeeId === emp.employeeId).length;
        const empFollowUps = pendingFollowUps.filter((f) => f.employeeId === emp.employeeId).length;
        return {
          ...emp,
          pendingReportsCount: empReports,
          pendingFollowUpsCount: empFollowUps,
          totalIssues: empReports + empFollowUps,
        };
      })
      .filter((emp) => emp.totalIssues > 0)
      .sort((a, b) => b.totalIssues - a.totalIssues)
      .slice(0, 4);
  }, [marketingTeam, pendingReports, pendingFollowUps]);

  // 2. Latest Visit
  const latestVisit = useMemo(() => {
    if (!visitPlans.length) return null;
    return [...visitPlans].sort((a, b) => String(b.visitDate || b.createdAt).localeCompare(String(a.visitDate || a.createdAt)))[0];
  }, [visitPlans]);

  // 3. Recent Updates Feed (Top 5)
  const recentUpdates = useMemo(() => {
    const items = [
      ...submittedPlans.map((p) => ({
        id: `plan-${p.id}`,
        title: `${nameFor(p.employeeId, p.fullName)} submitted visit plan for ${p.area || p.city || 'assigned area'}`,
        timestamp: p.submittedAt || p.createdAt,
      })),
      ...pendingReports.map((r) => ({
        id: `report-${r.id}`,
        title: `${nameFor(r.employeeId, r.fullName)} submitted ${r.reportType}`,
        timestamp: r.createdAt || r.reportDate,
      })),
      ...notifications.slice(0, 5).map((n) => ({
        id: `notif-${n.id}`,
        title: n.message || n.title,
        timestamp: n.created_at || n.createdAt || n.timestamp,
      })),
    ];

    return items
      .filter((i) => i.timestamp)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, 5);
  }, [submittedPlans, pendingReports, notifications, nameFor]);

  if (dataLoading && !lastUpdated) {
    return (
      <div className="dd-container">
        <div className="director-dashboard-skeleton" aria-label="Loading Executive Dashboard">
          {Array.from({ length: 8 }, (_, idx) => (
            <div className="ds-skeleton" key={idx} style={{ height: '110px', borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dd-container" style={{ gap: '16px' }}>
      {/* 1. Welcome Section */}
      <div className="dd-hero-banner" style={{ padding: '16px 20px' }}>
        <div className="dd-hero-header">
          <div className="dd-hero-title">
            <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{greeting}, {currentUser?.fullName || 'Director'}</h1>
            <p style={{ marginTop: '4px', fontSize: '0.82rem' }}>
              <span>{formattedDate}</span>
              <span className="dd-sync-badge">
                <span className="dd-sync-dot" /> Live Sync Active ({lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Compact KPI Summary Grid (Max 4 cards per row) */}
      <div className="dd-kpi-grid">
        <div className="dd-kpi-card" onClick={() => navigate('/director/team')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon cyan"><Users size={18} /></div>
            <span className="dd-kpi-trend positive">Active</span>
          </div>
          <div className="dd-kpi-value">{marketingTeam.length}</div>
          <div className="dd-kpi-label">Marketing Team</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Calendar size={18} /></div>
            <span className="dd-kpi-trend neutral">Today</span>
          </div>
          <div className="dd-kpi-value">{todayScheduledVisits.length}</div>
          <div className="dd-kpi-label">Today's Visits</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon emerald"><CheckCircle2 size={18} /></div>
            <span className="dd-kpi-trend positive">Total</span>
          </div>
          <div className="dd-kpi-value">{completedPlans.length}</div>
          <div className="dd-kpi-label">Completed Visits</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon amber"><Clock size={18} /></div>
            <span className="dd-kpi-trend warning">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingVisits.length}</div>
          <div className="dd-kpi-label">Pending Visits</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon indigo"><FileSpreadsheet size={18} /></div>
            <span className="dd-kpi-trend positive">Total</span>
          </div>
          <div className="dd-kpi-value">{submittedPlans.length}</div>
          <div className="dd-kpi-label">Submitted Plans</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon purple"><FileText size={18} /></div>
            <span className="dd-kpi-trend warning">Review</span>
          </div>
          <div className="dd-kpi-value">{pendingReports.length}</div>
          <div className="dd-kpi-label">Pending Reports</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon rose"><AlertCircle size={18} /></div>
            <span className="dd-kpi-trend neutral">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingFollowUps.length}</div>
          <div className="dd-kpi-label">Pending Follow-ups</div>
        </div>

        <div className="dd-kpi-card" onClick={() => navigate('/director/notifications')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Bell size={18} /></div>
            <span className="dd-kpi-trend positive">Unread</span>
          </div>
          <div className="dd-kpi-value">{unreadNotifications.length}</div>
          <div className="dd-kpi-label">Unread Notifications</div>
        </div>
      </div>

      {/* 2-Column Main Decision Section */}
      <div className="dd-grid-two-col">
        {/* LEFT COLUMN: Latest Submitted Plans (Top 3), Latest Visit, Alerts Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Latest Submitted Plans (Top 3) */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <FileSpreadsheet size={18} style={{ color: '#3B5BDB' }} />
                <h2 style={{ fontSize: '1rem' }}>Latest Submitted Plans</h2>
              </div>
            </div>

            {submittedPlans.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {submittedPlans.slice(0, 3).map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#F8FAFC',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0F172A' }}>
                        {nameFor(plan.employeeId, plan.fullName || plan.employeeName)}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        🏢 {plan.customerName || plan.organizationName || 'General Visit'} • 📍 {plan.area || plan.city || 'Territory'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        🗓️ {plan.visitDate}
                      </div>
                    </div>
                    <Badge tone="info">{normalizePlanStatus(plan.status)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dd-empty-box">
                <div className="dd-empty-icon"><FileSpreadsheet size={18} /></div>
                <h4>No submitted plans</h4>
                <p>New visit plan submissions will appear here.</p>
              </div>
            )}
          </div>

          {/* Latest Visit Widget */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <MapPin size={18} style={{ color: '#2563EB' }} />
                <h2 style={{ fontSize: '1rem' }}>Latest Field Visit</h2>
              </div>
            </div>

            {latestVisit ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#F0F9FF',
                  borderRadius: '10px',
                  border: '1px solid #BAE6FD',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0369A1' }}>
                    👤 {nameFor(latestVisit.employeeId, latestVisit.fullName)}
                  </strong>
                  <Badge tone="info">{normalizePlanStatus(latestVisit.status)}</Badge>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0284C7' }}>
                  🏢 <strong>Customer:</strong> {latestVisit.customerName || latestVisit.organizationName || 'General Visit'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0369A1' }}>
                  📍 <strong>Area:</strong> {latestVisit.area || latestVisit.city || 'Territory'} • 🕒 <strong>Time:</strong> {latestVisit.expectedTime || latestVisit.visitDate || 'Today'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '2px' }}>
                  🎯 <strong>Purpose:</strong> {latestVisit.visitPurpose || 'Field Discussion'}
                </div>
              </div>
            ) : (
              <div className="dd-empty-box">
                <div className="dd-empty-icon"><MapPin size={18} /></div>
                <h4>No recent field visits</h4>
                <p>Visit activities will be displayed here.</p>
              </div>
            )}
          </div>

          {/* Alerts Summary Widget */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <AlertCircle size={18} style={{ color: '#E11D48' }} />
                <h2 style={{ fontSize: '1rem' }}>Alerts Summary</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ padding: '10px', background: '#FFF1F2', borderRadius: '10px', border: '1px solid #FECDD3', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#BE123C', display: 'block' }}>OVERDUE REPORTS</span>
                <strong style={{ fontSize: '1.2rem', color: '#9F1239' }}>{pendingReports.length}</strong>
              </div>

              <div style={{ padding: '10px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', display: 'block' }}>PENDING FOLLOW-UPS</span>
                <strong style={{ fontSize: '1.2rem', color: '#78350F' }}>{pendingFollowUps.length}</strong>
              </div>

              <div style={{ padding: '10px', background: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369A1', display: 'block' }}>UNREAD NOTIFS</span>
                <strong style={{ fontSize: '1.2rem', color: '#075985' }}>{unreadNotifications.length}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Employees Needing Attention & Recent Updates (Top 5) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Employees Needing Attention */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <UserCheck size={18} style={{ color: '#F59E0B' }} />
                <h2 style={{ fontSize: '1rem' }}>Employees Needing Attention</h2>
              </div>
            </div>

            {employeesNeedingAttention.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {employeesNeedingAttention.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#FEF3C7',
                      borderRadius: '10px',
                      border: '1px solid #FDE68A',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#92400E' }}>
                        {emp.fullName || emp.username}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#B45309' }}>
                        ID: {emp.employeeId || 'N/A'} • Last Active: {emp.lastActive ? new Date(emp.lastActive).toLocaleDateString('en-IN') : 'Today'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {emp.pendingReportsCount > 0 && (
                        <Badge tone="warning">{emp.pendingReportsCount} Reports</Badge>
                      )}
                      {emp.pendingFollowUpsCount > 0 && (
                        <Badge tone="danger">{emp.pendingFollowUpsCount} Follow-ups</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dd-empty-box">
                <div className="dd-empty-icon"><UserCheck size={18} /></div>
                <h4>All team members up to date</h4>
                <p>No team members have pending reports or follow-ups.</p>
              </div>
            )}
          </div>

          {/* Recent Updates (Top 5) */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <Sparkles size={18} style={{ color: '#3B5BDB' }} />
                <h2 style={{ fontSize: '1rem' }}>Recent Updates</h2>
              </div>
            </div>

            <div className="dd-activity-stream">
              {recentUpdates.length > 0 ? (
                recentUpdates.map((item) => (
                  <div key={item.id} className="dd-activity-item">
                    <div className="dd-activity-bullet">
                      <Sparkles size={14} />
                    </div>
                    <div className="dd-activity-content">
                      <p style={{ fontSize: '0.82rem' }}>{item.title}</p>
                      <time>{item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : 'Recently'}</time>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dd-empty-box">
                  <div className="dd-empty-icon"><Bell size={18} /></div>
                  <h4>No recent updates</h4>
                  <p>Recent field actions will show up here automatically.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;


