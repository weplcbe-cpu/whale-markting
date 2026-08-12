import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminRoutes, directorNavigation, directorRoutes, marketingRoutes } from '../../routes';
import { filterActiveNotifications } from '../../utils/notificationUtils';
import { CompanyLogo } from './CompanyLogo';
import {
  LayoutDashboard,
  Calendar,
  FileSpreadsheet,
  Clock,
  MessageSquare,
  User,
  Users,
  Package,
  Database,
  BarChart3,
  LogOut,
  X,
  ChevronDown
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, isMobileOpen, toggleSidebar }) => {
  const { currentUser, currentRole, logout, notifications, directorComments } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedDirectorGroups, setExpandedDirectorGroups] = useState(new Set());

  const unreadNotifsCount = filterActiveNotifications(notifications).filter(
    n => !n.isRead && (!n.userId || n.userId === currentUser?.employeeId)
  ).length;
  const unreadFeedbackCount = directorComments.filter(
    feedback => !feedback.isRead && feedback.employeeId === currentUser?.employeeId
  ).length;

  // Single-source 9-Item Marketing Sidebar Navigation (Zero Duplication)
  const marketingIcons = {
    dashboard: LayoutDashboard,
    visits: Calendar,
    reports: FileSpreadsheet,
    'follow-ups': Clock,
    'director-comments': MessageSquare,
    profile: User,
  };
  const marketingMenu = marketingRoutes.filter(route => route.nav !== false).map(route => ({
    ...route,
    icon: marketingIcons[route.id] || FileSpreadsheet,
    badge: route.id === 'director-comments' ? unreadFeedbackCount : undefined,
  }));

  // Single-source Director Sidebar Navigation
  const directorIcons = { dashboard: LayoutDashboard, team: Users, 'today-schedule': Clock, 'weekly-plans': Calendar, 'visit-plans': Calendar, 'visit-reports': FileSpreadsheet, 'daily-reports': FileSpreadsheet, 'follow-ups': Clock, 'product-overview': Package, 'area-overview': BarChart3, performance: BarChart3, reports: FileSpreadsheet, comments: MessageSquare, notifications: MessageSquare, profile: User };
  const directorMenu = directorRoutes.filter(route => route.nav !== false).map(route => ({ ...route, icon: directorIcons[route.id] || FileSpreadsheet, badge: route.id === 'notifications' ? unreadNotifsCount : undefined }));
  const directorGroups = directorNavigation.map((group) => ({ ...group, items: group.routeIds.map((id) => directorMenu.find((route) => route.id === id)).filter(Boolean) }));

  // Single-source Admin Sidebar Navigation
  const adminIcons = { dashboard: LayoutDashboard, users: Users, products: Package, 'master-data': Database, reports: BarChart3, 'activity-logs': Clock, settings: User, profile: User };
  const adminMenu = adminRoutes.filter(route => route.nav !== false).map(route => ({ ...route, icon: adminIcons[route.id] || User }));

  const menuItems = currentRole === 'Admin'
    ? adminMenu
    : currentRole === 'Director'
    ? directorMenu
    : marketingMenu;

  const handleItemClick = (item) => {
    if (currentRole === 'Marketing Team' || currentRole === 'Director' || currentRole === 'Admin') {
      navigate(item.path);
    } else {
      setActiveTab(item.id);
    }
    if (toggleSidebar && isMobileOpen) {
      toggleSidebar();
    }
  };

  const isDirectorRouteActive = (item) => location.pathname === item.path || (item.path !== '/director' && location.pathname.startsWith(`${item.path}/`));
  const toggleDirectorGroup = (groupId) => setExpandedDirectorGroups((current) => {
    const next = new Set(current);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    return next;
  });

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={toggleSidebar} />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-card">
            <CompanyLogo className="sidebar-logo-img" />
          </div>

          {isMobileOpen && (
            <button
              onClick={toggleSidebar}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '10px' }}
            >
              <X size={22} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {currentRole === 'Director' ? directorGroups.map((group) => {
            const hasChildren = group.items.length > 1;
            const groupIsActive = group.items.some(isDirectorRouteActive);
            const isExpanded = groupIsActive || expandedDirectorGroups.has(group.id);
            if (!hasChildren) {
              const item = group.items[0];
              if (!item) return null;
              const IconComponent = item.icon || FileSpreadsheet;
              return <button type="button" key={group.id} className={`nav-item ${isDirectorRouteActive(item) ? 'active' : ''}`} onClick={() => handleItemClick(item)}><IconComponent size={18} /><span style={{ flex: 1 }}>{item.label}</span>{item.badge > 0 && <span className="notif-badge director-nav-badge">{item.badge}</span>}</button>;
            }
            return <div className={`director-nav-group ${groupIsActive ? 'active' : ''}`} key={group.id}><button type="button" className="director-nav-group__trigger" onClick={() => toggleDirectorGroup(group.id)} aria-expanded={isExpanded}><span>{group.label}</span><ChevronDown size={16} className={isExpanded ? 'expanded' : ''} /></button>{isExpanded && <div className="director-nav-group__items">{group.items.map((item) => { const IconComponent = item.icon || FileSpreadsheet; return <button type="button" key={item.id} className={`nav-item ${isDirectorRouteActive(item) ? 'active' : ''}`} onClick={() => handleItemClick(item)}><IconComponent size={17} /><span style={{ flex: 1 }}>{item.label}</span>{item.badge > 0 && <span className="notif-badge director-nav-badge">{item.badge}</span>}</button>; })}</div>}</div>;
          }) : menuItems.map(item => {
            const IconComponent = item.icon || FileSpreadsheet;
            const isActive = currentRole === 'Marketing Team' || currentRole === 'Director'
              ? location.pathname === item.path ||
                (!['/marketing', '/director'].includes(item.path) && location.pathname.startsWith(`${item.path}/`))
              : activeTab === item.id;

            return (
              <button type="button"
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <IconComponent size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span className="notif-badge" style={{ position: 'relative', top: '0', right: '0' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge-sidebar">
            <div className="avatar-circle">
              {(currentUser?.fullName || currentUser?.employeeName || currentUser?.username)?.charAt(0) || 'U'}
            </div>
            <div className="user-info-text">
              <div className="user-name">{currentUser?.fullName || currentUser?.employeeName || currentUser?.username || 'User'}</div>
              <div className="user-role">{currentRole}</div>
            </div>
          </div>

          <button
            className="sidebar-logout-btn icon-btn"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
