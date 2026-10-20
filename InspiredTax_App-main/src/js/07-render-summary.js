import { ACT_REFERENCES, getFact, katHtml } from './01-data.js';
import { beginRenderPass, endRenderPass, barsHtml, bracketLadderHtml, deductionBreakdown, deductionRingColour, DEDUCTION_RING_REST, gtiSourceBreakdown, miniCardHtml, noteHtml, $, animateHeroFigures, APP, calcAgeAtYearEnd, calcFullTax, tfiChargeForActiveYear, calcRebates, closeModal, cssColour, debounceSave, donutHtml, waterfallHtml, _downloadBlob, esc, fmt, getActiveTaxYear, getSelectedIncomeTypes, gs, gv, hasIncomeCaptured, maskAll, navigateTo, normaliseResidency, openModal, pct, persistData, populateIncomeCodes, provBtn, provTip, renderBucketNav, showConfirm, showToast, sv, taxableIt3bItems, updateProvisionalAutoStatus, iconClassFor, syncAddCtas } from './02-core.js';
import { donutColour, calcProvisionalPenalty, renderCarriedBalances, renderIncomeCgtGlanceCards, renderIncomeGlanceBottom, renderIncomeList, renderIncomeStats, renderIncomeSubpageGlances, renderOutstandingBottom, renderPriorYearFlags } from './03-income.js';
import { calcCompanyCarDeduction, calcForeignSubsistence, calcHomeOffice, calcInterest, calcSubsistence, calcTravel, dedTaxBenefit, renderDeductionCodeList, renderDeductionsChecklist, renderDeductionSubpageGlances, renderDeductionsGlanceBottom, renderDeductionsHero, renderDonationsList, renderMedicalCreditsDisplay, renderMedicalExplanation, renderRetirementCap, syncMedMembersFromDeps, syncHomeOfficeAnswer } from './04-deductions.js';
import { renderBusinessList, renderForeignSummary, renderIt3bList, renderTfiList, renderPensionAnnuityList, renderRetirementLumpsumList, renderToolsWtList, renderTwopotWithdrawalList } from './05-list-modules.js';
import { renderCrypto } from './06-crypto.js';
import { calcRentalNet, renderRentalResult } from './06a-rental.js';
import { renderCgtResult } from './06b-cgt.js';
import { renderOtherReceiptsList } from './06c-other-receipts.js';
import { celebrateReward, convertCardsToAccordions, dashCompleteness, renderDashboard, renderResidencyGate } from './08-dashboard-theme.js';
import { initMonthlyPlannerMonth, renderLumpSumList, renderMonthlyPlanner } from './10-current-year-planner.js';
import { _showError } from './12-bootstrap-onboarding.js';
import { entUnlocked, entOnLockedTap } from './14-entitlement.js';

/* ============================================================
   InspiredTax v8.5 — RENDER LAYER: SUMMARY MODE + ACT REFS
   Tax return, documents, risk, history, act references
   ============================================================ */

/* v8.9 Batch 1 — keystone: single derived-UI refresh called after every mutation,
   so income/bucket/deduction changes propagate without opening+exiting the profile.
   renderAll() already covers income cards, duplicate notes, deductions checklist,
   retirement cap, all calculators and the dashboard; provisional auto-status is the gap. */
/* V8.9 B3.4: prior-year excess retirement contributions count toward THIS year
   (subject to the s11F cap) and are only applied by calcFullTax when the retirement
   deduction toggle is ON. Auto-enable retirement once when py_ret_excess > 0, with a
   reason note. A later manual toggle-off is respected (won't re-fire this session). */
export function autoToggleFromPriorYear() {
  if(!APP.autoReason) APP.autoReason = {};
  var pyExcess = (typeof gv === 'function') ? gv('py_ret_excess') : 0;
  if(pyExcess > 0 && !APP.dedChecks.retirement && !APP.pyRetExcessHandled) {
    APP.dedChecks.retirement = true;
    APP.pyRetExcessHandled = true;
    APP.autoReason.retirement = 'you carried forward unused retirement contributions from last year \u2014 these count toward this year (subject to the s11F cap)';
  }
}

export function refreshDerived() {
  if (typeof autoToggleFromPriorYear === 'function') autoToggleFromPriorYear();
  if (typeof renderAll === 'function') renderAll();
  if (typeof updateProvisionalAutoStatus === 'function') updateProvisionalAutoStatus();
}

export function renderAll() {
  const steps = [
    /* First in the chain: the residency gate decides whether the app is
       usable at all, so it should not wait behind twenty renders that a
       gated user will never see. */
    ['renderResidencyGate', renderResidencyGate],
    ['renderIncomeStats', renderIncomeStats],
    ['renderIncomeGlanceBottom', renderIncomeGlanceBottom],
    ['renderIncomeCgtGlanceCards', renderIncomeCgtGlanceCards],
    ['renderIncomeList', renderIncomeList],
    ['renderBucketNav', renderBucketNav],
    ['renderCrypto', renderCrypto],
    ['populateIncomeCodes', populateIncomeCodes],
    ['renderDeductionsChecklist', renderDeductionsChecklist],
    ['renderDeductionsGlanceBottom', renderDeductionsGlanceBottom],
    ['renderDeductionsHero', renderDeductionsHero],
    ['renderDeductionSubpageGlances', renderDeductionSubpageGlances],
    ['renderIncomeSubpageGlances', renderIncomeSubpageGlances],
    ['renderRetirementCap', renderRetirementCap],
    /* B5: keep the visible one-count field and the stated home-office answer
       in step with the engine inputs they derive from / feed. Both guard
       against clobbering a field the user is typing in. */
    ['syncMedMembersFromDeps', syncMedMembersFromDeps],
    ['syncHomeOfficeAnswer', syncHomeOfficeAnswer],
    ['renderMedicalCreditsDisplay', renderMedicalCreditsDisplay],
    ['renderMedicalExplanation', renderMedicalExplanation],
    ['renderDeductionCodeList', renderDeductionCodeList],
    ['renderPriorYearFlags', renderPriorYearFlags],
    ['renderToolsWtList', renderToolsWtList],
    ['renderCgtResult', renderCgtResult],
    ['renderCarriedBalances', renderCarriedBalances],
    ['renderRentalResult', renderRentalResult],
    ['renderIt3bList', renderIt3bList],
    ['renderTfiList', renderTfiList],   // QR9a
    ['renderBusinessList', renderBusinessList],
    ['renderForeignSummary', renderForeignSummary],
    ['renderPensionAnnuityList', renderPensionAnnuityList],
    ['renderRetirementLumpsumList', renderRetirementLumpsumList],
    ['renderTwopotWithdrawalList', renderTwopotWithdrawalList],
    ['renderOtherReceiptsList', renderOtherReceiptsList],
    ['renderDonationsList', renderDonationsList],
    ['syncAddCtas', syncAddCtas],   // STD-BEHAV-5: after every list a button counts has rendered
    ['calcTravel', calcTravel],
    ['calcCompanyCarDeduction', calcCompanyCarDeduction],
    /* PAYE-GEN-01-G03 review (2026-08-28): found in passing — calcSubsistence
       was never wired into renderAll() at all (every sibling deduction
       calculator on this page — calcTravel, calcHomeOffice, calcInterest —
       already was), so its pool/deduction card only ever recomputed on the
       Subsistence tab's own field input, going stale if income items
       changed elsewhere without a visit to this tab. Fixed alongside
       adding its foreign-subsistence sibling rather than leaving the new
       calculator inherit the same staleness bug. */
    ['calcSubsistence', calcSubsistence],
    ['calcForeignSubsistence', calcForeignSubsistence],
    ['calcHomeOffice', calcHomeOffice],
    ['calcInterest', calcInterest],
    ['initMonthlyPlannerMonth', initMonthlyPlannerMonth],
    ['renderMonthlyPlanner', renderMonthlyPlanner],
    ['renderLumpSumList', renderLumpSumList],
    ['renderDashboard', renderDashboard],
    ['convertCardsToAccordions', convertCardsToAccordions],
    ['renderOutstandingBottom', renderOutstandingBottom],
    /* reformat any fields a render step populated with raw numbers */
    ['maskAll', () => maskAll(document)],
  ];
  beginRenderPass();   /* BACKLOG 13: plausibility notes found here are silent */
  try {
    steps.forEach(([name, fn]) => {
      try { fn(); } catch(e) {
        console.error('renderAll.' + name + ':', e);
        if(typeof _showError === 'function') _showError('renderAll.' + name, e);
      }
    });
  } finally { endRenderPass(); }
  /* QR2.5 (RET-03, QD-20): run AFTER every step above, not from inside the
     steps array — several steps (renderCarriedBalances, renderRentalResult,
     renderIt3bList and others below) rebuild their own .dhero-num node via
     innerHTML, which used to happen AFTER animateHeroFigures ran mid-chain,
     leaving the freshly-rebuilt node with no countTo stamp at all. Running
     last guarantees every hero node in the DOM at this point is the final
     one for this render pass. */
  try { animateHeroFigures(); } catch(e) {
    console.error('renderAll.animateHeroFigures:', e);
    if(typeof _showError === 'function') _showError('renderAll.animateHeroFigures', e);
  }
}

/* ── TAX RETURN ── */
/* §5.3: opened on ENTRY to the Tax screen (nav/tab effects call this beside
   renderTaxReturn) — not inside the render itself, so a user who closes it
   isn't fought by every re-render. */
export function openTaxGlance() {
  const d = $('tax-glance-acc');
  if (d) d.open = true;
}

export function renderTaxReturn() {
  /* C-1a → QA 2026-08 → owner decision: this page carried its own residency
     banner, a near-duplicate of the dashboard's. Both are gone. A
     non-resident no longer reaches any screen — renderResidencyGate()
     (08-dashboard-theme.js) covers the whole app — so a second copy of the
     message here would only be a place for the two to drift apart. */
  /* B6.1/B9.2 (D-9): the reward card moved to the Dashboard, where it now
     leads the page — renderReward() is called from renderDashboard()
     instead. Calling it here too would mount the card on both pages. */
  const r = calcFullTax();
  renderReturnHero(r);
  renderReturnStats(r);
  renderTaxBreakdown(r);
  renderITR12(r);
  renderBreakdownChart(r);
}

