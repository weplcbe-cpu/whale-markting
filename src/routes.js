// Centralized role-based route configuration.
export const marketingRoutes = [
  { role: 'Marketing Team', id: 'dashboard', path: '/marketing', label: 'Dashboard', component: () => import('./components/marketing/MarketingDashboard') },
  { role: 'Marketing Team', id: 'customers', path: '/marketing/customers', label: 'Customers', component: () => import('./components/marketing/CustomerManagement') },
  { role: 'Marketing Team', id: 'visits', path: '/marketing/visits', label: 'Visits', component: () => import('./components/marketing/VisitsPlanningHub') },
  { role: 'Marketing Team', id: 'reports', path: '/marketing/reports', label: 'Reports', component: () => import('./components/marketing/DailyReportSubmit') },
  { role: 'Marketing Team', id: 'follow-ups', path: '/marketing/follow-ups', label: 'Follow-ups', component: () => import('./components/marketing/FollowUpManagement') },
  { role: 'Marketing Team', id: 'tenders', path: '/marketing/tenders', label: 'Tenders', component: () => import('./components/marketing/TenderManagement') },
  { role: 'Marketing Team', id: 'director-comments', path: '/marketing/director-comments', label: 'Director Comments', component: () => import('./components/marketing/DirectorCommentsFeed') },
  { role: 'Marketing Team', id: 'profile', path: '/marketing/profile', label: 'Profile', component: () => import('./components/marketing/ProfilePage') },
];

export const directorRoutes = [
  { role: 'Director', id: 'dashboard', path: '/director', label: 'Dashboard', group: null, component: () => import('./components/director/DirectorDashboard') },
  { role: 'Director', id: 'team', path: '/director/team', label: 'Marketing Team', group: null, component: () => import('./components/director/TeamOverview') },
  { role: 'Director', id: 'today-schedule', path: '/director/today-schedule', label: 'Today Schedule', group: 'Planning', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'weekly-plans', path: '/director/tour-plans', label: 'Tour Plans Review', group: 'Planning', component: () => import('./components/director/WeeklyPlanReview') },
  { role: 'Director', id: 'tour-plan-review', path: '/director/tour-plans/:batchId', label: 'Tour Plan Review', nav: false, component: () => import('./components/director/WeeklyPlanReview') },
  { role: 'Director', id: 'visit-plans', path: '/director/visit-plans', label: 'Visit Plans', group: 'Planning', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'visit-reports', path: '/director/visit-reports', label: 'Visit Reports', group: 'Reports', component: () => import('./components/director/DirectorVisitReports') },
  { role: 'Director', id: 'daily-reports', path: '/director/daily-reports', label: 'Daily Reports', group: 'Reports', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'customers', path: '/director/customers', label: 'Customers', group: null, component: () => import('./components/director/CustomersOverview') },
  { role: 'Director', id: 'follow-ups', path: '/director/follow-ups', label: 'Follow-ups', group: 'Opportunities', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'tenders', path: '/director/tenders', label: 'Tenders', group: 'Opportunities', component: () => import('./components/director/TenderMonitoring') },
  { role: 'Director', id: 'product-overview', path: '/director/analytics/products', label: 'Product Overview', group: 'Analytics', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'area-overview', path: '/director/analytics/areas', label: 'Area Overview', group: 'Analytics', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'performance', path: '/director/analytics/performance', label: 'Performance', group: 'Analytics', component: () => import('./components/director/PerformanceAnalytics') },
  { role: 'Director', id: 'reports', path: '/director/reports', label: 'Team Reports', nav: false, component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'comments', path: '/director/comments', label: 'Comments', group: 'Communication', component: () => import('./components/director/CommentsHistory') },
  { role: 'Director', id: 'notifications', path: '/director/notifications', label: 'Notifications', group: 'Communication', component: () => import('./components/director/DirectorOperations') },
  { role: 'Director', id: 'profile', path: '/director/profile', label: 'Profile', group: null, component: () => import('./components/marketing/ProfilePage') },
];

export const directorNavigation = [
  { id: 'dashboard', routeIds: ['dashboard'] },
  { id: 'team', routeIds: ['team'] },
  { id: 'planning', label: 'Planning', routeIds: ['today-schedule', 'weekly-plans', 'visit-plans'] },
  { id: 'reports', label: 'Reports', routeIds: ['visit-reports', 'daily-reports'] },
  { id: 'customers', routeIds: ['customers'] },
  { id: 'opportunities', label: 'Opportunities', routeIds: ['follow-ups', 'tenders'] },
  { id: 'analytics', label: 'Analytics', routeIds: ['product-overview', 'area-overview', 'performance'] },
  { id: 'communication', label: 'Communication', routeIds: ['comments', 'notifications'] },
  { id: 'profile', routeIds: ['profile'] },
];

export const getMarketingRouteById = (id) => marketingRoutes.find(route => route.id === id);
export const getDirectorRouteById = (id) => directorRoutes.find(route => route.id === id);

export const adminRoutes = [
  { role: 'Admin', id: 'dashboard', path: '/admin', label: 'Dashboard', component: () => import('./components/admin/AdminDashboard') },
  { role: 'Admin', id: 'users', path: '/admin/users', label: 'User Management', component: () => import('./components/admin/UserManagement') },
  { role: 'Admin', id: 'products', path: '/admin/products', label: 'Product Catalog', component: () => import('./components/admin/ProductManagement') },
  { role: 'Admin', id: 'customer-approvals', path: '/admin/customer-approvals', label: 'Customer Approvals', component: () => import('./components/admin/CustomerApprovals') },
  { role: 'Admin', id: 'master-data', path: '/admin/master-data', label: 'Master Data', component: () => import('./components/admin/MasterDataManagement') },
  { role: 'Admin', id: 'activity-logs', path: '/admin/activity-logs', label: 'Activity Logs', component: () => import('./components/admin/ActivityLogs') },
  { role: 'Admin', id: 'reports', path: '/admin/reports', label: 'Reports & Export', component: () => import('./components/admin/ReportsExport') },
  { role: 'Admin', id: 'settings', path: '/admin/settings', label: 'System Settings', component: () => import('./components/admin/SystemSettings') },
];

export const routes = adminRoutes;
