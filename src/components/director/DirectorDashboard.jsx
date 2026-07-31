import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, DataTable, Modal } from '../ui';
import { normalizePlanStatus } from '../../utils/planStatus';

const dateValue = (value) => (value ? String(value).slice(0, 10) : '');

export const DirectorDashboard = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    users = [],
    visitPlans = [],
    visitReports = [],
    dailyReports = [],
    followUps = [],
    notifications = [],
    lastUpdated,
    dataLoading,
  } = useApp();

  const [period, setPeriod] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedRep, setSelectedRep] = useState(null);

  const now = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Date range evaluator
  const inPeriod = useCallback((value) => {
    const normalized = dateValue(value);
    if (!normalized) return false;
    if (period === 'Today') return normalized === todayValue;
    if (period === 'This Week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const target = new Date(`${normalized}T00:00:00`);
      return target >= start && target < end;
    }
    if (period === 'This Month') {
      const target = new Date(`${normalized}T00:00:00`);
      return target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();
    }
    if (period === 'Custom' && customStart && customEnd) {
      return normalized >= customStart && normalized <= customEnd;
    }
    return true;
  }, [period, customStart, customEnd, todayValue, now]);

  // Active Marketing Employees
  const marketingTeam = useMemo(() => {
    return users.filter(
      (user) => ['Marketing', 'Marketing Team'].includes(user.role) && user.status === 'Active'
    );
  }, [users]);

  // Scoped Data
  const scopedPlans = useMemo(() => visitPlans.filter((plan) => inPeriod(plan.visitDate)), [visitPlans, inPeriod]);
  const completedPlans = useMemo(() => scopedPlans.filter((plan) => normalizePlanStatus(plan.status) === 'Completed'), [scopedPlans]);
  const pendingApprovals = useMemo(
    () => scopedPlans.filter((plan) => ['Submitted', 'Planned'].includes(normalizePlanStatus(plan.status))),
    [scopedPlans]
  );
  const todayScheduledVisits = useMemo(() => visitPlans.filter((plan) => plan.visitDate === todayValue), [visitPlans, todayValue]);
  const scopedFollowUps = useMemo(() => followUps.filter((item) => inPeriod(item.followUpDate)), [followUps, inPeriod]);
  const pendingFollowUps = useMemo(() => scopedFollowUps.filter((item) => item.status !== 'Completed'), [scopedFollowUps]);

  const allReports = useMemo(() => [
    ...dailyReports.map((r) => ({ ...r, reportType: 'Daily Report', reportDate: r.date || r.reportDate || r.createdAt })),
    ...visitReports.map((r) => ({ ...r, reportType: 'Visit Report', reportDate: r.visitDate || r.createdAt })),
  ], [dailyReports, visitReports]);

  const pendingReports = useMemo(
    () => allReports.filter((r) => inPeriod(r.reportDate) && !['Approved', 'Completed'].includes(r.status)),
    [allReports, inPeriod]
  );

  const submittedPlans = useMemo(() => {
    return scopedPlans
      .filter((plan) => ['Submitted', 'Planned', 'Started', 'Completed', 'Rescheduled', 'Approved'].includes(normalizePlanStatus(plan.status)))
      .sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)));
  }, [scopedPlans]);

  // Helper mappings
  const employeeFor = useCallback((employeeId) => marketingTeam.find((user) => user.employeeId === employeeId), [marketingTeam]);
  const nameFor = useCallback((employeeId, fallback) => fallback || employeeFor(employeeId)?.fullName || employeeFor(employeeId)?.username || employeeId || 'Field Rep', [employeeFor]);

  // Search and Filtered Submitted Plans
  const filteredSubmittedPlans = useMemo(() => {
    return submittedPlans.filter((plan) => {
      const matchesStatus = statusFilter === 'All' || normalizePlanStatus(plan.status) === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const empName = nameFor(plan.employeeId, plan.employeeName || plan.fullName).toLowerCase();
      const place = (plan.area || plan.city || '').toLowerCase();
      const customer = (plan.customerName || plan.organizationName || '').toLowerCase();
      const purpose = (plan.visitPurpose || '').toLowerCase();

      return empName.includes(query) || place.includes(query) || customer.includes(query) || purpose.includes(query);
    });
  }, [submittedPlans, statusFilter, searchQuery, nameFor]);

  // Weekly Visit Distribution (Mon - Sun)
  const weeklyDistribution = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    scopedPlans.forEach((plan) => {
      if (!plan.visitDate) return;
      const d = new Date(`${plan.visitDate}T00:00:00`);
      const dayIndex = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
      const dayName = days[dayIndex];
      if (counts[dayName] !== undefined) counts[dayName] += 1;
    });
    const maxCount = Math.max(...Object.values(counts), 1);
    return days.map((day) => ({
      day,
      count: counts[day],
      percentage: Math.round((counts[day] / maxCount) * 100),
    }));
  }, [scopedPlans]);

  // Product Demand Breakdown
  const productDemand = useMemo(() => {
    const map = {};
    scopedPlans.forEach((plan) => {
      if (Array.isArray(plan.products)) {
        plan.products.forEach((prod) => {
          map[prod] = (map[prod] || 0) + 1;
        });
      }
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = Math.max(...sorted.map(([, v]) => v), 1);
    return sorted.map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [scopedPlans]);

  // Combined Activity Stream
  const activityTimeline = useMemo(() => {
    const items = [
      ...submittedPlans.map((p) => ({
        id: `plan-${p.id}`,
        type: 'Plan Submitted',
        title: `${nameFor(p.employeeId, p.fullName)} submitted visit plan for ${p.area || p.city || 'assigned area'}`,
        timestamp: p.submittedAt || p.createdAt,
        badgeTone: 'info',
      })),
      ...pendingReports.map((r) => ({
        id: `report-${r.id}`,
        type: 'Report Pending',
        title: `${nameFor(r.employeeId, r.fullName)} submitted ${r.reportType}`,
        timestamp: r.createdAt || r.reportDate,
        badgeTone: 'warning',
      })),
      ...notifications.slice(0, 5).map((n) => ({
        id: `notif-${n.id}`,
        type: n.type || 'Notification',
        title: n.message || n.title,
        timestamp: n.created_at || n.createdAt || n.timestamp,
        badgeTone: 'accent',
      })),
    ];

    return items
      .filter((i) => i.timestamp)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, 6);
  }, [submittedPlans, pendingReports, notifications, nameFor]);

  // Export CSV Handler
  const exportPlansCSV = useCallback(() => {
    if (!filteredSubmittedPlans.length) return;
    const headers = ['Employee', 'Visit Date', 'Time', 'Area/City', 'Customer/Organization', 'Purpose', 'Products', 'Priority', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredSubmittedPlans.map((p) => [
        `"${nameFor(p.employeeId, p.fullName)}"`,
        `"${p.visitDate || ''}"`,
        `"${p.expectedTime || ''}"`,
        `"${p.area || p.city || ''}"`,
        `"${p.customerName || p.organizationName || ''}"`,
        `"${p.visitPurpose || ''}"`,
        `"${Array.isArray(p.products) ? p.products.join('; ') : ''}"`,
        `"${p.priority || 'Medium'}"`,
        `"${normalizePlanStatus(p.status)}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Director_Visit_Plans_${period}_${todayValue}.csv`;
    link.click();
  }, [filteredSubmittedPlans, nameFor, period, todayValue]);

  if (dataLoading && !lastUpdated) {
    return (
      <div className="dd-container">
        <div className="director-dashboard-skeleton" aria-label="Loading Director Dashboard">
          {Array.from({ length: 10 }, (_, idx) => (
            <div className="ds-skeleton" key={idx} style={{ height: idx < 4 ? '120px' : '220px', borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dd-container">
      {/* Top Banner & Quick Controls */}
      <div className="dd-hero-banner">
        <div className="dd-hero-header">
          <div className="dd-hero-title">
            <h1>{greeting}, {currentUser?.fullName || 'Director'}</h1>
            <p>
              <span>{formattedDate}</span>
              <span className="dd-sync-badge">
                <span className="dd-sync-dot" /> Live Sync Active ({lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'})
              </span>
            </p>
          </div>

          <div className="dd-quick-filters">
            {['Today', 'This Week', 'This Month', 'Custom'].map((item) => (
              <button
                type="button"
                key={item}
                className={`dd-filter-btn ${period === item ? 'active' : ''}`}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {period === 'Custom' && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
            <input
              type="date"
              className="btn"
              style={{ background: '#FFFFFF', color: '#0F172A', border: 'none', padding: '6px 12px', borderRadius: '8px' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: '#94A3B8' }}>to</span>
            <input
              type="date"
              className="btn"
              style={{ background: '#FFFFFF', color: '#0F172A', border: 'none', padding: '6px 12px', borderRadius: '8px' }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Primary KPI Summary Cards Row (No approval cards) */}
      <div className="dd-kpi-grid">
        {/* Total Marketing Team */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/team')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon cyan"><Users size={22} /></div>
            <span className="dd-kpi-trend positive">Active</span>
          </div>
          <div className="dd-kpi-value">{marketingTeam.length}</div>
          <div className="dd-kpi-label">Total Marketing Team</div>
        </div>

        {/* Today's Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/today-schedule')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Calendar size={22} /></div>
            <span className="dd-kpi-trend neutral">Today</span>
          </div>
          <div className="dd-kpi-value">{todayScheduledVisits.length}</div>
          <div className="dd-kpi-label">Today's Visits</div>
        </div>

        {/* Completed Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon emerald"><CheckCircle2 size={22} /></div>
            <span className="dd-kpi-trend positive">Verified</span>
          </div>
          <div className="dd-kpi-value">{completedPlans.length}</div>
          <div className="dd-kpi-label">Completed Visits</div>
        </div>

        {/* Pending Visits */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon amber"><Clock size={22} /></div>
            <span className="dd-kpi-trend warning">Scheduled</span>
          </div>
          <div className="dd-kpi-value">{scopedPlans.length - completedPlans.length}</div>
          <div className="dd-kpi-label">Pending Visits</div>
        </div>

        {/* Submitted Plans */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/visit-plans')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon indigo"><FileSpreadsheet size={22} /></div>
            <span className="dd-kpi-trend positive">Total</span>
          </div>
          <div className="dd-kpi-value">{submittedPlans.length}</div>
          <div className="dd-kpi-label">Submitted Plans</div>
        </div>

        {/* Pending Follow-ups */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/follow-ups')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon rose"><AlertCircle size={22} /></div>
            <span className="dd-kpi-trend neutral">Due</span>
          </div>
          <div className="dd-kpi-value">{pendingFollowUps.length}</div>
          <div className="dd-kpi-label">Pending Follow-ups</div>
        </div>

        {/* Pending Reports */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/daily-reports')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon purple"><FileText size={22} /></div>
            <span className="dd-kpi-trend warning">Review</span>
          </div>
          <div className="dd-kpi-value">{pendingReports.length}</div>
          <div className="dd-kpi-label">Pending Reports</div>
        </div>

        {/* Unread Notifications */}
        <div className="dd-kpi-card" onClick={() => navigate('/director/notifications')}>
          <div className="dd-kpi-header">
            <div className="dd-kpi-icon blue"><Bell size={22} /></div>
            <span className="dd-kpi-trend positive">Live</span>
          </div>
          <div className="dd-kpi-value">
            {notifications.filter((n) => !n.is_read && !n.isRead).length}
          </div>
          <div className="dd-kpi-label">Unread Notifications</div>
        </div>
      </div>

      {/* Submitted Visit Plans and Updates */}
      <div className="dd-card">
        <div className="dd-card-header">
          <div className="dd-card-title">
            <FileSpreadsheet size={20} style={{ color: '#3B5BDB' }} />
            <h2>Submitted Visit Plans and Updates</h2>
            <span>{submittedPlans.length} plans</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/director/visit-plans')}>
            View All Plans <ChevronRight size={16} />
          </Button>
        </div>

        {submittedPlans.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submittedPlans.slice(0, 4).map((plan) => (
              <div
                key={plan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>
                    {nameFor(plan.employeeId, plan.fullName || plan.employeeName)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    📍 {plan.area || plan.city || 'Assigned Area'} • 🗓️ {plan.visitDate} ({plan.expectedTime || 'AM/PM'})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                    🏢 {plan.customerName || plan.organizationName || 'General Visit'} • 🎯 {plan.visitPurpose}
                  </div>
                </div>

                <Button variant="secondary" size="sm" onClick={() => setSelectedPlan(plan)}>
                  View Details <ArrowUpRight size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="dd-empty-box">
            <div className="dd-empty-icon"><FileSpreadsheet size={24} /></div>
            <h4>No submitted plans for this period</h4>
            <p>Recent visit plan submissions will appear here automatically.</p>
            <Button variant="secondary" onClick={() => navigate('/director/team')}>
              View Marketing Team
            </Button>
          </div>
        )}
      </div>

      {/* Two-Column Section: Today's Schedule & Pending Reports/Follow-ups */}
      <div className="dd-grid-two-col">
        {/* Left: Today's Team Schedule */}
        <div className="dd-card">
          <div className="dd-card-header">
            <div className="dd-card-title">
              <Calendar size={20} style={{ color: '#2563EB' }} />
              <h2>Today's Field Schedule ({todayScheduledVisits.length})</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/director/today-schedule')}>
              View Today Schedule
            </Button>
          </div>

          {todayScheduledVisits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayScheduledVisits.slice(0, 4).map((visit) => (
                <div
                  key={visit.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0F172A', fontSize: '0.85rem' }}>
                      {nameFor(visit.employeeId, visit.fullName)}
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      🕒 {visit.expectedTime || 'AM/PM'} • 📍 {visit.area || visit.city || 'Territory'}
                    </div>
                  </div>
                  <Badge tone="info">{normalizePlanStatus(visit.status)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="dd-empty-box">
              <div className="dd-empty-icon"><Calendar size={24} /></div>
              <h4>No visits scheduled today</h4>
              <p>Team members have no field visits booked for today.</p>
            </div>
          )}
        </div>

        {/* Right: Pending Reports and Follow-ups */}
        <div className="dd-card">
          <div className="dd-card-header">
            <div className="dd-card-title">
              <AlertCircle size={20} style={{ color: '#E11D48' }} />
              <h2>Pending Reports & Follow-ups</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/director/daily-reports')}>
              View Reports
            </Button>
          </div>

          {pendingReports.length > 0 || pendingFollowUps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingReports.slice(0, 3).map((r) => (
                <div key={`rep-${r.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#78350F' }}>{nameFor(r.employeeId, r.fullName)}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#92400E' }}>📄 {r.reportType} • {r.reportDate || 'Today'}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/director/daily-reports')}>View</Button>
                </div>
              ))}
              {pendingFollowUps.slice(0, 2).map((f) => (
                <div key={`fol-${f.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#FFF1F2', borderRadius: '10px', border: '1px solid #FECDD3' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#9F1239' }}>{nameFor(f.employeeId, f.fullName)}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#BE123C' }}>⏰ Follow-up due: {f.followUpDate || 'Pending'}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/director/follow-ups')}>View</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="dd-empty-box">
              <div className="dd-empty-icon"><CheckCircle2 size={24} /></div>
              <h4>All reports up to date</h4>
              <p>No reports or follow-ups require attention.</p>
            </div>
          )}
        </div>
      </div>
                  <div className="dd-activity-content">
                    <p>{item.title}</p>
                    <time>{item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : 'Recently'}</time>
                  </div>
                </div>
              ))
            ) : (
              <div className="dd-empty-box">
                <div className="dd-empty-icon"><Clock size={24} /></div>
                <h4>No recent activity</h4>
                <p>Recent field updates will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Team Section */}
      <div className="dd-card">
        <div className="dd-card-header">
          <div className="dd-card-title">
            <Users size={20} style={{ color: '#0891B2' }} />
            <h2>Live Marketing Field Team ({marketingTeam.length})</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/director/team')}>
            Team Directory <ChevronRight size={16} />
          </Button>
        </div>

        {marketingTeam.length > 0 ? (
          <div className="dd-team-cards-grid">
            {marketingTeam.map((emp) => {
              const repPlans = scopedPlans.filter((p) => p.employeeId === emp.employeeId);
              const completedCount = repPlans.filter((p) => normalizePlanStatus(p.status) === 'Completed').length;
              const pendingCount = repPlans.filter((p) => !['Completed', 'Cancelled'].includes(normalizePlanStatus(p.status))).length;
              const initials = (emp.fullName || emp.username || 'M').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

              return (
                <div key={emp.id} className="dd-team-card">
                  <div className="dd-team-user">
                    <div className="dd-avatar">{initials}</div>
                    <div className="dd-team-info">
                      <h4>{emp.fullName || emp.username}</h4>
                      <p>ID: {emp.employeeId || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="dd-team-stats">
                    <div className="dd-team-stat-item">
                      <span>Total Visits</span>
                      <strong>{repPlans.length}</strong>
                    </div>
                    <div className="dd-team-stat-item">
                      <span>Completed</span>
                      <strong style={{ color: '#16A34A' }}>{completedCount}</strong>
                    </div>
                    <div className="dd-team-stat-item">
                      <span>Pending</span>
                      <strong style={{ color: '#D97706' }}>{pendingCount}</strong>
                    </div>
                    <div className="dd-team-stat-item">
                      <span>Status</span>
                      <strong style={{ color: '#2563EB' }}>Active</strong>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ width: '100%' }}
                    onClick={() => setSelectedRep(emp)}
                  >
                    Quick View
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dd-empty-box">
            <div className="dd-empty-icon"><Users size={24} /></div>
            <h4>No marketing employees found</h4>
            <p>Contact your Administrator to register marketing field staff.</p>
          </div>
        )}
      </div>

      {/* Performance Section: Charts Grid */}
      <div className="dd-charts-grid">
        {/* Weekly Visit Distribution Bar Chart */}
        <div className="dd-card">
          <div className="dd-card-header">
            <div className="dd-card-title">
              <BarChart3 size={20} style={{ color: '#3B5BDB' }} />
              <h2>Weekly Visit Distribution ({period})</h2>
            </div>
          </div>

          <div className="dd-bar-chart">
            {weeklyDistribution.map((col) => (
              <div key={col.day} className="dd-bar-col">
                <div
                  className="dd-bar-fill"
                  style={{ height: `${Math.max(col.percentage, 4)}%` }}
                  data-value={col.count}
                />
                <span className="dd-bar-label">{col.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Demand Breakdown */}
        <div className="dd-card">
          <div className="dd-card-header">
            <div className="dd-card-title">
              <TrendingUp size={20} style={{ color: '#4F46E5' }} />
              <h2>Top Requested Products</h2>
            </div>
          </div>

          {productDemand.length > 0 ? (
            <div className="dd-progress-list">
              {productDemand.map((prod) => (
                <div key={prod.name} className="dd-progress-item">
                  <div className="dd-progress-meta">
                    <span>{prod.name}</span>
                    <span>{prod.count} visits</span>
                  </div>
                  <div className="dd-progress-track">
                    <div className="dd-progress-bar" style={{ width: `${prod.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dd-empty-box">
              <div className="dd-empty-icon"><Layers size={24} /></div>
              <h4>No product data</h4>
              <p>Product tags will populate as visit plans are submitted.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Data Grid Table: Submitted Visit Plans */}
      <div className="dd-card">
        <div className="dd-card-header">
          <div className="dd-card-title">
            <FileSpreadsheet size={20} style={{ color: '#2563EB' }} />
            <h2>Submitted Visit Plans Data Grid</h2>
            <span>{filteredSubmittedPlans.length} records</span>
          </div>

          <div className="dd-table-controls">
            <div className="dd-table-search">
              <Search size={16} style={{ color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search rep, customer, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="btn"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '10px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Rescheduled">Rescheduled</option>
            </select>

            <Button variant="secondary" size="sm" onClick={exportPlansCSV}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        </div>

        <DataTable
          rows={filteredSubmittedPlans.slice(0, 10)}
          columns={[
            {
              key: 'employee',
              label: 'Employee',
              render: (row) => (
                <>
                  <strong>{nameFor(row.employeeId, row.employeeName || row.fullName)}</strong>
                  <small>{row.employeeId || 'N/A'}</small>
                </>
              ),
            },
            { key: 'date', label: 'Visit Date', render: (row) => row.visitDate || 'N/A' },
            { key: 'time', label: 'Time', render: (row) => row.expectedTime || 'N/A' },
            { key: 'area', label: 'Area / Place', render: (row) => row.area || row.city || row.district || 'N/A' },
            { key: 'customer', label: 'Customer / Org', render: (row) => row.customerName || row.organizationName || 'General Visit' },
            { key: 'purpose', label: 'Purpose', render: (row) => row.visitPurpose || 'N/A' },
            { key: 'products', label: 'Products', render: (row) => (Array.isArray(row.products) && row.products.length ? row.products.join(', ') : 'N/A') },
            { key: 'priority', label: 'Priority', render: (row) => row.priority || 'Medium' },
            { key: 'status', label: 'Status', render: (row) => <Badge tone="success">{normalizePlanStatus(row.status)}</Badge> },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <Button variant="secondary" size="sm" onClick={() => setSelectedPlan(row)}>
                  <Eye size={14} /> Details
                </Button>
              ),
            },
          ]}
          empty={
            <div className="dd-empty-box">
              <div className="dd-empty-icon"><FileSpreadsheet size={24} /></div>
              <h4>No submitted plans match filters</h4>
              <p>Try clearing search keywords or changing your date range filter.</p>
              <Button variant="secondary" onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}>
                Reset Filters
              </Button>
            </div>
          }
        />
      </div>

      {/* Plan Detail Modal */}
      <Modal
        open={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        title="Visit Plan Detailed Overview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedPlan(null)}>Close</Button>
            {employeeFor(selectedPlan?.employeeId)?.mobileNumber && (
              <Button onClick={() => { window.location.href = `tel:${employeeFor(selectedPlan.employeeId).mobileNumber}`; }}>
                <Phone size={16} /> Call Rep
              </Button>
            )}
            <Button onClick={() => { setSelectedPlan(null); navigate('/director/visit-plans'); }}>
              Manage Plans
            </Button>
          </>
        }
      >
        {selectedPlan && (
          <div className="director-detail-grid">
            {Object.entries({
              'Employee Name': nameFor(selectedPlan.employeeId, selectedPlan.employeeName || selectedPlan.fullName),
              'Employee ID': selectedPlan.employeeId,
              'Visit Date': selectedPlan.visitDate,
              'Expected Time': selectedPlan.expectedTime,
              'Assigned Area': selectedPlan.area || selectedPlan.city || selectedPlan.district,
              'Customer / Organization': selectedPlan.customerName || selectedPlan.organizationName || 'General Visit',
              'Contact Person': selectedPlan.contactPerson,
              'Mobile Number': selectedPlan.mobileNumber,
              'Visit Purpose': selectedPlan.visitPurpose,
              'Products Requested': Array.isArray(selectedPlan.products) ? selectedPlan.products.join(', ') : null,
              'Requirement / Objective': selectedPlan.requirement,
              Priority: selectedPlan.priority,
              Notes: selectedPlan.notes,
              'Current Status': normalizePlanStatus(selectedPlan.status),
              'Submitted Timestamp': selectedPlan.submittedAt ? new Date(selectedPlan.submittedAt).toLocaleString('en-IN') : null,
            }).map(([label, val]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{val || 'Not provided'}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Rep Detail Modal */}
      <Modal
        open={Boolean(selectedRep)}
        onClose={() => setSelectedRep(null)}
        title={`Rep Profile: ${selectedRep?.fullName || selectedRep?.username || 'Employee'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedRep(null)}>Close</Button>
            {selectedRep?.mobileNumber && (
              <Button onClick={() => { window.location.href = `tel:${selectedRep.mobileNumber}`; }}>
                <Phone size={16} /> Call Employee
              </Button>
            )}
            <Button onClick={() => { setSelectedRep(null); navigate('/director/team'); }}>
              View Team Management
            </Button>
          </>
        }
      >
        {selectedRep && (
          <div className="director-detail-grid">
            {Object.entries({
              'Full Name': selectedRep.fullName || selectedRep.username,
              'Employee ID': selectedRep.employeeId,
              Role: selectedRep.role,
              Status: selectedRep.status,
              'Mobile Number': selectedRep.mobileNumber,
              Email: selectedRep.email,
              'Assigned Territory': selectedRep.area || selectedRep.city || 'Tamil Nadu',
            }).map(([label, val]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{val || 'Not provided'}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DirectorDashboard;