/* B6.1/B6.2/B6.3 (D-9, D-26, D-27) — the reward card, moved from Taxation
   to the Dashboard, where it leads the page (D-9). Rebuilt as a native
   <details> disclosure (the app's existing accordion idiom — see
   .dhero-acc in 03-income.js) rather than the old bespoke .reward-toggle
   button + toggleRewardBreakdown()/[data-open] gate, both deleted with it.

   The figure is deliberately NOT just the deduction saving — it also
   includes what rebates and medical/foreign tax credits are worth, because
   those reduce the bill exactly as much as a deduction does and the user
   never sees them expressed as an amount anywhere else in the app. Every
   component reads an existing calcFullTax() output; no new tax math.

   Two reconciling identities, both built only from already-computed engine
   outputs (never re-derived):
     deductionSaving  = tax on adjGross (before any deduction) − taxOnIncome
                         (tax on taxableIncome, after every deduction)
     creditsConsumed   = taxOnIncome − taxPayable
                         (exactly what rebates + medical + FTC reduced the
                         bill by, however much of each was actually usable)
   total = deductionSaving + creditsConsumed always, by construction.

   Found while verifying: r.rebates/r.med.total/r.ftc are NOMINAL
   entitlements — a taxpayer below the tax threshold still has a full
   primary rebate, medical credits floor taxAfterRebates at 0 rather than
   refund the excess (s6/s6A/s6B), same for the FTC. Naively summing those
   nominal figures would overstate the reward for anyone whose income is too
   low to use all of them (e.g. R17,235 nominal rebate "saved" against a
   R0 tax bill). D-27's expanded donut names each of deductions/rebates/tax
   credits only when nothing was wasted — i.e. the nominal sum reconciles
   exactly to creditsConsumed — and folds rebates+credits into one combined
   slice otherwise. This is a display-time reconciliation check, not a
   re-derivation of rebate/credit VALUES (hard rule 2): the values
   themselves are never recomputed, only how much of them fit.

   D-26's conditional render is unchanged: nothing mounts while total <= 0
   — a reward of R0 is not a reward. */
let _lastRewardShown = null;
export function renderReward(r) {
  const el = $('tax-reward'); if (!el) return;
  /* S2 Batch 4: was a fifth independent re-derivation of Saved-ded
     (calcTaxOnIncome(r.adjGross,...) - r.taxOnIncome — a direct bracket-delta
     call, which CLAUDE.md hard rule 1 forbids outside the canonical helpers).
     dedTaxBenefit().taxSaving is the same figure the Deductions hero and
     glance chip show, so this card's donut "Deductions" segment (below) and
     its headline total can no longer drift from those. */
  const deductionSaving = dedTaxBenefit().taxSaving;
  const creditsConsumed = Math.max(0, r.taxOnIncome - r.taxPayable);
  const total = deductionSaving + creditsConsumed;
  if (total <= 0) { el.innerHTML = ''; _lastRewardShown = null; return; }

  const rebate = r.rebates || 0;
  const medical = (r.med && r.med.total) || 0;
  const ftc = r.ftc || 0;
  const nominalCredits = rebate + medical + ftc;
  const nothingWasted = Math.abs(nominalCredits - creditsConsumed) < 1;

  const segments = [];
  if (deductionSaving > 0) segments.push({ label: 'Deductions', val: deductionSaving, color: 'var(--violet)' });
  if (nothingWasted) {
    if (rebate > 0) segments.push({ label: 'Rebates', val: rebate, color: 'var(--cyan)' });
    if (medical + ftc > 0) segments.push({ label: 'Tax credits', val: medical + ftc, color: 'var(--amber)' });
  } else if (creditsConsumed > 0) {
    /* Some rebate/credit exceeded what was left to reduce — naming each one
       at its full nominal value would overstate what this taxpayer actually
       kept, so show only what was genuinely used, combined. */
    segments.push({ label: 'Rebates and tax credits', val: creditsConsumed, color: 'var(--amber)' });
  }

  /* D-10/D-26: the items-based completion ring relocates here from "Your
     return" (B6.6) — dashCompleteness() is the single source both cards
     read, so the two can never disagree (B6.7). */
  const comp = dashCompleteness();
  const C = 2 * Math.PI * 20;
  const ringHtml = '<svg class="dcomp-ring" viewBox="0 0 48 48" aria-hidden="true">'
    + '<circle cx="24" cy="24" r="20" class="dcomp-ring-bg"></circle>'
    + '<circle cx="24" cy="24" r="20" class="dcomp-ring-fg"'
    + ' style="stroke-dasharray:' + C.toFixed(1) + ';stroke-dashoffset:' + (C * (1 - comp.pct / 100)).toFixed(1) + '"></circle>'
    + '</svg><span class="dcomp-ring-pct">' + comp.pct + '%</span>';

  const countsHtml = '<div class="reward-counts">'
    + '<span class="v-emerald">' + comp.byArea.income.captured + ' Income</span>'
    + '<span class="v-violet">' + comp.byArea.deductions.captured + ' Deductions</span>'
    + '<span class="v-amber">' + comp.byArea.balances.captured + ' Tax balances</span>'
    + '</div>';

  const donut = donutHtml(segments, { size: 70 });
  const wasOpen = !!APP._rewardOpen;

  el.innerHTML = '<details class="reward" id="tax-reward-card"' + (wasOpen ? ' open' : '')
    + ' ontoggle="APP._rewardOpen=this.open">'
    + '<summary class="reward-summary">'
    + '<p class="reward-kicker">Your reward for following the tax rules the smart way'
    + '<i class="material-symbols-outlined msi-expand-more reward-chev" aria-hidden="true"></i></p>'
    + '<div class="reward-head reward-reveal" style="--d:.1s">'
    + '<div class="reward-ringwrap">' + ringHtml + '</div>'
    + '<div class="reward-mascot">' + katHtml('celebrating', 66) + '</div>'
    + countsHtml
    + '</div>'
    + '<div class="reward-fig reward-reveal" style="--d:.2s" data-total="' + total + '" data-nothing-wasted="' + nothingWasted + '" data-count="' + total + '" data-count-key="dash-reward-total">' + fmt(total) + '</div>'
    + '</summary>'
    + '<div class="reward-breakdown reward-reveal" style="--d:.1s">'
    + '<p class="reward-sub">Congratulations, you saved ' + fmt(total) + ' this year. Enjoy!</p>'
    + donut
    + '</div>'
    + '</details>';

  if (_lastRewardShown !== total) {
    _lastRewardShown = total;
    celebrateReward($('tax-reward-card'));
  }
}

/* B6.4, completed by B9.6 (D-13) — one classifier, no arithmetic: reads
   calcFullTax() output only, evaluated in the order D-13 specifies
   (BELOW_THRESHOLD tested before ABSORBED, and defined strictly as
   taxableIncome <= threshold, so the two can never both match). Built early
   because B6.4's Dashboard balance card needed it before B9 landed; both
   that card and Taxation's own hero (renderReturnHero below) now classify
   through this one export, which is what the cross-batch dependency table
   asks for. tests/hero-states.js pins every state and boundary.

   hasIncome comes from the shared hasIncomeCaptured() (02-core.js), which
   dashChecklist() (08-dashboard-theme.js) also calls, so "no income
   captured" can never read differently on the Dashboard than here — B9.6
   replaced the duplicated three-line test that had drifted out of both.
   The threshold lookup follows the existing display-only pattern at
   renderRatesInfo() below (ty.thresholds by age) — a data lookup, not tax
   math (hard rule 5: the figures themselves live in TAX_YEARS/HIST_TAX). */
export function taxHeroState(r) {
  const hasIncome = hasIncomeCaptured(r);
  const hasDeductions = Object.values(APP.dedChecks || {}).some(Boolean);
  /* QR9a: a liability with no income (the s12T(7) charge alone) is not
     "no data" — it falls through to the owing/refund states below. */
  const owesSomething = (r.totalTaxYear || 0) > 0;
  if (!hasIncome && !hasDeductions && !owesSomething) return 'NO_DATA';
  if (!hasIncome && !owesSomething) return 'NO_INCOME';
  const threshold = r.age >= 75 ? r.ty.thresholds.age75 : r.age >= 65 ? r.ty.thresholds.age65 : r.ty.thresholds.under65;
  /* B9.6 guard, ahead of BOTH "No tax due" states and outside either
     definition: r.taxPayable is normal tax only — Second Schedule lump-sum
     tax is a SEPARATE liability (02-core.js:1495 excludes it; :1519 nets it
     into the balance). Without this, a below-threshold or rebate-absorbed
     taxpayer who took a taxable retirement lump sum was told "No tax due"
     while owing SARS the lump-sum tax, and renderDashBalance() below hid
     the amount as well. totalTaxYear is the engine's own full-liability
     figure (taxPayable + lumpSumTax + the s12T(7) charge) — no arithmetic
     added here. */
  if ((r.totalTaxYear || 0) <= 0) {
    if (r.taxableIncome <= threshold) return 'BELOW_THRESHOLD';
    if (r.taxOnIncome > 0) return 'ABSORBED';
  }
  /* D-13's table has no row for prepayments that match the liability
     exactly — the ordinary single-employer PAYE case. Falling through to
     the owing branch would state "Owed to SARS R 0 · your tax payable is
     more than PAYE paid", which is false. The shipped hero already had a
     balanced treatment (.bl); B9.6 keeps it as its own state rather than
     regress it into a wrong statement. Deviation logged in
     03-IMPLEMENTATION.md's B9.6 entry. */
  if ((r.balance || 0) === 0) return 'BALANCED';
  const provLarger = (r.provisionalPaid || 0) > (r.payeDeducted || 0);
  return r.balance > 0 ? (provLarger ? 'OWING_PROV' : 'OWING_PAYE')
                       : (provLarger ? 'REFUND_PROV' : 'REFUND_PAYE');
}

/* B9.6 — copy is exactly `02-DECISIONS.md` D-13's table, kept in one map so
   the hero and any later consumer can never paraphrase it apart. `sub: null`
   is D-13's "*none*": those two states render headline only. */
const TAX_HERO_COPY = {
  NO_DATA:         { label: 'No data',                 sub: null },
  NO_INCOME:       { label: 'No income captured',      sub: null },
  BELOW_THRESHOLD: { label: 'No tax due',              sub: 'Your taxable income is below the tax threshold' },
  ABSORBED:        { label: 'No tax due',              sub: 'Your rebates and tax credits exceed your tax payable, but any excess is not refundable. Certain tax credits may carry forward.' },
  BALANCED:        { label: 'Return balanced',         sub: 'Your PAYE and provisional tax payments cover your tax payable exactly.' },
  OWING_PAYE:      { label: 'Owed to SARS',            sub: 'Your tax payable is more than PAYE paid for the tax year' },
  OWING_PROV:      { label: 'Owed to SARS',            sub: 'Your tax payable is more than provisional tax paid for the tax year' },
  REFUND_PAYE:     { label: 'Refund due from SARS',    sub: 'You paid more PAYE for the tax year than your tax payable' },
  REFUND_PROV:     { label: 'Refund due from SARS',    sub: 'You paid more provisional tax for the tax year than your tax payable' }
};

/* B6.4 (D-28) — the Dashboard's own balance card, replacing the old
   one-line .dhero strip that used to render into #dash-stats. Reuses
   .dhero's colour system (--hero-c via .ow/.rf) and the .dhero-acc
   disclosure idiom (03-income.js's income hero), but is its own horizontal
   layout, scoped by .dash-balance — Taxation's full hero (renderReturnHero,
   still all eight TAXHERO-* states once B9.6 lands) is untouched.

   Hidden entirely for the four no-amount states so the classifier and this
   card can never disagree (cross-batch dependency, B6.4 + B9.6). */
