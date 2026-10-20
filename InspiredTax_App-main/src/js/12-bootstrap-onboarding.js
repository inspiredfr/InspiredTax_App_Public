import { debounceSave, noteUncaughtError, noteStepCompleted, $, APP, parseFmt, checkedValues, foreignLayersHtml, scenarioQuestionApplies, _bootstrapAuth, applyDefaultTaxYear, applyFirstRunLogin, applyResidencyTip, _obSetFieldError, _wireLockTriggers, _wireDsOfflineBanner, closeModal, doCreateAccount, doLogin, esc, getSelectedIncomeTypes, gs, initTabA11y, navigateTo, obSyncAllTiles, onIncomeTypeChange, onProvisionalChange, openModal, persistData, populateMedSchemeDatalist, renderIncomeGrid, renderSavedProfiles, showToast, startApp, sv, updateNoIncomeNote, iconClassFor } from './02-core.js';
import { INCOME_TYPE_DEFS, CONDITIONAL_Q_TEXT, DEDUCTION_CHECKLIST, TRADE_INCOME_TYPES, ONBOARDING_ACTIVATION, SCENARIO_QUESTIONS } from './01-data.js';
import { obToggleMedicalSchemeQ, obToggleMedicalSchemeName, obOnMedicalMembersChange } from './05-list-modules.js';
import { renderAll, refreshDerived } from './07-render-summary.js';
import { initTheme } from './08-dashboard-theme.js';
import { init } from './13-patches.js';
import { mountModals, renderTopicHelpAccordions } from './00-forms.js';
import { mountBrandMarks } from './13-patches.js';
import { mountDobSelectors } from './16-dob-selector.js';
import { mountCodePickers } from './00-forms.js';
import { installDebugHarness } from './16-debug-harness.js'; // S1 Batch 8: in-file test harness (debug-only)

/* ============================================================
   InspiredTax v8.5 — BOOTSTRAP
   DOMContentLoaded, auto-login, event wiring, error handling
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
  // Verification bench escape hatch: when the engine bundle is loaded by the
  // bench/ harness (which drives calcFullTax directly and supplies its own DOM
  // setup), suppress the app's auto-boot/auth flow. Off by default in the app.
  if (typeof window !== 'undefined' && window.__INSPIREDTAX_NO_BOOT__) return;
  try {
    // Apply the saved theme before anything renders — previously initTheme only
    // ran inside startApp, so the login/PIN screens ignored a saved light theme
    // until after unlock.
    if (typeof initTheme === 'function') initTheme();

    // Same reason, for the same screen: the sign-in card ships in its
    // returning-user layout, so a first-run device would paint Sign In as the
    // blue CTA and then visibly reshuffle once renderSavedProfiles ran after
    // the auth bootstrap's awaits. It needs nothing but localStorage and the
    // static DOM, so settle it here, before first paint. (renderSavedProfiles
    // still calls it — that is the path that reverts the card when an account
    // is created or removed; the function is idempotent.)
    applyFirstRunLogin();

    // D4: point both tax-year selects at the most recently completed year
    // of assessment before anything reads them.
    if (typeof applyDefaultTaxYear === 'function') applyDefaultTaxYear();

    // Step 1's physical-presence-test tip, interpolated from PHYSICAL_PRESENCE.
    if (typeof applyResidencyTip === 'function') applyResidencyTip();

    // Inject all bottom-sheet modal HTML from config (replaces static body.html blocks)
    if (typeof mountModals === 'function') mountModals();

    // STD-IA-3 (§L.9): populate the page-level "About X" accordions that
    // share a TOPIC_HELP entry with their modal's notes above.
    if (typeof renderTopicHelpAccordions === 'function') renderTopicHelpAccordions();

    // ARIA tabs pattern over the static tab bars (WCAG 4.1.2)
    if (typeof initTabA11y === 'function') initTabA11y();

    // Brand mark on every non-login mount, copied from the login screen's one
    // inline image (mountBrandMarks, 13-patches.js).
    if (typeof mountBrandMarks === 'function') mountBrandMarks();

    // Populate the DOB Year/Month selects (cr-dob, modal-dob) and sync them
    // from whatever the hidden inputs already hold (16-dob-selector.js).
    if (typeof mountDobSelectors === 'function') mountDobSelectors();

    // QR8: delegated listeners for every code picker (00-forms.js).
    mountCodePickers();

    // V8.6+: install proxies and the renderAll post-render hook BEFORE auth can
    // trigger the first render (merged from the former boot DOMContentLoaded).
    if (typeof init === 'function') init();

    // G1: render shared income grids BEFORE _bootstrapAuth so restoreData()
    // finds the income-type checkboxes in the DOM on first unlock.
    if (typeof renderIncomeGrid === 'function') {
      renderIncomeGrid('prof-income-grid', { mode: 'profile' });
      renderIncomeGrid('ob-income-grid',   { mode: 'onboarding' });
    }

    // V8.3 §3: PIN-aware bootstrap. Replaces the V8.2 direct-startApp behaviour.
    // _bootstrapAuth shows the appropriate auth screen (PIN entry / PIN setup)
    // for any saved session. startApp is only called AFTER successful unlock.
    const resumed = await _bootstrapAuth();
    _wireLockTriggers();
    _wireDsOfflineBanner();

    if (!resumed) {
      renderSavedProfiles();
    }
    const userInput = $('input-username');
    if(userInput) userInput.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
    ['cr-email'].forEach(id => {
      const el = $(id);
      if(el) el.addEventListener('keydown', e => { if(e.key==='Enter') doCreateAccount(); });
    });
    // PIN setup — Enter on first input moves to confirm; Enter on confirm submits
    const pinSetup = $('pin-setup-input');
    if (pinSetup) pinSetup.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const c = $('pin-setup-confirm'); if (c) c.focus(); }
    });
  } catch(err) {
    _showError('BOOT', err);
  }
});

document.addEventListener('click', e => {
  const sug = $('medscheme-suggestions');
  if(sug && !sug.contains(e.target) && e.target.id !== 'p_medscheme')
    sug.style.display = 'none';
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape') {
    // V8.3 §10: close any open modal on Escape (WCAG 2.1.2)
    const openModal = document.querySelector('.modal-overlay.open');
    if (openModal) closeModal(openModal.id);
  }
});

/* ── ERROR DISPLAY ── Errors always go to the console; the on-page diagnostic
   banner (alpha tooling) only renders when debug mode is enabled via
   localStorage.setItem('iss_debug','1'). */
