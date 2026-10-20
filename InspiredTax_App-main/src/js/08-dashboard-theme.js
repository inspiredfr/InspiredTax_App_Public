import { scenarioReviewApplies, captureNav, lblWithInfo, navigateToCapture, $, APP, calcFullTax, debounceSave, esc, getUserFullName, fmt, getActiveTaxYear, getSelectedIncomeTypes, gs, gv, hasIncomeCaptured, navigateTo, normaliseResidency, pct, showToast, iconClassFor, MODE_PREFIX_MAP, miniCardHtml } from './02-core.js';
import { FILING_DEADLINES, iconHtml, msIconHtml } from './01-data.js';
import { getIncomeOutstanding, provRecommendations } from './03-income.js';
import { getDeductionsOutstanding } from './04-deductions.js';
import { renderAll, renderReward, renderDashBalance, glanceCardSpecs } from './07-render-summary.js';
import { updateCurrentYear } from './10-current-year-planner.js';
import { getCarriedBalanceOutstanding, getCarriedBalanceRows } from './13-patches.js';
import { entFeatureForScreen, entUnlocked, entOnLockedTap } from './14-entitlement.js';
import { entChipHtml } from './15-entitlement-ui.js';
import { renderCloudBackupOffer } from './18-cloud-backup-ui.js';

/* ============================================================
   InspiredTax v8.5 — DASHBOARD, ACCORDION, THEME
   ============================================================ */

/* Batch B/B-2 (UX #1/#5): provenance popovers — provTip/provBtn now live in
   02-core so every render module can share them. */

/* ── DASHBOARD: shared completeness + next-deadline (one source of truth,
   reused by the Focus hero region and the legacy glance strip) ── */
/* §5.5: journey checklist — the single source for both the first-run
   checklist and the completeness bar. The old dashCompleteness() read eight
   field ids that no longer exist in the shell, so the bar was permanently
   0% ("0 of 8") regardless of data. Signals below are live APP/engine state. */
/* B4 Simplification (01-SPEC.md §3.2): the step list, cut from six to five.
   "Add your IRP5 income" and "Capture PAYE withheld" (item 24) are gone —
   they are how you complete "Add your income", not separate journeys, and
   listing them made a first-run dashboard read like a six-part form. */
/* PHASE 2 (G5 / H2) — the six-step dashboard hierarchy.

   Each step now owns its outstanding items as SUB-STEPS instead of them
   being lumped into a separate "still to add" list below the steps. That
   list was the direct cause of the contradiction the owner reported: the
   ring read "5 of 5 done — 100%" while three things were still outstanding,
   because completeness counted only the coarse steps and the outstanding
   items were computed somewhere else entirely.

   The rule that resolves it: a step is not done while it still has an
   outstanding sub-step. Its own condition is necessary, never sufficient.

   The provisional-planning step is conditional — it is only a step at all
   for a provisional taxpayer, so a pure PAYE profile is not permanently stuck
   one short of the total. (QA 2026-08 cut the list again, from five steps to
   three; see the note on `steps` below.) */
export function dashChecklist() {
  const r = calcFullTax();
  const groups = getAllOutstanding();
  const byLabel = (l) => (groups.find(g => g.label === l) || { items: [] }).items;

  const incomeSubs  = byLabel('Income');
  const dedSubs     = byLabel('Deductions');
  const carriedSubs = byLabel('Tax balances');

  /* B9.6: shared with taxHeroState() (07-render-summary.js) so the hero and
     this checklist can never disagree about whether income was captured —
     it used to be this same test written out twice, and neither copy counted
     retirement lump sums. */
  const hasIncome = hasIncomeCaptured(r);
  const hasDedChoice = Object.values(APP.dedChecks || {}).some(Boolean);

  /* QA 2026-08 (B2-DASH-12, B1-18): "Set up your details" and "Choose your
     income and what you can claim" are gone as steps.

     Neither was ever a task the user could be asked to do from here. The first
     was hardcoded `done:true` — it is complete the moment an account exists.
     The second is completed by onboarding, which every user finishes before
     reaching this dashboard at all. Two of five steps therefore arrived
     pre-ticked, which made "2 of 5 done" on a completely empty return: the
     progress reading overstated real progress by 40% before any tax work had
     been captured. Three steps that can actually be outstanding is an honest
     denominator.

     `hasDedChoice` still drives the "What you can claim" step's own condition
     below, so nothing about activation logic moves — only the two rows go. The
     selected-income-types read went with them: it existed solely to count
     sources for the removed step's subtitle. */
  const steps = [
    /* QA 2026-08 (design handoff §6, note 8): step icons → monochrome
       Material Symbols (was the hand-drawn SVG set / emoji). Glyph names
       per the approved mockup. */
    { ico:'description', iconName:'payments', area:'income', label:'Add your income', sub:'Salary, bonus, interest, rent…',
      done: hasIncome && incomeSubs.length === 0, subs: incomeSubs,
      nav:"navigateTo('income','main')" },

    { ico:'fact_check', iconName:'note_stack_add', area:'deductions', label:'Deductions', sub:'Retirement, medical, donations…',
      done: hasDedChoice && dedSubs.length === 0, subs: dedSubs,
      nav:"navigateTo('deductions','selections')" },

    /* QA 2026-08 (B1-19): "done" was simply "nothing outstanding", so a user who
       had never engaged with balances at all showed the step complete — a false
       done, since no review had happened. B1-19 asks for two distinct routes:
         (a) the user reviewed the balance types and none apply, or
         (b) they identified applicable ones and all of those are captured.
       (b) is carriedSubs being empty while rows exist. (a) is observable
       already: completing onboarding step 6 writes an answer for every balance
       type into carriedBalanceAnswers (default 'no'), so a populated object IS
       the review — no separate acknowledgement control is needed. An account
       that has answered nothing yet now correctly reads as not done. */
    { ico:'history', iconName:'swap_horizontal_circle', area:'prioryear', label:'Tax balances', sub:'Anything carried over from your last assessment',
      done: carriedSubs.length === 0 && Object.keys(APP.carriedBalanceAnswers || {}).length > 0,
      subs: carriedSubs,
      nav:"navigateTo('summary','prioryear')" },
  ];

  /* Step 6 — provisional planning. Only a step for a provisional taxpayer.
     Completion is a deliberate stopgap (04-FEEDBACK-ORGANIZED.md leaves it
     "TBD"): done once any provisional payment has been captured for the
     year, since that is the observable signal that the user has engaged
     with the provisional process. It is not a tax-correctness judgement and
     nothing downstream reads it. */
  if (gs('p_provisional') === 'yes') {
    const provPaid = (gv('p_prov_p1') || 0) + (gv('p_prov_p2') || 0) + (gv('p_prov_topup') || 0);
    steps.push({ ico:'payments', iconName:'tax', area:'provtax', label:'Provisional tax planning',
      sub: provPaid > 0 ? 'Payments captured' : 'Plan and record your P1/P2/P3',
      done: provPaid > 0, subs:[], nav:"navigateTo('summary','provtax')" });
  }

  return steps;
}

/* Completeness stays step-based — ONE denominator, and it does not move as
   work is done. It no longer contradicts the outstanding count because the
   steps themselves are now honest: a step carrying an outstanding sub-step
   is not done, so 100% is reachable only when nothing is outstanding.

   (Counting each sub-step as its own unit was the other option. It weights
   the ring more finely, but the denominator then shrinks every time an item
   is cleared, which reads as the goalposts moving.) */