export function renderDashBalance(r) {
  const el = $('dash-balance'); if (!el) return;
  const state = taxHeroState(r);
  /* B9.6: hidden when there is genuinely nothing to state — nothing
     captured, or the balance is zero (BALANCED, and the no-tax-due states
     with no prepayment to reclaim). It used to hide on BELOW_THRESHOLD and
     ABSORBED outright, which also hid a real refund from a taxpayer whose
     PAYE was withheld below the threshold — the Taxation hero now shows
     that amount, so hiding it here would leave the two cards telling
     different stories (cross-batch dependency B6.4 + B9.6). */
  if (state === 'NO_DATA' || state === 'NO_INCOME' || (r.balance || 0) === 0) {
    el.innerHTML = ''; return;
  }
  const isOwing = state === 'OWING_PAYE' || state === 'OWING_PROV';
  const amount = Math.abs(r.balance);
  /* B1 fix: payable must include the lump-sum tax r.balance itself
     accounts for (r.balance = (taxPayable + lumpSumTax) - payeDeducted -
     lumpSumWithheld - provisionalPaid, 02-core.js), and the fund-withheld
     step must appear, or the steps cannot land on r.balance whenever a
     lump sum or two-pot withdrawal exists (fixture S10c exercises this). */
  const payable = r.totalTaxYear || 0;
  const lbl = isOwing ? 'Owed to SARS' : 'Refund due from SARS';
  const tip = provTip('Refund / amount owing',
    [['Tax payable for the year', payable], ['Less PAYE already paid', r.payeDeducted],
     ['Less provisional tax paid', r.provisionalPaid], ['Less tax withheld by fund', r.lumpSumWithheld]],
    (isOwing ? 'Owing to SARS' : 'Refund due'), amount);
  /* Allan's refined spec, drawn as a waterfall: owing starts from tax
     payable and takes off each prepayment as its own step (PAYE,
     provisional, fund-withheld — never one combined "paid" step); refund
     builds up what was paid, then takes off tax payable. Either way the
     last row is r.balance, which TEST-6 casts. Each prepayment wears its
     own area colour (PAYE blue, Provisional rose, Tax navy); only the
     outcome wears the semantic red/mint. */
  const paySteps = [
    { label: 'PAYE paid', less: 'Less PAYE paid', val: r.payeDeducted || 0, color: 'var(--blue)' },
    { label: 'Provisional tax paid', less: 'Less provisional tax paid', val: r.provisionalPaid || 0, color: 'var(--rose)' },
    { label: 'Tax withheld by fund', less: 'Less tax withheld by fund', val: r.lumpSumWithheld || 0, color: 'var(--violet)' },
  ];
  const barsHtml = isOwing
    ? waterfallHtml([{ label: 'Tax payable for the year', val: payable, kind: 'add', color: 'var(--navy)' }]
        .concat(paySteps.map(function(s){ return Object.assign({ kind: 'sub' }, s, { label: s.less }); }))
        .concat([{ label: 'Owed to SARS', kind: 'total', color: 'var(--red)' }]), 'How the amount owed is worked out')
    : waterfallHtml(paySteps.map(function(s){ return Object.assign({ kind: 'add' }, s); })
        .concat([{ label: 'Less tax payable for the year', val: payable, kind: 'sub', color: 'var(--navy)' },
                 { label: 'Refund due', kind: 'total', color: 'var(--mint)' }]), 'How the refund is worked out');
  const wasOpen = !!APP._dashBalanceOpen;

  el.innerHTML = '<details class="dhero-acc" id="dash-balance-acc"' + (wasOpen ? ' open' : '')
    + ' ontoggle="APP._dashBalanceOpen=this.open">'
    + '<summary class="dhero ' + (isOwing ? 'ow' : 'rf') + ' dash-balance">'
    + '<div class="dash-balance-row"><span class="dash-balance-lbl">' + esc(lbl) + provBtn(tip) + '</span>'
    + '<span class="dhero-num" data-count="' + amount + '" data-count-key="dash-balance">' + fmt(amount) + '</span>'
    + '<i class="material-symbols-outlined msi-expand-more dhero-tri" aria-hidden="true"></i></div>'
    + '</summary>'
    + '<div class="dhero-detail">' + barsHtml + '</div>'
    + '</details>';
}

/* v8.27 Focus: sign-driven balance hero atop the Tax Return — identical
   treatment to the dashboard's balance hero, which is the point: the spec
   (§10.2) has this screen open on the COMPOSITION of the balance rather than
   restate it in a second visual language. Engine untouched: reads r.balance,
   r.taxPayable, r.payeDeducted, r.provisionalPaid only.

   B9.6 (TAXHERO-A…H, D-13): the bare sign test became taxHeroState(), so
   every D-13 state renders from one classification and one copy map instead
   of three inline ternaries. No arithmetic added — each branch reads a
   figure the engine already computed.

   D-19 does not reach this card. Its colour is SEMANTIC (--hero-c via
   .ow/.rf/.bl), never a category fill, so it takes no --area-accent and no
   icon tile — the two systems must not share a treatment (P4). The tag's
   dot carries the mark instead. */
export function renderReturnHero(r) {
  const el = $('return-hero'); if(!el) return;
  const state = taxHeroState(r);
  const copy = TAX_HERO_COPY[state];

  /* D-13: the two no-capture states are headline only — no amount, no
     sub-line, no breakdown — and the card shrinks to match, which is the
     owner's stated objective. .u-empty is the app's existing "nothing here
     yet" hero treatment (the Income hero's empty state uses it), so this
     needs no new CSS. */
  if (state === 'NO_DATA' || state === 'NO_INCOME') {
    el.innerHTML = '<div class="dhero bl u-empty">'
      + '<div class="dhero-top"><div class="dhero-lbl">' + esc(copy.label) + '</div></div>'
      + '</div>';
    return;
  }

  const isOwing  = state === 'OWING_PAYE'  || state === 'OWING_PROV';
  const isRefund = state === 'REFUND_PAYE' || state === 'REFUND_PROV';
  /* A below-threshold or rebate-absorbed taxpayer can still have PAYE or
     provisional tax to reclaim: "no tax due" and "nothing to pay you back"
     are different statements, and r.balance already says which. D-13 fixes
     the headline for these two states but says nothing about the amount —
     suppressing a real refund here would hide the one figure the user needs
     in order to claim it. */
  const reclaimable = (state === 'BELOW_THRESHOLD' || state === 'ABSORBED') && (r.balance || 0) < 0;
  const tone = isOwing ? 'ow' : (isRefund || reclaimable) ? 'rf' : 'bl';

  /* §5.3: one-line cause — largest non-PAYE income source (display only,
     existing engine fields; no tax math). */
  let cause = '';
  if (isOwing) {
    const srcs = [
      [r.investmentIncome,    'investment income'],
      [r.rentalIncome,        'rental income'],
      [r.businessIncome,      'business income'],
      [r.cgtTaxableGain,      'capital gains'],
      [r.cryptoRevenue,       'crypto income'],
      [r.otherReceiptsIncome, 'other receipts'],
      [r.pensionAnnuity,      'pension income'],
    ].filter(s => s[0] > 0).sort((a, b) => b[0] - a[0]);
    if (srcs.length) cause = ' <span style="color:var(--tx3)">· mostly from ' + srcs[0][1] + '</span>';
  }
  const provLine = r.provisionalPaid > 0
    ? ' <span style="color:var(--tx3)">·</span> <span class="mono">' + fmt(r.provisionalPaid) + '</span> provisional paid' : '';
  /* S2 Batch 7: this sentence reconciles to the headline above (r.balance,
     which already includes lumpSumTax/lumpSumWithheld) — it used
     r.taxPayable (normal tax only) with no fund-withheld component, so it
     silently stopped summing to the headline for anyone with a lump sum or
     two-pot withdrawal, same defect class as B1 (S2 Batch 6). */
  const withheldLine = r.lumpSumWithheld > 0
    ? ' <span style="color:var(--tx3)">·</span> <span class="mono">' + fmt(r.lumpSumWithheld) + '</span> tax withheld by fund' : '';
  /* §D two-system rule: tax payable is --navy, PAYE is --blue, the outcome
     figure above (dhero-num) is already --mint/--rose via the .rf/.ow state
     class — this line never repaints that figure, only labels the two
     inputs that produced it. */
  const composition = (isOwing || isRefund)
    ? '<span class="mono" style="color:var(--navy)">' + fmt(r.totalTaxYear) + '</span> tax payable <span style="color:var(--tx3)">·</span> <span class="mono" style="color:var(--blue)">' + fmt(r.payeDeducted) + '</span> PAYE paid' + provLine + withheldLine + cause
    : '';
  const subLine = reclaimable ? 'Refund due from SARS · ' + copy.sub : copy.sub;
  const breakHtml = composition
    ? composition + '<div class="dhero-sub">' + esc(subLine) + '</div>'
    : esc(subLine);

  /* The figure appears only when money actually moves. "No tax due" over a
     hero-sized R 0 states the same nil twice, and "Return balanced" is the
     statement itself — the amount there is zero by definition. 0.5 is the
     same "no movement" floor setBalance() uses for its delta badges
     (03-income.js), so a sub-rand residue never prints as R 0 either. */
  const amountHtml = Math.abs(r.balance || 0) >= 0.5
    ? '<div class="dhero-num" data-count="' + Math.abs(r.balance) + '" data-count-key="tax-return-balance">' + fmt(Math.abs(r.balance)) + '</div>' : '';

  el.innerHTML = '<div class="dhero ' + tone + '">'
    + '<div class="dhero-top"><div class="dhero-lbl">' + esc(copy.label) + '</div></div>'
    + amountHtml
    + '<div class="dhero-break">' + breakHtml + '</div>'
    + '</div>';
}

/* UI-CARD-1 (BACKLOG 28): the four cards the Dashboard and the Tax screen's
   Return tab both show — gross taxable income, deductions, taxable income,
   tax payable — built once, so the two screens cannot disagree (WR-8).
   Moved unchanged from renderDashboard() (08-dashboard-theme.js), plus each
   card's chart for the expanded state (the Dashboard shows only the gross
   card's, as before). col = { gti, taxable, tax }: the area colour each
   screen paints those cards in. Returns specs for miniCardHtml(). */
