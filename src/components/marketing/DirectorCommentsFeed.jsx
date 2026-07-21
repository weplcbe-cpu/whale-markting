import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageSquare, Send } from 'lucide-react';

export const DirectorCommentsFeed = () => {
  const { currentUser, directorComments } = useApp();
  const empId = currentUser?.employeeId || 'EMP001';

  const myComments = directorComments.filter(c => c.targetEmployeeId === empId);

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title-clean"><MessageSquare size={18} color="var(--accent-amber)" /> Director Feedback & Comments Thread</h3>
        </div>

        {myComments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No feedback or comments from Director yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {myComments.map(c => (
              <div key={c.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#fbbf24' }}>{c.author} ({c.targetModule})</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>

                <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '12px' }}>
                  "{c.message}"
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ✓ Received & Acknowledged
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectorCommentsFeed;