export function dashCompleteness() {
  const steps = dashChecklist();
  const filled = steps.filter(i => i.done).length;
  const subTotal = steps.reduce((n, s) => n + (s.subs ? s.subs.length : 0), 0);
  /* QA 2026-09: "steps" (renamed from "things") are the individual granular
     items the user told us apply — selected income sources, enabled
     deductions, applicable carried balances — not the coarse categories
     above. Total = every one of those; done = total minus what is still
     outstanding (subTotal, the same count the category sub-lists show). */
  const incomeSel = getSelectedIncomeTypes().length;
  const dedSel = Object.values(APP.dedChecks || {}).filter(Boolean).length;
  const balSel = getCarriedBalanceRows().length;
  const totalSteps = incomeSel + dedSel + balSel;
  const stepsDone = Math.max(0, totalSteps - subTotal);
  /* B6.2/B6.6/B6.7 (D-10, D-26, D-29): the reward card's per-area CAPTURED
     counts and "Your return"'s per-area OUTSTANDING counts must agree with
     this same denominator — computed once here, from the same step list
     both cards already read, rather than re-derived per caller. */
  const stepFor = (area) => steps.find(s => s.area === area) || { subs: [] };
  const incomeOut = stepFor('income').subs.length;
  const dedOut = stepFor('deductions').subs.length;
  const balOut = stepFor('prioryear').subs.length;
  const byArea = {
    income:     { captured: Math.max(0, incomeSel - incomeOut), outstanding: incomeOut },
    deductions: { captured: Math.max(0, dedSel - dedOut),       outstanding: dedOut },
    balances:   { captured: Math.max(0, balSel - balOut),       outstanding: balOut },
  };
  return { filled, total: steps.length, subTotal, totalSteps, stepsDone, byArea,
           pct: totalSteps ? Math.round((stepsDone / totalSteps) * 100) : 0 };
}
export function dashNextDeadline() {
  const yr = parseInt(gs('taxYear') || '2027');
  const today = new Date();
  /* Provisional deadlines are only relevant to provisional taxpayers — a
     pure employment/PAYE profile should never see a "Provisional P1 due"
     banner. Non-provisional taxpayers still get the ITR12 return deadline. */
  const isProv = gs('p_provisional') === 'yes';

  /* H3 (Phase 7) — the return deadline was anchored to the ACTIVE tax year
     (new Date(yr, 9, 20) — a hardcoded 20 October), which is the year still
     in progress. You cannot file a return for a year that has not ended, so
     this produced a date a full year further out than the real one and a
     day count to match: the owner's report of "return due 20 Oct 2027,
     449 days" is exactly this arithmetic.

     Corrected to the same anchor renderDashboardGlanceBottom() already used
     (and had a comment about, from an earlier device-QA finding): the tax
     year currently IN its filing season, with the real gazetted dates from
     FILING_DEADLINES rather than a hardcoded day-and-month. Provisional and
     non-provisional filers have different deadlines, which the hardcoded
     date also ignored.

     If the filing-season year is not in FILING_DEADLINES yet (the table is
     maintained per season), the return deadline is omitted rather than
     guessed — the provisional dates below are statutory and still show. */
  const filing = FILING_DEADLINES[String(getFilingSeasonTaxYear(today))];
  const deadlines = [
    ...(isProv ? [
      { label:'Provisional P1', date:new Date(yr-1,7,31) },
      { label:'Provisional P2', date:new Date(yr,1,lastDayOfFeb(yr)) },
      { label:'Provisional P3', date:new Date(yr,8,30) },
    ] : []),
    ...(filing ? [{ label:'Tax return',
                    date:new Date(isProv ? filing.provisional : filing.nonProvisional) }] : []),
  ].sort((a, b) => a.date - b.date);
  const nx = deadlines.find(d => d.date >= today);
  if (!nx) return null;
  const daysLeft = Math.ceil((nx.date - today) / 86400000);
  return { label: nx.label + ' due', date: nx.date, daysLeft,
    dateStr: nx.date.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'}) };
}

/* B0 Simplification — single outstanding-items source (01-SPEC.md §2).
   Returns the three per-area item lists as named groups. Each getter is the
   same function the per-page list renders from, so Dashboard and per-page
   counts can never disagree. Filters (overrides, empty groups) applied by callers. */
export function getAllOutstanding() {
  return [
    { label: 'Income',                   items: getIncomeOutstanding() },
    { label: 'Deductions',               items: getDeductionsOutstanding() },
    { label: 'Tax balances', items: getCarriedBalanceOutstanding() },
  ];
}

/* B4 Simplification (01-SPEC.md §3.2) — the completeness card.

   Replaces BOTH the first-run checklist and the separate outstanding-items
   section. One card answers "where am I and what is left", instead of a
   checklist that vanished the moment gross income went above zero and an
   outstanding list that appeared somewhere else.

   Collapsed (default once anything is done): a filling ring, "Your return:
   3 of 5 done", the count still to do, and a chevron — one row, so the tax
   position stays near the top of the page.
   Expanded: the steps, then the outstanding items grouped by area, every
   row clickable straight to where it is fixed (item 3 — the per-page lists
   never had `nav` wired; going through one renderer gives them all the
   same behaviour).

   No dismiss checkbox (item 42). There is one way to make an outstanding
   item go away: capture it, or tell the app it does not apply. */
/* 12a rev3, widened by S3 Batch 2 (C4): only one of the dashboard's small
   cards open at a time — was scoped to just the 4 at-a-glance mini-cards;
   the brief asks for EVERY dashboard small card, "Your return" included.
   "Your return" (renderCompletenessCard()) is a custom div/onclick toggle,
   not a native <details>, so it needs its own hook into the same group
   rather than a shared selector. Mirrors the idiom in 03-income.js's
   initCarriedBalanceAccordion — attached once per element (idempotent,
   since renderDashboard runs on every keystroke). */
var DASH_ACCORDION_SEL = '#tax-reward-card, #dash-balance-acc, .dash-mini-grid details.mini-card';
function closeOtherDashDetails(except) {
  document.querySelectorAll(DASH_ACCORDION_SEL).forEach(function(o) {
    if (o !== except) o.removeAttribute('open');
  });
}
function initDashAccordionGroup() {
  document.querySelectorAll(DASH_ACCORDION_SEL).forEach(function(d) {
    if (d.dataset.accBound) return;
    d.dataset.accBound = '1';
    d.addEventListener('toggle', function() {
      if (!d.open) return;
      closeOtherDashDetails(d);
      if (APP._completenessOpen) { APP._completenessOpen = false; renderCompletenessCard(); }
    });
  });
}

/* QA 2026-08 (12a rev 3): only one step accordion open at a time. Same idiom
   as initDashMiniAccordion above and initCarriedBalanceAccordion
   (03-income.js) — bound once per element, since renderDashboard re-runs on
   every keystroke elsewhere in the app. */
function initStepAccordion() {
  document.querySelectorAll('#dash-completeness details.dchk-acc').forEach(function(d) {
    if (d.dataset.accBound) return;
    d.dataset.accBound = '1';
    d.addEventListener('toggle', function() {
      if (!d.open) return;
      document.querySelectorAll('#dash-completeness details.dchk-acc').forEach(function(o) {
        if (o !== d) o.removeAttribute('open');
      });
    });
  });
}

export function renderCompletenessCard() {
  const el = $('dash-completeness'); if (!el) return;
  const steps = dashChecklist();
  const done = steps.filter(function(i){ return i.done; }).length;
  /* D-29: no ring, no Kat on this card any more — both moved to the reward
     card (B6.2), which is why dashCompleteness() stays the single source
     both read (B6.7): this card's "x Steps to go" and the reward card's
     percentage can never disagree. */
  const comp = dashCompleteness();
  const outstanding = comp.subTotal;

  /* QA 2026-09: always collapsed by default — navigateTo() resets
     APP._completenessOpen to false on every arrival at the dashboard, so
     this only matters for a render that happens before any navigateTo call
     (e.g. straight out of onboarding); default to closed there too rather
     than the old "open on a brand-new return" heuristic. The user's own
     toggle (toggleCompleteness()) still wins for the rest of that visit. */
  const open = !!APP._completenessOpen;

  /* Phase 2 (G5): outstanding items render as SUB-STEPS nested under the
     step they belong to, not as a separate list below all the steps. An
     outstanding income item is how you finish "Add your income" — it is not
     a seventh thing to do. Nesting also makes the completion count's
     arithmetic legible: every row you can see is a unit it counts.

     Numbering stays flat and sequential down the visible column (1, 1a, 1b,
     2, …) so a sub-step reads as part of its parent rather than restarting
     an independent count. */
  /* D5 / E6: a step only animates its tick on the render where it FIRST
     becomes done. APP._doneSteps remembers which were already complete, so
     re-rendering the dashboard (which renderAll does constantly) cannot
     replay ticks for steps that finished minutes ago. Keyed by label rather
     than index because the step list length varies with provisional status. */
  const prevDone = APP._doneSteps || [];
  const nowDone = steps.filter(function(i){ return i.done; }).map(function(i){ return i.label; });
  const justDone = nowDone.filter(function(l){ return prevDone.indexOf(l) < 0; });
  const hadPrev = APP._doneSteps != null;   /* skip the first render after boot */
  APP._doneSteps = nowDone;

  /* E5 (short burst): a step completing while the user is on the page where
     they did the work gets acknowledged THERE. Deductions have no explicit
     save button, so waiting for a return to the dashboard would put the
     feedback minutes away from the action that earned it. The dashboard's
     own case is handled by maybeCelebrate below (long burst), so this only
     fires off-dashboard — never both for one event. */
  if (hadPrev && justDone.length && document.querySelector('.mode-panel.active')
      && (document.querySelector('.mode-panel.active') || {}).id !== 'mode-dashboard') {
    setTimeout(function(){ celebrateStep(); }, 60);
  }

  let pulseUsed = false;
  /* QA 2026-08 (B2-DASH-4): step and sub-step badges take their section's
     colour — income green, deductions purple, prior-year amber, provisional
     coral — so the numbering carries the same area cue the destination page
     does. One class per row rather than an inline style: main.css maps it to
     --area-accent, which is the property every other accent rule already
     reads (and Hard rule 9 prefers a class over a style attribute). */
  /* B2-10: completed steps sort to the BOTTOM of the visible list — this is
     a render-order change only. dashChecklist()'s own array (numbering,
     "done" logic, sub-step ordering) is untouched; we only reorder how the
     already-computed steps are laid out in the DOM, via a stable sort that
     keeps not-done steps in their original relative order, then done steps
     in theirs. */
  const orderedSteps = steps.map(function(i, n){ return { i: i, n: n }; })
    .sort(function(a, b){
      if (a.i.done === b.i.done) return a.n - b.n;
      return a.i.done ? 1 : -1;
    });
  /* QA 2026-08 (12a rev 3): a step with outstanding items is an ACCORDION —
     "collapse the items under each step", with only one open at a time.

     The step row keeps both jobs it had. Tapping the row now toggles the
     accordion; the trailing chevron becomes the navigate control and stops
     propagation, so the route to the page is not lost — it just moves from
     the whole row to the affordance that already looked like "go". A step
     with no sub-items has nothing to disclose, so it stays a plain
     navigating row exactly as before.

     All steps start CLOSED, which is what "collapse the items under each step"
     asks for and what the sibling rule for "Your return" already does. An
     earlier draft opened the first outstanding step so its items stayed
     visible; that was invented rather than asked for, and it did not survive
     the full render chain reliably. Nothing is hidden by closing them — the
     row itself still reads "N still to add", so the count is on screen and
     only the item list is a tap away. */
  const stepsHtml = orderedSteps.map(function(o){
    const i = o.i, n = o.n;
    const subs = i.subs || [];
    const areaCls = i.area ? ' dchk-area-' + i.area : '';
    const fresh = i.done && justDone.indexOf(i.label) >= 0;
    const rowInner = '<span class="dchk-ico">'
      + (i.done ? TICK_SVG : (msIconHtml(i.iconName) || iconHtml(i.iconName) || String(n + 1)))
      + '</span>'
      + '<span class="dchk-t"><b>' + esc(i.label) + '</b><span>'
      + esc(subs.length ? (subs.length + ' still to add') : i.sub) + '</span></span>';

    if (!subs.length) {
      return '<div class="dchk' + areaCls + (i.done ? ' done' : '') + (fresh ? ' just-done' : '') + '"'
        + ' onclick="' + i.nav + '" role="button" tabindex="0">'
        + rowInner
        + '<i class="material-symbols-outlined msi-chevron-right dchk-go"></i>'
        + '</div>';
    }

    let html = '<details class="dchk-acc">'
      + '<summary class="dchk' + areaCls + (fresh ? ' just-done' : '') + ' has-subs"'
      + ' aria-label="' + esc(i.label) + ' — show or hide its outstanding items">'
      + rowInner
      + '<i class="material-symbols-outlined msi-expand-more dchk-acc-chev" aria-hidden="true"></i>'
      + '<i class="material-symbols-outlined msi-chevron-right dchk-go" role="button" tabindex="0"'
      + ' aria-label="Open ' + esc(i.label) + '"'
      + ' onclick="event.stopPropagation();event.preventDefault();' + i.nav + '"></i>'
      + '</summary>';
    html += subs.map(function(o, si){
      const nav = o.route ? 'navigateToCapture(\'' + o.route + '\')' : '';
      /* B7 (§9.2): pulse-attention on the SINGLE highest-priority row —
         one only, or the card becomes a light show. It is the first
         outstanding sub-step anywhere in the list. */
      const pulse = !pulseUsed ? (pulseUsed = true, ' pulse-attention') : '';
      /* QA 2026-09: each sub-step shows the glyph for what it actually is
         (its income/deduction/carried-balance type) instead of a generic
         "not yet captured" circle for all of them; falls back to the circle
         only if a type has no glyph mapped. */
      return '<div class="dchk dchk-out dchk-sub' + areaCls + pulse + '"'
        + (nav ? ' onclick="' + nav + '" role="button" tabindex="0"' : '') + '>'
        + '<span class="dchk-ico">' + (msIconHtml(o.icon) || msIconHtml('radio_button_unchecked')) + '</span>'
        + '<span class="dchk-t"><b>' + esc(o.label) + '</b></span>'
        + (o.nav ? '<i class="material-symbols-outlined msi-chevron-right dchk-go"></i>' : '')
        + '</div>';
    }).join('');
    return html + '</details>';
  }).join('');

  const outHtml = '';
  const tip = 'This list comes from the questions you answered when you set up. '
            + "If something here doesn't apply to you, you can change your answers in Profile.";
  /* B6.6 (D-29): no ring, no Kat, and "in x categories" / "N of M done" are
     both gone — the head is just "Your return: x Steps to go" plus the
     per-area outstanding split, centred.
     S3 Batch 3 (C3): "Your return:", the headline and each area count are
     five SEPARATE elements now, not two strings joined with a space or
     " · " — at a larger accessibility text size (135% root font-size
     reproduces it at 360px; the default size doesn't), the old two-string
     layout wrapped mid-phrase ("Your return: 20 Steps to" / "go" on its
     own line; "9 Income · 5 Deductions · 6 Tax" / "balances" on its own).
     Each piece is its own block-level row instead, so a width squeeze
     drops to the next ROW, never mid-phrase. */
  const headline = outstanding > 0
    ? outstanding + ' Step' + (outstanding > 1 ? 's' : '') + ' to go'
    : 'Everything done';
  const areasHtml = outstanding > 0
    ? '<span class="dcomp-areas">'
      + '<span class="v-emerald">' + comp.byArea.income.outstanding + ' Income</span>'
      + '<span class="v-violet">' + comp.byArea.deductions.outstanding + ' Deductions</span>'
      + '<span class="v-amber">' + comp.byArea.balances.outstanding + ' Tax balances</span>'
      + '</span>'
    : '';

  maybeCelebrate(done, steps.length, outstanding);

  el.innerHTML = '<div class="dcomp' + (open ? ' open' : '') + '">'
    + '<div class="dcomp-head dcomp-head-centred" onclick="toggleCompleteness()" role="button" tabindex="0"'
    + ' aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="dash-completeness-body">'
      + '<div class="dcomp-t">'
        + '<b class="dcomp-heading">Your return:</b>'
        + '<span class="dcomp-headline">' + esc(headline) + '</span>'
        + areasHtml
      + '</div>'
      + '<span class="info-btn" data-tip-long data-tip="' + esc(tip) + '" aria-label="About this list"'
      + ' onclick="event.stopPropagation()"><i class="material-symbols-outlined msi-info"></i></span>'
      + '<i class="material-symbols-outlined msi-expand-more dcomp-chev"></i>'
    + '</div>'
    + '<div class="dcomp-body" id="dash-completeness-body">' + stepsHtml + outHtml + '</div>'
    + '</div>';

  initStepAccordion();
}

/* ── B7 / QR2.5: count-up (01-SPEC.md §9.2, QD-20) ──
   countUp()/animateHeroFigures() moved to 02-core.js — navigateTo() there
   calls animateHeroFigures() on every panel show, and 02-core.js cannot
   import from this file (this file already imports navigateTo FROM
   02-core.js; the reverse would be circular). Callers needing them import
   from 02-core.js directly. */

/* ── B7: celebrate (01-SPEC.md §9.2) ──
   Owner decision: NOT on refund / owing / balanced. Confetti fired at
   someone the app has just told they owe SARS money reads badly, and a
   refund is not the app's achievement to celebrate. It fires when every
   step is complete, and once only — `_celebrated` latches for the session
   so re-rendering the dashboard, or dipping below 100% and back, cannot
   re-fire it.

   24 pieces, 1.2s, transform/opacity only, and every node removes itself on
   animationend so nothing accumulates. Skipped entirely under reduced
   motion: the CSS would collapse the animation to 0.01ms and animationend
   would fire immediately, which is correct but pointless work. */
/* Celebration particles read from the live category palette, so they
   change with the theme instead of pinning the retired one. */
export const CONFETTI_COLOURS = ['var(--emerald)', 'var(--cyan)', 'var(--amber)', 'var(--violet)', 'var(--mint)', 'var(--blue)'];

/* D4 / E5 — TWO burst sizes, because the two moments are not the same size.

   `short`  finishing ONE step, fired on the page where the work happened.
            12 pieces, tight spread, 0.8s. Enough to register as "that
            landed" without stopping someone mid-flow through a form.
   `long`   finishing EVERYTHING, fired on the dashboard. 30 pieces, wide
            spread, the full 1.2s.

   Both are transform/opacity only, every node removes itself on
   animationend, and both skip entirely under reduced motion. */
const BURSTS = {
  short: { n: 12, spreadX: 130, riseMin: 46, riseVar: 60, dur: 800,  jitter: 60 },
  long:  { n: 30, spreadX: 240, riseMin: 70, riseVar: 100, dur: 1200, jitter: 90 },
};

export function celebrate(host, size) {
  const el = host || $('dash-completeness');
  if (!el) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cfg = BURSTS[size] || BURSTS.long;
  const box = el.querySelector('.dcomp') || el;
  /* The pieces are absolutely positioned against this box, so it has to be a
     containing block. Restored afterwards so a burst never leaves layout
     state behind on an element it does not own. */
  const hadPos = box.style.position;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  box.classList.add('celebrating');
  for (let i = 0; i < cfg.n; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.background = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
    c.style.left = (46 + (Math.random() * 8 - 4)) + '%';
    c.style.top = '40%';
    c.style.animationDuration = cfg.dur + 'ms';
    c.style.setProperty('--dx', (Math.random() * cfg.spreadX - cfg.spreadX / 2).toFixed(0) + 'px');
    c.style.setProperty('--dy', (-cfg.riseMin - Math.random() * cfg.riseVar).toFixed(0) + 'px');
    c.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    c.style.animationDelay = (Math.random() * cfg.jitter).toFixed(0) + 'ms';
    c.addEventListener('animationend', function() { this.remove(); });
    box.appendChild(c);
  }
  setTimeout(function() {
    box.classList.remove('celebrating');
    box.style.position = hadPos;
  }, cfg.dur + 240);
}

/* E5 — the short burst, fired where the user just did the work.

   Anchors to the active page's hero card when there is one (the figure that
   just changed is the thing being acknowledged), else the active panel. Call
   sites: saving an income record, and a step flipping to done while the user
   is on a capture page rather than the dashboard.

   Rate-limited to one burst per 1.2s. Saving several records in a row should
   not stack bursts on top of each other. */
let _lastShortBurst = 0;
export function celebrateStep(host) {
  const now = Date.now();
  if (now - _lastShortBurst < 1200) return;
  _lastShortBurst = now;
  const el = host
    || document.querySelector('.mode-panel.active .tab-section.active .dhero')
    || document.querySelector('.mode-panel.active .dhero')
    || document.querySelector('.mode-panel.active .tab-section.active')
    || document.querySelector('.mode-panel.active');
  if (el) celebrate(el, 'short');
}

/* Phase 11 §4 Section 3 — the Tax Return reward card's celebration.

   Not a reuse of celebrate(): that function's spawn point (fixed at
   left:46%/top:40% of its box) is tuned for the dashboard completeness
   ring, a different shape. Ported from the approved prototype
   (_mockups/11d-reward-section.html), which found and fixed a real defect
   during its own verification — the first version's confetti crossed the
   kicker line and the centred copy above the mascot. Anchored to the
   mascot instead (the element it celebrates), thrown into the gutters
   either side of it, and each chip's fall is clamped so it cannot reach
   the figure below regardless of viewport width. `host` is the `.reward`
   card; the mascot and figure are found inside it. */
export function celebrateReward(host) {
  if (!host) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const mascot = host.querySelector('.reward-mascot');
  const fig = host.querySelector('.reward-fig');
  if (!mascot || !fig) return;
  host.querySelectorAll('.confetti').forEach(function(c) { c.remove(); });
  const hadPos = host.style.position;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.classList.add('celebrating');
  const hostR = host.getBoundingClientRect();
  const mR = mascot.getBoundingClientRect();
  const figTop = fig.getBoundingClientRect().top - hostR.top;
  const topPx = Math.max(4, (mR.top - hostR.top) + mR.height * 0.18);
  const CHIP_H = 11, CHIP_W = 7, GAP = 4, MARGIN_X = 3;
  /* Horizontal placement is computed in the host's own pixel width, not
     percentages + a fixed-px translate — that combination could carry a
     chip's REST position past the card's right edge on a narrow viewport
     (found at 360px: spawn near 98% plus up to +44px landed off-card).
     Every chip's final resting X is clamped to the host's own bounds, so
     it can never overflow regardless of card width. */
  for (let i = 0; i < 22; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    const left = i % 2 === 0;
    const spawnTop = topPx + Math.random() * mR.height * 0.5;
    const maxDy = Math.max(0, figTop - spawnTop - CHIP_H - GAP);
    const spawnX = left
      ? MARGIN_X + Math.random() * hostR.width * 0.10
      : hostR.width - MARGIN_X - CHIP_W - Math.random() * hostR.width * 0.10;
    const rawDx = (left ? -1 : 1) * (10 + Math.random() * 34);
    const restX = Math.max(MARGIN_X, Math.min(hostR.width - CHIP_W - MARGIN_X, spawnX + rawDx));
    c.style.left = spawnX.toFixed(1) + 'px';
    c.style.top = spawnTop.toFixed(0) + 'px';
    c.style.background = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
    c.style.setProperty('--dx', (restX - spawnX).toFixed(0) + 'px');
    c.style.setProperty('--dy', (Math.min(maxDy, -14 + Math.random() * 96)).toFixed(0) + 'px');
    c.style.setProperty('--rot', (Math.random() * 620 - 310).toFixed(0) + 'deg');
    c.style.animationDelay = (Math.random() * 0.32).toFixed(2) + 's';
    c.addEventListener('animationend', function() { this.remove(); });
    host.appendChild(c);
  }
  setTimeout(function() { host.classList.remove('celebrating'); host.style.position = hadPos; }, 2100 + 320);
}

/* Called from renderCompletenessCard once it knows the counts.

   "Every step complete" now INCLUDES the outstanding items, because B7 made
   each of those a step in its own right. Firing on the five named steps
   alone put confetti on screen while the card still read "2 things to add",
   which is the app congratulating someone for work they have not finished. */
/* The drawn check used by a completed step (see .tick-draw in main.css). */
const TICK_SVG = '<svg class="tick-draw" viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="m5 12.5 4.6 4.6L19 7.6"/></svg>';

function maybeCelebrate(done, total, outstanding) {
  if (done < total || outstanding > 0 || APP._celebrated) return;
  APP._celebrated = true;
  /* After paint, so the ring has something to sweep to and the confetti
     is not competing with the card's own re-render. */
  setTimeout(function() { celebrate(null, 'long'); }, 260);
}

/* Open/closed is UI state for the session, not saved data — a card the user
   opened yesterday should not decide how their dashboard looks today. */
export function toggleCompleteness() {
  APP._completenessOpen = !APP._completenessOpen;
  /* S3 Batch 2 (C4): opening "Your return" closes every other dashboard
     small card, the same as opening one of THEM closes this one
     (initDashAccordionGroup above) — one group, one open card. */
  if (APP._completenessOpen) closeOtherDashDetails(null);
  renderCompletenessCard();
}

/* ── RESIDENCY GATE ──────────────────────────────────────────────────────
   C-1a → QA 2026-08 → owner decision (B1-17 revisited).

   History matters here, because this is the second reversal. It began as a
   full-screen gate. An earlier QA round read "just give a short note" as
   "warn and carry on", so it became a banner and the app calculated for
   non-residents anyway. That was flagged at the time as the one change
   trading against tax correctness, and the owner has now settled it: a
   non-resident is not subject to normal SARS requirements, so the app's
   calculation does not apply to them, and the app must not be usable while
   that answer stands.

   Two things make this a gate rather than a refusal:
     - it names the single answer that unblocks it, and
     - it opens Profile directly, so nobody is locked in a dead end.

   Legacy stored answers ('part_year', 'unsure') gate too. Neither option is
   offered any more, but a return captured before they were removed can still
   hold one, and silently reading either as "resident all year" would change
   someone's tax without telling them. */
export function renderResidencyGate() {
  const el = $('residency-gate');
  if (!el) return false;
  const residency = normaliseResidency(APP.taxResidency);

  if (residency === 'full_year') {
    if (!el.hidden) { el.hidden = true; el.innerHTML = ''; }
    return false;
  }

  const what = residency === 'non_resident'
    ? 'Your setup says you were <strong>not a South African tax resident</strong> this year.'
    : residency === 'part_year'
      ? 'Your setup says you were a South African tax resident for <strong>only part</strong> of this year.'
      : 'Your setup says you were <strong>not sure</strong> whether you were a South African tax resident this year.';

  /* Re-rendered on every renderAll; only rewrite when the state actually
     changed, so an open Profile modal over the gate does not fight a DOM
     replacement underneath it on every keystroke. */
  if (el.dataset.rgFor === residency && !el.hidden) return true;
  el.dataset.rgFor = residency;

  el.innerHTML = '<div class="rg-card">'
    + '<div class="rg-icon ico-bg-amber ico-sz-48"><i class="material-symbols-outlined msi-warning" aria-hidden="true"></i></div>'
    + '<h2 id="residency-gate-title">InspiredTax does not apply to you</h2>'
    + '<p>' + what + '</p>'
    + '<p>Non-residents are not subject to the normal SARS requirements this app '
    + 'is built around, so its tax calculation would not be applicable to you. '
    + 'It is not a matter of the figures being approximate — they would be '
    + 'worked out under rules that do not govern your return.</p>'
    + '<p>If you would like to calculate your tax <em>as if</em> you were a tax '
    + 'resident, update your answer to the residency question in your profile.</p>'
    + '<button type="button" class="rg-cta" onclick="openModal(\'modal-profile\')">'
    + 'Open Profile</button>'
    + '<div class="rg-note">Profile \u2192 South African tax residency</div>'
    + '</div>';
  el.hidden = false;
  return true;
}

/* QR7.5 (QD-24): an existing user never sees onboarding's new scenario
   questions, so nothing is hidden for them (unanswered = show) and this card
   asks once whether they want to answer them. Either button retires it for
   good (scenarioReviewDone, 02-core); the questions live in Profile after. */
export function renderScenarioReviewCard() {
  const host = $('dash-scenario-review'); if (!host) return;
  if (!scenarioReviewApplies()) { host.innerHTML = ''; return; }
  if (host.childElementCount) return;   // renderDashboard runs on every renderAll — don't rebuild (and re-announce) an unchanged card
  host.innerHTML = '<div class="note info" style="margin:0 0 16px"><strong>We\u2019ve added a few questions.</strong> '
    + 'They let us leave out fields you don\u2019t need. Nothing has changed for you yet \u2014 every field is still shown.'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    + '<button type="button" class="btn btn-primary btn-sm" onclick="scenarioReviewDone(true)">Review them</button>'
    + '<button type="button" class="btn btn-ghost btn-sm" onclick="scenarioReviewDone(false)">Not now</button></div></div>';
}

export function renderDashboard() {
  /* The gate is app-wide and lives in the renderAll chain (07-render-summary),
     not here — every screen is covered, not just this one. */
  renderScenarioReviewCard();
  renderCloudBackupOffer();   // QD-07 — draws nothing while the kill-switch is off

  const r = calcFullTax();
  const el = $('dash-stats');
  if(!el) return;

  // Greeting based on time
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // BACKLOG 71: the name is sealed PII — read from the unlocked copy.
  const fullName = getUserFullName();
  const firstName = fullName ? fullName.split(' ')[0] : '';
  const gEl = $('dashboard-greeting');
  if(gEl) gEl.textContent = greet + (firstName ? ', ' + firstName : '');

  // V8.6 F2.3 + F4: Fixed-order navigable cards (only show when user-touched or computed from upstream data)
  const av = APP.appliedValues || {};
  /* v8.22 r4: dashboard MUST mirror the tax engine, not raw appliedValues.
     Old line summed av.donations RAW (ignoring the s18A 10%-of-taxable-income cap → showed 10k where allowed was 0)
     and wrongly included av.interest (taxable INCOME, not a deduction).
     r.* below are the exact amounts calcFullTax deducts — identical to the Return page cards. */

  /* B6.1/B6.4 (D-9, D-28): the reward card and balance card are now their
     own top-of-page mounts (#tax-reward, #dash-balance) — the one-line
     .dhero strip that used to open this grid is gone, replaced by
     renderDashBalance()'s expandable card, which reads taxHeroState() so
     the two can never disagree about when to hide it. */
  renderReward(r);
  renderDashBalance(r);
  var html = '';
  /* B4 (§3.1, item 44): the entitlement chip moves to the FOOT of the
     dashboard, into its own slot — subscription status is not what a user
     opens their tax app to find out. Rendered at the end of this function. */
  {
    /* E4 (2026-07-29 follow-up, 01-SPEC.md P11): Gross Income and Deductions
       had swapped colours vs. the spec's area-accent scheme (Income=green,
       Deductions=blue, Tax=purple) — fixed here. */
    /* Phase 2 (H2): "Tax Payable" and "PAYE Paid" cards removed — both
       figures are one tap away in the balance card's own composition bar
       (renderDashBalance(), B6.4) once it is expanded, so these cards would
       repeat what that card already shows. What is kept here is precisely
       what the balance card does NOT say. */
    /* S2 Batch 5 (rebuild per Allan's spec, 2026-09-19): four cards, two per
       row — Gross taxable income, Deductions (row 1), Taxable income, Tax
       payable (row 2). "Tax payable" REPLACES the old "Tax saved" card —
       not a rename, a different figure (tax on TI minus credits, not a
       reduction total) — see TEST-9. "Effective Rate" stays removed per
       owner instruction. Each card is a collapsible <details class="mini-card">
       (mini-grid/mini-card/mini-body/mini-row idiom, renderIncomeMiniCards,
       03-income.js). */
    /* UI-CARD-1: the four cards are built by glanceCardSpecs()
       (07-render-summary.js), shared with the Tax screen's Return tab. */
    var small = glanceCardSpecs(r, { gti: 'var(--cyan)', taxable: 'var(--cyan)', tax: 'var(--emerald)' });
    if (small.length) {
      html += '<div class="mini-grid dash-mini-grid">' + small.map(function(s){
        /* HERO-2: the ring sits on the figure's line (miniCardHtml). The
           Dashboard keeps the gross card's donut and no other chart. */
        return miniCardHtml(s, { chart: s.key === 'mini-gti' });
      }).join('') + '</div>';
    }
    // next-deadline banner (below the metric grid)
    var _dl = dashNextDeadline();
    if (_dl) {
      /* QA 2026-08: this card ALWAYS navigated to the provisional page, whichever
         deadline it was showing. A pure PAYE profile — which never has a
         provisional deadline — got a "Tax return due" banner that dropped the
         user on Provisional Tax. Send each deadline to the page it belongs to. */
      var _dlNav = /^Provisional/.test(_dl.label)
        ? "navigateTo('summary','provtax')"
        : "navigateTo('summary','return')";
      html += '<div class="ddl u-cursor-pointer" onclick="' + _dlNav + '">'
            + '<i class="material-symbols-outlined msi-schedule" style="color:var(--cyan);font-size:var(--fs-2xl)"></i>'
            + '<div style="flex:1"><div style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)">' + _dl.label
            + (_dl.daysLeft < 0 ? ' \u2014 overdue' : ' in ' + _dl.daysLeft + ' days') + '</div>'
            + '<div style="font-size:var(--fs-xs);color:var(--tx3)">' + _dl.dateStr + '</div></div>'
            + '<i class="material-symbols-outlined msi-chevron-right" style="color:var(--tx3);font-size:var(--fs-sm)"></i></div>';
    }
  }
  el.innerHTML = html;

  // v8.23 UX-standardisation: Effective Rate now lives in the stat-card grid
  // above (one source of truth). The duplicate standalone "Effective Tax Rate"
  // big-number block here was redundant and used inline styles — removed.
  const badge = $('dash-position-badge');
  if(badge) badge.innerHTML = '';

  // V8.6 F1: Removed duplicate "Tax Position at a Glance" block (replicates cards above + payment block kept for provisional users)
  const posEl = $('dash-position-glance');
  if(posEl) {
    const isProv = gs('p_provisional') === 'yes';
    const p1 = gv('p_prov_p1'), p2 = gv('p_prov_p2'), p3 = gv('p_prov_topup');
    const provTotal = p1 + p2 + p3;
    if (isProv && provTotal > 0) {
      posEl.innerHTML = `
        <div class="card" style="margin-bottom:14px">
          <div class="card-title"><i class="material-symbols-outlined msi-receipt-long"></i> Provisional Tax Paid</div>
          <div class="sum-line" style="font-size:0.78125rem"><span class="lbl">P1 (first provisional)</span><span class="val">${fmt(p1)}</span></div>
          <div class="sum-line" style="font-size:0.78125rem"><span class="lbl">P2 (second provisional)</span><span class="val">${fmt(p2)}</span></div>
          <div class="sum-line" style="font-size:0.78125rem"><span class="lbl">P3 (top-up)</span><span class="val">${fmt(p3)}</span></div>
          <div class="sum-line divider" style="font-size:0.8125rem"><span class="lbl"><strong>Total Provisional Paid</strong></span><span class="val"><strong>${fmt(provTotal)}</strong></span></div>
        </div>`;
    } else {
      posEl.innerHTML = '';
    }
  }

  // V8.4 I.3: Counter labels clarified; FB1: include net-calc bucket arrays (#35)
  const ic = $('dash-income-count');
  if(ic) {
    var _icCount = (APP.incomeItems||[]).length
      + (APP.rentalProperties||[]).length
      + (APP.cgtAssets||[]).length
      + (APP.businessItems||[]).length
      + (APP.it3bItems||[]).length
      + (APP.cryptoDisposals||[]).length + (APP.cryptoRevenue||[]).length
      + (APP.otherReceipts||[]).length
      + (APP.twopotWithdrawals||[]).length;
    ic.textContent = _icCount;
  }
  const dc = $('dash-ded-count');
  if(dc) dc.textContent = Object.values(APP.dedChecks||{}).filter(Boolean).length;

  renderTaxMilestones();

  // Recent history
  const histEl = $('dash-recent-history');
  if(histEl) {
    if(APP.history && APP.history.length > 0) {
      const latest = APP.history[0];
      const isRef = latest.balance < 0;
      histEl.innerHTML = `
        <div class="card u-cursor-pointer" onclick="navigateTo('summary','history')">
          <div class="card-title"><i class="material-symbols-outlined msi-history"></i> Latest Saved Record</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;color:#fff">${latest.label}</div>
              <div style="font-size:0.75rem;color:var(--tx3)">${new Date(latest.saved).toLocaleDateString('en-ZA')}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:var(--mono);font-weight:700;color:${isRef?'var(--ok)':'var(--er)'}">${isRef?'Refund ':'Owing '}${fmt(Math.abs(latest.balance))}</div>
              <span class="pill ${latest.status==='assessed'?'ok':latest.status==='submitted'?'teal':'warning'}">${latest.status}</span>
            </div>
          </div>
        </div>`;
    } else {
      histEl.innerHTML = '';
    }
  }

  renderDashboardGlanceBottom();
  /* B4: the completeness card replaces the old outstanding-items section. */
  renderCompletenessCard();
  /* S3 Batch 2 (C4): bound after every dashboard small card (reward,
     balance, "Your return", mini-grid) has rendered for this pass, so
     the group selector above always finds all of them. */
  initDashAccordionGroup();
  /* B4 (item 44): subscription status renders LAST, into the foot slot. */
  const entEl = $('dash-ent-chip');
  if (entEl) { try { entEl.innerHTML = entChipHtml(); } catch(e) { console.warn('ent chip:', e); } }
}

// V8.4 I.4 helper: last day of Feb (handles leap years)
export function lastDayOfFeb(year) { return new Date(year, 2, 0).getDate(); }

/* The tax year currently in its ITR12 filing season, independent of
   whichever tax year the user has active for data entry/planning — you
   can't file a return for a year that hasn't ended yet. SARS tax year N
   runs 1 Mar (N-1) - 28/29 Feb N, so N is "just closed" (and in filing
   season) from 1 Mar of calendar year N through end of Feb the following
   year. Found during device QA: the Dashboard's "Return due" countdown
   was anchored to the in-progress active tax year instead of this,
   showing a return-due date over a year away. */
export function getFilingSeasonTaxYear(today) {
  const d = today || new Date();
  return d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1;
}

export function renderTaxMilestones() {
  const cyrEl = $('dash-cyr-progress');
  if (!cyrEl) return;
  const ty = getActiveTaxYear();
  const yr = parseInt(gs('taxYear') || '2027');
  const _my = String(gs('taxYear') || '2027');
  const m1 = (APP.milestones && typeof APP.milestones[_my] === 'object' && APP.milestones[_my]) || {};
  const milestones = [
    { key:'p1', label:'P1 — First Provisional', date:new Date(yr-1, 7, 31), provOnly:true,
      amtField:'p_prov_p1', amtBacked:gv('p_prov_p1') > 0, manualDone:!!m1.p1 },
    { key:'p2', label:'P2 — Second Provisional', date:new Date(yr, 1, lastDayOfFeb(yr)), provOnly:true,
      amtField:'p_prov_p2', amtBacked:gv('p_prov_p2') > 0, manualDone:!!m1.p2 },
    { key:'return_np', label:'Tax Return (Non-Provisional)', date:new Date(yr, 9, 20), provOnly:false,
      amtBacked:(APP.history||[]).some(h => (h.status==='submitted'||h.status==='assessed') && h.year===yr), manualDone:!!m1.return_np },
    { key:'p3', label:'P3 — Top-up Payment', date:new Date(yr, 8, 30), provOnly:true,
      amtField:'p_prov_topup', amtBacked:gv('p_prov_topup') > 0, manualDone:!!m1.p3 },
    { key:'return_p', label:'Tax Return (Provisional)', date:new Date(yr+1, 0, 19), provOnly:true,
      amtBacked:(APP.history||[]).some(h => (h.status==='submitted'||h.status==='assessed') && h.year===yr), manualDone:!!m1.return_p },
    { key:'final', label:'Final Tax Payment (per ITA34)', date:null, provOnly:false,
      amtBacked:false, manualDone:!!m1.final, note:'30 days from assessment date' }
  ];
  const isProv = gs('p_provisional') === 'yes';
  const visible = milestones.filter(m => !m.provOnly || isProv);
  const today = new Date();
  const SEVEN_DAYS = 7*86400000;
  if (typeof updateCurrentYear === 'function' && !APP.provForecast) updateCurrentYear();
  const _recs = (typeof provRecommendations === 'function') ? provRecommendations() : { hasForecast:false };
  const _recAmt = { p1:_recs.p1, p2:_recs.p2, p3:_recs.p3 };
  cyrEl.innerHTML = `
    <div style="font-size:0.75rem;color:var(--tx2);margin-bottom:8px">Key SARS deadlines for ${ty.label}.</div>
    ${visible.map(m => {
      let stateClass='', stateLabel='', stateIcon='', extraNote='';
      const done = m.amtBacked || m.manualDone;
      if(m.amtBacked) {
        stateClass='ok'; stateLabel='Done'; stateIcon='check_circle';
      } else if(m.manualDone) {
        stateClass='teal'; stateLabel='Marked done'; stateIcon='check_circle';
        extraNote = '<div style="font-size:0.65625rem;color:var(--er);margin-top:2px"><i class="material-symbols-outlined msi-info"></i> Marked done without captured amount — record amount for accurate tax position.</div>';
      } else if(m.date && today > m.date) {
        stateClass='er'; stateLabel='Overdue'; stateIcon='error';
      } else if(m.date && (m.date - today) < SEVEN_DAYS && (m.date - today) > 0) {
        stateClass='wa'; stateLabel='Due soon'; stateIcon='schedule';
      } else {
        stateClass='tx3'; stateLabel='Pending'; stateIcon='calendar_month';
      }
      const dateStr = m.date ? m.date.toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}) : (m.note||'');
      const recLine = (m.provOnly && _recs.hasForecast && !done && _recAmt[m.key] > 0)
        ? `<div style="font-size:0.6875rem;color:var(--accent2);font-weight:600">Recommended: ${fmt(_recAmt[m.key])}</div>` : '';
      /* UI-FS-1: the row wraps — at large Android text sizes the pill and
         "Mark done" drop under the label instead of pushing the page wide. */
      return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:0.8125rem">
        <i class="${iconClassFor(stateIcon)}" style="color:var(--${stateClass});width:18px"></i>
        <div style="flex:1 1 7em;min-width:0">
          <div style="color:var(--tx);font-weight:500">${m.label}</div>
          <div style="font-size:0.6875rem;color:var(--tx3)">${dateStr}</div>
          ${recLine}
          ${extraNote}
        </div>
        <span class="pill ${stateClass==='ok'?'ok':stateClass==='er'?'owing':stateClass==='wa'?'warning':stateClass==='teal'?'teal':'teal'}" style="font-size:0.65625rem">${stateLabel}</span>
        ${!done && m.key !== 'final' ? `<button class="btn btn-ghost btn-sm btn-wrap" style="padding:2px 8px;font-size:0.6875rem" onclick="event.stopPropagation();markMilestoneDone('${m.key}')">Mark done</button>` : ''}
      </div>`;
    }).join('')}`;
}

// V8.4 I.4 helper: manual milestone "done" toggle
export function markMilestoneDone(key) {
  var _my = String((typeof gs === 'function' ? gs('taxYear') : '') || '2027');
  APP.milestones = APP.milestones || {};
  if (typeof APP.milestones[_my] !== 'object' || APP.milestones[_my] === null) APP.milestones[_my] = {};
  APP.milestones[_my][key] = true;
  debounceSave();
  renderTaxMilestones();
  showToast('Milestone marked as done', 'check_circle');
}

/* ── DASHBOARD GLANCE-BOTTOM: at-a-glance strip with 3 metrics ── */
export function renderDashboardGlanceBottom() {
  const el = $('dashboard-glance-bottom');
  if (!el) return;

  function _enc(str) { return str.replace(/"/g, '&quot;'); }
  function _iBtn(tip) {
    return '<span class="info-btn" data-tip="' + _enc(tip) + '" tabindex="0" role="button" aria-label="Details"><i class="material-symbols-outlined msi-info"></i></span>';
  }

  const r = calcFullTax();
  const isProv = gs('p_provisional') === 'yes';
  const ty = getActiveTaxYear();

  /* Phase 2 (H2): the "Return Completeness" chip that used to lead this row
     is removed. It was the THIRD completeness figure on one screen, and the
     only one computed from its own private field list — a list that had gone
     stale: p_fname, p_lname, p_idnr and p_resi_code no longer exist in the
     shell (the ID number and its siblings were deleted app-wide), and
     income_total_emp / p_paye_total are not input ids either. Six of its
     eight "expected fields" could therefore never be filled, so the chip
     reported a permanently depressed percentage that contradicted the
     completeness ring at the top of the same page. The ring
     (dashCompleteness, driven by dashChecklist) is the single source. */
  let chip1 = '';

  // Chip 2: Provisional Tax Summary (if applicable)
  let chip2 = '';
  if (isProv) {
    const p1 = gv('p_prov_p1') || 0;
    const p2 = gv('p_prov_p2') || 0;
    const p3 = gv('p_prov_topup') || 0;
    const provTotal = p1 + p2 + p3;

    const estAnnual = (typeof provRecommendations === 'function') ? (provRecommendations().estAnnual || 0) : 0;
    const status = provTotal >= estAnnual ? 'Paid' : 'Under';
    const statusColor = provTotal >= estAnnual ? 'var(--ok)' : 'var(--wa)';
    const diff = Math.abs(provTotal - estAnnual);

    const provTip = '<strong>Provisional Tax Summary</strong><br>'
      + 'P1: ' + fmt(p1) + '<br>'
      + 'P2: ' + fmt(p2) + '<br>'
      + 'P3: ' + fmt(p3) + '<br>'
      + '<strong>Total Paid: ' + fmt(provTotal) + '</strong><br>'
      + 'Estimated Annual: ' + fmt(estAnnual) + '<br>'
      + (provTotal >= estAnnual ? '<strong style="color:var(--ok)">Over by ' + fmt(diff) + '</strong>' : '<strong style="color:var(--wa)">Short by ' + fmt(diff) + '</strong>');

    chip2 = '<div class="gc" onclick="navigateTo(\'income\',\'provisional\')">'
      + '<div class="gc-val" style="color:' + statusColor + '">' + fmt(provTotal) + '</div>'
      + '<div class="gc-lbl">' + lblWithInfo('Provisional Tax ' + status, _iBtn(provTip)) + '</div>'
      + '</div>';
  }

  /* Phase 2 (H2): the "next deadline" chip that used to sit here is removed.
     The deadline banner rendered by renderDashboard() (dashNextDeadline)
     shows the same next date on the same screen, with more of it — label,
     day count AND the full date — so this chip was the lesser duplicate of
     the two. Both were also computing the date independently, which is how
     they came to disagree (see the H3 fix in dashNextDeadline).

     FILING_DEADLINES / getFilingSeasonTaxYear are now used by
     dashNextDeadline itself, which is where that logic belongs. */
  el.innerHTML = chip1 + chip2;
}

/* ── ACCORDION CONVERTER ── */
/* Converts .card elements with .card-title into collapsible accordions
   Called once after renderAll to transform the visual layout */
export function convertCardsToAccordions() {
  document.querySelectorAll('.mode-panel .card').forEach(card => {
    // Skip cards that are inside the dashboard, modals, or already converted
    if(card.closest('#mode-dashboard') || card.closest('.modal-overlay') || card.dataset.accConverted) return;
    
    const title = card.querySelector('.card-title');
    if(!title) return; // Only convert cards that have a title
    
    // Mark as converted
    card.dataset.accConverted = '1';
    
    // Extract icon and text from title
    const icon = title.querySelector('i');
    const iconClass = icon ? icon.className : 'material-symbols-outlined msi-circle';
    const titleText = title.textContent.trim();
    
    // Create accordion wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'section-accordion';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'section-acc-header open'; // Start open
    header.innerHTML = `
      <div class="ico-bg-blue ico-sz-36"><i class="${iconClass}"></i></div>
      <div class="section-acc-text">
        <div class="section-acc-title">${titleText}</div>
      </div>
      <i class="material-symbols-outlined msi-expand-more section-acc-chevron"></i>`;
    header.onclick = function() {
      this.classList.toggle('open');
      const body = this.nextElementSibling;
      if(body) body.classList.toggle('open');
    };
    
    // Create body (move card content into it)
    const body = document.createElement('div');
    body.className = 'section-acc-body open'; // Start open
    
    // Remove the title from the card
    title.remove();
    
    // Remove card styling, move content
    card.style.background = 'none';
    card.style.padding = '0';
    card.style.border = 'none';
    card.style.margin = '0';
    card.style.borderRadius = '0';
    
    // Insert accordion
    card.parentNode.insertBefore(wrapper, card);
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    body.appendChild(card);
  });
}

/* ── FAB (Floating Action Button) ── */
export function updateFAB(mode, tab) {
  let fab = $('fab-main');
  if(!fab) {
    fab = document.createElement('button');
    fab.id = 'fab-main';
    fab.className = 'fab';
    document.body.appendChild(fab);
  }

  // V8.4 IX: Hide FAB on login screen (app not visible) or when profile modal is open
  const loginScreen = $('login-screen');
  const loginVisible = loginScreen && loginScreen.style.display !== 'none';
  const profileModal = $('modal-profile');
  const profileOpen = profileModal && profileModal.classList.contains('active');
  if(loginVisible || profileOpen) {
    fab.classList.remove('visible');
    return;
  }

  // Contextual FAB based on current screen
  const config = getFABConfig(mode, tab);
  if(config) {
    fab.innerHTML = `<i class="${iconClassFor(config.icon)}"></i>`;
    fab.className = 'fab visible' + (config.green ? ' green' : '');
    fab.onclick = config.action;
    fab.title = config.label;
  } else {
    fab.classList.remove('visible');
  }
}

export function getFABConfig(mode, tab) {
  const configs = {
    'dashboard':           null, // No FAB on dashboard — has its own action buttons
    'income-main':         null, // Add IRP5 action is inline in Accordion 1
    /* D7: income sub-page add FABs */
    'income-b2investment': null,
    'income-b3rental':     { icon: 'add', label: 'Add rental',   action: () => window.addRentalProperty?.(), green: false },
    'income-b4business':   { icon: 'add', label: 'Add Business', action: () => window.addBusinessItem?.(),  green: false },
    'income-b5cgt':        { icon: 'add', label: 'Add disposal', action: () => window.addCgtAsset?.(),      green: false },
    'income-b6foreign':    null,
    'income-b7retirement': null,
    'income-b9other':      null,
    'income-b10crypto':    { icon: 'add', label: 'Add Crypto',   action: () => window.addCryptoDisposal?.(), green: false },
    /* Batch A (UX #7): deduction calculators save-as-you-go — no Apply FAB. */
    'ded-selections':      null,
    'ded-retirement':      null,
    'ded-medical':         null,
    'ded-travel':          null,
    'ded-homeoffice':      null,
    'ded-interest':        null,
    'ded-tools':           null,
    'ded-cgt':             null,
    'ded-rental':          null,
    /* D7: donations FAB focuses the first donation field */
    'ded-donations':       { icon: 'add', label: 'Add donation', action: () => $('don-name')?.focus(), green: false },
    'ded-subscrip':        null,
    'ded-subsistence':     null,
    'summary-return':      null,
    'summary-risk':        null,
    'proj-scenario':       null,
    'proj-multiyear':      null,
    'proj-optimise':       null,
    'summary-calculator': null,
    'summary-comparison': null,
    'actref':              null,
  };

  // Build the key
  const prefix = MODE_PREFIX_MAP[mode] || mode;
  const key = tab ? prefix + '-' + tab : mode;
  /* Monetization M2: on a locked screen the FAB becomes the upsell action
     instead of an add-record shortcut into a gated module. */
  const entKey = entFeatureForScreen(key);
  if (entKey && !entUnlocked(entKey)) {
    return { icon: 'lock', label: 'Go Premium', action: () => entOnLockedTap(entKey), green: false };
  }
  return configs[key] !== undefined ? configs[key] : null;
}
export function initTheme() {
  // v8.27: wholesale switch to the dark direction. Because setTheme() persists the
  // theme on every load, every existing install already has the old 'light' default
  // saved — so a changed default alone wouldn't flip anyone. This one-time migration
  // forces dark once; afterwards an explicit toggle choice is respected as before.
  const MIGRATION_KEY = 'inspiredtax_dark_default_v27';
  if (!localStorage.getItem(MIGRATION_KEY)) {
    localStorage.setItem('inspiredtax_theme', 'dark');
    localStorage.setItem(MIGRATION_KEY, '1');
  }
  const saved = localStorage.getItem('inspiredtax_theme') || 'dark';
  setTheme(saved);
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('inspiredtax_theme', theme);
  
  // Update drawer toggle if it exists
  const toggle = $('theme-toggle-label');
  if(toggle) toggle.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}


