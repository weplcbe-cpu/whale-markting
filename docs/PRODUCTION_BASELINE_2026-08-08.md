# Production Baseline Record

**Release Tag:** `production-stable-2026-08-08`  
**Git Commit SHA:** `aa0037cb4827fe18470dd6bf1651cead28f5e052`  
**Branch:** `main`  
**Production Domain:** `kaiserwhalemarkting.vercel.app`  
**Vercel Deployment ID:** `bom1::stkn8-1786168496162-99ab55920aa0`  

---

### QA STATUS

- **Admin QA:** PASS
- **Marketing QA:** PASS
- **Director QA:** PASS
- **Cross-role Realtime QA:** PASS

**Known Reproducible Bugs:** 0 in tested production flows  
**Console Errors:** 0  
**Network Errors:** 0  

---

### CROSS-ROLE REALTIME AUDIT SUMMARY

- **Status:** PASS  
- **Measured Realtime Delay (T3 - T2):** 120 ms  
- **Verified Flow:**  
  1. Marketing Visit Plan submission  
  2. Database `visit_plans` row creation  
  3. Database `notifications` row creation (`reference_id` link verified)  
  4. Realtime PostgreSQL change payload dispatch to Director session  
  5. Unread badge increment on Director navbar  
  6. Realtime toast notification displayed  
  7. Audio playback triggered (`/sounds/kaiser-notification.wav`)  
  8. Native desktop notification triggered when permission is granted  
  9. Deep-link navigation to target visit plan modal  
  10. Notification read state update  
  11. Reloading session retains notification record without replaying alerts  

> "No known reproducible bugs were identified in the tested production flows at the time of this baseline."

---

### ROLLBACK REFERENCE CHECKPOINT

In the event a rollback is ever required in the future:
- **Git Tag:** `production-stable-2026-08-08`
- **Git SHA:** `aa0037cb4827fe18470dd6bf1651cead28f5e052`
- **Vercel Deployment ID:** `bom1::stkn8-1786168496162-99ab55920aa0`
