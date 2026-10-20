import { TAX_YEARS, getFact, toggleFaqModule, PAGE_HELP, FIELD_TIPS, CONDITIONAL_Q_TEXT, TRADE_INCOME_TYPES, msIconHtml, SCENARIO_QUESTIONS } from './01-data.js';
import { cloudBackupDeleteRequested, renderCloudDeleteOffer, cloudBackupPauseAfterReset } from './18-cloud-backup-ui.js';
import { noteHtml, parseFmt, checkedValues, foreignLayersHtml, scenarioQuestionApplies, plausibilityHtml, plausibilityNotes, captureNav, navigateToCapture, $, APP, TIP_TRIGGER_SEL, _downloadBlob, applyDeduction, calcFullTax, SK, restoreData, writeLocalBackupSnapshot, closeModal, closeOutTaxYear, computeCarryForwardForNextYear, esc, flashSaved, fmt, getActiveTaxYear, getSelectedIncomeTypes, gs, gv, hasPendingChanges, hasTaxYearData, hasUnappliedEdits, initAutoApply, initTipBubble, navigateTo, nextTaxYearKey, openModal, persistData, showChoice, showConfirm, showToast, startApp, sv, toggleDrawerGroup, updateCalc, updatePendingIndicators, restoreInputs, snapshotInputs, iconClassFor } from './02-core.js';
import { calcForeignSubsistence, calcSubsistence, calcTravel, renderMedicalCreditsDisplay, updateTravelAcqNote } from './04-deductions.js';
import { renderAll, renderTaxReturn } from './07-render-summary.js';
import { obComplete, showOnboarding, OB } from './12-bootstrap-onboarding.js';

/* ══════════════════════════════════════════════════════════════════
   V8.6 BATCH 1 — JavaScript additions
   ══════════════════════════════════════════════════════════════════ */

/* A3 + A3.1 + A3.2: Rand-rounding utility ─────────────────────────── */
export function round(val) {
  if (val == null || val === '' || isNaN(val)) return 0;
  // Round half-up to nearest whole rand
  const n = Number(val);
  return n >= 0 ? Math.floor(n + 0.5) : -Math.floor(-n + 0.5);
}


/* Round on input blur — applied to all number inputs */
export function attachInputRounding() {
  document.body.addEventListener('blur', (e) => {
    if (e.target && e.target.matches('input[type="number"]')) {
      const v = e.target.value;
      if (v && !isNaN(v)) {
        const rounded = round(v);
        if (String(rounded) !== v) {
          e.target.value = String(rounded);
          e.target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  }, true);
}


/* NOTE: the V8.6 "appliedInputs" machinery (gv/gs proxy + calcFullTax wrapper +
   per-type DOM snapshots) has been fully retired. The window-level proxy was
   never consulted (all call sites use the lexical const gv/gs), so the snapshot
   store was written but never read. The "no propagation until Apply" rule is
   enforced by APP.appliedValues / pendingValues. Stale appliedInputs keys in
   previously-persisted user data are ignored harmlessly. */

/* Patched applyDeduction — acknowledgment gates + snapshot for the deduction type.
   The K3.3 medical-dependents and N16.4 business-km gates live HERE (the one
   live wrapper) so they actually block Apply; their former standalone
   window.applyDeduction reassignments were overwritten at boot and never ran. */
/* Batch A (UX #7): the old Apply-button acknowledgment gates (K3.3 medical
   dependents ≥10, N16.4 business-km ≥85%) lived here to block the Apply press.
   With save-as-you-go there is no Apply button — the high-risk warnings still
   render inline in the calculator card (with their acknowledgment checkboxes),
   so the wrapper is now a thin pass-through and subscrip pending is
   sourced in applyDeduction itself. */
export const originalApplyDeduction = typeof applyDeduction === 'function' ? applyDeduction : null;
export function applyDeductionWrapper(type) {
  if (originalApplyDeduction) return originalApplyDeduction(type);
}

/* Install the applyDeduction wrapper + wire the save-as-you-go auto-commit. */
export function installProxies() {
  if (originalApplyDeduction) {
    window.applyDeduction = applyDeductionWrapper;
  }
  if (typeof initAutoApply === 'function') initAutoApply();
}

/* A1: Amber "Unapplied changes" dirty banner — RETIRED in Batch A (UX #7).
   Save-as-you-go means there are never unapplied changes, so this is a no-op
   that also clears any banner a previously-persisted DOM might still carry. */
export function renderDirtyBanner(type, container) {
  if (!container) return;
  const banner = container.querySelector('.dirty-banner');
  if (banner) banner.classList.remove('active');
}

/* Hook into render cycle: after each tab render, check + render dirty banner */
export function updateAllDirtyBanners() {
  const types = ['retirement','medical','travel','homeoffice','interest','tools','cgt','rental','donations','subscrip','subsistence'];
  types.forEach(t => {
    const tab = document.getElementById('tab-ded-' + t);
    if (tab) renderDirtyBanner(t, tab);
  });
}

/* Track current deduction subpage for navigate-away detection */
export function trackCurrentDedSub() {
  // Hook: when user navigates to a deduction tab, record it
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      const tab = tabBtn.dataset.tab;
      if (tab && tab.startsWith('ded-')) {
        APP.currentDeductionSub = tab.replace('ded-', '');
      }
    }
  }, true);
}

/* Fill every non-login mount of the brand mark from the ONE inline copy on the
   login screen. The artifact is a single file, so each additional inline
   base64 of the mark is its full weight again in the shipped HTML — at five
   separate payloads that was 242KB for one small decorative glyph.

   Login stays static markup: it is the first paint on a cold start, and it is
   the one mount that must not depend on a script having run. Everything else
   here is behind a screen the user reaches later, so copying the src at boot
   costs nothing visible and saves the duplication.

   Extends the former mountAboutLogo() (B6), which did exactly this for the
   About modal alone. Same mechanism, more mounts — not a second one. */
export function mountBrandMarks() {
  /* [target id or selector, source selector] — the source is always the login
     screen's pair, which is the only copy carrying a real src in markup. */
  [['#onboarding-overlay .tlogo-dark', '.tlogo-dark'],
   ['#onboarding-overlay .tlogo-light', '.tlogo-light'],
   ['.drawer-logo.tlogo-dark',  '.tlogo-dark'],
   ['.drawer-logo.tlogo-light', '.tlogo-light'],
   ['#app-header-logo-dark',    '.tlogo-dark'],
   ['#app-header-logo-light',   '.tlogo-light'],
   ['#about-logo-dark',         '.tlogo-dark'],
   ['#about-logo-light',        '.tlogo-light']].forEach(function(pair) {
    var source = document.querySelector(pair[1] + '[src]');
    if (!source) return;
    var src = source.getAttribute('src');
    document.querySelectorAll(pair[0]).forEach(function(target) {
      if (!target.getAttribute('src')) target.setAttribute('src', src);
    });
  });
}

/* B5 (§8 census line 5): onRaInput()/onRaVerified() and the IT3(f)
   verification block they drove are removed — the question changed no
   computed number, and its only effect was to show or hide a warning about
   whether it had been answered. The page now carries one always-on line
   instead. APP.raVerified on saved data becomes inert; nothing reads it. */

/* V8.6 K3.3 + K3.4 + K6 — medical dependents helpers */
export function onMedDepsInput() {
  const inp = document.getElementById('med_deps');
  if (!inp) return;
  /* V8.6 K6: enforce >= 1 when "have dependents" is yes */
  const hasDeps = (typeof gs === 'function') ? gs('med_has_deps') === 'yes' : false;
  if (hasDeps) {
    const v = Number(inp.value || 0);
    if (v < 1) {
      inp.value = '1';
      if (typeof showToast === 'function') showToast('At least 1 dependent required when "have dependents" is Yes.', 'error');
    }
  }
  /* Reset acknowledgment if the count changed */
  if (APP.medDepsAck && Number(inp.value || 0) !== APP.medDepsAckFor) {
    APP.medDepsAck = false;
    APP.medDepsAckFor = null;
  }
}
export function onMedDepsAck() {
  const cb = document.getElementById('med_deps_ack');
  if (!cb) return;
  const inp = document.getElementById('med_deps');
  const deps = inp ? Number(inp.value || 0) : 0;
  APP.medDepsAck = !!cb.checked;
  APP.medDepsAckFor = deps;
  if (typeof persistData === 'function') persistData();
}

/* NOTE: the K3.3 medical-dependents Apply gate formerly wrapped
   window.applyDeduction here but was overwritten at boot and never executed.
   The gate now lives inside applyDeductionWrapper (the one live wrapper) and
   actively blocks Apply until acknowledged. */

/* v8.27 cycle-2 (§5.1): the injected per-page "Back to …" buttons are gone —
   the system/hardware Back (backAction) and bottom nav own back navigation. */

/* ============================================================
   V8.75 1a — Prior Year "Unapplied changes" tracking.
   Banner shows when any py_* field differs from the last-applied
   snapshot; cleared on Apply (applyPriorYear).
   ============================================================ */