export function glanceCardSpecs(r, col) {
  col = col || {};
  var small = [];
  var totalDed = (r.retAllowed || 0) + (r.otherDed || 0) + (r.donAllowed || 0) + (r.additionalDed || 0);
  /* chain ('add' | 'sub'): the row's part in a card whose rows are a sum,
     stamped so the debug harness can cast them (TEST-13). */
  function brk(lbl, val, chain){ return val > 0 ? '<div class="mini-row"' + (chain ? ' data-chain="' + chain + '" data-val="' + val + '"' : '') + '><span>' + esc(lbl) + '</span><span class="v">' + fmt(val) + '</span></div>' : ''; }
  /* Gross taxable income — collapsed GTI (r.adjGross); expanded shows the
     GI − TEI = GTI chain plus a donut of GTI by source (taxable sources
     only, per the chart rule — no TEI slice, since this chart sums to
     GTI not GI). gtiSourceBreakdown() (02-core.js) is canonical: every
     figure comes from calcFullTax() fields, none re-derived here. */
  if (r.adjGross > 0) {
    var _gtiSources = gtiSourceBreakdown(r);
    /* A loss (negative business/rental result) can't be a donut slice —
       charting only the positive sources would oversum the card total,
       so the chart is skipped entirely when one exists (same rule the
       retirement cap card follows for its own negative intermediate,
       S2 Batch 12); the GI/TEI/GTI subtraction chain above still shows. */
    var _gtiHasLoss = _gtiSources.some(function(c){ return c.val < 0; });
    var _gtiDonut = _gtiHasLoss ? '' : donutHtml(_gtiSources.map(function(c){
      return { label: c.label, val: c.val, color: donutColour(c.label) };
    }), { size: 64 });
    small.push({
      lbl: 'Gross taxable income', key: 'mini-gti', c: col.gti, navTo: 'Income', val: fmt(r.adjGross), raw: r.adjGross, nav: "navigateTo('income','main')",
      /* HERO-2: the collapsed ring is the expanded donut's own slices. */
      ring: _gtiHasLoss ? '' : donutHtml(_gtiSources.map(function(c){ return { val: c.val, color: donutColour(c.label) }; }), { compact: true }),
      body: brk('Gross income (GI)', r.gi)
          + brk('Less tax-exempt income (TEI)', r.tei)
          + '<div class="mini-row" style="font-weight:600"><span>Gross taxable income (GTI)</span><span class="v">' + fmt(r.adjGross) + '</span></div>',
      chart: _gtiDonut
    });
  }
  /* Deductions — F2 fix: company car and foreign subsistence are already
     inside totalDed (S1 Batch 6) but were never their own row, so the
     rows below never summed to the card total for anyone claiming
     either. Both added here. */
  if (totalDed > 0) {
    /* HERO-2: one list (deductionBreakdown, 02-core.js) drives the rows
       and the ring, so the ring cannot show a split the rows do not. Each
       row wears its slice's colour; the deductions without a hue of their
       own are one "everything else" slice (DEDUCTION_RING_COLOUR says why). */
    var _dedRows = deductionBreakdown(r);
    var _dedSegs = [], _dedRest = 0;
    _dedRows.forEach(function(c){
      var col = deductionRingColour(c.label);
      if (col === DEDUCTION_RING_REST) _dedRest += c.val; else _dedSegs.push({ val: c.val, color: col });
    });
    if (_dedRest > 0) _dedSegs.push({ val: _dedRest, color: DEDUCTION_RING_REST });
    small.push({
      lbl: 'Deductions', key: 'mini-deductions', c: 'var(--violet)', navTo: 'Deductions', val: fmt(totalDed), raw: totalDed, nav: "navigateTo('deductions','selections')",
      ring: donutHtml(_dedSegs, { compact: true }),
      body: _dedRows.map(function(c){
            /* <wbr>: "Tools/equipment" is one unbreakable word, and beside
               the swatch it no longer fits the half-width card at 360px —
               without a break point the swatch was left alone on its line. */
            return '<div class="mini-row"><span><i class="mini-sw" style="background:' + deductionRingColour(c.label) + '"></i>' + esc(c.label).replace('/', '/<wbr>') + '</span><span class="v">' + fmt(c.val) + '</span></div>';
          }).join('')
          + '<div class="mini-row" style="font-weight:600"><span>Total</span><span class="v">' + fmt(totalDed) + '</span></div>',
      /* UI-CARD-1: the deductions with a statutory limit, each against it
         (r.retMax/r.donMax, the caps the engine applied); when none is
         claimed, the ring's own slices as a labelled donut. */
      chart: barsHtml([
          r.retAllowed > 0 ? { label: 'Retirement contributions', val: r.retAllowed, cap: r.retMax, color: deductionRingColour('Retirement contributions') } : null,
          r.donAllowed > 0 ? { label: 'Donations', val: r.donAllowed, cap: r.donMax, color: deductionRingColour('Donations') } : null
        ].filter(Boolean), { label: 'Deductions against their limits' })
        || donutHtml(_dedRows.map(function(c){ return { label: c.label, val: c.val, color: deductionRingColour(c.label) }; }), { size: 64 })
    });
  }
  /* Taxable income — collapsed TI (r.taxableIncome), must agree with the
     Tax payable card's own TI-base line below (same field, so it always
     will). The rows are a subtraction chain; the ring (HERO-2) is not a
     chart of that chain but one share: how much of gross taxable income is
     still taxable after it, the rest left as empty track.
     The loss row is the part of the assessed loss actually SET OFF
     (r.pyLoss − r.lossUnabsorbed, the figure 03-income.js and
     07-render-summary.js show). It read r.lossUnabsorbed — the part NOT
     used — so a loss absorbed in full showed no row and the chain was out
     by the whole loss (debug-harness TEST-13, fixture S12c). */
  if (r.taxableIncome > 0) {
    var _lossSetOff = Math.max(0, (r.pyLoss || 0) - (r.lossUnabsorbed || 0));
    small.push({
      lbl: 'Taxable income', key: 'mini-taxable-income', c: col.taxable, navTo: 'Return', val: fmt(r.taxableIncome), raw: r.taxableIncome, nav: "navigateTo('summary','return')",
      ring: donutHtml([{ val: r.taxableIncome, color: col.taxable }], { compact: true, whole: r.adjGross }),
      body: brk('Gross taxable income (GTI)', r.adjGross, 'add')
          + brk('Less total deductions', totalDed, 'sub')
          + brk('Less assessed loss brought forward', _lossSetOff, 'sub')
          + '<div class="mini-row" style="font-weight:600" data-chain="total" data-val="' + r.taxableIncome + '"><span>Taxable income</span><span class="v">' + fmt(r.taxableIncome) + '</span></div>',
      /* B9.3/D-15/SC-3: what gross taxable income became — taxable, the
         deductions, the loss set off, and any remainder the engine left
         untaxed. Every slice is a field above or the remainder of them, so
         the ring always closes on r.adjGross. Assessed loss is --rose:
         --navy and --blue are too close in a ring this small (2026-09-20). */
      chart: donutHtml([
        { label: 'Taxable income', val: r.taxableIncome || 0, color: col.taxable },
        { label: 'Exempt income', val: Math.max(0, (r.adjGross || 0) - (r.taxableIncome || 0) - totalDed - _lossSetOff), color: 'var(--neutral)' },
        { label: 'Deductions', val: totalDed, color: 'var(--violet)' },
        { label: 'Assessed loss set off', val: _lossSetOff, color: 'var(--rose)' }
      ], { size: 64 })
    });
  }
  /* Tax payable — replaces "Tax saved" (not a rename: this is tax on TI
     less credits, TEST-9's identity — the wider Tax-saved figure,
     Saved-ded + rebates + medical + FTC, is the Dashboard reward card,
     S2 Batch 4). r.taxPayable (normal tax only) — lump-sum tax has its
     own reporting on the Refund/Owing bar (S2 Batch 6), so is
     deliberately not folded in here or the on-TI chain below would no
     longer cast. */
  if (r.taxPayable > 0 || r.taxOnIncome > 0) {
    small.push({
      lbl: 'Tax payable', key: 'mini-tax-payable', c: col.tax, navTo: 'Return', val: fmt(r.taxPayable), raw: r.taxPayable, nav: "navigateTo('summary','return')",
      /* HERO-2: what is left to pay out of the tax on taxable income; the
         empty track is the rebates and credits actually used
         (taxOnIncome − taxPayable, as renderReward() counts them — their
         nominal values can exceed the tax, so they are not slices). */
      ring: donutHtml([{ val: r.taxPayable, color: col.tax }], { compact: true, whole: r.taxOnIncome }),
      body: brk('Tax on taxable income (' + fmt(r.taxableIncome) + ')', r.taxOnIncome)
          + brk('Less primary/secondary/tertiary rebate', r.rebates)
          + brk('Less medical tax credits', r.med && r.med.total)
          + brk('Less foreign tax credit', r.ftc)
          + '<div class="mini-row" style="font-weight:600"><span>Tax payable</span><span class="v">' + fmt(r.taxPayable) + '</span></div>',
      /* The collapsed ring, drawn large and labelled: the tax left to pay
         and the rebates and credits used (the ring's empty track). */
      chart: donutHtml([
        { label: 'Tax payable', val: r.taxPayable || 0, color: col.tax },
        { label: 'Rebates and credits used', val: Math.max(0, (r.taxOnIncome || 0) - (r.taxPayable || 0)), color: 'var(--neutral)' }
      ], { size: 64 })
    });
  }
  return small;
}

/* UI-CARD-1 (BACKLOG 28, owner chose option B 2026-10-07): a row of the
   breakdown. `sign` +1/−1 stamps data-val so the smoke gate can cast the rows
   of a card that sums to its figure (data-casts on the card's total row). */
export function cardRow(lbl, val, sign, swatch) {
  if (!(val > 0)) return '';
  return '<div class="mini-row" data-val="' + (sign < 0 ? -val : val) + '"><span>' + (swatch ? '<i class="mini-sw" style="background:' + swatch + '"></i>' : '') + esc(lbl) + '</span><span class="v">' + (sign < 0 ? '−' : '') + fmt(val) + '</span></div>';
}
export function cardTotal(lbl, valTxt, raw) {
  return '<div class="mini-row is-total"' + (raw != null ? ' data-casts="' + raw + '"' : '') + '><span>' + esc(lbl) + '</span><span class="v">' + valTxt + '</span></div>';
}
function pctTxt(x, dp) { return (x * 100).toFixed(dp == null ? 1 : dp) + '%'; }
/* Which way the year lands, in the hero's own words. */
function balanceLabel(b) { return b > 0.5 ? 'Owed to SARS' : b < -0.5 ? 'Refund due' : 'Balanced'; }

/* The figure behind the rate: tax payable over gross taxable income
   (calcFullTax's effectiveRate), beside the marginal rate for scale. */
export function effectiveRateCardSpec(o) {
  var top = o.brackets && o.brackets.length ? o.brackets[o.brackets.length - 1].rate : o.marginal;
  return { lbl: 'Effective rate', key: o.key || 'card-eff', c: 'var(--navy)', val: pctTxt(o.rate), raw: o.rate, rate: true,
    body: cardRow('Tax payable', o.tax, 1) + cardRow(o.baseLabel || 'Gross taxable income', o.base, 1) + cardTotal('Tax ÷ ' + (o.baseLabel || 'gross taxable income').toLowerCase(), pctTxt(o.rate)),
    chart: barsHtml([
      { label: 'Effective rate', val: o.rate, color: 'var(--navy)' },
      o.marginal > 0 ? { label: 'Marginal rate', val: o.marginal, color: 'color-mix(in srgb, var(--navy) 45%, var(--sf3))' } : null
    ].filter(Boolean), { max: top, fmt: function(v){ return pctTxt(v, v >= 0.1 || v === 0 ? 0 : 1); }, label: 'Rates' }) };
}

/* Tax for the year against what has been paid towards it; the total is the
   balance (r.balance — calcFullTax's own sum, never re-derived here). */
export function paymentsCardSpec(o) {
  var paid = (o.paye || 0) + (o.provisional || 0) + (o.withheld || 0);
  return { lbl: o.lbl || 'PAYE paid', key: o.key || 'card-paye', c: 'var(--blue)', val: fmt(o.figure != null ? o.figure : o.paye), raw: o.figure != null ? o.figure : o.paye,
    navTo: o.navTo, nav: o.nav,
    body: cardRow(o.taxLabel || 'Tax for the year', o.tax, 1) + cardRow('Less PAYE paid', o.paye, -1) + cardRow('Less provisional tax paid', o.provisional, -1)
      + cardRow('Less tax withheld by the fund', o.withheld, -1) + cardTotal(balanceLabel(o.balance), fmt(Math.abs(o.balance)), o.balance),
    chart: barsHtml([
      { label: o.taxLabel || 'Tax for the year', val: o.tax, color: 'var(--navy)' },
      { label: paid === (o.paye || 0) ? 'PAYE paid' : 'Paid so far', val: paid, color: 'var(--blue)' }
    ], { label: 'Tax against payments' }) };
}

