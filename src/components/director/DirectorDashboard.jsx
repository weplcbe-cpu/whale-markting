import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Calendar,
  FileText,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

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

  // 1. Total Marketing Team
  const marketingTeamCount = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    ).length;
  }, [users]);

  // 2. Today's Visits
  const todayScheduledVisitsCount = useMemo(
    () => visitPlans.filter((plan) => plan.visitDate === todayValue).length,
    [visitPlans, todayValue]
  );

  // 3. Pending Reports
  const allReports = useMemo(() => [
    ...dailyReports,
    ...visitReports,
  ], [dailyReports, visitReports]);
  const pendingReportsCount = useMemo(
    () => allReports.filter((r) => !['Approved', 'Completed'].includes(r.status)).length,
    [allReports]
  );

  // 4. Pending Follow-ups
  const pendingFollowUpsCount = useMemo(
    () => followUps.filter((item) => item.status !== 'Completed').length,
    [followUps]
  );

  // Unread Notifications Count
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.isRead).length,
    [notifications]
  );

  if (dataLoading && !lastUpdated) {
    return (
      <div className="dd-container">
        <div className="director-dashboard-skeleton" aria-label="Loading Minimal Executive Summary">
          <div className="ds-skeleton" style={{ height: '90px', borderRadius: '16px' }} />
          <div className="ds-skeleton" style={{ height: '130px', borderRadius: '16px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dd-container" style={{ gap: '20px', maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      {/* 1. Welcome Header */}
      <div className="dd-hero-banner" style={{ padding: '20px 24px' }}>
        <div className="dd-hero-header">
          <div className="dd-hero-title">
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
              {greeting}, {currentUser?.fullName || 'Director'}
            </h1>
            <p style={{ marginTop: '6px', fontSize: '0.85rem' }}>
              <span>{formattedDate}</span>
              <span className="dd-sync-badge">
                <span className="dd-sync-dot" /> Live Sync Active ({lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'})
              </span>
            </p>
          </div>

          {/* 3. Small Notification Indicator */}
          <div
            onClick={() => navigate('/director/notifications')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              borderRadius: '20px',
              cursor: 'pointer',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Bell size={18} />
            <span>{unreadNotificationsCount} Unread Notifications</span>
          </div>
        </div>
      </div>

      {/* 2. Four Compact KPI Cards */}
      <div className="dd-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Total Marketing Team */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/team')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon cyan"><Users size={22} /></div>
            <span className="dd-kpi-trend positive">Active</span>
          </div>
          <div className="dd-kpi-value">{marketingTeamCount}</div>
          <div className="dd-kpi-label">Total Marketing Team</div>
        </div>

        {/* Today's Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Calendar size={22} /></div>
            <span className="dd-kpi-trend neutral">Today</span>
          </div>
          <div className="dd-kpi-value">{todayScheduledVisitsCount}</div>
          <div className="dd-kpi-label">Today's Visits</div>
        </div>

        {/* Pending Reports */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon purple"><FileText size={22} /></div>
            <span className="dd-kpi-trend warning">Review</span>
          </div>
          <div className="dd-kpi-value">{pendingReportsCount}</div>
          <div className="dd-kpi-label">Pending Reports</div>
        </div>

        {/* Pending Follow-ups */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon rose"><AlertCircle size={22} /></div>
            <span className="dd-kpi-trend neutral">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingFollowUpsCount}</div>
          <div className="dd-kpi-label">Pending Follow-ups</div>
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;



