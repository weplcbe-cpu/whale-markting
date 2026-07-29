import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { History, Download } from 'lucide-react';

export const ActivityLogs = () => {
  const { activityLogs, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = (log.userLabel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.action || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const exportCSV = () => {
    const headers = ['ID', 'User', 'Module', 'Action', 'Timestamp'];
    const rows = filteredLogs.map(l => [l.id, `"${l.userLabel}"`, `"${l.module}"`, `"${l.action}"`, `"${l.timestamp}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Activity logs exported to CSV', 'success');
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div className="toolbar-filters">
          <div className="input-with-icon" style={{ minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search User or Action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="All">All Modules</option>
            <option value="Authentication">Authentication</option>
            <option value="User Management">User Management</option>
            <option value="Visit Plan">Visit Plan</option>
            <option value="Daily Report">Daily Report</option>
            <option value="Director Comments">Director Comments</option>
          </select>
        </div>

        <button className="btn btn-secondary" onClick={exportCSV}>
          <Download size={16} /> Export Logs (CSV)
        </button>
      </div>

      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><History size={18} color="var(--accent-cyan)" /> Audit Activity Logs</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{filteredLogs.length} Events Recorded</span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                  <td><strong>{log.userLabel}</strong></td>
                  <td><span className="badge badge-planned">{log.module}</span></td>
                  <td>{log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