/* Where taxable income sits in the year's table (r.ty.brackets — data, not
   a figure in this code) and how far the next rate is. */
export function marginalCardSpec(o) {
  var b = o.brackets || [], idx = -1;
  b.forEach(function(x, i){ if (o.taxable >= x.min) idx = i; });
  var cur = b[idx], next = b[idx + 1];
  return { lbl: 'Marginal rate', key: o.key || 'card-marginal', c: 'var(--navy)', val: pctTxt(o.rate, 0), raw: o.rate, rate: true,
    body: (cur ? cardRow('Your bracket starts at', cur.min, 1) : '') + cardRow('Your taxable income', o.taxable, 1)
      + (next ? cardRow('Room before ' + pctTxt(next.rate, 0), next.min - o.taxable, 1) : '<div class="mini-row"><span>You are in the top bracket</span></div>'),
    chart: bracketLadderHtml(b, o.taxable) };
}

/* Retirement lump sums are taxed on their own table, cumulatively: this
   year's lump sums, the running total the table works on, the tax. */
export function lumpSumCardSpec(r) {
  return { lbl: 'Lump-sum tax', key: 'card-lump', c: 'var(--amber)', val: fmt(r.lumpSumTax), raw: r.lumpSumTax,
    navTo: 'Retirement income', nav: "navigateTo('income','b7retirement')",
    /* BACKLOG 43 (owner, OI-B3 2026-10-08): opens whenever lump sums exist,
       even at R 0 — the named exception to "a R 0 card does not open" (the
       caller only builds this card when r.lumpSumGross > 0). The opening
       pool, the s10C carry-forward and the tax-free band left are engine
       outputs (walkLumpsums). */
    body: cardRow('Received before this year', r.cumPoolOpening, 1)
      + cardRow('Lump sums this year', r.lumpSumGross, 1) + cardRow('Less non-deducted contributions relief', r.s10cUsed, -1)
      + cardRow('Total received to date', r.cumPoolClosing, 1)
      + cardRow('Non-deducted contributions to carry forward', r.s10cRemaining, 1)
      + cardRow('Tax-free amount left on retirement', r.retirementTaxFreeRemaining, 1)
      + cardTotal('Tax on lump sums', fmt(r.lumpSumTax)),
    chart: barsHtml([
      { label: 'This year', val: r.lumpSumGross, color: 'var(--amber)' },
      { label: 'To date', val: r.cumPoolClosing, color: 'color-mix(in srgb, var(--amber) 55%, var(--sf3))' }
    ], { label: 'Lump sums' }) };
}

/* A Tax-screen grid: option B (an open card takes the whole row, chart
   beside its rows), one open per group. `here` drops the Open link of a
   card whose destination is the screen it is on. */
export function taxCardsHtml(specs, group, here) {
  return specs.map(function(s){
    if (here && s.nav && s.nav.indexOf(here) >= 0) s.nav = '';
    if (s.navTo && s.nav) s.navLabel = 'Open ' + s.navTo;
    return miniCardHtml(s, { group: group, chart: true, split: true });
  }).join('');
}

export function renderReturnStats(r) {
  const el = $('return-stats'); if(!el) return;
  /* The four the Dashboard shares, in this screen's colours. */
  var specs = glanceCardSpecs(r, { gti: 'var(--emerald)', taxable: 'var(--navy)', tax: 'var(--navy)' });
  if (r.effectiveRate > 0) specs.push(effectiveRateCardSpec({ rate: r.effectiveRate, tax: r.taxPayable, base: r.adjGross, marginal: r.marginalRate, brackets: r.ty && r.ty.brackets }));
  if (r.payeDeducted > 0) specs.push(paymentsCardSpec({ paye: r.payeDeducted, provisional: r.provisionalPaid, withheld: r.lumpSumWithheld, tax: r.totalTaxYear, balance: r.balance, navTo: 'Income', nav: "navigateTo('income','main')" }));
  if (r.taxableIncome > 0 && r.marginalRate > 0) specs.push(marginalCardSpec({ rate: r.marginalRate, taxable: r.taxableIncome, brackets: r.ty && r.ty.brackets }));
  if (r.lumpSumGross > 0) specs.push(lumpSumCardSpec(r));
  el.innerHTML = taxCardsHtml(specs, 'tax-return', "'summary','return'");
}

