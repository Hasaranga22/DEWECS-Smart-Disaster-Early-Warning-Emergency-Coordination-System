# UC4: Generate Post Event Analysis Report — UI Figures Documentation

This document provides the exact references, routes, scenario steps, final commit hashes, and detailed figure descriptions for **UC4: Generate Post Event Analysis Report** aligned with Group 18 design requirements.

---

## 📸 Figure NA-1: Report Setup

**Caption:**
> **Figure NA-1.** Report setup — Officer selects period and filters; validation is visible.

* **Route:** `/resources/analysis`
* **Scenario Step:** `Step 1: Report Setup & Filter Validation`
* **Final Commit:** `e6142f2` (`e6142f23c8099c4ffdd56dc5843b83a4fb1d63cb`)
* **Source Path:** `src/app/resources/analysis/page.tsx`
* **Visible Features:**
  * Date range selectors (`From: 2026-08-01`, `To: 2026-08-31`) with live date-ordering validation (`isFromAfterTo` <= 365 days).
  * Active filter chips with interactive remove buttons (`X`).
  * Language selector (`English (EN)`, `Sinhala (SI)`, `Tamil (TA)`).
  * Section inclusion checkboxes (`Alerts`, `Reach`, `Reports`, `Shelters`, `Supplies`).
  * Action controls (`Reset` and `Generate Report`).

---

## 📸 Figure NA-2: Summary / KPI View

**Caption:**
> **Figure NA-2.** Summary / KPI view — Saved period, generation time and distinct citizens reached are visible.

* **Route:** `/resources/analysis/[id]`
* **Scenario Step:** `Step 2: Post-Event Analysis Report Summary & Snapshot KPIs`
* **Final Commit:** `e6142f2` (`e6142f23c8099c4ffdd56dc5843b83a4fb1d63cb`)
* **Source Path:** `src/app/resources/analysis/[id]/page.tsx`
* **Visible Features:**
  * Frozen snapshot metadata: `generatedAt` timestamp, `sourceCutoff` timestamp, and report version badge (`v1.0 • FINAL`).
  * Filter scope headers (District: Kegalle, Hazard: FLOOD, Date window).
  * 4 Primary KPI Tiles: Alerts Issued, Distinct Citizens Reached, Reports Verified (with progress bar), Shelters Activated.
  * Distinct Citizen Reach Breakdown table (`PUSH` vs `SMS` attempt/delivered/failed metrics).
  * Ground report review tally and relief supply fulfillment summary.

---

## 📸 Figure NA-3: Visual Charts & Empty State

**Caption:**
> **Figure NA-3.** Charts and empty state — A meaningful breakdown or no-data state is visible.

* **Route:** `/resources/analysis/[id]/charts`
* **Scenario Step:** `Step 3: Visual Analytics Breakdown & Empty State Handling`
* **Final Commit:** `e6142f2` (`e6142f23c8099c4ffdd56dc5843b83a4fb1d63cb`)
* **Source Path:** `src/app/resources/analysis/[id]/charts/page.tsx`
* **Visible Features:**
  * Alert severity distribution chart (`ADVISORY`, `WATCH`, `WARNING`, `EMERGENCY`).
  * Ground report review decisions chart with explicit percentage denominators (`Verified X of Total = X%`).
  * Relief supply distribution chart with explicit denominators (`Distributed X of Total Allocated = X%`).
  * `warningFlag` empty-state banner when no activity is logged (`No activity recorded — charts unavailable`).

---

## 📸 Figure NA-4: PDF Export & Partner Share

**Caption:**
> **Figure NA-4.** PDF and share — Download and partner-specific share result are visible.

* **Route:** `/resources/analysis/[id]/share`
* **Scenario Step:** `Step 4: PDF Export & Partner Share Outcome Tracking`
* **Final Commit:** `e6142f2` (`e6142f23c8099c4ffdd56dc5843b83a4fb1d63cb`)
* **Source Path:** `src/app/resources/analysis/[id]/share/page.tsx`
* **Visible Features:**
  * PDF document download button & format selector.
  * Target language dropdown and privacy masking toggle (`Apply privacy masking for external recipients`).
  * Partner agency selection checklist (NDRSC, Red Cross, Police).
  * Per-recipient share results table showing delivery statuses (`SENT` / `FAILED`), timestamps, failure reasons, and per-organization `Retry` buttons.
