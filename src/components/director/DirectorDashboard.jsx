import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button } from '../ui';
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

  // Marketing Team Count
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

  // Recent Updates Feed (Max 5 items)
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

  // Urgent Items Summary (Max 4 items)
  const urgentAttentionItems = useMemo(() => {
    const items = [];
    pendingReports.slice(0, 2).forEach((r) => {
      items.push({
        id: `rep-${r.id}`,
        type: 'Pending Report',
        text: `${nameFor(r.employeeId, r.fullName)} submitted ${r.reportType}`,
        route: '/director/daily-reports',
      });
    });
    pendingFollowUps.slice(0, 2).forEach((f) => {
      items.push({
        id: `fol-${f.id}`,
        type: 'Pending Follow-up',
        text: `${nameFor(f.employeeId, f.fullName)} • Due: ${f.followUpDate || 'Today'}`,
        route: '/director/follow-ups',
      });
    });
    return items.slice(0, 4);
  }, [pendingReports, pendingFollowUps, nameFor]);

  if (dataLoading && !lastUpdated) {
    return (
      <div className="dd-container">
        <div className="director-dashboard-skeleton" aria-label="Loading Summary Dashboard">
          {Array.from({ length: 8 }, (_, idx) => (
            <div className="ds-skeleton" key={idx} style={{ height: '110px', borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dd-container">
      {/* 1. Welcome Section */}
      <div className="dd-hero-banner" style={{ padding: '20px 24px' }}>
        <div className="dd-hero-header">
          <div className="dd-hero-title">
            <h1 style={{ fontSize: '1.45rem', margin: 0 }}>{greeting}, {currentUser?.fullName || 'Director'}</h1>
            <p style={{ marginTop: '4px' }}>
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
        {/* Total Marketing Team */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/team')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon cyan"><Users size={20} /></div>
            <span className="dd-kpi-trend positive">Active</span>
          </div>
          <div className="dd-kpi-value">{marketingTeam.length}</div>
          <div className="dd-kpi-label">Marketing Team</div>
        </div>

        {/* Today's Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Calendar size={20} /></div>
            <span className="dd-kpi-trend neutral">Today</span>
          </div>
          <div className="dd-kpi-value">{todayScheduledVisits.length}</div>
          <div className="dd-kpi-label">Today's Visits</div>
        </div>

        {/* Completed Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon emerald"><CheckCircle2 size={20} /></div>
            <span className="dd-kpi-trend positive">Total</span>
          </div>
          <div className="dd-kpi-value">{completedPlans.length}</div>
          <div className="dd-kpi-label">Completed Visits</div>
        </div>

        {/* Pending Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon amber"><Clock size={20} /></div>
            <span className="dd-kpi-trend warning">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingVisits.length}</div>
          <div className="dd-kpi-label">Pending Visits</div>
        </div>

        {/* Submitted Plans */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon indigo"><FileSpreadsheet size={20} /></div>
            <span className="dd-kpi-trend positive">Total</span>
          </div>
          <div className="dd-kpi-value">{submittedPlans.length}</div>
          <div className="dd-kpi-label">Submitted Plans</div>
        </div>

        {/* Pending Reports */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon purple"><FileText size={20} /></div>
            <span className="dd-kpi-trend warning">Review</span>
          </div>
          <div className="dd-kpi-value">{pendingReports.length}</div>
          <div className="dd-kpi-label">Pending Reports</div>
        </div>

        {/* Pending Follow-ups */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon rose"><AlertCircle size={20} /></div>
            <span className="dd-kpi-trend neutral">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingFollowUps.length}</div>
          <div className="dd-kpi-label">Pending Follow-ups</div>
        </div>

        {/* Unread Notifications */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/notifications')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Bell size={20} /></div>
            <span className="dd-kpi-trend positive">Unread</span>
          </div>
          <div className="dd-kpi-value">{unreadNotifications.length}</div>
          <div className="dd-kpi-label">Unread Notifications</div>
        </div>
      </div>

      {/* 2-Column Summary Content */}
      <div className="dd-grid-two-col">
        {/* Left Column: Latest Submitted Plans (Max 3) & Urgent Attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4. Latest Submitted Plans (Max 3) */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <FileSpreadsheet size={18} style={{ color: '#3B5BDB' }} />
                <h2>Latest Submitted Plans</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/director/visit-plans')}>
                View All Visit Plans <ChevronRight size={14} />
              </Button>
            </div>

            {submittedPlans.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {submittedPlans.slice(0, 3).map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
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
                <div className="dd-empty-icon"><FileSpreadsheet size={20} /></div>
                <h4>No submitted plans</h4>
                <p>New visit plan submissions will appear here.</p>
              </div>
            )}
          </div>

          {/* 5. Urgent Attention (Max 4 summary items) */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <AlertCircle size={18} style={{ color: '#E11D48' }} />
                <h2>Urgent Attention</h2>
              </div>
            </div>

            {urgentAttentionItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {urgentAttentionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#FFF1F2',
                      borderRadius: '10px',
                      border: '1px solid #FECDD3',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#BE123C', uppercase: true, display: 'block' }}>
                        {item.type}
                      </span>
                      <strong style={{ fontSize: '0.82rem', color: '#9F1239' }}>
                        {item.text}
                      </strong>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(item.route)}>
                      Open <ArrowUpRight size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dd-empty-box">
                <div className="dd-empty-icon"><CheckCircle2 size={20} /></div>
                <h4>No urgent action items</h4>
                <p>All reports and follow-ups are up to date.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Updates Feed (Max 5) & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 3. Recent Updates (Max 5 items) */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <Sparkles size={18} style={{ color: '#3B5BDB' }} />
                <h2>Recent Updates</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/director/notifications')}>
                View All Updates <ChevronRight size={14} />
              </Button>
            </div>

            <div className="dd-activity-stream">
              {recentUpdates.length > 0 ? (
                recentUpdates.map((item) => (
                  <div key={item.id} className="dd-activity-item">
                    <div className="dd-activity-bullet">
                      <Sparkles size={14} />
                    </div>
                    <div className="dd-activity-content">
                      <p>{item.title}</p>
                      <time>{item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : 'Recently'}</time>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dd-empty-box">
                  <div className="dd-empty-icon"><Bell size={20} /></div>
                  <h4>No recent updates</h4>
                  <p>Recent field actions will show up here automatically.</p>
                </div>
              )}
            </div>
          </div>

          {/* 6. Quick Actions Navigation Panel */}
          <div className="dd-card">
            <div className="dd-card-header">
              <div className="dd-card-title">
                <ChevronRight size={18} style={{ color: '#4F46E5' }} />
                <h2>Quick Actions</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/team')}>
                <Users size={16} /> View Team
              </Button>

              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/today-schedule')}>
                <Calendar size={16} /> Today's Schedule
              </Button>

              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/visit-plans')}>
                <FileSpreadsheet size={16} /> View Visit Plans
              </Button>

              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/daily-reports')}>
                <FileText size={16} /> View Reports
              </Button>

              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/follow-ups')}>
                <AlertCircle size={16} /> View Follow-ups
              </Button>

              <Button variant="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/director/comments')}>
                <MessageSquare size={16} /> Communication
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;

