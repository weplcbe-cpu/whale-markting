import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Download, Printer, BarChart3 } from 'lucide-react';
import { CompanyLogo } from '../common/CompanyLogo';

export const ReportsExport = () => {
  const { visitPlans, dailyReports, showToast } = useApp();
  const [reportType, setReportType] = useState('daily');
  const [dateFilter, setDateFilter] = useState('This Month');

  const handleExportCSV = () => {
    let filename = `whale_enterprise_${reportType}_report.csv`;
    let headers = [];
    let rows = [];

    if (reportType === 'daily') {
      headers = ['ID', 'Date', 'Employee', 'Planned Visits', 'Completed Visits', 'Cancelled Visits', 'Status'];
      rows = dailyReports.map(r => [r.id, r.date, `"${r.employeeName}"`, r.plannedVisits, r.completedVisits, r.cancelledVisits, r.status]);
    } else if (reportType === 'visit') {
      headers = ['ID', 'Date', 'Employee', 'Customer / Organization', 'Purpose', 'Product', 'Status'];
      rows = visitPlans.map(p => [p.id, p.visitDate, `"${p.employeeName}"`, `"${p.customerName || p.organizationName || ''}"`, `"${p.visitPurpose}"`, `"${Array.isArray(p.products) ? p.products.join('; ') : p.products}"`, p.status]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Report exported successfully as ${filename}`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <select
            className="form-select"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="daily">Daily Summary Report</option>
            <option value="visit">Visit Plan & Field Report</option>
          </select>

          <select
            className="form-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
            <option value="All Time">All Time</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>

          <button className="btn btn-primary" onClick={handleExportCSV}>
            <Download size={16} /> Export (Excel / CSV)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="report-brand">
          <CompanyLogo />
          <span>Whale Enterprise PVT Ltd</span>
        </div>
        <div className="card-header-clean">
          <h3 className="card-title-clean">
            <BarChart3 size={18} color="var(--accent-cyan)" />
            {reportType === 'daily' && 'Daily Team Activity Report'}
            {reportType === 'visit' && 'Field Visit Performance Report'}
          </h3>
        </div>

        {reportType === 'daily' && (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Planned</th>
                  <th>Completed</th>
                  <th>Cancelled</th>
                  <th>Follow-ups</th>
                  <th>Report Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.date}</strong></td>
                    <td>{r.employeeName}</td>
                    <td>{r.plannedVisits}</td>
                    <td><strong style={{ color: 'var(--accent-emerald)' }}>{r.completedVisits}</strong></td>
                    <td><span style={{ color: 'var(--accent-rose)' }}>{r.cancelledVisits}</span></td>
                    <td>{r.followUpsCompleted}</td>
                    <td>
                      <span className={`badge ${r.isLocked ? 'badge-rejected' : 'badge-approved'}`}>
                        {r.isLocked ? 'Locked' : 'Submitted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'visit' && (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Visit Date</th>
                  <th>Employee</th>
                  <th>Customer / Organization</th>
                  <th>Purpose</th>
                  <th>Products</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visitPlans.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.visitDate}</strong></td>
                    <td>{p.employeeName}</td>
                    <td>{p.customerName || p.organizationName || 'Not provided'}</td>
                    <td>{p.visitPurpose}</td>
                    <td>{Array.isArray(p.products) ? p.products.join(', ') : p.products}</td>
                    <td><span className={`badge badge-${p.priority.toLowerCase()}`}>{p.priority}</span></td>
                    <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsExport;