export var PY_FIELDS = ['py_loss','py_ret_excess','py_basic_amount','py_owed','py_unsubmitted','py_refund_prior','py_refund_current'];
export function pySig() {
  return PY_FIELDS.map(function (id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }).join('|');
}
export function updatePriorYearDirty() {
  /* Batch A (UX #7): prior-year changes auto-commit on blur — no dirty banner. */
  var banner = document.getElementById('py-dirty-banner');
  if (banner) banner.classList.remove('active');
}
/* Theme 8: carried-balance outstanding items — a taxpayer flagged "yes" to
   one of these on onboarding Step 7 / Profile but hasn't captured the
   amount on the SARS Account page yet. Shared by the unified Dashboard
   outstanding-items section (renderDashboardOutstanding, 08-dashboard-theme.js);
   this is the only consumer today, but exported (not inline) for the same
   reason getIncomeOutstanding/getDeductionsOutstanding are — one place that
   can't disagree with whatever else reads it later. */
/* QA 2026-08 (B2-DASH-3): "… not yet captured" is stripped from every label.
   These rows only ever appear in an OUTSTANDING list — the heading already
   says "still to add", so repeating it on each row spent the width that
   should carry the balance's name.

   Single source for the six carried-balance checks — read by
   getCarriedBalanceRows()/getCarriedBalanceOutstanding() (Dashboard) below
   AND by getCarriedBalanceStatus() (the Income → Tax balances toggle-groups
   page, 03-income.js), so the two views of "is this balance applicable /
   captured" can never fork. */
/* QA 2026-09: same glyph per kind as the onboarding review screen's
   tax-balances chips (12-bootstrap-onboarding.js obPopulateSummary) —
   assessed loss/capital losses match the Step 6 question icons, the rest
   reuse the glyph that concept already carries elsewhere in the app. */
/* QA 2026-09 round 2: retirement moved off 'savings' to 'money_bag',
   matching the onboarding Step 6/7 icon change for the same concept. */
const CARRIED_BALANCE_ICON = {
  loss: 'clock_arrow_down', capital: 'trending_down', retirement: 'money_bag',
  donations: 'volunteer_activism', lumpsum: 'paid', ftc: 'public',
};
function carriedBalanceChecks() {
  return [
    { flag:'loss',       has: gv('py_loss') > 0,                 key:'carried_loss',
      label:'Prior-year assessed loss' },
    { flag:'capital',    has: gv('cgt_loss_bf') > 0,              key:'carried_capital',
      label:'Capital losses carried forward' },
    { flag:'retirement', has: gv('py_ret_excess') > 0,            key:'carried_retirement',
      label:'Non-deducted retirement contributions' },
    { flag:'donations',  has: gv('py_s18a_excess') > 0,           key:'carried_donations',
      label:'Donations not fully deducted (excess)' },
    { flag:'lumpsum',    has: (APP.priorLumpsumTaxable || 0) > 0, key:'carried_lumpsum',
      label:'Prior lump-sum cumulative pool' },
    /* Onboarding now asks about this one (QA 2026-08). The balance itself is
       not new — s6quat(1B)(a) unused credits already had a field on the
       Foreign Income page and a row on the SARS Account page; nothing asked
       the user whether they had one, so it could only be found by accident. */
    { flag:'ftc',        has: gv('ftc_bf') > 0,                   key:'carried_ftc',
      label:'Unused foreign tax credits' },
  ];
}

export function getCarriedBalanceRows() {
  const exp = APP.expectedCarriedBalances || {};
  /* QA 2026-08 (D-9): return EVERY applicable row, each carrying whether it is
     done, rather than silently dropping the completed ones. A row is applicable
     because the user said so in onboarding/Profile; it is done once an opening
     balance exists. Dropping completed rows is what made the dashboard step
     incoherent — it could say "nothing carried forward" while a captured
     assessed loss sat right beneath it, because the heading and the rows were
     being derived from two different things.
     Balances the engine creates in-year, and balances entered on an origin page
     without ever being declared, are deliberately NOT rows: the step lists what
     the user told us to expect, not everything that exists. */
  return carriedBalanceChecks().filter(function(c) { return !!exp[c.flag]; })
               .map(function(c) { return { key: c.key, label: c.label, route: c.key, nav: captureNav(c.key), done: !!c.has,
                                            icon: CARRIED_BALANCE_ICON[c.flag] }; });
}

/* The outstanding subset, derived from the same rows so the two can never
   disagree. Every existing caller (the dashboard completeness card, its ring
   and its counts) wants outstanding-only and is unchanged by the above. */
export function getCarriedBalanceOutstanding() {
  return getCarriedBalanceRows().filter(function(r) { return !r.done; });
}

/* QA 2026-08 (§6, 12c): the Income → Tax balances toggle-groups page needs
   ALL six balances, always, bucketed off / captured / still-to-add — a wider
   view than getCarriedBalanceRows() above (which only lists what the user
   has declared applicable, for the Dashboard's narrower "what's left to
   add" step). Reads the same carriedBalanceChecks() + expectedCarriedBalances
   state rather than re-deriving "applicable"/"captured" a second way. */
export function getCarriedBalanceStatus() {
  const exp = APP.expectedCarriedBalances || {};
  return carriedBalanceChecks().map(function(c) {
    return { flag: c.flag, key: c.key, label: c.label, nav: captureNav(c.key),
      captured: !!c.has, off: exp[c.flag] === false };
  });
}

/* QA 2026-08 (§6, 12c): the two-property write-back onProfileCarriedQ()
   below already performed (carriedBalanceAnswers + expectedCarriedBalances)
   is now shared with the new toggle-groups page's own on/off handler
   (onCarriedBalanceRowToggle, 03-income.js) — one place decides what
   "answered yes/no to a carried balance" means. */
export function setCarriedBalanceAnswer(flag, value) {
  if (!APP.expectedCarriedBalances) APP.expectedCarriedBalances = {};
  if (!APP.carriedBalanceAnswers) APP.carriedBalanceAnswers = {};
  APP.carriedBalanceAnswers[flag] = value;
  APP.expectedCarriedBalances[flag] = (value !== 'no');
}

export function snapshotPriorYear() {
  APP.pySig = pySig();
  var banner = document.getElementById('py-dirty-banner');
  if (banner) banner.classList.remove('active');
}


/* V8.75 3a-e: Profile "Deductions & Allowances" questions — mirror onboarding.
   One-way auto-on of the matching deduction (user controls thereafter, like onboarding). */
export var PROFILE_DED_Q = {
  travel:      { sel:'p_q_travel',      flag:'travelAllowanceYN' },
  retirement:  { sel:'p_q_retirement',  flag:'hasRetirementYN' },
  donations:   { sel:'p_q_donations',   flag:'hasDonations' },
  homeoffice:  { sel:'p_q_homeoffice',  flag:'workFromHomeYN' },
  /* Phase 1 (G1/E1/E2): the three conditional questions, same contract. Keys
     are DEDUCTION_DEFS ids so APP.dedChecks[type] lands on the right entry. */
  subsistence: { sel:'p_q_subsistence', flag:'subsistenceYN' },
  tools:       { sel:'p_q_tools',       flag:'toolsYN' },
  subscrip:    { sel:'p_q_subscrip',    flag:'subscripYN' }
};
export function onProfileDeductionQ(type) {
  var cfg = PROFILE_DED_Q[type]; if(!cfg) return;
  var el = document.getElementById(cfg.sel); if(!el) return;
  var val = el.value;
  APP[cfg.flag] = val;
  if(!APP.dedChecks) APP.dedChecks = {};
  if(val === 'yes') {
    APP.dedChecks[type] = true;                       // one-way auto-on (matches onboarding)
    if(!APP.onboardingAutoToggled) APP.onboardingAutoToggled = {};
    APP.onboardingAutoToggled[type] = true;        // drives the "auto-enabled because…" reason note
  }
  if(typeof persistData === 'function') persistData();
  if(typeof renderAll === 'function') renderAll();
}

/* Theme 8: Profile mirror of onboarding Step 7 (carried-forward balances) —
   same bidirectional-sync pattern as PROFILE_DED_Q above, feeding the
   unified Dashboard outstanding-items list (getCarriedBalanceOutstanding,
   08-dashboard-theme.js), never the tax calculation directly. */
export var PROFILE_CARRY_Q = {
  loss:       { sel:'p_q_carry_loss' },
  capital:    { sel:'p_q_carry_capital' },
  retirement: { sel:'p_q_carry_retirement' },
  donations:  { sel:'p_q_carry_donations' },
  lumpsum:    { sel:'p_q_carry_lumpsum' },
  ftc:        { sel:'p_q_carry_ftc' }
};
export function onProfileCarriedQ(type) {
  var cfg = PROFILE_CARRY_Q[type]; if(!cfg) return;
  var el = document.getElementById(cfg.sel); if(!el) return;
  /* Binary yes/no, matching onboarding. The boolean keeps its "surface as
     outstanding" meaning — only an explicit 'no' suppresses it. */
  setCarriedBalanceAnswer(type, el.value);
  if(typeof persistData === 'function') persistData();
  if(typeof renderAll === 'function') renderAll();
}

/* ── Phase 1 (G1): Profile foreign-source question ──
   Mirrors onboarding step 2. No dedChecks entry — Foreign Income is an income
   bucket; the flag drives discoverability only (see obComplete's note). */
export function onProfileForeignQ() {
  var el = document.getElementById('p_q_foreign'); if(!el) return;
  APP.foreignIncomeYN = el.value;
  /* QR7.2 (QD-10): answering No here closes every foreign category, the
     same as onboarding's layer 1 = No; Yes keeps the stored categories (an
     empty list reads as unanswered, so nothing is hidden until one is
     ticked). Currencies survive either way. */
  var ps = APP.profileScenarios || {};
  var f = ps.foreign || {};
  if (el.value === 'no') APP.profileScenarios = Object.assign({}, ps, { foreign: { categories: [], currencies: f.currencies || [] } });
  refreshProfileScenarioQs();
  if(typeof persistData === 'function') persistData();
  if(typeof renderAll === 'function') renderAll();
}

