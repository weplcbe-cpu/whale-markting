import React from 'react';
import { useApp } from '../../context/AppContext';
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
  X
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, isMobileOpen, toggleSidebar }) => {
  const { currentUser, currentRole, logout, notifications } = useApp();

  const unreadNotifsCount = notifications.filter(
    n => !n.isRead && (!n.userId || n.userId === currentUser?.employeeId)
  ).length;

  // Single-source 9-Item Marketing Sidebar Navigation (Zero Duplication)
  const marketingMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Building2 },
    { id: 'visits', label: 'Visits', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'follow-ups', label: 'Follow-ups', icon: Clock },
    { id: 'tenders', label: 'Tenders', icon: FileText },
    { id: 'director-comments', label: 'Director Comments', icon: MessageSquare, badge: unreadNotifsCount },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Single-source 8-Item Director Sidebar Navigation
  const directorMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'team-overview', label: 'Marketing Team', icon: Users },
    { id: 'weekly-plans', label: 'Weekly Plans Review', icon: Calendar },
    { id: 'visit-reports', label: 'Visit Reports', icon: FileSpreadsheet },
    { id: 'customers-overview', label: 'Customers Overview', icon: Building2 },
    { id: 'tenders-monitoring', label: 'Tender Monitoring', icon: FileText },
    { id: 'performance', label: 'Performance Analytics', icon: BarChart3 },
    { id: 'director-comments', label: 'Comments History', icon: MessageSquare, badge: unreadNotifsCount },
    { id: 'profile', label: 'My Profile', icon: User }
  ];

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

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (toggleSidebar && isMobileOpen) {
      toggleSidebar();
    }
  };

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
          {menuItems.map(item => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id ||
              (item.id === 'visits' && ['visits', 'today-schedule', 'my-plans', 'add-visit-plan', 'weekly-planning'].includes(activeTab)) ||
              (item.id === 'customers' && ['customers', 'my-customers', 'add-customer', 'customers-hub'].includes(activeTab)) ||
              (item.id === 'reports' && ['reports', 'daily-report', 'reports-hub'].includes(activeTab));

            return (
              <div
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
              >
                <IconComponent size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span className="notif-badge" style={{ position: 'relative', top: '0', right: '0' }}>
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge-sidebar">
            <div className="avatar-circle">
              {currentUser?.employeeName?.charAt(0) || 'U'}
            </div>
            <div className="user-info-text">
              <div className="user-name">{currentUser?.employeeName || 'User'}</div>
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
