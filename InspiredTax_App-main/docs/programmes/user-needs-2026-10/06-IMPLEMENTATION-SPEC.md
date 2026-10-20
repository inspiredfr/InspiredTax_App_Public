# 06 — Implementation spec (draft v0.1)

Owner decisions 2026-10-16: OD-1 yes, OD-2 route C, OD-3 yes, OD-4 yes,
OD-5 yes (P4), paywall = **keep the 7-day trial at sign-in; Basic shows the
P1 amount and due date from a quick estimate, no details**. Espresso spec
(`07`) on hold.

Each batch: own branch `claude/<batch>` from `origin/main`, gate per CLAUDE.md,
prototype in `_mockups/` (both themes, 360 px) **before** `src/` for B2–B4.

**B1 inputs confirmed (2026-10-17).** `calcFullTax()` returns
(`02-core.js:2217-2226`): `retTotal`, `retAllowed`, `retMax`, `otherDed`
(= travel + home office + tools + income protection + subscriptions +
subsistence + foreign subsistence + company car, `:1940`), `additionalDed`,
`donTotal`. It subtracts `otherDed + additionalDed` **before** the s11F cap
test (`:2013`).

## B0 — Dead link (quick fix)
Dashboard provisional chip calls `navigateTo('income','provisional')`
(`08-dashboard-theme.js:1007`); no such tab exists since OD-18 moved
Provisional tax to `summary-provtax`. Point it at the provisional tab;
verify in browser. Gate: `npm test`.

## B1 — Forecast plumbing (S-A, S-B) — prerequisite · BACKLOG 101
**Since BACKLOG 87 (#439, 2026-10-17):** an empty plan already projects the
captured year through `capturedPlan()` / `effectivePlan()`, read-only, with
a *Based on the income you captured* note. Keep that. B1 covers the rest:
non-empty plans, the full deduction set, the double count and the s11F base.
`prefillFromActual()` now writes `capturedPlan()`; step 2 below changes
`capturedPlan()` itself so the two stay one source (WR-8).

1. `calcCurrentYear()` takes captured deductions from `calcFullTax()`
   output for **every** plan, as it already does for income:
   `otherDed: r.otherDed + r.additionalDed + monthAdj.otherDed`,
   `retContrib: r.retTotal + monthAdj.retirement` (contributions — the cap
   is applied inside `calcTaxForYear`, never pass `retAllowed`). Month rows
   become **adjustments not captured elsewhere**.
1a. **Retirement cap base must match the return.** `calcTaxForYear()` caps
   s11F on `gross` unless `retBase` is passed (`02-core.js:1284`); the
   return uses the s11F(2)(b) base (higher of remuneration and TI before
   s11F, `:1847-2017`). Expose that base from `calcFullTax()` as an additive
   return field (e.g. `s11fBase`) and pass it as `retBase`. Fixture: a
   contractor with RA contributions near the cap gets the same `retAllowed`
   in planner and return.
2. `capturedPlan()` (and so *Pre-fill* and the empty-plan projection) keeps
   salary, PAYE and bonus only; deductions and retirement no longer copied
   into months, because step 1 reads them live.
3. **Migration:** existing plans with non-zero `retirement`/`otherDed` rows
   may now double-count. Show a one-time review card listing them with
   "Clear copied deductions" / "Keep". No silent data change.
4. Column renamed **"Other income not captured elsewhere"**; live line above
   the table: "Already included: Business R… · Rental R…" (`body.html:1873`).
5. Tests: golden fixtures "R10k home office added after a month is planned
   lowers P1", "income protection captured reaches the planner" and "business record +
   planner months shows the included-sources line"; `npm run test:engine`;
   any `test:update` justified line-by-line.

## B2 — Quick estimate + free headline (S-C route C, S-E)
- **Data:** no new engine path. Estimate = ordinary Business record (and
  optional Salary record) with `source: 'estimate'`; selects the matching
  income type so provisional status auto-sets (`02-core.js:7393`).
- **Fields (4):** expected turnover this tax year · expected business costs ·
  salary gross + PAYE (optional) · provisional paid so far.
- **Entry points:** onboarding fork after income types ("2-minute estimate /
  capture in detail"); planner empty state (`03-income.js:1906`); Dashboard
  card when provisional and no forecast. All on **free** screens.
- **Free headline:** Basic sees the existing Dashboard milestone line
  "Recommended: R x" with date (`08-dashboard-theme.js:931`). Penalty check,
  planner detail and the business editor stay Premium (overlay already says
  entries remain in the calculation).
- **Estimate chip** on every figure that depends on an estimate record;
  "Turn this into a full record" opens the business editor.
- Business income gains **"Full year or so far?"**; if so far, months covered
  → projected figure shown separately (S1.5).
- **Two payment figures (S-E):** minimum penalty-safe (from
  `calcProvisionalPenalty`) and full; difference shown.
- Prototype first. Gate: `npm run test:engine` + smoke.

## B3 — Shortcuts at the point of friction (S-D)
Add the rule to `UX-WRITING-STYLE-GUIDE.md`. Build: empty planner card (B2),
3rd-expense-row hint, leaving onboarding with nothing captured, deadline ≤ 21
days with no forecast (Dashboard), Help → "Ways to get your answer".
Prototype first. Gate: `npm test`.

## B4 — Goal lenses (S-F) + P4 lens (S-H)
Onboarding question "What do you want to do first?": Plan provisional
payments · See what my side income costs · Prepare my return / catch up years
· Manage retirement income (P4) · Just check my salary tax. Answer reorders
Dashboard cards and drawer order; never hides capability; changeable in
Profile. P4: verify age-at-year-end with birth year+month (F4.1); large-text
pass at 130 % and 200 %. Prototype first. Gate: `npm test`, `npm run shots`.

## B5 — Side-income cost card (S-G)
"Your side income adds R x" = `calcFullTax()` with and without side sources
(two runs, no new formula). Gate: `npm run test:engine`.

## B6 — Positioning copy (S-K)
**Largely covered by BACKLOG 84** (`docs/product/MESSAGING.md`, #431): one
description of the app everywhere, incl. offline and the free/Premium split.
Remaining: check the paywall overlay (`15-entitlement-ui.js` `entGateScreen`)
says "file on eFiling yourself" and "nothing leaves your phone" in
MESSAGING.md's words; otherwise close.

## Not in scope
Trial-anchor changes; seasonal pricing (OD-7, after `05` research);
Espresso automation (`07`, on hold).