export function renderTaxBreakdown(r) {
  const el = $('tax-breakdown'); if(!el) return;
  const isR = r.balance < 0, isO = r.balance > 0;
  const lines = [];
  /* FB7 D5: helper for clickable lines — navigates to source screen */
  function navLine(label, valStr, screen, sub, extraClass) {
    var cls = 'sum-line' + (extraClass ? ' ' + extraClass : '');
    if(screen) {
      return '<div class="' + cls + ' u-cursor-pointer" onclick="navigateTo(\'' + screen + '\',\'' + (sub||'') + '\')" title="Click to open: ' + label.replace(/</g,'').replace(/>/g,'').replace(/"/g,'') + '">'
        + '<span class="lbl">' + label + '</span><span class="val">' + valStr + '</span></div>';
    }
    return '<div class="' + cls + '"><span class="lbl">' + label + '</span><span class="val">' + valStr + '</span></div>';
  }

  // V8.4 VII.d/e: Broken-out income lines — V8.9: incomeItems = IRP5 only
  const employmentIncome = (APP.incomeItems || [])
    .filter(i => i.cat !== 'lumpsum')
    .reduce((s,i) => s + i.amount, 0);
  const lumpSumIncome = r.lumpSumTotal || 0;
  if(employmentIncome > 0 || (r.gross > 0 && !r.cgtTaxableGain && !r.rentalIncome && !lumpSumIncome)) {
    lines.push(navLine('Remuneration — IRP5/IT3(a)', fmt(Math.max(0, employmentIncome)), 'income', 'main'));
  }
  if(r.cgtTaxableGain > 0)      lines.push(navLine('Capital Gains', fmt(r.cgtTaxableGain), 'income', 'b5cgt'));
  if(r.rentalIncome > 0)        lines.push(navLine('Net Rental Income', fmt(r.rentalIncome), 'income', 'b3rental'));
  if(r.businessIncome > 0)      lines.push(navLine('Business &amp; Trade Income (net)', fmt(r.businessIncome), 'income', 'b4business'));
  if(r.otherReceiptsIncome > 0) lines.push(navLine('Other Taxable Receipts', fmt(r.otherReceiptsIncome), 'income', 'b9other'));
  if(r.cryptoRevenue > 0)       lines.push(navLine('Crypto Income (revenue)', fmt(r.cryptoRevenue), 'income', 'b10crypto'));
  if(r.investmentIncome > 0)    lines.push(navLine('Investment Income (net of s10(1)(i) exemption)', fmt(r.investmentIncome), 'income', 'b2investment'));
  if(r.twopotTotal > 0)         lines.push(navLine('Two-Pot Savings Withdrawal (marginal rate)', fmt(r.twopotTotal), 'income', 'b7retirement'));
  if(r.foreignEmpExempt > 0)    lines.push(navLine('Less: Foreign Employment Exemption \u2014 s10(1)(o)(ii)', '\u2212 ' + fmt(r.foreignEmpExempt), 'income', 'b6foreign'));
  /* v8.15 NT2a: transparency — show non-taxable IRP5 codes captured but excluded from the brackets */
  if(r.nonTaxableTotal > 0)     lines.push(navLine('Non-taxable income (excluded \u2014 e.g. 3703/3714)', '\u2212 ' + fmt(r.nonTaxableTotal), 'income', 'main'));
  lines.push('<div class="sum-line divider"><span class="lbl"><strong>Total Gross Income</strong></span><span class="val"><strong>' + fmt(r.adjGross) + '</strong></span></div>');

  if(r.pyLoss > 0) lines.push(navLine('Less: Prior Year Assessed Loss b/f', '\u2212 ' + fmt(r.pyLoss), 'summary', 'prioryear'));
  if(r.retAllowed > 0)   lines.push(navLine('Less: Retirement deduction allowed (s11F)', '\u2212 ' + fmt(r.retAllowed), 'deductions', 'retirement'));
  if(r.travelDed > 0)    lines.push(navLine('Less: Travel \u2014 s8(1)(b)', '\u2212 ' + fmt(r.travelDed), 'deductions', 'travel'));
  if(r.homeOfficeDed > 0)lines.push(navLine('Less: Home Office \u2014 s23(b)', '\u2212 ' + fmt(r.homeOfficeDed), 'deductions', 'homeoffice'));
  if(r.toolsDed > 0)     lines.push(navLine('Less: Tools &amp; Equipment \u2014 s11(e)', '\u2212 ' + fmt(r.toolsDed), 'deductions', 'tools'));
  if(r.subscripDed > 0)  lines.push(navLine('Less: Subscriptions', '\u2212 ' + fmt(r.subscripDed), 'deductions', 'selections'));
  if(r.subsistenceDed > 0) lines.push(navLine('Less: Subsistence \u2014 s8(1)(c)', '\u2212 ' + fmt(r.subsistenceDed), 'deductions', 'subsistence'));
  if(r.additionalDed > 0)lines.push(navLine('Less: Other IRP5 Deductions', '\u2212 ' + fmt(r.additionalDed), 'income', 'main'));
  if(r.donAllowed > 0)   lines.push(navLine('Less: Donations \u2014 s18A', '\u2212 ' + fmt(r.donAllowed), 'deductions', 'donations'));

  lines.push('<div class="sum-line divider total"><span class="lbl">Taxable Income</span><span class="val">' + fmt(r.taxableIncome) + '</span></div>');
  lines.push('<div class="sum-line"><span class="lbl">Tax on Taxable Income</span><span class="val">' + fmt(r.taxOnIncome) + '</span></div>');
  if(r.rebates > 0) lines.push(navLine('Less: Rebates (s6)', '\u2212 ' + fmt(r.rebates), 'deductions', 'medical'));
  if(r.med && r.med.total > 0) lines.push(navLine('Less: Medical Credits (s6A + s6B)', '\u2212 ' + fmt(r.med.total), 'deductions', 'medical'));
  if(r.ftc > 0) lines.push(navLine('Less: Foreign Tax Credit (s6quat)', '\u2212 ' + fmt(r.ftc), 'income', 'b6foreign'));
  lines.push('<div class="sum-line divider total"><span class="lbl">Tax Payable</span><span class="val">' + fmt(r.taxPayable) + '</span></div>');
  if(r.payeDeducted > 0) lines.push(navLine('Less: PAYE Paid', '\u2212 ' + fmt(r.payeDeducted), 'income', 'main'));
  /* engine-remediation W11: lump-sum tax due and the fund's directive
     withholding (code 4115) now flow into the same balance as PAYE \u2014 the
     directive withholding is a payment credit, not a final tax, so it
     belongs in the assessment outcome like PAYE does. */
  if(r.lumpSumTax > 0) lines.push(navLine('Plus: Lump-Sum Tax Due (Second Schedule)', '+ ' + fmt(r.lumpSumTax), 'income', 'b7retirement'));
  /* QR9a: the s12T(7) excess charge is in r.balance/r.totalTaxYear beside
     the lump-sum tax (02-core.js calcTfiCharge) — shown so the lines cast. */
  const _tfiCharge = tfiChargeForActiveYear().charge;
  if(_tfiCharge > 0) lines.push(navLine('Plus: Tax-free investment excess (s12T(7))', '+ ' + fmt(_tfiCharge), 'income', 'b2investment'));
  if(r.lumpSumWithheld > 0) lines.push(navLine('Less: Tax Withheld by Fund (4115/directive)', '\u2212 ' + fmt(r.lumpSumWithheld), 'income', 'b7retirement'));
  lines.push('<div class="sum-line divider total ' + (isR?'refund':isO?'owing':'') + '"><span class="lbl">' + (isR?'REFUND DUE':isO?'AMOUNT OWING':'BALANCE') + '</span><span class="val">' + (isR?'('+fmt(Math.abs(r.balance))+')':fmt(r.balance)) + '</span></div>');
  lines.push('<div class="u-text-center-mt-12"><div class="result-badge ' + (isR?'refund':isO?'owing':'balanced') + '"><i class="' + iconClassFor(isR?'arrow_downward':isO?'arrow_upward':'check') + '"></i> ' + (isR?'Refund: '+fmt(Math.abs(r.balance)):isO?'Owing: '+fmt(r.balance):'Tax position is balanced') + '</div></div>');
  /* RR (v8.9.1) + W11: lump-sum detail card \u2014 tax due now feeds the balance above */
  if(r.lumpSumGross > 0) {
    const _taxFreeBand = getFact('retirementLumpSum.0.max');
    const _cumOpen = r.cumPoolOpening || 0;
    const _cumClose = _cumOpen + r.lumpSumGross - (r.s10cUsed || 0);
    const _taxFreeUsed = Math.max(0, Math.min(_taxFreeBand, _cumClose) - Math.max(0, _cumOpen));
    lines.push('<div class="sum-line divider" style="margin-top:14px"><span class="lbl"><strong>Retirement lump sums (Second Schedule)</strong></span><span class="val"></span></div>');
    lines.push('<div class="sum-line"><span class="lbl">Gross lump sums (this year)</span><span class="val">' + fmt(r.lumpSumGross) + '</span></div>');
    if(r.s10cUsed > 0) lines.push('<div class="sum-line"><span class="lbl">Less: non-deducted contributions relief applied</span><span class="val">\u2212 ' + fmt(r.s10cUsed) + '</span></div>');
    if(_taxFreeUsed > 0) lines.push('<div class="sum-line"><span class="lbl">Of which: tax-free (0% \u2014 first ' + fmt(_taxFreeBand) + ' lifetime)</span><span class="val" style="color:var(--ok)">' + fmt(_taxFreeUsed) + '</span></div>');
    lines.push('<div class="sum-line"><span class="lbl">Tax on lump sums (lifetime-cumulative tables)</span><span class="val">' + fmt(r.lumpSumTax) + '</span></div>');
    if(r.lumpSumWithheld > 0) lines.push('<div class="sum-line"><span class="lbl">Less: tax withheld by fund (4115/directive)</span><span class="val">\u2212 ' + fmt(r.lumpSumWithheld) + '</span></div>');
    lines.push('<div class="sum-line divider total"><span class="lbl">Net lump sum received</span><span class="val">' + fmt(r.lumpSumGross - r.lumpSumTax) + '</span></div>');
    lines.push(noteHtml(r.lumpSumWithheld > 0 && r.payeDeducted > 0 ? 'warning' : 'info',
      'Total tax for the year incl. lump sums: ' + fmt(r.totalTaxYear) + '.' + (r.lumpSumWithheld > 0 && r.payeDeducted > 0 ? ' Check PAYE excludes 4115.' : ''),
      'Lump-sum tax and any tax already withheld by the fund under its SARS directive are folded into the BALANCE above, the same way PAYE is. Combined tax for the year (income tax + lump-sum tax' + (_tfiCharge > 0 ? ' + tax-free investment excess' : '') + '): <strong>' + fmt(r.totalTaxYear) + '</strong>.' + (r.s10cRemaining > 0 ? ' Non-deducted contributions balance remaining to carry forward: '+fmt(r.s10cRemaining)+'.' : '') + (r.lumpSumWithheld > 0 && r.payeDeducted > 0 ? ' <strong>Please confirm your PAYE amount above excludes the code 4115 / directive amount shown on the same certificate</strong> \u2014 it must not be counted twice.' : ''),
      { style: 'margin-top:8px', title: 'Lump sums in your balance' }));
  }
  el.innerHTML = lines.join('');
}


export function renderITR12(r) {
  const el = $('itr12-output'); if(!el) return;
  const ty = r.ty; const ref = gs('p_taxref');
  const NL = '\n';
  let o = '';
  o += '\u2550'.repeat(42) + NL;
  o += '  InspiredTax \u2014 ITR12 REFERENCE SUMMARY' + NL;
  o += '  Tax Year: ' + ty.label + ' (' + ty.period + ')' + NL;
  if(ref) o += '  SARS Tax Ref: ' + ref + NL;
  o += '  Generated: ' + new Date().toLocaleDateString('en-ZA') + NL;
  o += '\u2550'.repeat(42) + NL + NL;
  o += 'A \u2014 INCOME' + NL;
  APP.incomeItems.forEach(i => { o += '  ' + i.code + '  ' + i.name.substring(0,33).padEnd(33) + ' ' + fmt(i.amount).padStart(14) + NL; });
  /* V8.9 B5.3: non-IRP5 taxable income now in the base — itemise so GROSS INCOME reconciles */
  if(r.rentalIncome > 0)     o += '  4210  Net rental income'.padEnd(42) + fmt(r.rentalIncome).padStart(14) + NL;
  if(r.businessIncome > 0)   o += '  4222  Business / trade income (net)'.padEnd(42) + fmt(r.businessIncome).padStart(14) + NL;
  if(r.investmentIncome > 0) o += '  4201  Investment income (taxable)'.padEnd(42) + fmt(r.investmentIncome).padStart(14) + NL;
  if(r.cgtTaxableGain > 0)   o += '  4250  Taxable capital gain'.padEnd(42) + fmt(r.cgtTaxableGain).padStart(14) + NL;
  var _itrOther = (r.otherReceiptsIncome || 0) + (r.cryptoRevenue || 0);
  if(_itrOther > 0)          o += '  4214  Other taxable income'.padEnd(42) + fmt(_itrOther).padStart(14) + NL;
  o += '  ' + '\u2500'.repeat(52) + NL;
  o += '  GROSS INCOME' + ' '.repeat(27) + fmt(r.adjGross).padStart(14) + NL;
  o += 'B \u2014 DEDUCTIONS' + NL;
  /* V8.6 G3: only show retirement + donations lines when applied amount > 0 */
  if(r.retAllowed > 0) o += '  Retirement (s11F)' + ' '.repeat(22) + fmt(r.retAllowed).padStart(14) + NL;
  if(r.travelDed > 0) o += '  Travel (s8(1)(b))' + ' '.repeat(22) + fmt(r.travelDed).padStart(14) + NL;
  if(r.homeOfficeDed > 0) o += '  Home Office (s23(b))' + ' '.repeat(19) + fmt(r.homeOfficeDed).padStart(14) + NL;
  if(r.toolsDed > 0) o += '  Tools & Equipment (s11(e))' + ' '.repeat(13) + fmt(r.toolsDed).padStart(14) + NL;
  if(r.donAllowed > 0) o += '  Donations (s18A)' + ' '.repeat(23) + fmt(r.donAllowed).padStart(14) + NL;
  o += '  ' + '\u2500'.repeat(52) + NL;
  o += '  TAXABLE INCOME' + ' '.repeat(25) + fmt(r.taxableIncome).padStart(14) + NL + NL;
  o += 'C \u2014 TAX COMPUTATION' + NL;
  o += '  Tax on Income' + ' '.repeat(26) + fmt(r.taxOnIncome).padStart(14) + NL;
  o += '  Less: Rebates' + ' '.repeat(26) + fmt(r.rebates).padStart(14) + NL;
  if(r.med && r.med.total > 0) o += '  Less: Medical Credits' + ' '.repeat(18) + fmt(r.med.total).padStart(14) + NL;
  if(r.ftc > 0) o += '  Less: Foreign Tax Credit (s6quat)'.padEnd(42) + fmt(r.ftc).padStart(14) + NL;
  o += '  ' + '\u2500'.repeat(52) + NL;
  o += '  TAX PAYABLE' + ' '.repeat(28) + fmt(r.taxPayable).padStart(14) + NL;
  o += '  Less: PAYE Paid' + ' '.repeat(24) + fmt(r.payeDeducted).padStart(14) + NL;
  /* S2 Batch 7: this summary had no lump-sum lines at all, so its own
     arithmetic (TAX PAYABLE \u2212 PAYE Paid) never reconciled to the BALANCE
     line below whenever a lump sum or two-pot withdrawal existed \u2014 same
     defect class as B1/the reward card composition line, mirroring the
     pattern already correct in renderTaxReturn()'s own on-screen version
     just above (lines ~645-646). */
  if(r.lumpSumTax > 0) o += '  Plus: Lump-Sum Tax Due' + ' '.repeat(17) + fmt(r.lumpSumTax).padStart(14) + NL;
  const _tfiChargeTxt = tfiChargeForActiveYear().charge;   // QR9a, as on screen
  if(_tfiChargeTxt > 0) o += '  Plus: TFI excess (s12T(7))'.padEnd(41) + fmt(_tfiChargeTxt).padStart(14) + NL;
  if(r.lumpSumWithheld > 0) o += '  Less: Tax Withheld by Fund' + ' '.repeat(13) + fmt(r.lumpSumWithheld).padStart(14) + NL;
  o += '  ' + '\u2550'.repeat(52) + NL;
  o += '  ' + (r.balance<0?'REFUND DUE':'AMOUNT OWING') + ' '.repeat(r.balance<0?29:28) + fmt(Math.abs(r.balance)).padStart(14) + NL;
  el.textContent = o;
}

/* 6.11 (OWNER-DECISIONS-2026-09, refining decision 1.3) — fmt() emits U+00A0
   as its grouping separator so an amount can never wrap mid-number on screen
   (STD-NUM-1, Batch 1). That is right for DISPLAY and wrong for a file: the
   .txt export and the clipboard both carry those non-breaking spaces into
   spreadsheets and SARS eFiling fields, where they arrive as stray
   characters rather than spaces. The CSV and JSON export paths were already
   clean, which is why only these two are normalised here.

   The owner's decision is explicit that DISPLAY is unchanged, so this reads
   the rendered node and normalises on the way OUT rather than changing fmt()
   — one helper shared by both exit paths, so they cannot drift. */
function _itr12PlainText() {
  const el = $('itr12-output');
  return (el ? el.textContent : '').replace(/\u00a0/g, ' ');
}

export function exportITR12() {
  if (!entUnlocked('export.itr12')) return entOnLockedTap('export.itr12');  // monetization M2 (00-DESIGN §4)
  /* Routed through the _downloadBlob platform adapter (native share sheet
     under Capacitor; anchor download in a browser) — this was the one
     hand-rolled anchor path outside the adapter. */
  const content = _itr12PlainText();
  /* BACKLOG 72: the adapter no longer toasts its own failures, so say it here. */
  _downloadBlob(new Blob([content], {type:'text/plain'}), `ITR12_${gs('taxYear')}_${APP.user||'export'}.txt`)
    .catch(e => { console.error('exportITR12:', e); showToast('Export failed — please try again', 'error', 'error'); });
  showToast('Export started');
}
export function copyITR12() {
  if (!entUnlocked('export.itr12')) return entOnLockedTap('export.itr12');  // monetization M2 (00-DESIGN §4)
  /* Async clipboard can reject in a WebView (permission/focus); fall back to
     a hidden textarea + execCommand, and say so if both paths fail. */
  const text = _itr12PlainText();      // 6.11 — see _itr12PlainText above
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      showToast(ok ? 'Copied to clipboard' : 'Copy failed — long-press the text to copy', ok ? 'check_circle' : 'error');
    } catch (e) {
      showToast('Copy failed — long-press the text to copy', 'error');
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard')).catch(fallback);
  } else {
    fallback();
  }
}

