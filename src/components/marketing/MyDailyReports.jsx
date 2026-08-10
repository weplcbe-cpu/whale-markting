import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, Clock, Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, PageHeader } from '../ui';

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day.padStart(2, '0')} ${months[monthIdx]} ${year}`;
    }
  }
  return dateStr;
};

export const MyDailyReports = () => {
  const { currentUser, dailyReports, deleteDailyReport } = useApp();
  const navigate = useNavigate();
  const { reportId: routeReportId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  // Delete modal state & double-click protection
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const empId = currentUser?.employeeId || 'EMP001';

  // Filter reports belonging to current logged-in marketing user only
  const myReports = useMemo(() => {
    return dailyReports
      .filter((r) => r.employeeId === empId)
      .sort((a, b) => {
        const timeA = new Date(a.submittedAt || a.createdAt || a.date).getTime() || 0;
        const timeB = new Date(b.submittedAt || b.createdAt || b.date).getTime() || 0;
        return timeB - timeA;
      });
  }, [dailyReports, empId]);

  // Filtered reports for search
  const filteredReports = useMemo(() => {
    if (!search.trim()) return myReports;
    const query = search.toLowerCase();
    return myReports.filter(
      (r) =>
        (r.date || '').toLowerCase().includes(query) ||
        (r.importantDiscussion || '').toLowerCase().includes(query) ||
        (r.pendingActions || '').toLowerCase().includes(query) ||
        (r.tomorrowPlan || '').toLowerCase().includes(query) ||
        (r.status || '').toLowerCase().includes(query)
    );
  }, [myReports, search]);

  // Selected report for Details modal or route
  const activeReportId = routeReportId || searchParams.get('reportId');
  const selectedReport = useMemo(() => {
    if (!activeReportId) return null;
    return myReports.find((r) => String(r.id) === String(activeReportId)) || null;
  }, [activeReportId, myReports]);

  const closeDetails = () => {
    if (routeReportId) {
      navigate('/marketing/reports/daily');
    } else {
      const next = new URLSearchParams(searchParams);
      next.delete('reportId');
      setSearchParams(next, { replace: true });
    }
  };

  const openDetails = (report) => {
    navigate(`/marketing/reports/daily/${report.id}`);
  };

  const openDeleteConfirm = (report) => {
    setReportToDelete(report);
  };

  const closeDeleteConfirm = () => {
    if (deleting) return;
    setReportToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteDailyReport(reportToDelete.id);
      setDeleting(false);
      setReportToDelete(null);

      // If user was viewing the details of the report being deleted, close details modal / navigate back
      if (selectedReport && String(selectedReport.id) === String(reportToDelete.id)) {
        closeDetails();
      }
    } catch {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'date',
      label: 'Report Date',
      render: (row) => <strong>{row.date || 'No date'}</strong>,
    },
    { key: 'plannedVisits', label: 'Planned' },
    {
      key: 'completedVisits',
      label: 'Completed',
      render: (row) => <strong style={{ color: 'var(--accent-emerald)' }}>{row.completedVisits ?? 0}</strong>,
    },
    {
      key: 'cancelledVisits',
      label: 'Cancelled',
      render: (row) => <span style={{ color: 'var(--accent-rose)' }}>{row.cancelledVisits ?? 0}</span>,
    },
    { key: 'followUpsCompleted', label: 'Follow-ups' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.isLocked || row.status === 'Locked' ? 'neutral' : 'success'}>
          {row.status || 'Submitted'}
        </Badge>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Submitted At',
      render: (row) =>
        row.submittedAt ? new Date(row.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A',
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => openDetails(row)}>
            <Eye size={14} /> View Details
          </Button>
          {row.employeeId === empId && !row.isLocked && row.status !== 'Locked' && (
            <Button variant="danger" onClick={() => openDeleteConfirm(row)}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="ds-page">
      <PageHeader
        title="My Daily Reports"
        description="View your submitted daily summaries."
        actions={
          <Button onClick={() => navigate('/marketing/reports/daily/submit')}>
            <Plus size={16} /> Submit Daily Report
          </Button>
        }
      />

      <div className="director-filter-bar" style={{ marginBottom: '16px' }}>
        <div className="director-search" style={{ flex: 1 }}>
          <Search size={17} />
          <FormField
            label="Search reports"
            placeholder="Search by date, discussion, task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredReports}
        empty={
          <EmptyState
            icon={FileText}
            title="No daily reports submitted yet"
            description="Submit your daily summary report after completing field visits."
            action={
              <Button onClick={() => navigate('/marketing/reports/daily/submit')}>
                <Plus size={16} /> Submit Daily Report
              </Button>
            }
          />
        }
      />

      {/* READ-ONLY REPORT DETAILS MODAL / DOCUMENT VIEW */}
      {selectedReport && (
        <Modal
          open={Boolean(selectedReport)}
          onClose={closeDetails}
          title={`Daily Summary Report — ${selectedReport.date || 'Report'}`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button variant="secondary" onClick={closeDetails}>
                <ArrowLeft size={14} /> Back to My Reports
              </Button>
              {selectedReport.employeeId === empId && !selectedReport.isLocked && selectedReport.status !== 'Locked' && (
                <Button variant="danger" onClick={() => openDeleteConfirm(selectedReport)}>
                  <Trash2 size={14} /> Delete Report
                </Button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Document Banner */}
            <div
              style={{
                padding: '14px 18px',
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Report Date</div>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{selectedReport.date}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Badge tone={selectedReport.isLocked || selectedReport.status === 'Locked' ? 'neutral' : 'success'}>
                  {selectedReport.status || 'Submitted'}
                </Badge>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Submitted at:{' '}
                  {selectedReport.submittedAt
                    ? new Date(selectedReport.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* KPI Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Planned</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedReport.plannedVisits ?? 0}</div>
              </div>

              <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#34d399' }}>Completed</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{selectedReport.completedVisits ?? 0}</div>
              </div>

              <div style={{ padding: '10px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#fb7185' }}>Cancelled</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fb7185' }}>{selectedReport.cancelledVisits ?? 0}</div>
              </div>

              <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.12)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#c084fc' }}>Follow-ups</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c084fc' }}>{selectedReport.followUpsCompleted ?? 0}</div>
              </div>
            </div>

            {/* Report Content Sections */}
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Important Key Discussions
              </div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                {selectedReport.importantDiscussion || 'No discussions recorded.'}
              </p>
            </div>

            {selectedReport.pendingActions && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Pending Actions / Urgent Tasks
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedReport.pendingActions}
                </p>
              </div>
            )}

            {selectedReport.tomorrowPlan && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Tomorrow's Tour Plan
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedReport.tomorrowPlan}
                </p>
              </div>
            )}

            {selectedReport.remarks && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Remarks / Internal Notes
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedReport.remarks}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {reportToDelete && (
        <Modal
          open={Boolean(reportToDelete)}
          onClose={closeDeleteConfirm}
          title="Delete Daily Report"
          className="ds-modal--compact-delete"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="secondary" onClick={closeDeleteConfirm} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Report'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to delete this daily report?
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Report Date</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 600 }}>
                {formatDateDisplay(reportToDelete.date)}
              </strong>
            </div>

          </div>
        </Modal>
      )}

      {/* Handle Invalid URL Report ID */}
      {activeReportId && !selectedReport && (
        <Modal
          open
          title="Report Details"
          onClose={closeDetails}
          footer={
            <Button variant="secondary" onClick={closeDetails}>
              Close
            </Button>
          }
        >
          <div className="ds-error">This report was not found or is not available.</div>
        </Modal>
      )}
    </div>
  );
};

export default MyDailyReports;
