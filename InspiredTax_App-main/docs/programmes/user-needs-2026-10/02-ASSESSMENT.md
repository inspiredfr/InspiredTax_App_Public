# 02 — Assessment: the live app against user needs

Verified against `src/` at `origin/main` `c6487be` (v8.36.0) on 2026-10-16.
Severity: **H** = breaks a deal-breaker or success criterion for the core
persona; **M** = degrades it; **L** = polish. "Persona" cites `01`.

## What already works well

Credit where due — these meet needs in `01` today:

- **Provisional hub** (`03-income.js:1820-1960`): provisional verdict *with
  the reason* (`provWhy`), next deadline with days left and urgency colour,
  P1/P2/P3 recommendations, para 20 check with the basic-amount safe harbour,
  a pinned year-end position, and "file even when nothing is due" — covers
  S1.3, S1.9, S2.2.
- **Business capture is already turnover + categorised costs** with
  "usual costs" chips per business type and an overlap warning against
  separate deductions (`05-list-modules.js:1180-1284`) — a one-record rough
  estimate is *mechanically* possible today.
- **Planner auto-includes** captured business, rental, other receipts, crypto
  and investment income, plus donations (`10-current-year-planner.js:227-241`).
- **Onboarding tailors the app** to selected income types and deduction
  answers (`12-bootstrap-onboarding.js:193-275`) — the bespoke layer exists.
- **Historical years** back to 2015/16 and a field-by-field **ITR12 report**
  (`14-entitlement.js:75-80`) serve P3.

## Findings

| # | Sev | Finding | Evidence | Breaks |
|---|---|---|---|---|
| F1 | **H** | **The free tier serves the anti-profile; the core persona meets the paywall on her first income type.** Business/freelance, rental, investment income, home office, travel, medical and the provisional planner are all Premium. Free ≈ salary + retirement. | `14-entitlement.js:43-82` (`ENT_FEATURES`); `closed-testing-2026-10/FEEDBACK-LOG.md` §1 tier column | D1.3, U10, F3.4 |
| F2 | **H** | **The 7-day trial starts at first sign-in, not at first need.** A contractor who installs in March loses the trial long before 31 Aug. Offline first launch = Basic with no trial. | `monetization/00-DESIGN.md` D-M3, D-M6; §trial anchor | F1.6 |
| F3 | **H** | **Deductions captured on the Deductions pages don't reach the IRP6 recommendation once a month is planned.** *Partly fixed by BACKLOG 87 (#439, 2026-10-17):* with every month blank, `effectivePlan()` now projects the captured year. Still open: after any month or lump sum is entered, captured deductions stop reaching the forecast; and the captured year takes only travel, home office and tools — not income protection, subscriptions, subsistence, company car or other claims, which the return deducts. | `10-current-year-planner.js` `capturedPlan`, `effectivePlan`, `calcCurrentYear` | D1.5, S1.4, U2 — BACKLOG 101 |
| F4 | **H** | **Double-count trap.** The planner's "Gross Income" column invites monthly invoice entry, while captured business income is *also* added automatically — with no on-screen note saying so. | `body.html:1873` (column header); `10-current-year-planner.js:237-241` | D1.6, S1.8 |
| F5 | M | **Business income is one figure with no "so far vs full year" meaning.** Mid-year users guess. | `05-list-modules.js:1222-1227` (`biz-income`) | F1.1, S1.5 |
| F6 | M | **Recommendation targets full annual tax only.** JTBD-1 is "avoid the penalty *without overpaying*"; the safe-harbour minimum is computed (`calcProvisionalPenalty`) but never offered as the payment option. | `03-income.js:1884-1917` vs `:1710-1777` | S1.6, F1.4 |
| F7 | M | **The planner is tab 2 of 6 inside Provisional tax**; empty states say "Complete Step 1". Discoverable only to users who already know it's there. | `body.html:1821-1826`; `03-income.js:1906` | F1.5, U7 |
| F8 | M | **No "what does my side income cost" view.** | grep: no incremental/marginal-cost feature in `src/js` | D2.1, S2.1 |
| F9 | M | **Personas miss the majority.** 55% of provisional taxpayers are 55+; product framing, onboarding copy and store listing speak to 25–45. The engine supports age rebates — the *surfaces* don't target them. | `04` §2 | P4 |
| F10 | M | **Seasonal arbitrage in pricing.** Need peaks twice a year; monthly R75 × 2 deadline months = R150 vs annual R495; prepaid-3m launch R150. A rational provisional taxpayer subscribes monthly around deadlines. | `14-entitlement.js:283-288` | Revenue |
| F11 | M | **TaxTim gives planning tools away free** (calculators, expense tracker, logbook, bank importer, deadline reminders) and also files. InspiredTax's moat is privacy/offline/citations/planning depth — not yet stated where the user decides. | `04` §4 | Positioning |
| F12 | L | **Citations on planner amounts not confirmed.** Return trace cites (`02-core.js:2086` `para 21 Fourth Schedule`); P1/P2 recommendation cells show tips but no statutory reference was found in markup. | `body.html:1818-1960` | S1.7 — **verify** |
| F14 | M | **Dashboard provisional chip links to a tab that no longer exists**: `navigateTo('income','provisional')`; Provisional tax moved to `summary-provtax` (OD-18). Not yet confirmed in a browser. | `08-dashboard-theme.js:1007` | U7 |
| F15 | M | **Planner caps retirement on a different base from the return.** `calcTaxForYear()` tests s11F against `gross` unless `retBase` is passed; the planner passes none, while `calcFullTax()` uses the s11F(2)(b) base. Retirement allowed can differ between planner and return. | `02-core.js:1284-1288` vs `:1847-2017`; `10-current-year-planner.js:260-270` | U2 |
| F13 | L | **No way to measure real user friction.** No analytics by design (U3); closed-test log empty so far. Evidence must come from scripted tests (`07`) and tester feedback. | `FEEDBACK-LOG.md` §2 empty | Process |

## The gate, restated with evidence

Discovery assumed the gate was *capture effort*. The code says the gate is
three things, in order of weight:

1. **Paywall timing** (F1, F2) — the core persona can't see the planner work
   unless she installs within 7 days of a deadline.
2. **Forecast plumbing** (F3, F4) — once inside, the planner doesn't react to
   deductions and can double-count income, so the number can't be trusted.
3. **Capture ambiguity** (F5, F7) — rough entry is possible but unlabelled
   and undiscoverable.

A rough-estimate mode alone fixes only (3). It needs (2) fixed underneath it
or it will produce a confident wrong number faster.
