import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, MessageSquare, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { directorFeedbackRoute, resolveDirectorFeedbackRecord } from '../../utils/directorFeedback';
import { Badge, Button, EmptyState, PageHeader } from '../ui';
import { EntityDetailsModal, RelatedRecordButton } from '../common/details';

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
  } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const feedback = useMemo(
    () => directorComments.filter((item) => item.employeeId === currentUser?.employeeId),
    [currentUser?.employeeId, directorComments],
  );

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

  const relatedRecord = (item) => resolveDirectorFeedbackRecord(item, { visitPlans, visitReports, dailyReports, followUps });
  const recordAvailable = (item) => relatedRecord(item).state === 'available';
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

  return (
    <div className="ds-page director-feedback-page">
      <PageHeader
        title="Director Comments"
        description="Feedback and guidance shared by your Director."
        actions={<Button variant="secondary" onClick={() => refreshEntity('director_comments')}><RefreshCw size={16} /> Retry</Button>}
      />
      <div className="ds-segmented director-feedback-filters" aria-label="Filter Director feedback">
        {FILTERS.map((option) => <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option}</button>)}
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
                    <time>{formatDate(item.createdAt)}</time>
                  </span>
                  <span className="director-feedback-card__badges">
                    <Badge>{item.targetType}</Badge>
                    <Badge tone={item.isRead ? 'neutral' : 'warning'}>{item.commentType}</Badge>
                    {!item.isRead && <span className="director-feedback-unread">Unread</span>}
                    {item.targetId && !available && <Badge tone="neutral">Record unavailable</Badge>}
                  </span>
                  <span className="director-feedback-card__message">{item.message}</span>
                  <small>{item.targetTitle}</small>
                </button>
                {item.targetId && <Button variant="secondary" disabled={!available} onClick={() => openRelated(item)}><ExternalLink size={15} /> View Related Record</Button>}
              </article>
            );
          })}
          {!filtered.length && <EmptyState icon={MessageSquare} title={filter === 'Unread' ? 'No unread feedback.' : 'No Director feedback yet.'} />}
        </div>
      )}
      <EntityDetailsModal open={Boolean(selected)} onClose={closeDetails} type="feedback" entity={selected} relatedState={selected ? relatedRecord(selected).state : null} primaryAction={selected?.targetId ? <RelatedRecordButton disabled={!recordAvailable(selected)} onClick={() => openRelated(selected)} /> : null} />
    </div>
  );
};

export default DirectorCommentsFeed;
