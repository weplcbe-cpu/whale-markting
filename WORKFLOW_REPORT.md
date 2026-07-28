# Workflow Report

## Marketing workflow — PASS (static trace)

| User action | Component/action | Context mutation and Supabase effect | Refresh/notification |
| --- | --- | --- | --- |
| Login | LoginPage → `login` | `auth.signInWithPassword`, `loadProfile` | loads role-scoped portal data |
| Add customer | CustomerManagement → `addCustomer` | `customers.insert` | `refreshEntity('customers')`, toast, activity log |
| Add visit | AddVisitPlan → `addVisitPlan` | `visit_plans.insert` | `refreshEntity('visit_plans')`, activity log |
| Submit tour plan | Weekly/NextMonth sheet → `addTourPlanBatch` | `visit_plans.insert` | refreshes plans; inserts Director plan notification; activity log |
| Submit visit report | report form → `submitVisitReport` | `visit_reports.insert`; optional plan status update | refreshes report/plan; activity log |
| Submit daily report | DailyReportSubmit → `submitDailyReport` | `daily_reports.insert` | refreshes reports; activity log |
| Add follow-up/tender | management page → `addFollowUp` / `addTender` | `follow_ups.insert` / `tenders.insert` | entity refresh, activity log, toast |

## Director review workflow — PASS (static trace)

| User action | Context mutation and Supabase effect | Refresh/notification |
| --- | --- | --- |
| Approve/reject tour batch | WeeklyPlanReview → `reviewTourPlanBatch` / `updateTourPlanBatchStatus` | RPC or `visit_plans.update`; `refreshEntity('visit_plans')`; Marketing plan notification where direct update path is used |
| Request changes | `requestTourPlanChanges` | `request_tour_plan_changes` RPC | plan refresh |
| Comment | DirectorOperations/DirectorVisitReports → `addDirectorComment` | `director_comments.insert`, `notifications.insert` | comments refresh; Marketing notification state updated; activity log |
| Mark notification read | Navbar/DirectorOperations → `markNotificationRead` | `notifications.update` | unread UI state updates |

## Admin workflow — FIXED/PASS (static trace)

| User action | Context mutation and Supabase effect | Refresh/notification |
| --- | --- | --- |
| Create/delete user | UserManagement → `addUser` / `deleteUser` | authenticated Admin Edge Functions | `loadAllData`, activity log, toast |
| Approve/reject customer | CustomerApprovals → `approveCustomer` / `rejectCustomer` | `customers.update` | customer refresh, activity log, toast |
| Product change | ProductManagement → `addProduct` / `toggleProductStatus` | `products.insert` / `products.update` | local state, activity log, toast |
| Save settings | SystemSettings → `updateCompanyInfo` | `company_info.update` | `refreshEntity('company_info')`, activity log, toast; duplicate click blocked |

Every listed mutation performs an error branch with a visible toast or throws to its submitting component. Live permissions and RPC behavior still require authenticated browser testing.
