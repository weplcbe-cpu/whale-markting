import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TodaySchedule } from './TodaySchedule';
import { MyPlans } from './MyPlans';
import { WeeklyPlanningSheet } from './WeeklyPlanningSheet';
import { NextMonthPlan } from './NextMonthPlan';
import { AddVisitPlan } from './AddVisitPlan';
import { Calendar, Clock, FileSpreadsheet, PlusCircle } from 'lucide-react';

export const VisitsPlanningHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeSubTab = ['today', 'plans', 'weekly', 'next-month'].includes(requestedView) ? requestedView : 'today';
  const setActiveSubTab = (view) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', view);
    setSearchParams(nextParams);
  };
  const showAddPlanModal = searchParams.get('action') === 'add-visit-plan';
  const setShowAddPlanModal = (show) => {
    const nextParams = new URLSearchParams(searchParams);
    if (show) nextParams.set('action', 'add-visit-plan');
    else nextParams.delete('action');
    setSearchParams(nextParams);
  };

  return (
    <div>
      {/* Sub-navigation Header Tabs */}
      <div className="toolbar-bar">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeSubTab === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('today')}
          >
            <Clock size={16} /> Today's Field Visits
          </button>

          <button
            className={`btn ${activeSubTab === 'plans' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('plans')}
          >
            <Calendar size={16} /> My Visit Plans
          </button>

          <button
            className={`btn ${activeSubTab === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('weekly')}
          >
            <FileSpreadsheet size={16} /> Weekly Planning Sheet
          </button>

          <button className={`btn ${activeSubTab === 'next-month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('next-month')}>
            <Calendar size={16} /> Next Month Plan
          </button>
        </div>

        {/* Hide top Add button when on Weekly Planning Sheet to avoid duplicate buttons */}
        {!['weekly', 'next-month'].includes(activeSubTab) && (
          <button
            className="btn btn-action"
            onClick={() => setShowAddPlanModal(true)}
          >
            <PlusCircle size={18} /> + Add Visit Plan
          </button>
        )}
      </div>

      {/* Render Selected View */}
      {activeSubTab === 'today' && <TodaySchedule />}
      {activeSubTab === 'plans' && <MyPlans />}
      {activeSubTab === 'weekly' && <WeeklyPlanningSheet />}
      {activeSubTab === 'next-month' && <NextMonthPlan />}

      <AddVisitPlan open={showAddPlanModal} onClose={() => setShowAddPlanModal(false)} />
    </div>
  );
};

export default VisitsPlanningHub;
