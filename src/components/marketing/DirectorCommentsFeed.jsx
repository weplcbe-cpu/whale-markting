import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, MessageSquare, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { directorFeedbackRoute, resolveDirectorFeedbackRecord } from '../../utils/directorFeedback';
import { Badge, Button, EmptyState, PageHeader } from '../ui';
import { EntityDetailsModal, formatDisplayDateTime, RelatedRecordButton } from '../common/details';

const FILTERS = ['All', 'Unread', 'Read', 'Visit Plans', 'Tour Plans', 'Reports', 'Follow-ups'];
export const DirectorCommentsFeed = () => {
  const {
    currentUser,
    directorComments,
    visitPlans,
    visitReports,
    dailyReports,
    followUps,
    markDirectorFeedbackRead,
    refreshEntity,
    dataLoading,
    dataError,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const comments = Array.isArray(directorComments) ? directorComments : [];
  const plans = Array.isArray(visitPlans) ? visitPlans : [];
  const reports = Array.isArray(visitReports) ? visitReports : [];
  const reportsByDay = Array.isArray(dailyReports) ? dailyReports : [];
  const scheduledFollowUps = Array.isArray(followUps) ? followUps : [];
  const feedback = comments.filter((item) => item && item.employeeId === currentUser?.employeeId);

  useEffect(() => {
    const unreadIds = feedback.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length) markDirectorFeedbackRead(unreadIds);
  }, [feedback, markDirectorFeedbackRead]);

  useEffect(() => {
    const selectedId = searchParams.get('feedbackId');
    const match = feedback.find((item) => item.id === selectedId);
    if (match) {
      setSelected(match);
      markDirectorFeedbackRead(match.id);
    }
  }, [feedback, markDirectorFeedbackRead, searchParams]);

  const relatedRecord = (item) => resolveDirectorFeedbackRecord(item, {
    visitPlans: plans,
    visitReports: reports,
    dailyReports: reportsByDay,
    followUps: scheduledFollowUps,
  });
  const recordAvailable = (item) => relatedRecord(item).state === 'available';
  const commentsLoadFailed = retryFailed || /director.?comments/i.test(dataError || '');
  const filtered = feedback.filter((item) => {
    if (filter === 'Unread') return !item.isRead;
    if (filter === 'Read') return item.isRead;
    if (filter === 'Visit Plans') return item.targetType === 'Visit Plan';
    if (filter === 'Tour Plans') return item.targetType === 'Tour Plan';
    if (filter === 'Reports') return ['Visit Report', 'Daily Report'].includes(item.targetType);
    if (filter === 'Follow-ups') return item.targetType === 'Follow-up';
    return true;
  });
  const openDetails = (item) => {
    setSelected(item);
    setSearchParams({ feedbackId: item.id });
    markDirectorFeedbackRead(item.id);
  };
  const closeDetails = () => {
    setSelected(null);
    setSearchParams({});
  };
  const openRelated = (item) => {
    const resolution = relatedRecord(item);
    const path = resolution.record
      ? directorFeedbackRoute({ ...item, targetId: resolution.record.id })
      : null;
    if (path) navigate(path);
  };
  const retryComments = async () => {
    setRetrying(true);
    try {
      const result = await refreshEntity('director_comments');
      setRetryFailed(result === undefined);
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="ds-page director-feedback-page">
      <PageHeader
        title="Director Comments"
        description="Feedback and guidance shared by your Director."
        actions={commentsLoadFailed ? <Button variant="secondary" loading={retrying} onClick={retryComments}><RefreshCw size={16} /> Retry</Button> : null}
      />
      <div className="ds-segmented director-feedback-filters" aria-label="Filter Director feedback">
        {FILTERS.map((option) => {
          const active = filter === option;
          return <button key={option} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => setFilter(option)}>{option}</button>;
        })}
      </div>
      {dataLoading && !feedback.length ? <div className="ds-loading">Loading Director feedback…</div> : (
        <div className="director-feedback-list">
          {filtered.map((item) => {
            const available = recordAvailable(item);
            return (
              <article className={`director-feedback-card ${item.isRead ? '' : 'is-unread'}`} key={item.id}>
                <button type="button" className="director-feedback-card__main" onClick={() => openDetails(item)} aria-label={`${item.isRead ? 'Read' : 'Unread'} feedback from ${item.directorName}`}>
                  <span className="director-feedback-card__header">
                    <strong>{item.directorName}</strong>
                    <time>{formatDisplayDateTime(item.createdAt)}</time>
                  </span>
                  <span className="director-feedback-card__badges"><Badge>{item.targetType}</Badge><Badge tone={item.isRead ? 'neutral' : 'warning'}>{item.commentType}</Badge>{!item.isRead && <span className="director-feedback-unread">Unread</span>}</span>
                  <span className="director-feedback-card__message">{item.message}</span>
                  <small className="director-feedback-card__reference">Reference: {item.targetTitle || item.targetId}</small>
                </button>
                <div className="director-feedback-card__related">{item.targetId && available ? <Button variant="secondary" onClick={() => openRelated(item)}><ExternalLink size={15} /> View Related Record</Button> : item.targetId ? <small>Related record deleted</small> : null}</div>
              </article>
            );
          })}
          {!filtered.length && <EmptyState icon={MessageSquare} title={filter === 'Unread' ? 'No unread feedback.' : `No ${filter === 'All' ? '' : `${filter.toLowerCase()} `}comments available.`} />}
        </div>
      )}
      <EntityDetailsModal open={Boolean(selected)} onClose={closeDetails} type="feedback" entity={selected} relatedState={selected ? relatedRecord(selected).state : null} primaryAction={selected?.targetId && recordAvailable(selected) ? <RelatedRecordButton onClick={() => openRelated(selected)} /> : null} />
    </div>
  );
};

export default DirectorCommentsFeed;
