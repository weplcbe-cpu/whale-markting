import React from 'react';
import { AlertTriangle, Copy, ExternalLink, MessageSquare, Phone } from 'lucide-react';
import { Badge, Button, Modal } from '../../ui';
import { formatBoolean, formatDisplayDate, formatDisplayDateTime, formatEmptyValue, formatFieldLabel, formatLocation, formatMetric, formatProducts, hasDisplayValue, truncateReference } from './detailsFormatters';

const DetailsSection = ({ title, children, className = '' }) => children ? <section className={`entity-details-section ${className}`}><h3>{title}</h3>{children}</section> : null;
const DetailItem = ({ label, value, wide = false, children }) => <div className={`entity-detail-item${wide ? ' entity-detail-item--wide' : ''}`}><span>{label}</span><strong>{children ?? formatEmptyValue(value)}</strong></div>;
const MetricCard = ({ label, value, tone = 'blue' }) => <div className={`entity-metric entity-metric--${tone}`}><span>{label}</span><strong>{formatMetric(value)}</strong></div>;
const StatusBadge = ({ status = 'Unknown' }) => {
  const normalized = String(status || '').toLowerCase();
  const tone = ['completed', 'submitted', 'active', 'approved'].includes(normalized) ? 'success' : ['cancelled', 'rejected'].includes(normalized) ? 'danger' : ['pending', 'locked', 'overdue'].includes(normalized) ? 'warning' : normalized === 'reviewed' ? 'info' : 'neutral';
  return <Badge tone={tone}>{formatEmptyValue(status)}</Badge>;
};
const ProductChips = ({ products }) => {
  const values = formatProducts(products);
  return values.length ? <div className="entity-product-chips">{values.map((product) => <span key={String(product)}>{product}</span>)}</div> : <span>—</span>;
};
const ReferenceMeta = ({ references = [] }) => {
  const visible = (Array.isArray(references) ? references : []).filter((item) => item && hasDisplayValue(item.value));
  if (!visible.length) return null;
  const copy = (value) => navigator.clipboard?.writeText(String(value));
  return <details className="entity-reference"><summary>Technical Reference</summary>{visible.map(({ label, value }) => <div key={label}><span>{label}</span><code title={String(value)}>{truncateReference(value)}</code><button type="button" onClick={() => copy(value)} aria-label={`Copy ${label}`} title={`Copy ${label}`}><Copy size={14} /></button></div>)}</details>;
};

