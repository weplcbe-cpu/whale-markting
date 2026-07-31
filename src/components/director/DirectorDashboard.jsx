import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  MapPin,
  MessageSquare,
  Moon,
  Package,
  Sun,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CompanyLogo } from '../common/CompanyLogo';

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
    logout,
    theme,
    toggleTheme,
  } = useApp();

  const [mobileGroup, setMobileGroup] = useState(1); // 1 or 2
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const now = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Metrics
  const marketingTeamCount = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    ).length;
  }, [users]);

  const todayScheduledVisitsCount = useMemo(
    () => visitPlans.filter((plan) => plan.visitDate === todayValue).length,
    [visitPlans, todayValue]
  );

  const completedPlansCount = useMemo(
    () => visitPlans.filter((plan) => String(plan.status).toLowerCase() === 'completed').length,
    [visitPlans]
  );

  const submittedPlansCount = useMemo(
    () => visitPlans.filter((plan) => ['submitted', 'planned', 'started', 'rescheduled', 'approved'].includes(String(plan.status).toLowerCase())).length,
    [visitPlans]
  );

  const allReports = useMemo(() => [...dailyReports, ...visitReports], [dailyReports, visitReports]);
  const pendingReportsCount = useMemo(
    () => allReports.filter((r) => !['approved', 'completed'].includes(String(r.status).toLowerCase())).length,
    [allReports]
  );

  const pendingFollowUpsCount = useMemo(
    () => followUps.filter((item) => String(item.status).toLowerCase() !== 'completed').length,
    [followUps]
  );

  const unreadNotifsCount = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.isRead).length,
    [notifications]
  );

  // 12 Tiles Definition
  const tiles = useMemo(() => [
    {
      id: 'team',
      title: 'Marketing Team',
      icon: Users,
      badge: `${marketingTeamCount} Reps`,
      badgeColor: '#06B6D4',
      description: 'Directory, territories & rep status',
      path: '/director/team',
      group: 1,
    },
    {
      id: 'today-schedule',
      title: 'Today Schedule',
      icon: Clock,
      badge: `${todayScheduledVisitsCount} Today`,
      badgeColor: '#3B82F6',
      description: 'Real-time field visit tracking',
      path: '/director/today-schedule',
      group: 1,
    },
    {
      id: 'visit-plans',
      title: 'Visit Plans',
      icon: Calendar,
      badge: `${submittedPlansCount} Submitted`,
      badgeColor: '#6366F1',
      description: 'Review field visit plan submissions',
      path: '/director/visit-plans',
      group: 1,
    },
    {
      id: 'visit-reports',
      title: 'Visit Reports',
      icon: CheckCircle2,
      badge: `${completedPlansCount} Verified`,
      badgeColor: '#10B981',
      description: 'Completed visit logs & proof',
      path: '/director/visit-reports',
      group: 1,
    },
    {
      id: 'daily-reports',
      title: 'Daily Reports',
      icon: FileText,
      badge: `${pendingReportsCount} Pending`,
      badgeColor: '#8B5CF6',
      description: 'Daily activity summaries',
      path: '/director/daily-reports',
      group: 1,
    },
    {
      id: 'follow-ups',
      title: 'Follow-ups',
      icon: AlertCircle,
      badge: `${pendingFollowUpsCount} Due`,
      badgeColor: '#F43F5E',
      description: 'Open client follow-up actions',
      path: '/director/follow-ups',
      group: 1,
    },
    {
      id: 'product-overview',
      title: 'Product Overview',
      icon: Package,
      badge: 'Catalog',
      badgeColor: '#0EA5E9',
      description: 'Product demand & tag insights',
      path: '/director/analytics/products',
      group: 2,
    },
    {
      id: 'area-overview',
      title: 'Area Overview',
      icon: MapPin,
      badge: 'Territories',
      badgeColor: '#F59E0B',
      description: 'Geographic visit analytics',
      path: '/director/analytics/areas',
      group: 2,
    },
    {
      id: 'performance',
      title: 'Performance',
      icon: TrendingUp,
      badge: 'Analytics',
      badgeColor: '#10B981',
      description: 'Team performance metrics',
      path: '/director/analytics/performance',
      group: 2,
    },
    {
      id: 'comments',
      title: 'Comments',
      icon: MessageSquare,
      badge: 'Feed',
      badgeColor: '#6366F1',
      description: 'Director notes & rep feedback',
      path: '/director/comments',
      group: 2,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      badge: `${unreadNotifsCount} Unread`,
      badgeColor: '#3B82F6',
      description: 'System alerts & activity stream',
      path: '/director/notifications',
      group: 2,
    },
    {
      id: 'profile',
      title: 'Profile',
      icon: User,
      badge: 'Account',
      badgeColor: '#64748B',
      description: 'Director settings & credentials',
      path: '/director/profile',
      group: 2,
    },
  ], [
    marketingTeamCount,
    todayScheduledVisitsCount,
    submittedPlansCount,
    completedPlansCount,
    pendingReportsCount,
    pendingFollowUpsCount,
    unreadNotifsCount,
  ]);

  const handleTileKeyDown = (e, path) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  };

  if (dataLoading && !lastUpdated) {
    return (
      <div className="dcc-container">
        <div className="director-dashboard-skeleton" aria-label="Loading Director Control Center">
          <div className="ds-skeleton" style={{ height: '70px', borderRadius: '16px' }} />
          <div className="ds-skeleton" style={{ height: '40px', borderRadius: '12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {Array.from({ length: 12 }, (_, idx) => (
              <div className="ds-skeleton" key={idx} style={{ height: '110px', borderRadius: '14px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dcc-container">
      {/* 1. Top Control Center Header */}
      <header className="dcc-header">
        <div className="dcc-header-left">
          <CompanyLogo className="dcc-logo" />
          <div className="dcc-title-block">
            <h1>Director Control Center</h1>
            <p>
              {greeting}, <strong>{currentUser?.fullName || 'Director'}</strong> • {formattedDate}
            </p>
          </div>
        </div>

        <div className="dcc-header-right">
          {/* Live Sync Badge */}
          <span className="dd-sync-badge">
            <span className="dd-sync-dot" /> Live ({lastUpdated ? lastUpdated.toLocaleTimeString() : 'Syncing'})
          </span>

          {/* Theme Toggle */}
          <button
            type="button"
            className="dcc-icon-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            className="dcc-icon-btn dcc-notif-btn"
            onClick={() => navigate('/director/notifications')}
            title="Notifications"
            aria-label={`Notifications (${unreadNotifsCount} unread)`}
          >
            <Bell size={18} />
            {unreadNotifsCount > 0 && <span className="dcc-notif-badge">{unreadNotifsCount}</span>}
          </button>

          {/* Profile Menu Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="dcc-profile-trigger"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-label="Director Profile Menu"
            >
              <User size={16} />
              <span>{currentUser?.fullName || 'Director'}</span>
            </button>

            {showProfileMenu && (
              <div className="dcc-profile-dropdown">
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); navigate('/director/profile'); }}
                >
                  <User size={14} /> My Profile
                </button>
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); logout(); }}
                  style={{ color: '#EF4444' }}
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Compact Glass Summary Strip */}
      <div className="dcc-summary-strip">
        <div className="dcc-summary-item">
          <span>Marketing Team</span>
          <strong>{marketingTeamCount} Reps</strong>
        </div>
        <div className="dcc-summary-divider" />
        <div className="dcc-summary-item">
          <span>Today's Visits</span>
          <strong style={{ color: '#38BDF8' }}>{todayScheduledVisitsCount} Scheduled</strong>
        </div>
        <div className="dcc-summary-divider" />
        <div className="dcc-summary-item">
          <span>Pending Reports</span>
          <strong style={{ color: '#A78BFA' }}>{pendingReportsCount} Pending</strong>
        </div>
        <div className="dcc-summary-divider" />
        <div className="dcc-summary-item">
          <span>Pending Follow-ups</span>
          <strong style={{ color: '#FB7185' }}>{pendingFollowUpsCount} Due</strong>
        </div>
      </div>

      {/* Mobile Paginated Controls (<768px only) */}
      <div className="dcc-mobile-pager">
        <button
          type="button"
          disabled={mobileGroup === 1}
          onClick={() => setMobileGroup(1)}
          className={`dcc-page-btn ${mobileGroup === 1 ? 'active' : ''}`}
        >
          <ChevronLeft size={16} /> Group 1: Operations
        </button>

        <div className="dcc-dots">
          <span className={`dcc-dot ${mobileGroup === 1 ? 'active' : ''}`} onClick={() => setMobileGroup(1)} />
          <span className={`dcc-dot ${mobileGroup === 2 ? 'active' : ''}`} onClick={() => setMobileGroup(2)} />
        </div>

        <button
          type="button"
          disabled={mobileGroup === 2}
          onClick={() => setMobileGroup(2)}
          className={`dcc-page-btn ${mobileGroup === 2 ? 'active' : ''}`}
        >
          Group 2: Analytics <ChevronRight size={16} />
        </button>
      </div>

      {/* 3. Navigation Tile Grid (12 Tiles, 4x3 desktop grid) */}
      <div className="dcc-tile-grid">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const isMobileVisible = mobileGroup === tile.group;

          return (
            <div
              key={tile.id}
              className={`dcc-tile ${!isMobileVisible ? 'mobile-hidden' : ''}`}
              onClick={() => navigate(tile.path)}
              onKeyDown={(e) => handleTileKeyDown(e, tile.path)}
              tabIndex={0}
              role="button"
              aria-label={`${tile.title} - ${tile.description}`}
            >
              <div className="dcc-tile-top">
                <div className="dcc-tile-icon" style={{ color: tile.badgeColor }}>
                  <Icon size={22} />
                </div>
                <span
                  className="dcc-tile-badge"
                  style={{
                    backgroundColor: `${tile.badgeColor}20`,
                    borderColor: `${tile.badgeColor}40`,
                    color: tile.badgeColor,
                  }}
                >
                  {tile.badge}
                </span>
              </div>

              <div className="dcc-tile-body">
                <h3>{tile.title}</h3>
                <p>{tile.description}</p>
              </div>

              <div className="dcc-tile-arrow">
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DirectorDashboard;