/* ── QR7.2 (QD-23, QD-24): Profile mirror of the scenario questions ──
   Same table (SCENARIO_QUESTIONS), same applicability rule
   (scenarioQuestionApplies, 02-core) as onboarding, read against the stored
   answers. A select with a third, empty "Not answered" choice: a two-state
   toggle could not show an existing user's unanswered question truthfully
   (QD-24 — unanswered means every field is shown). */
export function refreshProfileScenarioQs() {
  var ps = APP.profileScenarios || {};
  var sel = (typeof getSelectedIncomeTypes === 'function' ? getSelectedIncomeTypes() : []) || [];
  var host = document.getElementById('p_scn_qs');
  if (host) {
    host.innerHTML = SCENARIO_QUESTIONS.filter(function(q){ return scenarioQuestionApplies(q, sel, ps); }).map(function(q){
      var v = ps[q.key] || '';
      var o = function(val, label){ return '<option value="' + val + '"' + (v === val ? ' selected' : '') + '>' + label + '</option>'; };
      return '<div class="form-group"><label class="form-label" for="p_scn_' + q.key + '">' + esc(q.text) + '</label>'
        + '<select class="form-select" id="p_scn_' + q.key + '" aria-describedby="p_scn_' + q.key + '_hint" onchange="onProfileScenarioQ(\'' + q.key + '\')">'
        + o('', 'Not answered') + o('yes', 'Yes') + o('no', 'No') + '</select>'
        + '<div class="u-c-tx3" id="p_scn_' + q.key + '_hint" style="font-size:0.6875rem;margin-top:4px">' + esc(q.gates) + '</div></div>'
        /* UI-CAP-0: the one usual share every joint item uses (owner 2026-10-05). */
        + (q.share && v === 'yes' ? '<div class="form-group"><label class="form-label" for="p_scn_usualShare">Your usual share of what you own jointly (%)</label>'
          + '<input type="text" inputmode="decimal" class="form-input mono mask-pct" id="p_scn_usualShare" placeholder="e.g. 50" value="' + (ps.usualShare ? esc(String(ps.usualShare)) : '') + '" onchange="onProfileUsualShare()"></div>' : '');
    }).join('');
  }
  var layers = document.getElementById('p_foreign_layers');
  if (layers) {
    var on = APP.foreignIncomeYN === 'yes';
    layers.style.display = on ? '' : 'none';
    layers.innerHTML = on ? foreignLayersHtml('p') : '';
  }
}
export function onProfileScenarioQ(key) {
  var el = document.getElementById('p_scn_' + key); if (!el) return;
  var next = Object.assign({}, APP.profileScenarios || {});
  if (el.value) next[key] = el.value; else delete next[key];
  APP.profileScenarios = next;
  refreshProfileScenarioQs();   // the CGT follow-up appears/disappears with joint ownership
  if(typeof persistData === 'function') persistData();
  if(typeof renderAll === 'function') renderAll();
}
/* UI-CAP-0: Profile's usual share. Out-of-range input is not stored (the
   record-level "Held jointly" then asks for the figure on the form). It
   changes no saved record — each record keeps the share it was saved with. */
export function onProfileUsualShare() {
  var el = document.getElementById('p_scn_usualShare'); if (!el) return;
  var v = parseFmt(el.value);
  var next = Object.assign({}, APP.profileScenarios || {});
  if (v > 0 && v < 100) next.usualShare = v; else delete next.usualShare;
  APP.profileScenarios = next;
  if(typeof persistData === 'function') persistData();
}
export function onProfileForeignLayers() {
  APP.profileScenarios = Object.assign({}, APP.profileScenarios || {}, {
    foreign: { categories: checkedValues('p-fcat'), currencies: checkedValues('p-fcur') }
  });
  if(typeof persistData === 'function') persistData();
}

/* ── Phase 1 (G1/E1/E2): Profile mirror of the conditional-question logic ──
   Same basis test and same wording table as onboarding
   (obUpdateConditionalQuestions, 12-bootstrap-onboarding.js). Kept as a
   separate function rather than importing that one because 12- and 13-
   already import from each other; sharing either way would be an eval-order
   hazard (hard rule 10). The wording itself is the thing that must not
   drift, so both read CONDITIONAL_Q_TEXT from 01-data. */
export function refreshProfileConditionalQs() {
  var sel = (typeof getSelectedIncomeTypes === 'function' ? getSelectedIncomeTypes() : []) || [];
  var emp = sel.indexOf('employment_income') >= 0;
  var trade = TRADE_INCOME_TYPES.some(function(t){ return sel.indexOf(t) >= 0; });
  var basis = trade ? 'trade' : (emp ? 'employee' : null);
  var show = function(id, on) { var el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; };

  show('p_q_subsistence_grp', emp);
  show('p_q_tools_grp',    !!basis);
  show('p_q_subscrip_grp', !!basis);
  if (basis) {
    var tl = document.getElementById('p_q_tools_lbl');
    if (tl) tl.textContent = CONDITIONAL_Q_TEXT.tools[basis].text;
    var sl = document.getElementById('p_q_subscrip_lbl');
    if (sl) sl.textContent = CONDITIONAL_Q_TEXT.subs[basis].text;
  }
}

/* Batch M: medical aid + out-of-pocket expenses merged into one combined question —
   a single Yes/No answer drives both APP.hasMedical and APP.hasMedicalAid identically.
   hasMedicalAid is the persisted source of truth (see hydrateFromData); hasMedical
   mirrors it so existing consumers (01-data.js appliesWhen, 04-deductions.js) keep working. */
export function onProfileMedicalCombinedQ() {
  var el = document.getElementById('p_q_medical_combined'); if(!el) return;
  var val = el.value;
  APP.hasMedical = val;
  APP.hasMedicalAid = val;
  /* sync p_has_medical_aid hidden field */
  var hf = document.getElementById('p_has_medical_aid'); if(hf) hf.value = val;
  if(!APP.dedChecks) APP.dedChecks = {};
  if(val === 'yes') {
    APP.dedChecks.medical = true;
    if(!APP.onboardingAutoToggled) APP.onboardingAutoToggled = {};
    APP.onboardingAutoToggled.medical = true;
  }
  updateMedicalSubpageVisibility();
  if(typeof persistData === 'function') persistData();
  if(typeof renderAll === 'function') renderAll();
}

/* B3 Simplification (01-SPEC.md §7.2, item 9): the medical capture fields are
   NO LONGER GATED. This used to hide #med-aid-block and #med-oop-block unless
   a Profile answer said the user had a medical aid — so someone who had not
   answered that question yet, or had answered it wrong, arrived at the Medical
   page and found it empty, with no way to tell whether the app had nothing to
   ask or had decided not to ask. Profile answers still PRE-FILL these fields
   (and still drive whether Medical appears in "Still to add"); they no longer
   decide whether the user can see them.

   The function is kept — it is the hook the Profile question calls — but its
   job is now only to refresh the credit display. */
export function updateMedicalSubpageVisibility() {
  var aidBlock = document.getElementById('med-aid-block');
  var oopBlock = document.getElementById('med-oop-block');
  /* Clear any display left on these blocks by a build before B3, so a user
     upgrading mid-session is not left with the old hidden state. */
  if(aidBlock) aidBlock.style.display = '';
  if(oopBlock) oopBlock.style.display = '';
  // Batch M: keep the s6A/s6B result card in sync whenever the medical
  // question(s) change, not just when the amount/count fields fire oninput.
  if (typeof renderMedicalCreditsDisplay === 'function') renderMedicalCreditsDisplay();
}
export function initProfileDeductionQs() {
  var migrated = false;
  Object.keys(PROFILE_DED_Q).forEach(function(type){
    var cfg = PROFILE_DED_Q[type];
    var el = document.getElementById(cfg.sel); if(!el) return;
    /* QA 2026-08 (B2-BUG-1): read the persisted answer directly. This used to
       OR the flag with APP.dedChecks[type], but dedChecks is a one-way latch —
       onProfileDeductionQ sets it on "yes" and never clears it on "no" — so the
       OR short-circuited on the stale latch and the select came back as "yes",
       discarding the user's "no" on every re-entry. Same fix Batch M already
       applied to the medical question below; this generalises it to all seven.
       Accounts predating the flag fall back to the latch once, so an existing
       "yes" is not silently lost the first time the page is opened. */
    var answered = APP[cfg.flag] === 'yes' || APP[cfg.flag] === 'no';
    var on;
    if (answered) {
      on = APP[cfg.flag] === 'yes';
    } else {
      /* Pre-flag account: the latch is the only record of the answer, so adopt
         it AND write it through once. After this migration the flag is the sole
         authority, so the latch can never resurrect a "yes" the user later
         cleared — which is the bug this whole block exists to kill. */
      on = !!(APP.dedChecks && APP.dedChecks[type]);
      APP[cfg.flag] = on ? 'yes' : 'no';
      migrated = true;
    }
    el.value = on ? 'yes' : 'no';
  });
  if (migrated && typeof persistData === 'function') persistData();
  /* Batch M: init combined medical question from the persisted hasMedicalAid flag
     directly (not OR'd with the one-way dedChecks latch) — fixes it resetting to
     "Yes" after the user explicitly answered "No" and left the page. */
  var medEl = document.getElementById('p_q_medical_combined');
  if(medEl) medEl.value = (APP.hasMedicalAid === 'yes') ? 'yes' : 'no';
  updateMedicalSubpageVisibility();
  /* Theme 8: binary yes/no, matching onboarding. Prefer the stored raw
     answer; fall back to the boolean for accounts created before this
     tracking shipped. */
  var carried = APP.expectedCarriedBalances || {};
  var carriedAns = APP.carriedBalanceAnswers || {};
  Object.keys(PROFILE_CARRY_Q).forEach(function(type){
    var cfg = PROFILE_CARRY_Q[type];
    var el = document.getElementById(cfg.sel); if(!el) return;
    var raw = carriedAns[type];
    el.value = (raw === 'yes' || raw === 'no') ? raw : (carried[type] ? 'yes' : 'no');
  });
  /* Phase 1 (G1): foreign-source answer + conditional-question visibility. */
  var fEl = document.getElementById('p_q_foreign');
  if (fEl) fEl.value = (APP.foreignIncomeYN === 'yes') ? 'yes' : 'no';
  refreshProfileConditionalQs();
  refreshProfileScenarioQs();   // QR7.2
}


