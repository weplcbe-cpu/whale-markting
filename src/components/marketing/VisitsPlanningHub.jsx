import React, { useState } from 'react';
import { TodaySchedule } from './TodaySchedule';
import { MyPlans } from './MyPlans';
import { WeeklyPlanningSheet } from './WeeklyPlanningSheet';
import { AddVisitPlan } from './AddVisitPlan';
import { Calendar, Clock, FileSpreadsheet, PlusCircle, X } from 'lucide-react';

export const VisitsPlanningHub = ({ initialSubTab = 'today' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);

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
        </div>

        {/* Hide top Add button when on Weekly Planning Sheet to avoid duplicate buttons */}
        {activeSubTab !== 'weekly' && (
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

      {/* Slide-over / Modal for Quick Add Visit Plan */}
      {showAddPlanModal && (
        <div className="modal-overlay" onClick={() => setShowAddPlanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="var(--action-orange)" /> Create New Visit Plan
              </h3>
              <button
                onClick={() => setShowAddPlanModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <AddVisitPlan setActiveTab={() => setShowAddPlanModal(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitsPlanningHub;