export function _debugEnabled() {
  try { return localStorage.getItem('iss_debug') === '1'; } catch(e) { return false; }
}
/* BACKLOG 73: __DEBUG_HARNESS__ is a build constant (build.js `define`) —
   true in the review artifact, false in the minified release bundle, where
   the minifier drops this call and tree-shaking drops 16-debug-harness.js. */
if (__DEBUG_HARNESS__ && _debugEnabled()) installDebugHarness();
export const _errLog = []; // {key, count, el} — dedupe + cap for the debug banner
/* STD-COL-3 (design-system-audit-2026-09): #1a0000/#ff9999/#ffd166 below are
   left as literals, not swapped for tokens — this banner only ever renders
   behind _debugEnabled(), never seen by a real user. It exists specifically
   to look nothing like production chrome, so a developer can never mistake
   it for a real app surface; tying its palette to the same tokens the real
   UI uses would work against that. Parallel reasoning to 01-data.js's
   avatar/mascot exemption: decorative/diagnostic, not brand chrome. */
export function _showError(context, err) {
  console.error('InspiredTax ' + context + ':', err);
  if (!_debugEnabled()) return;
  let d = document.getElementById('iss-err');
  if(!d) {
    d = document.createElement('div');
    d.id = 'iss-err';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a0000;border-top:2px solid var(--er);color:#ff9999;padding:10px 14px;font-family:monospace;font-size:0.6875rem;z-index:9999;max-height:150px;overflow:auto';
    document.body.appendChild(d);
  }
  // §11 alpha1 hardening: escape err.message and context to prevent XSS via thrown errors
  const safe = (s) => String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
  // §7: dedupe repeats (counter pill) and cap the banner at 20 distinct entries
  // so a render-loop error cannot grow the DOM unboundedly.
  const key = context + '|' + (err && err.message ? err.message : err);
  const seen = _errLog.find(e => e.key === key);
  if (seen) {
    seen.count++;
    const pill = seen.el.querySelector('.iss-err-count');
    if (pill) pill.textContent = '×' + seen.count;
    return;
  }
  if (_errLog.length >= 20) {
    const oldest = _errLog.shift();
    if (oldest.el && oldest.el.parentNode) oldest.el.remove();
  }
  const row = document.createElement('div');
  row.innerHTML = '<strong>' + safe(context) + ':</strong> ' + safe(err && err.message ? err.message : err)
                + ' <span class="iss-err-count" style="color:#ffd166">×1</span>';
  d.appendChild(row);
  _errLog.push({ key, count: 1, el: row });
}
window.addEventListener('error', e => {
  noteUncaughtError(e.message, e.filename, e.lineno, e.colno);   // BACKLOG 67: Report a problem
  _showError('RUNTIME', {message: e.message + ' @ line ' + e.lineno});
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  const at = (r && r.stack && r.stack.match(/([^\s()]+):(\d+):(\d+)/)) || [];
  noteUncaughtError('Unhandled rejection: ' + ((r && r.message) || r), at[1], at[2], at[3]);
});

/* ═══════════════════════════════════════════════════════════
   ONBOARDING STEPPER — V8.5 BATCH 2 SECTION 1
   9-screen first-time setup flow for Profile B completion
   ═══════════════════════════════════════════════════════════ */

export let OB = {
  currentStep: 1,
  totalSteps: 7,
  data: {}
};

/* G1: OB_INCOME_TYPE_MAP removed — onboarding and profile now share the same
   canonical income-type values from INCOME_TYPE_DEFS. Kept as empty export so
   any external bridge reference does not throw. */
export const OB_INCOME_TYPE_MAP = {};

export function showOnboarding() {
  $('onboarding-overlay').classList.add('active');
  if (typeof populateMedSchemeDatalist === 'function') populateMedSchemeDatalist('ob-medscheme-list');
  /* QR7.2: (re)built on every open so a re-run starts from the stored
     answers — the same pre-fill the rest of this function does for the
     older questions. */
  obRenderScenarioQuestions();

  /* G1: pre-fill onboarding from current profile state when re-running so the
     user does not lose their existing selections. */
  if (APP.onboardingCompleted) {
    const profileVals = new Set(getSelectedIncomeTypes());
    document.querySelectorAll('#onboarding-overlay input[name="income-type"]').forEach(cb => {
      cb.checked = profileVals.has(cb.value);
    });
    const ded = APP.dedChecks || {};
    const setRad = (name, val) => {
      const r = document.querySelector('input[name="' + name + '"][value="' + val + '"]');
      if (r) { r.checked = true; }
    };
    setRad('ob-ra',             ded.retirement ? 'yes' : 'no');
    setRad('ob-donations',      ded.donations  ? 'yes' : 'no');
    setRad('ob-travel-allowance', (ded.travel || APP.travelAllowanceYN === 'yes') ? 'yes' : 'no');
    setRad('ob-work-from-home', (ded.homeoffice || APP.workFromHomeYN === 'yes') ? 'yes' : 'no');
    setRad('ob-medical',        ded.medical    ? 'yes' : 'no');
    /* Phase 1 (G1/E1/E2): restore the conditional answers too, so a re-run
       does not silently reset them to "no". */
    /* QR7.2: layer 1 is pre-filled only from a real answer — Yes, or a No
       that QR7 recorded (profileScenarios.foreign). An older account's
       stored 'no' may just be the old pre-checked default, so it starts
       unanswered: re-confirming it is what closes the foreign categories. */
    document.querySelectorAll('input[name="ob-foreign-income"]').forEach(r => { r.checked = false; });
    const _f = (APP.profileScenarios || {}).foreign;
    if (APP.foreignIncomeYN === 'yes') setRad('ob-foreign-income', 'yes');
    else if (_f && Array.isArray(_f.categories)) setRad('ob-foreign-income', 'no');
    setRad('ob-subsistence',    ded.subsistence ? 'yes' : 'no');
    setRad('ob-tools',          ded.tools       ? 'yes' : 'no');
    setRad('ob-subs',           ded.subscrip    ? 'yes' : 'no');
    setRad('ob-other-claims',   ded.additional  ? 'yes' : 'no');
    /* Phase 1 (G2): tri-state. Fall back through the raw answers first, then
       the boolean, so accounts predating the tri-state still restore sanely. */
    const cbAns = APP.carriedBalanceAnswers || {};
    const cb = APP.expectedCarriedBalances || {};
    const carryVal = k => cbAns[k] || (cb[k] ? 'yes' : 'no');
    setRad('ob-carry-loss',       carryVal('loss'));
    setRad('ob-carry-capital',    carryVal('capital'));
    setRad('ob-carry-retirement', carryVal('retirement'));
    setRad('ob-carry-donations',  carryVal('donations'));
    setRad('ob-carry-lumpsum',    carryVal('lumpsum'));
    setRad('ob-carry-ftc',        carryVal('ftc'));
    /* C-1a: restore tax residency from profile */
    const taxResidency = gs('p_tax_residency') || 'full_year';
    setRad('ob-tax-residency', taxResidency);
    obOnTaxResidencyChange();
    obToggleMedicalSchemeQ();
    /* Restore scheme membership from profile: if a scheme name is stored, the
       user is a member; restore dependants and disability state too. */
    if (ded.medical) {
      const schemeName = gs('p_medscheme');
      if (schemeName) {
        setRad('ob-medical-member', 'yes');
        const nameInput = $('ob-medical-scheme-name');
        if (nameInput) nameInput.value = schemeName;
        obToggleMedicalSchemeName();
        /* Inverse of the apply-side derivation: the engine stores dependants
           excluding the main member, the question asks for members including
           them. Mirrors syncMedMembersFromDeps() on the Medical page. */
        const cnt = $('ob-medical-members');
        if (cnt) {
          const deps = Math.max(0, Math.floor(parseInt(gs('med_deps') || '0', 10) || 0));
          cnt.value = String(deps + 1);
          obOnMedicalMembersChange();
        }
        const disability = gs('med_disability');
        if (disability === '1') setRad('ob-medical-disabled', 'yes');
      } else {
        obToggleMedicalSchemeName();
      }
    }
  }

  obUpdateUI();
}