/* ============================================================
   P-H1 — Tax Year close-out (Profile → Tax Year card + modals).
   Snapshot/carry-forward math lives in closeOutTaxYear()/
   computeCarryForwardForNextYear() (02-core.js) — this section is UI
   glue only: render the Profile card, drive the 2-step close-out modal,
   render a closed year's read-only summary.
   ============================================================ */
var CLOSEOUT_CARRY_LABELS = {
  py_loss: ['Assessed loss b/f', 's20(1)(a) — a tax loss not yet fully absorbed against other income.'],
  cgt_loss_bf: ['Capital losses b/f', 'Eighth Schedule — net capital loss not yet used against gains.'],
  py_ret_excess: ['Non-deducted retirement contributions', 's11F(3) / 2nd Schedule para 5-6 / s10C.'],
  ftc_bf: ['Foreign tax credit b/f', 'para (iii) proviso to s6quat(1B)(a) — 7-year carry-forward.'],
  py_s18a_excess: ['Donations excess (10% cap)', 's18A(1) proviso.'],
};
var _closeoutPending = null;   /* the overrides object shown/edited on step 2, between openCloseoutModal() and onCloseoutFinalConfirm() */
var _viewingClosedYearIdx = null;

/* Prototype #3: lock the Tax Year selector once hasTaxYearData() (02-core.js)
   is true, with an explicit "Unlock to change year…" escape hatch that
   warns before re-enabling it — reusing showConfirm rather than a new
   modal. Called from renderTaxYearCard() so it stays in sync with every
   place that already re-renders the tax-year card (profile open, close-out,
   tax-year change itself). */
export function updateTaxYearLockState() {
  var sel = document.getElementById('taxYear');
  var badge = document.getElementById('taxyear-lock-badge');
  var note = document.getElementById('taxyear-lock-note');
  var btn = document.getElementById('taxyear-unlock-btn');
  if (!sel) return;
  var locked = (typeof hasTaxYearData === 'function') && hasTaxYearData();
  sel.disabled = locked;
  if (badge) badge.classList.toggle('u-hidden', !locked);
  if (note) note.classList.toggle('u-hidden', !locked);
  if (btn) btn.classList.toggle('u-hidden', !locked);
}
export function confirmUnlockTaxYear() {
  showConfirm('Change tax year?',
    'Switching the tax year does not move your captured income, deductions or other data to a new slate — everything you’ve already entered will now be treated as belonging to the year you switch to. If you’re filing for the current year, don’t change this.',
    function () {
      var sel = document.getElementById('taxYear');
      if (sel) sel.disabled = false;
      var badge = document.getElementById('taxyear-lock-badge');
      var note = document.getElementById('taxyear-lock-note');
      var btn = document.getElementById('taxyear-unlock-btn');
      if (badge) badge.classList.add('u-hidden');
      if (note) note.classList.add('u-hidden');
      if (btn) btn.classList.add('u-hidden');
    },
    { tier: 'tax', okLabel: 'Switch year',
      /* ONB-5 (design-system-audit-2026-09): was hardcoded 'Stay on 2026',
         wrong for every year but the one it was written in. Interpolate the
         currently selected tax year (STD-NUM-4) rather than writing one in. */
      cancelLabel: 'Stay on ' + (typeof getActiveTaxYear === 'function' ? getActiveTaxYear().label : ''),
      consequence: 'Figures already captured stay with the year you entered them against. Nothing is deleted by switching.' }
  );
}

export function renderTaxYearCard() {
  var cardEl = document.getElementById('closeout-year-card');
  var histEl = document.getElementById('closeout-history-list');
  updateTaxYearLockState();
  if (!cardEl || !histEl) return;
  var yearKey = gs('taxYear');
  var ty = TAX_YEARS[yearKey] || {};
  var nextKey = nextTaxYearKey(yearKey);
  var canClose = !!TAX_YEARS[nextKey];
  cardEl.innerHTML =
    '<div style="background:var(--sf2);border:1.5px solid var(--accent);border-radius:12px;padding:14px;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    + '<span style="font-weight:800;font-size:0.9375rem">' + esc(ty.label || yearKey) + ' tax year</span>'
    + '<span style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--accent);background:rgba(31,95,175,.14);padding:3px 9px;border-radius:9px">Open</span>'
    + '</div>'
    + '<div style="font-size:0.6875rem;color:var(--tx3);margin-bottom:12px;line-height:1.5">'
    + (canClose
        ? "Closing it out archives a read-only snapshot and starts a fresh " + esc((TAX_YEARS[nextKey] && TAX_YEARS[nextKey].label) || nextKey) + " with your carry-forward balances pre-filled."
        : "Next year's tax tables aren't available yet — check back after the Budget/Gazette for " + esc(nextKey) + '.')
    + '</div>'
    + (canClose ? '<button class="btn btn-primary" style="width:100%" onclick="openCloseoutModal()"><i class="material-symbols-outlined msi-archive"></i>&nbsp; Close out ' + esc(ty.label || yearKey) + ' tax year</button>' : '')
    + '</div>';
  var closed = (APP.history || []).slice().reverse();
  if (!closed.length) { histEl.innerHTML = ''; return; }
  var html = '<div style="font-weight:700;font-size:0.75rem;margin-bottom:8px">Closed years</div>';
  closed.forEach(function (snap) {
    var idx = APP.history.indexOf(snap);
    var snapTy = TAX_YEARS[snap.year] || {};
    var closedDate = snap.closedAt ? new Date(snap.closedAt).toLocaleDateString() : '';
    var balLabel = (snap.results && snap.results.balance < 0) ? 'Refund' : 'Owing';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--bd);border-radius:10px;background:var(--sf);margin-bottom:8px;cursor:pointer" onclick="viewClosedYear(' + idx + ')">'
      + '<div style="width:34px;height:34px;border-radius:9px;background:var(--sf2);display:flex;align-items:center;justify-content:center;color:var(--tx3);flex-shrink:0"><i class="material-symbols-outlined msi-request-quote"></i></div>'
      + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.8125rem">' + esc(snapTy.label || snap.year) + ' tax year</div>'
      + '<div style="font-size:0.6875rem;color:var(--tx3)">Closed ' + esc(closedDate) + (snap.results ? ' · ' + balLabel + ' ' + fmt(Math.abs(snap.results.balance || 0)) : '') + '</div></div>'
      + '<span style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--tx3);background:var(--sf2);padding:3px 8px;border-radius:8px;flex-shrink:0">Closed</span>'
      + '<i class="material-symbols-outlined msi-chevron-right" style="color:var(--tx3);font-size:0.75rem"></i>'
      + '</div>';
  });
  histEl.innerHTML = html;
}

export function openCloseoutModal() {
  var yearKey = gs('taxYear');
  var ty = TAX_YEARS[yearKey] || {};
  var nextKey = nextTaxYearKey(yearKey);
  if (!TAX_YEARS[nextKey]) return;
  var nextTy = TAX_YEARS[nextKey] || {};
  var yearLabel = ty.label || yearKey, nextLabel = nextTy.label || nextKey;
  document.getElementById('co-confirm-year').textContent = yearLabel;
  document.getElementById('co-confirm-year2').textContent = yearLabel;
  document.getElementById('co-confirm-nextyear').textContent = nextLabel;
  var r = (typeof calcFullTax === 'function') ? calcFullTax() : {};
  var balLabel = (r.balance || 0) < 0 ? 'Refund' : 'Owing';
  document.getElementById('co-archive-list').innerHTML =
      '<div><i class="material-symbols-outlined msi-paid" style="width:16px;color:var(--tx3);margin-right:6px"></i>Income sources — ' + (APP.incomeItems || []).length + ' items</div>'
    + '<div><i class="material-symbols-outlined msi-fact-check" style="width:16px;color:var(--tx3);margin-right:6px"></i>Deductions — ' + (APP.deductionItems || []).length + ' items</div>'
    + '<div><i class="material-symbols-outlined msi-savings" style="width:16px;color:var(--tx3);margin-right:6px"></i>Retirement / lump-sum records — ' + ((APP.retirementLumpsums || []).length + (APP.pensionAnnuityItems || []).length) + ' items</div>'
    + '<div><i class="material-symbols-outlined msi-calculate" style="width:16px;color:var(--tx3);margin-right:6px"></i>Final tax calculation — ' + esc(balLabel) + ' ' + esc(fmt(Math.abs(r.balance || 0))) + '</div>';
  document.getElementById('co-step-confirm').style.display = '';
  document.getElementById('co-step-carry').style.display = 'none';
  openModal('modal-closeout');
}