export function renderBreakdownChart(r) {
  const ctx = $('breakdown-chart'); if(!ctx) return;
  if(APP.charts.breakdown) APP.charts.breakdown.destroy();
  const takeHome = Math.max(0, r.adjGross - r.taxPayable);
  APP.charts.breakdown = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Take-Home','Tax Payable','Retirement','Other Deductions','Medical Credit','Donations'],
      datasets: [{
        data: [takeHome, r.taxPayable, r.retAllowed, r.otherDed+r.additionalDed, r.med.total, r.donAllowed],
        /* Category palette, read live so the chart follows the theme (§5.2). */
        backgroundColor: [cssColour('--cyan','#1ADDE3'), cssColour('--red','#FF5C7A'),
                          cssColour('--amber','#F2A32B'), cssColour('--violet','#9B7BFF'),
                          cssColour('--mint','#5DF2B8'), cssColour('--blue','#4B87FF')],
        borderWidth: 0
      }]
    },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: {position:'bottom', labels:{color:cssColour('--dim','#7aaad4'), font:{family:"'Inter'"}, padding:10, boxWidth:12}},
        tooltip: {callbacks:{label:c => c.label+': '+fmt(c.raw)}}
      }
    }
  });
}

/* ── RISK ASSESSMENT ── */
export function renderRiskAssessment() {
  const el = $('risk-output'); if(!el) return;
  const r = calcFullTax();
  const gross = r.adjGross;
  const totalDed = r.retAllowed + r.otherDed + r.donAllowed + r.additionalDed;
  const items = []; let score = 0, maxScore = 0;

  function addRisk(label, display, threshold, level, explain, fix, weight) {
    maxScore += weight;
    if(level === 'high') score += weight;
    else if(level === 'medium') score += weight * 0.5;
    items.push({label, display, threshold, level, explain, fix});
  }

  // 1 Total deductions %
  const dedPct = gross > 0 ? totalDed / gross : 0;
  addRisk('Total deductions as % of gross', (dedPct*100).toFixed(1)+'%', '<28%', dedPct > 0.40 ? 'high' : dedPct > 0.28 ? 'medium' : 'low',
    'SARS uses total deductions as a primary automated filter.','Ensure all deductions are trade-related and documented.', 3);

  // 2 Home office area
  const hoArea = gv('ho_area_office'), hoTotal = gv('ho_area_total');
  if(hoArea > 0 && hoTotal > 0 && APP.dedChecks.homeoffice) {
    const ar = hoArea / hoTotal;
    addRisk('Home office area ratio', (ar*100).toFixed(1)+'%', '\u226420%', ar > 0.35 ? 'high' : ar > 0.20 ? 'medium' : 'low',
      'Claims above 20% attract verification.','Measure accurately and photograph.', 3);
  }

  // 3 Home office >50% qualifying gate (v8.17: Yes/No, no longer days-based)
  if(APP.dedChecks.homeoffice) {
    var _over50 = (gs('ho_over50') || 'yes') === 'yes';
    if(!_over50) {
      addRisk('Home office >50% duties test', 'Not met', 'Required', 'high',
        'You indicated 50% or less of your duties are performed in the home office \u2014 the s23(b) deduction does not qualify.','Only claim if more than 50% of duties are performed there.', 2);
    }
  }

  // 4 Business km
  const busKm = gv('tv_bus_km'), totalKm = Math.max(1, gv('tv_odo_close') - gv('tv_odo_open'));
  if(busKm > 0 && APP.dedChecks.travel) {
    const bp = busKm / totalKm;
    addRisk('Business km %', (bp*100).toFixed(1)+'%', '\u226470%', bp > 0.85 ? 'high' : bp > 0.70 ? 'medium' : 'low',
      'Claims above 85% are a known SARS flag.','Maintain detailed contemporaneous logbook.', 3);
  }

  // 5 Travel deduction vs allowance pool (3701+3702+3722)
  if(APP.dedChecks.travel && r.travelDed > 0) {
    var _riskItems = APP.incomeItems || [];
    var allow = _riskItems.filter(function(i){ return i.code==='3701'||i.code==='3702'||i.code==='3722'; })
                           .reduce(function(s,i){ return s+(i.amount||0); }, 0);
    if(allow > 0) {
      const tp = r.travelDed / allow;
      addRisk('Travel deduction vs allowance', (tp*100).toFixed(0)+'%', '<50%', tp > 0.80 ? 'high' : tp > 0.50 ? 'medium' : 'low',
        'High deduction relative to allowance may be queried.','Ensure logbook supports claimed business km.', 2);
    }
  }

  // 6 Donations
  if(r.donAllowed > 0) {
    /* BACKLOG 25: the engine's own s18A cap (r.donMax — on taxable income
       BEFORE donations), not taxableIncome × 0.10, which is after them. */
    const cap = r.donMax || 0;
    if(cap > 0) {
      const dp = r.donAllowed / cap;
      addRisk('Donations near ' + r.ty.donationPct + '% cap', (dp*100).toFixed(0)+'% of cap', '<50%', dp > 0.90 ? 'high' : dp > 0.50 ? 'medium' : 'low',
        'Donations at/near cap attract queries.','Retain all s18A receipts.', 2);
    }
  }

  // 7 Single client (80/20)
  /* 2026-09 (Atlas F9): this tested five pre-taxonomy values — freelancer,
     contractor, sole_prop, commission_fee, self_employment — which the Batch G
     migration retired, so the rule could never fire. It is the SARS test for a
     contractor who looks like a disguised employee, one of the more consequential
     reclassification risks the app can warn about, and it was silent.
     business_income covers all five; other_income can be a single-client
     trade too. */
  const incTypes = getSelectedIncomeTypes();
  if(incTypes.includes('business_income') || incTypes.includes('other_income')) {
    const singleClient = APP.incomeItems.length > 0 && APP.incomeItems.length <= 1;
    addRisk('Single income source (80/20 rule)', singleClient ? 'Single client' : 'Multiple', 'Multiple',
      singleClient ? 'high' : 'low','SARS may reclassify as employment.','Ensure genuine independent operation.', 3);
  }

  // 8 Provisional adequacy (§5 H-4 fix: para 20 logic, TI-bucket aware)
  if(gs('p_provisional') === 'yes') {
    const provTotal = gv('p_prov_p1') + gv('p_prov_p2') + gv('p_prov_topup');
    if(r.taxPayable > 0 && provTotal > 0) {
      const pp = calcProvisionalPenalty(r);
      if (pp.safeHarbour === 'basic_amount') {
        addRisk('Provisional tax adequacy', 'Basic-amount safe harbour', 'OK', 'low',
          'Estimate is at or below your basic amount. Para 20 penalty does not apply.',
          'No action required.', 1);
      } else {
        const pctOfLiab = (provTotal / r.taxPayable * 100).toFixed(0);
        const thresholdLabel = pp.isHighIncome ? '\u226580%' : '\u226590%';
        // Dynamic threshold label (R1m / R1.8m, etc.)
        const thresholdM = pp.para20Threshold / 1e6;
        const thresholdShort = thresholdM === Math.floor(thresholdM)
          ? `R${thresholdM.toFixed(0)}m` : `R${thresholdM.toFixed(1)}m`;
        // Severity: triggered=high; close-to-required (>=95% of requiredPayment)=low; else medium.
        // Use totalPaid (PAYE + Provisional) since the para 20 test counts both per IN1.
        const severity = pp.triggered
          ? 'high'
          : (pp.requiredPayment > 0 && pp.totalPaid / pp.requiredPayment >= 0.95)
            ? 'low'
            : 'medium';
        const note = (pp.isHighIncome
          ? `TI > ${thresholdShort}: 80% threshold; basic amount does not apply.`
          : `TI \u2264 ${thresholdShort}: 90% threshold OR basic-amount safe harbour.`)
          + ' This estimate is modelled on amounts you have actually PAID (PAYE + provisional payments) \u2014 the statutory para 20 trigger is your second-period IRP6 ESTIMATE, which may differ from what you end up paying.';
        const action = pp.triggered
          ? `Top up before 28 Feb. Estimated penalty ${fmt(pp.penalty)}.`
          : 'Monitor provisional adequacy before 28 Feb.';
        addRisk('Provisional tax adequacy', `${pctOfLiab}% (${pp.isHighIncome?'>'+thresholdShort:'\u2264'+thresholdShort})`, thresholdLabel, severity, note, action, 3);
      }
    }
  }

  // 9 Large refund
  const refCur = gv('py_refund_current');
  if(refCur > 50000) {
    addRisk('Large SARS refund', fmt(refCur), '<R50,000', refCur > 100000 ? 'high' : 'medium',
      'Refunds >R50k trigger s74C verification.','Have all supporting documents ready.', 2);
  }

  // 10 Outstanding liabilities
  const owed = gv('py_owed') + gv('py_unsubmitted');
  if(owed > 0) {
    addRisk('Outstanding SARS liabilities', fmt(owed), 'R 0.00', 'high',
      'Outstanding debts increase enforcement risk.','Address immediately. Consider VDP.', 3);
  }

  // 11 Medical OOP
  if(APP.dedChecks.medical) {
    const oop = gv('med_oop');
    if(oop > 30000) {
      addRisk('Out-of-pocket medical expenses', fmt(oop), '<R30,000', oop > 80000 ? 'high' : 'medium',
        'High OOP claims attract verification.','Keep all receipts for 5 years.', 2);
    }
  }

  // 12 Tools vs gross
  if(APP.dedChecks.tools) {
    const toolsVal = APP.appliedValues.tools || 0;
    if(toolsVal > 0 && gross > 0) {
      const tp = toolsVal / gross;
      addRisk('Tools & equipment vs gross', (tp*100).toFixed(1)+'%', '<10%', tp > 0.15 ? 'high' : tp > 0.10 ? 'medium' : 'low',
        'High equipment claims need strong trade justification.','Keep purchase invoices for 5 years.', 2);
    }
  }

  // 13 Rental expenses
  if(APP.rentalProperties.length > 0) {
    let totInc=0, totExp=0;
    APP.rentalProperties.forEach(p => { const rr=calcRentalNet(p); totInc+=rr.income; totExp+=rr.totalExpenses; });
    if(totInc > 0) {
      const ep = totExp / totInc;
      addRisk('Rental expenses vs income', (ep*100).toFixed(0)+'%', '<80%', totExp > totInc ? 'high' : ep > 0.80 ? 'medium' : 'low',
        'High expense ratios or losses attract scrutiny.','Ensure only property-related expenses claimed.', 2);
    }
  }

  // 14 CGT primary residence
  /* 2026-09 (Atlas F9): was gated on APP.dedChecks.cgt, which is never assigned
     — CGT stopped being a deduction in V8.5 Session 5 and became bucket 5, so no
     such dedChecks key exists. A captured primary-residence asset is the whole
     trigger, and it is already tested here. */
  if(APP.cgtAssets.some(a => a.primaryRes)) {
    const _pre = getFact('cgt.primaryResExcl');
    addRisk('CGT primary residence exclusion', 'Claimed', 'Document occupation', 'medium',
      'The exclusion (up to R' + _pre.toLocaleString('en-ZA') + ' this year) applies for periods the property was ordinarily resided in and used mainly for domestic purposes — not a fixed occupancy period. Non-residential or let periods are apportioned (para 46/49).',
      'Keep proof of the periods you actually lived there — municipal accounts, occupancy dates, and any periods it was let or used for trade.', 2);
  }

  // 15 Interest discrepancy
  /* 2026-09 (Atlas F9): was gated on APP.dedChecks.interest, which is never
     assigned — interest stopped being a deduction in V8.5 Session 5 and became
     bucket 2. It also only read gv('int_gross'), the self-declared fallback,
     so a filer who captured IT3(b) certificates (the normal path, and the one
     SARS actually cross-references) was never checked. Read the certificates
     first and fall back to the manual figure. */
  const _localInterest = (APP.it3bItems && APP.it3bItems.length)
    ? taxableIt3bItems().reduce(function(t, i){ return t + (i.localInterest||0) + (i.sarsInterest||0); }, 0)
    : gv('int_gross');
  if(_localInterest > 50000) {
    addRisk('High interest income', fmt(_localInterest), '<R50,000', 'medium',
      'SARS cross-references via IT3(b) from banks.','Ensure declared amount matches certificates.', 2);
  }

  // 16 First-time home office
  if(APP.dedChecks.homeoffice) {
    addRisk('Home office claim', 'Active', '\u2014', 'medium',
      'First-time home office claims have high verification likelihood.','Prepare floor plan, photos, employer letter.', 1);
  }

  // RISK-4 (OD-32, confirmed): the RA-excess carve-out. A disallowed
  // retirement-contribution balance carried forward is no longer flagged as
  // audit risk on its own — it signals a PRIOR year's cap breach, already
  // resolved by that year's assessment, not this year's return. Removed
  // with its weight-2 contribution to `maxScore` (via addRisk, above), so
  // other users' HIGH/MEDIUM/LOW banner doesn't silently shift for an
  // unrelated reason (OD-32). The two adjacent retirement risk rules below
  // — manual 4006 entry, and contributions >35% of income — are NOT part of
  // this carve-out and stay in place.

  // V8.4 VI.3b: 4006 manually entered or differing from IT3(f) → audit risk
  // Heuristic: when ded_ra is non-zero AND no IRP5 retirement codes (3816/3817/3825/3828) present,
  // assume manual entry → flag for verification against IT3(f) certificate.
  const dedRa = gv('ded_ra');
  if(dedRa > 0) {
    const hasIrp5Retirement = (APP.incomeItems || []).some(i => ['3817','3825','3828'].includes(i.code));
    if(!hasIrp5Retirement) {
      addRisk('Manual RA contribution (4006)', fmt(dedRa), 'IT3(f) match', 'medium',
        'You have entered a Retirement Annuity contribution (code 4006) without a corresponding employer fringe-benefit code on your IRP5. SARS will verify against the IT3(f) certificate from your financial institution.',
        'Ensure the amount entered matches your IT3(f) certificate exactly. Retain the certificate for 5 years.', 2);
    }
  }

  // V8.4 VI.1b risk amplifier: contributions > 35% of gross income → high audit risk
  const totRetCur = gv('ded_pension') + gv('ded_provident') + gv('ded_ra');
  const grossNet = (gross || 0) - (r.lumpSumTotal || 0);
  if(totRetCur > 0 && grossNet > 0) {
    const pctG = totRetCur / grossNet;
    if(pctG > 0.35) {
      addRisk('Retirement contributions vs income', (pctG*100).toFixed(1)+'%', '\u226435%', 'high',
        'Retirement contributions above 35% of gross income (net of lump sums) are highly unusual and almost always trigger SARS verification.',
        'Verify the entered amounts match your IRP5 / IT3(f) certificates. Consider whether amounts include erroneous duplicates.', 3);
    }
  }

  // Render
  const pct2 = maxScore > 0 ? score / maxScore : 0;
  const riskLevel = pct2 > 0.60 ? 'high' : pct2 > 0.30 ? 'medium' : 'low';
  const riskLabel = pct2 > 0.60 ? 'HIGH' : pct2 > 0.30 ? 'MEDIUM' : 'LOW';
  const riskDesc = pct2 > 0.60 ? 'Multiple indicators triggered. Review all flagged items.' : pct2 > 0.30 ? 'Some indicators need attention.' : 'No significant risk indicators.';
  const riskIcon = pct2 > 0.60 ? 'warning' : pct2 > 0.30 ? 'error' : 'check_circle';
  const barCol = pct2 > 0.60 ? 'var(--er)' : pct2 > 0.30 ? 'var(--wa)' : 'var(--ok)';

  el.innerHTML = `
    <div class="risk-banner ${riskLevel}">
      <div class="risk-banner-label"><i class="${iconClassFor(riskIcon)}"></i> ${riskLabel}</div>
      <div class="risk-banner-desc">${riskDesc}</div>
      <div class="risk-score-track"><div class="risk-score-fill" style="width:${Math.min(100,pct2*100).toFixed(0)}%;background:${barCol}"></div></div>
    </div>
    ${items.map(it => `
      <div class="risk-item">
        <div class="risk-item-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <span class="risk-dot ${it.level}"></span>
          <span class="risk-item-label">${esc(it.label)}</span>
          <span class="risk-item-value">${esc(it.display)}</span>
        </div>
        <div class="risk-item-body">
          <!-- 2026-09 (Atlas F10): these four fields go through innerHTML and were
               not escaped. Thresholds are written as comparisons, so three of them
               ("<R50,000" twice, "<R30,000") had a '<' followed by a LETTER — which
               the parser reads as the start of a tag and swallows, leaving the row
               blank. The digit-led ones ("<28%", "<50%") survived, which is why it
               looked like a data problem rather than an escaping one. None of these
               strings carries intentional markup, so all four are escaped. -->
          <div class="risk-threshold">Threshold: <strong>${esc(it.threshold)}</strong></div>
          <div class="risk-explain">${esc(it.explain)}</div>
          <div class="risk-fix"><i class="material-symbols-outlined msi-lightbulb" style="color:var(--au);margin-right:5px"></i>${esc(it.fix)}</div>
        </div>
      </div>`).join('')}`;
}

