import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TodaySchedule } from './TodaySchedule';
import { MyPlans } from './MyPlans';
import { AddVisitPlan } from './AddVisitPlan';
import { Calendar, Clock, PlusCircle } from 'lucide-react';

export const VisitsPlanningHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeSubTab = ['today', 'plans'].includes(requestedView) ? requestedView : 'today';
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
    <div className="visits-planning-hub">
      {/* Sub-navigation Header Tabs */}
      <div className="toolbar-bar">
        <div className="kw-segmented-glass" role="tablist" aria-label="Visits sub-navigation">
          <button
            type="button"
            className={`kw-segmented-glass__item ${activeSubTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('today')}
            role="tab"
            aria-selected={activeSubTab === 'today'}
          >
            <Clock size={16} /> Today's Field Visits
          </button>

          <button
            type="button"
            className={`kw-segmented-glass__item ${activeSubTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('plans')}
            role="tab"
            aria-selected={activeSubTab === 'plans'}
          >
            <Calendar size={16} /> My Visit Plans
          </button>
        </div>

        <button
          className="btn btn-action"
          onClick={() => setShowAddPlanModal(true)}
        >
          <PlusCircle size={18} /> + Add Visit Plan
        </button>
      </div>

      {/* Render Selected View */}
      {activeSubTab === 'today' && <TodaySchedule />}
      {activeSubTab === 'plans' && <MyPlans />}

      <AddVisitPlan open={showAddPlanModal} onClose={() => setShowAddPlanModal(false)} />
    </div>
  );
};

export default VisitsPlanningHub;