/* G1: Close profile modal and launch onboarding from step 1. */
export function rerunOnboarding() {
  closeModal('modal-profile');
  OB.currentStep = 1;
  showOnboarding();
}

export function hideOnboarding() {
  $('onboarding-overlay').classList.remove('active');
}

export function obStepNext() {
  if (!obValidateCurrentStep()) return;
  obSaveCurrentStep();
  
  if (OB.currentStep < OB.totalSteps) {
    OB.currentStep++;
    obUpdateUI();
  }
}

export function obStepBack() {
  if (OB.currentStep > 1) {
    OB.currentStep--;
    obUpdateUI();
  }
}

/* Step-5 provisional caution: explicit inline confirmation (see the case-5
   comment in obValidateCurrentStep). Confirm advances past the blocked
   validation; "Go back" just collapses the confirmation so the user can
   change their answer. */
export function obConfirmProvisionalNo() {
  const c = $('ob-provisional-confirm');
  if (c) c.style.display = 'none';
  if (OB.currentStep < OB.totalSteps) {
    OB.currentStep++;
    obUpdateUI();
  }
}
export function obCancelProvisionalNo() {
  const c = $('ob-provisional-confirm');
  if (c) c.style.display = 'none';
  const notice = $('ob-provisional-notice');
  if (notice) notice.style.display = 'none';
}

export function obUpdateUI() {
  // Hide all screens
  document.querySelectorAll('.onboarding-screen').forEach(s => s.classList.remove('active'));

  // Show current screen
  const currentScreen = $('ob-screen-' + OB.currentStep);
  if (currentScreen) currentScreen.classList.add('active');

  // v8.19: sync tile/radio .sel classes after screen change
  if (typeof obSyncAllTiles === 'function') obSyncAllTiles();
  if (typeof updateNoIncomeNote === 'function') updateNoIncomeNote();

  /* Phase 1: re-evaluate which conditional questions apply. Runs on every
     step change rather than only on entry to step 4, so going BACK to the
     income step and changing an answer is reflected when the user returns. */
  obUpdateConditionalQuestions();
  /* Same reason, for Step 5's auto-determination note: it is conditional on
     the answer now (QA 2026-08), so it has to settle on entry and re-settle
     when the user comes back with a different one. */
  obOnProvisionalChange();

  // Update stepper indicators
  document.querySelectorAll('.stepper-dot').forEach((dot, idx) => {
    const step = idx + 1;
    dot.classList.remove('active', 'completed');
    if (step < OB.currentStep) dot.classList.add('completed');
    else if (step === OB.currentStep) dot.classList.add('active');
  });

  // Update progress text
  /* Newline, not a space: #ob-progress-text is white-space:pre-line so this
     renders as two tight lines ('Step' / '3 of 7'), keeping the footer row
     narrow enough for both Back and Next. */
  $('ob-progress-text').textContent = `Step
${OB.currentStep} of ${OB.totalSteps}`;

  // Update navigation buttons
  const backBtn = $('ob-btn-back');
  const nextBtn = $('ob-btn-next');
  const completeBtn = $('ob-btn-complete');

  backBtn.style.display = OB.currentStep > 1 ? 'block' : 'none';

  if (OB.currentStep === OB.totalSteps) {
    nextBtn.style.display = 'none';
    completeBtn.style.display = 'block';
  } else {
    nextBtn.style.display = 'block';
    completeBtn.style.display = 'none';
  }

  // Prototype #40: the review/confirmation screen is now genuinely the
  // final step (Carried-Forward Balances moved to step 6, ahead of it),
  // so this can key off totalSteps directly instead of a hardcoded step
  // number.
  if (OB.currentStep === OB.totalSteps) {
    obPopulateSummary();
  }

  /* UX: each step starts at the top of the viewport with the heading focused,
     so mobile users always land on the main content rather than wherever the
     previous step was scrolled to. */
  const content = document.querySelector('.onboarding-content');
  if (content) content.scrollTop = 0;
  if (currentScreen) {
    const title = currentScreen.querySelector('.ob-screen-title');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }
}

/* True when the user selected any income source outside Employment (bucket B1).
   Drives the provisional-taxpayer caution on the Provisional Taxation step. */
function obHasNonEmploymentIncome() {
  return (OB.data.activeBuckets || []).some(b => b && b !== 'B1');
}

/* ═══════════════════════════════════════════════════════════
   PHASE 1 (G1 / E1 / E2) — CONDITIONAL ONBOARDING QUESTIONS

   Several questions only make sense for some taxpayers, and two of them
   test a genuinely different rule depending on how the income is earned:

   - A trader deducts tools/subscriptions under s11(a) as expenditure in
     the production of income.
   - An EMPLOYEE is additionally restricted by s23(m), which disallows
     most s11 deductions against remuneration — the surviving cases are
     narrow (the asset must be required for the duties and not supplied
     or refunded by the employer).

   Asking one vague question of both audiences would set the wrong
   expectation for at least one of them, so the wording swaps and the
   question hides entirely when neither basis applies. Owner decision
   (2026-07-29): conditional — only ask what's relevant.
   ═══════════════════════════════════════════════════════════ */

