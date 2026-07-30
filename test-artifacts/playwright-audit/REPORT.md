# Production Playwright Audit

Target: `https://kaiserwhalemarkting.vercel.app`

Date: 2026-07-30

Production data was not modified. No user was created. The Admin Add User POST was sent without authorization and with an empty body, so it terminated at authentication with `401 UNAUTHENTICATED`.

## Result summary

| Check | Result |
|---|---|
| Playwright MCP availability | Pass — dedicated Playwright MCP server was callable |
| Login page | Pass |
| Mobile responsive layout | Pass at 360×800 and 390×844 |
| Tablet responsive layout | Pass at 768×1024 |
| Desktop responsive layout | Pass at 1366×768 and 1920×1080 |
| Browser console errors | Pass — none observed |
| Failed network requests | Pass — none observed during UI checks |
| Horizontal overflow | Pass — `scrollWidth === clientWidth` at all requested viewports |
| Public navigation link | Pass — Forgot Password opens its modal |
| Browser Back, Forward, Refresh | Pass on `/login` and the Forgot Password interaction |
| Modal open, close, Escape, scrolling | Pass at 360×800 and 1366×768 |
| Protected-route auth guard | Pass — requested protected routes redirect to `/login` |
| Director Dashboard loading | Blocked — no Director test credentials configured |
| Director Comments and Notifications navigation | Blocked — no Director test credentials configured |
| Marketing Dashboard | Blocked — no Marketing test credentials configured |
| Visits tabs | Blocked — no Marketing test credentials configured |
| Admin Add User CORS | Pass — preflight accepted; unauthenticated POST rejected safely |

## Responsive and login evidence

- [360×800](login-360x800.png)
- [390×844](login-390x844.png)
- [768×1024](login-768x1024.png)
- [1366×768](login-1366x768.png)
- [1920×1080](login-1920x1080.png)

At every viewport:

- Route after initial navigation: `/login`
- Console errors: none
- Failed requests: none
- HTTP responses at 400 or above: none
- Horizontal overflow: none

The responsive breakpoints intentionally reveal more supporting marketing content as width increases. No clipped controls or unintended horizontal scrolling were observed.

## Navigation and browser history

Action sequence:

1. Open `/login`.
2. Click `Forgot Password?`.
3. Use browser Back.
4. Use browser Forward.
5. Refresh.
6. Directly navigate to each protected route.

Observed:

- Forgot Password opened an accessible `role="dialog"` modal.
- Back, Forward, and Refresh remained on a functional `/login` page.
- `/director`, `/director/comments`, `/director/notifications`, `/marketing`, `/marketing/visits`, and `/admin/users` all redirected to `/login`.
- Console errors: none.
- Failed requests or HTTP error responses: none.

Evidence: [history and Forgot Password state](forgot-history-1366x768.png), [protected route auth gate](auth-gate-admin-users-1366x768.png)

## Modal behavior

Tested at 360×800 and 1366×768.

- Open: pass
- Close button: pass
- Escape: pass
- Background scroll lock: pass; both `body` and `html` used `overflow: hidden`
- Wheel while open: page remained at `scrollY = 0`
- Modal content fit its available viewport in both tested sizes

Evidence: [mobile modal](forgot-modal-360x800.png), [desktop modal](forgot-modal-1366x768.png)

## Admin Add User CORS

Request URL:

`https://ubmsqbtknwizioukeple.supabase.co/functions/v1/admin-create-user`

Origin:

`https://kaiserwhalemarkting.vercel.app`

### OPTIONS preflight

- Status: `204`
- `Access-Control-Allow-Origin: https://kaiserwhalemarkting.vercel.app`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Max-Age: 86400`
- `Vary: Accept-Encoding, Origin`

### POST inspection

- Request used no Authorization header and an empty JSON body.
- Status: `401`
- Response: `{"success":false,"error":"Missing or invalid Authorization header","code":"UNAUTHENTICATED"}`
- `Access-Control-Allow-Origin: https://kaiserwhalemarkting.vercel.app`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Max-Age: 86400`
- `Vary: Accept-Encoding, Origin`
- `Content-Type: application/json`

This is the expected safe outcome: the CORS preflight succeeds for the production origin, while the POST is rejected before validation or user creation.

Likely source: `supabase/functions/admin-create-user/index.ts`

## Issues

No reproducible issue was found within the unauthenticated scope.

## Authentication blocker

The workspace contains an authenticated Playwright suite expecting these environment variables, but none are configured:

- `E2E_DIRECTOR_EMAIL`
- `E2E_DIRECTOR_PASSWORD`
- `E2E_MARKETING_EMAIL`
- `E2E_MARKETING_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Consequently, the following checks could not be executed as real authenticated UI flows:

- Director Dashboard loading
- Director Comments navigation
- Director Notifications navigation
- Marketing Dashboard
- Visits tabs
- Admin Add User UI request capture

Relevant test/source files:

- `tests/e2e/authenticated-workflows.spec.js`
- `src/components/director/DirectorDashboard.jsx`
- `src/components/director/CommentsHistory.jsx`
- `src/components/director/DirectorOperations.jsx`
- `src/components/marketing/MarketingDashboard.jsx`
- `src/components/marketing/VisitsPlanningHub.jsx`
- `src/components/admin/UserManagement.jsx`

To complete the audit without touching real production data, configure dedicated read-only/test role accounts and rerun the authenticated flows. The Add User UI should still be intercepted or submitted without authorization so that no user is created.