export function onCloseoutContinue() {
  var yearKey = gs('taxYear');
  var ty = TAX_YEARS[yearKey] || {};
  var nextKey = nextTaxYearKey(yearKey);
  var nextTy = TAX_YEARS[nextKey] || {};
  var yearLabel = ty.label || yearKey, nextLabel = nextTy.label || nextKey;
  document.getElementById('co-carry-year').textContent = yearLabel;
  document.getElementById('co-carry-nextyear').textContent = nextLabel;
  document.getElementById('co-carry-nextyear2').textContent = nextLabel;
  _closeoutPending = (typeof computeCarryForwardForNextYear === 'function') ? computeCarryForwardForNextYear() : {};
  var html = '';
  Object.keys(CLOSEOUT_CARRY_LABELS).forEach(function (id) {
    var meta = CLOSEOUT_CARRY_LABELS[id];
    var val = _closeoutPending[id] || 0;
    html += '<div style="margin-bottom:14px">'
      + '<div style="font-size:0.75rem;font-weight:600;display:flex;align-items:center;gap:6px;margin-bottom:5px">' + esc(meta[0])
      + ' <span style="font-size:0.625rem;font-weight:700;color:var(--au);background:rgba(31,175,115,.14);padding:2px 7px;border-radius:7px;text-transform:uppercase;letter-spacing:.03em">Auto</span></div>'
      + '<input type="number" class="form-input mono" id="co_' + id + '" value="' + val + '">'
      + '<div style="font-size:0.65625rem;color:var(--tx3);margin-top:4px">' + esc(meta[1]) + '</div>'
      + '</div>';
  });
  document.getElementById('co-carry-fields').innerHTML = html;
  document.getElementById('co-step-confirm').style.display = 'none';
  document.getElementById('co-step-carry').style.display = '';
}

export function onCloseoutBack() {
  document.getElementById('co-step-confirm').style.display = '';
  document.getElementById('co-step-carry').style.display = 'none';
}

export function onCloseoutFinalConfirm() {
  var overrides = {};
  Object.keys(CLOSEOUT_CARRY_LABELS).forEach(function (id) {
    var el = document.getElementById('co_' + id);
    overrides[id] = el ? (parseFloat(el.value) || 0) : ((_closeoutPending && _closeoutPending[id]) || 0);
  });
  var ok = (typeof closeOutTaxYear === 'function') && closeOutTaxYear(overrides);
  _closeoutPending = null;
  if (!ok) { showToast('Could not close out this tax year.', 'error'); return; }
  closeModal('modal-closeout');
  renderTaxYearCard();
  showToast('Tax year closed out — carry-forward balances applied.', 'archive');
}

export function viewClosedYear(idx) {
  var snap = (APP.history || [])[idx];
  if (!snap) return;
  _viewingClosedYearIdx = idx;
  var ty = TAX_YEARS[snap.year] || {};
  document.getElementById('modal-closed-year-title').textContent = (ty.label || snap.year) + ' tax year';
  var closedDate = snap.closedAt ? new Date(snap.closedAt).toLocaleDateString() : 'unknown date';
  document.getElementById('cy-readonly-note').textContent = 'Read-only snapshot, closed ' + closedDate + '. To make changes, this year would need to be reopened from Profile.';
  var r = snap.results || {};
  var balLabel = (r.balance || 0) < 0 ? 'Refund due' : 'Owing';
  var html = '<div style="text-align:center;padding:10px 0 6px">'
    + '<div style="font-size:0.6875rem;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">' + esc(balLabel) + '</div>'
    + '<div style="font-size:1.875rem;font-weight:800;font-family:var(--mono);margin-top:4px;color:' + ((r.balance || 0) < 0 ? 'var(--ok)' : 'var(--er)') + '">' + esc(fmt(Math.abs(r.balance || 0))) + '</div></div>'
    + sumLine('Gross income', r.gross) + sumLine('Taxable income', r.taxableIncome)
    + sumLine('Tax payable', r.taxPayable) + sumLine('PAYE + provisional paid', (r.payeDeducted || 0) + (r.provisionalPaid || 0));
  var cf = snap.carriedForward || {};
  var cfRows = Object.keys(CLOSEOUT_CARRY_LABELS).filter(function (id) { return cf[id] > 0; });
  if (cfRows.length) {
    html += '<div style="font-weight:700;font-size:0.75rem;margin:18px 0 8px">Carried into next year</div><div style="background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px">';
    cfRows.forEach(function (id) {
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.75rem"><span style="color:var(--tx3)">' + esc(CLOSEOUT_CARRY_LABELS[id][0]) + '</span><span style="font-weight:700;font-family:var(--mono)">' + esc(fmt(cf[id])) + '</span></div>';
    });
    html += '</div>';
  }
  document.getElementById('cy-summary').innerHTML = html;
  openModal('modal-closed-year');
  function sumLine(label, val) {
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd);font-size:0.78125rem"><span style="color:var(--tx3)">' + esc(label) + '</span><span style="font-weight:700;font-family:var(--mono)">' + esc(fmt(val || 0)) + '</span></div>';
  }
}

export function exportClosedYear() {
  var snap = (APP.history || [])[_viewingClosedYearIdx];
  if (!snap) return;
  var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  /* BACKLOG 72: "Exported." only once the file has gone somewhere — a
     dismissed share sheet saved nothing. */
  _downloadBlob(blob, 'inspiredtax-' + snap.year + '-closed-year.json')
    .then(function (outcome) { if (outcome !== 'cancelled') showToast('Exported.', 'download'); })
    .catch(function (e) { console.error('exportClosedYear:', e); showToast('Export failed — please try again', 'error', 'error'); });
}

/* V8.75 1b: unapplied-changes banners on the income net-calculators
   (they use the same pending/applied state as deductions). */
export function updateIncomeDirtyBanners() {
  var map = {
    'tab-income-b2investment':'interest',
    'tab-income-b3rental':'rental',
    'tab-income-b4business':'business',
    'tab-income-b5cgt':'cgt',
    'tab-income-b6foreign':'foreign'
  };
  Object.keys(map).forEach(function(tabId){
    var tab = document.getElementById(tabId);
    if(tab && typeof renderDirtyBanner === 'function') renderDirtyBanner(map[tabId], tab);
  });
}


export function wirePriorYearDirtyListener() {
  /* V8.75 1a: attach prior-year dirty listener once, then refresh banner */
  if (!APP._v875PyListener) {
    var pyTab = document.getElementById('tab-summary-prioryear');
    if (pyTab) { pyTab.addEventListener('input', updatePriorYearDirty); APP._v875PyListener = true; }
  }
  updatePriorYearDirty();
  updateIncomeDirtyBanners();   /* V8.75 1b: income-calculator unapplied banners */
}

/* V8.6 H1 + H2 — Prior Year Apply handler. Persists prior-year inputs,
   refreshes the retirement excess display on the Retirement subpage, and
   triggers a full re-render of the tax calc + return. */
export function applyPriorYear() {
  if (typeof persistData === 'function') persistData();
  if (typeof snapshotPriorYear === 'function') snapshotPriorYear();  /* V8.75 1a: clear unapplied banner */
  /* Update retirement excess display element */
  const exDisp = document.getElementById('ret-excess-display');
  if (exDisp) exDisp.textContent = (typeof fmt === 'function') ? fmt(Number(gv('py_ret_excess') || 0)) : String(gv('py_ret_excess') || 0);
  /* Recalculate retirement display + tax return */
  if (typeof renderMedicalCreditsDisplay === 'function') renderMedicalCreditsDisplay();
  if (typeof updateCalc === 'function') updateCalc();
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderTaxReturn === 'function') renderTaxReturn();
  if (typeof flashSaved === 'function') flashSaved();   /* Batch A (UX #7): save-as-you-go */
}

/* v8.13 B2.3: onTravelType and toggleTravelLearnMore removed — radio block deleted */

/* v8.14 T3a — Vehicle acquisition type (Purchase vs Lease) toggle.
   Vehicle value is ALWAYS visible (needed for fixed-cost table + lease-rental cap).
   Lease only affects actual-cost method: W&T = 0, lease rentals captured in Finance. */
