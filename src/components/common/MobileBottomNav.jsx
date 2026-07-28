import React from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDirectorRouteById, getMarketingRouteById } from '../../routes';
import { LayoutDashboard, Calendar, PlusCircle, Building2, Menu } from 'lucide-react';

export const MobileBottomNav = ({ activeTab, setActiveTab, toggleSidebar }) => {
  const { currentRole } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isMarketing = currentRole === 'Marketing Team';
  const isDirector = currentRole === 'Director';
  const goToMarketing = (id, search = '') => navigate(`${getMarketingRouteById(id).path}${search}`);

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

          <button
            className={`mobile-nav-item ${location.pathname === getMarketingRouteById('customers').path ? 'active' : ''}`}
            onClick={() => goToMarketing('customers')}
          >
            <Building2 size={20} />
            <span>Customers</span>
          </button>
        </>
      ) : isDirector ? (
        <>
          <button className={`mobile-nav-item ${location.pathname === getDirectorRouteById('weekly-plans').path || location.pathname.startsWith(`${getDirectorRouteById('weekly-plans').path}/`) ? 'active' : ''}`} onClick={() => navigate(getDirectorRouteById('weekly-plans').path)}><Calendar size={20} /><span>Plans</span></button>
          <button className={`mobile-nav-item ${location.pathname === getDirectorRouteById('customers').path ? 'active' : ''}`} onClick={() => navigate(getDirectorRouteById('customers').path)}><Building2 size={20} /><span>Customers</span></button>
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

          <button
            className={`mobile-nav-item ${activeTab === 'customer-approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('customer-approvals')}
          >
            <Building2 size={20} />
            <span>Customers</span>
          </button>
        </>
      )}

      <button
        className="mobile-nav-item"
        onClick={toggleSidebar}
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </div>
  );
};