function obSelectedIncomeValues() {
  return Array.from(
    document.querySelectorAll('#onboarding-overlay input[name="income-type"]:checked')
  ).map(cb => cb.value);
}
function obHasEmploymentIncome() {
  return obSelectedIncomeValues().indexOf('employment_income') >= 0;
}
function obHasTradeIncome() {
  const vals = obSelectedIncomeValues();
  return TRADE_INCOME_TYPES.some(t => vals.indexOf(t) >= 0);
}

/* Shows/hides the conditional questions and writes the basis-appropriate
   wording. Safe to call on every step change (it is cheap and idempotent). */
export function obUpdateConditionalQuestions() {
  obUpdateScenarioQuestions();   // QR7.2
  const emp = obHasEmploymentIncome();
  const trade = obHasTradeIncome();
  const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? '' : 'none'; };

  /* Subsistence is an employer-paid allowance (s8(1)(c)) — meaningless
     without employment income. */
  show('ob-q-subsistence', emp);

  const basis = trade ? 'trade' : (emp ? 'employee' : null);
  ['tools', 'subs'].forEach(key => {
    show('ob-q-' + key, !!basis);
    if (!basis) return;
    const copy = CONDITIONAL_Q_TEXT[key][basis];
    const textEl = $('ob-q-' + key + '-text');
    const tipEl = $('ob-q-' + key + '-tip');
    if (textEl) textEl.textContent = copy.text;
    /* data-tip, not title: title is hover-only and does nothing on touch. */
    if (tipEl) tipEl.setAttribute('data-tip', copy.tip);
  });

  obOnConditionalChange();
}

/* Live "this switches on X" notes (F2). QA 2026-09: the Step-4 (Deductions)
   notes are removed — answering a deduction question is its own feedback
   (the radio itself shows selected), a follow-up "we'll switch on X" line
   underneath every question read as noise. ob-note-foreign (Step 2) is
   untouched — not in scope. */
export function obOnConditionalChange() {
  const val = name => document.querySelector('input[name="' + name + '"]:checked')?.value;
  const note = (id, on) => { const el = $(id); if (el) el.style.display = on ? '' : 'none'; };
  note('ob-note-foreign',     val('ob-foreign-income') === 'yes');
  note('ob-foreign-layers',   val('ob-foreign-income') === 'yes');   // QR7.2: layers 2-3 follow layer 1
}

/* ═══════════════════════════════════════════════════════════
   QR7.2 (Q-ONB-1/2/3, QD-23, QD-24) — SCENARIO QUESTIONS
   Rendered on the Income Sources step from SCENARIO_QUESTIONS (01-data.js),
   each shown only when an income type it applies to is ticked (and, for the
   CGT follow-up, once joint ownership is Yes). No answer is pre-selected:
   an unanswered question stores nothing, and nothing it gates is hidden.
   Answers are written to APP.profileScenarios by obComplete().
   ═══════════════════════════════════════════════════════════ */
export function obRenderScenarioQuestions() {
  const ps = APP.profileScenarios || {};
  const host = $('ob-scenario-qs');
  if (host) {
    const radio = (key, v) => {
      const yes = v === 'yes';
      return '<label class="ob-radio-item"' + (yes ? ' data-answer="yes"' : '') + '>'
        + '<input type="radio" name="ob-scn-' + key + '" value="' + v + '"' + (ps[key] === v ? ' checked' : '') + ' onchange="obUpdateScenarioQuestions()">'
        + '<span class="ob-radio-item-ico ' + (yes ? 'ico-bg-teal' : 'ico-bg-grey') + '"><i class="material-symbols-outlined msi-' + (yes ? 'check' : 'close') + '"></i></span>'
        + '<span class="ob-radio-item-label">' + (yes ? 'Yes' : 'No') + '</span>'
        + '<span class="ob-radio-item-check"><i class="material-symbols-outlined msi-check"></i></span></label>';
    };
    host.innerHTML = SCENARIO_QUESTIONS.map(q =>
      '<div class="ob-q-group" id="ob-q-scn-' + q.key + '" style="display:none;margin-top:18px">'
      + '<div class="ob-q-label" id="ob-q-scn-' + q.key + '-lbl">' + esc(q.text)
      + ' <span class="u-c-tx3 u-hint-help ob-hint-icon" data-tip="' + esc(q.hint) + '" role="button" tabindex="0" aria-label="More information"><i class="material-symbols-outlined msi-info"></i></span></div>'
      + '<div class="ob-radio-group" role="radiogroup" aria-labelledby="ob-q-scn-' + q.key + '-lbl">' + radio(q.key, 'yes') + radio(q.key, 'no') + '</div>'
      /* UI-CAP-0: a Yes to joint ownership is followed by the one usual
         share every joint item uses (owner 2026-10-05). */
      + (q.share ? '<div class="form-group" id="ob-scn-share-row" style="display:none;margin-top:10px">'
        + '<label class="form-label" for="ob-scn-usualShare">Your usual share of what you own jointly (%)</label>'
        + '<input type="text" inputmode="decimal" class="form-input mono mask-pct" id="ob-scn-usualShare" placeholder="e.g. 50" value="' + (ps.usualShare ? esc(String(ps.usualShare)) : '') + '"></div>' : '')
      + '</div>').join('');
  }
  const layers = $('ob-foreign-layers');
  if (layers) layers.innerHTML = foreignLayersHtml('ob');
}
/* The answers as they stand on screen (radios), for the requires-chain. */
/* The question text of a static onboarding question group: the label's own
   text, without its icon glyph or hint (one source: the markup). */
