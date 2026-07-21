import React, { useState } from 'react';
import { DailyReportSubmit } from './DailyReportSubmit';
import { FollowUpManagement } from './FollowUpManagement';
import { TenderManagement } from './TenderManagement';
import { FileSpreadsheet, Clock, FileText } from 'lucide-react';

export const ReportsFollowupsHub = ({ initialSubTab = 'daily-report' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);

  return (
    <div>
      <div className="toolbar-bar">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeSubTab === 'daily-report' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('daily-report')}
          >
            <Clock size={16} /> Daily Summary Report
          </button>

          <button
            className={`btn ${activeSubTab === 'follow-ups' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('follow-ups')}
          >
            <FileSpreadsheet size={16} /> Pending Follow-ups
          </button>

          <button
            className={`btn ${activeSubTab === 'tenders' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('tenders')}
          >
            <FileText size={16} /> Tender Monitoring
          </button>
        </div>
      </div>

      {activeSubTab === 'daily-report' && <DailyReportSubmit />}
      {activeSubTab === 'follow-ups' && <FollowUpManagement />}
      {activeSubTab === 'tenders' && <TenderManagement />}
    </div>
  );
};
