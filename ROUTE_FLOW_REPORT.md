# Route Flow Report

Static verification date: 2026-07-28. This report verifies configured route resolution, role entry points, static navigation targets, component existence, fallback behavior, and route guard behavior. It does not represent live browser proof.

## Route guard and history flow — FIXED/PASS

| Start | Guard/action | Destination | Rendered component | Result |
| --- | --- | --- | --- | --- |
| Unauthenticated protected URL | `AppContent` auth effect | `/login` (replace) | `LoginPage` | PASS |
| Authenticated `/` or `/login` | role default redirect | `/admin`, `/director`, or `/marketing` (replace) | role dashboard | PASS |
| Admin opens non-Admin URL | Admin route wildcard | `/admin` (replace) | `AdminDashboard` | PASS |
| Director opens non-Director URL | Director route wildcard | `/director` (replace) | `DirectorDashboard` | PASS |
| Marketing opens non-Marketing URL | Marketing route wildcard | `/marketing` (replace) | `MarketingDashboard` | PASS |
| Refresh/direct route | BrowserRouter + matching role route | same URL | configured lazy component | PASS (static) |

## Marketing routes — PASS

| Route | Component | Sidebar/dashboard entry |
| --- | --- | --- |
| `/marketing` | MarketingDashboard | Dashboard |
| `/marketing/customers` | CustomerManagement | Sidebar, Add Customer |
| `/marketing/visits` | VisitsPlanningHub | Sidebar, visit cards, Add Plan |
| `/marketing/reports` | DailyReportSubmit | Sidebar, dashboard |
| `/marketing/follow-ups` | FollowUpManagement | Sidebar, dashboard |
| `/marketing/director-comments` | DirectorCommentsFeed | Sidebar, notification |
| `/marketing/profile` | ProfilePage | Sidebar, Settings |

## Director routes — PASS

| Route group | Routes | Component family |
| --- | --- | --- |
| Dashboard/team | `/director`, `/director/team` | DirectorDashboard, TeamOverview |
| Planning | `/director/today-schedule`, `/director/tour-plans`, `/director/tour-plans/:batchId`, `/director/visit-plans` | DirectorOperations, WeeklyPlanReview |
| Reports | `/director/visit-reports`, `/director/daily-reports`, `/director/reports` | DirectorVisitReports, DirectorOperations |
| Operations | `/director/customers`, `/director/follow-ups` | CustomersOverview, DirectorOperations |
| Analytics | `/director/analytics/products`, `/director/analytics/areas`, `/director/analytics/performance` | DirectorOperations, PerformanceAnalytics |
| Communication/profile | `/director/comments`, `/director/notifications`, `/director/profile` | CommentsHistory, DirectorOperations, ProfilePage |

## Admin routes — FIXED/PASS

| Route | Component | Previous issue / resolution |
| --- | --- | --- |
| `/admin` | AdminDashboard | URL route added; previously state-only |
| `/admin/users` | UserManagement | URL route added |
| `/admin/customer-approvals` | CustomerApprovals | URL route added |
| `/admin/products` | ProductManagement | URL route added |
| `/admin/master-data` | MasterDataManagement | URL route added |
| `/admin/reports` | ReportsExport | URL route added |
| `/admin/activity-logs` | ActivityLogs | URL route added |
| `/admin/settings` | SystemSettings | URL route added; persistence repaired |

All 34 configured paths have a unique path and an existing lazy-loaded component. `node scripts/audit-navigation.mjs` checks this on every run.
