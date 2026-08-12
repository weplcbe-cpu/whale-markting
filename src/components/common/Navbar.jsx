import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { directorRoutes, marketingRoutes } from '../../routes';
import { isLegacyApprovalNotification } from '../../utils/directorFeedback';
import { filterActiveNotifications, getNotificationRoute } from '../../utils/notificationUtils';
import { CompanyLogo } from './CompanyLogo';
import NotificationPopover from './NotificationPopover';
import {
  Bell,
  LogOut,
  X,
  Search,
  Menu,
  Settings2,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

// Mapping for portal titles based on role
const portalTitleMap = {
  Admin: 'Admin Portal',
  Director: 'Director Portal',
  'Marketing Team': 'Marketing Portal'
};

// Mapping for page titles based on active tab (including sub‑tabs)
const pageTitleMap = {
  dashboard: 'Dashboard',
  visits: 'Visits & Schedule',
  reports: 'Reports',
  'follow-ups': 'Follow‑ups',
  'director-comments': 'Director Comments',
  profile: 'Profile',
  // Visits hub sub‑tabs
  today: "Today's Visits",
  plans: 'My Visit Plans',
  weekly: 'Weekly Planning Sheet',
  // Reports hub sub‑tab
  'daily-report': 'Daily Report'
};

export const Navbar = ({ activeTab, toggleSidebar }) => {
  const { currentUser, currentRole, logout, notifications, users, visitPlans, visitReports, dailyReports, followUps, directorComments, refreshEntity, markNotificationRead, showToast, themeMode, setThemeMode } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const notificationBellRef = useRef(null);

  // Filter notifications relevant to this user
  const activeNotifications = useMemo(() => filterActiveNotifications(notifications), [notifications]);
  const userNotifs = activeNotifications.filter(
    n => !n.userId || n.userId === currentUser?.employeeId
  ).filter((notification) => {
    const text = `${notification.type || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    return !text.includes('tender') && (currentRole !== 'Marketing Team' || !isLegacyApprovalNotification(notification));
  });
  const unreadCount = userNotifs.filter(n => !n.isRead).length;
  const notificationPath = (notification) => getNotificationRoute(notification, currentRole);

  const openNotification = async (notification, kind) => {
    await markNotificationRead(notification.id);
    setShowNotifDropdown(false);

    if (currentRole !== 'Director') {
      navigate(notificationPath(notification));
      return;
    }

    const targets = {
      visitPlan: { path: '/director/visit-plans', parameter: 'planId', records: visitPlans },
      planUpdated: { path: '/director/visit-plans', parameter: 'planId', records: visitPlans },
      visitReport: { path: '/director/visit-reports', parameter: 'reportId', records: visitReports },
      dailyReport: { path: '/director/daily-reports', parameter: 'reportId', records: dailyReports },
      followUp: { path: '/director/follow-ups', parameter: 'followUpId', records: followUps },
      comment: { path: '/director/comments', parameter: 'commentId', records: directorComments },
    };
    const target = targets[kind];
    if (!target) {
      navigate('/director/notifications');
      return;
    }
    const relatedId = notification.referenceId;
    const records = kind === 'visitReport'
      ? await refreshEntity('visit_reports')
      : target.records;
    const matchedRecord = relatedId && records?.find((item) => (
      String(item.id) === String(relatedId)
      || (kind === 'visitReport' && String(item.visitPlanId) === String(relatedId))
    ));
    const exists = Boolean(matchedRecord);
    if (!exists) {
      showToast?.(relatedId
        ? 'This related record was deleted.'
        : 'This legacy notification does not contain a valid related-record reference.', 'error');
      return;
    }
    navigate(`${target.path}?${target.parameter}=${encodeURIComponent(matchedRecord.id)}`);
  };
  const searchResults = globalSearch.trim().length < 2 ? [] : [
    ...users.filter(item => `${item.fullName || item.employeeName || ''} ${item.employeeId || ''}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 3).map(item => ({ id: `user-${item.id}`, label: item.fullName || item.employeeName, group: 'Employees', path: '/director/team' })),
    ...visitPlans.filter(item => `${item.customerName || ''} ${item.area || item.district || ''} ${item.visitPurpose || ''}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 3).map(item => ({ id: `plan-${item.id}`, label: `${item.customerName || item.area} · ${item.visitDate}`, group: 'Visit Plans', path: '/director/tour-plans' })),
    ...[...visitReports, ...dailyReports].filter(item => `${item.fullName || item.employeeName || ''} ${item.customerName || ''}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 3).map(item => ({ id: `report-${item.id}`, label: item.customerName || `${item.fullName || item.employeeName || 'Marketing Employee'} report`, group: 'Reports', path: '/director/visit-reports' }))
  ];

  // Build breadcrumb based on activeTab (portal name is shown as the primary heading instead)
  const generateBreadcrumb = () => {
    if (currentRole === 'Marketing Team') {
      const route = marketingRoutes.find(item => item.path === location.pathname);
      return [route?.label || 'Dashboard'];
    }
    if (currentRole === 'Director') {
      const route = directorRoutes.find(item => item.path === location.pathname || (item.path.includes('/:') && location.pathname.startsWith(`${item.path.split('/:')[0]}/`)));
      return [route?.label || 'Dashboard'];
    }

    const crumbs = ['Home'];
    if (activeTab && activeTab !== 'dashboard') {
      crumbs.push(pageTitleMap[activeTab] || activeTab);
    }
    return crumbs;
  };

  const breadcrumb = generateBreadcrumb();
  const pageTitle = portalTitleMap[currentRole] || 'Portal';
  return (
    <header className="top-navbar">
      {/* Left: hamburger (mobile/tablet only) */}
      <div className="navbar-left">
        <button
          className="icon-btn mobile-menu-btn"
          onClick={toggleSidebar}
          title="Toggle Menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center: breadcrumb (small) above the portal name (primary heading) */}
      <div className="navbar-center">
        <CompanyLogo className="navbar-company-logo" />
        <nav aria-label="breadcrumb" className="navbar-breadcrumb">
          {breadcrumb.map((crumb, idx) => (
            <span key={idx}>
              {crumb}
              {idx < breadcrumb.length - 1 && <span className="navbar-breadcrumb-sep">/</span>}
            </span>
          ))}
        </nav>
        <h1 className="navbar-title">{pageTitle}</h1>
      </div>

      {/* Right: search, settings, theme, notifications, profile */}
      <div className="navbar-right">
        {/* Global Search (centered) */}
        <div className="desktop-search-wrapper">
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="global-search-input"
            placeholder="Search plans and reports..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
          {currentRole === 'Director' && globalSearch.trim().length >= 2 && <div className="global-search-results">{searchResults.length ? searchResults.map(result => <button type="button" key={result.id} onClick={() => { navigate(result.path); setGlobalSearch(''); }}><small>{result.group}</small><strong>{result.label}</strong></button>) : <p>No matching records</p>}</div>}
        </div>

        {/* Theme Switcher */}
        <div className="kw-theme-switcher" role="radiogroup" aria-label="Theme options">
          <button
            type="button"
            className={`kw-theme-btn ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => setThemeMode('light')}
            title="Light theme"
            aria-label="Light theme"
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            className={`kw-theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => setThemeMode('dark')}
            title="Dark theme"
            aria-label="Dark theme"
          >
            <Moon size={15} />
          </button>
          <button
            type="button"
            className={`kw-theme-btn ${themeMode === 'system' ? 'active' : ''}`}
            onClick={() => setThemeMode('system')}
            title="System theme"
            aria-label="System theme"
          >
            <Monitor size={15} />
          </button>
        </div>

        {/* Settings */}
        <button
          className="icon-btn"
          title="Settings"
          onClick={() => currentRole === 'Director' ? navigate('/director/profile') : currentRole === 'Marketing Team' ? navigate('/marketing/profile') : navigate('/admin/profile')}
        >
          <Settings2 size={20} strokeWidth={2.5} />
        </button>

        {/* Notifications */}
        <div className="icon-btn-wrapper" style={{ position: 'relative' }}>
          <button
            ref={notificationBellRef}
            className="icon-btn"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notif-badge" style={{ position: 'absolute', top: '-4px', right: '-4px' }}>
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifDropdown && (
            <NotificationPopover
              notifications={userNotifs}
              unreadCount={unreadCount}
              onClose={() => setShowNotifDropdown(false)}
              onMarkRead={markNotificationRead}
              onOpenNotification={openNotification}
              onViewAll={() => { setShowNotifDropdown(false); navigate(currentRole === 'Director' ? '/director/notifications' : notificationPath({})); }}
              bellRef={notificationBellRef}
            />
          )}
        </div>

        {/* Profile with dropdown */}
        <div className="profile-wrapper" style={{ position: 'relative' }}>
          <button
            className="user-profile-pill"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(39, 24, 126, 0.05)',
              padding: '6px 12px',
              borderRadius: '30px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            <div
              className="avatar-circle"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--primary-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              {(currentUser?.fullName || currentUser?.employeeName || currentUser?.username)?.charAt(0) || 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                {currentUser?.fullName || currentUser?.employeeName || currentUser?.username || 'User'}
              </span>
              <span
                className="role-badge"
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--primary-blue)',
                  background: 'rgba(117,139,253,0.12)',
                  borderRadius: '4px',
                  padding: '2px 4px'
                }}
              >
                {currentRole}
              </span>
            </div>
            <X size={14} />
          </button>
          {showProfileDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '48px',
                width: '200px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1100,
                padding: '12px'
              }}
            >
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-dark)',
                  cursor: 'pointer',
                  padding: '8px 0'
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