export function onTravelAcqType() {
  var v = (typeof gs === 'function') ? gs('tv_acq_type') : 'purchase';
  /* Confirm before clearing if any fields have data. In-DOM dialog (async):
     revert the select immediately, commit only inside the confirm callback —
     Cancel then needs no handler because nothing has changed yet. */
  var wandtInp = document.getElementById('tv_wandt');
  var finInp = document.getElementById('tv_finance');
  var leaseInp = document.getElementById('tv_lease_pay');
  var hasData = (wandtInp && wandtInp.value) || (finInp && finInp.value) || (leaseInp && leaseInp.value);
  if (hasData) {
    var prev = APP.travelAcqType || 'purchase';
    if (typeof sv === 'function') sv('tv_acq_type', prev);
    showConfirm('Clear travel fields?',
      'Switching the acquisition type changes the inputs. W\u0026T and finance/lease fields will be cleared.',
      function () {
        if (finInp) finInp.value = '';
        if (leaseInp) leaseInp.value = '';
        if (wandtInp) wandtInp.value = '';
        if (typeof sv === 'function') sv('tv_acq_type', v);
        applyTravelAcqType(v);
      },
      { tier: 'del', okLabel: 'Clear travel fields', cancelLabel: 'Keep them',
        consequence: 'Your travel deduction returns to nil until the fields are recaptured. The logbook records themselves are untouched.' });
    return;
  }
  applyTravelAcqType(v);
}
function applyTravelAcqType(v) {
  APP.travelAcqType = v;
  /* Batch H2 (#54/#56): W&T visibility, Finance-vs-Lease field visibility,
     and the acq-type note/link are all synced by the same shared helper
     setTravelMethod() itself uses — keeps both entry points (method
     toggle, acquisition-type toggle) consistent from one place. */
  updateTravelAcqNote();
  if (typeof calcTravel === 'function') calcTravel();
}

/* V8.6 N16 + K3-style tiered warning for business km %
   - Amber 70-85%
   - Red 85%+ (requires acknowledgment per N16.4 b lock)
*/
export function checkBusinessKmThreshold() {
  const open = Number((document.getElementById('tv_odo_open') || {}).value || 0);
  const close = Number((document.getElementById('tv_odo_close') || {}).value || 0);
  const bus = Number((document.getElementById('tv_bus_km') || {}).value || 0);
  const totalKm = Math.max(0, close - open);
  const busPct = totalKm > 0 ? (bus / totalKm * 100) : 0;
  const warnEl = document.getElementById('bus-km-warning');
  if (!warnEl) return;
  /* QR4.6 (QD-19): business km larger than the km driven is not merely "high" — it
     cannot be right. The plausibility note is PREPENDED to whatever tier message
     follows (the acknowledgement lock below still applies: busPct is then > 100). */
  const _plaus = plausibilityHtml(plausibilityNotes(['businessKmOverTotal'], { businessKm: bus, totalKm }));
  if (busPct >= 85) {
    warnEl.innerHTML = `<div class="note error" style="margin:0"><i class="material-symbols-outlined msi-warning u-mr-5"></i>Business use of ${busPct.toFixed(1)}% is very likely to be queried.<div style="margin-top:6px"><label style="display:flex;gap:6px;align-items:center;font-size:0.75rem;font-weight:normal"><input type="checkbox" id="bus_km_ack" onchange="onBusKmAck()"> I confirm logbook supports this business %</label></div></div>`;
    /* Reset ack if value changed */
    if (APP.busKmAck && busPct !== APP.busKmAckFor) {
      APP.busKmAck = false;
      APP.busKmAckFor = null;
    }
  } else if (busPct >= 70) {
    warnEl.innerHTML = noteHtml('warning', `Business use of ${busPct.toFixed(1)}% — keep a full logbook.`, `Business kilometres at ${busPct.toFixed(1)}% \u2014 above average. SARS scrutinises claims above 70-80%. Ensure logbook is contemporaneous and complete.`, { style: 'margin:0', title: 'High business use' });
  } else {
    warnEl.innerHTML = '';
  }
  warnEl.innerHTML = _plaus + warnEl.innerHTML;
}
export function onBusKmAck() {
  const cb = document.getElementById('bus_km_ack');
  if (!cb) return;
  const open = Number((document.getElementById('tv_odo_open') || {}).value || 0);
  const close = Number((document.getElementById('tv_odo_close') || {}).value || 0);
  const bus = Number((document.getElementById('tv_bus_km') || {}).value || 0);
  const totalKm = Math.max(0, close - open);
  const busPct = totalKm > 0 ? (bus / totalKm * 100) : 0;
  APP.busKmAck = !!cb.checked;
  APP.busKmAckFor = busPct;
  if (typeof persistData === 'function') persistData();
}

/* (N16.4 business-km Apply gate now lives inside applyDeductionWrapper — the one
   live wrapper — and actively blocks Apply until acknowledged.) */

/* v8.13 B1: Navigation hub — navigate-away prompt (U2a) + snapshot-on-arrival (U1a). */
export function hookSelectionsLanding() {
  var orig = window.navigateTo;
  if (!orig) return;
  window.navigateTo = function(mode, sub) {
    /* B1.3 navigate-away check. In-DOM three-way dialog (Apply / Discard /
       Cancel) replaces the old window.prompt typed-keyword flow: WebViews
       render native prompts with browser chrome, and typing keywords is
       hostile on mobile. Navigation is deferred into the callbacks; Cancel is
       the dialog's stock button (stay on page, nothing to undo). */
    var currentSub = APP.currentDeductionSub;
    if (currentSub && typeof hasUnappliedEdits === 'function' && hasUnappliedEdits(currentSub)) {
      var navArgs = arguments;
      /* CONF-4 (§L.8): body copy now says what each choice does, rather than
         only naming the state ("You have unapplied changes on X.") and
         leaving the two buttons below to explain themselves. CONF-3 (remove
         provisional-tax wording from all three confirmation modals) needs no
         change here — this dialog only ever concerns a deduction sub-page's
         own fields, never an income-type/provisional-relevant answer. */
      showChoice(
        'Unapplied changes',
        'You have unapplied changes on ' + currentSub.charAt(0).toUpperCase() + currentSub.slice(1) + '. Apply them to include this in your tax, or discard to go back to what was last saved.',
        'Apply & continue',
        function () {
          /* applyDeduction handles snapshot + navigate-up */
          if (typeof applyDeduction === 'function') applyDeduction(currentSub);
        },
        'Discard & continue',
        function () {
          /* U2a full restore: revert inputs, re-render, clear banner */
          if (typeof restoreInputs === 'function') restoreInputs(currentSub);
          /* Sync pendingValues for direct-set types after field restore */
          if (currentSub === 'subscrip') {
            var _se = document.getElementById('ded_subscrip');
            if (_se && APP && APP.pendingValues) APP.pendingValues.subscrip = gv('ded_subscrip');
          }
          if (currentSub === 'subsistence' && typeof calcSubsistence === 'function') calcSubsistence();
          if (currentSub === 'subsistence' && typeof calcForeignSubsistence === 'function') calcForeignSubsistence();
          if (typeof renderAll === 'function') renderAll();
          if (typeof snapshotInputs === 'function') snapshotInputs(currentSub);
          /* Re-enter the wrapped navigateTo with clean state so the arrival
             effects (guidance, snapshot-on-arrival) run exactly as before. */
          window.navigateTo.apply(null, navArgs);
        }
      );
      return;
    }
    var r = orig.apply(this, arguments);
    /* B1.1: snapshot on arrival at editable sub-page (once per visit, not per render) */
    var arrivalType = null;
    if (mode === 'deductions' && sub) {
      var raw = String(sub).replace(/^ded-/, '');
      var flds = {retirement:1,medical:1,travel:1,homeoffice:1,tools:1,donations:1,subscrip:1,subsistence:1};
      var arrs = {rental:1,cgt:1,business:1,interest:1};
      if (flds[raw] || arrs[raw]) arrivalType = raw;
    } else if (mode === 'income' && sub) {
      var incMap = {'b3rental':'rental','b2investment':'interest','b5cgt':'cgt','b4business':'business'};
      arrivalType = incMap[sub] || null;
    }
    if (arrivalType) {
      APP.currentDeductionSub = arrivalType;
      /* v8.22 fix-2: stale baselines from earlier visits/sessions caused false 'Unapplied changes'.
         Clear the type's snapshot NOW (no snapshot => not dirty during render window),
         then re-baseline after render settles AND refresh the indicators so any lit state clears. */
      if (APP.inputSnapshot) delete APP.inputSnapshot[arrivalType];
      if (typeof updatePendingIndicators === 'function') updatePendingIndicators();
      /* v8.22 r4: the amber banner is rendered by updateAllDirtyBanners during nav,
         BEFORE the stale snapshot was deleted — and nothing refreshed it after.
         Refresh it here and again after the fresh baseline. */
      if (typeof updateAllDirtyBanners === 'function') updateAllDirtyBanners();
      setTimeout(function() {
        if (typeof snapshotInputs === 'function') snapshotInputs(arrivalType);
        if (typeof updatePendingIndicators === 'function') updatePendingIndicators();
        if (typeof updateAllDirtyBanners === 'function') updateAllDirtyBanners();
      }, 350);
    } else if (mode !== 'deductions') {
      APP.currentDeductionSub = null;
    }
    return r;
  };
}

/* A4: Tax year prominent header on every page ─────────────────────── */
export function insertTaxYearHeader() {
  if (document.getElementById('tax-year-header')) return;
  /* H1a: insert into .app-body so it sits below the fixed .app-header (56px);
     sticky top:var(--header-h) keeps it just under the app-header on scroll. */
  var body = document.querySelector('.app-body');
  if (!body) return;
  const hdr = document.createElement('div');
  hdr.id = 'tax-year-header';
  hdr.className = 'tax-year-header';
  /* QA 2026-08 (B2-G-5): "Tax year: 2027", not "Working on tax year: 2027
     (1 Mar 2026 – 28 Feb 2027)". The long form wrapped to two lines at 360px
     and pushed every page down by a row to say something the user had just
     chosen. The period is still available — it is what the ⓘ on the tax-year
     question explains — it just does not need permanent sticky real estate. */
  /* QA 2026-08 (design handoff §6, notes 1/2): monochrome Material Symbols
     glyph, not Font Awesome — the header already inherits the active
     screen's --area-accent (cyan on the dashboard), so no colour change is
     needed here, only the icon-font swap. */
  hdr.innerHTML = '<span class="tax-year-label">' + msIconHtml('calendar_month') + ' Tax year: <span class="tax-year-value" id="tax-year-value">—</span></span>';
  body.insertBefore(hdr, body.firstChild);
}

