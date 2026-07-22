import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getMarketingRouteById } from '../../routes';
import { Calendar, Building2, Clock, CheckCircle2, UserPlus, PlusCircle, MessageSquare, ArrowRight, TrendingUp } from 'lucide-react';

export const MarketingDashboard = () => {
  const { currentUser, visitPlans, customers, followUps, directorComments } = useApp();
  const navigate = useNavigate();
  const goTo = (id, search = '') => navigate(`${getMarketingRouteById(id).path}${search}`);

  const empId = currentUser?.employeeId || 'EMP001';
  const empName = currentUser?.employeeName || 'Fathima Begum';

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const myTodayVisits = visitPlans.filter(p => p.employeeId === empId && (p.visitDate === '2026-07-21' || p.visitDate === new Date().toISOString().split('T')[0]));
  const myWeeklyPlans = visitPlans.filter(p => p.employeeId === empId);
  const myPendingFollowups = followUps.filter(f => f.employeeId === empId && f.status === 'Pending');
  const myCompletedVisits = visitPlans.filter(p => p.employeeId === empId && p.status === 'Completed').length;
  const myCustomers = customers.filter(c => c.createdBy === empId).length;

  const myDirectorComments = directorComments.filter(c => c.targetEmployeeId === empId);

  return (
    <div>
      {/* Dashboard Hero Section (#27187E → #758BFD) */}
      <div className="hero-welcome-card">
        <div className="hero-text">
          <h2>Good Morning, {empName} 👋</h2>
          <p>📅 {todayStr} &nbsp;•&nbsp; Ready for today's field marketing visits?</p>
        </div>

        {/* Quick Action Buttons */}
        <div className="hero-actions">
          <button className="btn btn-action" onClick={() => goTo('customers', '?action=add-customer')}>
            <UserPlus size={18} /> + Add Customer
          </button>

          <button className="btn btn-secondary" onClick={() => goTo('visits', '?action=add-visit-plan')}>
            <PlusCircle size={18} /> + Add Visit Plan
          </button>

          <button className="btn btn-secondary" onClick={() => goTo('reports')}>
            <Clock size={18} /> Submit Daily Report
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => goTo('visits', '?view=today')}>
          <div className="stat-icon-wrapper orange"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myTodayVisits.length}</div>
            <div className="stat-label">Today Visits</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            <TrendingUp size={12} /> Active
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('visits', '?view=plans')}>
          <div className="stat-icon-wrapper blue"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myWeeklyPlans.length}</div>
            <div className="stat-label">This Week Plans</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 700 }}>
            Scheduled
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('follow-ups')}>
          <div className="stat-icon-wrapper orange"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myPendingFollowups.length}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--action-orange)', fontWeight: 700 }}>
            Due Soon
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('visits', '?view=plans')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myCompletedVisits}</div>
            <div className="stat-label">Completed Visits</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            100% Verified
          </div>
        </div>

        <div className="stat-card" onClick={() => goTo('customers')}>
          <div className="stat-icon-wrapper purple"><Building2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{myCustomers}</div>
            <div className="stat-label">My Customers Added</div>
          </div>
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', fontSize: '0.75rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
            Verified
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Director Feedback */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Today's Schedule */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Calendar size={20} color="var(--primary-blue)" /> Today's Field Visit Schedule</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('visits', '?view=today')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          {myTodayVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No field visits scheduled for today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {myTodayVisits.map(v => (
                <div
                  key={v.id}
                  style={{
                    padding: '18px 22px',
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                      🕒 {v.expectedTime}
                    </span>
                    <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                  </div>

                  <h4 style={{ color: 'var(--primary-dark)', fontSize: '1.2rem', marginBottom: '6px', fontWeight: 800 }}>{v.customerName}</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Purpose: <strong>{v.visitPurpose}</strong> &nbsp;|&nbsp; Product: <strong>{Array.isArray(v.products) ? v.products.join(', ') : v.products}</strong>
                  </p>

                  <button className="btn btn-action btn-sm" onClick={() => goTo('visits', '?view=today')}>
                    Update Visit Status
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Director Feedback Side Card */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><MessageSquare size={20} color="var(--action-orange)" /> Director Feedback</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => goTo('director-comments')}>View</button>
          </div>

          {myDirectorComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments received yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myDirectorComments.map(com => (
                <div
                  key={com.id}
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 134, 0, 0.08)',
                    border: '1.5px solid rgba(255, 134, 0, 0.3)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--action-orange)', marginBottom: '4px' }}>
                    {com.author} ({com.targetModule})
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--primary-dark)', fontWeight: 600 }}>"{com.message}"</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingDashboard;
