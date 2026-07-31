import React from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDirectorRouteById, getMarketingRouteById } from '../../routes';
import { LayoutDashboard, Calendar, PlusCircle, FileText, Menu } from 'lucide-react';

export const MobileBottomNav = ({ activeTab, setActiveTab, toggleSidebar }) => {
  const { currentRole } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide bottom nav for Director role (control center tile navigation is used)
  if (currentRole === 'Director') {
    return null;
  }

  return (
    <div className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${(isMarketing ? location.pathname === '/marketing' : activeTab === 'dashboard') ? 'active' : ''}`}
        onClick={() => isMarketing ? goToMarketing('dashboard') : isDirector ? navigate('/director') : setActiveTab('dashboard')}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </button>

      {currentRole === 'Marketing Team' ? (
        <>
          <button
            className={`mobile-nav-item ${location.pathname === getMarketingRouteById('visits').path ? 'active' : ''}`}
            onClick={() => goToMarketing('visits')}
          >
            <Calendar size={20} />
            <span>Visits</span>
          </button>

          <button
            className={`mobile-nav-item ${location.pathname === getMarketingRouteById('visits').path && location.search.includes('action=add-visit-plan') ? 'active' : ''}`}
            onClick={() => goToMarketing('visits', '?action=add-visit-plan')}
          >
            <div className="mobile-fab-icon">
              <PlusCircle size={22} color="#fff" />
            </div>
            <span>Add Plan</span>
          </button>

          <button className={`mobile-nav-item ${location.pathname === getMarketingRouteById('reports').path ? 'active' : ''}`} onClick={() => goToMarketing('reports')}><FileText size={20} /><span>Reports</span></button>
        </>
      ) : isDirector ? (
        <>
          <button className={`mobile-nav-item ${location.pathname === getDirectorRouteById('weekly-plans').path || location.pathname.startsWith(`${getDirectorRouteById('weekly-plans').path}/`) ? 'active' : ''}`} onClick={() => navigate(getDirectorRouteById('weekly-plans').path)}><Calendar size={20} /><span>Plans</span></button>
          <button className={`mobile-nav-item ${location.pathname === getDirectorRouteById('notifications').path ? 'active' : ''}`} onClick={() => navigate(getDirectorRouteById('notifications').path)}><FileText size={20} /><span>Updates</span></button>
        </>
      ) : (
        <>
          <button
            className={`mobile-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <Calendar size={20} />
            <span>Reports</span>
          </button>

          <button className={`mobile-nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`} onClick={() => setActiveTab('activity-logs')}><FileText size={20} /><span>Activity</span></button>
        </>
      )}

      <button
        className="mobile-nav-item"
        onClick={toggleSidebar}
      >
        <span className="mobile-nav-icon-with-badge"><Menu size={20} />{isMarketing && unreadFeedbackCount > 0 && <span className="notif-badge">{unreadFeedbackCount}</span>}</span>
        <span>Menu</span>
      </button>
    </div>
  );
};
