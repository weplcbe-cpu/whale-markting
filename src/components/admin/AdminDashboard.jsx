import React from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

export const AdminDashboard = ({ setActiveTab }) => {
  const { users, visitPlans, followUps, activityLogs } = useApp();

  const totalMarketingTeam = users.filter(u => u.role === 'Marketing Team' && u.status === 'Active').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisits = visitPlans.filter(p => p.visitDate === todayStr);
  const completedVisits = todayVisits.filter(p => p.status === 'Completed').length;
  const pendingVisits = todayVisits.filter(p => p.status === 'Planned' || p.status === 'Started' || p.status === 'Pending').length;
  const pendingFollowups = followUps.filter(f => f.status === 'Pending').length;

  return (
    <div className="admin-dashboard">
      {/* KPI Cards Header */}
      <div className="stat-grid">
        <div className="stat-card kw-glass-card" onClick={() => setActiveTab('users')}>
          <div className="stat-icon-wrapper blue"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{totalMarketingTeam}</div>
            <div className="stat-label">Marketing Team Members</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => setActiveTab('reports')}>
          <div className="stat-icon-wrapper amber"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{todayVisits.length}</div>
            <div className="stat-label">Today Visit Plans</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => setActiveTab('reports')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{completedVisits}</div>
            <div className="stat-label">Completed Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => setActiveTab('reports')}>
          <div className="stat-icon-wrapper rose"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingVisits}</div>
            <div className="stat-label">Pending Visits</div>
          </div>
        </div>

        <div className="stat-card kw-glass-card" onClick={() => setActiveTab('reports')}>
          <div className="stat-icon-wrapper purple"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingFollowups}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Overview & System Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Today's Schedule Oversight */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Calendar size={18} color="var(--primary-blue)" /> Today's Field Visit Schedule</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('reports')}>
              View All Plans <ArrowRight size={14} />
            </button>
          </div>

          {todayVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No visits scheduled for today.</p>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Marketing Rep</th>
                    <th>Time</th>
                    <th>Customer / Organization</th>
                    <th>Purpose</th>
                    <th>Product</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayVisits.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.employeeName}</strong></td>
                      <td>{v.expectedTime}</td>
                      <td>{v.customerName}</td>
                      <td>{v.visitPurpose}</td>
                      <td>{Array.isArray(v.products) ? v.products.join(', ') : v.products}</td>
                      <td>
                        <span className={`badge badge-${v.status.toLowerCase()}`}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Activity Stream */}
        <div className="card kw-glass-card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Clock size={18} color="var(--action-orange)" /> Recent System Logs</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('activity-logs')}>Logs</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activityLogs.slice(0, 5).map(log => (
              <div
                key={log.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--kw-bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid var(--color-primary)'
                }}
              >
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{log.action}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{log.userLabel}</span>
                  <span>{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