export function updateTaxYearHeader() {
  const el = document.getElementById('tax-year-value');
  if (!el) return;
  const ty = (typeof gs === 'function' ? gs('taxYear') : '') || (APP.data && APP.data.taxYear) || '2027';
  const tyNum = parseInt(ty, 10);
  el.textContent = isNaN(tyNum) ? String(ty) : String(tyNum);
}

/* A6: Reset all data — Settings menu action with type-RESET confirm ── */
export function generateDataSummary() {
  const counts = {};
  counts['Tax year being worked on'] = (APP.data && APP.data.taxYear) || (typeof gs === 'function' ? gs('taxYear') : '') || '—';
  counts['IRP5 / Income items'] = (APP.incomeItems || []).length;
  counts['Manual deduction items'] = (APP.deductionItems || []).length;
  counts['Rental properties'] = (APP.rentalProperties || []).length;
  counts['Business entries'] = (APP.businessItems || []).length;
  counts['CGT assets'] = (APP.cgtAssets || []).length;
  counts['IT3(b) certificates'] = (APP.it3bItems || []).length;
  counts['Employer PAYE entries'] = (APP.employerPaye || []).length;
  return counts;
}

export function openResetModal() {
  let modal = document.getElementById('reset-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reset-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <div class="modal-title"><i class="material-symbols-outlined msi-warning" style="color:var(--er)"></i> Reset all data — irreversible</div>
          <button class="modal-close" onclick="closeResetModal()">×</button>
        </div>
        <div class="modal-body reset-modal-body">
          <h3>This will permanently delete:</h3>
          <div class="data-summary" id="reset-data-summary"></div>
          <p style="color:var(--amber)"><strong>This action cannot be undone.</strong> All income, deductions, retirement, medical, travel, and tax calculations on this device will be erased.</p>
          <label style="display:block;margin-top:12px;font-weight:600">Type <span style="color:var(--er)">RESET</span> to confirm:</label>
          <input type="text" class="confirm-input" id="reset-confirm-input" autocomplete="off" oninput="onResetInput()">
          <div id="reset-cloud"></div>
          <p id="reset-error" class="note warning u-hidden" role="alert" aria-live="polite" style="margin-top:10px"></p>
          <div class="modal-actions" style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="closeResetModal()">Cancel</button>
            <button class="btn btn-danger" id="reset-confirm-btn" disabled onclick="executeReset()" style="background:var(--er);color:#fff">Reset all data</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  // Populate data summary
  const summary = generateDataSummary();
  const sumEl = document.getElementById('reset-data-summary');
  sumEl.innerHTML = Object.entries(summary).map(([k, v]) =>
    `<div class="data-summary-row"><span>${k}</span><strong>${v}</strong></div>`
  ).join('');
  document.getElementById('reset-confirm-input').value = '';
  document.getElementById('reset-confirm-btn').disabled = true;
  const resetErr = document.getElementById('reset-error'); if (resetErr) resetErr.classList.add('u-hidden');
  /* QX-DRV-4: offer to delete the profile's cloud copies too. Not ticked by
     default here — a reset keeps the account, and the cloud copy is the one way
     back from it; the user chooses. Renders nothing while the kill-switch is off. */
  renderCloudDeleteOffer('reset-cloud', 'reset-cloud-cb', false);
  /* ONB-4 (design-system-audit-2026-09): this modal predates the shared
     openModal()/closeModal() lifecycle and hand-rolled its own visibility via
     style.display — but .modal-overlay's own CSS (main.css) now gates real
     visibility behind the .open class (opacity/visibility/pointer-events all
     start at 0/hidden/none and only .open flips them), which only
     openModal() ever adds. style.display='flex' alone made this modal an
     invisible, non-interactive flex container: technically in the layout,
     never seen or reachable by a tap. That is what "the button doesn't work"
     looked like from the outside — not a broken RESET-match gate, a modal
     that never became visible for the user to type into. Routing through
     openModal() also gives this modal the focus trap hard rule 11 requires,
     which the hand-rolled version never had. */
  openModal('reset-modal');
}

export function closeResetModal() {
  closeModal('reset-modal');
}

export function onResetInput() {
  const inp = document.getElementById('reset-confirm-input');
  const btn = document.getElementById('reset-confirm-btn');
  const match = inp.value.trim().toUpperCase() === 'RESET';
  inp.classList.toggle('match', match);
  btn.disabled = !match;
}

export async function executeReset() {
  /* QX-DRV-4: cloud copies first, and only proceed if that worked or the user
     did not ask for it — a failure is said out loud and nothing is reset. */
  const resetBtn = document.getElementById('reset-confirm-btn');
  if (resetBtn) resetBtn.disabled = true;   // no second tap while the network call runs
  const cloud = await cloudBackupDeleteRequested('reset-cloud-cb');
  if (!cloud.ok) {
    const err = document.getElementById('reset-error');
    if (err) { err.textContent = cloud.message; err.classList.remove('u-hidden'); }
    if (resetBtn) resetBtn.disabled = false;
    return;
  }
  // Wipe all per-user data; preserve user list and PIN credentials so user can log back in
  try {
    /* BACKLOG 71: the profile's saved data goes (the old code removed
       `inspiredtax_userdata_<user>`, a key the app never writes), and the
       profile then loads the way a new one does — restoreData() with nothing
       saved, the same field map hydrateFromData() applies to every profile —
       rather than a hand list of APP fields, which had fallen behind (facts,
       overrides, Easy View and the medical-aid answer survived a reset). */
    if (APP.user) {
      localStorage.removeItem(SK.data(APP.user));
      restoreData(APP.user);
      /* Awaited: the empty profile is on disk before the snapshot below is
         built and before onboarding starts. */
      await persistData();
      /* The Auto Backup snapshot held the pre-reset data — it now holds the
         reset profile (no-op off Android). */
      writeLocalBackupSnapshot();
    }
    closeResetModal();
    cloudBackupPauseAfterReset();   // QR10a: the emptied profile must not overwrite the cloud copy
    if (typeof showToast === 'function') showToast('All data reset. Starting fresh setup...', 'sync');
    // Re-launch onboarding, always at step 1 (see checkAndShowOnboarding's
    // comment — OB.currentStep is in-memory and outlives this reset otherwise).
    setTimeout(() => {
      OB.currentStep = 1;
      OB.data = {};
      if (typeof showOnboarding === 'function') showOnboarding();
    }, 500);
  } catch (e) {
    console.error('Reset failed:', e);
    if (typeof showToast === 'function') showToast('Reset failed: ' + e.message, 'error');
  }
}

/* The Settings drawer sub-group (body.html #grp-settings-sub) carries the theme
   toggle as a static item, so the former runtime injection
   (ensureSettingsResetItem) is gone — it relied on the window.renderAll
   wrapper, which lexical renderAll calls bypassed, leaving Settings blank in
   the running app.

   QA 2026-08 (B2-PROF-6): "Reset all data" is no longer one of those items —
   it lives in the Profile modal, beside Delete Account, which is where both
   destructive actions now sit. Its element keeps the .drawer-subitem class
   (that is the row styling it is drawn with, not a statement about where it
   is) and the #reset-menu-item id, which openResetModal()'s callers use. */

/* ── Boot: Install Batch 1 patches when DOM ready ────────────────── */
/* V8.6+ initialisation — installs the proxies, input rounding, navigation
   hook and the renderAll post-render hook. Called once from the single
   DOMContentLoaded handler above (no separate listener). Idempotent-guarded so
   a double call can't double-wrap renderAll. The rand-rounding migration is
   data-dependent and runs from startApp() after unlock, not on a poll. */
/* ── A11Y: keyboard access + aria-expanded for clickable expandable headers ──
   The accordion/drawer/risk/act-ref headers are divs with onclick. This wires
   them centrally: role=button + tabindex=0, Enter/Space activation, and
   aria-expanded kept in sync (state read from the element's own open/expanded
   class or its body sibling's open class). Re-run after each renderAll for
   JS-generated headers. */
export const A11Y_TOGGLE_SELECTORS = [
  '.section-acc-header', '.card-sec-head', '.risk-item-header',
  '.act-ref-header', '.ob-acc-head',
  '[onclick^="toggleDrawerGroup"]', '[onclick^="toggleFaqModule"]'
].join(',');

export function a11yIsExpanded(el) {
  if (el.classList.contains('open') || el.classList.contains('expanded')) return true;
  const sib = el.nextElementSibling;
  return !!(sib && sib.classList && sib.classList.contains('open'));
}
export function a11yWireExpandables(root) {
  (root || document).querySelectorAll(A11Y_TOGGLE_SELECTORS).forEach(el => {
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && !el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('aria-expanded', a11yIsExpanded(el) ? 'true' : 'false');
  });
}
/* B0 Simplification — tooltip attachment pass (01-SPEC.md P2, §2).
   Stamps PAGE_HELP page tips and FIELD_TIPS field tips onto rendered DOM.
   Called from a11yWireInfoBtns so it shares the single post-render pass
   (hard rule 3 — no second pass added). Both maps start empty in B0;
   B6 populates them and the allow-list shrinks to match. */
export function attachTips(root) {
  var scope = root || document;
  /* Field tips: stamp data-tip onto inputs/selects whose id is in FIELD_TIPS.

     The label is found through the field's own form group, not through
     label[for="id"]: almost no label in this shell carries a `for`
     attribute — they wrap their text and sit as a sibling of the input
     inside .form-group/.sfg — so a for-based lookup matched nothing and
     silently stamped no tips at all.

     The register is AUTHORITATIVE: an existing ⓘ has its text refreshed
     rather than left alone. Nothing else may carry field tip copy, or
     B6 would rewrite this file while the DOM kept serving stale text. */
  scope.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(f) {
    var tip = FIELD_TIPS[f.id];
    if (!tip) return;
    var grp = f.closest('.form-group, .sfg');
    var lbl = grp && grp.querySelector('label');
    if (!lbl) return;
    var btn = lbl.querySelector('.info-btn');
    if (!btn) {
      btn = document.createElement('span');
      btn.className = 'info-btn';
      btn.innerHTML = '<i class="material-symbols-outlined msi-info"></i>';
      lbl.appendChild(document.createTextNode(' '));
      lbl.appendChild(btn);
    }
    /* setAttribute, not string building — no escaping hole to get wrong. */
    btn.setAttribute('data-tip', tip);
  });
}

