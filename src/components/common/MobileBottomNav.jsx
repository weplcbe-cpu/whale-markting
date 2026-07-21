import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Calendar, PlusCircle, Building2, Menu } from 'lucide-react';

export const MobileBottomNav = ({ activeTab, setActiveTab, toggleSidebar }) => {
  const { currentRole } = useApp();

  return (
    <div className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </button>

      {currentRole === 'Marketing Team' ? (
        <>
          <button
            className={`mobile-nav-item ${activeTab === 'visits' || activeTab === 'today-schedule' || activeTab === 'my-plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('visits')}
          >
            <Calendar size={20} />
            <span>Visits</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === 'add-visit-plan' || activeTab === 'weekly-planning' ? 'active' : ''}`}
            onClick={() => setActiveTab('add-visit-plan')}
          >
            <div className="mobile-fab-icon">
              <PlusCircle size={22} color="#fff" />
            </div>
            <span>Add Plan</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === 'customers' || activeTab === 'my-customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Building2 size={20} />
            <span>Customers</span>
          </button>
        </>
      ) : (
        <>
          <button
            className={`mobile-nav-item ${activeTab === 'weekly-plans' || activeTab === 'visit-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly-plans')}
          >
            <Calendar size={20} />
            <span>Plans</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === 'customers-overview' || activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers-overview')}
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
