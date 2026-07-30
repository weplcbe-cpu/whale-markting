# Button Action Report

Static scan result: 243 declared interactive action bindings (`button`, shared `Button`, `onClick`, or `onSubmit`) across `src/components`.

## Navigation actions — PASS/FIXED

| Surface | Action | Target/function | Status |
| --- | --- | --- | --- |
| Sidebar | Marketing/Director | centralized route `path` via `navigate` | PASS |
| Sidebar | Admin | centralized `adminRoutes` via `navigate` | FIXED |
| Mobile nav | Marketing/Director | centralized route lookup | PASS |
| Mobile nav | Admin reports/customer approvals | Admin URL selector | FIXED |
| Navbar Settings | role-specific profile/settings route | `navigate` | FIXED |
| Navbar notification | role-specific notification destination | `markNotificationRead`, then `navigate` | FIXED |
| Admin dashboard cards | users/customer approvals/reports/activity logs | Admin URL selector | FIXED |
| Director dashboard cards | route literals and dynamic batch detail route | `navigate` | PASS |
| Marketing dashboard cards | marketing route lookup + query state | `navigate` | PASS |

## Data and modal actions — PASS (static trace)

| Action family | Start | Context/action invoked | Error/loading protection |
| --- | --- | --- | --- |
| Create/update/delete user | UserManagement | `addUser`, `updateUser`, `toggleUserStatus`, `deleteUser` | form state and toast errors |
| Customer approval | CustomerApprovals | `approveCustomer`, `rejectCustomer` | modal close/action error toast |
| Planning/review | AddVisitPlan, WeeklyPlanningSheet, WeeklyPlanReview | plan create/submit/review/status functions | submit validation; server error toast/throw |
| Reports/follow-ups | Marketing workflow pages | submit/add context functions | form validation and toast error paths |
| Director details/comments | Director Operations/Reports | local modal state, `addDirectorComment` | close/cancel/outside close; toast errors |
| System settings | SystemSettings | `updateCompanyInfo` | saving state now blocks duplicate submit |

Modal keyboard/outside-click support is provided by the shared `Modal` component where used; legacy page-local overlays require live browser confirmation for Escape behavior.
