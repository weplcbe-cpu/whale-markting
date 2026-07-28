# Navigation Flow Report

## Status key

- **PASS** — static target, component, and action trace are valid.
- **FIXED** — a defect was found and corrected in this workspace.
- **LIVE REQUIRED** — visual/gesture behavior cannot be proven without a controllable authenticated browser.

## Role coverage

| Role | Sidebar | Navbar | Dashboard | Notifications | Search | Back/Forward/Refresh | Direct URL | Route guard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Admin | FIXED — centralized URL menu | FIXED — Settings `/admin/settings` | FIXED — no nonexistent tabs | FIXED — role route mapping | LIVE REQUIRED — Director-only result panel | PASS static | PASS static | PASS static |
| Director | PASS | PASS | PASS | PASS | PASS static — routes resolve | PASS static | PASS static | PASS static |
| Marketing | PASS | FIXED — Settings `/marketing/profile` | PASS | FIXED — role route mapping | LIVE REQUIRED — Director-only result panel | PASS static | PASS static | PASS static |

## Known live-only checks

The following are intentionally not marked as browser-verified: hover/focus behavior, Escape handling of legacy overlays, actual table pagination/sorting interactions, session persistence across browser refresh, and RLS/RPC authorization responses. These require the authenticated browser matrix in `E2E_TEST_CHECKLIST.md`.

## Static completion

- 34 unique routes: PASS
- Route component existence: PASS
- Sidebar/menu route drift: PASS
- Dashboard shortcut targets: PASS after Admin fixes
- Notification destination routes: PASS after role-specific routing fix
- Cross-role route fallback: PASS static
- Legacy Admin active-tab navigation: FIXED; route state is now URL-driven