const SectionGrid = ({ children }) => <div className="entity-details-grid">{children}</div>;
const Narrative = ({ label, value }) => hasDisplayValue(value) ? <article className="entity-narrative"><h4>{label}</h4><p>{formatEmptyValue(value)}</p></article> : null;
const visitDuration = (record) => {
  const started = new Date(record.startedAt).getTime();
  const completed = new Date(record.completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
  const minutes = Math.floor((completed - started) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const VisitPlanBody = ({ record }) => <>
  <DetailsSection title="Visit Schedule"><SectionGrid><DetailItem label="Visit Date" value={formatDisplayDate(record.visitDate)} /><DetailItem label="Visit Time" value={record.expectedTime || record.visitTime} /><DetailItem label="Area / City" value={formatLocation(record.area, record.city, record.district)} /><DetailItem label="Priority" value={record.priority} /></SectionGrid></DetailsSection>
  {(record.startedAt || record.completedAt) && <DetailsSection title="Execution Timeline"><SectionGrid><DetailItem label="Started At" value={formatDisplayDateTime(record.startedAt)} /><DetailItem label="Closure Deadline" value={formatDisplayDateTime(record.closeDeadline)} /><DetailItem label="Completed At" value={formatDisplayDateTime(record.completedAt)} /><DetailItem label="Visit Duration" value={visitDuration(record)} /></SectionGrid></DetailsSection>}
  <DetailsSection title="Customer"><SectionGrid><DetailItem label="Customer / Organization" value={record.customerName || record.organizationName} /><DetailItem label="Contact Person" value={record.contactPerson} /><DetailItem label="Mobile Number" value={record.mobileNumber} /><DetailItem label="Organization Type" value={record.organizationType} /></SectionGrid></DetailsSection>
  <DetailsSection title="Visit Objective"><div className="entity-narrative-grid"><Narrative label="Visit Purpose" value={record.visitPurpose} /><article className="entity-narrative"><h4>Products Interested</h4><ProductChips products={record.products} /></article><Narrative label="Requirement" value={record.requirement} /><Narrative label="Notes" value={record.notes} /></div></DetailsSection>
  {record.visitReport && <VisitReportBody record={record.visitReport} compact />}
  <DetailsSection title="Submission"><SectionGrid><DetailItem label="Submitted" value={formatDisplayDateTime(record.submittedAt)} /><DetailItem label="Employee ID" value={record.employeeId} /></SectionGrid></DetailsSection>
  <ReferenceMeta references={[{ label: 'Visit Plan Reference', value: record.id }]} />
</>;

const FollowUpBody = ({ record }) => <>
  <DetailsSection title="Customer & Owner"><SectionGrid><DetailItem label="Employee" value={record.fullName || record.employeeName} /><DetailItem label="Employee ID" value={record.employeeId} /><DetailItem label="Customer" value={record.customerName} />{record.customerId && <DetailItem label="Customer ID" value={record.customerId} />}</SectionGrid></DetailsSection>
  <DetailsSection title="Follow-up"><SectionGrid><DetailItem label="Follow-up Date" value={formatDisplayDate(record.followUpDate)} /><DetailItem label="Type" value={record.followUpType || record.type} /><DetailItem label="Purpose" value={record.purpose} /><DetailItem label="Priority" value={record.priority} /><DetailItem label="Status"><StatusBadge status={record.status} /></DetailItem></SectionGrid></DetailsSection>
  {hasDisplayValue(record.notes) && <DetailsSection title="Notes"><Narrative label="Notes" value={record.notes} /></DetailsSection>}
  <DetailsSection title="Timeline"><SectionGrid><DetailItem label="Created" value={formatDisplayDateTime(record.createdAt)} /><DetailItem label="Last Updated" value={formatDisplayDateTime(record.updatedAt)} /></SectionGrid></DetailsSection>
  <ReferenceMeta references={[{ label: 'Follow-up Reference', value: record.id }, { label: 'Visit Plan Reference', value: record.visitPlanId }, { label: 'Visit Report Reference', value: record.visitReportId }]} />
</>;

const DailyReportBody = ({ record }) => <>
  <DetailsSection title="Daily Visit Summary"><div className="entity-metrics"><MetricCard label="Planned Visits" value={record.plannedVisits} tone="blue" /><MetricCard label="Completed Visits" value={record.completedVisits} tone="green" /><MetricCard label="Cancelled Visits" value={record.cancelledVisits} tone="rose" /><MetricCard label="New Customers" value={record.newCustomersAdded ?? record.newCustomers} tone="purple" /></div></DetailsSection>
  <DetailsSection title="Activity Summary"><div className="entity-narrative-grid"><Narrative label="Important Discussion" value={record.importantDiscussion} /><Narrative label="Pending Actions" value={record.pendingActions} /><Narrative label="Tomorrow’s Plan" value={record.tomorrowPlan} /><Narrative label="Remarks" value={record.remarks} /></div></DetailsSection>
  <DetailsSection title="Follow-up Summary"><SectionGrid><DetailItem label="Follow-ups Completed" value={formatMetric(record.followUpsCompleted)} /><DetailItem label="Record Status" value={formatBoolean(record.isLocked, 'locked')} /></SectionGrid></DetailsSection>
  <DetailsSection title="Submission"><SectionGrid><DetailItem label="Submitted" value={formatDisplayDateTime(record.submittedAt)} /><DetailItem label="Last Updated" value={formatDisplayDateTime(record.updatedAt)} /></SectionGrid></DetailsSection>
  <ReferenceMeta references={[{ label: 'Daily Report Reference', value: record.id }]} />
</>;

const Attachments = ({ photos, documents }) => {
  const photoList = formatProducts(photos); const documentList = formatProducts(documents);
  if (!photoList.length && !documentList.length) return null;
  return <DetailsSection title="Attachments"><div className="entity-attachments">{photoList.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Visit attachment ${index + 1}`} /></a>)}{documentList.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Document {index + 1} <ExternalLink size={14} /></a>)}</div></DetailsSection>;
};

const VisitReportBody = ({ record, compact = false }) => <>
  <DetailsSection title={compact ? "Visit Outcome" : "Visit Summary"}><SectionGrid><DetailItem label="Visit Date" value={formatDisplayDate(record.visitDate)} /><DetailItem label="Visit Place" value={formatLocation(record.area, record.city, record.visitPlace)} /><DetailItem label="Customer Response" value={record.customerResponse} /><DetailItem label="Final Status"><StatusBadge status={record.finalStatus || record.status || 'Completed'} /></DetailItem></SectionGrid></DetailsSection>
  <DetailsSection title="Outcome"><div className="entity-narrative-grid"><Narrative label="Discussion Notes" value={record.discussionNotes} /><Narrative label="Next Action" value={record.nextAction} /><article className="entity-narrative"><h4>Products</h4><ProductChips products={record.products || record.interestedProducts} /></article><Narrative label="Requirement Details" value={record.requirementDetails} /></div><SectionGrid><DetailItem label="Follow-up Required" value={formatBoolean(record.isFollowUpRequired, 'required')} />{record.isFollowUpRequired && <DetailItem label="Follow-up Date" value={formatDisplayDate(record.followUpDate)} />}</SectionGrid></DetailsSection>
  <Attachments photos={record.photos} documents={record.documents} />
  {!compact && <ReferenceMeta references={[{ label: 'Visit Report Reference', value: record.id }, { label: 'Visit Plan Reference', value: record.visitPlanId }]} />}
</>;

const FeedbackBody = ({ record, relatedState }) => <div className="director-feedback-details">
  <dl className="director-feedback-detail-grid"><div><dt>Director</dt><dd>{formatEmptyValue(record.directorName)}</dd></div><div><dt>Feedback Type</dt><dd>{formatEmptyValue(record.commentType)}</dd></div><div><dt>Date &amp; Time</dt><dd>{formatDisplayDateTime(record.createdAt)}</dd></div><div><dt>Related Record</dt><dd>{formatEmptyValue(record.targetTitle)}</dd></div></dl>
  <section className="director-feedback-detail-message"><h3>Message</h3><p>{formatEmptyValue(record.message)}</p></section>
  {relatedState === 'deleted' && <div className="director-feedback-related-deleted"><AlertTriangle size={16} aria-hidden="true" /><span>Related record deleted</span></div>}
  {relatedState === 'malformed' && <div className="ds-error">This legacy feedback does not contain a valid related-record reference.</div>}
  {relatedState === 'permission' && <div className="ds-error">You do not have permission to open this related record.</div>}
  <ReferenceMeta references={[{ label: 'Feedback Reference', value: record.id }, { label: 'Related Record Reference', value: record.targetId || record.referenceId }]} />
</div>;

const NotificationBody = ({ record }) => <>
  <DetailsSection title="Notification"><div className="entity-narrative-grid"><Narrative label="Message" value={record.message} /></div><SectionGrid><DetailItem label="Type" value={record.type} /><DetailItem label="Received" value={formatDisplayDateTime(record.createdAt || record.timestamp)} /><DetailItem label="Status" value={record.isRead ? 'Read' : 'Unread'} /></SectionGrid></DetailsSection>
  <ReferenceMeta references={[{ label: 'Notification Reference', value: record.id }, { label: 'Related Record Reference', value: record.referenceId }]} />
</>;

const EmployeeBody = ({ record }) => <>
  <DetailsSection title="Performance Summary"><div className="entity-metrics"><MetricCard label="Today Plans" value={record.metrics?.today} tone="blue" /><MetricCard label="Weekly Plans" value={record.metrics?.plans} tone="blue" /><MetricCard label="Completed Visits" value={record.metrics?.completed} tone="green" /><MetricCard label="Visit Reports" value={record.metrics?.visitReports} tone="purple" /><MetricCard label="Daily Reports" value={record.metrics?.dailyReports} tone="purple" /><MetricCard label="Pending Follow-ups" value={record.metrics?.followups} tone="amber" /><MetricCard label="Director Comments" value={record.metrics?.comments} tone="cyan" /></div></DetailsSection>
</>;

export const EntityDetailsModal = ({ open, entity, type = 'generic', title, subtitle, status, onClose, primaryAction, relatedState, notice, extraContent }) => {
  if (!entity) return null;
  const defaults = {
    visitPlan: ['Visit Plan Details', `${formatEmptyValue(entity.fullName || entity.employeeName)} • ${formatDisplayDate(entity.visitDate)}`, entity.status, <VisitPlanBody key="body" record={entity} />],
    followUp: ['Follow-up Details', `${formatEmptyValue(entity.customerName)} • ${formatDisplayDate(entity.followUpDate)}`, entity.status, <FollowUpBody key="body" record={entity} />],
    dailyReport: ['Daily Report Details', `${formatEmptyValue(entity.fullName || entity.employeeName)} • ${formatDisplayDate(entity.date || entity.reportDate)}`, entity.status, <DailyReportBody key="body" record={entity} />],
    visitReport: ['Visit Outcome Report', `${formatEmptyValue(entity.fullName || entity.employeeName)} • ${formatEmptyValue(entity.customerName)}`, entity.finalStatus || entity.status || 'Completed', <VisitReportBody key="body" record={entity} />],
    feedback: ['Director Feedback', entity.targetType, entity.commentType, <FeedbackBody key="body" record={entity} relatedState={relatedState} />],
    notification: [entity.title || 'Notification Details', formatDisplayDateTime(entity.createdAt || entity.timestamp), entity.isRead ? 'Read' : 'Unread', <NotificationBody key="body" record={entity} />],
    employee: [entity.fullName || entity.employeeName || 'Employee Summary', `${formatEmptyValue(entity.employeeId)} • ${formatEmptyValue(entity.designation)}`, entity.status || 'Active', <EmployeeBody key="body" record={entity} />],
  }[type];
  const body = defaults?.[3] || <DetailsSection title="Details"><SectionGrid>{Object.entries(entity).filter(([key, value]) => !/^(id|.*Id|createdAt|updatedAt)$/i.test(key) && hasDisplayValue(value) && typeof value !== 'object').map(([key, value]) => <DetailItem key={key} label={formatFieldLabel(key)} value={value} />)}</SectionGrid><ReferenceMeta references={[{ label: 'Record Reference', value: entity.id }]} /></DetailsSection>;
  return <Modal open={open} size="entity-details" title={title || defaults?.[0] || 'Details'} subtitle={<span className="entity-modal-subtitle">{subtitle || defaults?.[1]} {(status || defaults?.[2]) && <StatusBadge status={status || defaults?.[2]} />}</span>} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button>{primaryAction}</>}><div className="entity-details">{notice && <div className="ds-error">{notice}</div>}{body}{extraContent}</div></Modal>;
};

export const CallEmployeeButton = ({ phone }) => <Button disabled={!hasDisplayValue(phone)} onClick={() => { if (phone) window.location.href = `tel:${phone}`; }}><Phone size={16} /> Call Employee</Button>;
export const AddCommentButton = ({ onClick }) => <Button onClick={onClick}><MessageSquare size={16} /> Add Comment</Button>;
export const RelatedRecordButton = ({ disabled, onClick }) => <Button disabled={disabled} onClick={onClick}><ExternalLink size={16} /> Open Related Record</Button>;
