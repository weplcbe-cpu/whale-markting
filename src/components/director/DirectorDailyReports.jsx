import React, { useEffect, useState } from 'react';
import { Eye, FileText, MessageSquare } from 'lucide-react';
import { Badge, Button, EmptyState, Modal } from '../ui';
import { AddCommentButton, EntityDetailsModal } from '../common/details';

const LEGACY_DETAIL_PRESENTATION = false;

const dash = '—';

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return dash;
  return String(value).trim();
};

const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (match && String(value).length <= 10) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : dash;
};

const formatDateTime = (value) => {
  const date = parseLocalDate(value);
  if (!date) return dash;
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  return `${day} • ${time}`;
};

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'submitted') return 'success';
  if (normalized === 'reviewed') return 'info';
  if (normalized === 'locked') return 'warning';
  if (normalized === 'reopened') return 'danger';
  return 'neutral';
};

const ReportStatus = ({ report }) => {
  const label = textValue(report.status);
  return <Badge tone={statusTone(report.status)}>{report.isLocked ? 'Locked' : label}</Badge>;
};

const Metric = ({ tone, label, value }) => (
  <div className={`daily-report-kpi daily-report-kpi--${tone}`}>
    <span>{label}</span>
    <strong>{numberValue(value)}</strong>
  </div>
);

const DailyReportDetails = ({ report, employeeName, onClose, onComment }) => {
  if (!report) return null;
  const name = employeeName(report.employeeId, report.fullName || report.employeeName);
  const reportDate = formatDate(report.date || report.reportDate);
  return (
    <Modal
      open
      size="daily-report"
      title="Daily Report Details"
      subtitle={<span className="daily-report-modal-subtitle">{name} <span aria-hidden="true">•</span> {reportDate} <ReportStatus report={report} /></span>}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => onComment(report)}><MessageSquare size={16} aria-hidden="true" /> Add Comment</Button></>}
    >
      <div className="daily-report-details">
        <section aria-labelledby="daily-report-employee-heading">
          <h3 id="daily-report-employee-heading">Employee &amp; Submission</h3>
          <dl className="daily-report-facts">
            <div><dt>Employee</dt><dd>{textValue(name)}</dd></div>
            <div><dt>Employee ID</dt><dd>{textValue(report.employeeId)}</dd></div>
            <div><dt>Report Date</dt><dd>{reportDate}</dd></div>
            <div><dt>Submitted At</dt><dd>{formatDateTime(report.submittedAt)}</dd></div>
            <div><dt>Last Updated</dt><dd>{formatDateTime(report.updatedAt)}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="daily-report-summary-heading">
          <h3 id="daily-report-summary-heading">Daily Visit Summary</h3>
          <div className="daily-report-kpis">
            <Metric tone="planned" label="Planned Visits" value={report.plannedVisits} />
            <Metric tone="completed" label="Completed Visits" value={report.completedVisits} />
            <Metric tone="cancelled" label="Cancelled Visits" value={report.cancelledVisits} />
            <Metric tone="customers" label="New Customers Added" value={report.newCustomersAdded ?? report.newCustomers} />
          </div>
        </section>

        <section aria-labelledby="daily-report-activity-heading">
          <h3 id="daily-report-activity-heading">Activity Summary</h3>
          <div className="daily-report-narratives">
            <article><h4>Important Discussion</h4><p>{textValue(report.importantDiscussion)}</p></article>
            <article><h4>Pending Actions</h4><p>{textValue(report.pendingActions)}</p></article>
            <article><h4>Tomorrow’s Plan</h4><p>{textValue(report.tomorrowPlan)}</p></article>
            <article><h4>Remarks</h4><p>{textValue(report.remarks)}</p></article>
          </div>
        </section>

        <section aria-labelledby="daily-report-followup-heading">
          <h3 id="daily-report-followup-heading">Follow-up Summary</h3>
          <dl className="daily-report-facts daily-report-facts--compact">
            <div><dt>Follow-ups Completed</dt><dd>{numberValue(report.followUpsCompleted)}</dd></div>
            <div><dt>Locked Status</dt><dd>{report.isLocked ? 'Locked' : 'Unlocked'}</dd></div>
          </dl>
        </section>

        {report.id && <div className="daily-report-reference">Reference ID <span>{report.id}</span></div>}
      </div>
    </Modal>
  );
};

export const DirectorDailyReports = ({ rows, filterBar, employeeName, onComment, initialReportId }) => {
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (!initialReportId) return;
    const report = rows.find((item) => String(item.id) === String(initialReportId));
    if (report) setSelectedReport(report);
  }, [initialReportId, rows]);

  const openComment = (report) => {
    setSelectedReport(null);
    onComment(report);
  };

  return (
    <>
      {filterBar}
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No daily reports found" description="Submitted Marketing daily summaries will appear here." />
      ) : (
        <div className="daily-reports-results">
          <div className="daily-reports-table-wrap">
            <table className="daily-reports-table">
              <thead><tr><th>Employee</th><th>Report Date</th><th>Planned Visits</th><th>Completed</th><th>Cancelled</th><th>Pending Actions</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((report) => {
                const name = employeeName(report.employeeId, report.fullName || report.employeeName);
                return <tr key={report.id}>
                  <td data-label="Employee"><div className="daily-report-employee"><span className="daily-report-avatar" aria-hidden="true">{String(name || 'E').charAt(0).toUpperCase()}</span><span><strong>{textValue(name)}</strong><small>{textValue(report.employeeId)}</small></span></div></td>
                  <td data-label="Report Date"><time>{formatDate(report.date || report.reportDate)}</time></td>
                  <td data-label="Planned Visits"><span className="daily-report-number daily-report-number--planned">{numberValue(report.plannedVisits)}</span></td>
                  <td data-label="Completed"><span className="daily-report-number daily-report-number--completed">{numberValue(report.completedVisits)}</span></td>
                  <td data-label="Cancelled"><span className="daily-report-number daily-report-number--cancelled">{numberValue(report.cancelledVisits)}</span></td>
                  <td data-label="Pending Actions"><span className="daily-report-pending" title={textValue(report.pendingActions)}>{textValue(report.pendingActions)}</span></td>
                  <td data-label="Status"><ReportStatus report={report} /></td>
                  <td data-label="Actions"><div className="daily-report-actions"><Button variant="secondary" aria-label={`View ${name} daily report details`} onClick={() => setSelectedReport(report)}><Eye size={16} aria-hidden="true" /> View Details</Button><Button variant="secondary" aria-label={`Comment on ${name} daily report`} onClick={() => onComment(report)}><MessageSquare size={16} aria-hidden="true" /> Comment</Button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}
      <EntityDetailsModal open={Boolean(selectedReport)} onClose={() => setSelectedReport(null)} type="dailyReport" entity={selectedReport ? { ...selectedReport, fullName: employeeName(selectedReport.employeeId, selectedReport.fullName || selectedReport.employeeName) } : null} primaryAction={<AddCommentButton onClick={() => openComment(selectedReport)} />} />
      {LEGACY_DETAIL_PRESENTATION && selectedReport && <DailyReportDetails report={selectedReport} employeeName={employeeName} onClose={() => setSelectedReport(null)} onComment={openComment} />}
    </>
  );
};

export default DirectorDailyReports;
