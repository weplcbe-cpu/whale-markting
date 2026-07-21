import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, Plus, Trash2, Save, Send, Calendar, CheckCircle2, Clock } from 'lucide-react';

export const WeeklyPlanningSheet = () => {
  const { currentUser, customers, products, purposes, addVisitPlan, showToast } = useApp();

  const [employeeName] = useState(currentUser?.employeeName || 'Fathima Begum');
  const [weekFrom, setWeekFrom] = useState('2026-08-03');
  const [weekTo, setWeekTo] = useState('2026-08-10');
  const [overallStatus, setOverallStatus] = useState('Draft'); // Draft, Submitted for Approval, Approved

  const [rows, setRows] = useState([
    {
      id: 'row-1',
      visitDate: '2026-08-03',
      expectedTime: '10:30 AM',
      area: 'Tirunelveli',
      state: 'Tamil Nadu',
      district: 'Tirunelveli',
      city: 'Tirunelveli',
      customerId: customers[0]?.id || 'c1',
      customerName: 'Corporation Office',
      visitPurpose: 'Product Discussion',
      productName: 'Whale Super Sucker',
      requirement: 'Super Sucker Hiring Project',
      priority: 'High',
      status: 'Draft'
    },
    {
      id: 'row-2',
      visitDate: '2026-08-04',
      expectedTime: '11:00 AM',
      area: 'Thoothukudi',
      state: 'Tamil Nadu',
      district: 'Thoothukudi',
      city: 'Thoothukudi',
      customerId: customers[1]?.id || 'c2',
      customerName: 'Municipality',
      visitPurpose: 'New Requirement',
      productName: 'Whale Recycler',
      requirement: 'Super Sucker, Recycler Hiring',
      priority: 'Medium',
      status: 'Draft'
    },
    {
      id: 'row-3',
      visitDate: '2026-08-05',
      expectedTime: '02:30 PM',
      area: 'Dindigul',
      state: 'Tamil Nadu',
      district: 'Dindigul',
      city: 'Dindigul',
      customerId: '',
      customerName: 'Customer Site',
      visitPurpose: 'Service Visit',
      productName: 'All SUV Whale',
      requirement: 'Service / New Requirement',
      priority: 'Low',
      status: 'Draft'
    }
  ]);

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        visitDate: '2026-08-06',
        expectedTime: '10:00 AM',
        area: 'Madurai',
        state: 'Tamil Nadu',
        district: 'Madurai',
        city: 'Madurai',
        customerId: '',
        customerName: 'Madurai Smart City Corp',
        visitPurpose: 'Product Demo',
        productName: 'Whale Jetting Machine',
        requirement: 'Jetting Unit Purchase Proposal',
        priority: 'High',
        status: 'Draft'
      }
    ]);
    showToast('New visit entry added to sheet', 'info');
  };

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      showToast('Weekly plan must contain at least one visit entry', 'warning');
      return;
    }
    setRows(rows.filter(r => r.id !== id));
    showToast('Visit entry removed', 'info');
  };

  const handleRowChange = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveDraft = () => {
    setOverallStatus('Draft');
    showToast('Weekly plan saved as Draft successfully. You can continue editing later.', 'info');
  };

  const handleSubmitForApproval = (e) => {
    e.preventDefault();
    setOverallStatus('Submitted for Approval');

    // Create visit plans in system
    rows.forEach(r => {
      addVisitPlan({
        visitDate: r.visitDate,
        expectedTime: r.expectedTime,
        area: r.area,
        state: r.state,
        district: r.district || r.area,
        city: r.city || r.area,
        customerId: r.customerId || 'cust-1',
        customerName: r.customerName,
        visitPurpose: r.visitPurpose,
        products: [r.productName],
        priority: r.priority,
        requirement: r.requirement || `${r.visitPurpose} for ${r.productName}`,
        status: 'Planned'
      });
    });

    setRows(prev => prev.map(r => ({ ...r, status: 'Planned' })));
    showToast(`Weekly Tour Plan (${weekFrom} to ${weekTo}) with ${rows.length} visits submitted to Director & Admin for approval!`, 'success');
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header-clean">
          <div>
            <h3 className="card-title-clean">
              <FileSpreadsheet size={22} color="var(--primary-blue)" /> Weekly Visit Planning Sheet
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Create, manage, and submit tour schedule for upcoming week to Director & Admin
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Plan Status:</span>
            <span className={`badge ${overallStatus === 'Approved' ? 'badge-completed' : overallStatus === 'Submitted for Approval' ? 'badge-started' : 'badge-planned'}`}>
              {overallStatus}
            </span>
          </div>
        </div>

        {/* Weekly Plan Header (12-Column Responsive Grid) */}
        <div className="form-grid-12" style={{ marginBottom: '24px', background: 'rgba(39, 24, 126, 0.03)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div className="col-4">
            <div className="form-group">
              <label className="form-label">Employee Name</label>
              <input
                type="text"
                className="form-input"
                disabled
                value={employeeName}
                style={{ background: '#ffffff', fontWeight: 800, color: 'var(--primary-dark)' }}
              />
            </div>
          </div>

          <div className="col-4">
            <div className="form-group">
              <label className="form-label">Week From *</label>
              <input
                type="date"
                className="form-input"
                value={weekFrom}
                onChange={(e) => setWeekFrom(e.target.value)}
              />
            </div>
          </div>

          <div className="col-4">
            <div className="form-group">
              <label className="form-label">Week To *</label>
              <input
                type="date"
                className="form-input"
                value={weekTo}
                onChange={(e) => setWeekTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitForApproval}>
          <div className="table-responsive" style={{ marginBottom: '24px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '135px' }}>Visit Date</th>
                  <th style={{ width: '110px' }}>Time</th>
                  <th style={{ width: '130px' }}>Area / City</th>
                  <th style={{ width: '200px' }}>Customer / Organization</th>
                  <th style={{ width: '160px' }}>Visit Purpose</th>
                  <th style={{ width: '170px' }}>Products</th>
                  <th style={{ width: '180px' }}>Requirement / Project</th>
                  <th style={{ width: '110px' }}>Priority</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="date"
                        className="form-input"
                        style={{ height: '42px', minHeight: '42px', padding: '0 8px', fontSize: '0.84rem' }}
                        value={row.visitDate}
                        onChange={(e) => handleRowChange(row.id, 'visitDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '42px', minHeight: '42px', padding: '0 8px', fontSize: '0.84rem' }}
                        placeholder="10:30 AM"
                        value={row.expectedTime}
                        onChange={(e) => handleRowChange(row.id, 'expectedTime', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '42px', minHeight: '42px', padding: '0 10px', fontSize: '0.86rem' }}
                        placeholder="Area"
                        value={row.area}
                        onChange={(e) => handleRowChange(row.id, 'area', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '42px', minHeight: '42px', padding: '0 10px', fontSize: '0.86rem' }}
                        placeholder="Customer / Org"
                        value={row.customerName}
                        onChange={(e) => handleRowChange(row.id, 'customerName', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ height: '42px', minHeight: '42px', padding: '0 8px', fontSize: '0.84rem' }}
                        value={row.visitPurpose}
                        onChange={(e) => handleRowChange(row.id, 'visitPurpose', e.target.value)}
                      >
                        {purposes.map((p, i) => (
                          <option key={i} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ height: '42px', minHeight: '42px', padding: '0 8px', fontSize: '0.84rem' }}
                        value={row.productName}
                        onChange={(e) => handleRowChange(row.id, 'productName', e.target.value)}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '42px', minHeight: '42px', padding: '0 10px', fontSize: '0.84rem' }}
                        placeholder="Requirement details"
                        value={row.requirement}
                        onChange={(e) => handleRowChange(row.id, 'requirement', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ height: '42px', minHeight: '42px', padding: '0 6px', fontSize: '0.84rem' }}
                        value={row.priority}
                        onChange={(e) => handleRowChange(row.id, 'priority', e.target.value)}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge badge-${row.status.toLowerCase()}`}>{row.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ width: '34px', height: '34px', padding: 0, borderRadius: '50%' }}
                        onClick={() => handleRemoveRow(row.id)}
                        title="Delete Entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddRow}
            >
              <Plus size={16} /> + Add Visit Entry
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveDraft}
              >
                <Save size={16} /> Save as Draft
              </button>

              <button
                type="submit"
                className="btn btn-action btn-lg"
              >
                <Send size={18} /> Submit for Director Approval
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
