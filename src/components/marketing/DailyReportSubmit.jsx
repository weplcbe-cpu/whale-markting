import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, Calculator, Save, Lock, AlertCircle } from 'lucide-react';

export const DailyReportSubmit = () => {
  const { currentUser, visitPlans, customers, followUps, submitDailyReport, companyInfo } = useApp();

  const empId = currentUser?.employeeId || 'EMP001';
  const todayStr = new Date().toISOString().split('T')[0];

  // System Automatic Calculations
  const todayVisits = visitPlans.filter(p => p.employeeId === empId && (p.visitDate === todayStr || p.visitDate === '2026-07-21'));
  const plannedCount = todayVisits.length;
  const completedCount = todayVisits.filter(p => p.status === 'Completed').length;
  const cancelledCount = todayVisits.filter(p => p.status === 'Cancelled').length;
  const newCustomersCount = customers.filter(c => c.createdBy === empId && c.createdDate === todayStr).length;
  const followupsCompletedCount = followUps.filter(f => f.employeeId === empId && f.status === 'Completed').length;

  const [formData, setFormData] = useState({
    date: todayStr,
    importantDiscussion: '',
    pendingActions: '',
    tomorrowPlan: '',
    remarks: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitDailyReport({
      date: formData.date,
      plannedVisits: plannedCount,
      completedVisits: completedCount,
      cancelledVisits: cancelledCount,
      newCustomersAdded: newCustomersCount,
      followUpsCompleted: followupsCompletedCount,
      importantDiscussion: formData.importantDiscussion,
      pendingActions: formData.pendingActions,
      tomorrowPlan: formData.tomorrowPlan,
      remarks: formData.remarks
    });
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><Clock size={18} color="var(--accent-cyan)" /> Submit Daily Summary Report</h3>
          <span className="badge badge-planned">Edit Time Limit: {companyInfo?.reportEditTimeLimitHours ?? 24} Hours</span>
        </div>

        {/* Auto Calculated Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Planned</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{plannedCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#34d399' }}>Completed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{completedCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#fb7185' }}>Cancelled</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fb7185' }}>{cancelledCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(2, 132, 199, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>New Cust</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>{newCustomersCount}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#c084fc' }}>Follow-ups</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c084fc' }}>{followupsCompletedCount}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Report Date *</label>
            <input
              type="date"
              className="form-input"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Important Key Discussions *</label>
            <textarea
              className="form-textarea"
              required
              rows={3}
              placeholder="Highlight key municipal/corporate discussions held today..."
              value={formData.importantDiscussion}
              onChange={(e) => setFormData({ ...formData, importantDiscussion: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Pending Actions / Urgent Tasks</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Detail pending quotation submissions or tender queries..."
              value={formData.pendingActions}
              onChange={(e) => setFormData({ ...formData, pendingActions: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tomorrow's Tour Plan</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Outline target clients & areas for tomorrow..."
              value={formData.tomorrowPlan}
              onChange={(e) => setFormData({ ...formData, tomorrowPlan: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Submit Daily Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DailyReportSubmit;