/* ── ACT REFERENCES ── */
export function renderActRefInline() {
  const el = $('actref-inline-content'); if(!el) return;
  const ty = getActiveTaxYear();
  el.innerHTML = ACT_REFERENCES.map((s,i) =>
    `<div class="act-ref-item">
      <div class="act-ref-header" onclick="toggleActRefItemInline(${i})" id="act-ref-inline-hdr-${i}">
        <div class="act-ref-header-left">
          <span class="act-ref-section-code">${s.code}</span>
          <span class="act-ref-section-name">${s.name}</span>
        </div>
        <i class="material-symbols-outlined msi-expand-more" style="color:var(--tx3);font-size:0.6875rem;transition:transform .18s"></i>
      </div>
      <div class="act-ref-body" id="act-ref-inline-body-${i}">${s.content}</div>
    </div>`
).join('');
  // Populate rates info + statutory values (previously only the hidden legacy
  // overlay copy was populated because its duplicate ref-* ids came first in
  // the DOM; with the overlay removed the visible copies get the live values)
  renderRatesInfo($('rates-info-inline'));
  populateActRefValues(ty);
}
export function populateActRefValues(ty) {
  const set = (id, val) => { const e=$(id); if(e) e.textContent=val; };
  set('ref-primary-rebate', fmt(ty.rebates.primary));
  set('ref-secondary-rebate', fmt(ty.rebates.secondary));
  set('ref-tertiary-rebate', fmt(ty.rebates.tertiary));
  set('ref-med-main', fmt(ty.medical.main));
  set('ref-med-d1', fmt(ty.medical.firstDep));
  set('ref-med-dn', fmt(ty.medical.addDep));
  set('ref-int-u65', fmt(ty.interest.under65));
  set('ref-int-o65', fmt(ty.interest.age65));
  set('ref-ret-cap', fmt(ty.retirement.cap));
  if(ty.tfsa) { set('ref-tfsa-annual', fmt(ty.tfsa.annual)); set('ref-tfsa-life', fmt(ty.tfsa.lifetime)); }
  set('ref-cgt-incl', (ty.cgt.inclusion*100).toFixed(0)+'%');
  set('ref-cgt-excl', fmt(ty.cgt.annualExcl));
  set('ref-cgt-primres', fmt(ty.cgt.primaryResExcl));
}
export function renderRatesInfo(el) {
  if(!el) return;
  const ty = getActiveTaxYear(); const age = calcAgeAtYearEnd();
  let cat = 'Under 65', thr = ty.thresholds.under65;
  if(age >= 75) { cat = 'Age 75+'; thr = ty.thresholds.age75; }
  else if(age >= 65) { cat = 'Age 65\u201374'; thr = ty.thresholds.age65; }
  const reb = calcRebates(age, ty);
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.78125rem;color:var(--tx2);line-height:1.9">
    <div><strong class="u-c-tx">Period:</strong> ${ty.period}</div>
    <div><strong class="u-c-tx">Age:</strong> ${cat}</div>
    <div><strong class="u-c-tx">Threshold:</strong> ${fmt(thr)}</div>
    <div><strong class="u-c-tx">Rebates:</strong> ${fmt(reb)}</div>
    <div><strong class="u-c-tx">Retirement Cap:</strong> 27.5% / ${fmt(ty.retirement.cap)}</div>
    <div><strong class="u-c-tx">Interest Exemption:</strong> ${fmt(age>=65?ty.interest.age65:ty.interest.under65)}</div>
    <div><strong class="u-c-tx">CGT:</strong> ${(ty.cgt.inclusion*100).toFixed(0)}% incl. / ${fmt(ty.cgt.annualExcl)} excl.</div>
  </div>`;
}
export function toggleActRefItemInline(i) {
  const body = $(`act-ref-inline-body-${i}`); const hdr = $(`act-ref-inline-hdr-${i}`);
  const open = body.classList.toggle('open');
  hdr.classList.toggle('open', open);
  hdr.querySelector('i').style.transform = open ? 'rotate(180deg)' : '';
}


