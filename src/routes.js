// src/routes.js
// Centralized route configuration for role‑based navigation.
// Each entry maps a role and a tab id to a lazily‑loaded component.
// This file is used by App.jsx to render the appropriate view.

export const routes = [
  // --- Admin Routes ---
  { role: 'Admin', id: 'dashboard', component: () => import('./components/admin/AdminDashboard') },
  { role: 'Admin', id: 'users', component: () => import('./components/admin/UserManagement') },
  { role: 'Admin', id: 'products', component: () => import('./components/admin/ProductManagement') },
  { role: 'Admin', id: 'customer-approvals', component: () => import('./components/admin/CustomerApprovals') },
  { role: 'Admin', id: 'master-data', component: () => import('./components/admin/MasterDataManagement') },
  { role: 'Admin', id: 'activity-logs', component: () => import('./components/admin/ActivityLogs') },
  { role: 'Admin', id: 'reports', component: () => import('./components/admin/ReportsExport') },
  { role: 'Admin', id: 'settings', component: () => import('./components/admin/SystemSettings') },

  // --- Director Routes ---
  { role: 'Director', id: 'dashboard', component: () => import('./components/director/DirectorDashboard') },
  { role: 'Director', id: 'weekly-plans', component: () => import('./components/director/WeeklyPlanReview') },
  { role: 'Director', id: 'visit-reports', component: () => import('./components/director/DirectorVisitReports') },
  { role: 'Director', id: 'performance', component: () => import('./components/director/PerformanceAnalytics') },
  { role: 'Director', id: 'team-overview', component: () => import('./components/director/TeamOverview') },
  { role: 'Director', id: 'customers-overview', component: () => import('./components/director/CustomersOverview') },
  { role: 'Director', id: 'tenders-monitoring', component: () => import('./components/director/TenderMonitoring') },
  { role: 'Director', id: 'director-comments', component: () => import('./components/director/CommentsHistory') },

  // --- Marketing Routes ---
  { role: 'Marketing Team', id: 'dashboard', component: () => import('./components/marketing/MarketingDashboard') },
  { role: 'Marketing Team', id: 'visits', component: () => import('./components/marketing/VisitsPlanningHub') },
  { role: 'Marketing Team', id: 'customers', component: () => import('./components/marketing/CustomerManagement') },
  { role: 'Marketing Team', id: 'reports', component: () => import('./components/marketing/DailyReportSubmit') },
  { role: 'Marketing Team', id: 'follow-ups', component: () => import('./components/marketing/FollowUpManagement') },
  { role: 'Marketing Team', id: 'tenders', component: () => import('./components/marketing/TenderManagement') },
  { role: 'Marketing Team', id: 'director-comments', component: () => import('./components/marketing/DirectorCommentsFeed') },
  { role: 'Marketing Team', id: 'profile', component: () => import('./components/marketing/ProfilePage') },

  // Director's sidebar links to "My Profile" but has no dedicated profile
  // page — reuse the same generic profile/change-password component (it
  // only reads currentUser fields, nothing Marketing-specific).
  { role: 'Director', id: 'profile', component: () => import('./components/marketing/ProfilePage') },
];
