import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSearchParams } from 'react-router-dom';
import { FileText, MessageSquare, Eye, Clock, X } from 'lucide-react';
import { ModalPortal } from '../ui';

export const DirectorVisitReports = () => {
  const { visitReports, dailyReports, addDirectorComment } = useApp();
  const [activeTab, setActiveTab] = useState('visit-reports');
  const [selectedReport, setSelectedReport] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const reportName = (report) => report?.fullName || report?.employeeName || 'Marketing Employee';

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    if (!reportId) return;
    const report = visitReports.find((item) => String(item.id) === reportId);
    if (report) {
      setActiveTab('visit-reports');
      setSelectedReport(report);
    }
  }, [searchParams, visitReports]);

  const closeReport = () => {
    setSelectedReport(null);
    if (searchParams.has('reportId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('reportId');
      setSearchParams(next, { replace: true });
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    await addDirectorComment({
      targetEmployeeId: selectedReport.employeeId,
      targetEmployeeName: reportName(selectedReport),
      targetModule: activeTab === 'visit-reports' ? 'Visit Report' : 'Daily Report',
      referenceId: selectedReport.id,
      message: commentText
    });

    setCommentText('');
    closeReport();
  };

  return (
    <div>
      <div className="toolbar-bar" style={{ justifyContent: 'flex-start', gap: '12px' }}>
        <button
          className={`btn ${activeTab === 'visit-reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('visit-reports')}
        >
          <FileText size={16} /> Field Visit Outcome Reports ({visitReports.length})
        </button>

        <button
          className={`btn ${activeTab === 'daily-reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('daily-reports')}
        >
          <Clock size={16} /> Daily Summary Reports ({dailyReports.length})
        </button>
      </div>

      {activeTab === 'visit-reports' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><FileText size={18} color="var(--accent-cyan)" /> Submitted Visit Outcome Reports</h3>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Visit Date</th>
                  <th>Customer Organization</th>
                  <th>Customer Response</th>
                  <th>Next Action</th>
                  <th>Follow-up Date</th>
                  <th>Final Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitReports.length === 0 && <tr><td colSpan="8"><div className="ds-empty"><h3>No visit reports have been submitted yet.</h3><p>Completed field visit reports will appear here automatically.</p></div></td></tr>}
                {visitReports.map(rep => (
                  <tr key={rep.id}>
                    <td><strong>{reportName(rep)}</strong></td>
                    <td>{rep.visitDate}</td>
                    <td>{rep.customerName}</td>
                    <td>
                      <span className="badge badge-planned">{rep.customerResponse}</span>
                    </td>
                    <td>{rep.nextAction}</td>
                    <td>{rep.followUpDate || 'N/A'}</td>
                    <td>
                      <span className="badge badge-completed">{rep.finalStatus}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReport(rep)}>
                        <Eye size={14} /> Inspect & Comment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'daily-reports' && (
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title-clean"><Clock size={18} color="var(--accent-amber)" /> Daily Team Summary Reports</h3>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Planned</th>
                  <th>Completed</th>
                  <th>Cancelled</th>
                  <th>Important Discussion</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.length === 0 && <tr><td colSpan="7"><div className="ds-empty"><h3>No daily reports have been submitted yet.</h3><p>Marketing daily summaries will appear here automatically.</p></div></td></tr>}
                {dailyReports.map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.date}</strong></td>
                    <td>{d.employeeName}</td>
                    <td>{d.plannedVisits}</td>
                    <td><strong style={{ color: 'var(--accent-emerald)' }}>{d.completedVisits}</strong></td>
                    <td><span style={{ color: 'var(--accent-rose)' }}>{d.cancelledVisits}</span></td>
                    <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.importantDiscussion}
                    </td>
                    <td>
                      <span className={`badge ${d.isLocked ? 'badge-rejected' : 'badge-approved'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {selectedReport && (
        <ModalPortal onClose={closeReport}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Visit Report Inspection - {selectedReport.customerName}</h3>
              <button onClick={closeReport} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><strong>Employee Rep:</strong> {reportName(selectedReport)}</div>
              <div><strong>Actual Meeting Time:</strong> {selectedReport.actualTime}</div>
              <div><strong>Customer Response:</strong> <span className="badge badge-planned">{selectedReport.customerResponse}</span></div>
              <div><strong>Discussion Notes:</strong> {selectedReport.discussionNotes}</div>
              <div><strong>Requirement Details:</strong> {selectedReport.requirementDetails}</div>
              <div><strong>Next Action:</strong> {selectedReport.nextAction}</div>

              {/* Photos & Docs Mock */}
              {selectedReport.photos && selectedReport.photos.length > 0 && (
                <div>
                  <strong>Uploaded Site Photos:</strong>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    {selectedReport.photos.map((url, i) => (
                      <img key={i} src={url} alt="Site" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Add Director Comment Form */}
              <form onSubmit={handlePostComment} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="form-label"><MessageSquare size={14} style={{ display: 'inline' }} /> Post Director Comment to {reportName(selectedReport)}</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter instructions or guidance (e.g. Collect Recycler requirement details during follow up)..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  Send Comment to Rep
                </button>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default DirectorVisitReports;