function obQuestionText(groupId) {
  const l = $(groupId) && $(groupId).querySelector('.ob-q-label');
  return l ? [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : '';
}
function obScenarioAnswers() {
  const a = {};
  SCENARIO_QUESTIONS.forEach(q => {
    const v = document.querySelector('input[name="ob-scn-' + q.key + '"]:checked')?.value;
    if (v) a[q.key] = v;
  });
  return a;
}
export function obUpdateScenarioQuestions() {
  const sel = obSelectedIncomeValues();
  const answers = obScenarioAnswers();
  SCENARIO_QUESTIONS.forEach(q => {
    const el = $('ob-q-scn-' + q.key);
    if (el) el.style.display = scenarioQuestionApplies(q, sel, answers) ? '' : 'none';
    if (q.share) { const row = $('ob-scn-share-row'); if (row) row.style.display = answers[q.key] === 'yes' ? '' : 'none'; }
  });
}

/* Live toggle of the provisional caution as the radio changes (Step 5). */
export function obOnProvisionalChange() {
  const prov = document.querySelector('input[name="ob-provisional"]:checked')?.value;
  const notice = $('ob-provisional-notice');
  if (notice) notice.style.display = (prov === 'no' && obHasNonEmploymentIncome()) ? 'block' : 'none';
  /* QA 2026-08 (B1-11): "The app automatically determines provisional status
     from your income sources" was a fixed line under the question. It is only
     true of the Unsure answer — someone who has just told us Yes or No has
     made the determination themselves, and being told the app will decide it
     anyway reads as their answer being ignored. */
  const autoNote = $('ob-note-provisional-auto');
  if (autoNote) autoNote.style.display = (prov === 'unsure') ? '' : 'none';
}

export function obValidateCurrentStep() {
  switch(OB.currentStep) {
    case 1: {
      const taxYear = gs('ob-tax-year');
      const sarsDigits = (gs('ob-sars-ref') || '').replace(/\D/g, '');
      const residency = document.querySelector('input[name="ob-tax-residency"]:checked')?.value;
      let ok = true;

      if (!taxYear) { showToast('Please select a tax year.', 'error'); ok = false; }
      if (sarsDigits && sarsDigits.length !== 10) {
        _obSetFieldError('ob-sars-ref', 'SARS reference must be 10 digits.');
        ok = false;
      }
      if (!residency) { showToast('Please select your tax residency status.', 'error'); ok = false; }

      /* tax-year toast already fired above; otherwise one generic prompt */
      if (!ok && taxYear) showToast('Please complete the highlighted fields.', 'error');
      return ok;
    }

    case 2: {
      /* G1: onboarding tiles now use name="income-type"; scoped to overlay */
      const checkedIncome = document.querySelectorAll('#onboarding-overlay input[name="income-type"]:checked');
      if (checkedIncome.length === 0) {
        showToast('Please select at least one income source.', 'error');
        return false;
      }
      /* QD-24 as amended + UI-CAP-0 (owner 2026-10-05): every scenario
         question that applies, and the foreign-income question, is answered
         here, so a capture form never has to ask. One check, one toast
         naming the first open question (copy C-57; owner 2026-10-07 chose
         the per-question wording when the two checks were merged). */
      {
        const sel = obSelectedIncomeValues(), answers = obScenarioAnswers();
        const open = SCENARIO_QUESTIONS.find(q => scenarioQuestionApplies(q, sel, answers) && !answers[q.key]);
        const foreignOpen = !document.querySelector('input[name="ob-foreign-income"]:checked');
        if (open || foreignOpen) {
          showToast('Please answer: ' + (open ? open.text : obQuestionText('ob-q-foreign')), 'error');
          const el = open ? $('ob-q-scn-' + open.key) : $('ob-q-foreign');
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return false;
        }
        const shareQ = SCENARIO_QUESTIONS.find(q => q.share && answers[q.key] === 'yes' && scenarioQuestionApplies(q, sel, answers));
        if (shareQ) {
          const v = parseFmt(gs('ob-scn-usualShare'));
          if (!(v > 0 && v < 100)) {
            _obSetFieldError('ob-scn-usualShare', 'Enter your usual share, between 1 and 99 %.');
            return false;
          }
        }
      }
      return true;
    }

    case 3: {
      /* Owner brief 2026-09-14 (PLAN.md §8 step 3): Q2 ("member of a
         medical aid scheme?") becomes required once Q1 is yes — mirrors
         step 5's inline-block pattern rather than a toast-only block, so
         the error stays visible against the specific question. */
      const hasMedical = document.querySelector('input[name="ob-medical"]:checked')?.value === 'yes';
      const isMember = document.querySelector('input[name="ob-medical-member"]:checked');
      if (hasMedical && !isMember) {
        const err = $('ob-medical-member-error');
        if (err) err.style.display = 'block';
        showToast('Please answer whether you’re a member of a medical aid scheme.', 'error');
        return false;
      }
      return true;
    }

    case 5: {
      /* Provisional Taxation: if the user says they are NOT provisional but has
         income beyond a permanent salary, surface a caution and require an
         explicit confirmation that they are not required to register. The
         confirmation is inline in the notice (not #modal-confirm — the
         onboarding overlay stacks above modal z-index; not window.confirm —
         WebViews render it with browser chrome). Next is blocked here; the
         notice's confirm button advances via obConfirmProvisionalNo(). */
      obSaveCurrentStep();
      const prov = document.querySelector('input[name="ob-provisional"]:checked')?.value;
      const notice = $('ob-provisional-notice');
      const confirmBlock = $('ob-provisional-confirm');
      if (prov === 'no' && obHasNonEmploymentIncome()) {
        if (notice) notice.style.display = 'block';
        if (confirmBlock) confirmBlock.style.display = 'block';
        return false;
      }
      if (notice) notice.style.display = 'none';
      if (confirmBlock) confirmBlock.style.display = 'none';
      return true;
    }

    default:
      return true; // Other steps have no strict validation
  }
}

export function obSaveCurrentStep() {
  switch(OB.currentStep) {
    case 1:
      OB.data.taxYear = gs('ob-tax-year');
      OB.data.sarsRef = (gs('ob-sars-ref') || '').replace(/\D/g, '');
      OB.data.taxResidency = document.querySelector('input[name="ob-tax-residency"]:checked')?.value || 'full_year';
      break;

    case 2: {
      /* G1: onboarding tiles now use name="income-type"; scoped to overlay.
         Derive active buckets from INCOME_TYPE_DEFS (no more data-bucket attr). */
      const checked = Array.from(document.querySelectorAll('#onboarding-overlay input[name="income-type"]:checked'));
      OB.data.incomeSources = checked.map(cb => cb.value);
      OB.data.activeBuckets = [...new Set(checked.map(cb => {
        const def = INCOME_TYPE_DEFS.find(d => d.value === cb.value);
        return def ? 'B' + def.bucket : null;
      }).filter(Boolean))];
      /* Phase 1 (G1): foreign-source answer lives on this step because it
         gates an income module, not a deduction. */
      /* QR7.2: no answer is pre-selected any more. Unanswered still reads as
         'no' for Foreign Income discoverability (as before), but only an
         answer the user actually gave is recorded as one (foreignAnswered)
         — an untouched question closes nothing (QD-24's rule). */
      OB.data.foreignAnswered = !!document.querySelector('input[name="ob-foreign-income"]:checked');
      OB.data.foreignIncome = document.querySelector('input[name="ob-foreign-income"]:checked')?.value || 'no';
      /* QR7.2: only the questions on screen are recorded — one hidden because
         it does not apply keeps whatever was stored (unanswered = show). */
      {
        const sel = OB.data.incomeSources, answers = obScenarioAnswers();
        OB.data.scenarios = {};
        SCENARIO_QUESTIONS.forEach(q => {
          if (scenarioQuestionApplies(q, sel, answers) && answers[q.key]) OB.data.scenarios[q.key] = answers[q.key];
          if (q.share && OB.data.scenarios[q.key] === 'yes') OB.data.scenarios.usualShare = parseFmt(gs('ob-scn-usualShare'));
        });
        OB.data.foreignCategories = checkedValues('ob-fcat');
        OB.data.foreignCurrencies = checkedValues('ob-fcur');
      }
      break;
    }

    case 3:
      OB.data.hasMedical = document.querySelector('input[name="ob-medical"]:checked')?.value || 'no';
      OB.data.medicalSchemeMember = document.querySelector('input[name="ob-medical-member"]:checked')?.value || '';
      OB.data.medicalSchemeName = (gs('ob-medical-scheme-name') || '').trim();
      OB.data.medicalMembers = (gs('ob-medical-members') || '').replace(/\D/g, '');
      OB.data.medicalDisabled = document.querySelector('input[name="ob-medical-disabled"]:checked')?.value || '';
      break;

    case 4:
      /* "Other Deductions" — RA + donations + travel allowance + work from home */
      OB.data.hasRA = document.querySelector('input[name="ob-ra"]:checked')?.value || 'no';
      OB.data.hasDonations = document.querySelector('input[name="ob-donations"]:checked')?.value || 'no';
      OB.data.travelAllowance = document.querySelector('input[name="ob-travel-allowance"]:checked')?.value || 'no';
      OB.data.workFromHome = document.querySelector('input[name="ob-work-from-home"]:checked')?.value || 'no';
      /* Phase 1 (G1/E1/E2): the conditional questions. A hidden question is
         saved as 'no' — obUpdateConditionalQuestions() only hides one whose
         statutory basis does not apply to this taxpayer at all, so 'no' is
         the correct reading, not a missing answer. */
      OB.data.subsistence = document.querySelector('input[name="ob-subsistence"]:checked')?.value || 'no';
      OB.data.tools = document.querySelector('input[name="ob-tools"]:checked')?.value || 'no';
      OB.data.subscriptions = document.querySelector('input[name="ob-subs"]:checked')?.value || 'no';
      OB.data.otherClaims = document.querySelector('input[name="ob-other-claims"]:checked')?.value || 'no';
      break;

    case 5:
      OB.data.provisional = document.querySelector('input[name="ob-provisional"]:checked')?.value || 'unsure';
      break;

    case 6:
      /* Prototype #40: moved from step 7 to step 6 (Theme 8 carried-forward
         balances now precede the review screen instead of following it).
         Flags only, no amounts (see the T-6a-style "flag now, capture
         later" pattern already used for every other onboarding question,
         e.g. case 4's RA/donations/travel/WFH). */
      /* QA 2026-08 / D6: binary yes/no, default 'no'. Profile's mirror of
         these questions (PROFILE_CARRY_Q, 13-patches.js) is binary too —
         'unsure' is not offered anywhere in the app for these six flags. */
      OB.data.carryLoss       = document.querySelector('input[name="ob-carry-loss"]:checked')?.value || 'no';
      OB.data.carryCapital    = document.querySelector('input[name="ob-carry-capital"]:checked')?.value || 'no';
      OB.data.carryRetirement = document.querySelector('input[name="ob-carry-retirement"]:checked')?.value || 'no';
      OB.data.carryDonations  = document.querySelector('input[name="ob-carry-donations"]:checked')?.value || 'no';
      OB.data.carryLumpsum    = document.querySelector('input[name="ob-carry-lumpsum"]:checked')?.value || 'no';
      OB.data.carryFtc        = document.querySelector('input[name="ob-carry-ftc"]:checked')?.value || 'no';
      break;
  }
}

export function obPopulateSummary() {
  // Tax Year — owner brief 2026-09-14 (PLAN.md §8 step 7): year only,
  // derived from the value ("2027" -> "2026/27") rather than the select
  // option's text, so the option itself can keep its full date range.
  const tySelect = $('ob-tax-year');
  const tyValue = tySelect ? parseInt(tySelect.value, 10) : NaN;
  $('summary-tax-year').textContent = Number.isFinite(tyValue)
    ? (tyValue - 1) + '/' + String(tyValue % 100).padStart(2, '0')
    : '—';

  // Income Sources — G1: rendered from INCOME_TYPE_DEFS (single source of
  // truth). Icon-only per A3 (owner amendment, OWNER-DECISIONS-2026-09.md
  // §7.1): the label survives for AT via aria-label/title on the chip.
  /* B5.4/ICO-3/ONB-6: the standard ico-bg-* tile (main.css ~3562) at its
     default 32/24 step — the same one the dashboard quick-action tiles
     resolve to — replaces the bespoke .profile-chip/.profile-chip--icon
     pill. The onboarding overlay is not a .mode-panel, so it never gets
     --area-accent from the page-colour override; the hue is set explicitly
     per category group instead (D-19's "per category group" reading, not
     per row). */
  const incomeDefMap = Object.fromEntries(INCOME_TYPE_DEFS.map(d => [d.value, d]));
  const sources = OB.data.incomeSources || [];
  const incomeSrcEl = $('summary-income-sources');
  if (sources.length) {
    incomeSrcEl.innerHTML = sources.map(v => {
      const d = incomeDefMap[v];
      const label = d ? d.label : v;
      const icon = d ? iconClassFor(d.icon) : 'material-symbols-outlined msi-radio-button-checked';
      return `<span class="ico-bg-green" title="${esc(label)}" aria-label="${esc(label)}"><i class="${icon}"></i></span>`;
    }).join('');
  } else {
    incomeSrcEl.innerHTML = '<span class="profile-chip ico-bg-grey"><i class="material-symbols-outlined msi-radio-button-checked"></i> None selected</span>';
  }

  /* Deductions as chips (owner brief 2026-09-14, PLAN.md §8 step 7): the
     same ONBOARDING_ACTIVATION.deductions table obComplete() already uses
     to set APP.dedChecks, so there is no second list of deductions to keep
     in sync. Icon-only; violet per D-19's category-group colouring
     (income emerald, deductions violet — supersedes A3's "both green"). */
  const dedDefMap = Object.fromEntries(DEDUCTION_CHECKLIST.map(d => [d.id, d]));
  const activeDeds = ONBOARDING_ACTIVATION.deductions
    .filter(({ field }) => OB.data[field] === 'yes')
    .map(({ key }) => dedDefMap[key])
    .filter(Boolean);
  const dedEl = $('summary-deductions');
  if (dedEl) {
    dedEl.innerHTML = activeDeds.length
      ? activeDeds.map(d => `<span class="ico-bg-purple" title="${esc(d.label)}" aria-label="${esc(d.label)}"><i class="${iconClassFor(d.icon)}"></i></span>`).join('')
      : '<span class="profile-chip ico-bg-grey">None selected</span>';
  }

  // Provisional
  const provLabels = {
    'yes': 'Yes',
    'no': 'No',
    'unsure': 'Auto-determined'
  };
  $('summary-provisional').textContent = provLabels[OB.data.provisional] || 'Auto-determined';

  /* QA 2026-08 (B1-16): carried-forward balances. Step 6 collected six answers
     that the review step never showed back — the one screen whose answers the
     user could not check before finishing. Only the affirmative ones are
     listed: a list of what does not apply to you is noise, and the whole point
     of the review is spotting the thing you got wrong. Labelled (not
     icon-only, unlike income/deductions above), so needs to wrap rather
     than overflow at 360px — see .ob-summary-row--wide .profile-chip.labelled
     in main.css. */
  /* QA 2026-09: each carried-balance kind gets its own glyph (was msi-history
     for all six) — assessed loss/capital losses match the Step 6 question
     icons exactly; the rest reuse the glyph that concept already carries
     elsewhere in the app (donations -> volunteer_activism, foreign tax
     credit -> public, matching Foreign income). Lump sums has no existing
     match, so 'paid' (a received amount). QA 2026-09 round 2: retirement
     contributions moved off 'savings' to 'money-bag', matching the Step 6
     question's own icon change. */
  const carried = [
    ['carryLoss',       'Assessed loss',                              'clock-arrow-down'],
    ['carryCapital',    'Capital losses',                             'trending-down'],
    ['carryRetirement', 'Retirement contributions not yet deducted',  'money-bag'],
    ['carryDonations',  'Donations not yet deducted',                 'volunteer-activism'],
    ['carryLumpsum',    'Prior retirement lump sums',                 'paid'],
    ['carryFtc',        'Unused foreign tax credits',                 'public'],
  ].filter(([k]) => OB.data[k] === 'yes').map(([, label, icon]) => [label, icon]);
  const carriedEl = $('summary-carried');
  if (carriedEl) {
    carriedEl.innerHTML = carried.length
      ? carried.map(([l, icon]) => `<span class="profile-chip labelled ico-bg-amber"><i class="material-symbols-outlined msi-${icon}"></i> ${esc(l)}</span>`).join('')
      : 'None';
  }

  /* "What happens next" bullets (owner brief 2026-09-14, PLAN.md §8 step 7):
     moved from static markup so the employment-conditional first two
     bullets have one home instead of a template-plus-JS-patch split. */
  const hasEmployment = obHasEmploymentIncome();
  const nextSteps = [];
  if (hasEmployment) nextSteps.push('Add income items from your IRP5 or IT3(b)');
  nextSteps.push(hasEmployment ? 'Add other sources of income' : 'Add sources of income');
  nextSteps.push(
    'Capture deductions to reduce your tax',
    'Calculate your tax payable and carry forward amounts',
    'Calculate your provisional tax payments',
    'Export your ITR12 return for eFiling'
  );
  const nextStepsEl = $('ob-next-steps-list');
  if (nextStepsEl) nextStepsEl.innerHTML = nextSteps.map(s => `<li>${esc(s)}</li>`).join('');
}

export async function obComplete() {
  // Save all data to Profile B
  obSaveCurrentStep();
  
  // Map onboarding data to Profile B fields
  sv('taxYear', OB.data.taxYear || '2027');
  sv('p_taxref', OB.data.sarsRef || '');
  sv('p_tax_residency', OB.data.taxResidency || 'full_year');
  APP.taxResidency = OB.data.taxResidency || 'full_year';

  /* V8.6 C4: flow medical scheme name + member follow-ups into profile */
  if (OB.data.medicalSchemeName) {
    sv('p_medscheme', OB.data.medicalSchemeName);
  }
  if (OB.data.medicalSchemeMember === 'yes') {
    /* members (asked) -> med_deps = members - 1 (engine input). Assigned on
       the element rather than through sv(), because sv() skips a falsy value
       and "no dependants" is a real answer that must overwrite a stale count. */
    const members = parseInt(OB.data.medicalMembers, 10);
    if (members > 0) {
      const deps = Math.max(0, members - 1);
      const depEl = $('med_deps'); if (depEl) depEl.value = String(deps);
      sv('med_has_deps', deps > 0 ? 'yes' : 'no');
    }
    if (OB.data.medicalDisabled === 'yes') sv('med_disability', '1');
  }
  /* Batch M: Profile's medical aid + OOP questions are merged into one combined
     question, so both APP flags mirror onboarding's single top-level gate. */
  APP.hasMedicalAid = (OB.data.hasMedical === 'yes') ? 'yes' : 'no';
  APP.hasMedical = APP.hasMedicalAid;
  const _pqMed = document.getElementById('p_q_medical_combined');
  if (_pqMed) _pqMed.value = APP.hasMedical;
  const _pHiddenAid = document.getElementById('p_has_medical_aid');
  if (_pHiddenAid) _pHiddenAid.value = APP.hasMedicalAid;

  /* V8.6 C14 / G1: sync deduction activation from onboarding answers.
     Bidirectional for re-runs so disabling a deduction in re-run is respected.
     Decision Studio Stage 2: driven from ONBOARDING_ACTIVATION.deductions
     (01-data.js) rather than one hardcoded line per deduction — see that
     table's comment for why. Adding a deduction's onboarding answer now
     means adding a row there, not a line here. */
  if (!APP.dedChecks) APP.dedChecks = {};
  ONBOARDING_ACTIVATION.deductions.forEach(({ key, field }) => {
    APP.dedChecks[key] = OB.data[field] === 'yes';
  });
  /* Mark which deductions were auto-toggled — drives the "auto-enabled
     because…" reason note on each Selections row (04-deductions.js,
     13-patches.js). QA 2026-09 round 2 removed the first-arrival guidance
     modal this used to also gate (APP.onboardingOverlayShown) — the flag
     had no other reader, so it goes with it. */
  APP.onboardingAutoToggled = {};
  ONBOARDING_ACTIVATION.deductions.forEach(({ key, field }) => {
    APP.onboardingAutoToggled[key] = OB.data[field] === 'yes';
  });

  /* Phase 1 (G1): foreign-source answer. Unlike the deductions above there
     is no dedChecks entry to set — Foreign Income is an income bucket, and
     incomeBucketActive('b6foreign') derives from captured amounts. The flag
     drives discoverability (outstanding item + drawer prominence) so the
     page is reachable before anything has been captured in it. */
  APP.foreignIncomeYN = OB.data.foreignIncome || 'no';

  /* QR7.2 (QD-23, QD-10): scenario answers. Layer 1 answered No closes every
     foreign category (an explicit "nothing may be foreign"); Yes records the
     ticked categories and currencies (none ticked = unanswered, all shown);
     left unanswered, the stored foreign answers are untouched. The review card is for users who never saw these questions —
     anyone finishing onboarding has. */
  {
    const prev = APP.profileScenarios || {};
    const prevCur = (prev.foreign && prev.foreign.currencies) || [];
    const next = Object.assign({}, prev, OB.data.scenarios || {}, { reviewDismissed: true });
    if (OB.data.foreignAnswered) {
      next.foreign = APP.foreignIncomeYN === 'yes'
        ? { categories: OB.data.foreignCategories || [], currencies: OB.data.foreignCurrencies || [] }
        : { categories: [], currencies: prevCur };
    }
    APP.profileScenarios = next;
  }

  /* Theme 8: carried-forward-balance flags feed the unified Dashboard
     outstanding-items list (getCarriedBalanceOutstanding, 08-dashboard-theme.js)
     — bidirectional for re-runs, same as the dedChecks sync above. */
  /* Phase 1 (G2): the raw answer is kept alongside the boolean.
     expectedCarriedBalances keeps its original boolean contract — "surface
     this as outstanding" — satisfied by anything but an explicit 'no'. */
  /* Decision Studio Stage 2: driven from ONBOARDING_ACTIVATION.carriedBalances
     — see that table's comment. Both objects use the same fields; keeping
     them as two loops (not one merged object) preserves the existing
     contract each was built for. Binary yes/no, default 'no', six balances
     including ftc (carryFtc) — all read straight through this loop via the
     table, nothing hardcoded here to keep in sync by hand. */
  APP.carriedBalanceAnswers = {};
  APP.expectedCarriedBalances = {};
  ONBOARDING_ACTIVATION.carriedBalances.forEach(({ key, field }) => {
    APP.carriedBalanceAnswers[key] = OB.data[field] || 'no';
    APP.expectedCarriedBalances[key] = OB.data[field] !== 'no';
  });

  // Provisional status
  if (OB.data.provisional === 'yes') {
    sv('p_provisional', 'yes');
    sv('p_prov_status', 'manual');
  } else if (OB.data.provisional === 'no') {
    sv('p_provisional', 'no');
    sv('p_prov_status', 'manual');
  } else {
    sv('p_prov_status', 'auto');
  }
  
  /* G1: onboarding and profile now share the same income-type values — direct
     sync from onboarding overlay to profile section, no mapping needed. */
  const obSelected = new Set(
    Array.from(document.querySelectorAll('#onboarding-overlay input[name="income-type"]:checked'))
      .map(cb => cb.value)
  );
  document.querySelectorAll('input[name="income-type"]').forEach(cb => {
    if (!cb.closest('#onboarding-overlay')) cb.checked = obSelected.has(cb.value);
  });
  
  // Set hasCompletedOnboarding flag
  APP.onboardingCompleted = true;
  
  // Save travel allowance and work from home answers
  APP.travelAllowanceYN = OB.data.travelAllowance || 'no';
  APP.workFromHomeYN = OB.data.workFromHome || 'no';
  
  // Initialize bucket status based on Master Income Question
  APP.bucketStatus = obInitializeBucketStatus(OB.data.activeBuckets || []);
  
  // Persist data
  persistData();
  noteStepCompleted('onboarding');   // QR10a.3

  // Hide onboarding and show dashboard
  hideOnboarding();
  /* V8.6 C2 + D7: explicitly land user on Dashboard with correct title */
  if (typeof navigateTo === 'function') navigateTo('dashboard', '');
  showToast('Welcome to InspiredTax! Your profile is ready.', 'check_circle');
  
  // Re-run initialization steps that depend on profile data
  try {
    if (typeof onProvisionalChange === 'function') onProvisionalChange();
    if (typeof onIncomeTypeChange === 'function') onIncomeTypeChange();
  } catch(e) {
    console.error('obComplete post-init:', e);
  }
  /* V8.9 B3.7: ensure cards, deduction recommendations and provisional status reflect
     onboarding answers immediately on the landing screen */
  if (typeof refreshDerived === 'function') refreshDerived();
}

export function obInitializeBucketStatus(activeBuckets) {
  // Returns an object like { B1: 'amber', B2: 'inactive', ... }
  // Buckets selected in Master Income Question start as 'amber' (active but incomplete)
  // Others start as 'inactive'
  const allBuckets = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B9'];
  const status = {};
  allBuckets.forEach(bucket => {
    status[bucket] = activeBuckets.includes(bucket) ? 'amber' : 'inactive';
  });
  return status;
}

export function checkAndShowOnboarding() {
  // Called from startApp() to determine if onboarding should run
  // Returns true if onboarding was shown, false otherwise
  if (APP.onboardingCompleted) {
    return false; // Already completed, skip to dashboard
  }
  
  // Show onboarding for first-time users. OB.currentStep is in-memory and
  // outlives account switches (nothing else resets it) — without this, a
  // second account created on the same device re-opens onboarding wherever
  // the previous account last left it instead of at step 1.
  OB.currentStep = 1;
  OB.data = {};
  showOnboarding();
  return true;
}

/* C-1a: Tax residency event handlers.

   QA 2026-08: the question now offers two answers, not four. "Resident for
   only part of the year" and "I'm not sure" are gone, and so are the two
   inline notes they drove — a question with an "I don't know" option collects
   an answer nobody can act on, and the residency answer gates the whole
   calculation. Someone genuinely unsure is asked the foreign-income question
   on the next step instead, which is the fact that actually decides it.

   Legacy stored values are still READ (see normaliseResidency in
   08-dashboard-theme.js) — a return captured before this change may hold
   'part_year' or 'unsure', and silently reinterpreting either as "resident
   for the whole year" would change someone's tax without telling them. */
export function obOnTaxResidencyChange() {
  /* No inline notes left to toggle; kept as the radio group's onchange so the
     markup has one handler contract with the rest of the step. */
}

export function onProfileTaxResidencyChange() {
  const value = document.getElementById('p_tax_residency')?.value || 'full_year';
  APP.taxResidency = value;
  debounceSave();
  /* refreshDerived() runs renderAll(), whose first step is the residency gate
     (QA 2026-08) — so answering this question is what raises or clears the
     gate, with no separate path to keep in step. This is the ONLY control
     that can unblock a gated app, which is why the gate links straight to it. */
  if (typeof refreshDerived === 'function') refreshDerived();
}

/* ═══ Merged from former batch1 script block (V8.6+ patches) ═══ */
