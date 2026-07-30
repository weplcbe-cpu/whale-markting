# Authenticated E2E Test Checklist

Use only temporary `*.test@kaiserwhale.com` accounts and `TEST_` / `E2E_` records. Record the actual result and evidence beside each step; do not mark an item passed based only on a route definition.

## Common checks for every role

- [ ] Log in and confirm the role-specific dashboard loads without console errors.
- [ ] Open every sidebar item; verify the heading and URL.
- [ ] Use every dashboard shortcut and card; verify the intended destination.
- [ ] Open Settings, profile, notification panel, and logout controls.
- [ ] Search a customer, plan, report, and employee where permitted; select each result.
- [ ] Open a notification; verify unread count decreases and the destination is correct.
- [ ] Refresh one direct page URL, then use Back and Forward.
- [ ] Paste each permitted direct URL into a new tab; verify it renders.
- [ ] Paste one cross-role URL; verify redirect to the current role’s dashboard.
- [ ] Open each modal; verify Escape, outside click, Cancel, Close, and successful submit behavior.

## Marketing: `marketing.test@kaiserwhale.com`

- [ ] Login → Dashboard → Customers → create/open `TEST_` customer.
- [ ] Visits → create `TEST_` visit plan → save draft → submit tour plan → My Plans; record status.
- [ ] Add a `TEST_` follow-up.
- [ ] Submit `TEST_` daily report.
- [ ] Open Director Comments and notification destination.
- [ ] Logout; verify `/marketing/*` cannot be viewed while signed out.

## Director: `director.test@kaiserwhale.com`

- [ ] Login and verify dashboard counts include the temporary records.
- [ ] Today Schedule → Tour Plans Review → open the submitted `TEST_` plan.
- [ ] Refresh its detail URL → Back → Forward.
- [ ] Approve without a comment; verify it leaves the pending list and Marketing receives a notification.
- [ ] Open Visit Reports, Daily Reports, Customers, Follow-ups, Product/Area/Performance Analytics, Comments, and Notifications.
- [ ] Logout; verify `/director/*` cannot be viewed while signed out.

## Admin: `admin.test@kaiserwhale.com`

- [ ] Login → Dashboard → Users → Customer Approvals → Product Catalog → Master Data.
- [ ] Open Reports, Activity Logs, and System Settings; save a harmless test-only setting only if persistence is supported.
- [ ] Refresh `/admin/users`, then Back and Forward.
- [ ] Logout; verify `/admin/*` cannot be viewed while signed out.

## Evidence record

| Role | Step | Expected result | Actual result | Pass | Evidence / issue |
| --- | --- | --- | --- | --- | --- |
| Marketing |  |  |  |  |  |
| Director |  |  |  |  |  |
| Admin |  |  |  |  |  |