/* B0: tooltip-coverage audit. Compares the live DOM against PAGE_HELP /
   FIELD_TIPS and emits window.__missingTips for the smoke assertion.

   The audit is REGISTER-ONLY by design: a field counts as covered when
   FIELD_TIPS names it, not when it happens to carry an inline data-tip
   today. Most of those inline tips cite statute and blow the P3 copy
   budget — they are precisely what B6 rewrites — so crediting them would
   make the number report "done" while the actual objective (a simple,
   specific tip on every amount) was still untouched. The number therefore
   measures distance to the P3 standard, not distance to "has some text".

   The B0 bootstrap allowed EVERYTHING (TIPS_ALLOW_LIST = ['*']), which
   made window.__missingTips empty by construction and the smoke assertion
   vacuous — nothing stopped a new untipped field shipping between now and
   B6. The allow-list is now a short, justified list, the walk covers the
   mode panels the old one missed, and tests/smoke.js ratchets the count. */
/* B6: the allow-list is EMPTY. It held two ids and one prefix; all three
   are gone rather than excused — `ovr-` was the outstanding-item dismiss
   checkbox that B4 deleted, and the other two were never inputs the audit
   walks. An empty list is the point: nothing is exempt, so a new captured
   value ships with a tip or breaks the build. */
var TIPS_ALLOW_LIST = [];
var TIPS_ALLOW_PREFIXES = [];
function _tipAllowed(id) {
  return TIPS_ALLOW_LIST.indexOf(id) >= 0
      || TIPS_ALLOW_PREFIXES.some(function(p) { return id.indexOf(p) === 0; });
}
export function buildMissingTipsAudit() {
  var missing = [];
  /* .tab-section covers tabbed screens; a .mode-panel with no tab sections
     of its own IS a page (dashboard, actref, taxfaqs, subscribe) — the old
     walk skipped these, so nothing on them was ever audited. A
     mode panel that DOES host tab sections is a container, not a page, and
     is skipped to avoid counting its fields twice. */
  document.querySelectorAll('.tab-section[id], .mode-panel[id]').forEach(function(section) {
    if (section.classList.contains('mode-panel') && section.querySelector('.tab-section')) return;
    var key = section.id.replace(/^tab-/, '').replace(/^mode-/, '');
    if (!PAGE_HELP[key] && !_tipAllowed('page:' + key)) {
      missing.push('page:' + key);
    }
    section.querySelectorAll('input[id], select[id]').forEach(function(f) {
      if (f.type === 'hidden' || f.readOnly || f.disabled) return;
      if (!FIELD_TIPS[f.id] && !_tipAllowed(f.id)) {
        missing.push('field:' + f.id);
      }
    });
  });
  window.__missingTips = missing;
  return missing;
}

/* v8.23 UX-standardisation / B0: an ⓘ is a <span> that opens the shared
   bottom help sheet for long tips and the hold bubble for short tips (02-core).
   Make it keyboard-reachable + announced as a button. Also stamps tips from
   FIELD_TIPS onto fresh DOM (attachTips). Re-run after each renderAll.
   TIP_TRIGGER_SEL, not `.info-btn`: the inline hint glyphs and the income-tile
   dots are on the same engine and need the same keyboard path. */
export function a11yWireInfoBtns(root) {
  attachTips(root || document);
  (root || document).querySelectorAll(TIP_TRIGGER_SEL).forEach(el => {
    if (el.hasAttribute('role')) return;
    el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('aria-haspopup', 'dialog');
    if (!el.hasAttribute('aria-label')) {
      var tip = el.getAttribute('data-tip');
      el.setAttribute('aria-label', tip ? tip.replace(/<[^>]*>/g, '').slice(0, 80) : 'More information');
    }
  });
}
export function a11ySyncSoon(el) {
  setTimeout(() => el.setAttribute('aria-expanded', a11yIsExpanded(el) ? 'true' : 'false'), 0);
}
export function a11yInit() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.matches && e.target.matches('input, select, textarea, button, a')) return;
    const el = e.target.closest && e.target.closest(A11Y_TOGGLE_SELECTORS);
    if (!el) return;
    e.preventDefault();
    el.click();
    a11ySyncSoon(el);
  });
  // Capture phase: the drawer root calls event.stopPropagation() in its inline
  // bubble-phase handler, which would starve a bubble-phase listener here.
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest(A11Y_TOGGLE_SELECTORS);
    if (el) a11ySyncSoon(el);
  }, true);
  a11yWireExpandables();
  a11yWireInfoBtns();
}

/* Batch 6 guided-stepper: mark a deduction step `.done` once it holds a
   meaningful value (a positive money/quantity input or a positive yn/select
   selection). Purely presentational — the terminal result step is skipped.
   Engine reads are untouched; this only toggles a CSS class for the rail. */
export function refreshDedSteps() {
  document.querySelectorAll('#mode-deductions .ded-step').forEach(function (step) {
    if (step.classList.contains('ded-step-result')) return;
    var filled = false;
    step.querySelectorAll('input, select').forEach(function (f) {
      if (f.type === 'hidden') return;
      if (f.type === 'radio') {
        if (f.checked && f.value && f.value !== 'no' && f.value !== '0') filled = true;
      } else if (f.tagName === 'SELECT') {
        if (f.value && f.value !== 'no' && f.value !== '0' && f.value !== '') filled = true;
      } else {
        var n = parseFloat((f.value || '').replace(/[^0-9.\-]/g, ''));
        if (!isNaN(n) && n > 0) filled = true;
      }
    });
    step.classList.toggle('done', filled);
  });
}

/* Live done-state while the user types — one delegated listener on the panel. */
export function initDedSteps() {
  var panel = document.getElementById('mode-deductions');
  if (!panel || panel._dedStepsInited) return;
  panel._dedStepsInited = true;
  panel.addEventListener('input', refreshDedSteps);
  panel.addEventListener('change', refreshDedSteps);
  refreshDedSteps();
}

export function init() {
  if (APP._v86Inited) return;
  APP._v86Inited = true;
  try {
    installProxies();
    attachInputRounding();
    trackCurrentDedSub();
    insertTaxYearHeader();
    updateTaxYearHeader();
    hookSelectionsLanding();
    a11yInit();
    initDedSteps();
    initTipBubble();           /* B0: press-and-hold bubble tooltip engine */
    /* B0 coverage audit: ONE walk, after the shell has settled. The mode
       panels are static in body.html, so a single pass sees every page
       whether or not it is the visible one. It used to run inside the
       post-render hook — a full querySelectorAll over every section and
       every input on each renderAll, i.e. on each keystroke that reaches
       updateCalc, for a number nothing reads at runtime. Tests re-run
       buildMissingTipsAudit() themselves when they need it fresh. */
    setTimeout(buildMissingTipsAudit, 0);

    // Hook renderAll to update tax year header + dirty banners + Settings menu
    if (typeof renderAll === 'function') {
      const _origRenderAll = renderAll;
      window.renderAll = function renderAllPatched() {
        const result = _origRenderAll.apply(this, arguments);
        try {
          updateTaxYearHeader();
          updateAllDirtyBanners();
          insertTaxYearHeader();   /* V8.75 1d: re-insert safety so header persists on every page */
          wirePriorYearDirtyListener();
          if(typeof updateMedicalSubpageVisibility === 'function') updateMedicalSubpageVisibility(); /* FB3 */
          a11yWireExpandables();      /* a11y: role/tabindex/aria-expanded on fresh headers */
          a11yWireInfoBtns();         /* a11y: role/tabindex on fresh .info-btn tooltips; stamps FIELD_TIPS */
          refreshDedSteps();          /* Batch 6: mark filled deduction steps done */
        } catch (e) { console.error('v86 post-render:', e); }
        return result;
      };
    }
  } catch (e) {
    console.error('v86 init:', e);
  }
}
