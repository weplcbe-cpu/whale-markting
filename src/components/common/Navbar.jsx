import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  User,
  Calendar as CalendarIcon,
  LogOut,
  X,
  Search,
  Menu,
  Settings2,
  Sun,
  Moon
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
  customers: 'Customers',
  visits: 'Visits & Schedule',
  reports: 'Reports',
  'follow-ups': 'Follow‑ups',
  tenders: 'Tenders',
  'director-comments': 'Director Comments',
  notifications: 'Notifications',
  profile: 'Profile',
  // Visits hub sub‑tabs
  today: "Today's Visits",
  plans: 'My Visit Plans',
  weekly: 'Weekly Planning Sheet',
  // Reports hub sub‑tab
  'daily-report': 'Daily Report'
};

export const Navbar = ({ activeTab, setActiveTab, toggleSidebar }) => {
  const { currentUser, currentRole, logout, notifications, showToast } = useApp();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [theme, setTheme] = useState('light'); // default light theme

  // Filter notifications relevant to this user
  const userNotifs = notifications.filter(
    n => !n.userId || n.userId === currentUser?.employeeId
  );
  const unreadCount = userNotifs.filter(n => !n.isRead).length;

  // Theme toggle – adds/removes `dark` class on <html>
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Initialise theme from system preference (run once)
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) toggleTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build breadcrumb based on activeTab (portal name is shown as the primary heading instead)
  const generateBreadcrumb = () => {
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
            placeholder="Search plans, customers..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
        </div>

        {/* Settings */}
        <button
          className="icon-btn"
          title="Settings"
          onClick={() => showToast('Settings panel coming soon', 'info')}
        >
          <Settings2 size={20} strokeWidth={2.5} />
        </button>

        {/* Theme toggle */}
        <button className="icon-btn" title="Toggle Theme" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <div className="icon-btn-wrapper" style={{ position: 'relative' }}>
          <button
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
            <div
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: '300px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1100,
                padding: '16px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  alignItems: 'center'
                }}
              >
                <h4 style={{ color: 'var(--primary-dark)', fontSize: '0.98rem', fontWeight: 800 }}>
                  Notifications
                </h4>
                <button
                  onClick={() => setShowNotifDropdown(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
              {userNotifs.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No notifications yet.</p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  {userNotifs.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px',
                        background: 'rgba(117, 139, 253, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '4px solid var(--primary-blue)'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {n.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              {currentUser?.employeeName?.charAt(0) || 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                {currentUser?.employeeName || 'User'}
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
