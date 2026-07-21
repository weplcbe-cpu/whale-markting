import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Calendar, CheckCircle2, Clock, FileText, AlertTriangle, MessageSquare, ArrowRight, Phone } from 'lucide-react';

export const DirectorDashboard = ({ setActiveTab }) => {
  const { users, visitPlans, followUps, tenders, dailyReports, addDirectorComment } = useApp();
  const [filterPeriod, setFilterPeriod] = useState('Today');

  const marketingEmployees = users.filter(u => u.role === 'Marketing Team' && u.status === 'Active');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTeamVisits = visitPlans.filter(p => p.visitDate === todayStr || p.visitDate === '2026-07-21');
  const completedVisits = todayTeamVisits.filter(p => p.status === 'Completed').length;
  const pendingVisits = todayTeamVisits.filter(p => p.status === 'Planned' || p.status === 'Started' || p.status === 'Pending').length;
  const pendingFollowups = followUps.filter(f => f.status === 'Pending').length;

  return (
    <div>
      {/* Quick Filter Period Header */}
      <div className="toolbar-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter Scope:</span>
          {['Today', 'This Week', 'This Month'].map(period => (
            <button
              key={period}
              className={`btn btn-sm ${filterPeriod === period ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('weekly-plans')}>
          <Calendar size={14} /> Review Weekly Tour Plans
        </button>
      </div>

      {/* Director KPI Grid */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => setActiveTab('team-overview')}>
          <div className="stat-icon-wrapper blue"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{marketingEmployees.length}</div>
            <div className="stat-label">Marketing Reps Active</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('today-schedule')}>
          <div className="stat-icon-wrapper amber"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{todayTeamVisits.length}</div>
            <div className="stat-label">Today Team Visits</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('today-schedule')}>
          <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{completedVisits}</div>
            <div className="stat-label">Visits Completed</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('today-schedule')}>
          <div className="stat-icon-wrapper rose"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingVisits}</div>
            <div className="stat-label">Visits Pending</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('follow-ups')}>
          <div className="stat-icon-wrapper purple"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingFollowups}</div>
            <div className="stat-label">Team Follow-ups Due</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('tenders')}>
          <div className="stat-icon-wrapper amber"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{tenders.length}</div>
            <div className="stat-label">Active Tenders</div>
          </div>
        </div>
      </div>

      {/* Marketing Team Overview Cards */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Users size={18} color="var(--accent-cyan)" /> Marketing Team Performance Overview</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('team-overview')}>View Team</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {marketingEmployees.map(emp => {
            const empVisits = visitPlans.filter(p => p.employeeId === emp.employeeId);
            const empCompleted = empVisits.filter(p => p.status === 'Completed').length;
            const empPending = empVisits.filter(p => p.status === 'Planned' || p.status === 'Started').length;

            return (
              <div
                key={emp.id}
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{emp.employeeName}</h4>
                  <span className="badge badge-planned">{emp.employeeId}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} /> {emp.mobile}
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                  <div>Total Visits: <strong>{empVisits.length}</strong></div>
                  <div>Completed: <strong style={{ color: 'var(--accent-emerald)' }}>{empCompleted}</strong></div>
                  <div>Pending: <strong style={{ color: 'var(--accent-rose)' }}>{empPending}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Team Field Schedule Table */}
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Calendar size={18} color="var(--accent-cyan)" /> Today's Field Visit Activity</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('today-schedule')}>
            Full Schedule <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Time</th>
                <th>Area / District</th>
                <th>Customer Organization</th>
                <th>Purpose</th>
                <th>Product</th>
                <th>Live Status</th>
              </tr>
            </thead>
            <tbody>
              {todayTeamVisits.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.employeeName}</strong></td>
                  <td>{p.expectedTime}</td>
                  <td>{p.district || p.city}</td>
                  <td>{p.customerName}</td>
                  <td>{p.visitPurpose}</td>
                  <td>{Array.isArray(p.products) ? p.products.join(', ') : p.products}</td>
                  <td>
                    <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;
