import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { directorNavigation, directorRoutes, marketingRoutes } from '../../routes';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  FileSpreadsheet,
  Clock,
  FileText,
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
  const { currentUser, currentRole, logout, notifications } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedDirectorGroups, setExpandedDirectorGroups] = useState(new Set());

  const unreadNotifsCount = notifications.filter(
    n => !n.isRead && (!n.userId || n.userId === currentUser?.employeeId)
  ).length;

  // Single-source 9-Item Marketing Sidebar Navigation (Zero Duplication)
  const marketingIcons = {
    dashboard: LayoutDashboard,
    customers: Building2,
    visits: Calendar,
    reports: FileSpreadsheet,
    'follow-ups': Clock,
    tenders: FileText,
    'director-comments': MessageSquare,
    profile: User,
  };
  const marketingMenu = marketingRoutes.map(route => ({
    ...route,
    icon: marketingIcons[route.id],
    badge: route.id === 'director-comments' ? unreadNotifsCount : undefined,
  }));

  // Single-source 8-Item Director Sidebar Navigation
  const directorIcons = { dashboard: LayoutDashboard, team: Users, 'today-schedule': Clock, 'weekly-plans': Calendar, 'visit-plans': Calendar, 'visit-reports': FileSpreadsheet, 'daily-reports': FileSpreadsheet, customers: Building2, 'follow-ups': Clock, tenders: FileText, 'product-overview': Package, 'area-overview': Building2, performance: BarChart3, reports: FileSpreadsheet, comments: MessageSquare, notifications: MessageSquare, profile: User };
  const directorMenu = directorRoutes.filter(route => route.nav !== false).map(route => ({ ...route, icon: directorIcons[route.id], badge: route.id === 'notifications' ? unreadNotifsCount : undefined }));
  const directorGroups = directorNavigation.map((group) => ({ ...group, items: group.routeIds.map((id) => directorMenu.find((route) => route.id === id)).filter(Boolean) }));

  // Single-source 8-Item Admin Sidebar Navigation
  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'customer-approvals', label: 'Customer Approvals', icon: Building2 },
    { id: 'products', label: 'Product Catalog', icon: Package },
    { id: 'master-data', label: 'Master Data', icon: Database },
    { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
    { id: 'activity-logs', label: 'Activity Logs', icon: Clock },
    { id: 'settings', label: 'System Settings', icon: User }
  ];

  const menuItems = currentRole === 'Admin'
    ? adminMenu
    : currentRole === 'Director'
    ? directorMenu
    : marketingMenu;

  const handleItemClick = (item) => {
    if (currentRole === 'Marketing Team' || currentRole === 'Director') {
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
            <img
              src="/kaiser-whale-logo.png"
              alt="Kaiser Whale Logo"
              className="sidebar-logo-img"
            />
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
              const IconComponent = item.icon;
              return <button type="button" key={group.id} className={`nav-item ${isDirectorRouteActive(item) ? 'active' : ''}`} onClick={() => handleItemClick(item)}><IconComponent size={18} /><span style={{ flex: 1 }}>{item.label}</span>{item.badge > 0 && <span className="notif-badge director-nav-badge">{item.badge}</span>}</button>;
            }
            return <div className={`director-nav-group ${groupIsActive ? 'active' : ''}`} key={group.id}><button type="button" className="director-nav-group__trigger" onClick={() => toggleDirectorGroup(group.id)} aria-expanded={isExpanded}><span>{group.label}</span><ChevronDown size={16} className={isExpanded ? 'expanded' : ''} /></button>{isExpanded && <div className="director-nav-group__items">{group.items.map((item) => { const IconComponent = item.icon; return <button type="button" key={item.id} className={`nav-item ${isDirectorRouteActive(item) ? 'active' : ''}`} onClick={() => handleItemClick(item)}><IconComponent size={17} /><span style={{ flex: 1 }}>{item.label}</span>{item.badge > 0 && <span className="notif-badge director-nav-badge">{item.badge}</span>}</button>; })}</div>}</div>;
          }) : menuItems.map(item => {
            const IconComponent = item.icon;
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
            className="icon-btn"
            onClick={logout}
            title="Logout"
            style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
