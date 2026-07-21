import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Award, Package, MapPin, TrendingUp, BarChart3 } from 'lucide-react';

export const PerformanceAnalytics = () => {
  const { products, visitPlans, customers, users, dailyReports, followUps } = useApp();
  const [activeTab, setActiveTab] = useState('products');

  const marketingReps = users.filter(u => u.role === 'Marketing Team' && u.status === 'Active');

  // Compute product-wise visit metrics
  const productStats = products.map(prod => {
    const matchingVisits = visitPlans.filter(p => {
      const prods = Array.isArray(p.products) ? p.products : [p.products];
      return prods.includes(prod.name);
    });
    return {
      ...prod,
      visitCount: matchingVisits.length,
      completedCount: matchingVisits.filter(p => p.status === 'Completed').length
    };
  });

  return (
    <div>
      <div className="toolbar-bar" style={{ justifyContent: 'flex-start', gap: '12px' }}>
        <button
          className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} /> Product Demand Overview
        </button>

        <button
          className={`btn ${activeTab === 'areas' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('areas')}
        >
          <MapPin size={16} /> Area Activity Overview
        </button>

        <button
          className={`btn ${activeTab === 'performance' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('performance')}
        >
          <Award size={16} /> Marketing Team Scorecard
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Package size={18} color="var(--accent-cyan)" /> Machinery Product Interest Breakdown</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {productStats.map(p => (
              <div key={p.id} className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', marginBottom: '4px' }}>{p.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>{p.category}</p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                  <span>Total Enquiries / Visits:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{p.visitCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', marginTop: '6px' }}>
                  <span>Completed Demos / Meetings:</span>
                  <strong style={{ color: 'var(--accent-emerald)' }}>{p.completedCount}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'areas' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><MapPin size={18} color="var(--accent-amber)" /> District & Area Activity Distribution</h3>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>District / Region</th>
                  <th>State</th>
                  <th>Total Field Visits</th>
                  <th>New Customers Added</th>
                </tr>
              </thead>
              <tbody>
                {['Coimbatore', 'Tirunelveli', 'Thoothukudi', 'Dindigul', 'Madurai'].map((dist, i) => {
                  const distVisits = visitPlans.filter(p => p.district === dist).length;
                  const distCusts = customers.filter(c => c.district === dist).length;
                  return (
                    <tr key={i}>
                      <td><strong>{dist}</strong></td>
                      <td>Tamil Nadu</td>
                      <td><span className="badge badge-planned">{distVisits} Visits</span></td>
                      <td><span className="badge badge-approved">{distCusts} Customers</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Award size={18} color="var(--accent-purple)" /> Balanced Performance Index</h3>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Emp ID</th>
                  <th>Plans Total</th>
                  <th>Visits Completed</th>
                  <th>Reports Submitted</th>
                  <th>Follow-ups Completed</th>
                  <th>Performance Score</th>
                </tr>
              </thead>
              <tbody>
                {marketingReps.map(rep => {
                  const empVisits = visitPlans.filter(p => p.employeeId === rep.employeeId);
                  const empCompleted = empVisits.filter(p => p.status === 'Completed').length;
                  const empReports = dailyReports.filter(d => d.employeeId === rep.employeeId).length;
                  const empFollowups = followUps.filter(f => f.employeeId === rep.employeeId && f.status === 'Completed').length;
                  
                  // Score calculation based on completion rate & reports compliance
                  const completionRate = empVisits.length > 0 ? (empCompleted / empVisits.length) * 100 : 80;
                  const score = Math.min(100, Math.round(completionRate * 0.6 + empReports * 15 + empFollowups * 10));

                  return (
                    <tr key={rep.id}>
                      <td><strong>{rep.employeeName}</strong></td>
                      <td><code>{rep.employeeId}</code></td>
                      <td>{empVisits.length}</td>
                      <td><strong style={{ color: 'var(--accent-emerald)' }}>{empCompleted}</strong></td>
                      <td>{empReports}</td>
                      <td>{empFollowups}</td>
                      <td>
                        <span className={`badge ${score >= 80 ? 'badge-approved' : 'badge-medium'}`} style={{ fontSize: '0.9rem' }}>
                          {score} / 100
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceAnalytics;
