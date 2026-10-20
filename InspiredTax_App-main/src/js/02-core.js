import { OTHER_RECEIPT_COST_KINDS, APP_SHARE_MESSAGE, SUPPORT_EMAIL, FIELD_CHECKS, KAT_REACTIONS, KAT_IDLE_MS, STEP_TRANSITION, PLAUSIBILITY_RULES, CAPTURE_ROUTES, FOREIGN_SCENARIO_CATEGORIES, SCENARIO_QUESTIONS, defaultTaxYear,FOREIGN_DIVIDEND_TAXABLE_RATIO, FOREIGN_EXCHANGE_RATES, FX_CURRENCY_NAMES, getAvatarColours, getFact, getInitials, INCOME_CODE_SHORT, INCOME_TYPE_DEFS, INCOME_TYPE_GROUPS, IRP5_CODE_MAP, IRP5_DEDUCTIONS, IRP5_INCOME, ITR12_OTHER_INCOME, katHtml, MEDICAL_S6B, MS_ICON_SET, PAGE_HEADS, PHYSICAL_PRESENCE, PROVISIONAL_INCOME_TYPES, renderTaxFaqs, S10C_ANNUITY_CODES, S12T_EXCESS_CHARGE_RATE, SA_MEDICAL_AIDS, SA_MEDICAL_AIDS_COMMON, TAX_YEARS, FOREIGN_SERVICE_CODES, deductionCodeRoute } from './01-data.js';
import { updatePageHead, syncCodePicker, wizGoto } from './00-forms.js';
import { onIncomeCodeChange, renderProvTaxHub } from './03-income.js';
import { maybeOfferDedActivation, setTravelMethod, updateDrawerDeductions, updateDrawerIncomeCalcs, updateIncomeTabs } from './04-deductions.js';
import { addBusinessItem, addEmployerPaye, addIncomeItem, addIt3bItem, addOtherReceipt } from './05-list-modules.js';
import { cryptoTotals } from './06-crypto.js';
import { addRentalProperty, calcRentalNet, rentalShare } from './06a-rental.js';
import { addCgtAsset, cgtAggregate } from './06b-cgt.js';
import { openTaxGlance, refreshDerived, renderActRefInline, renderAll, renderRiskAssessment, renderTaxReturn } from './07-render-summary.js';
import { initTheme, renderDashboard, updateFAB } from './08-dashboard-theme.js';
import { initSliderValueEdit, renderOptimisation, updateProjection } from './09-projection.js';
import { initMonthlyPlannerMonth, updateCurrentYear } from './10-current-year-planner.js';
import { onHistYearChange, renderRateTableInline } from './11-historical.js';
import { _showError, checkAndShowOnboarding, obComplete } from './12-bootstrap-onboarding.js';
import { a11yWireInfoBtns, applyPriorYear, updateAllDirtyBanners, initProfileDeductionQs, pySig, updateIncomeDirtyBanners, updatePriorYearDirty } from './13-patches.js';
import { getEntitlement, entInit, entBumpClock, entUnlocked, entOnLockedTap, entRefreshUi, entResumeSync, SK_DEVICE } from './14-entitlement.js';
import { entGateScreen, renderSubscribePanel, entShowWelcomeIfNeeded } from './15-entitlement-ui.js';
import { syncDobSelectFromHidden } from './16-dob-selector.js';
import { cloudBackupNoteSaved, cloudBackupNoteStep, cloudBackupSessionStart, cloudBackupActive, cloudBackupOnLock, cloudBackupOnLogout, cloudBackupDeleteRequested, renderCloudDeleteOffer, refreshCloudBackupRow, cloudBackupHasCopiesFor } from './18-cloud-backup-ui.js';

/* ============================================================
   InspiredTax v8.5 — CORE: STATE, STORAGE, AUTH, NAVIGATION, TAX ENGINE
   ============================================================ */

/* ── STORAGE KEYS ── */
export const SK = {
  USERS: 'iss_users',
  SESSION: 'iss_session',
  DEVICE: 'iss_device',
  data: u => `iss_data_${u}`,
  /* BAK-6/OD-41 (§L.9): when the user last ran a manual export (JSON or
     CSV) — the honest thing the backup card can show today, distinct from
     the local snapshot mtime it was mislabelling as "auto backup". A
     timestamp only, never PII, so hard rule 8 does not apply. */
  lastExport: u => `iss_last_export_${u}`,
  /* QR10a.2: this profile's cloud-backup record (17-cloud-backup.js) — enabled,
     timestamps, last result, data fingerprint, counters. Plain and non-PII; the
     bound Google account e-mail is sealed in the registry (PII_FIELDS). */
  cloudBackup: u => `iss_cloud_backup_${u}`
};

/* Mode → screen-key prefix, e.g. 'deductions' → 'ded', 'projection' → 'proj'.
   The single source for a mapping that was hand-duplicated across seven call
   sites (02-core.js x4, 00-forms.js, 15-entitlement-ui.js x2) — NAV-4's
   removal of the 'historical' mode required editing all seven in lockstep,
   which is exactly the failure mode a shared constant exists to prevent.
   Every mode not listed here is its own prefix (dashboard, actref, taxfaqs,
   subscribe) — callers that need that fallback do `|| mode` themselves;
   switchTab() deliberately does NOT, since an undefined prefix there means
   "this mode has no tab bar", used to early-return. OD-18 (2026-09) removed
   'provtax' as a mode entirely — it is now the 'provtax' tab of 'summary'. */
export const MODE_PREFIX_MAP = {
  income: 'income', deductions: 'ded', summary: 'summary',
  projection: 'proj'
};

/* ── V8.3 §3 CRYPTO MODULE — PIN auth + AES-GCM at-rest encryption ──
   Uses WebCrypto API (subtle): PBKDF2-SHA-256 for PIN → AES key derivation,
   AES-GCM-256 for payload encryption. Key is held in memory only, never
   persisted. Auto-lock drops the key after 5 min idle / backgrounded. */

export const PBKDF2_ITERATIONS = 200000;  // OWASP 2023 minimum for PBKDF2-SHA-256
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;  // longer PINs raise offline brute-force cost ~10^4x
export const AUTO_LOCK_MS = 5 * 60 * 1000;  // 5 minutes
export const STORAGE_VERSION = 3;  // V8.3 encrypted format marker

/* Base64 helpers */
export function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
export function strToBuf(s) { return new TextEncoder().encode(s); }
export function bufToStr(b) { return new TextDecoder().decode(b); }
export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/* PBKDF2 → CryptoKey */
export async function deriveKey(pin, saltBuf, purpose) {
  // purpose: 'verify' = derive 256-bit verification hash;
  //          'encrypt' = derive AES-GCM-256 key
  const baseKey = await crypto.subtle.importKey(
    'raw', strToBuf(pin), 'PBKDF2', false, ['deriveBits', 'deriveKey']
);
  if (purpose === 'verify') {
    const bits = await crypto.subtle.deriveBits(
      { name:'PBKDF2', salt:saltBuf, iterations:PBKDF2_ITERATIONS, hash:'SHA-256' },
      baseKey, 256
);
    return bufToB64(bits);
  }
  // encrypt
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt:saltBuf, iterations:PBKDF2_ITERATIONS, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:256 },
    false,  // not extractable
    ['encrypt', 'decrypt']
);
}

/* AES-GCM encrypt/decrypt */
export async function aesEncrypt(key, plaintext) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, strToBuf(plaintext));
  return { iv: bufToB64(iv), ciphertext: bufToB64(ct) };
}
export async function aesDecrypt(key, ivB64, ctB64) {
  const iv = new Uint8Array(b64ToBuf(ivB64));
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, b64ToBuf(ctB64));
  return bufToStr(pt);
}

/* Auth / lock state — held in memory only. Never persisted. */
export const AUTH = {
  pinKey: null,        // CryptoKey for AES-GCM (current user)
  pinHash: null,       // verification hash (b64) — for PIN check
  pinSalt: null,       // PBKDF2 salt for verify (Uint8Array)
  dataSalt: null,      // PBKDF2 salt for encrypt key (Uint8Array)
  unlocked: false,
  lockTimer: null,
  lockDeadlineAt: null, // wall-clock ms the current lock timer fires at — drives
                        // the drawer's lock countdown (design handoff 07 §F)
  backgroundedAt: null, // wall-clock ms when the page was hidden — setTimeout is
                        // suspended by the OS while backgrounded on Android, so
                        // resume must check elapsed real time, not trust the timer
  pinAttempts: 0,
  pii: null            // decrypted registry PII {dob,email,taxRef} — memory only
};

export function _resetAuth() {
  AUTH.pinKey = null;
  AUTH.pinHash = null;
  AUTH.pinSalt = null;
  AUTH.dataSalt = null;
  AUTH.unlocked = false;
  AUTH.pinAttempts = 0;
  AUTH.pii = null;
  AUTH.backgroundedAt = null;
  AUTH.lockDeadlineAt = null;
  if (AUTH.lockTimer) { clearTimeout(AUTH.lockTimer); AUTH.lockTimer = null; }
}

/* Auto-lock: 5-min idle + Page Visibility */
export function _bumpLockTimer() {
  if (!AUTH.unlocked) return;
  if (AUTH.lockTimer) clearTimeout(AUTH.lockTimer);
  AUTH.lockTimer = setTimeout(_lockApp, AUTO_LOCK_MS);
  AUTH.lockDeadlineAt = Date.now() + AUTO_LOCK_MS;
  katNoteActivity();   // QR11: the same "the user did something" signal wakes an idle mascot
}
/* reason: 'auto_lock' (idle timeout, the default) | 'backgrounded' — passed
   through to showLockScreen() so the lock screen can name why it locked
   (design handoff 04-lock-screen.md §3). */
export async function _lockApp(reason = 'auto_lock') {
  if (!AUTH.unlocked || !APP.user) return;
  /* Bug found alongside the local-backup work below: persistData()'s actual
     write is queued asynchronously (_enqueueWrite), so the old fire-and-
     forget `persistData();` here could — and, verified, reliably did — let
     AUTH.pinKey get nulled before the queued write ran, silently dropping
     the final save before lock ("Cannot persist: no key in memory"). Now
     awaited so the write completes while the key is still available. */
  try { await persistData(); } catch(e) { console.error('lock persist:', e); }
  /* Refresh the local Auto Backup snapshot on every natural "end of
     session" point — before AUTH.pinKey is cleared below, since encryption
     needs it. Fire-and-forget; never blocks locking. */
  try { writeLocalBackupSnapshot(); } catch(e) { console.error('lock backup snapshot:', e); }
  /* QR10a.4: the cloud backup's end-of-session trigger. Like the local snapshot
     it builds its envelope NOW — synchronously inside this call, before
     AUTH.pinKey is cleared on the next line — and lets the upload finish after
     the screen locks. Never interactive; a no-op while the kill-switch is off. */
  try { cloudBackupActive(false); cloudBackupOnLock(); } catch(e) { console.error('lock cloud backup:', e); }
  AUTH.pinKey = null;
  AUTH.unlocked = false;
  AUTH.backgroundedAt = null;
  AUTH.lockDeadlineAt = null;
  if (AUTH.lockTimer) { clearTimeout(AUTH.lockTimer); AUTH.lockTimer = null; }
  showLockScreen(reason);
}
export function _onVisibilityChange() {
  if (document.hidden && AUTH.unlocked) {
    // Background → record wall-clock time and start a 5-min countdown to lock.
    // The countdown alone isn't reliable: Android suspends page JS timers while
    // backgrounded, so a long background stay never fires it — the elapsed-time
    // check below on return is what actually enforces the lock in that case.
    AUTH.backgroundedAt = Date.now();
    try { cloudBackupActive(false); } catch(e) { console.warn('cloudBackupActive:', e); }   // QR10a: foreground time only
    if (AUTH.lockTimer) clearTimeout(AUTH.lockTimer);
    AUTH.lockTimer = setTimeout(() => _lockApp('backgrounded'), AUTO_LOCK_MS);
    AUTH.lockDeadlineAt = Date.now() + AUTO_LOCK_MS;
  } else if (!document.hidden && AUTH.unlocked) {
    const wasBackgroundedAt = AUTH.backgroundedAt;
    AUTH.backgroundedAt = null;
    if (wasBackgroundedAt && (Date.now() - wasBackgroundedAt) >= AUTO_LOCK_MS) {
      _lockApp('backgrounded');
      return;
    }
    _bumpLockTimer();
    /* Monetization M3 (00-DESIGN §3.6): re-sync billing + trial anchor on
       every return to foreground — same listener, extended at source. */
    try { entResumeSync(); } catch(e) { console.warn('entResumeSync:', e); }
    /* QR10a.5: a natural moment for the cloud-backup reminder (QD-08). */
    try { cloudBackupActive(true); } catch(e) { console.warn('cloudBackupActive:', e); }
  }
}
export function _wireLockTriggers() {
  ['click','keydown','touchstart','scroll','mousemove'].forEach(ev =>
    document.addEventListener(ev, _bumpLockTimer, { passive:true, capture:true }));
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

/* PIN entry / setup screen rendering — design handoff 04-lock-screen.md.
   Keypad-driven; the hidden #lock-pin-input stays in the DOM for hardware
   keyboards/a11y but is never auto-focused (§1: focusing it pops the
   Android software keyboard over the app's most-seen screen). */
let _lockBuffer = '';
let _lockKeypadWired = false;
let _lockWelcomeText = 'Welcome back';
const LOCK_REASON_COPY = {
  auto_lock: 'Locked after five minutes idle. Your figures were saved before locking.',
  backgrounded: 'Locked because the app was in the background. Nothing was lost.',
  cold_start: "Enter your PIN to decrypt this device's tax data.",
};

export function showLockScreen(reason) {
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('card-signin').style.display = 'none';
  $('card-create').style.display = 'none';
  const lockCard = $('card-lock');
  if (lockCard) lockCard.style.display = 'block';

  const users = getUsers();
  const user = users.find(x => x.username === APP.user);

  /* BACKLOG 71: the name is sealed PII, so the lock screen greets the profile by its username. */
  _lockWelcomeText = 'Welcome back' + (user ? ', @' + user.username : (APP.user ? ', @' + APP.user : ''));
  const title = $('lock-title'); if (title) title.textContent = _lockWelcomeText;
  const reasonEl = $('lock-reason'); if (reasonEl) reasonEl.textContent = LOCK_REASON_COPY[reason] || LOCK_REASON_COPY.cold_start;
  const err = $('lock-pin-error'); if (err) err.style.display = 'none';

  const brand = document.querySelector('.login-brand');
  if (brand) { brand.classList.add('lock-active'); brand.classList.remove('signin-active'); }
  _lockBuffer = '';
  const i = $('lock-pin-input'); if (i) i.value = '';
  _lockRenderDots(false);
  _lockSetKat('resting');
  _lockWireKeypad();
}
export function hideLockScreen() {
  const lockCard = $('card-lock');
  if (lockCard) lockCard.style.display = 'none';
  $('card-signin').style.display = 'block';
  const brand = document.querySelector('.login-brand'); if (brand) brand.classList.remove('lock-active');
}

/* Renders max(4, length+1) dots capped at 8 (§2). `wrong` reddens every
   filled dot and shakes the row (§4). */
function _lockRenderDots(wrong) {
  const el = $('lock-dots'); if (!el) return;
  const len = _lockBuffer.length;
  const count = Math.min(8, Math.max(4, len + 1));
  let html = '';
  for (let n = 0; n < count; n++) {
    const filled = n < len;
    html += '<span class="lock-dot' + (filled ? ' filled' : '') + (filled && wrong ? ' wrong' : '') + '"></span>';
  }
  el.innerHTML = html;
  if (wrong) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
}
function _lockSetKat(pose) {
  const wrap = $('login-lock-kat'); if (!wrap) return;
  const svg = wrap.querySelector('svg.kat');
  if (svg) { svg.setAttribute('class', 'kat mk ' + pose); }
  else { wrap.innerHTML = typeof katHtml === 'function' ? katHtml(pose, 66) : ''; }
}
function _lockWireKeypad() {
  if (_lockKeypadWired) return;
  _lockKeypadWired = true;
  const pad = $('lock-keypad'); if (!pad) return;
  pad.addEventListener('click', (ev) => {
    const key = ev.target.closest('.lock-key'); if (!key || key.classList.contains('lock-key-blank')) return;
    if (key.id === 'lock-key-del') { _lockDeleteDigit(); return; }
    const d = key.getAttribute('data-digit');
    if (d != null) _lockPressDigit(d);
  });
}
function _lockSyncHiddenInput() {
  const i = $('lock-pin-input'); if (i) i.value = _lockBuffer;
}
function _lockPressDigit(d) {
  if (_lockBuffer.length >= PIN_MAX_LENGTH) return;
  _lockBuffer += d;
  _lockSyncHiddenInput();
  _lockRenderDots(false);
  _lockSetKat('pointing');
  const err = $('lock-pin-error'); if (err) err.style.display = 'none';
  const title = $('lock-title'); if (title) title.textContent = _lockWelcomeText;
  if (_lockBuffer.length >= PIN_MIN_LENGTH) _lockTrySubmit();
}
function _lockDeleteDigit() {
  if (!_lockBuffer.length) return;
  _lockBuffer = _lockBuffer.slice(0, -1);
  _lockSyncHiddenInput();
  _lockRenderDots(false);
  _lockSetKat(_lockBuffer.length ? 'pointing' : 'resting');
}
/* Hardware-keyboard / paste path: mirrors whatever the hidden input now
   holds into the same buffer/dots/keypad flow the on-screen keys drive. */
export function onLockPinInput() {
  const i = $('lock-pin-input'); if (!i) return;
  _lockBuffer = (i.value || '').replace(/[^0-9]/g, '').slice(0, PIN_MAX_LENGTH);
  i.value = _lockBuffer;
  _lockRenderDots(false);
  _lockSetKat(_lockBuffer.length ? 'pointing' : 'resting');
  if (_lockBuffer.length >= PIN_MIN_LENGTH) _lockTrySubmit();
}

/* Silent multi-length probe (§2: "submit automatically once length >= 4 and
   the entered PIN validates; do not require a confirm key"). PINs are 4-8
   digits, so a candidate buffer of length 4-7 that doesn't verify might
   simply be a longer PIN still being typed — only a mismatch at the max
   length (8), or an explicit Enter/doUnlockFromLockScreen, is a real wrong
   attempt. */
async function _lockTrySubmit(force) {
  const pin = _lockBuffer;
  if (!_validatePin(pin)) return;
  const users = getUsers();
  const user = users.find(x => x.username === APP.user);
  if (!user) { const err = $('lock-pin-error'); if (err) { err.textContent = 'Session error.'; err.style.display = 'block'; } return; }
  try {
    const verifySalt = new Uint8Array(b64ToBuf(user.pinSalt));
    const candidateHash = await deriveKey(pin, verifySalt, 'verify');
    if (candidateHash === user.pinHash) {
      await _lockCompleteUnlock(user, pin);
      return;
    }
    if (pin.length >= PIN_MAX_LENGTH || force) _lockFail();
  } catch (e) {
    console.error('_lockTrySubmit:', e);
    if (pin.length >= PIN_MAX_LENGTH || force) _lockFail();
  }
}
function _lockFail() {
  AUTH.pinAttempts++;
  const remain = 5 - AUTH.pinAttempts;
  const title = $('lock-title'); if (title) title.textContent = 'Incorrect PIN';
  const err = $('lock-pin-error');
  if (err) {
    err.textContent = AUTH.pinAttempts >= 3
      ? 'Three incorrect attempts. Your data stays encrypted — there is no remote reset.'
      : `${remain} attempts remaining before a cooldown.`;
    err.style.display = 'block';
  }
  _lockRenderDots(true);
  _lockSetKat('resting');
  _lockBuffer = '';
  _lockSyncHiddenInput();
  if (AUTH.pinAttempts >= 5) setTimeout(doLogout, 1000);
}
async function _lockCompleteUnlock(user, pin) {
  const dataSalt = new Uint8Array(b64ToBuf(user.dataSalt));
  AUTH.pinKey = await deriveKey(pin, dataSalt, 'encrypt');
  AUTH.unlocked = true;
  AUTH.pinAttempts = 0;
  AUTH.pii = await _openUserPii(user);
  _bumpLockTimer();
  /* BACKLOG 70: a return after more than five minutes away locks before
     _onVisibilityChange reaches its entResumeSync(), and this unlock is not
     a cold start (startApp → entInit), so it resyncs here — billing, and the
     silent trial anchor only while unverified (DEVICE-CHECKS D3). */
  try { entResumeSync(); } catch(e) { console.warn('entResumeSync:', e); }
  _lockSetKat('celebrating');
  showUnlockOverlay();
  hideLockScreen();
  $('app').style.display = 'block';
  $('login-screen').style.display = 'none';
  setTimeout(hideUnlockOverlay, 1400);
}
/* §8: replaces the old showToast('Unlocked', …) — a scrim + medallion
   moment while the app genuinely decrypts, dismissed once the dashboard
   is ready rather than flashed over a screen the user is about to leave. */
function showUnlockOverlay() {
  const el = $('unlock-overlay'); if (el) { el.classList.add('show'); el.setAttribute('aria-hidden', 'false'); }
}
function hideUnlockOverlay() {
  const el = $('unlock-overlay'); if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
}
export function toggleForgotPinNote() {
  const note = $('lock-forgot-note'); if (note) note.classList.toggle('u-hidden');
}

/* RUNTIME STATE */
export const APP = {
  user: null,
  incomeItems: [],
  deductionItems: [],
  documents: [],
  monthlyPlan: Array.from({length:12}, () => ({income:0, paye:0, retirement:0, otherDed:0, status:'estimated'})),
  lumpSums: [],
  history: [],
  dedChecks: {},
  expectedCarriedBalances: {}, // Theme 8: onboarding/profile carried-balance flags
  carriedBalanceAnswers: {},   // Phase 1 (G2): binary yes/no behind the flags above
  /* STD-BEHAV-2/OD-17 (§L.8): set when a Toggle-Off confirm (confirmContradiction)
     has just synced a profile answer that isProvisionalAutoDetermined() reads.
     While true, updateProvisionalAutoStatus() stops writing p_provisional on
     its own — CONF-2 forbids a confirmation modal from moving that status,
     even as a side effect — and the Provisional screen shows a non-blocking
     notice instead. Cleared once the user reviews it there. */
  provisionalReviewNeeded: false,
  dedUserOverride: {},         // Phase 6 (F3): user turned a deduction off against their own setup answer
  foreignIncomeYN: 'no',       // Phase 1 (G1): gates Foreign Income discoverability
  /* INC-3 (§L.8): attestation gate -- once foreign income is declared
     AND something has been captured, the row needs this ticked before it
     counts as Completed ("confirm ALL foreign income has been captured").
     Reset to false whenever the declaration itself is withdrawn. */
  foreignIncomeAttested: false,
  /* QR7.1 (Q-ONB-1/2/3, QD-23, QD-24): the profile scenario answers that
     decide which low-frequency fields a capture form asks for. Keys:
     jointOwnership / cgtJointOwnership / minorChildAccount / tfsa
     ('yes'|'no'), foreign {categories, currencies} (layers 2-3 — layer 1
     stays APP.foreignIncomeYN, one source per question, WR-8) and
     reviewDismissed (the existing-user card). An ABSENT key is an
     unanswered question and means SHOW the field (QD-24): nothing an
     existing user sees disappears on upgrade. Not personal data — no names
     or ids — so it is saved through the normal encrypted payload, not
     _sealUserPii. Read only through scenarioAllows() below. */
  profileScenarios: {},
  appliedValues: {},   // V8.4 B3: committed values — only updates on Apply press
  pendingValues: {},   // V8.4 B3: live calculator outputs — staged until Apply pressed
  charts: {},
  travelMethod: 'deemed',
  toolsWtItems: [],    // tools & equipment W&T asset schedule
  cgtAssets: [],       // CGT disposals
  rentalProperties: [], // rental properties
  donationItems: [],   // donation entries
  employerPaye: [],    // V8.4 II.3: per-employer PAYE/UIF entries (replaces single paye_deducted field)
  noPayeConfirmed: false, // QA 2026-08 (B2-BUG-5): user confirmed their employer withheld no PAYE
  milestones: {},      // V8.4 I.4: manual milestone done-marks
  facts: {},           // V8.5: per-bucket fact store {bucket_id: {factKey: value, ...}}
  cryptoDisposals: [], // v8.16: crypto disposal records
  cryptoRevenue:   [], // v8.16: crypto revenue records (mining/staking/other)
  tfiItems: [],              // QR9a (QD-12): tax-free investments (s12T), one per institution/account
  tfiPriorContributions: 0,  // QR9a: contributions in earlier years, for the s12T lifetime limit
  overrides: {},       // D2: user-dismissed outstanding-item warnings (persisted)
  easyView: false       // Q-NEW-2: opt-in larger type scale, per profile, off by default
};

/* ── HELPERS ── */
export const $ = id => document.getElementById(id);
/* gv reads a numeric field. Inputs may now carry display masks ("R 1 234",
   "12.5%"), so parse through parseFmt — it strips the Rand sign, the % and the
   space thousands-separators and returns a clean number (plain "600000" is
   unaffected). This is the single hardening point that keeps the tax engine
   correct regardless of input masking. */
export const gv = id => { const e=$(id); return e ? parseFmt(e.value) : 0; };
export const gs = id => { const e=$(id); return e ? e.value||'' : ''; };
export const sv = (id, val) => { const e=$(id); if(e && val!=null && val!=='') e.value=val; };
/* §8 M-5: fmt() and pct() coerce non-finite values to a safe baseline.
   Number(v||0) handles null/undefined/0/false but allows NaN and Infinity through.
   isFinite(n) is true only for finite numbers; we treat anything else as 0. */
/* STD-NUM-1 (design-system-audit-2026-09, ROW-5/ROW-6/DIP-3/DASH-5): an amount
   is one unbreakable token. This runtime's en-ZA grouping separator already
   renders as U+00A0 (verified), but that is an ICU/CLDR detail that can vary
   by platform version — do not depend on it. Force every space non-breaking
   explicitly (the "R"-to-number gap AND any grouping space toLocaleString
   produces) rather than trust the locale data to keep doing it. parseFmt()
   needs no matching change: \s already matches U+00A0. */
export const fmt = v => {
  const n = Number(v);
  return ('R ' + (Number.isFinite(n) ? n : 0).toLocaleString('en-ZA', {minimumFractionDigits:0, maximumFractionDigits:0}))
    .replace(/\u00A0|\u0020/g, '\u00A0');
};
export const parseFmt = s => {
  const clean = (s||'').replace(/[^\d,.\-]/g,'').replace(/\s/g,'');
  const parts = clean.split(/[.,]/);
  if(parts.length <= 1) return parseFloat(clean)||0;
  const dec = parts.pop();
  return parseFloat(parts.join('') + '.' + dec) || 0;
};
export const pct = v => {
  const n = Number(v);
  return (Number.isFinite(n) ? (n*100).toFixed(1) : '0.0') + '%';
};

/* ── QR2.5 (Q-MOT-3, RET-03, QD-20) · count-up ──
   Lives here, not in 08-dashboard-theme.js, so navigateTo() below can call it
   without a circular import (08-dashboard-theme.js already imports navigateTo
   FROM this file).

   Every counted figure — .dhero-num, .mini-val, .reward-fig — is rebuilt via
   innerHTML on each render (05-list-modules.js et al never patch a number in
   place), so a per-element dataset flag resets on every render and would
   re-animate from 0 on every keystroke. _lastShown is keyed by the element's
   own data-count-key instead, so "changed since it was last actually shown"
   survives the element itself being thrown away and rebuilt.

   QD-20: animate only the first time a figure is VISIBLE after its value
   changes — not at render into a hidden panel, and not again if the visible
   value already matches what was last shown. An invisible figure is left
   untouched (its freshly-rendered static text is already the correct final
   value; there is nothing to animate for a value nobody is looking at) and
   is picked up next time something calls animateHeroFigures() while it is
   actually on screen — the render-chain invariant check (tests/smoke.js)
   relies on that call happening both at the end of renderAll() and at the
   end of navigateTo(), covering "value changed while showing" and "panel
   just became visible" respectively. */
const _lastShown = new Map();

function isOnScreen(el) {
  /* Plain checkVisibility() (no options) checks display/rendering only, not
     opacity — so a panel mid-fadeSlideIn (main.css) still counts as visible
     here, unlike tests/smoke.js's own geometry checks, which deliberately
     wait out that animation before measuring. */
  /* QR11: a panel or step that is being LEFT stays displayed while it fades
     out (.area-leave / .wiz-leave). It is on its way off screen, so a figure
     inside it is not "shown" — counting it would animate, and mark as seen, a
     figure on the page the user has just walked away from. */
  if (el.closest && el.closest('.area-leave, .wiz-leave')) return false;
  return el.checkVisibility ? el.checkVisibility() : !!el.offsetParent;
}

export function countUp(el, target, fmtFn, from) {
  if (!el) return;
  const format = fmtFn || fmt;
  const start = from == null ? 0 : from;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = format(target);
    return;
  }
  const ms = 600, t0 = performance.now();
  el.dataset.counted = '1';
  (function step(now) {
    const p = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(start + (target - start) * eased));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

export function animateHeroFigures(root) {
  (root || document).querySelectorAll('[data-count][data-count-key]').forEach(el => {
    const v = parseFloat(el.getAttribute('data-count'));
    if (isNaN(v)) return;
    const key = el.dataset.countKey;
    /* Stamp countTo synchronously, before any animation frame — the
       render-chain invariant check reads this the instant a panel becomes
       visible, not after 600ms. */
    el.dataset.countTo = String(v);
    if (!isOnScreen(el)) return; // don't touch _lastShown for a figure nobody sees
    const last = _lastShown.has(key) ? _lastShown.get(key) : 0; // first-ever sight: count up from 0, same as boot always did
    _lastShown.set(key, v);
    if (last === v) return; // visible and unchanged since it was last shown — nothing to animate
    countUp(el, v, null, last);
  });
}

/* ══════════════════════════════════════════════════════════════
   QR11 — MOTION: mascot reactions and screen transitions
   Approved prototype: _mockups/qa-remediation-2026-09-motion.html
   (QD-21, QD-22). All of it is decoration on top of changes the app has
   already made: nothing here delays a navigation, a save or a step, and
   under prefers-reduced-motion the transitions never start and a reaction
   is a still pose.
   ══════════════════════════════════════════════════════════════ */
function _motionReduced() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* The mascot an event can show on: the first one visible on the current page.
   The app has no mascot of its own on most pages (owner, 2026-10-02: react
   only where one already is), so on those an event simply shows nothing.
   Never while a modal is open — the mascot is behind it — or the tab is hidden. */
function _katTarget() {
  if (document.hidden || document.querySelector('.modal-overlay.open')) return null;
  return Array.from(document.querySelectorAll('.mode-panel.active .kat'))
    .find(el => el.getClientRects().length > 0) || null;
}
function _katClear(el) {
  const cls = el.dataset.katReact;
  if (!cls) return;
  el.classList.remove('kat-react', cls);
  delete el.dataset.katReact;
  el.style.removeProperty('--kat-skip');
  if (_katLive && _katLive.cls === cls && el.getClientRects().length > 0) _katLive = null;
}
let _katPending = null, _katQueued = false;
/* One reaction at a time; a newer event replaces a pending or running one.
   The class goes on at the next frame, not here: the event usually fires in
   the middle of a save or a navigation whose re-render is about to replace
   the mascot's node, and a class put on the old node would be thrown away. */
export function katReact(event) {
  if (!KAT_REACTIONS[event]) return;
  _katPending = event;
  if (_katQueued) return;
  _katQueued = true;
  requestAnimationFrame(_katFlush);
}
function _katFlush() {
  _katQueued = false;
  const event = _katPending; _katPending = null;
  const el = event && _katTarget();
  /* Any other mascot still wearing a reaction was left mid-reaction on a page
     that is no longer showing (a hidden animation never ends, and its cancel
     event is not dependable). Every navigation raises 'entry', so this runs
     before that mascot can be seen again. */
  document.querySelectorAll('.kat.kat-react').forEach(k => { if (k !== el) _katClear(k); });
  if (!el) return;
  /* A mascot drawn pointing is standing next to a "Still to add" list — on
     arrival it points at it rather than waves. */
  const cls = (event === 'entry' && el.classList.contains('pointing')) ? KAT_REACTIONS.outstanding : KAT_REACTIONS[event];
  _katClear(el);
  el.classList.remove('kat-idle', 'bored', 'resting');
  void el.getBoundingClientRect();   // one layout read, before anything moves, so a repeat of the same reaction restarts
  el.classList.add('kat-react', 'kat-done', cls);
  el.dataset.katReact = cls;
  _katLive = { cls, at: performance.now() };
}
/* BACKLOG 13(a): a render inside a reaction rebuilds the mascot node (its
   page's innerHTML), so the class was lost mid-reaction. At the end of a
   render pass the live reaction is put back on the page's mascot, its
   animations offset by the time already run so it ends when it would have. */
let _katLive = null;
function _katRestore() {
  if (!_katLive) return;
  const el = _katTarget();
  if (!el || el.dataset.katReact) return;
  const elapsed = performance.now() - _katLive.at;
  el.classList.remove('kat-idle', 'bored', 'resting');
  el.classList.add('kat-react', 'kat-done', _katLive.cls);
  el.dataset.katReact = _katLive.cls;
  const dur = parseFloat(getComputedStyle(el).getPropertyValue('--kat-d')) * 1000 || 900;
  if (elapsed >= dur) { _katClear(el); _katLive = null; return; }
  el.style.setProperty('--kat-skip', '-' + Math.round(elapsed) + 'ms');
}
/* The reaction's own length is CSS (--kat-d on the root, run by katHold); the
   end of that animation is the only thing that takes the classes off.
   animationcancel as well as animationend: leaving the page mid-reaction
   hides the mascot's panel, which cancels the animation without ever ending
   it — the class would otherwise stay on the hidden mascot and replay the
   reaction the next time its page was shown. */
function _katHoldOver(e) {
  const t = e.target;
  if (e.animationName !== 'katHold' || !t || !t.dataset || !t.dataset.katReact) return;
  /* A cancel also fires when a NEWER reaction replaces this one on the same
     mascot (the class swap restarts katHold) — that one must be left alone.
     Only a mascot that is no longer rendered was cancelled by being hidden. */
  if (e.type === 'animationcancel' && t.getClientRects().length > 0) return;
  _katClear(t);
}
document.addEventListener('animationend', _katHoldOver);
document.addEventListener('animationcancel', _katHoldOver);

/* Long idle: after KAT_IDLE_MS.bored without input the mascot looks around,
   after KAT_IDLE_MS.resting it shuts its eyes; any input wakes it. Reset from
   _bumpLockTimer() — the app's one "the user did something" signal. */
let _katIdleBored = null, _katIdleRest = null;
function _katIdle(state) {
  const el = _katTarget();
  if (!el || el.dataset.katReact) return;
  el.classList.remove('bored', 'resting');
  el.classList.add('kat-idle', state);
}
export function katNoteActivity() {
  clearTimeout(_katIdleBored); clearTimeout(_katIdleRest);
  document.querySelectorAll('.kat.kat-idle').forEach(el => el.classList.remove('kat-idle', 'bored', 'resting'));
  if (_motionReduced()) return;
  _katIdleBored = setTimeout(() => _katIdle('bored'), KAT_IDLE_MS.bored);
  _katIdleRest  = setTimeout(() => _katIdle('resting'), KAT_IDLE_MS.resting);
}

/* The app's ONE "a step was completed" signal (QR10a.3 named it for the
   cloud-backup scheduler and promised QR11 would reuse it, not add a second).
   kind: a CRUD module's array name for a saved item, or 'deduction' /
   'provisional' / 'onboarding' for a completed step. */
const _KAT_STEP_KINDS = ['deduction', 'provisional', 'onboarding'];
export function noteStepCompleted(kind) {
  cloudBackupNoteStep(kind);
  katReact(_KAT_STEP_KINDS.includes(kind) ? 'step' : 'saved');
}

/* A plausibility note appearing is the "validation problem" event. Called by
   the three surfaces that render those notes with the note count; the mascot
   reacts when a surface goes from none to some, not on every keystroke. */
const _plausShown = new Map();
/* BACKLOG 13(b): only a note the user's own edit brings up raises the
   reaction. A surface's first evaluation, and any evaluation inside a
   renderAll() pass (first render, an import, a year switch — calcHomeOffice
   and the travel checks run there), are recorded silently; the direct
   oninput calls still react. */
let _renderPass = 0;
export function beginRenderPass() { _renderPass++; }
export function endRenderPass() {
  _renderPass = Math.max(0, _renderPass - 1);
  if (!_renderPass) _katRestore();
}
export function notePlausibility(surface, count) {
  const first = !_plausShown.has(surface);
  const had = _plausShown.get(surface) || 0;
  _plausShown.set(surface, count);
  if (first || _renderPass) return;
  if (count > 0 && had === 0) katReact('invalid');
}

/* Area change — the edge sweep (QD-22: page → page = B, 450ms; owner,
   2026-10-02: only when the AREA changes, so moves inside an area stay as
   quick as they were). Called by navigateTo() after it has swapped the
   panels. oldRect is the outgoing panel's rect, read before the swap: the
   panel is pinned there and fades at the midpoint while the new one fades
   in. Everything ends on animationend; a second navigation mid-sweep clears
   the first. */
function _screenLeaveDone(el) {
  el.classList.remove('area-leave', 'wiz-leave');
  el.style.top = el.style.left = el.style.width = '';
  el.inert = false;
}
function _areaSweep(oldPanel, oldRect, newPanel) {
  const sweep = $('area-sweep');
  if (!sweep || !newPanel || _motionReduced() || document.hidden) return;
  document.querySelectorAll('.mode-panel.area-leave').forEach(_screenLeaveDone);
  document.querySelectorAll('.mode-panel.area-enter').forEach(p => p.classList.remove('area-enter'));
  sweep.classList.remove('go');
  if (oldPanel && oldPanel !== newPanel && oldRect && oldRect.width) {
    oldPanel.style.top = oldRect.top + 'px';
    oldPanel.style.left = oldRect.left + 'px';
    oldPanel.style.width = oldRect.width + 'px';
    oldPanel.inert = true;   // visible for a moment longer, but not reachable
    oldPanel.classList.add('area-leave');
  }
  void sweep.offsetWidth;    // restart the bars if a sweep was already running
  newPanel.classList.add('area-enter');
  sweep.classList.add('go');
}
/* Wizard step → step (QD-22: A, the triangle tessellation; STEP_TRANSITION
   switches it to the sweep). Called by wizGoto() (00-forms.js) after it has
   switched steps, with the step being left and its offsets read before the
   switch. One overlay element, built on first use and moved to whichever
   modal is stepping. */
function _stepOverlay() {
  let t = $('step-tess');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'step-tess'; t.className = 'step-tess'; t.setAttribute('aria-hidden', 'true');
  let html = '';
  if (STEP_TRANSITION === 'B') html = '<i class="tB"></i><i class="tB two"></i>';
  else for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) for (let k = 0; k < 2; k++) {
    html += '<i class="tA' + (k ? ' b' : '') + '" style="left:' + (c * 12.5) + '%;top:' + (r * 16.6667).toFixed(4) + '%;--i:' + (r + c + k * 0.5) + '"></i>';
  }
  t.innerHTML = html;
  return t;
}
export function stepTransition(modal, fromStep, fromBox, toStep) {
  if (!modal || !toStep || fromStep === toStep || _motionReduced() || document.hidden) return;
  if (!modal.classList.contains('open')) return;   // wizGoto also runs to reset a modal that is not showing
  const sheet = modal.querySelector('.modal-sheet');
  if (!sheet) return;
  const r = sheet.getBoundingClientRect();           // one read, before anything moves
  const t = _stepOverlay();
  modal.querySelectorAll('.wiz-step.wiz-leave').forEach(_screenLeaveDone);
  modal.querySelectorAll('.wiz-step.wiz-enter').forEach(s => s.classList.remove('wiz-enter'));
  t.classList.remove('go');
  t.style.top = r.top + 'px'; t.style.left = r.left + 'px'; t.style.width = r.width + 'px'; t.style.height = Math.min(r.height, window.innerHeight - r.top) + 'px';
  modal.appendChild(t);                              // inside the modal, so it takes the modal's area colour
  if (fromStep && fromBox) {
    fromStep.style.top = fromBox.top + 'px';
    fromStep.style.left = fromBox.left + 'px';
    fromStep.style.width = fromBox.width + 'px';
    fromStep.inert = true;
    fromStep.classList.add('wiz-leave');
  }
  void t.offsetWidth;
  toStep.classList.add('wiz-enter');
  t.classList.add('go');
}
/* End of a transition: each layer cleans up after its own animation. The
   overlays stop on their LAST piece (the lighter second bar; the bottom-right
   triangle, which has the longest delay). */
document.addEventListener('animationend', function (e) {
  const t = e.target, n = e.animationName;
  if (!t || !t.classList) return;
  if (n === 'screenOut') _screenLeaveDone(t);
  else if (n === 'screenIn') t.classList.remove('area-enter', 'wiz-enter');
  else if ((n === 'sweepB' || n === 'tessA') && t.parentElement && t === t.parentElement.lastElementChild) t.parentElement.classList.remove('go');
});

/* C-3 (coverage-gap-analysis): SARS average-exchange-rate conversion,
   s25D(3) — translates a foreign-currency amount into Rand and writes the
   result straight into the target Rand field, so nothing downstream of
   that field changes (the engine only ever sees Rand, same as before this
   widget existed). widgetId is the fxWidgetHtml() instance's id prefix
   (00-forms.js); each foreign-amount field gets its own widget via that
   field's postFieldHtml, so this is called on every currency/amount edit
   within one specific widget. Rates: FOREIGN_EXCHANGE_RATES (01-data.js),
   Table A ("average exchange rate for a year of assessment") — a missing
   year/currency (not yet gazetted, or a currency outside the four
   populated) is disclosed, never guessed. */
const fxActiveYear = () => gs('taxYear') || '2027';

/* QR3.3 (Q-ONB-4, QD-11): populate every .fx-widget under `root` from the
   active year's FOREIGN_EXCHANGE_RATES keys. A year with no published rates
   shows the notice UP FRONT and hides the converter (no user-entered rate —
   a second rate source would be a second conversion path); the Rand field
   above is untouched. Runs from makeCrudModule()'s clear/load path (the
   per-record onForm route B7.7 uses) and from renderForeignSummary() for
   the two hand-written Foreign-page widgets. fxApply()'s own "not confirmed"
   message stays as the fallback for a currency missing within a populated
   year. */
export function fxRefreshWidgets(root) {
  const scope = root || document;
  const year = fxActiveYear();
  const rates = FOREIGN_EXCHANGE_RATES[year];
  /* QR7.5 (Q-ONB-3 layer 3): the currencies the user told us about come
     first, and with exactly one the converter starts on it. */
  const mine = (((APP.profileScenarios || {}).foreign || {}).currencies || []);
  const all = rates ? Object.keys(rates) : [];
  const codes = all.filter(c => mine.indexOf(c) >= 0).concat(all.filter(c => mine.indexOf(c) < 0));
  scope.querySelectorAll('.fx-widget').forEach(w => {
    const sel = w.querySelector('select');
    const grid = w.querySelector('.g2');
    const notice = w.querySelector('.fx-notice');
    if (!sel || !grid || !notice) return;
    if (codes.length) {
      notice.classList.add('u-hidden');
      grid.classList.remove('u-hidden');
      const keep = sel.value;
      sel.innerHTML = '<option value="">— select —</option>' + codes.map(k =>
        '<option value="' + esc(k) + '">' + esc(FX_CURRENCY_NAMES[k] ? FX_CURRENCY_NAMES[k] + ' (' + k + ')' : k) + '</option>').join('');
      if (codes.includes(keep)) sel.value = keep;
      else if (mine.length === 1 && codes.includes(mine[0]) && !sel.dataset.touched && !(w.querySelector('[id$="-amt"]') || {}).value) sel.value = mine[0];
    } else {
      notice.textContent = 'SARS has not yet published average exchange rates for ' + year + '. Enter the amount in rand using the rate you consider appropriate; you can convert it here once SARS publishes.';
      notice.classList.remove('u-hidden');
      grid.classList.add('u-hidden');
      sel.innerHTML = '<option value="">— select —</option>';
      grid.querySelectorAll('input').forEach(el => { el.value = ''; });
      const res = w.querySelector('[id$="-result"]'); if (res) res.style.display = 'none';
    }
  });
}

/* QR4.6 (Q-CPY-7, QD-19): the one plausibility evaluator and the one note
   renderer. `ruleIds` picks rows from PLAUSIBILITY_RULES (01-data.js); `ctx`
   is the surface's own numbers. The top marginal rate every rule may need is
   supplied here from the active tax year so no surface types it. Returns the
   notes that apply, in rule order; renders nothing itself. */
function plausibilityHits(ruleIds, ctx) {
  const ty = getActiveTaxYear();
  const brackets = (ty && ty.brackets) || [];
  const c = Object.assign({ topRate: brackets.length ? brackets[brackets.length - 1].rate : 0 }, ctx);
  return PLAUSIBILITY_RULES.filter(r => ruleIds.includes(r.id) && r.applies(c))
    .map(r => ({ id: r.id, level: r.level, blocksSave: !!r.blocksSave, text: r.text(c) }));
}
export function plausibilityNotes(ruleIds, ctx) {
  const notes = plausibilityHits(ruleIds, ctx);
  /* QR11: every surface that shows these notes gets them here, so this is the
     one place the mascot's "validation problem" event can be raised (WR-8).
     The rule set names the surface. */
  notePlausibility(ruleIds.join(','), notes.length);
  return notes;
}
export function plausibilityHtml(notes) {
  return notes.map(n => '<div class="note ' + (n.level === 'error' ? 'error' : 'warning') + '" style="margin:6px 0 0">'
    + '<i class="' + iconClassFor(n.level === 'error' ? 'warning' : 'info') + ' u-mr-5"></i>' + esc(n.text) + '</div>').join('');
}

/* QR4.2 (QX-CPY-1): show the option note for a select's current value.
   renderField() (00-forms.js) puts a `.opt-note` container after every select
   that has `optionNotes`; its data-optnotes attribute is the { value: { icon,
   html } } map, with '*' as the fallback for options without their own entry.
   The select's own onchange calls this (optNoteUpdate), and makeCrudModule()'s
   clear/load path calls refreshOptionNotes() because setting .value in code
   fires no change event. Note HTML is developer-authored (01-data.js
   OPTION_NOTES), never user text — hard rule 7 does not apply. */
/* ══════════════════════════════════════════════════════════════
   UI-NOTE-1 (owner 2026-10-05) — ONE NOTE COMPONENT
   A note is one short line; anything longer (the full explanation, its
   statutory reference) goes behind "More", which opens the shared help
   sheet (showInfoTip → _showPop). Nothing the old paragraph said is lost —
   it moves, it is not deleted. `short` and `detail` are developer-authored
   HTML (never user text: esc() any figure or name you put in them).
   - noteBody(short, detail, title): the inside of a .note
   - noteHtml(tone, short, detail, opts): a whole note
     opts: { icon, title, id, cls, style } */
export function noteBody(short, detail, title) {
  const more = detail
    ? '<button type="button" class="note-more" data-tip-long data-tip="' + esc('<strong>' + (title || short.replace(/<[^>]*>/g, '')) + '</strong>' + detail) + '" onclick="showInfoTip(this)">More</button>'
    : '';
  return '<span class="note-t">' + short + '</span>' + more;
}
export function noteHtml(tone, short, detail, opts) {
  opts = opts || {};
  const icon = opts.icon === false ? '' : '<i class="' + iconClassFor(opts.icon || (tone === 'warning' || tone === 'error' ? 'warning' : 'info')) + '" aria-hidden="true"></i>';
  return '<div class="note ' + (tone || 'info') + ' note-line' + (opts.cls ? ' ' + opts.cls : '') + '"'
    + (opts.id ? ' id="' + opts.id + '"' : '') + (opts.style ? ' style="' + opts.style + '"' : '') + '>'
    + icon + noteBody(short, detail, opts.title) + '</div>';
}
/* Fill an existing note element in place (the JS paths that set
   className/innerHTML on a fixed container). */
export function setNote(el, tone, short, detail, opts) {
  if (!el) return;
  opts = opts || {};
  el.className = 'note ' + (tone || 'info') + ' note-line' + (opts.cls ? ' ' + opts.cls : '');
  const icon = opts.icon === false ? '' : '<i class="' + iconClassFor(opts.icon || (tone === 'warning' || tone === 'error' ? 'warning' : 'info')) + '" aria-hidden="true"></i>';
  el.innerHTML = icon + noteBody(short, detail, opts.title);
}
/* An option note's html leads with its own bold label ("Airbnb or short-term
   let:") — the help sheet's title already says that, so drop it there. */
function _noteDetail(html) {
  const d = html.replace(/^<strong>[^<]*<\/strong>\s*/, '');
  return d.charAt(0).toUpperCase() + d.slice(1);
}
export function optNoteUpdate(selectId) {
  const sel = $(selectId), box = $(selectId + '-optnote');
  if (!sel || !box) return;
  let map;
  try { map = JSON.parse(box.dataset.optnotes || '{}'); } catch (e) { map = {}; }
  const n = map[sel.value] || map['*'];
  if (!n) { box.innerHTML = ''; box.classList.add('u-hidden'); return; }
  /* UI-NOTE-1: an entry with `short` is one line + More (html = the detail). */
  box.classList.toggle('note-line', !!n.short);
  box.innerHTML = '<i class="' + iconClassFor(n.icon || 'info') + (n.short ? '' : ' u-mr-5') + '" aria-hidden="true"></i>'
    + (n.short ? noteBody(n.short, _noteDetail(n.html), n.title) : n.html);
  box.classList.remove('u-hidden');
}
export function refreshOptionNotes(root) {
  (root || document).querySelectorAll('.opt-note').forEach(box => optNoteUpdate(box.id.replace(/-optnote$/, '')));
}

export function fxApply(targetFieldId, widgetId) {
  const curEl = $(widgetId + '-cur');
  if (curEl) curEl.dataset.touched = '1';   // QR7.5: a converter the user set is never re-preselected
  const currency = gs(widgetId + '-cur');
  const amtEl = $(widgetId + '-amt');
  const amount = amtEl ? parseFmt(amtEl.value) : 0;
  const resultEl = $(widgetId + '-result');
  if (!currency || !amount) {
    if (resultEl) resultEl.style.display = 'none';
    return;
  }
  const taxYear = fxActiveYear();
  const rates = FOREIGN_EXCHANGE_RATES[taxYear];
  if (!rates || rates[currency] == null) {
    if (resultEl) {
      resultEl.style.display = '';
      setNote(resultEl, 'warning', 'No SARS rate for ' + esc(currency) + ' yet — enter the Rand amount above.', null);
    }
    return;
  }
  const rate = rates[currency];
  const rand = Math.round(amount * rate);
  const target = $(targetFieldId);
  if (target) {
    target.value = rand;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (resultEl) {
    resultEl.style.display = '';
    setNote(resultEl, 'info', amount.toLocaleString('en-ZA') + ' ' + esc(currency) + ' × ' + rate.toFixed(4) + ' = <strong>' + fmt(rand) + '</strong>',
      'Converted at the SARS average exchange rate for tax year ' + taxYear + ' (s25D(3)).', { title: 'Exchange rate' });
  }
  /* S3 Batch 6 (C8): record the rate's provenance alongside the converted
     figure, for any caller that wants it kept on the record (so far only
     the employment modal's collect(), 05-list-modules.js — its hidden
     `${widgetId}-rate/-source/-date` fields; every other fxWidgetHtml()
     instance has no such fields, so this is a silent no-op there). */
  const rateEl = $(widgetId + '-rate'), sourceEl = $(widgetId + '-source'), dateEl = $(widgetId + '-date');
  if (rateEl) rateEl.value = rate;
  if (sourceEl) sourceEl.value = 'SARS average exchange rate (s25D(3)), tax year ' + taxYear;
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
}

/* Resolve a design token to a concrete colour string.
   Canvas cannot consume `var(--x)` the way CSS can, so anything drawn into a
   chart has to read the token's computed value instead. Without this, chart
   palettes were the one surface that kept its own hardcoded hexes and drifted
   away from the rest of the design system — and, being fixed, they stayed a
   dark-mode palette after a switch to light. */
export const cssColour = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback || '';
  } catch { return fallback || ''; }
};

/* ── INPUT MASKS ──────────────────────────────────────────────────────────
   Display-formatting for amount fields. The underlying value stays parseable
   by gv()/parseFmt(). Conventions:
     .mask-rand  currency, "R x xxx" — no cents, space thousands, no leading 0
     .mask-pct   percentage, "x.x%" — one decimal place
     .mask-int   integer, "x" — digits only, no leading 0
   Inputs carrying these classes are type=text so the symbols/spaces render. */
/* TB-1 (design-system-audit-2026-09): reassigning el.value moves the caret to
   the end by default — every keystroke anywhere but the tail of an
   already-multi-digit amount ejects the caret to the end, which reads as
   "the field locks after one digit" on an Android IME. Restore position by
   DIGIT COUNT rather than raw character offset: the formatting characters
   (spaces, "R ", "%", the decimal point) shift independently of where the
   user is typing, but digits never get reordered by any of the three masks
   below, so "N digits were before the caret" is the one measure that survives
   the reformat unchanged. */
function _caretDigitsBefore(str, pos) {
  let n = 0;
  for (let i = 0; i < pos && i < str.length; i++) if (/\d/.test(str[i])) n++;
  return n;
}
function _posAfterNDigits(str, n) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) { seen++; if (seen === n) return i + 1; }
  }
  return str.length;
}
function _withCaretPreserved(el, reformat) {
  const pos = el.selectionStart;
  const hasCaret = pos != null; // masked fields are always type=text, but stay defensive
  const digitsBefore = hasCaret ? _caretDigitsBefore(el.value, pos) : 0;
  reformat();
  if (hasCaret) {
    const newPos = _posAfterNDigits(el.value, digitsBefore);
    try { el.setSelectionRange(newPos, newPos); } catch (e) { /* non-text input types can throw — never true here, kept defensive */ }
  }
}
export function maskRand(el) {
  _withCaretPreserved(el, () => {
    const raw = String(el.value);
    /* S2 Batch 4 (found via TEST-4): \D matches "." too, so a cents value
       (typed, pasted, or restored from a saved capture — a real IRP5 amount
       can be fractional) used to have its decimal point silently dropped
       and every digit concatenated: "12345.55" -> "1234555", ~100x too
       large, corrupting a real deduction on the very next render. This
       field is whole-rand-only (matches fmt()'s own minimumFractionDigits:0
       display), so a decimal present means round to the nearest rand
       instead — never re-concatenate across it. */
    if (/[.,]/.test(raw)) {
      const n = Math.round(parseFmt(raw));
      el.value = n > 0 ? 'R ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
      return;
    }
    const d = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    /* STD-NUM-1: hand-rolled grouping (no ICU here, unlike fmt()'s
       toLocaleString) — use \u00A0 directly so a masked field is exactly
       as unbreakable as fmt()'s own display output. */
    el.value = d ? 'R\u00A0' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') : '';
  });
}
export function maskPct(el) {
  _withCaretPreserved(el, () => {
    let v = String(el.value).replace(/[^\d.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, ''); // one dot only
    v = v.replace(/^0+(?=\d)/, '');                                                // no leading 0
    if (v === '') { el.value = ''; return; }
    const [whole, frac] = v.split('.');
    el.value = (frac !== undefined ? (whole || '0') + '.' + frac.slice(0, 1) : whole) + '%';
  });
}
export function maskInt(el) {
  _withCaretPreserved(el, () => {
    el.value = String(el.value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  });
}
export function maskApply(el) {
  if (!el || !el.classList) return;
  if (el.classList.contains('mask-rand')) maskRand(el);
  else if (el.classList.contains('mask-pct')) maskPct(el);
  else if (el.classList.contains('mask-int')) maskInt(el);
}
/* Reformat every masked field within root from its current raw value — call
   after any programmatic load (renderAll, modal open) so saved numbers show
   masked, not as bare digits. */
export function maskAll(root) {
  (root || document).querySelectorAll('.mask-rand, .mask-pct, .mask-int').forEach(el => {
    if (el.value !== '') maskApply(el);
  });
}
/* Mask on the way in. Capture phase so the field reformats BEFORE its own
   oninput handler reads the value via gv(). */
document.addEventListener('input', e => { maskApply(e.target); }, true);

export let _saveTimer;
export const debounceSave = () => { clearTimeout(_saveTimer); _saveTimer = setTimeout(persistData, 600); };

/* B4 Simplification (01-SPEC.md §3.2, item 42): the outstanding-item dismiss
   toggle is GONE. A checkbox that hid a reminder without changing anything
   let a real gap in a return look resolved. There is now one way to make an
   outstanding item go away: capture it, or tell the app it does not apply —
   which the selector toggles do, writing back to the Profile answer.

   APP.overrides itself stays in the persistence contract (02-core hydrate +
   persist) so saved data with dismissals round-trips harmlessly. Nothing
   reads it any more: renderDashboardOutstanding (retired), 
   renderOutstandingBottom and renderDeductionsOutstanding were its only
   consumers, and all three were checked before this writer was deleted. */

/* Batch 2 — SARS Account page two-way sync. A carried-balance value (e.g.
   assessed loss) has ONE canonical input on its home page (e.g. py_loss on
   Income main) and a mirror input on the SARS Account page. The canonical
   field stays the single source of truth — the mirror never becomes its own
   state; renderCarriedBalances()'s mirrorIn() repaints it from canonical on
   every render.

   Copies `fromId`'s value into `toId`, saves, and re-renders everything, so
   both displays and the tax calc stay consistent immediately.

   UI-B2: used in BOTH directions, hence the neutral parameter names. The
   mirror→canonical direction is the original Batch 2 case. The
   canonical→mirror direction exists because `_autoApplyFromEvent` only
   auto-applies ids prefixed `py_`, and two carried balances are not —
   `ftc_bf` and `cgt_loss_bf`. Their oninput therefore never reached a
   renderAll() of its own, so the SARS Account row mirroring them lagged
   until some unrelated interaction forced a fuller re-render. */
export function syncCarriedField(fromId, toId) {
  const m = $(fromId), c = $(toId);
  if (!m || !c) return;
  c.value = m.value;
  debounceSave();
  if (typeof renderAll === 'function') renderAll();
}

/* ── TAX ENGINE HELPERS ── */
export function getActiveTaxYear() {
  return TAX_YEARS[gs('taxYear')] || TAX_YEARS['2027'];
}
/* §8 M-5: returns a Date object if input parses to a valid Date, or null.
   Guards against:
     - empty / null / undefined input
     - garbage strings ('not-a-date')
     - out-of-range components ('1980-99-99' which JS silently accepts elsewhere) */
export function _safeDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
/* Residency is either "resident all year" or "not a resident" now — the
   part-year and unsure answers were removed from the onboarding question and
   the profile mirror (QA 2026-08). A return captured before that change can
   still hold one of them, so both are still RECOGNISED here rather than being
   silently read as "resident for the whole year": quietly reinterpreting a
   stored 'non_resident' as a resident would change someone's tax without
   telling them. Lives here, with APP, so the dashboard and the tax return
   read one definition. */
export function normaliseResidency(v) {
  return (v === 'part_year' || v === 'non_resident' || v === 'unsure') ? v : 'full_year';
}

export function calcAgeAtYearEnd() {
  const dob = gs('modal-dob') || gs('p_dob_hidden');
  const yr = gs('taxYear') || '2027';
  const b = _safeDate(dob);
  if(!b) return 0;
  const endYr = parseInt(yr, 10);
  if (!Number.isFinite(endYr)) return 0;  // §8 M-5: bad tax year → no age calc
  const end = new Date(endYr, 2, 0);  // L-1 fix: last day of Feb (handles leap years correctly)
  let age = end.getFullYear() - b.getFullYear();
  if(end.getMonth() - b.getMonth() < 0 || (end.getMonth() === b.getMonth() && end.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}
export function calcTaxOnIncome(taxableIncome, brackets) {
  // §8 M-5: tolerate non-finite numeric input and missing/empty brackets
  if (!Array.isArray(brackets) || brackets.length === 0) return 0;
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) return 0;
  // s5(2)(c): taxable income is rounded down to the nearest rand before the
  // tables apply — the bracket `min` convention in TAX_YEARS relies on this.
  taxableIncome = Math.floor(taxableIncome);
  for(let i = brackets.length-1; i >= 0; i--) {
    if(taxableIncome >= brackets[i].min)
      /* s5(2) read with the annual Rates and Monetary Amounts Act tables: the
         SARS formula method is `base + rate x (taxable income ABOVE the
         bracket THRESHOLD)`, where `base` is the cumulative tax AT that
         threshold -- i.e. the top of the previous bracket. The TAX_YEARS /
         HIST_TAX convention stores `min` as threshold+1 (237101, not 237100),
         so the amount above the threshold is `taxableIncome - (min - 1)`.
         Subtracting `min` understated tax by rate x R1 in every bracket above
         the first. The data tables are their own oracle here: tax at a
         bracket's `max` must equal the NEXT bracket's `base` (42678 + 26% x
         (370500 - 237100) = 77362 = brackets[2].base), which only holds for
         `min - 1`. Gated by the bracket-base chain check in
         tests/invariants.js. calcLumpsumTax uses the identical form. */
      return brackets[i].base + (taxableIncome - (brackets[i].min === 0 ? 0 : brackets[i].min - 1)) * brackets[i].rate;
  }
  return 0;
}
export function calcRebates(age, ty) {
  let r = ty.rebates.primary;
  if(age >= 65) r += ty.rebates.secondary;
  if(age >= 75) r += ty.rebates.tertiary;
  return r;
}
/* ── MEDICAL TAX CREDITS s6A + s6B ──
   V8.4 V.7: Inputs are now ANNUAL contribution totals (formerly monthly).
   V8.4 V.8: 7.5% threshold applied for under-65 no-disability; correct excess-contributions logic.
   SARS Comprehensive Guide on Medical Tax Credits, Issue 17:
     Under 65, no disability:
        AMTC = 25% × max(0, [max(0, contrib − 4 × s6A) + OOP] − 7.5% × taxable income)
     65+ OR taxpayer/spouse/child disabled:
        AMTC = 33.3% × [max(0, contrib − 3 × s6A) + OOP]   (no 7.5% threshold) */
export function calcS6ACredit(ty, isMain, deps) {
  if(!isMain) return 0;
  let s6a = ty.medical.main * 12;
  if(deps >= 1) s6a += ty.medical.firstDep * 12;
  if(deps > 1)  s6a += (deps - 1) * ty.medical.addDep * 12;
  return s6a;
}
/* Every intermediate of the s6A/s6B computation, for the medical breakdown
   card. calcMedicalCredits() returns a pick of this, so the card and the
   engine share one arithmetic path. */
export function medicalCreditComposition(age, ty, isMain, deps, annualEmployee, annualEmployer, oop, isDisability, taxableIncome) {
  const s6a = calcS6ACredit(ty, isMain, deps);
  const contributions = (annualEmployee || 0) + (annualEmployer || 0);
  const ti = Math.max(0, taxableIncome || 0);
  const senior = age >= 65 || !!isDisability;
  const multiple = senior ? MEDICAL_S6B.contribMultipleSenior : MEDICAL_S6B.contribMultiple;
  const contribLimit = multiple * s6a;
  const excessContrib = Math.max(0, contributions - contribLimit);
  const qualifying = excessContrib + oop;
  const threshold = senior ? 0 : MEDICAL_S6B.thresholdPct * ti;
  const aboveThreshold = senior ? qualifying : Math.max(0, qualifying - threshold);
  const s6b = senior ? qualifying / MEDICAL_S6B.seniorRateDivisor : MEDICAL_S6B.rate * aboveThreshold;
  return { senior, multiple, contributions, contribLimit, excessContrib, oop: oop || 0, qualifying,
           threshold, aboveThreshold, s6aExact: s6a, s6bExact: s6b,
           s6a: Math.round(s6a), s6b: Math.round(s6b), total: Math.round(s6a + s6b) };
}
export function calcMedicalCredits(age, ty, isMain, deps, annualEmployee, annualEmployer, oop, isDisability, taxableIncome) {
  const c = medicalCreditComposition(age, ty, isMain, deps, annualEmployee, annualEmployer, oop, isDisability, taxableIncome);
  return { s6a: c.s6a, s6b: c.s6b, total: c.total };
}

/* ── SHARED SINGLE-YEAR TAX ENGINE ──
   One tax-math path for the forecast/analysis modes: Projection, Current-Year
   Planner, Historical calculator/comparison, RA analyser and the para-20
   provisional penalty. Each previously re-implemented the retirement cap,
   s18A donation cap, CGT inclusion, s6A block and the rebate/credit tail
   inline (≈150 duplicated lines; the Historical copy had already diverged —
   its s6B lacked the 7.5%-of-taxable-income threshold).
   calcFullTax remains the full ITR12 engine (s11F remuneration base, lump-sum
   tables, FTC cap, assessed loss); it shares the same primitives.

   Pure: reads only its arguments — never the DOM or APP.

   inputs (all optional except age where rebates matter):
     taxable     use this taxable income directly, skipping composition
                 (delta-based callers: RA analyser, para-20 penalty)
     gross       total income before deductions
     cgtRaw      raw capital gain — annual exclusion and inclusion rate applied
     retContrib  retirement contributions, capped at retirement.pct% of retBase
                 and the rand cap (s11F simplified: no remuneration test)
     retBase     percentage-test base; defaults to gross
     otherDed    other allowable deductions
     donations   s18A donations, capped at donationPct of pre-donation taxable
     addTaxable  added AFTER the donation cap (planner forecast extras keep
                 their original conservative ordering)
     age         age at year end (rebates; s6B variant)
     medical     {isMain, deps, contrib, employer, oop, disability} → s6A+s6B
     credits     extra credit subtracted with medical (e.g. s6A-only callers) */
export function calcTaxableCapitalGain(rawGain, ty) {
  return Math.max(0, (rawGain || 0) - ty.cgt.annualExcl) * ty.cgt.inclusion;
}
export function calcTaxForYear(inp, ty) {
  const age = inp.age || 0;
  let cgtNetGain = 0, cgtTaxable = 0, retMax = 0, retAllowed = 0, retExcess = 0,
      tbd = 0, donAllowed = 0, taxable;
  if(inp.taxable != null) {
    taxable = Math.max(0, inp.taxable);
  } else {
    const gross = inp.gross || 0;
    cgtNetGain = Math.max(0, (inp.cgtRaw || 0) - ty.cgt.annualExcl);
    cgtTaxable = cgtNetGain * ty.cgt.inclusion;
    const retBase = inp.retBase != null ? inp.retBase : gross;
    retMax     = Math.min(Math.max(0, retBase) * (ty.retirement.pct / 100), ty.retirement.cap);
    retAllowed = Math.min(inp.retContrib || 0, retMax);
    retExcess  = Math.max(0, (inp.retContrib || 0) - retAllowed);
    tbd        = gross + cgtTaxable - retAllowed - (inp.otherDed || 0);
    donAllowed = Math.min(inp.donations || 0, Math.max(0, tbd) * (ty.donationPct / 100));
    taxable    = Math.max(0, tbd - donAllowed) + (inp.addTaxable || 0);
  }
  const toi     = calcTaxOnIncome(taxable, ty.brackets);
  const rebates = calcRebates(age, ty);
  const m = inp.medical;
  const med = m
    ? calcMedicalCredits(age, ty, !!m.isMain, m.deps || 0, m.contrib || 0, m.employer || 0, m.oop || 0, !!m.disability, taxable)
    : { s6a: 0, s6b: 0, total: 0 };
  const taxPayable = Math.max(0, Math.max(0, toi - rebates) - med.total - (inp.credits || 0));
  return { cgtNetGain, cgtTaxable, retMax, retAllowed, retExcess, tbd, donAllowed,
           taxable, toi, rebates, med, taxPayable };
}

/* ── s12T(7) TAX-FREE INVESTMENT EXCESS CHARGE (QR9a, QD-12) ──
   Pure: reads only its arguments. `items` are APP.tfiItems; only
   `contributions` (ITR12 source code 4219) count — transfers in/out
   (4246/4247) are excluded by s12T(6), withdrawals (4248) do not restore
   any limit, and returns are not contributions. A record marked
   `forMinorChild` (a migrated certificate the user had marked as their minor
   child's account) is the child's investment, under the child's own limits —
   not counted here. `prior` is the user's total
   contributions in earlier years (lifetime test).
     annualExcess   = contributions − annual limit                (s12T(7)(a))
     lifetimeExcess = the part of THIS year's contributions that takes the
                      running total past the lifetime limit; contributions
                      already over it in earlier years were charged then.
     (b) reaches only the lifetime excess "not previously taken into
     account in terms of this subsection", so this year's annual excess is
     taken out of it first. KNOWN LIMIT: an annual excess charged in an
     EARLIER year that also counts toward a later lifetime excess is not
     tracked (the app keeps one prior-contributions total, not a history),
     so the lifetime charge can overstate in that rare case — never under.
   No limits for the year (ty.tfsa absent) → no charge, never a guess (QR4.8).
   The charge is deemed normal tax "after rebates" (IT-AE-36-G05 §6.11(d)):
   calcFullTax adds it to the year's liability beside the lump-sum tax, not
   to taxPayable — rebates, credits and the effective/marginal rates are
   about tax on income and are unchanged by it. */
export function calcTfiCharge(items, prior, ty) {
  const contributions = (items || []).filter(it => it && !it.forMinorChild)
    .reduce((s, it) => s + Math.max(0, it.contributions || 0), 0);
  const priorC = Math.max(0, prior || 0);
  const lim = ty && ty.tfsa;
  const out = { contributions, prior: priorC, annualLimit: lim ? lim.annual : null, lifetimeLimit: lim ? lim.lifetime : null,
                annualExcess: 0, lifetimeExcess: 0, chargeAnnual: 0, chargeLifetime: 0, charge: 0 };
  if (!lim) return out;
  out.annualExcess = Math.max(0, contributions - lim.annual);
  out.lifetimeExcess = Math.max(0, priorC + contributions - lim.lifetime) - Math.max(0, priorC - lim.lifetime);
  out.chargeAnnual = out.annualExcess * S12T_EXCESS_CHARGE_RATE;
  out.chargeLifetime = Math.max(0, out.lifetimeExcess - out.annualExcess) * S12T_EXCESS_CHARGE_RATE;
  out.charge = out.chargeAnnual + out.chargeLifetime;
  return out;
}
/* The one call every consumer uses (calcFullTax, the list, the summaries),
   so the figure is computed from one set of inputs everywhere. */
export function tfiChargeForActiveYear() {
  return calcTfiCharge(APP.tfiItems, APP.tfiPriorContributions, getActiveTaxYear());
}

/* ── REMUNERATION BASE for s11F(2)(c)(i) ──
   Per Fourth Schedule paragraph 1, "remuneration" includes salary, bonus,
   commission, allowances, fringe benefits, but excludes lump sums and
   severance benefits. Drives the s11F deduction calculation below. */
export function calcRemunerationBase(items) {
  return (items || []).reduce((sum, item) => {
    const def = IRP5_CODE_MAP.get(item.code);
    return sum + (def && def.remunerationBase === true ? (item.amount || 0) : 0);
  }, 0) - longServiceAwardExcluded(items);
}

/* BACKLOG 80: the part of a long service cash award (IRP5 rows flagged
   longServiceAward — 3622) that is not gross income: s1 "gross income"
   par (c) proviso (vii), up to TAX_YEARS[y].longServiceAward.exclusion in
   aggregate (see 01-data). 3622 carries the full value, so the engine must
   take the exclusion off itself. Not gross income means not remuneration
   either (Fourth Schedule par 1 — and G06: no PAYE while within it), so the
   s11F base and the taxable base read this one function. An award in kind
   (3835) is not capturable yet (BACKLOG 81); when it is, it shares the
   same cap here. One cap per year is assumed — two qualifying awards in one
   year (15 years and 25 years cannot fall in the same year) do not arise. */
export function longServiceAwardExcluded(items) {
  const cash = (items || []).reduce((sum, item) => {
    const def = IRP5_CODE_MAP.get(item.code);
    return sum + (def && def.longServiceAward ? (item.amount || 0) : 0);
  }, 0);
  return Math.min(cash, getFact('longServiceAward.exclusion') || 0);
}

/* coverage-gap C-11 (s12T): a TFSA certificate's interest, dividends and
   capital gains are fully exempt — not merely zero-rated, EXCLUDED from the
   tax base entirely, so it must not consume s10(1)(i) interest-exemption
   headroom that would otherwise apply to the taxpayer's ordinary interest.
   QR9a: TFSAs are their own list (APP.tfiItems), so no certificate should
   carry isTfsa — the filter stays as the guard for anything that sets
   it3bItems with one. Every
   consumer of it3bItems that feeds a tax computation (taxable investment
   income, the s6quat foreign-tax pool, the provisional-taxpayer passive-
   income test, the source-of-income breakdown) filters through this one
   function rather than re-deriving the isTfsa check inline. */
/* C-2a: a joint certificate's interest/dividends/gains accrue only to the
   extent of each holder's own beneficial ownership share (general accrual
   principle, s1 "gross income"). Certificates carry the FULL amounts as
   entered (so the list display and the raw record stay accurate); this is
   the one place that scales every monetary field down to this taxpayer's
   own share before any tax computation sees it. */
const IT3B_MONETARY_FIELDS = ['localInterest', 'sarsInterest', 'foreignInterest', 'foreignDividends', 'reitDistributions', 'reitTaxableDividends', 'otherReceiptsLoss', 'taxableLocalDividends', 'exemptLocalDividends', 'foreignCapitalGains', 'foreignTaxDividends', 'foreignTaxInterest'];
export function taxableIt3bItems() {
  return (APP.it3bItems || [])
    .filter(function(i){ return i.isTfsa !== 'yes'; })
    .map(function(i) {
      const share = Math.min(100, Math.max(0, i.ownershipShare != null ? i.ownershipShare : 100)) / 100;
      if (share === 1) return i;
      const out = Object.assign({}, i);
      IT3B_MONETARY_FIELDS.forEach(function(k) { out[k] = (i[k] || 0) * share; });
      return out;
    });
}

/* ── FULL TAX CALCULATION ── */
/* V8.9 B4.CALC.3: taxable investment income from IT3(b) certificates.
   Local interest (incl. SARS interest) less the s10(1)(i) exemption, PLUS foreign
   interest (no exemption), REIT distributions (fully taxable), and the taxable
   portion of foreign dividends (s10B(3): 25/45 exempt, 20/45 taxable for natural
   persons — IN93 p.40). */
export function calcTaxableInvestment(ty, age) {
  if(!ty)  ty  = getActiveTaxYear();
  if(age == null) age = calcAgeAtYearEnd();
  var items = taxableIt3bItems();
  var localGross = 0, foreignInt = 0, foreignDiv = 0, reit = 0, otherLoss = 0, localDivTaxable = 0;
  if((APP.it3bItems || []).length) {
    items.forEach(function(i){
      localGross += (i.localInterest || 0) + (i.sarsInterest || 0);
      foreignInt += (i.foreignInterest || 0);
      foreignDiv += (i.foreignDividends || 0);
      /* Two certificate lines, taxed alike — in full, with neither the
         s10(1)(k) dividend exemption nor the s10(1)(i) interest exemption:
         reitDistributions is the form's 'Other Receipts and Accruals –
         Profit' line (code 4214; the key name predates that label), and
         reitTaxableDividends is the 'Distribution from a REIT / taxable local
         dividends' line (code 4238, G05 §6.1.6; s25BB(6)) — TC-008, TC-020. */
      reit       += (i.reitDistributions || 0) + (i.reitTaxableDividends || 0);
      /* Batch M: IT3(b) source code 4215 (Other Receipts and Accruals — Loss)
         — pass-through fund loss, deducted in full like the 4214 profit
         line. engine-remediation W4 (s26A, paras 3-8 Eighth Schedule):
         i.foreignCapitalGains (income code 4252) is IT3(b)-certificate
         foreign capital gains routed through the Eighth Schedule CGT
         aggregate (renderCgtResult), NOT summed here as ordinary income —
         it is capital, not revenue. */
      otherLoss  += (i.otherReceiptsLoss || 0);
      /* A4 (s8E/8EA, code 4292): dividends re-characterised as income are
         NOT exempt under s10(1)(k) — included at 100%, no exemption. */
      localDivTaxable += (i.taxableLocalDividends || 0);
    });
  } else {
    localGross = (typeof gv === 'function') ? (gv('int_gross') || 0) : 0;
  }
  var exemption = (age >= 65) ? ty.interest.age65 : ty.interest.under65;
  var taxableLocal = Math.max(0, localGross - exemption);
  var taxableForeignDiv = foreignDiv * FOREIGN_DIVIDEND_TAXABLE_RATIO; /* s10B(3): 20/45 taxable */
  return Math.max(0, taxableLocal + foreignInt + reit + taxableForeignDiv - otherLoss + localDivTaxable);
}

/* engine-remediation W10: tax on a single lump sum given the cumulative pool
   (priorTaxable) it lands on top of. Moved from 05-list-modules.js into the
   engine module (with walkLumpsums below) so both calcRetirementReceipts and
   the list renderer consume one shared implementation — see walkLumpsums. */
export function calcLumpsumTax(amount, priorTaxable, eventType) {
  /* coverage-gap C-13: a divorce-order amount received by the NON-MEMBER
     spouse is taxed "on the withdrawal table" per para 2(1)(b) Second
     Schedule — same table as an ordinary pre-retirement withdrawal, using
     the recipient's own cumulative pool (which walkLumpsums() already
     provides — this app models one taxpayer, so the recipient's pool here
     IS their own). */
  const usesWithdrawalTable = eventType === 'withdrawal' || eventType === 'divorce_nonmember';
  const table = usesWithdrawalTable ? getFact('withdrawalLumpSum') : getFact('retirementLumpSum');
  if(!table) return {taxBefore:0, taxAfter:0, taxOnThis:0};
  // Standard SARS calc — tax on cumulative pool
  const taxOnCum = (cum) => {
    if(cum <= 0) return 0;
    for(const br of table) {
      if(cum >= br.min && cum <= br.max) {
        // base + rate × (cum − (br.min - 1)) ; for min=0 bracket, base=0 and rate may be 0
        return br.base + (cum - (br.min === 0 ? 0 : br.min - 1)) * br.rate;
      }
    }
    return 0;
  };
  const taxBefore = taxOnCum(priorTaxable);
  const taxAfter  = taxOnCum(priorTaxable + amount);
  const taxOnThis = Math.max(0, taxAfter - taxBefore);
  return {taxBefore, taxAfter, taxOnThis};
}

/* engine-remediation W10 (H10, LAPD-IT-G03 p.12): shared lump-sum walk.
   Sorts a COPY of the events by receipt date (undated events last, stable
   for ties) then walks the Second Schedule para 5/6 non-deducted-contribution
   relief and the lifetime-cumulative pool in that order, one event at a
   time. Both the engine (calcRetirementReceipts) and the list renderer
   (renderRetirementLumpsumList/renderRetirementGlance) call this — the walk
   used to be duplicated in three places and could disagree on ordering.
   Relief scope: para 6(1)(b)(i) allows non-deducted-contribution relief
   against retirement, death and withdrawal benefits; severance benefits are
   employer-paid and the Second Schedule para 5/6 relief does not apply to
   them (LAPD-IT-G03 §5) — severance is fully taxable via the lump-sum table
   with no relief. */
export function walkLumpsums(events, opening, priorPool) {
  var indexed = (events || []).map(function(e, idx){ return {e: e, idx: idx}; });
  indexed.sort(function(a, b){
    var da = a.e.date, db = b.e.date;
    if(!da && !db) return a.idx - b.idx;
    if(!da) return 1;
    if(!db) return -1;
    if(da < db) return -1;
    if(da > db) return 1;
    return a.idx - b.idx;
  });
  var sorted = indexed.map(function(x){ return x.e; });

  var s10cOpening = Math.max(0, opening || 0);
  var s10cAvail = s10cOpening;
  var cumOpening = priorPool || 0;
  var cum = cumOpening;
  var lumpSumGross = 0, lumpSumTax = 0, s10cUsed = 0;
  var rows = sorted.map(function(l){
    var g = l.amount || 0;
    /* coverage-gap C-13: a transfer to another approved fund is tax-neutral
       (no s1 "gross income" lump-sum accrual at all) — it must not inflate
       lumpSumGross (a display total the user reads as taxable), consume any
       s10C relief, or advance the lifetime-cumulative pool other lump sums
       are taxed against. Excluded from the walk entirely rather than taxed
       at zero, which would still have moved cum. */
    if(l.eventType === 'transfer') {
      return { event: l, gross: g, relief: 0, taxable: 0, taxOnThis: 0, cumBefore: cum, transferred: true };
    }
    lumpSumGross += g;
    /* para 6(1)(b)(i): relief against retirement/death/withdrawal benefits.
       A divorce-order amount to the non-member spouse is taxed ON the
       withdrawal table (see calcLumpsumTax) and is itself a "lump sum
       benefit" under para 2(1)(b) alongside retirement/death/withdrawal, so
       it qualifies on the same footing. */
    var reliefEligible = l.eventType === 'retirement' || l.eventType === 'death' || l.eventType === 'withdrawal' || l.eventType === 'divorce_nonmember';
    var relief = 0;
    if(reliefEligible) { relief = Math.min(s10cAvail, g); s10cAvail -= relief; s10cUsed += relief; }
    var taxable = Math.max(0, g - relief);
    var calc = calcLumpsumTax(taxable, cum, l.eventType);
    lumpSumTax += calc.taxOnThis;
    var row = { event: l, gross: g, relief: relief, taxable: taxable, taxOnThis: calc.taxOnThis, cumBefore: cum };
    cum += taxable;
    return row;
  });

  /* BACKLOG 43 (OI-B3): what is left of the retirement table's zero-rate
     band after every lump sum taxed so far — Second Schedule par 5/6: the
     band applies once across a lifetime, cumulatively. Read from the year's
     table (TAX_YEARS retirementLumpSum), never typed. */
  var retTable = getFact('retirementLumpSum') || [];
  var zeroBand = retTable.length && retTable[0].rate === 0 ? retTable[0].max : 0;
  return {
    rows: rows,
    lumpSumGross: lumpSumGross, lumpSumTax: lumpSumTax,
    s10cOpening: s10cOpening, s10cUsed: s10cUsed, s10cRemaining: s10cAvail,
    cumPoolOpening: cumOpening, cumPoolClosing: cum,
    retirementTaxFreeRemaining: Math.max(0, zeroBand - cum)
  };
}

/* RR (v8.9.1): retirement-receipts engine.
   - Two-pot savings withdrawals -> ordinary income (marginal rates).
   - Retirement/withdrawal/death lump sums -> SARS tables, lifetime-cumulative,
     with Second Schedule para 5/6 non-deducted-contribution relief (severance
     excluded — see walkLumpsums).
   T-C2: s10cOpening is now a REQUIRED caller-supplied parameter — this
   year's already-settled retExcess (post-s11F, see calcFullTax) — not read
   from a separately-entered field. calcFullTax() inlines walkLumpsums()
   itself once retExcess is known rather than calling this wrapper (see
   T-C2 comment there); this export remains for callers that only need
   twopotTotal (they may omit s10cOpening — it defaults to 0 and only
   affects the lump-sum-relief fields these callers don't read). */
export function calcRetirementReceipts(ty, age, s10cOpening) {
  var twopotTotal = (APP.twopotWithdrawals || []).reduce(function(s,t){ return s + (t.amount || 0); }, 0);
  var opening = Math.max(0, s10cOpening || 0);
  var walk = walkLumpsums(APP.retirementLumpsums || [], opening, APP.priorLumpsumTaxable || 0);
  return {
    twopotTotal: twopotTotal,
    lumpSumGross: walk.lumpSumGross, lumpSumTax: walk.lumpSumTax,
    s10cOpening: walk.s10cOpening, s10cUsed: walk.s10cUsed, s10cRemaining: walk.s10cRemaining,
    cumPoolOpening: walk.cumPoolOpening, cumPoolClosing: walk.cumPoolClosing, retirementTaxFreeRemaining: walk.retirementTaxFreeRemaining
  };
}

/* FI (v8.10.1): s10(1)(o)(ii) foreign-employment exemption. Applies to foreign-service
   remuneration (FOREIGN_SERVICE_CODES — IRP5 codes 3651/3655/3656, PAYE-AE-06-G06 p.7-9)
   when the 183/60-day test is met; first R1.25m exempt. */
export function foreignEmpExemptAmount() {
  var qualifying = (APP.incomeItems || []).filter(function(i){ return FOREIGN_SERVICE_CODES.has(i.code); })
                     .reduce(function(s,i){ return s + (i.amount || 0); }, 0);
  var qualified = (typeof gs === 'function') && gs('fs_qualifies') === 'yes';
  var cap = (typeof getFact === 'function' ? getFact('foreignService.exemptionCap') : 0) || 1250000;
  /* coverage-gap B-10: s10(1)(o)(ii) exempts remuneration for services
     rendered OUTSIDE the Republic during the qualifying period — a
     taxpayer who worked part of the period in SA on the same qualifying
     IRP5 code must apportion, not exempt the whole coded amount (IN16
     Issue 4 para 4.3). Days are optional: leaving them blank keeps the
     ratio at 1 (the previous, unapportioned behaviour), so every existing
     scenario that never captured day counts is unaffected. */
  var daysOutside = (typeof gv === 'function') ? (gv('fs_days_outside') || 0) : 0;
  var daysTotal    = (typeof gv === 'function') ? (gv('fs_days_total') || 0) : 0;
  var apportionRatio = (daysTotal > 0) ? Math.min(1, daysOutside / daysTotal) : 1;
  var apportioned = qualifying * apportionRatio;
  var exempt = qualified ? Math.min(cap, apportioned) : 0;
  return { qualifying: qualifying, qualified: qualified, cap: cap, exempt: exempt, apportionRatio: apportionRatio, daysOutside: daysOutside, daysTotal: daysTotal };
}

/* engine-remediation W9: pure foreign-income collector, moved here from
   05-list-modules.js so the engine (calcFullTax's s6quat block below) is the
   ONE place that assembles every foreign source for the single overall
   s6quat(1B) limitation — the B6 UI (05-list-modules.js) re-exports this same
   function rather than keeping its own copy. Raw foreign CGT is read from
   appliedValues.foreignCgtRawGain, persisted by the CGT module (06b-cgt.js)
   alongside .cgt — avoids re-deriving per-asset gains here and an import
   cycle on calcCgtAssetGain. */
export function collectForeignIncome() {
  const result = {
    foreignInterest:  0,
    foreignDividends: 0,
    foreignTaxDividends: 0, // Foreign tax on dividends — IT3(b) code 4112 (ring-fenced source code)
    foreignTaxInterest:  0, // Foreign tax on interest  — IT3(b) code 4113 (ring-fenced source code)
    otherTax:         0, // Foreign tax on the residual (non-IT3(b)) pool
    foreignRental:    0,
    foreignBusiness:  0,
    foreignService:   0, // FOREIGN_SERVICE_CODES — IRP5 codes 3651/3655/3656
    foreignCgt:       0, // raw (pre-exclusion) foreign-sourced portion of the CGT aggregate
    catchAll:         0,
    foreignPension:   0  // T-7: foreign-flagged pension/annuity items (gross — see note below)
  };

  let foreignDividendsGross = 0;
  taxableIt3bItems().forEach(item => {
    result.foreignInterest     += (item.foreignInterest || 0);
    foreignDividendsGross      += (item.foreignDividends || 0);
    result.foreignTaxDividends += (item.foreignTaxDividends || 0); // 4112
    result.foreignTaxInterest  += (item.foreignTaxInterest  || 0); // 4113
  });
  result.foreignDividends = foreignDividendsGross * FOREIGN_DIVIDEND_TAXABLE_RATIO; // s10B(3): 20/45 taxable
  result.foreignDividendsExempt = foreignDividendsGross - result.foreignDividends;   // the other 25/45 (exempt)

  /* Batch I (#76/#70), s6quat(1A): foreign tax proved payable to a foreign
     government on income from a foreign source that IS included in taxable
     income qualifies for a rebate. Foreign rental and foreign business profit
     have both entered the s6quat(1B) limitation numerator for some time, but
     neither had any way to capture the foreign tax actually paid on them — so
     the credit for these two sources was structurally always nil, exactly the
     one-way leak T-7 fixed for a foreign pension. Feeds the same `otherTax`
     accumulator that pension already uses; no new tax math, and the overall
     s6quat(1B)(a) limitation still applies to the pooled total downstream. */
  (APP.rentalProperties || []).forEach(p => {
    if(p.foreign === 'yes') {
      result.foreignRental += Math.max(0, calcRentalNet(p).net);
      /* C-2a: foreign tax withheld on a co-owned property is apportioned by
         the same beneficial-ownership share as the income it relates to. */
      result.otherTax += (p.foreignTax || 0) * rentalShare(p);
    }
  });

  (APP.businessItems || []).forEach(b => {
    if(b.foreign === 'yes') {
      const totalExp = (b.expenses || []).reduce((s, e) => s + (e.amount||0), 0);
      result.foreignBusiness += Math.max(0, (b.income||0) - totalExp);
      result.otherTax += (b.foreignTax || 0);
    }
  });

  result.foreignCgt = (APP.appliedValues && APP.appliedValues.foreignCgtRawGain) || 0;

  (APP.incomeItems || []).forEach(it => {
    if(FOREIGN_SERVICE_CODES.has(it.code)) {
      result.foreignService += (it.amount || 0);
    }
  });

  // Catch-all (manual entry) — part of the residual (non-IT3(b)) pool
  result.catchAll = gv('b6-catchall-amount') || 0;
  /* `+=`, not `=`: otherTax is a POOL that several foreign sources contribute
     to (catch-all here, foreign pension below, foreign rental and business
     above). A plain assignment silently discarded every contribution made
     before this line — latent until Batch I added the first such contributor,
     and a trap for the next one. */
  result.otherTax += gv('b6-catchall-tax') || 0;

  /* T-7: a foreign-flagged pension/annuity item was already correctly taxed
     as ordinary income (via _pensionAnnuity in adjGross), but any foreign
     tax withheld on it was never counted toward the s6quat qualifying-tax
     pool — genuine double taxation with no credit. Uses the item's GROSS
     amount here (not net of any s10C exemption, which is only ever a
     single pooled reduction across ALL qualifying pension items, not
     attributable to one item) — the same simplification the codebase
     already accepts for foreignRental/foreignBusiness (raw category totals,
     no further apportionment of unrelated deductions), and taxpayer-neutral
     in the common case since s10C exemption is rare and typically small
     relative to full pension income. */
  (APP.pensionAnnuityItems || []).forEach(function(p) {
    if (p.foreign === 'yes') {
      result.foreignPension += (p.amount || 0);
      result.otherTax += (p.foreignTax || 0);
    }
  });

  return result;
}

/* Total taxable foreign income across every source — bucket-6 status/amount
   display only (see collectForeignIncome for the per-source composition the
   s6quat limitation itself is built from). */
export function _foreignIncomeTotal() {
  const fi = collectForeignIncome();
  return fi.foreignInterest + fi.foreignDividends + fi.foreignRental
       + fi.foreignBusiness + fi.foreignService + fi.foreignCgt + fi.catchAll;
}

/* B9.6 (D-13): the single answer to "has this taxpayer captured any income?",
   shared by taxHeroState() (07-render-summary.js) and the Dashboard
   checklist (08-dashboard-theme.js) so "no income captured" can never read
   differently on the two surfaces.

   Retirement lump sums and two-pot withdrawals live in their own arrays and
   are deliberately NOT in adjGross — that is grossNetOfLumpSums, because s1
   "taxable income" excludes Second Schedule benefits. Testing adjGross alone
   therefore called a lump-sum-only taxpayer "no income captured" while real
   Second Schedule tax was due on the receipt. Counts captured RECORDS, not
   amounts, for the same reason incomeItems.length does: the question is what
   the user has entered, not what it is worth. */
export function hasIncomeCaptured(r) {
  return (APP.incomeItems || []).length > 0
    || (APP.employerPaye || []).length > 0
    || (APP.retirementLumpsums || []).length > 0
    || (APP.twopotWithdrawals || []).length > 0
    || (((r && r.adjGross) || 0) > 0);
}

/* ── C5: LOCAL vs FOREIGN SPLIT (display only) ──────────────────────────────
   Where the money came from, by source country.

   Deliberately built from GROSS per-source amounts rather than by
   subtracting collectForeignIncome() from adjGross. That subtraction looks
   obvious and is wrong: collectForeignIncome()'s fields are a mix of bases —
   foreignDividends is already s10B(3) ratio-adjusted (20/45), rental and
   business are net of expenses, and foreignCgt is the RAW pre-exclusion
   gain while adjGross carries the post-exclusion, post-inclusion-rate
   figure. Netting those against adjGross would over-subtract, and the
   resulting "local income" would be a number the user could not reconcile
   against anything on screen.

   Every line below is instead the same gross figure the user typed in, so
   local + foreign is exact by construction and both sides are checkable
   against the capture pages.

   CAPITAL GAINS ARE EXCLUDED, and the caller says so on screen. A gain's
   local/foreign character is set per asset and only survives into the
   engine as a raw pre-exclusion figure; folding that raw number into a
   gross-basis split would mix two bases and reintroduce exactly the
   reconciliation problem this function exists to avoid.

   Returns gross amounts — NOT taxable income. The caller labels it. */
export function localForeignSplit() {
  let local = 0, foreign = 0;
  /* foreignBreakdown: same accumulation as `foreign` above, itemised by
     category. Each entry's amount is the exact figure already folded into
     `foreign` — never a re-derived number — so the rows always sum to the
     total by construction; only the basis NOTE differs per category, since
     "gross" means something different for a net-of-expenses trade receipt
     than it does for a dividend awaiting its s10B(3) ratio. Owner-requested
     (C5 follow-up, 2026-08-21): the headline total is intentionally already
     on a consistent gross basis (see the block comment above), but that
     consistency hides which accounting basis each category's own figure
     naturally sits on — this surfaces it without reopening the
     reconciliation problem the gross rebuild exists to avoid. */
  const foreignBreakdown = [];
  const _fb = (label, amount, basis) => { if (amount > 0) foreignBreakdown.push({ label, amount, basis }); };

  /* Employment — foreign-service source codes vs everything else. */
  let empForeign = 0;
  (APP.incomeItems || []).forEach(i => {
    const amt = i.amount || 0;
    if (FOREIGN_SERVICE_CODES.has(i.code)) { foreign += amt; empForeign += amt; } else local += amt;
  });
  _fb('Employment', empForeign, 'Gross, as received (IRP5 foreign-service codes).');

  /* Investment — per IT3(b) certificate. Gross throughout: the interest
     exemption and the s10B(3) dividend ratio are both reliefs applied later,
     not part of where the income arose. */
  let intForeign = 0, divForeign = 0;
  taxableIt3bItems().forEach(it => {
    local   += (it.localInterest || 0) + (it.sarsInterest || 0)
             + (it.reitDistributions || 0) + (it.reitTaxableDividends || 0) + (it.taxableLocalDividends || 0);
    foreign += (it.foreignInterest || 0) + (it.foreignDividends || 0);
    intForeign += (it.foreignInterest  || 0);
    divForeign += (it.foreignDividends || 0);
  });
  _fb('Interest',  intForeign, 'Gross, before any interest exemption.');
  _fb('Dividends', divForeign, 'Gross, before the 20/45 taxable portion is applied (s10B(3)).');

  /* Rental and business — gross receipts, split by the record's own flag. */
  let rentalForeign = 0;
  (APP.rentalProperties || []).forEach(p => {
    const amt = (p.income || 0) * rentalShare(p); /* C-2a: this taxpayer's own share */
    if (p.foreign === 'yes') { foreign += amt; rentalForeign += amt; } else local += amt;
  });
  _fb('Rental', rentalForeign, 'Gross rent received, before allowable expenses.');

  let businessForeign = 0;
  (APP.businessItems || []).forEach(b => {
    const amt = b.income || 0;
    if (b.foreign === 'yes') { foreign += amt; businessForeign += amt; } else local += amt;
  });
  _fb('Business', businessForeign, 'Gross trade receipts, before allowable expenses.');

  /* Pension and annuity receipts. */
  let pensionForeign = 0;
  (APP.pensionAnnuityItems || []).forEach(p => {
    const amt = p.amount || 0;
    if (p.foreign === 'yes') { foreign += amt; pensionForeign += amt; } else local += amt;
  });
  _fb('Pension / annuity', pensionForeign, 'Gross, as received.');

  /* Other receipts and crypto revenue have no foreign flag — local. */
  (APP.otherReceipts || []).forEach(o => { local += (o.amount || 0); });
  (APP.cryptoRevenue || []).forEach(c => { local += (c.amount || 0); });

  /* The Foreign Income page's manual catch-all. */
  const catchAllAmt = gv('b6-catchall-amount') || 0;
  foreign += catchAllAmt;
  _fb('Other (manual entry)', catchAllAmt, 'As entered on the Foreign Income page.');

  const total = local + foreign;
  return {
    local, foreign, total,
    localPct:   total ? (local   / total) * 100 : 0,
    foreignPct: total ? (foreign / total) * 100 : 0,
    /* True when there is a capital gain the split deliberately leaves out,
       so the caller only shows the caveat when it actually applies. */
    cgtExcluded: !!((APP.cgtAssets || []).length || (APP.cryptoDisposals || []).length),
    foreignBreakdown,
  };
}

export function calcFullTax() {
  const ty = getActiveTaxYear();
  const age = calcAgeAtYearEnd();
  const gross = APP.incomeItems.reduce((s,i) => s+i.amount, 0);

  // ---- Retirement (s11F) ----
  // V8.4 VI.1a + VI.4 FIX:
  //   1) Prior year excess (pyRetExcess) is treated as a CURRENT YEAR contribution
  //      and subject to the cap (combined with this year's contributions).
  //      Previous logic added pyRetExcess to retMax, allowing it to bypass the cap.
  //   2) Lump sum codes (3901, 3915, 3920, 3921, 3924, 3926) must be EXCLUDED
  //      from the s11F base. Previously taxableIncomeBeforeS11F included them
  //      via gross, inflating the cap.
  // V8.3 H-3 (P-H2 citation audit, 2026-07-13: corrected from (c)): per
  // s11F(2)(b), 27.5% test uses the HIGHER of:
  //   (i) remuneration (Fourth Schedule par 1), OR
  //   (ii) taxable income before s11F and s18A (now net of lump sums).

  const pyRetExcess = gv('py_ret_excess');
  const retTotal = gv('ded_pension') + gv('ded_provident') + gv('ded_ra');

  // (i) Remuneration: only IRP5 codes flagged remunerationBase: true
  const remuneration = calcRemunerationBase(APP.incomeItems);

  // Compute gross EXCLUDING lump sums for the s11F base only.
  // Real gross (for tax calc) still includes lump sums; just not for the cap base.
  const lumpSumTotal = (APP.incomeItems || []).reduce((sum, item) => {
    const def = IRP5_CODE_MAP.get(item.code);
    return sum + (def && def.cat === 'lumpsum' ? (item.amount || 0) : 0);
  }, 0);
  /* v8.15 NT1a: non-taxable IRP5 codes (3602/3703/3714/3821/3822) must leave the taxable base.
     They were previously summed into `gross` and never removed, inflating taxable income.
     `gross` (raw total received) is retained for display; only the taxable base excludes them. */
  const nonTaxableTotal = (APP.incomeItems || []).reduce((sum, item) => {
    const def = IRP5_CODE_MAP.get(item.code);
    return sum + (def && def.cat === 'nontaxable' ? (item.amount || 0) : 0);
  }, 0) + longServiceAwardExcluded(APP.incomeItems);   /* BACKLOG 80 */
  const grossNetOfLumpSums = gross - lumpSumTotal - nonTaxableTotal;

  // (ii) Taxable income before s11F and s18A — computed inline since the full
  // tbd is not available yet. Reproduce pre-s11F/s18A composition net of lump sums:
  const _av = APP.appliedValues || {};
  const _intExempt = _av.interest || 0;
  const _cgt = _av.cgt || 0;
  const _rental = _av.rental || 0;
  /* V8.9 B4.CALC.1: business net + other receipts + crypto revenue now enter the tax base */
  const _business = _av.business || 0;
  /* FB5: _other includes only income-type other-receipts (capital items route via CGT aggregate) */
  /* s10(1)(u): alimony/maintenance received under a court order or written
     agreement is exempt — receiptType 'exempt' items are recorded (for the
     taxpayer's own completeness) but contribute nothing to the tax base,
     same treatment as 'capital' items (which route to the CGT aggregate
     instead of gross income). */
  /* BACKLOG 63: net of the costs on a royalty or "something else" receipt
     (otherReceiptCosts — s11(a), s23(g); OTHER_RECEIPT_COST_KINDS). */
  const _other = (APP.otherReceipts || []).reduce(function(s,i){ return s + ((i.receiptType === 'capital' || i.receiptType === 'exempt') ? 0 : (i.amount || 0) - otherReceiptCosts(i)); }, 0);
  const _cryptoRev = (typeof cryptoTotals === 'function') ? (cryptoTotals().netRevenue || 0) : 0; /* FB4: net of crypto expenses */
  /* V8.9 B4.CALC.3: taxable investment income added directly (replaces the erroneous exempt-subtraction) */
  const _invest = calcTaxableInvestment(ty, age);
  /* RR (v8.9.1): two-pot savings withdrawals enter the marginal base. Lump
     sums (para 5/6 relief) are walked further down, once retExcess (this
     year's available non-deducted-contribution pool, T-C2 below) is known. */
  const _twopotTotal = (APP.twopotWithdrawals || []).reduce(function(s,t){ return s + (t.amount || 0); }, 0);
  /* FI (v8.10.1): s10(1)(o)(ii) foreign-employment exemption leaves the tax base */
  const _fe = foreignEmpExemptAmount();
  /* Pension / annuity receipts (IRP5 codes 3603/3610/3611/3618): fully taxable at marginal rate (s10(2A), Second Schedule par 2) */
  const _pensionAnnuityGross = (APP.pensionAnnuityItems || []).reduce(function(s,p){ return s + (p.amount || 0); }, 0);
  /* T-7: "Other foreign income" (the manual catch-all field, b6-catchall-
     amount) was fully counted toward the s6quat foreign tax credit's income
     test (foreignTI, below) but never actually entered the tax base — a SA
     resident is taxed on worldwide income (s1 "gross income" / residence
     basis); the FTC exists to relieve DOUBLE taxation on income that IS
     taxed here, not to grant credit against untaxed income. collectForeignIncome()
     has no dependency on anything computed above, so it's safe to call here,
     once, as the single source for both this inclusion and the FTC numerator
     below (previously called only after adjGross, so this input was silently
     dropped from the tax base entirely). */
  const _fi = collectForeignIncome();
  /* T-C2 (owner-approved unification, batch-3 2026-07-11): py_ret_excess and
     the former separately-entered py_s10c_bal are ONE non-deducted-
     retirement-fund-contributions balance under SA tax law, not two —
     s11F(3) lets an excess be re-deducted in a later year (subject to that
     year's cap), and whatever is STILL not deducted is the SAME pool
     Second Schedule para 5/6 / s10C use to relieve a retirement lump sum or
     compulsory annuity received that year. Typing the same historical
     excess into two independent fields (the pre-unification UI) let it be
     relieved twice — once via s11F re-deduction, again via s10C exemption.
     Approved ordering (owner decision T-C, 2026-07-09; extended 2026-07-11):
     current-year s11F deduction (below) -> lump sums -> annuity/pension;
     whatever remains carries forward as next year's single py_ret_excess.
     This pass uses the GROSS pension/annuity figure for the s11F cap test
     itself: the s10C reduction of taxable pension/annuity income is only
     knowable AFTER this year's s11F test settles retExcess (this year's
     s10C pool), so it can't be circularly fed back into re-opening the cap
     test — it's applied to the bottom-line figures below instead. (retTIcap
     already excludes _cgt from its own base for the same kind of pragmatic
     sequencing reason.) */
  const _adjGrossForCap = grossNetOfLumpSums + _cgt + _rental + _business + _other + _cryptoRev + _invest + _twopotTotal + _pensionAnnuityGross + _fi.catchAll - _fe.exempt;
  /* FB1: subscripDed reads appliedValues (not live DOM) so Apply gates the calc; gated on dedChecks.subscrip for toggle-off (#14) */
  const _subscripOn = !!(APP.dedChecks && APP.dedChecks.subscrip);
  const _subscripVal = _subscripOn ? (_av.subscrip || 0) : 0;
  /* B-2: company-car (3802/3816 right-of-use benefit) deduction — Seventh
     Schedule para 7(4)/(7)/(8), a distinct benefit-reduction calculation
     from the s8(1)(b) travel-allowance deduction above, computed by
     calcCompanyCarDeduction() (04-deductions.js) and applied alongside it
     since both live on the same Travel deduction tab. */
  const _otherDed = (_av.travel || 0) + (_av.homeoffice || 0) + (_av.tools || 0)
                    + _subscripVal + (_av.subsistence || 0) + (_av.foreignSubsistence || 0) + (_av.companycar || 0);
  /* A2 (4116): medical scheme fees tax credit already reflected inside the
     employer's PAYE calculation — informational only, never a deduction. */
  /* BACKLOG 24: a code that belongs on another page (PAYE, retirement,
     medical, donations…) is never an Other claim — deductionCodeRoute(). */
  const _additionalDed = APP.deductionItems.reduce((s,i) => s + (deductionCodeRoute(i.code) ? 0 : i.amount), 0);
  /* engine-remediation W8 (s20(1)(b)/s11F(2)(c), H8/H13): the balance of
     assessed loss set-off happens BEFORE s11F and s18A — "taxable income"
     in s11F(2)(c)(ii) and s18A(1)(B) is by definition the s1 ITA term,
     which is only arrived at after the s20 loss set-off. Previously the
     prior-year loss was subtracted only once, at the very end, after both
     the retirement and donation caps had already been computed on an
     inflated base. */
  const pyLoss = gv('py_loss');
  const _tbS11FRawForCap = _adjGrossForCap - _otherDed - _additionalDed - pyLoss;
  const taxableIncomeBeforeS11FForCap = Math.max(0, _tbS11FRawForCap);

  // s11F base = max of remuneration and taxable-before-s11F (both net of lump sums, post-s20 loss)
  const s11FBase = Math.max(0, remuneration, taxableIncomeBeforeS11FForCap);

  const retPctTest = s11FBase * (ty.retirement.pct / 100);
  const retCapTest = ty.retirement.cap;
  /* s11F(2)(c): the deduction may also never exceed taxable income (before
     s11F and s18A, determined before including any taxable capital gain).
     Cap = min of the 27.5% test, the rand cap, AND this final TI cap. */
  const retTIcap = Math.max(0, taxableIncomeBeforeS11FForCap - _cgt);
  const retMax = Math.min(retPctTest, retCapTest, retTIcap);
  // Combined contributions = current year + prior year excess (both subject to cap)
  const retCombined = retTotal + pyRetExcess;
  /* v8.9 Batch 2: retirement deduction only applies while its toggle is on. */
  const _retOn = !!(APP.dedChecks && APP.dedChecks.retirement);
  const retAllowed = _retOn ? Math.min(retCombined, retMax) : 0;
  /* T-C2: retExcess ("still not deducted this year") is NOT gated by the
     toggle — it's simply whatever of retCombined didn't become retAllowed,
     s11F(3) style, regardless of why (cap-limited, or the deduction wasn't
     claimed at all this year). Gating it to 0 when the toggle is off would
     make the s10C pool (below) silently vanish whenever a taxpayer has no
     CURRENT-year contribution to claim but still carries a real historical
     non-deducted balance — which is exactly the taxpayer this balance most
     needs to serve (e.g. a retiree with no salary/RA this year, just a
     lump sum or annuity draw). */
  const retExcess  = Math.max(0, retCombined - retAllowed);

  /* T-C2: retExcess (this year's still-non-deducted balance, just settled
     above) is this year's available Second Schedule para 5/6 / s10C pool.
     walkLumpsums() consumes it against retirement/death/withdrawal lump
     sums FIRST (para 6(1)(b)(i); severance excluded — see walkLumpsums doc),
     then whatever it returns unused (s10cRemaining) exempts qualifying
     compulsory annuity/pension income next (the approved ordering). */
  const _lsWalk = walkLumpsums(APP.retirementLumpsums || [], retExcess, APP.priorLumpsumTaxable || 0);
  const rr = {
    twopotTotal: _twopotTotal, lumpSumGross: _lsWalk.lumpSumGross, lumpSumTax: _lsWalk.lumpSumTax,
    s10cOpening: _lsWalk.s10cOpening, s10cUsed: _lsWalk.s10cUsed, s10cRemaining: _lsWalk.s10cRemaining,
    cumPoolOpening: _lsWalk.cumPoolOpening, cumPoolClosing: _lsWalk.cumPoolClosing, retirementTaxFreeRemaining: _lsWalk.retirementTaxFreeRemaining
  };
  /* s10C (engine-remediation W23 + T-C2): whatever of this year's
     non-deducted-contribution pool remains after the lump-sum walk
     (rr.s10cRemaining) next exempts income from a COMPULSORY annuity/
     pension sourced from a retirement fund — codes 3603 (Pension), 3610
     (RAF Annuity), 3618 (Annuity from Provident/Provident Preservation
     Fund). Code 3611 (Purchased Annuity, taxable portion) is excluded:
     that's a voluntary annuity under the separate s10A regime, already
     reported net of its own capital-element exclusion — applying s10C on
     top would double-relieve the same contributions. Whatever isn't used
     here carries forward as next year's single py_ret_excess balance
     (reflected in s10cRemaining, returned below). */
  const _s10cQualifyingAnnuity = (APP.pensionAnnuityItems || []).reduce(function(s,p){ return S10C_ANNUITY_CODES[p.code] ? s + (p.amount || 0) : s; }, 0);
  const _s10cAnnuityExempt = Math.min(rr.s10cRemaining, _s10cQualifyingAnnuity);
  const _pensionAnnuity = _pensionAnnuityGross - _s10cAnnuityExempt;

  // Final bottom-line adjGross/taxable income uses the NET (s10C-exempted) pension/annuity figure.
  const _adjGross = grossNetOfLumpSums + _cgt + _rental + _business + _other + _cryptoRev + _invest + _twopotTotal + _pensionAnnuity + _fi.catchAll - _fe.exempt;
  const _tbS11FRaw = _adjGross - _otherDed - _additionalDed - pyLoss;
  /* Bases floor at 0 (can't test a cap against negative "income"); the loss
     itself is single-year (no s20 carry-out automation in this tool) — if
     it isn't fully absorbed, that's noted in the trace, not silently lost. */
  const taxableIncomeBeforeS11F = Math.max(0, _tbS11FRaw); /* V8.9 B4.CALC.3 lineage: exemption no longer subtracted; only taxable investment income is added */
  const lossUnabsorbed = Math.max(0, -_tbS11FRaw);

  // Reuse intermediate values computed above for s11F base
  const av = _av;
  const travelDed = av.travel || 0;
  const companyCarDed = av.companycar || 0;
  const homeOfficeDed = av.homeoffice || 0;
  const toolsDed = av.tools || 0;
  const subscripDed = _subscripVal; /* FB1: appliedValues path (not DOM) */
  const subsistenceDed = av.subsistence || 0; /* A3: appliedValues path (calcSubsistence-computed) */
  const foreignSubsistenceDed = av.foreignSubsistence || 0; /* PAYE-GEN-01-G03 review: calcForeignSubsistence-computed */
  const otherDed = _otherDed;
  const additionalDed = _additionalDed;
  const intExempt = _intExempt;
  const cgtTaxableGain = _cgt;
  const rentalIncome = _rental;
  const adjGross = _adjGross;

  /* S1 Batch 3: TEI (Tax-Exempt Income) canonical field. Sum all exempt
     income components already computed and available. Do NOT change adjGross
     arithmetic — tei is a new reporting field, not a new deduction. */
  const _exemptLocalDiv = taxableIt3bItems().reduce((s, i) => s + (i.exemptLocalDividends || 0), 0);
  const _cgtAgg = cgtAggregate();
  const _cgtExempt = Math.max(0, _cgtAgg.afterExcl - _cgtAgg.taxableGain);
  const tei = _intExempt + _exemptLocalDiv + _cgtExempt + _fe.exempt + _s10cAnnuityExempt
            + nonTaxableTotal + (rr.s10cUsed || 0);
  const gi = adjGross + tei;

  // Taxable income before donations (W8: loss set-off now folded into taxableIncomeBeforeS11F)
  const tbd = taxableIncomeBeforeS11F - retAllowed; /* s18A(1)(B): TI before s18A and s6quat(1C) — post-s20 */

  // Donations (s18A, capped at 10% of taxable income before donations after s11F, post-s20 loss)
  // py_s18a_excess: prior year excess donations b/f added to this year's gross donation total (s18A)
  const donTotal = (av.donations || 0) + gv('py_s18a_excess');
  const donMax = Math.max(0, tbd) * (ty.donationPct/100);
  const donAllowed = Math.min(donTotal, donMax);
  /* s18A(1) proviso: donations disallowed SOLELY because they exceed the 10%
     cap are deemed to be a donation made in the following year, carrying
     forward (re-capped at 10% again each year) until fully utilised — not
     forfeited. This is that carry-out balance for next year's py_s18a_excess. */
  const donExcess = Math.max(0, donTotal - donAllowed);

  const taxableIncome = Math.max(0, tbd - donAllowed);
  const taxOnIncome = calcTaxOnIncome(taxableIncome, ty.brackets);
  const rebates = calcRebates(age, ty);
  // engine-remediation W3: taxableIncome already excludes lump-sum codes (via
  // grossNetOfLumpSums, computed above) — s1 ITA's "taxable income" for s6B
  // purposes excludes retirement fund lump sum/withdrawal/severance benefits,
  // but that exclusion happens once, upstream. Subtracting lumpSumTotal again
  // here double-counted it, shrinking the 7.5% threshold base and overstating
  // s6B for under-65 taxpayers with lump sums in the year.
  const taxableIncomeForMedical = taxableIncome;
  /* V8.6 K4: derive isMain from explicit user answer to "Are you on a medical aid" — prevents pre-population */
  /* FB1: gate on dedChecks.medical — toggle-off drops credit to zero (#14) */
  const _medOn = !!(APP.dedChecks && APP.dedChecks.medical);
  const isMedicalMember = _medOn && isMedicalSchemeMemberDom();
  /* BACKLOG 25 (WR-8): the inputs calcTaxForYear() needs to redo the credit
     at another taxable income — s6B's under-65 threshold moves with it — so a
     what-if (the RA top-up analyser) never holds med.total fixed. */
  const medInputs = _medOn
    ? { isMain: isMedicalMember, deps: gv('med_deps'), contrib: gv('med_monthly'), employer: gv('med_employer'), oop: gv('med_oop'), disability: gv('med_disability') === 1 }
    : null;
  const med = medInputs
    ? calcMedicalCredits(age, ty, medInputs.isMain, medInputs.deps, medInputs.contrib, medInputs.employer, medInputs.oop, medInputs.disability, taxableIncomeForMedical)
    : { total: 0, s6a: 0, s6b: 0 };
  const taxAfterRebates = Math.max(0, taxOnIncome - rebates);
  /* engine-remediation W9 (s6quat rebuild — IN18 pp.41/58): ONE overall
     s6quat(1B) limitation across ALL foreign-sourced taxable income, not a
     per-source-code basket. The prior per-basket design (dividends/interest
     each capped independently against their own proportional SA tax, plus a
     UI-computed residual "other" pool) never over-credited but systematically
     overtaxed relative to this single test — IN18's own worked examples
     (p.47, p.58) apply one blended limitation. collectForeignIncome is the
     one place that assembles every foreign source (IT3(b) dividends/interest,
     rental, business, CGT, foreign-service salary, catch-all); the engine
     owns the full limitation math below. (_fi itself was already collected
     above, before adjGross, so its catch-all income could enter the tax base.) */
  const foreignServiceTaxablePortion = Math.max(0, _fi.foreignService - _fe.exempt); // s10(1)(o)(ii) exempt portion leaves the base
  /* REVIEW AMENDMENT: taxpayer-adverse clamp on the foreign-included CGT
     portion, no pro-rata exclusion attribution. foreignCgtRawGain (raw,
     pre-exclusion foreign gains, from the CGT module) is clamped against the
     WHOLE-portfolio post-exclusion/post-loss-b/f net gain (before inclusion),
     then the statutory inclusion rate applies. This can never exceed the true
     statutory foreign portion (IN18 p.52 principle) — the credit can only
     come out equal to or lower than the correct pro-rata figure, never higher. */
  const _postExclusionNetGain = Math.max(0, _av.cgtAfterExclBeforeInclusion || 0);
  const foreignCgtIncludedPortion = Math.max(0, Math.min(_fi.foreignCgt, _postExclusionNetGain)) * ty.cgt.inclusion;
  const _foreignTIRaw = Math.max(0, _fi.foreignDividends) + Math.max(0, _fi.foreignInterest)
                      + Math.max(0, _fi.foreignRental) + Math.max(0, _fi.foreignBusiness)
                      + Math.max(0, foreignServiceTaxablePortion) + Math.max(0, foreignCgtIncludedPortion)
                      + Math.max(0, _fi.catchAll) + Math.max(0, _fi.foreignPension);
  const foreignTI = Math.min(_foreignTIRaw, taxableIncome); // IN18 Example 26: foreign TI can't exceed total TI
  const ftcLimit = taxableIncome > 0 ? (foreignTI / taxableIncome) * taxOnIncome : 0;
  /* av.ftc_bf = prior-year FTC brought forward (7-year carry-forward, para (iii)
     proviso to s6quat(1B)(a)) — added straight to qualifying foreign tax, same
     treatment as this year's own foreign tax paid. */
  const ftcQualifying = _fi.foreignTaxDividends + _fi.foreignTaxInterest + _fi.otherTax + (av.ftc_bf || 0);
  const _ftc = Math.min(ftcQualifying, ftcLimit, Math.max(0, taxAfterRebates - med.total));
  /* Excess over the (1B)(a) limitation itself carries forward 7 years; any
     ADDITIONAL amount blocked only by the no-refund guard (remaining tax
     after rebates/medical) is forfeited, not carried (IN18 p.8). */
  const ftcCarryOut = Math.max(0, ftcQualifying - ftcLimit);
  const taxPayable = Math.max(0, taxAfterRebates - med.total - _ftc);
  // V8.4 II.3: PAYE is the sum of the employer entries (the single paye_deducted field is gone — BACKLOG 26)
  const payeDeducted = (APP.employerPaye || []).reduce((s,e)=>s+(e.paye||0), 0);
  /* engine-remediation W11 (Fourth Schedule para 9(3) directives; ITR12
     assessment fields): lump-sum tax withheld by the fund under its SARS
     directive (IRP5/IT3(a) code 4115) is a payment credit against the total
     tax for the year, exactly like PAYE — two-pot withdrawal amounts are
     taxed at marginal rate INSIDE taxPayable already, so the fund's
     directive withholding on a two-pot withdrawal is likewise a credit, not
     a separate final tax. The balance now reflects the FULL tax liability
     for the year (normal tax + lump-sum tax) net of both payment credits,
     replacing the previous design where lump-sum tax was excluded from the
     balance as "final". */
  const lumpSumWithheld = (APP.retirementLumpsums || []).reduce((s,l) => s + (l.taxWithheld || 0), 0)
                        + (APP.twopotWithdrawals  || []).reduce((s,t) => s + (t.taxWithheld || 0), 0);
  /* T-9: provisional tax already paid toward THIS year (P1/P2/top-up, per
     para 21 Fourth Schedule) is a payment credit against the same annual
     liability as PAYE — SARS's own ITA34 assessment nets tax payable minus
     PAYE minus provisional tax paid. This balance previously ignored these
     three fields entirely, so any provisional taxpayer who had already paid
     P1/P2 saw the Dashboard/Tax Return "amount owing" overstated by exactly
     what they'd already paid SARS. */
  const provisionalPaid = gv('p_prov_p1') + gv('p_prov_p2') + gv('p_prov_topup');
  /* QR9a (s12T(7)): the tax-free investment excess charge — see calcTfiCharge. */
  const tfiCharge = tfiChargeForActiveYear().charge;
  const balance = (taxPayable + rr.lumpSumTax + tfiCharge) - payeDeducted - lumpSumWithheld - provisionalPaid;
  const effectiveRate = adjGross > 0 ? taxPayable / adjGross : 0;

  // Marginal rate (L-2 fix: when rebates fully absorb the tax, the user owes nothing,
  // so the meaningful marginal rate is 0 — not 18% from a notional bracket lookup.
  // We also guard the zero-income case explicitly.)
  const mb = ty.brackets.slice().reverse().find(b => taxableIncome >= b.min);
  const marginalRate = (taxableIncome <= 0 || taxPayable <= 0) ? 0 : (mb ? mb.rate : 0);

  /* ── DISCLOSURE TRACE (opt-in) ──
     When APP._trace is an array (set only by the verification bench, never in the
     shipping app), record the key branches/caps with their formula + SARS cite so
     the bench can show HOW each number was reached without re-deriving the math.
     Null-guarded: zero cost and zero behaviour change when _trace is absent. */
  if (Array.isArray(APP._trace)) {
    const T = (label, value, formula, cite) => APP._trace.push({ label, value, formula, cite });
    T('Tax year', ty.year != null ? ty.year : gs('taxYear'), 'selected tax year', 'Rates per TAX_YEARS table');
    T('Age at year end', age, 'derived from DOB at last day of Feb', 's6 ITA (rebate age bands)');
    T('Gross income (all receipts)', gross, 'Σ incomeItems.amount', 's1 "gross income"');
    T('Less: lump sums (taxed separately)', -lumpSumTotal, 'Σ IRP5 lump-sum codes', 'Para 2(1) Second Schedule');
    T('Less: non-taxable IRP5 codes', -nonTaxableTotal, '3602/3703/3714/3821/3822 etc. + long service award exclusion (3622)', 's10/exempt codes; s1 "gross income" par (c) proviso (vii)');
    T('Remuneration (Fourth Schedule)', remuneration, 'Σ remuneration-base IRP5 codes', '4th Schedule par 1');
    if (_s10cAnnuityExempt > 0) {
      T('s10C annuity exemption', -_s10cAnnuityExempt, 'min(s10C balance remaining after lump-sum relief, qualifying pension/annuity — codes 3603/3610/3618)', 's10C');
    }
    T('Adjusted gross (tax base)', adjGross, 'grossNetOfLumpSums + CGT + rental + business + other + crypto + investment + two-pot + pension/annuity (net of s10C) + other foreign income − foreign-emp exempt', 'composition of taxable income');
    T('Prior-year assessed loss set-off', -pyLoss, 'set-off of balance of assessed loss, applied before s11F/s18A', 's20(1)(b)');
    if (lossUnabsorbed > 0) {
      T('Assessed loss not fully absorbed this year', lossUnabsorbed, 'loss exceeds income before s11F/s18A — balance not automated (single-year tool)', 's20(1)(a) carry-forward (manual)');
    }
    T('Taxable income before s11F & s18A (post-s20)', taxableIncomeBeforeS11F, 'max(0, adjGross − other ded − additional ded − assessed loss)', 's1 "taxable income" / s20');
    T('s11F base', s11FBase, 'max(remuneration, taxable income before s11F & s18A)', 's11F(2)(b)');
    T('Retirement 27.5% test', retPctTest, s11FBase + ' × ' + ty.retirement.pct + '%', 's11F(2)(b)');
    T('Retirement rand cap', retCapTest, 'statutory annual cap', 's11F(2)(a)');
    T('Retirement final TI cap', retTIcap, 'taxable income before s11F/s18A − taxable capital gain', 's11F(2)(c)');
    T('Retirement deduction cap', retMax, 'min(27.5% test, rand cap, final TI cap)', 's11F(2)');
    T('Retirement contributions (incl. prior-yr excess)', retCombined, retTotal + ' + ' + pyRetExcess + ' (prior-year excess)', 's11F(3)');
    T('Retirement deduction allowed', retAllowed, _retOn ? 'min(contributions, cap)' : 'retirement toggle off → 0', 's11F');
    T('Retirement excess carried forward', retExcess, 'max(0, contributions − cap)', 's11F(3) carry-forward');
    T('Taxable income before donations', tbd, 'taxable income before s11F/s18A − retirement deduction', 's18A(1)(B)');
    T('Donations 10% cap', donMax, 'max(0, taxable before donations) × ' + ty.donationPct + '%', 's18A(1)(B)');
    T('Donations allowed', donAllowed, 'min(donations, 10% cap)', 's18A');
    if (donExcess > 0) {
      T('Donations excess carried forward', donExcess, 'max(0, total donations − allowed) — re-capped at 10% next year', 's18A(1) proviso');
    }
    T('Taxable income', taxableIncome, 'max(0, before-donations − donations)', 's5(2)');
    T('Tax on income (brackets)', taxOnIncome, 'progressive bracket lookup on floored taxable income', 's5 / rate tables');
    T('Rebates', rebates, 'primary' + (age >= 65 ? ' + secondary' : '') + (age >= 75 ? ' + tertiary' : ''), 's6(2)');
    T('Tax after rebates', taxAfterRebates, 'max(0, tax on income − rebates)', 's6');
    T('Medical tax credit (s6A scheme fees)', med.s6a, 'monthly credit × members × 12', 's6A');
    T('Medical tax credit (s6B additional)', med.s6b, isMedicalMember ? 'excess scheme fees + OOP test vs 7.5%/33.3% threshold' : 'not a scheme member → 0', 's6B');
    T('Total medical credits', med.total, 's6A + s6B', 's6A/s6B');
    T('Total foreign taxable income (single overall basket)', foreignTI, 'Σ foreign div/int/rental/business/service/CGT-included/catch-all/pension, clamped ≤ total taxable income', 's6quat(1B); IN18 Example 26');
    T('s6quat(1B) limitation', ftcLimit, '(foreign TI / total taxable income) × tax on income', 's6quat(1B); IN18 p.41/58');
    T('Qualifying foreign tax (incl. b/f)', ftcQualifying, 'Σ foreign tax paid (div + int + other) + FTC brought forward', 's6quat(1A)');
    T('Foreign tax credit (s6quat)', _ftc, 'min(qualifying foreign tax, limitation, remaining tax after rebates & medical)', 's6quat(1A)/(1B)');
    T('Foreign tax credit carried forward', ftcCarryOut, 'max(0, qualifying foreign tax − limitation) — 7 years', 'para (iii) proviso to s6quat(1B)(a)');
    T('Tax payable (before PAYE)', taxPayable, 'max(0, tax after rebates − medical credits − FTC)', 'net normal tax');
    T('Less: PAYE / employees tax', -payeDeducted, 'Σ employer PAYE', '4th Schedule');
    T('Lump-sum tax (separate tables)', rr.lumpSumTax, 'retirement/withdrawal lump-sum tables', 'Second Schedule');
    T('Less: lump-sum tax withheld by fund (4115/directive)', -lumpSumWithheld, 'Σ retirementLumpsums.taxWithheld + Σ twopotWithdrawals.taxWithheld', '4th Schedule para 9(3)');
    if (provisionalPaid > 0) {
      T('Less: provisional tax paid (P1/P2/top-up)', -provisionalPaid, 'p_prov_p1 + p_prov_p2 + p_prov_topup', 'para 21 Fourth Schedule');
    }
    if (tfiCharge > 0) {
      T('Tax-free investment excess charge', tfiCharge, S12T_EXCESS_CHARGE_RATE + ' × (contributions over the annual limit) + ' + S12T_EXCESS_CHARGE_RATE + ' × (lifetime excess not already charged)', 's12T(7)(a)/(b)');
    }
    T('Balance (payable + / refund −)', balance, '(tax payable + lump-sum tax + s12T(7) charge) − PAYE − lump-sum tax withheld − provisional tax paid', 'assessment outcome');
    T('Total tax for the year', taxPayable + rr.lumpSumTax + tfiCharge, 'normal tax payable + lump-sum tax + s12T(7) charge', 'total liability');
  }

  return {
    gross, adjGross, gi, tei, retTotal, retAllowed: Math.round(retAllowed * 100) / 100, retExcess: Math.round(retExcess * 100) / 100, retMax: Math.round(retMax * 100) / 100, lumpSumTotal, nonTaxableTotal,
    medInputs,
    otherDed, additionalDed,
    travelDed, companyCarDed, homeOfficeDed, toolsDed, subscripDed, subsistenceDed, foreignSubsistenceDed,
    intExempt, cgtTaxableGain, rentalIncome,
    businessIncome: _business, otherReceiptsIncome: _other, cryptoRevenue: _cryptoRev, investmentIncome: _invest,
    pensionAnnuity: _pensionAnnuity, pensionAnnuityGross: _pensionAnnuityGross, s10cAnnuityExempt: _s10cAnnuityExempt,
    donTotal, donAllowed, donExcess, donMax, tbd, taxableIncome, taxOnIncome, rebates, med,
    taxAfterRebates, taxPayable, ftc: _ftc, ftcLimit, ftcQualifying, ftcCarryOut, payeDeducted, provisionalPaid, balance,
    lumpSumTax: rr.lumpSumTax, lumpSumGross: rr.lumpSumGross, twopotTotal: rr.twopotTotal, lumpSumWithheld,
    s10cOpening: rr.s10cOpening, s10cUsed: rr.s10cUsed, s10cRemaining: rr.s10cRemaining - _s10cAnnuityExempt,
    cumPoolOpening: rr.cumPoolOpening, cumPoolClosing: rr.cumPoolClosing, retirementTaxFreeRemaining: rr.retirementTaxFreeRemaining,
    foreignEmpExempt: _fe.exempt, foreignEmpQualifying: _fe.qualifying, foreignOtherIncome: _fi.catchAll,
    exemptLocalDividends: _exemptLocalDiv, cgtExempt: _cgtExempt,
    /* Exempt, but in neither gi nor tei (see exemptMemoBreakdown). */
    foreignDividendsExempt: _fi.foreignDividendsExempt, primaryResExcluded: _cgtAgg.primaryResExcluded,
    totalTaxYear: (taxPayable + rr.lumpSumTax + tfiCharge),
    effectiveRate, marginalRate, age, ty, pyLoss, pyRetExcess, lossUnabsorbed,
    s11FBase, remuneration
  };
}

/* S2 Batch 5: GTI (calcFullTax().adjGross) broken down by income source,
   for the Dashboard's "Gross taxable income" donut. Composed entirely from
   calcFullTax()'s own canonical fields — no re-derivation from raw
   APP.incomeItems by category, which is exactly what produced A5's six
   divergences on the Income hero (01-AUDIT.md §2). Every entry here is a
   TAXABLE source (TEI is excluded by construction, not filtered after the
   fact): foreign employment appears net of its s10(1)(o)(ii) exemption, and
   nothing here double-subtracts or omits a component adjGross itself adds —
   the array's own POSITIVE entries are asserted to sum to r.adjGross
   exactly WHEN every source is non-negative (TEST-7) — a business or
   rental result can be a loss (negative), which a donut slice can't
   represent; the caller must check for a negative entry itself and skip
   the chart in that case (same "no chart on a negative intermediate" rule
   the retirement cap card follows, S2 Batch 12), not filter it silently,
   which would make the remaining positive slices oversum the total.
   Exported so the Income hero (S2 Batch 8) can adopt the same per-source
   figures instead of keeping its own parallel derivation. */
export function gtiSourceBreakdown(r) {
  const foreignQualifying = r.foreignEmpQualifying || 0;
  const foreignTaxable = Math.max(0, foreignQualifying - (r.foreignEmpExempt || 0)) + (r.foreignOtherIncome || 0);
  const employmentNet = Math.max(0, (r.gross || 0) - (r.lumpSumTotal || 0) - (r.nonTaxableTotal || 0) - foreignQualifying);
  return [
    { label: 'Employment', val: employmentNet },
    { label: 'Foreign income', val: foreignTaxable },
    { label: 'Pension/Annuity', val: r.pensionAnnuity || 0 },
    { label: 'Two-Pot', val: r.twopotTotal || 0 },
    { label: 'Capital Gains', val: r.cgtTaxableGain || 0 },
    { label: 'Rental (net)', val: r.rentalIncome || 0 },
    { label: 'Business', val: r.businessIncome || 0 },
    { label: 'Investment', val: r.investmentIncome || 0 },
    { label: 'Crypto', val: r.cryptoRevenue || 0 },
    { label: 'Other Receipts', val: r.otherReceiptsIncome || 0 },
  ].filter(function(c){ return c.val !== 0; });
}

/* HERO-2: the deductions that reduce taxable income, one line each, for the
   Dashboard "Deductions" card's rows and its ring. Every figure is a
   calcFullTax() field; they sum to retAllowed + otherDed + donAllowed +
   additionalDed by construction (otherDed is exactly the eight middle lines —
   see _otherDed in calcFullTax()). */
export function deductionBreakdown(r) {
  return [
    { label: 'Retirement contributions', val: r.retAllowed || 0 },
    { label: 'Travel', val: r.travelDed || 0 },
    { label: 'Company car', val: r.companyCarDed || 0 },
    { label: 'Home office', val: r.homeOfficeDed || 0 },
    { label: 'Tools/equipment', val: r.toolsDed || 0 },
    { label: 'Professional memberships', val: r.subscripDed || 0 },
    { label: 'Subsistence', val: r.subsistenceDed || 0 },
    { label: 'Foreign subsistence', val: r.foreignSubsistenceDed || 0 },
    { label: 'Donations', val: r.donAllowed || 0 },
    { label: 'Other deductions', val: r.additionalDed || 0 },
  ].filter(function(c){ return c.val > 0; });
}
/* The Deductions ring's hues. Only three, on purpose. In a ring this small
   every slice can touch every other, so the set was measured all-pairs with
   the dataviz validator against both themes' surfaces: violet / amber /
   emerald plus --tx2 for the rest is the largest set of the app's tokens that
   clears the normal-vision floor (worst pair 18.4 dark, 16.7 light; floor 15).
   Under simulated colour-blindness emerald/amber sits at 8.0 dark, 7.7 light —
   the band that is acceptable only with a second cue, which the card's rows
   give: each repeats its colour beside the name and amount, and slices are
   separated by a gap. What did not make it: rose and steel blue fall under
   the floor against the rest slice, cyan/navy/mint against one of the three,
   and --neutral itself against amber and emerald in light (which is why the
   rest slice is --tx2, not the neutral). The dark theme's hues also sit above
   the validator's lightness band — the token-level limit INCOME_DONUT_COLOUR's
   comment records, not something this map can fix.
   Every deduction without an entry shares the one "everything else" slice.
   Travel and Company car are one family (both are the cost of a vehicle used
   for work, on the same tab). */
export var DEDUCTION_RING_COLOUR = {
  'Retirement contributions': 'var(--violet)',
  'Travel':                   'var(--amber)',
  'Company car':              'var(--amber)',
  'Home office':              'var(--emerald)',
};
export var DEDUCTION_RING_REST = 'var(--tx2)';
export function deductionRingColour(label) {
  return DEDUCTION_RING_COLOUR[label] || DEDUCTION_RING_REST;
}

/* STD-BEHAV-5: every list page's add button says "Add your first ..." while the list is
   empty and "Add ..." once an entry exists. The button carries what it counts and both
   wordings in its markup (data-add-list: APP array names, comma-separated; data-add-first;
   data-add-more), so the wording lives next to the button it labels and nothing here knows
   a page. Called from renderAll(), which every add, delete and import already reaches. */
export function syncAddCtas() {
  document.querySelectorAll('[data-add-list]').forEach(function(btn) {
    var n = btn.dataset.addList.split(',').reduce(function(s, k) { return s + ((APP[k.trim()] || []).length); }, 0);
    var lbl = btn.querySelector('.add-cta-lbl');
    var text = n ? btn.dataset.addMore : btn.dataset.addFirst;
    if (lbl && lbl.textContent !== text) lbl.textContent = text;
  });
}

/* S2 Batch 11: GI (calcFullTax().gi = adjGross + tei) broken down by
   source, for the Income page's "Gross income" card/donut. GI includes
   every TEI-bearing source at its GROSS (pre-exemption) figure — unlike
   gtiSourceBreakdown() above, nothing here is netted of an exemption; the
   exemption itself is a separate line on the Exempt income card
   (teiBreakdown() below). Verified to sum to r.gi exactly: gi's own
   composition (adjGross + tei) carries one term with no natural "source"
   of its own — r.s10cUsed, non-deducted retirement contributions relieved
   against a lump sum this year — included here as its own line for that
   reason, not because it is a income source in the ordinary sense. */
export function giSourceBreakdown(r) {
  const foreignQualifying = r.foreignEmpQualifying || 0;
  const employmentGross = Math.max(0, (r.gross || 0) - (r.lumpSumTotal || 0) - (r.nonTaxableTotal || 0) - foreignQualifying);
  return [
    { label: 'Employment', val: employmentGross },
    { label: 'Non-taxable income', val: r.nonTaxableTotal || 0 },
    { label: 'Foreign income', val: foreignQualifying + (r.foreignOtherIncome || 0) },
    { label: 'Pension/Annuity', val: r.pensionAnnuityGross || 0 },
    { label: 'Two-Pot', val: r.twopotTotal || 0 },
    { label: 'Capital Gains', val: (r.cgtTaxableGain || 0) + (r.cgtExempt || 0) },
    { label: 'Rental (net)', val: r.rentalIncome || 0 },
    { label: 'Business', val: r.businessIncome || 0 },
    { label: 'Investment', val: (r.investmentIncome || 0) + (r.intExempt || 0) + (r.exemptLocalDividends || 0) },
    { label: 'Crypto', val: r.cryptoRevenue || 0 },
    { label: 'Other Receipts', val: r.otherReceiptsIncome || 0 },
    { label: 'Non-deducted contributions relief (lump sum)', val: r.s10cUsed || 0 },
  ].filter(function(c){ return c.val !== 0; });
}

/* S2 Batch 11: TEI (calcFullTax().tei) broken down by component, for the
   new Exempt income card. Every term tei itself sums — listed
   individually per Allan's instruction ("each its own line, not summed
   silently"), not re-derived. */
export function teiBreakdown(r) {
  return [
    { label: 'Exempt interest', val: r.intExempt || 0 },
    { label: 'Exempt local dividends', val: r.exemptLocalDividends || 0 },
    { label: 'Exempt 60% of capital gains', val: r.cgtExempt || 0 },
    { label: 'Foreign-employment exemption (s10(1)(o)(ii))', val: r.foreignEmpExempt || 0 },
    { label: 's10C annuity exemption', val: r.s10cAnnuityExempt || 0 },
    { label: 'Non-taxable IRP5 codes', val: r.nonTaxableTotal || 0 },
    { label: 'Non-deducted contributions relief (lump sum)', val: r.s10cUsed || 0 },
  ].filter(function(c){ return c.val !== 0; });
}

/* INC-20: two exemptions that are real but sit in neither r.gi nor r.tei — the
   exempt 25/45 of foreign dividends (s10B(3); the engine only ever carries the
   taxable 20/45) and the gain a primary-residence exclusion removes inside
   cgtAggregate() (only the net gain reaches the totals). The Exempt income card
   lists them apart, under its total, so the total and every tax figure keep
   their meaning; they are engine outputs, not worked out for the card. */
export function exemptMemoBreakdown(r) {
  return [
    { label: 'Foreign dividends, exempt 25/45', val: r.foreignDividendsExempt || 0 },
    { label: 'Primary residence exclusion', val: r.primaryResExcluded || 0 },
  ].filter(function(c){ return c.val > 0; });
}

/* S2 Batch 11: comprehensive foreign-income-by-source breakdown for the
   Income page's "Foreign income" card/donut — every foreign-flagged
   source across every category (not just employment, unlike
   gtiSourceBreakdown()'s narrower "Foreign income" line, which exists
   only to avoid double-counting against that card's own Employment
   chip). Foreign employment is shown net of its s10(1)(o)(ii) exemption
   ("the taxable portion, not gross" — pinned at Gate 2). Built from
   collectForeignIncome() (02-core.js), the same one-source-of-truth
   collector the s6quat(1B) limitation itself uses — nothing here is
   re-derived. This card's total is a cross-category overlay, not an
   additive GI/GTI component, so it only needs to sum to itself. */
export function foreignIncomeBreakdown(r) {
  const fi = collectForeignIncome();
  const foreignEmpTaxable = Math.max(0, (fi.foreignService || 0) - (r.foreignEmpExempt || 0));
  return [
    { label: 'Foreign employment (net of exemption)', val: foreignEmpTaxable },
    { label: 'Foreign interest', val: fi.foreignInterest || 0 },
    { label: 'Foreign dividends (taxable portion)', val: fi.foreignDividends || 0 },
    { label: 'Foreign rental', val: fi.foreignRental || 0 },
    { label: 'Foreign business', val: fi.foreignBusiness || 0 },
    { label: 'Foreign capital gains', val: fi.foreignCgt || 0 },
    { label: 'Other foreign income', val: fi.catchAll || 0 },
  ].filter(function(c){ return c.val !== 0; });
}

/* ── STORAGE ── */
/* BACKLOG 73: the registry is read before anything else at boot, so a stored
   value of the wrong shape (`null`, `{}`, `[null]`) must not stop boot or
   account creation — only records with a username are returned. */
export function getUsers() {
  let v;
  try { v = JSON.parse(localStorage.getItem(SK.USERS) || '[]'); } catch { return []; }
  return Array.isArray(v) ? v.filter(u => u && typeof u === 'object' && typeof u.username === 'string' && u.username) : [];
}
export function saveUsers(arr) {
  // §8 M-5: localStorage.setItem can throw QuotaExceededError. We surface
  // the failure to the user instead of failing silently.
  try { localStorage.setItem(SK.USERS, JSON.stringify(arr)); }
  catch (e) { _onStorageError(e, 'user list'); throw e; }
}

/* §8 M-5: shared storage-failure handler. Distinguishes quota errors (need
   user action) from other errors (programming faults).
   Design handoff 05-data-safety.md §6: storage-full is a persistent status
   card, not a toast — "never say only 'storage is full'". Other write
   failures stay a toast (transient, not a data-safety concern). */
export function _onStorageError(err, context) {
  const isQuota = err && (err.name === 'QuotaExceededError'
                       || err.code === 22  // legacy WebKit
                       || err.code === 1014 // legacy Firefox
                       || /quota|exceed/i.test(String(err.message)));
  console.error(`Storage error (${context}):`, err);
  if (isQuota) {
    if (typeof _setDsStatusFailed === 'function') _setDsStatusFailed();
  } else if (typeof showToast === 'function') {
    showToast('Could not save your data. Please try again.', 'error', 'error');
  }
}

/* V8.3 §3: encrypted-storage I/O.
   - Writes: encrypt JSON with AUTH.pinKey, store as {v:3, iv, ct}.
   - Reads: v:3 → decrypt with the current key; anything else reads as no data
     (DATA-1 — the V8.2 plaintext format is not carried, BACKLOG 78).
   - We keep persistData() synchronous-looking by fire-and-forget — debounce ensures
     overlapping writes don't corrupt: only the latest plaintext is queued, and a
     short serialised promise chain protects atomicity per user. */

export let _writeChain = Promise.resolve();
export function _enqueueWrite(fn) {
  _writeChain = _writeChain.then(fn).catch(e => console.error('persist write:', e));
  return _writeChain;
}

/* ── ENCRYPTED REGISTRY PII ──
   The iss_users registry must be readable BEFORE unlock, so it keeps only
   what the login screen needs: username, PIN verifier + salts, timestamps.
   Identity fields (PII_FIELDS) are sealed into rec.pii — AES-GCM under the
   user's data key — when the record is created, and decrypted once into
   AUTH.pii at unlock. No record ever holds plaintext PII (DATA-1: no
   earlier-version record is carried, so the plaintext reader and its
   one-time sealing step are gone — BACKLOG 78). */
/* driveAccount (QR10a, QD-05): the Google account this profile's cloud backup is
   bound to — an e-mail, so PII (hard rule 8). No DOM mirror.
   fullName (BACKLOG 71, owner 2026-10-14): sealed like the rest — before
   unlock the login list and lock screen identify a profile by @username. */
export const PII_FIELDS = ['dob', 'email', 'taxRef', 'driveAccount', 'fullName'];
export function getUserPii() { return AUTH.pii || {}; }
/* The profile's name, from the unlocked PII; '' while locked. */
export function getUserFullName() { return (AUTH.pii && AUTH.pii.fullName) || ''; }
export async function _sealUserPii(rec, plain, key) {
  rec.pii = await aesEncrypt(key || AUTH.pinKey, JSON.stringify(plain || {}));
  PII_FIELDS.forEach(f => delete rec[f]);
}
export async function _openUserPii(rec, key) {
  let out = {};
  if (rec && rec.pii) {
    try { out = JSON.parse(await aesDecrypt(key || AUTH.pinKey, rec.pii.iv, rec.pii.ciphertext)) || {}; }
    catch (e) { console.error('pii decrypt:', e); out = {}; }
  }
  return out;
}

export async function _writeEncryptedUserData(username, plaintext) {
  if (!AUTH.pinKey) {
    console.error('Cannot persist: no key in memory (locked)');
    return;
  }
  const { iv, ciphertext } = await aesEncrypt(AUTH.pinKey, plaintext);
  const wrapper = { v: STORAGE_VERSION, iv, ct: ciphertext };
  // §8 M-5: handle quota / setItem failures gracefully
  try { localStorage.setItem(SK.data(username), JSON.stringify(wrapper)); }
  catch (e) { _onStorageError(e, 'user data'); throw e; }
}

/* loadUserData stays synchronous: it returns the encrypted-wrapper object
   (decrypted by the caller), or null. */
export function loadUserDataRaw(username) {
  try {
    const s = localStorage.getItem(SK.data(username));
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* Decrypt a wrapper produced by _writeEncryptedUserData. Async. */
export async function _decryptUserData(wrapper) {
  if (!wrapper || wrapper.v !== STORAGE_VERSION) return null;
  if (!AUTH.pinKey) throw new Error('No PIN key — app is locked');
  const pt = await aesDecrypt(AUTH.pinKey, wrapper.iv, wrapper.ct);
  try { return JSON.parse(pt); } catch { return {}; }
}


/* QR10a.0 (WR-8): THE list of what a profile saves. persistData() writes it
   to encrypted localStorage and _buildExportPayload() puts it in every
   export, the local snapshot and the cloud backup — one function, so the two
   can never drift apart again (the export used to keep its own hand copy and
   was 20 keys behind: IT3(b), business, retirement, crypto, other receipts,
   carried balances, Easy View). A field added here is saved AND exported;
   hydrateFromData() is its inverse. */
export function _collectUserData() {
  return {
    taxYear: gs('taxYear'),
    // V8.4 B: New income type multi-select (replaces p_income_primary + secondaryIncome)
    incomeTypes: getSelectedIncomeTypes(),
    p_provisional: gs('p_provisional'), p_prov_status: gs('p_prov_status'),
    p_prov_p1: gv('p_prov_p1'), p_prov_p2: gv('p_prov_p2'), p_prov_topup: gv('p_prov_topup'),
    p_taxref: gs('p_taxref'), fs_qualifies: gs('fs_qualifies'),
    fs_days_outside: gv('fs_days_outside'), fs_days_total: gv('fs_days_total'),
    p_tax_residency: gs('p_tax_residency'),
    p_has_medical_aid: gs('p_has_medical_aid'),
    p_medscheme: gs('p_medscheme'),
    py_loss: gv('py_loss'), py_ret_excess: gv('py_ret_excess'), py_basic_amount: gv('py_basic_amount'), py_owed: gv('py_owed'),
    py_unsubmitted: gv('py_unsubmitted'), py_refund_prior: gv('py_refund_prior'),
    py_refund_current: gv('py_refund_current'),
    ded_pension: gv('ded_pension'), ded_provident: gv('ded_provident'),
    ded_ra: gv('ded_ra'),
    ded_subscrip: gv('ded_subscrip'),
    med_main: gv('med_main'), med_deps: gv('med_deps'), med_self_premium: gs('med_self_premium'), med_has_deps: gs('med_has_deps'),
    med_monthly: gv('med_monthly'), med_employer: gv('med_employer'),
    med_oop: gv('med_oop'), med_disability: gv('med_disability'),
    int_gross: gv('int_gross'),
    tv_vehicle_val: gv('tv_vehicle_val'), tv_date_acq: gs('tv_date_acq'),
    tv_odo_open: gv('tv_odo_open'), tv_odo_close: gv('tv_odo_close'),
    tv_bus_km: gv('tv_bus_km'), tv_allowance: gv('tv_allowance'),
    tv_fuel: gv('tv_fuel'), tv_maint: gv('tv_maint'), tv_insure: gv('tv_insure'),
    tv_finance: gv('tv_finance'), tv_lease_pay: gv('tv_lease_pay'),
    ho_ownership: gs('ho_ownership'), ho_area_total: gv('ho_area_total'),
    ho_area_office: gv('ho_area_office'), ho_over50: gs('ho_over50'), ho_exclusive: gs('ho_exclusive'),
    ho_months_used: gv('ho_months_used'),
    ho_rent: gv('ho_rent'), ho_bond_int: gv('ho_bond_int'), ho_rates: gv('ho_rates'),
    ho_elec: gv('ho_elec'), ho_levies: gv('ho_levies'),
    ho_phone: gv('ho_phone'), ho_other_direct: gv('ho_other_direct'),
    cgt_loss_bf: gv('cgt_loss_bf'), ftc_bf: gv('ftc_bf'),  /* V8.75: carry-forward intakes */
    /* Batch 2: py_s18a_excess was read via gv() at calc time but never
       saved or restored — a pre-existing data-loss bug, fixed here. */
    py_s18a_excess: gv('py_s18a_excess'),
    cyr_fc_cgt: gv('cyr_fc_cgt'), cyr_fc_foreign: gv('cyr_fc_foreign'), cyr_fc_ftc: gv('cyr_fc_ftc'),  /* v8.8: planner forecast extras */
    travelMethod: APP.travelMethod,
    incomeItems: APP.incomeItems,
    deductionItems: APP.deductionItems,
    monthlyPlan: APP.monthlyPlan,
    lumpSums: APP.lumpSums,
    history: APP.history,
    dedChecks: APP.dedChecks,
    expectedCarriedBalances: APP.expectedCarriedBalances,
    carriedBalanceAnswers: APP.carriedBalanceAnswers,
    provisionalReviewNeeded: APP.provisionalReviewNeeded,
    dedUserOverride: APP.dedUserOverride,
    foreignIncomeYN: APP.foreignIncomeYN,
    foreignIncomeAttested: APP.foreignIncomeAttested,
    profileScenarios: APP.profileScenarios, // QR7.1
    appliedValues: APP.appliedValues,

    toolsWtItems: APP.toolsWtItems,
    cgtAssets: APP.cgtAssets,
    rentalProperties: APP.rentalProperties,
    donationItems: APP.donationItems,
    employerPaye: APP.employerPaye,
    noPayeConfirmed: APP.noPayeConfirmed,
    milestones: APP.milestones,
    facts: APP.facts,
    onboardingCompleted: APP.onboardingCompleted, // V8.5 Batch 2
    bucketStatus: APP.bucketStatus, // V8.5 Batch 2
    it3bItems: APP.it3bItems, // V8.5 Batch 3 B2
    tfiItems: APP.tfiItems, // QR9a
    tfiPriorContributions: APP.tfiPriorContributions, // QR9a
    dataSchema: DATA_SCHEMA_VERSION,
    travelAllowanceYN: APP.travelAllowanceYN, // V8.5 Batch 3 B2
    workFromHomeYN: APP.workFromHomeYN, // V8.5 Batch 3 B2
    hasMedicalAid: APP.hasMedicalAid, // FB3
    businessItems: APP.businessItems, // V8.5 Batch 4 B4
    pensionAnnuityItems: APP.pensionAnnuityItems, // V8.5 Batch 5 B7
    retirementLumpsums: APP.retirementLumpsums, // V8.5 Batch 5 B7
    twopotWithdrawals: APP.twopotWithdrawals, // V8.5 Batch 5 B7
    priorLumpsumTaxable: APP.priorLumpsumTaxable, // V8.5 Batch 5 B7
    otherReceipts: APP.otherReceipts, // V8.5 Batch 5 B9
    cryptoDisposals: APP.cryptoDisposals, // v8.16
    cryptoRevenue: APP.cryptoRevenue, // v8.16
    overrides: APP.overrides, // D2
    easyView: APP.easyView, // Q-NEW-2
    docs: APP.documents.map(d => ({id:d.id, name:d.name, size:d.size, type:d.type, category:d.category, date:d.date}))
  };
}

export function persistData() {
  if (!APP.user) return;
  if (!AUTH.unlocked || !AUTH.pinKey) return;  // V8.3: no key → no save
  const plaintext = JSON.stringify(_collectUserData());
  cloudBackupNoteSaved(plaintext);   // QR10a: no-op unless cloud backup is on (kill-switch off by default)
  const u = APP.user;
  /* Returns the queued write's promise (previously fire-and-forget) so a
     caller that needs the save to have actually landed before doing
     something else — e.g. _lockApp() nulling the key — can await it. Every
     existing caller ignores the return value, so this is behavior-
     preserving for them. */
  const p = _enqueueWrite(() => _writeEncryptedUserData(u, plaintext));
  entBumpClock();
  return p;
}

/* ── V8.3 §9 DATA EXPORT / IMPORT (M-4) ──
   Three exporters and one importer. All run client-side; no network calls.
   - exportDataAsJson(): full backup, lossless, restorable
   - exportTaxYearAsCsv(): tabular summary for SARS audit / accountant use
   - importDataFromJson(file): validates format version + structure,
     replaces APP state, persists encrypted via existing storage layer.
   Exported JSON is plaintext — surface this in the UI so users store it
   securely. Format and data-shape versions are stamped so a newer or older
   file is recognised and refused (DATA-1). */

export const EXPORT_FORMAT_VERSION = 1;  // increment if export schema changes incompatibly
/* Version of the saved data's SHAPE (persisted and exported as `dataSchema`;
   absent = 1). DATA-1 (owner, 2026-10-15; BACKLOG 78): data from an earlier
   version is not carried, so there are no upgrade steps — an import whose
   shape is older than this is refused ('older'), just as EXPORT_FORMAT_VERSION
   refuses a file from a NEWER app. Bump this when the shape changes, and
   decide then whether the old shape is upgraded or refused.
     2 — QR9a: TFSA certificates live in tfiItems, not it3bItems. */
export const DATA_SCHEMA_VERSION = 2;
export const APP_VERSION = '8.25';

/* The data block IS what persistData() writes (_collectUserData, QR10a.0), plus metadata. */
export function _buildExportPayload() {
  const u = APP.user;
  const users = getUsers();
  const userRec = users.find(x => x.username === u);
  return {
    _meta: {
      app: 'InspiredTax',
      appVersion: APP_VERSION,
      exportFormat: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      exportedFor: u,
      // Note: we do NOT export pinHash/pinSalt/dataSalt — the file is
      // plaintext and intended for restore on a fresh device where the
      // user will set a new PIN. Keeping the salt out also prevents an
      // attacker who steals the export from running a PIN dictionary.
      profile: userRec ? {
        username: userRec.username,
        fullName: getUserFullName(),
        dob: getUserPii().dob,
        email: getUserPii().email,
        created: userRec.created
      } : null
    },
    data: _collectUserData()
  };
}

/* Deliver a Blob to the user. Platform adapter (single source for ALL
   exports — JSON backup, CSV, ITR12 text, a closed year):
   - Browser: anchor-download path, unchanged behaviour.
   - Capacitor/Android: a stock WebView silently ignores programmatic
     a[download] clicks, so write to the app cache via the Filesystem plugin
     and hand the file to the Android share sheet (save to Files/Drive,
     email, …). Plugin objects are injected by the native bridge at runtime —
     no web-side import exists.
   BACKLOG 72: returns a promise of what actually happened, so no caller can
   claim a saved file before there is one — resolves 'shared' (a share
   target was chosen), 'cancelled' (Android reported the share as cancelled:
   the sheet was dismissed, OR a dialog-style target such as Save to Drive or
   Files saved the file — see _askIfSaved) or 'downloaded' (browser; the
   click is all a page can know), and rejects when the write or the share
   fails. Callers word the
   outcome; this adapter shows nothing itself. */
/* Every filename passed to _downloadBlob starts with one of these, so a
   profile wipe can find the copies left in the app cache (_purgeLocalProfile,
   BACKLOG 71). tests/smoke.js assertProfilePurge checks every call site. */
export const EXPORT_FILE_RE = /^(inspiredtax-|ITR12_)/;
export function _downloadBlob(blob, filename) {
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split(',')[1];
        const FS = cap.Plugins.Filesystem;
        FS.writeFile({ path: filename, data: base64, directory: 'CACHE' })
          .then(() => FS.getUri({ path: filename, directory: 'CACHE' }))
          .then(({ uri }) => cap.Plugins.Share.share({ title: filename, url: uri }))
          .then(() => resolve('shared'), e => {
            /* @capacitor/share rejects "Share canceled" on RESULT_CANCELED
               before the activity stopped (SharePlugin.activityResult): a
               dismissed sheet, but also a successful save through a
               dialog-style target. Not a failure; callers that record the
               outcome ask the user (_askIfSaved). */
            if (e && /cancel/i.test(String(e.message || e))) { resolve('cancelled'); return; }
            reject(e);
          });
      };
      reader.onerror = () => reject(reader.error || new Error('export: file could not be read'));
      reader.readAsDataURL(blob);
    });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the click has time to fire
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return Promise.resolve('downloaded');
}

/* Filename helper: yyyy-mm-dd. Avoids locale issues. */
export function _todayStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

/* RFC 4180 — escape a CSV field. Wraps in quotes if it contains comma,
   quote, newline, or carriage return; doubles internal quotes. */
export function _csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function _csvRow(fields) { return fields.map(_csvEscape).join(',') + '\r\n'; }

/* JSON export — full backup. */
/* Interview decision (2026-07-02): backups are PIN-encrypted by default —
   under Capacitor exports travel through the Android share sheet, so a
   plaintext file lands in Drive/Gmail/Downloads with full tax PII. The
   encrypted envelope reuses the vault's own AES-GCM key (AUTH.pinKey) and
   embeds the account's KDF salt so a fresh install can re-derive it from
   the PIN. Documented caveat: a short numeric PIN is brute-forceable
   offline — the PIN-setup copy nudges 8 digits. Plaintext stays available
   behind an explicit choice (eFiling/accountant interop). */
export function exportDataAsJson() {
  if (!APP.user) { showToast('Sign in first to export your data.', 'error', 'error'); return; }
  /* Monetization M5 (01-SPEC): encrypted export is the primary one-tap
     flow; plaintext moved behind a dedicated exception dialog with an
     explicit PII warning + risk acknowledgement (no more neutral
     either/or). Import/restore is unchanged. */
  _exportBackup(true);
}
/* Secondary path — profile modal "Export unencrypted…" link. */
export function openPlaintextExportDialog() {
  if (!APP.user) { showToast('Sign in first to export your data.', 'error', 'error'); return; }
  const cb = $('pt-export-ack');
  if (cb) cb.checked = false;
  const btn = $('pt-export-confirm');
  if (btn) btn.disabled = true;
  openModal('modal-plaintext-export');
}
export function onPlaintextAckChange() {
  const cb = $('pt-export-ack'), btn = $('pt-export-confirm');
  if (btn) btn.disabled = !(cb && cb.checked);
}
export function confirmPlaintextExport() {
  const cb = $('pt-export-ack');
  if (!cb || !cb.checked) return;
  closeModal('modal-plaintext-export');
  _exportBackup(false);
}
/* Shared by the manual "Export JSON" (encrypted) path and the automatic
   local backup snapshot (writeLocalBackupSnapshot, below) — one envelope
   format, one place that builds it, so the two can never drift apart. */
function _buildEncryptedBackupEnvelope() {
  return _sealBackupEnvelope().then(sealed => sealed.envelope);
}
/* The one place an encrypted backup envelope is built (manual export, local
   snapshot, cloud backup). Also returns a fingerprint — SHA-256 of the saved
   data block, never the export's _meta (exportedAt changes on every call) —
   which the cloud scheduler compares to skip a backup when nothing changed.

   QR10a: everything that dies with the session — the vault key, the salt and
   the user name — is captured SYNCHRONOUSLY, before the first await. The
   callers that matter most run this and then clear those very values
   (_lockApp nulls AUTH.pinKey; doLogout runs _resetAuth() and APP.user =
   null), and the old body read AUTH.dataSalt and APP.user AFTER its await. */
export function _sealBackupEnvelope() {
  const key = AUTH.pinKey, salt = AUTH.dataSalt, user = APP.user;
  const payload = _buildExportPayload();
  const dataJson = JSON.stringify(payload.data);
  const builtAt = Date.now();
  return (async () => {
    const [enc, fingerprint] = await Promise.all([
      aesEncrypt(key, JSON.stringify(payload)),
      _fingerprintOf(dataJson)
    ]);
    return {
      envelope: {
        _meta: {
          app: 'InspiredTax', exportFormat: EXPORT_FORMAT_VERSION,
          encrypted: true, kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS,
          salt: bufToB64(salt), user
        },
        enc: { iv: enc.iv, data: enc.ciphertext }
      },
      fingerprint,
      builtAt
    };
  })();
}
/* Same digest as _sealBackupEnvelope's fingerprint, for the string
   persistData() has just serialised (JSON.stringify(_collectUserData()) is
   exactly JSON.stringify(payload.data)). */
export async function _fingerprintOf(dataJson) {
  const digest = await crypto.subtle.digest('SHA-256', strToBuf(dataJson));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
/* BAK-6/OD-41 (§L.9): the one write site for "the user just made a backup" —
   called from both export paths below so Row 1 of the status card can never
   fall out of step with what actually happened. */
function _recordManualExport() {
  if (!APP.user) return;
  try { localStorage.setItem(SK.lastExport(APP.user), String(Date.now())); } catch (e) { /* quota — non-fatal, Row 1 just stays stale */ }
}
/* D20 (owner G2, 8.36.0, 2026-10-15 — every backup read "Backup not saved";
   owner chose "Ask the user", docs/DECISIONS.md EXP-1). @capacitor/share
   8.0.1 resolves only when the chooser's result is OK or the app's activity
   stopped; Save to Drive and Files open as dialogs over the app, so the
   activity never stops and they return RESULT_CANCELED after a SUCCESSFUL
   save (node_modules/@capacitor/share/android/.../SharePlugin.java,
   activityResult). 'cancelled' therefore means "Android cannot say", and
   the person who chose the target can. Resolves true only on Yes; No, the
   back button and every other close resolve false — an unanswered question
   records nothing. Copy C-81/C-82. */
function _askIfSaved(what) {
  return new Promise(resolve => showConfirm(
    `Is your ${what} saved?`,
    `Android does not always report where a file goes. Tap Yes if your ${what} is now in Drive, Files or another place you chose.`,
    () => resolve(true),
    { tier: 'export', okLabel: 'Yes, it’s saved', cancelLabel: 'No', onCancel: () => resolve(false) }));
}
export async function _exportBackup(encrypted) {
  try {
    const filename = `inspiredtax-backup-${APP.user}-${_todayStamp()}.json`;
    const body = encrypted ? await _buildEncryptedBackupEnvelope() : _buildExportPayload();
    /* BACKLOG 72: the result and "Last manual export" wait for the file to
       actually reach a share target; when Android cannot say, the user
       does (_askIfSaved). */
    const outcome = await _downloadBlob(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }), filename);
    if (outcome === 'cancelled' && !(await _askIfSaved('backup'))) {
      _showBackupResult('amber', 'info', 'Backup not saved', 'You closed the share screen, so no copy was saved. Export again and choose where to keep it.');
      return;
    }
    _recordManualExport();
    if (encrypted) _showBackupResult('success', 'lock', 'Encrypted backup exported', 'Your PIN unlocks it.');
    else _showBackupResult('amber', 'no_encryption', 'Backup downloaded', 'Store securely — this file is NOT encrypted.');
  } catch (e) {
    console.error('exportBackup:', e);
    _showBackupResult('error', 'error', 'Could not create backup', 'Please try again.');
  }
}

/* Local Android Auto Backup snapshot (owner decision 2026-07-11: Option A —
   OS-level Auto Backup for Apps, not a custom Google Drive API integration).
   Writes the SAME encrypted envelope as a manual "Export JSON" backup to the
   app's private files directory (Capacitor Directory.Data == Android's
   context.filesDir), the one directory this app's backup allowlist includes
   (android:allowBackup="true" + android/app/src/main/res/xml/
   data_extraction_rules.xml + backup_rules.xml — both scoped to ONLY this
   snapshot path, not the WebView's own storage). Android's OS-level Backup
   Manager — not this app — performs the actual upload to whichever Google
   account is signed into the device, opportunistically, only when the
   device is idle/charging/on Wi-Fi (daily-ish, best-effort, no in-app
   confirmation that the cloud upload itself succeeded — see the About
   modal's Privacy & Data disclosure). This function only ever writes a
   local file; it makes no network call of its own. Native-platform only
   (no-op in a browser/test context); fire-and-forget — a failure here must
   never interrupt the normal save path or surface a toast. */
const LOCAL_BACKUP_PATH = 'autobackup/inspiredtax-snapshot.json';
export function writeLocalBackupSnapshot() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;
  if (!APP.user || !AUTH.unlocked || !AUTH.pinKey) return;
  /* BACKLOG 71: encoding 'utf8' — without it @capacitor/filesystem treats
     `data` as base64 and rejects the JSON string, so no snapshot was ever
     written (definitions.d.ts, WriteFileOptions.encoding). */
  _buildEncryptedBackupEnvelope()
    .then(envelope => cap.Plugins.Filesystem.writeFile({
      path: LOCAL_BACKUP_PATH, data: JSON.stringify(envelope), directory: 'DATA', encoding: 'utf8', recursive: true
    }))
    .catch(e => console.error('writeLocalBackupSnapshot:', e));
}
/* Async — reads the snapshot file's own last-modified time rather than
   maintaining a second, separately-persisted timestamp that could drift
   from what's actually on disk. Returns null if none exists yet or off
   native platform. */
export async function getLastLocalBackupAt() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
  try {
    const stat = await cap.Plugins.Filesystem.stat({ path: LOCAL_BACKUP_PATH, directory: 'DATA' });
    return stat && stat.mtime ? new Date(stat.mtime) : null;
  } catch (e) {
    return null; // file doesn't exist yet — not an error
  }
}

/* BACKLOG 71 (WR-8): THE list of what a profile leaves on this device, and
   the one wipe Delete Account and Remove profile share — they used to keep
   two hand copies, and both missed the last-export stamp and every file.
   localStorage: registry entry, encrypted data, cloud-backup record,
   last-export stamp, and the session pointer when it names this profile —
   all removed synchronously, before the first await, so a caller that clears
   APP.user straight after the call cannot have a pending save re-create them.
   Android files: the Auto Backup snapshot, only when it is this profile's
   (one path serves every profile; its plain `_meta.user` says whose — an
   unreadable file belongs to no one and goes too), and the export copies the
   share sheet left in the app cache (EXPORT_FILE_RE). Those cache files are
   copies of files already handed elsewhere, and the closed-year one carries
   no profile name, so every export copy goes, whichever profile made it.
   Device scope (iss_device: entitlement and trial; the theme) is not the
   profile's and stays. Resolves when the files are gone; never rejects. */
export async function _purgeLocalProfile(username) {
  saveUsers(getUsers().filter(x => x.username !== username));
  [SK.data(username), SK.cloudBackup(username), SK.lastExport(username)].forEach(k => {
    try { localStorage.removeItem(k); } catch (e) { /* non-fatal */ }
  });
  try { if (localStorage.getItem(SK.SESSION) === username) localStorage.removeItem(SK.SESSION); } catch (e) { /* non-fatal */ }
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;
  const FS = cap.Plugins.Filesystem;
  let snapshotOwner;
  try {
    const f = await FS.readFile({ path: LOCAL_BACKUP_PATH, directory: 'DATA', encoding: 'utf8' });
    try { snapshotOwner = (JSON.parse(f.data)._meta || {}).user || null; } catch (e) { snapshotOwner = null; }
  } catch (e) { snapshotOwner = undefined; }   // no snapshot on this device
  if (snapshotOwner === username || snapshotOwner === null) {
    try { await FS.deleteFile({ path: LOCAL_BACKUP_PATH, directory: 'DATA' }); }
    catch (e) { console.warn('purge snapshot:', e && e.message); }
  }
  try {
    const listing = await FS.readdir({ path: '', directory: 'CACHE' });
    for (const entry of (listing && listing.files) || []) {
      const name = typeof entry === 'string' ? entry : entry && entry.name;
      if (!name || (entry.type && entry.type !== 'file') || !EXPORT_FILE_RE.test(name)) continue;
      try { await FS.deleteFile({ path: name, directory: 'CACHE' }); }
      catch (e) { console.warn('purge export copy:', e && e.message); }
    }
  } catch (e) { console.warn('purge export copies:', e && e.message); }
}

/* CSV export — tax year summary suitable for SARS audit / accountant.
   Three sections in one file: Income, Deductions, Calculation. */
export async function exportTaxYearAsCsv() {
  if (!entUnlocked('export.csv')) return entOnLockedTap('export.csv');  // monetization M2 (00-DESIGN §4)
  if (!APP.user) { showToast('Sign in first to export.', 'error', 'error'); return; }
  try {
    const r = calcFullTax();
    const ty = r.ty || getActiveTaxYear();
    let csv = '';
    // Header block
    csv += _csvRow(['InspiredTax — Tax Year Summary']);
    csv += _csvRow(['User', APP.user]);
    csv += _csvRow(['Tax Year', ty.label || gs('taxYear') || '']);
    csv += _csvRow(['Generated', new Date().toISOString()]);
    csv += '\r\n';
    // Income section
    csv += _csvRow(['INCOME ITEMS']);
    csv += _csvRow(['Code', 'Document', 'Description', 'Detail', 'Amount (R)']);
    (APP.incomeItems || []).forEach(i => {
      csv += _csvRow([i.code, i.doc || 'IRP5', i.name || '', i.desc || '', i.amount || 0]);
    });
    csv += '\r\n';
    // Deductions section
    csv += _csvRow(['DEDUCTION ITEMS']);
    csv += _csvRow(['Code', 'Description', 'Detail', 'Amount (R)']);
    (APP.deductionItems || []).forEach(i => {
      csv += _csvRow([i.code, i.name || '', i.desc || '', i.amount || 0]);
    });
    csv += '\r\n';
    // Donations
    csv += _csvRow(['DONATIONS (s18A)']);
    csv += _csvRow(['Beneficiary', 'Reference', 'Amount (R)']);
    (APP.donationItems || []).forEach(d => {
      csv += _csvRow([d.name || '', d.ref || '', d.amount || 0]);
    });
    csv += '\r\n';
    // Lump sums
    csv += _csvRow(['LUMP SUMS']);
    csv += _csvRow(['Type', 'Month', 'Description', 'Amount (R)']);
    (APP.lumpSums || []).forEach(l => {
      csv += _csvRow([l.type || '', l.month || '', l.description || '', l.amount || 0]);
    });
    csv += '\r\n';
    // Calculation summary
    csv += _csvRow(['TAX CALCULATION SUMMARY']);
    csv += _csvRow(['Item', 'Amount (R)']);
    csv += _csvRow(['Gross Income',                    Math.round(r.gross || 0)]);
    csv += _csvRow(['Adjusted Gross',                  Math.round(r.adjGross || 0)]);
    csv += _csvRow(['Retirement Contributions Total',  Math.round(r.retTotal || 0)]);
    csv += _csvRow(['Retirement Allowed (s11F)',       Math.round(r.retAllowed || 0)]);
    csv += _csvRow(['Retirement Excess Carried Forward', Math.round(r.retExcess || 0)]);
    csv += _csvRow(['Other Deductions',                Math.round(r.otherDed || 0)]);
    csv += _csvRow(['Donations Allowed (s18A)',        Math.round(r.donAllowed || 0)]);
    csv += _csvRow(['Taxable Before Donations',        Math.round(r.tbd || 0)]);
    csv += _csvRow(['Taxable Income',                  Math.round(r.taxableIncome || 0)]);
    csv += _csvRow(['Tax on Income (brackets)',        Math.round(r.taxOnIncome || 0)]);
    csv += _csvRow(['Less: Rebates',                   Math.round(r.rebates || 0)]);
    csv += _csvRow(['Less: Medical Credits (s6A+s6B)', Math.round((r.med && r.med.total) || 0)]);
    csv += _csvRow(['Tax After Rebates',               Math.round(r.taxAfterRebates || 0)]);
    csv += _csvRow(['Tax Payable',                     Math.round(r.taxPayable || 0)]);
    csv += _csvRow(['PAYE Deducted',                   Math.round(r.payeDeducted || 0)]);
    csv += _csvRow(['Refund (-) / Owed (+)',           Math.round(r.balance || 0)]);
    csv += _csvRow(['Effective Rate (%)',              ((r.effectiveRate || 0) * 100).toFixed(2)]);
    csv += _csvRow(['Marginal Rate (%)',               ((r.marginalRate || 0) * 100).toFixed(2)]);

    // BOM for Excel compatibility (so it opens with UTF-8 and accented characters render)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const yearLabel = (ty.label || gs('taxYear') || 'taxyear').replace(/\//g, '-');
    const outcome = await _downloadBlob(blob, `inspiredtax-summary-${APP.user}-${yearLabel}-${_todayStamp()}.csv`);
    if (outcome === 'cancelled' && !(await _askIfSaved('CSV summary'))) return;   // BACKLOG 72 / D20: not saved, so nothing to confirm
    _recordManualExport();
    _showBackupResult('emerald', 'table_view', 'CSV summary downloaded', 'Figures only — no personal details.');
  } catch (e) {
    console.error('exportTaxYearAsCsv:', e);
    _showBackupResult('error', 'error', 'Could not create CSV summary', 'Please try again.');
  }
}

/* Import handler — takes a File from an <input type="file">. Reads, parses,
   validates the schema version, confirms with the user, then replaces APP
   state and persists encrypted. */
/* Rejection copy — design handoff 05-data-safety.md §5: every reason names
   the fix, and every one ends by confirming the current figures are
   unchanged (nothing here has touched APP state yet at any of these
   points, so the promise is always true). */
function _importRejected(reason) {
  const COPY = {
    toolarge: 'That file is larger than 10 MB. Backups from this app are well under that — check you selected the right file. Your current figures are unchanged.',
    unreadable: 'The file could not be read. It may be corrupt or still downloading. Your current figures are unchanged.',
    notjson: 'That file is not a valid backup. Look for a .itx or .json file exported from InspiredTax. Your current figures are unchanged.',
    notours: 'That backup is from another app. Your current figures are unchanged.',
    newer: 'It is from a newer version of InspiredTax. Update the app from the Play Store, then import again. Your current figures are unchanged.',
    older: 'It is from an earlier version of InspiredTax that this version cannot read. Your current figures are unchanged.',   // BACKLOG 78, copy C-90
    missing: 'That backup is incomplete and cannot be restored safely. Your current figures are unchanged.',
    wrongpin: 'That PIN does not unlock this backup. It is the PIN that was set when the backup was taken, which may not be your current one. Your current figures are unchanged.',
  };
  _showBackupResult('error', 'error', 'Import not applied', COPY[reason] || 'Your current figures are unchanged.');
}

export function importDataFromJson(file) {
  if (!APP.user) { showToast('Sign in first.', 'error', 'error'); return; }
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {  // 10 MB sanity cap
    _importRejected('toolarge');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => _importRejected('unreadable');
  reader.onload = async () => {
    let payload;
    try {
      payload = JSON.parse(reader.result);
    } catch (e) {
      _importRejected('notjson');
      return;
    }
    _importFromParsed(payload);
  };
  reader.readAsText(file);
}

/* THE restore path (QX-DRV-2): a parsed backup — plaintext export or encrypted
   envelope — from a file the user picked OR from a cloud backup (QR10a).
   Decrypt (session key first, else the PIN that made it) → confirm →
   pre-import snapshot → replace → land on the Dashboard. There is no second
   importer. opts.source 'cloud' only changes the confirm wording. */
export async function _importFromParsed(payload, opts) {
  // Encrypted envelope: decrypt with the session key first (same account →
  // same salt → same key); on failure prompt for the PIN that made the
  // backup and re-derive with the embedded salt.
  if (payload && payload._meta && payload._meta.encrypted && payload.enc) {
    const meta = payload._meta;
    if (meta.app !== 'InspiredTax') {
      _importRejected('notours');
      return;
    }
    const decryptWith = async (key) => JSON.parse(await aesDecrypt(key, payload.enc.iv, payload.enc.data));
    try {
      payload = await decryptWith(AUTH.pinKey);
    } catch (e) {
      _promptBackupPin(async (pin) => {
        try {
          const key = await deriveKey(pin, new Uint8Array(b64ToBuf(meta.salt)), 'encrypt');
          const inner = await decryptWith(key);
          _importParsedPayload(inner, opts);
        } catch (e2) {
          _importRejected('wrongpin');
        }
      });
      return;
    }
  }
  _importParsedPayload(payload, opts);
}

export function _importParsedPayload(payload, opts) {
    // Schema validation
    if (!payload || typeof payload !== 'object' || !payload._meta || !payload.data) {
      _importRejected('missing');
      return;
    }
    const meta = payload._meta;
    if (meta.app !== 'InspiredTax') {
      _importRejected('notours');
      return;
    }
    if (typeof meta.exportFormat !== 'number' || meta.exportFormat > EXPORT_FORMAT_VERSION) {
      _importRejected('newer');
      return;
    }
    /* DATA-1: an older data shape is refused, not upgraded (BACKLOG 78). */
    if ((Number((payload.data || {}).dataSchema) || 1) < DATA_SCHEMA_VERSION) {
      _importRejected('older');
      return;
    }
    // Confirm overwrite — tiered (design handoff 05-data-safety.md §4). The
    // pre-import snapshot below is still written, but the app has no restore
    // path for it and the next lock overwrites it, so the consequence copy
    // promises nothing about it (QR1.5, RET-09) — it points to the one
    // recovery route the user controls: an export made first.
    const fromCloud = !!(opts && opts.source === 'cloud');
    showConfirm(
      fromCloud ? 'Restore cloud backup?' : 'Import Backup?',
      fromCloud
        ? `Restoring will replace ALL current data for ${APP.user} with the cloud backup.`
        : `Import will replace ALL current data for ${APP.user} with the backup.`,
      async () => {
        try {
          // Snapshot the CURRENT (pre-import) state to the local Auto Backup
          // path before it's overwritten, so the promise below is true.
          try { writeLocalBackupSnapshot(); } catch (e) { console.error('import pre-snapshot:', e); }
          // Stash payload as the next decrypted snapshot, then re-restore.
          AUTH._decryptedSnapshot = payload.data;
          restoreData(APP.user);
          // Persist (encrypted) and refresh UI
          persistData();
          if (typeof updateCalc === 'function') updateCalc();
          if (typeof renderIncomeItems === 'function') renderIncomeItems();
          if (typeof renderDeductionItems === 'function') renderDeductionItems();
          if (typeof renderHistory === 'function') renderHistory();
          /* QR1.4/QD-04: an import replaces every figure, so land on the
             Dashboard underneath the Backup modal, whose result panel stays
             up to confirm it. */
          navigateTo('dashboard', '');
          _showBackupResult('success', 'check_circle', fromCloud ? 'Cloud backup restored' : 'Backup imported', 'Your data has been replaced with the backup.');
        } catch (e) {
          console.error('importDataFromJson:', e);
          _showBackupResult('error', 'error', 'Import failed', 'Your previous data is unchanged.');
        }
      },
      { tier: 'importc', okLabel: 'Replace my data', cancelLabel: 'Cancel',
        consequence: fromCloud
          ? 'The restore replaces your current figures. To keep them, export a backup first.'
          : 'The import replaces your current figures. To keep them, export a backup first.' }
    );
}

/* One-off PIN prompt for restoring an encrypted backup made under a
   different account/PIN.

   A11Y-1 (§L.4 item 0b-5): this used to build its own node and toggle
   style.display, bypassing the modal lifecycle CLAUDE.md hard rule 11 makes
   mandatory — so the one screen in the app that asks for a PIN had no focus
   trap, no Escape, and no aria-modal. The markup now lives in body.html and
   this goes through openModal()/closeModal() like every other dialogue,
   which also gives it the initial-focus behaviour (openModal focuses the
   first form field) that the old setTimeout(…focus) was hand-rolling.

   The callback is held in a module-scoped slot rather than re-bound onto the
   buttons on every open: the buttons are declared once in markup with their
   handlers, so there is nothing to re-wire and no way to stack duplicate
   listeners across repeated opens (the old code reassigned .onclick each
   time, which happened to be safe only because it overwrote). */
let _backupPinCb = null;
export function _promptBackupPin(cb) {
  _backupPinCb = cb;
  const inp = $('backup-pin-input');
  if (inp) inp.value = '';
  openModal('modal-backup-pin');
}
export function submitBackupPin() {
  const inp = $('backup-pin-input');
  const pin = inp ? inp.value : '';
  const cb = _backupPinCb;
  _backupPinCb = null;
  if (inp) inp.value = '';          // never leave a PIN in the DOM
  closeModal('modal-backup-pin');
  if (pin && cb) cb(pin);
}
export function cancelBackupPin() {
  _backupPinCb = null;
  const inp = $('backup-pin-input');
  if (inp) inp.value = '';
  closeModal('modal-backup-pin');
}

/* Wrapper to drive import from the hidden file input */
export function _onImportFileChange(ev) {
  const f = ev.target.files && ev.target.files[0];
  importDataFromJson(f);
  ev.target.value = '';  // allow re-selecting the same file
}

/* V8.4 A: Reset all user-scoped DOM fields and in-memory state.
   Prevents data bleed between users (previous logged-in user / signup form). */
export function clearAllUserFields() {
  /* QR9b.6: which retirement-fund rows the previous user had opened is view
     state, not data — the next profile starts from its own amounts. */
  APP._retFundsOpen = null;
  /* SESS-4 (design-system-audit-2026-09 §J.1, §L.4 item 0b-1; owner decision
     0.1). This was a hand-maintained allowlist of field ids. It named 62 of
     the app's 160 <input>/<select> ids, so 89 user fields survived logout and
     44 of those are read by gv()/gs() — meaning one account's company-car
     kilometres, medical dependants, subsistence nights and foreign income
     could reach the NEXT account's calcFullTax(). A tax-correctness defect,
     not only a privacy one.

     The allowlist is gone rather than extended. An allowlist fails OPEN —
     every field added afterwards leaks silently, which is exactly how this
     one fell 98 fields behind; the code's own comment conceded the point.
     Clearing by selector fails CLOSED: a field added tomorrow is cleared by
     construction, because nothing has to remember it.

     Defaults come from the MARKUP, not from a second hand list. src/body.html
     already carries every one of them — med_main value="1", med_disability's
     first <option> "0", taxYear's selected="2027", p_prov_status value="auto"
     — so defaultValue / defaultChecked / the selected <option> reproduce the
     documented survive-list without restating it. That generalises the rule
     the onboarding radio-group reset below already follows ("reset to each
     group's DEFAULT, not to nothing selected") to every field type, and it
     fixes three fields the old list actively got WRONG: p_provisional,
     p_prov_status and p_has_medical_aid were blanked to '' when their
     documented defaults are 'no', 'auto' and 'no'.

     Every one of the 160 ids is user-scoped, so there is no keep-list here.
     Device-scope state (entitlement, theme) is not a form field and is never
     touched — see 14-entitlement.js's note on iss_device. */
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = el.defaultChecked; return; }
    if (el.type === 'file') { try { el.value = ''; } catch (e) { /* some engines forbid it */ } return; }
    el.value = _markupDefaultValue(el);
  });
  // In-memory app state
  APP.incomeItems = [];
  APP.deductionItems = [];
  APP.monthlyPlan = Array.from({length:12}, () => ({income:0,paye:0,retirement:0,otherDed:0,status:'estimated'}));
  APP.lumpSums = [];
  APP.history = [];
  APP.dedChecks = {};
  APP.expectedCarriedBalances = {};
  APP.carriedBalanceAnswers = {};
  APP.provisionalReviewNeeded = false;
  APP.dedUserOverride = {};
  APP.foreignIncomeYN = 'no';
  APP.foreignIncomeAttested = false; APP.profileScenarios = {};
  APP.appliedValues = {}; APP.pendingValues = {};
  APP.documents = [];
  APP.travelMethod = 'deemed';
 
  APP.toolsWtItems = [];
  APP.cgtAssets = [];
  APP.rentalProperties = [];
  APP.donationItems = [];
  APP.employerPaye = [];
  APP.noPayeConfirmed = false;
  APP.milestones = {};
  APP.onboardingCompleted = false;
  APP.bucketStatus = {};
  APP.it3bItems = []; // V8.5 Batch 3 B2
  APP.tfiItems = []; APP.tfiPriorContributions = 0; // QR9a
  { const tp = document.getElementById('tfi-prior'); if (tp) tp.value = ''; }   // QR9a: page field mirroring APP.tfiPriorContributions
  APP.travelAllowanceYN = 'no'; // V8.5 Batch 3 B2
  APP.workFromHomeYN = 'no'; // V8.5 Batch 3 B2
  APP.businessItems = []; // V8.5 Batch 4 B4
  APP.pensionAnnuityItems = []; // V8.5 Batch 5 B7
  APP.retirementLumpsums = []; // V8.5 Batch 5 B7
  APP.twopotWithdrawals = []; // V8.5 Batch 5 B7
  APP.priorLumpsumTaxable = 0; // cumulative carry-forward for the lump-sum nil-rate band
  APP.otherReceipts = [];
  APP.cryptoDisposals = []; APP.cryptoRevenue = []; // v8.16
  /* BACKLOG 71: the four saved fields this list had missed — every APP field
     _collectUserData() saves is reset here (tests/smoke.js assertResetClears
     checks the two lists against each other). Easy View's look is re-applied
     by hydrateFromData() on the next restore. */
  APP.facts = {};
  APP.overrides = {};
  APP.hasMedicalAid = 'no';
  APP.easyView = false;

  /* Onboarding-only radio groups and text fields have no Profile-section
     counterpart, so nothing above touches them — found during device QA:
     a second account created on the same device opened onboarding with the
     first account's yes/no answers still checked (PII/data bleed between
     accounts on a shared device). Unlike the profile checkboxes above,
     these must be reset explicitly. */
  /* Phase 1: clearing must reset to each group's DEFAULT, not to "nothing
     selected". Unchecking everything discarded the markup's `checked`
     attribute, so a second account opened onboarding with no option chosen
     in any of these groups — the save path then silently substituted its own
     fallback. Harmless while every default was "no"; wrong the moment a
     group's default is something else (G2's carried balances now default to
     "unsure"). defaultChecked reads the attribute, so the markup stays the
     single source of truth for what each default is. */
  ['ob-medical','ob-medical-member','ob-medical-disabled',
   'ob-ra','ob-donations','ob-travel-allowance','ob-work-from-home','ob-provisional',
   'ob-carry-loss','ob-carry-capital','ob-carry-retirement','ob-carry-donations','ob-carry-lumpsum','ob-carry-ftc',
   'ob-foreign-income','ob-subsistence','ob-tools','ob-subs','ob-tax-residency']
    .forEach(name => document.querySelectorAll('input[name="' + name + '"]')
      .forEach(r => { r.checked = r.defaultChecked; }));
  ['ob-sars-ref','ob-medical-scheme-name','ob-medical-members'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['ob-medical-scheme-block','ob-medical-member-details',
   'ob-provisional-notice','ob-provisional-confirm'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  assertNoUserFieldSurvives();
}

/* N1 (OWNER-DECISIONS-2026-09, Batch-1 deletion notes): "New Clear all
   fields button for single-field input modals (travel-allowance deduction
   and siblings)." Travel, Home Office and Subsistence are single-calculator
   deduction pages with no list a user could otherwise delete an item from —
   unlike Tools & Equipment or Donations, which already have a per-item
   trashcan via makeCrudModule. Same "reset to the MARKUP default, never to
   blank" rule as clearAllUserFields() above, scoped to one page's own field
   ids instead of the whole app. syncYn() re-paints every yn-tile radio
   group afterwards, since clearing the hidden <select> a tile group mirrors
   does not by itself un-highlight the tile. */
export function clearDeductionCalcFields(ids) {
  (ids || []).forEach(function(id) {
    const el = $(id); if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = el.defaultChecked; return; }
    el.value = _markupDefaultValue(el);
  });
  if (typeof syncYn === 'function') syncYn();
  if (typeof refreshDerived === 'function') refreshDerived();
  debounceSave();
  showToast('Fields cleared.', 'check_circle');
}

/* The one definition of "this field's default", shared by the clear above and
   the assertion below so the two can never disagree about what a cleared
   field should hold. The markup is the source of truth: defaultValue is the
   `value=` attribute (empty string when absent), and a <select>'s default is
   its `selected` <option>, or the first option the browser would show. */
function _markupDefaultValue(el) {
  if (el.tagName === 'SELECT') {
    const marked = el.querySelector('option[selected]');
    if (marked) return marked.value;
    return el.options && el.options.length ? el.options[0].value : '';
  }
  return el.defaultValue;
}

/* STD-SEC-1 (design-system-audit-2026-09, SESS-1 / SESS-4; owner decision
   0.4C). The previous guard checked THREE ids and returned [] while cr-dob
   and modal-fullname were actively leaking — a guard that has never been seen
   to fire is not a guard. Two things were wrong with it:

     1. PII_FIELD_DOM_MIRROR mapped ONE DOM id per PII_FIELDS entry, so a
        second mirror of the same field was structurally invisible. `dob` has
        three: modal-dob (Profile), cr-dob (Create Account) and the onboarding
        echo. The map now takes a LIST per field.
     2. It only ever asked about PII. SESS-4 is a tax-correctness defect —
        cc_bus_km, med_members and subsistence-days are not PII, and all three
        reached the next account's calcFullTax().

   So the contract is now the strong one: after clearAllUserFields(), NO
   input/select/textarea in the document may differ from its markup default.
   That needs no hand list to maintain and cannot fall behind the markup.
   PII is still reported separately, by name, because hard rule 8's registry
   is the authority on what counts as PII and a PII leak deserves the louder
   message. Both fail via console.error, which tests/smoke.js's
   zero-console-error gate turns into a failing build. */
const PII_FIELD_DOM_MIRROR = {
  dob:    ['modal-dob', 'cr-dob'],
  email:  ['modal-email', 'cr-email'],
  taxRef: ['p_taxref', 'ob-sars-ref'],
  fullName: ['modal-fullname', 'cr-fullname'],   // BACKLOG 71
};
/* Exported so tests/smoke.js can demonstrate it FIRING against a populated
   document before trusting it to report clean — owner decision 0.4C. The
   previous guard was never seen to fire and was returning [] through an
   active leak. */
export function assertNoUserFieldSurvives() {
  const pii = [];
  PII_FIELDS.forEach(f => {
    (PII_FIELD_DOM_MIRROR[f] || []).forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== '') pii.push(f + ' (#' + id + ')');
    });
  });
  const survivors = [];
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const label = el.id ? '#' + el.id : (el.name ? '[name=' + el.name + ']' : el.tagName.toLowerCase());
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== el.defaultChecked) survivors.push(label);
      return;
    }
    if (el.type === 'file') return;               // cannot be read back reliably
    if (el.value !== _markupDefaultValue(el)) survivors.push(label);
  });
  window.__piiFieldLeak = pii;
  window.__userFieldLeak = survivors;
  if (pii.length) {
    console.error('PII field(s) survived clearAllUserFields():', pii.join(', '),
      '— every DOM mirror of a PII_FIELDS entry must appear in PII_FIELD_DOM_MIRROR.');
  }
  if (survivors.length) {
    console.error('User field(s) survived clearAllUserFields():', survivors.join(', '),
      '— these still hold the previous account\'s values and 44 such fields reach calcFullTax().');
  }
}

/* ── TAX YEAR CLOSE-OUT (P-H1) ──
   Archives the currently-selected tax year's records + result into
   APP.history as a read-only snapshot, resets the active per-year
   dataset, and applies the balances that carry into next year. Carry-
   forward math is not reimplemented here — every figure is read straight
   from calcFullTax()'s own output or from APP fields its own render pass
   just computed. Citations (mirrors the former carry-forward summary,
   13-patches.js): assessed loss s20(1)(a); capital loss Eighth Schedule;
   non-deducted retirement contributions s11F(3) / 2nd Schedule para 5-6 /
   s10C; foreign tax credit para (iii) proviso to s6quat(1B)(a); donations
   excess s18A(1) proviso; ring-fenced loss s20A. */
export const CLOSEOUT_CARRY_FIELDS = ['py_loss', 'cgt_loss_bf', 'py_ret_excess', 'ftc_bf', 'py_s18a_excess'];

/* Scalar this-year amount fields that reset on close-out: every entry in
   clearAllUserFields()'s profileNum list EXCEPT the six carry-forward
   fields above (set to the new computed balance, not blanked) and
   identity/profile fields (taxref, ID, employer, medical scheme, home-
   office ownership, vehicle acquisition date) which describe the
   taxpayer/situation rather than a per-year amount. */
export const CLOSEOUT_RESET_FIELDS = ['p_prov_p1', 'p_prov_p2', 'p_prov_topup',
  'py_basic_amount', 'py_owed', 'py_unsubmitted', 'py_refund_prior', 'py_refund_current',
  'ded_pension', 'ded_provident', 'ded_ra', 'ded_subscrip',
  'med_deps', 'med_monthly', 'med_employer', 'med_oop', 'int_gross',
  'tv_vehicle_val', 'tv_odo_open', 'tv_odo_close', 'tv_bus_km', 'tv_allowance',
  'tv_fuel', 'tv_maint', 'tv_insure', 'tv_finance', 'tv_lease_pay',
  'ho_area_total', 'ho_area_office', 'ho_over50', 'ho_months_used', 'ho_rent', 'ho_bond_int',
  'ho_rates', 'ho_elec', 'ho_levies', 'ho_phone', 'ho_other_direct',
  'cyr_fc_cgt', 'cyr_fc_foreign', 'cyr_fc_ftc'];

/* Record arrays holding this year's entered items — archived into the
   snapshot, then cleared. APP.priorLumpsumTaxable (the lifetime
   cumulative lump-sum pool, 2nd Schedule para 2(1)(a)/(b)) is
   deliberately excluded: SARS taxes retirement lump sums cumulatively
   over a taxpayer's lifetime, so it never resets. APP.tfiPriorContributions
   (the s12T lifetime total) likewise never resets — close-out adds the
   closing year's contributions to it. */
export const CLOSEOUT_RECORD_ARRAYS = ['incomeItems', 'deductionItems', 'lumpSums', 'documents', 'toolsWtItems',
  'cgtAssets', 'rentalProperties', 'donationItems', 'employerPaye', 'it3bItems', 'businessItems',
  'pensionAnnuityItems', 'retirementLumpsums', 'twopotWithdrawals', 'otherReceipts',
  'cryptoDisposals', 'cryptoRevenue', 'tfiItems'];

export function nextTaxYearKey(yearKey) { return String(Number(yearKey) + 1); }

/* Prototype #3: has the user started capturing income/deduction data for
   the current tax year? Reuses CLOSEOUT_RECORD_ARRAYS — the same canonical
   list of "this year's records" the close-out flow already archives —
   rather than a second parallel list. Drives the Tax Year selector lock
   (updateTaxYearLockState, 13-patches.js): onTaxYearChange() doesn't reset
   or move any of this data into a new slate, it just re-tags all of it as
   belonging to whichever year is now selected, so switching years by
   accident once data exists silently misdates it. */
export function hasTaxYearData() {
  var hasRecords = CLOSEOUT_RECORD_ARRAYS.some(function(key) { return (APP[key] || []).length > 0; });
  var hasDed = Object.keys(APP.dedChecks || {}).some(function(k) { return !!APP.dedChecks[k]; });
  return hasRecords || hasDed;
}


/* Computes the balances that carry into next year, straight from the
   engine's own already-computed outputs. refreshDerived() first so
   APP.capitalLossCF reflects the current CGT records — it is set as a side
   effect of renderCgtResult() inside renderAll(), not persisted
   independently. */
export function computeCarryForwardForNextYear() {
  if (typeof refreshDerived === 'function') refreshDerived();
  const r = calcFullTax();
  const capLoss = (APP.cgtAssets && APP.cgtAssets.length) ? (APP.capitalLossCF || 0) : (gv('cgt_loss_bf') || 0);
  return {
    py_loss: Math.round(r.lossUnabsorbed || 0),
    cgt_loss_bf: Math.round(capLoss || 0),
    py_ret_excess: Math.round(r.s10cRemaining || 0),
    ftc_bf: Math.round(r.ftcCarryOut || 0),
    py_s18a_excess: Math.round(r.donExcess || 0),
  };
}

/* The close-out action: snapshot the current year into APP.history
   (read-only from then on), reset the active per-year dataset, and apply
   the (possibly owner-overridden) carry-forward balances as next year's
   opening figures. Returns false (no-op) if next year's tax tables don't
   exist yet — guarded in the UI, checked again here since this is the
   one place that mutates APP.history. */
export function closeOutTaxYear(carryOverrides) {
  const yearKey = gs('taxYear');
  const nextYearKey = nextTaxYearKey(yearKey);
  if (!TAX_YEARS[nextYearKey]) return false;
  if (typeof refreshDerived === 'function') refreshDerived();
  const r = calcFullTax();

  const records = {};
  CLOSEOUT_RECORD_ARRAYS.forEach(k => { records[k] = APP[k] || []; });
  const _tfiClose = tfiChargeForActiveYear();   // QR9a: before tfiItems is cleared
  APP.history = APP.history || [];
  APP.history.push({
    year: yearKey,
    closedAt: new Date().toISOString(),
    counts: {
      income: (APP.incomeItems || []).length,
      deductions: (APP.deductionItems || []).length,
      retirement: (APP.retirementLumpsums || []).length + (APP.pensionAnnuityItems || []).length,
    },
    results: {
      gross: r.gross, taxableIncome: r.taxableIncome, taxPayable: r.totalTaxYear,
      payeDeducted: r.payeDeducted, provisionalPaid: r.provisionalPaid, balance: r.balance,
    },
    records,
    carriedForward: carryOverrides,
  });

  CLOSEOUT_RECORD_ARRAYS.forEach(k => { APP[k] = []; });
  APP.tfiPriorContributions = _tfiClose.prior + _tfiClose.contributions;   // s12T lifetime total rolls forward
  CLOSEOUT_RESET_FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  CLOSEOUT_CARRY_FIELDS.forEach(id => sv(id, carryOverrides[id] != null ? carryOverrides[id] : 0));
  sv('taxYear', nextYearKey);

  /* companycar/foreignSubsistence are companion keys applyDeduction()
     commits alongside travel/subsistence (see its own comment) — zero
     their PENDING value first so that commit doesn't carry a stale
     pre-close-out figure into the new year via the companion key. */
  APP.pendingValues.companycar = 0;
  APP.pendingValues.foreignSubsistence = 0;
  ['retirement', 'medical', 'travel', 'homeoffice', 'subscrip', 'subsistence'].forEach(t => {
    APP.pendingValues[t] = 0;
    if (typeof applyDeduction === 'function') applyDeduction(t);
  });

  if (typeof refreshDerived === 'function') refreshDerived();
  persistData();
  return true;
}

export function restoreData(username) {
  // V8.4 A: Clear all user-scoped fields FIRST to prevent bleed from previous user.
  clearAllUserFields();
  // V8.3 §3: the data is AUTH._decryptedSnapshot, decrypted at unlock (or {}
  // for a new account). Nothing else is read: a plaintext blob in storage is
  // never loaded (DATA-1, BACKLOG 78 — the V8.2 path is gone).
  // §8 M-5: wrapped in try/catch — corrupted state must not crash the SPA.
  try {
  let d = AUTH._decryptedSnapshot || {};
  AUTH._decryptedSnapshot = null;  // consume once
  // §8 M-5: ensure d is a plain object even if storage returned null/array/string
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
  hydrateFromData(d);
  } catch (err) {
    // §8 M-5: if anything in restoration goes wrong, fall back to clean state
    // and surface the issue rather than leaving the SPA in a half-initialised state.
    console.error('restoreData failed:', err);
    if (typeof showToast === 'function') {
      showToast('Saved data could not be loaded. Starting with a clean state.', 'error', 'error');
    }
    // Reset critical arrays/objects to safe defaults
    APP.incomeItems = []; APP.deductionItems = []; APP.donationItems = [];
    APP.cgtAssets = []; APP.rentalProperties = []; APP.lumpSums = [];
    APP.history = []; APP.documents = []; APP.toolsWtItems = [];
    APP.dedChecks = {}; APP.expectedCarriedBalances = {}; APP.carriedBalanceAnswers = {}; APP.provisionalReviewNeeded = false; APP.dedUserOverride = {}; APP.foreignIncomeYN = 'no'; APP.foreignIncomeAttested = false; APP.profileScenarios = {}; APP.appliedValues = {}; APP.pendingValues = {};
    APP.monthlyPlan = Array.from({length:12}, () => ({income:0,paye:0,retirement:0,otherDed:0,status:'estimated'}));
    APP.travelMethod = 'deemed';
    APP.onboardingCompleted = false; // V8.5 Batch 2
    APP.bucketStatus = {}; // V8.5 Batch 2
    APP.it3bItems = []; // V8.5 Batch 3 B2
    APP.tfiItems = []; APP.tfiPriorContributions = 0; // QR9a
    APP.travelAllowanceYN = 'no';
    APP.workFromHomeYN = 'no';
    APP.businessItems = []; // V8.5 Batch 4 B4
    APP.pensionAnnuityItems = [];
    APP.retirementLumpsums = [];
    APP.twopotWithdrawals = [];
    APP.priorLumpsumTaxable = 0;
    APP.overrides = {}; // D2
    APP.otherReceipts = [];
    APP.easyView = false; // Q-NEW-2
    applyEasyView(false, { silent: true });
  }
  /* v8.22 FINAL: a freshly restored session has NO user edits by definition.
     Wipe all dirty baselines so nothing carried in memory or mis-seeded can light a banner. */
  APP.inputSnapshot = {};
  APP.pySig = undefined;
  if (typeof updatePendingIndicators === 'function') { try { updatePendingIndicators(); } catch(e){} }
}

/* Pure DOM + APP hydration from a persistData()-shaped object `d`.
   Extracted from restoreData (behaviour-preserving) so the verification bench
   (bench/) can load a persona blob through the EXACT same field map the app
   uses — one source of truth, no divergence. restoreData wraps this with the
   clear-fields / source-priority / error-fallback / dirty-state concerns;
   hydrateFromData only writes DOM fields and APP.* arrays. Callers must pass a
   plain object (restoreData guarantees this). */
export function hydrateFromData(d) {
  // String fields (V8.4 B: removed deprecated p_taxpayer_type, p_income_primary, p_residency,
  // p_vat, p_vatno, p_address, p_has_interest, p_has_crypto, p_has_cgt, p_has_rental, p_has_other)
  ['taxYear','p_provisional','p_prov_status','p_taxref','p_tax_residency',
   'p_has_medical_aid','p_medscheme',
   'ho_ownership','ho_exclusive','tv_date_acq','fs_qualifies'
  ].forEach(f => { if(d[f]!=null) sv(f, d[f]); });
  // Numeric fields (M-2 fix: no longer skip d[f]===0 — saved zeros are valid values
  // and must be restored.)
  ['p_prov_p1','p_prov_p2','p_prov_topup',
   'py_loss','py_ret_excess','py_basic_amount','py_owed','py_unsubmitted','py_refund_prior','py_refund_current',
   'ded_pension','ded_provident','ded_ra','ded_subscrip',
   'med_deps','med_monthly','med_employer','med_oop','int_gross',
   'tv_vehicle_val','tv_odo_open','tv_odo_close','tv_bus_km','tv_allowance',
   'tv_fuel','tv_maint','tv_insure','tv_finance','tv_lease_pay',
   'ho_area_total','ho_area_office','ho_over50','ho_months_used','ho_rent','ho_bond_int',
   'ho_rates','ho_elec','ho_levies','ho_phone','ho_other_direct',
   'cgt_loss_bf','ftc_bf','cyr_fc_cgt','cyr_fc_foreign','cyr_fc_ftc',
   'py_s18a_excess',
   'fs_days_outside','fs_days_total'
  ].forEach(f => { if(d[f]!=null) sv(f, d[f]); });
  // Selects with non-default values
  if(d.med_main!=null) sv('med_main', d.med_main);
  if(d.med_disability!=null) sv('med_disability', d.med_disability);
  if(d.med_self_premium!=null) sv('med_self_premium', d.med_self_premium);
  if(d.med_has_deps!=null) sv('med_has_deps', d.med_has_deps);
  // V8.4 B: Restore income type checkboxes from saved incomeTypes array
  if(Array.isArray(d.incomeTypes)) {
    new Set(d.incomeTypes).forEach(val => {
      // Only restore into profile section, not onboarding overlay
      const all = document.querySelectorAll('input[name="income-type"][value="' + val + '"]');
      for(var i=0; i<all.length; i++){
        if(!all[i].closest('#onboarding-overlay')){ all[i].checked = true; break; }
      }
    });
  }
  // V8.4 B: Restore provisional choice radio
  const provChoice = d.p_prov_status || 'auto';
  const provRadio = document.querySelector('input[name="p_provisional_choice"][value="' + provChoice + '"]');
  if(provRadio) provRadio.checked = true;
  // Arrays — §8 M-5: Array.isArray() guards against corrupted localStorage.
  const _arr = (v, fallback) => Array.isArray(v) ? v : fallback;
  const _obj = (v, fallback) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : fallback;
  APP.incomeItems = _arr(d.incomeItems, []);
  APP.deductionItems = _arr(d.deductionItems, []);
  APP.monthlyPlan = _arr(d.monthlyPlan, Array.from({length:12}, () => ({income:0,paye:0,retirement:0,otherDed:0,status:'estimated'})));
  APP.lumpSums = _arr(d.lumpSums, []);
  APP.history = _arr(d.history, []);
  APP.dedChecks = _obj(d.dedChecks, {});
  delete APP.dedChecks.incprot;   // BACKLOG 93 R-4: income protection removed (not deductible since 2015)
  /* B3 (01-SPEC.md §6.3, 02-IMPACT.md R2): "Other claims" is newly gated by
     dedChecks.additional. Its page used to be reachable from an ungated
     "Other 4000" tab button, so saved data can carry deductionItems with no
     corresponding flag — without this the entries would still feed
     additionalDed in the engine but the user could never see or edit them.
     One-way and idempotent: it only ever turns the gate ON, and only when
     there is something behind it. */
  if (!APP.dedChecks.additional && APP.deductionItems.length) APP.dedChecks.additional = true;
  APP.expectedCarriedBalances = _obj(d.expectedCarriedBalances, {});
  APP.carriedBalanceAnswers = _obj(d.carriedBalanceAnswers, {});
  APP.provisionalReviewNeeded = !!d.provisionalReviewNeeded;
  APP.dedUserOverride = _obj(d.dedUserOverride, {});
  APP.foreignIncomeYN = d.foreignIncomeYN || 'no';
  APP.foreignIncomeAttested = !!d.foreignIncomeAttested;
  APP.profileScenarios = _obj(d.profileScenarios, {});   // QR7.1: absent = every question unanswered (QD-24)
  APP.appliedValues = _obj(d.appliedValues, {});
  APP.pendingValues = { ...APP.appliedValues }; // V8.4 B3: pending starts in sync with applied
  APP.documents = _arr(d.docs, []);
  APP.travelMethod = d.travelMethod || 'deemed';

  /* BACKLOG 93 R-2 (QD-31, FARM-2): the Vehicle asset type is removed — a
     vehicle is claimed under Travel or the business — and a saved one is
     dropped on load and import (DATA-1). */
  APP.toolsWtItems = _arr(d.toolsWtItems, []).filter(t => !t || t.type !== 'vehicle');
  APP.cgtAssets = _arr(d.cgtAssets, []);
  APP.rentalProperties = _arr(d.rentalProperties, []);
  APP.donationItems = _arr(d.donationItems, []);
  APP.employerPaye = _arr(d.employerPaye, []);
  APP.noPayeConfirmed = d.noPayeConfirmed === true; // QA 2026-08 (B2-BUG-5)
  APP.milestones = _obj(d.milestones, {});
  APP.facts      = _obj(d.facts, {});
  APP.onboardingCompleted = d.onboardingCompleted === true; // V8.5 Batch 2
  APP.bucketStatus = _obj(d.bucketStatus, {}); // V8.5 Batch 2
  delete APP.bucketStatus.B8;   // BACKLOG 93 R-1: the trust bucket is removed
  APP.it3bItems = _arr(d.it3bItems, []); // V8.5 Batch 3 B2
  APP.tfiItems = _arr(d.tfiItems, []); // QR9a
  APP.tfiPriorContributions = Math.max(0, Number(d.tfiPriorContributions) || 0); // QR9a
  APP.travelAllowanceYN = d.travelAllowanceYN || 'no'; // V8.5 Batch 3 B2
  APP.taxResidency = d.p_tax_residency || 'full_year'; // C-1a: residency gate
  APP.hasMedicalAid = d.hasMedicalAid || 'no'; // FB3
  APP.hasMedical = APP.hasMedicalAid; // Batch M: single combined medical question drives both flags
  APP.workFromHomeYN = d.workFromHomeYN || 'no'; // V8.5 Batch 3 B2
  APP.businessItems = _arr(d.businessItems, []); // V8.5 Batch 4 B4
  APP.pensionAnnuityItems = _arr(d.pensionAnnuityItems, []); // V8.5 Batch 5 B7
  APP.retirementLumpsums = _arr(d.retirementLumpsums, []); // V8.5 Batch 5 B7
  APP.twopotWithdrawals = _arr(d.twopotWithdrawals, []); // V8.5 Batch 5 B7
  APP.priorLumpsumTaxable = d.priorLumpsumTaxable || 0;
  /* RR (v8.9.1): surface the cumulative pool in the prior-year input + calculator echo */
  sv('py_lumpsum_cum', APP.priorLumpsumTaxable); sv('prior-lumpsum-taxable', APP.priorLumpsumTaxable);
  /* FARM-2 (owner 2026-10-17): farming is not handled; a saved farming
     receipt is dropped here, on load and on import alike (DATA-1). */
  /* FARM-2 / DATA-1: a farming receipt is dropped (the app does not cover
     farming); a receipt saved under a removed crypto category (crypto has its
     own page since v8.16) keeps its amount, filed as Other. */
  APP.otherReceipts = _arr(d.otherReceipts, []).filter(r => !r || r.category !== 'farming')
    .map(r => (r && /^crypto_/.test(r.category || '')) ? Object.assign({}, r, { category: 'other' }) : r);
  APP.cryptoDisposals = _arr(d.cryptoDisposals, []); // v8.16
  APP.cryptoRevenue   = _arr(d.cryptoRevenue,   []); // v8.16
  APP.overrides = _obj(d.overrides, {}); // D2
  APP.easyView = d.easyView === true; // Q-NEW-2
  applyEasyView(APP.easyView, { silent: true }); // apply on hydrate; toast handled by startApp() once per session
}


/* v8.27: the V8.3 source-code-migration review subsystem
   (detectCodeMigrations / applySilentRemaps / startCodeReviewIfNeeded /
   finishCodeReview + #modal-code-review) was removed — its only entry point
   had been commented out since V8.4, making the whole chain dead code and
   shipping a dev/QA modal in the production shell. Its CODE_MIGRATION table
   went with DATA-1 (BACKLOG 78); the last tree that has it is 99ab64b. */

/* HTML escape utility — wraps user-controlled strings before innerHTML insertion */
export function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
}

/* ── V8.3 §3 AUTHENTICATION (PIN + AES-GCM encrypted at rest) ──
   Login flow:
     (a) User enters username → doLogin
     (b) If user has pinHash: show PIN entry → doVerifyPin → unlock → startApp
     (c) A record with no pinHash cannot come from any current build (doSetPin
         saves the record only with its PIN) — it is refused, never given a
         new PIN over its data (DATA-1, BACKLOG 78; the V8.2 plaintext
         migration it used to start is gone).
   Create account: PIN setup happens at end of form → doCreateAccount → setPin → unlock → startApp */

export let _pendingUser = null;       // user awaiting PIN entry
export let _pinSetupMode = null;      // 'create' | null

export function clearLoginError() { $('login-error').style.display='none'; }

export function doLogin() {
  const u = (gs('input-username')||'').trim().toLowerCase();
  const err = $('login-error');
  if (!u) { err.textContent='Enter your username'; err.style.display='block'; return; }
  const users = getUsers();
  const user = users.find(x => x.username === u);
  if (!user) { err.textContent='Username not found. Create an account below.'; err.style.display='block'; return; }
  err.style.display = 'none';

  _pendingUser = user;

  if (user.pinHash) {
    _showPinEntry();
  } else {
    /* BACKLOG 78 (copy C-89): no current build writes a record without a PIN. */
    err.textContent = 'This profile cannot be opened. Remove it and create a new one.';
    err.style.display = 'block';
    _pendingUser = null;
  }
}

export async function doCreateAccount() {
  const u = (gs('cr-username')||'').trim().toLowerCase();
  const nm = (gs('cr-fullname')||'').trim();
  const dob = gs('cr-dob');
  const em = (gs('cr-email')||'').trim();
  const err = $('create-error');
  const fail = m => { err.textContent=m; err.style.display='block'; };
  if (!u || u.length < 3)           { fail('Username must be at least 3 characters.'); return; }
  if (!/^[a-z0-9_]+$/.test(u))      { fail('Username: lowercase letters, numbers, underscores only.'); return; }
  if (!nm)                           { fail('Full name is required.'); return; }
  if (!dob)                          { fail('Date of birth is required.'); return; }
  /* B5 (census line 1): email is no longer required — the field is hidden and
     stores ''. Kept in the payload so the PII seal/export contract is unchanged. */
  const users = getUsers();
  if (users.find(x => x.username === u)) { fail('Username already taken.'); return; }

  // Stash partial user; PIN setup completes the registration.
  _pendingUser = { username:u, fullName:nm, dob, email:em,
                   created:new Date().toISOString(), lastLogin:new Date().toISOString() };
  _pinSetupMode = 'create';
  err.style.display = 'none';
  _showPinSetup();
}

export function showCreateForm(show) {
  $('card-create').style.display = show ? 'block' : 'none';
  // Pre-auth surface: startApp hasn't run yet, so wire the DOB echo here too
  // (initDateEchoes is idempotent).
  if (show) initDateEchoes();
  // Swap, don't stack: two visible primary cards made the first-run screen
  // ambiguous (Sign In stayed on screen above Create Account).
  const signin = $('card-signin');
  if (signin) signin.style.display = show ? 'none' : '';
  if (show) {
    const brand = document.querySelector('.login-brand'); if (brand) brand.classList.remove('signin-active');
    // V8.4 A: Wipe any previous-user data from the app before user begins signup.
    // Also clear signup form inputs so they start blank.
    clearAllUserFields();
    ['cr-username','cr-fullname','cr-dob','cr-email'].forEach(id => {
      const el = $(id); if(el) el.value = '';
    });
    const err = $('create-error'); if(err) err.style.display = 'none';
    $('cr-username').focus();
  } else {
    // Cancelling back out of Create Profile returns to whichever sign-in
    // variant is correct for this device — recompute rather than assume.
    applyFirstRunLogin();
  }
}

export async function doLogout() {
  // Persist any in-flight changes (encrypted) before dropping the key.
  // persistData() writes through an async queue; await it so sign-out does not
  // clear AUTH.pinKey before the encrypted write actually runs.
  try { if (AUTH.unlocked) await persistData(); } catch(e) { console.error('logout persist:', e); }
  /* QR10a.4: cloud backup at logout. The envelope is built here, synchronously,
     while the key and user still exist (_resetAuth and APP.user = null are next);
     the upload is awaited — bounded — before the reload below, which would
     otherwise kill it. deleteAccount() clears APP.user first, so it never backs
     up a profile it has just deleted. */
  let _exitBackup = null;
  try { if (AUTH.unlocked && APP.user) _exitBackup = cloudBackupOnLogout(); } catch(e) { console.error('logout cloud backup:', e); }
  _resetAuth();
  APP.user = null;
  _pendingUser = null;
  _pinSetupMode = null;
  localStorage.removeItem(SK.SESSION);
  // V8.4 A: Wipe DOM + in-memory state on logout. No data bleed to next user.
  clearAllUserFields();
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('input-username').value = '';
  $('login-error').style.display = 'none';
  hideLockScreen();
  hidePinScreens();
  $('card-signin').style.display = 'block';
  closeModal('modal-profile');
  renderSavedProfiles();
  /* SESS-4 (§L.4 item 0b-1), owner decision 0.1 option B — full reload on
     logout. clearAllUserFields() above is now selector-based and fails
     closed, but a fresh document is the only teardown that cannot fall
     behind the markup at all: no DOM value survives it by construction.
     The two are deliberately belt-and-braces, not redundant — the clear also
     runs on the sign-in and create-account paths (restoreData(),
     showCreateForm()), which must NOT reload.

     Safe here because nothing user-visible is deliberately kept in memory
     across a logout. SK.SESSION has just been removed, so _bootstrapAuth()
     returns false on the next boot and the app lands on the login screen
     with its saved-profile list — the same end state the lines above build
     by hand, which is why they are kept: they leave the UI correct in the
     moment before the document swaps, and if a host ever blocks reload the
     teardown is still complete. Device-scope state (the entitlement trial in
     iss_device, the theme) lives in localStorage and is untouched. */
  if (_exitBackup) { try { await _exitBackup; } catch(e) { /* bounded and never rejects; belt and braces */ } }
  location.reload();
}

/* ── PIN entry / setup UI handlers ── */
export function _showPinEntry() {
  $('card-signin').style.display = 'none';
  $('card-create').style.display = 'none';
  const brand = document.querySelector('.login-brand'); if (brand) brand.classList.remove('signin-active');
  hidePinScreens();
  const card = $('card-pin-entry');
  if (card) {
    card.style.display = 'block';
    /* BACKLOG 71: before unlock the name is sealed — greet by username, as the lock screen does. */
    const nm = (_pendingUser && _pendingUser.username) ? '@' + _pendingUser.username : '';
    const greet = $('pin-entry-greeting');
    if (greet) greet.textContent = nm ? ('Welcome back, ' + nm) : 'Enter your PIN';
    setTimeout(() => { const i = $('pin-entry-input'); if (i) { i.value=''; i.focus(); } }, 50);
  }
}

export function _showPinSetup() {
  $('card-signin').style.display = 'none';
  $('card-create').style.display = 'none';
  const brand = document.querySelector('.login-brand'); if (brand) brand.classList.remove('signin-active');
  hidePinScreens();
  const card = $('card-pin-setup');
  if (card) {
    card.style.display = 'block';
    const sub = $('pin-setup-subtitle');
    if (sub) {
      /* Owner brief: the new-account subtitle ('Choose a 4-8 digit PIN…') is
         gone — the field labels and the AES line below the CTA already say
         everything it said. */
      sub.textContent = '';
      sub.style.display = 'none';
    }
    setTimeout(() => { const i = $('pin-setup-input'); if (i) { i.value=''; i.focus(); } }, 50);
    const c = $('pin-setup-confirm'); if (c) c.value = '';
    const e = $('pin-setup-error'); if (e) e.style.display = 'none';
  }
}

export function hidePinScreens() {
  ['card-pin-entry','card-pin-setup','card-lock'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
}

export function _validatePin(p) {
  return new RegExp('^[0-9]{' + PIN_MIN_LENGTH + ',' + PIN_MAX_LENGTH + '}$').test(p);
}

export async function doSetPin() {
  const pin = (gs('pin-setup-input')||'').trim();
  const confirm = (gs('pin-setup-confirm')||'').trim();
  const err = $('pin-setup-error');
  const fail = m => { err.textContent = m; err.style.display = 'block'; };

  if (!_validatePin(pin))  { fail('PIN must be 4–8 digits.'); return; }
  if (pin !== confirm)     { fail('PIN entries do not match.'); return; }
  if (!_pendingUser)       { fail('Session error. Please reload the page.'); return; }

  err.style.display = 'none';
  // Disable inputs while computing (PBKDF2 takes ~100-300ms)
  const setupBtn = $('pin-setup-btn');
  if (setupBtn) { setupBtn.disabled = true; setupBtn.textContent = 'Setting up…'; }

  try {
    const verifySalt = randomBytes(16);
    const dataSalt = randomBytes(16);
    const verifyHash = await deriveKey(pin, verifySalt, 'verify');
    const dataKey = await deriveKey(pin, dataSalt, 'encrypt');

    const users = getUsers();
    let userRec, piiPlain;

    if (_pinSetupMode !== 'create') throw new Error('PIN setup outside account creation');
    {
      userRec = Object.assign({}, _pendingUser, {
        pinSalt: bufToB64(verifySalt),
        pinHash: verifyHash,
        dataSalt: bufToB64(dataSalt),
        pinVersion: 1
      });
      piiPlain = { dob: _pendingUser.dob, email: _pendingUser.email, fullName: _pendingUser.fullName || '' };
      await _sealUserPii(userRec, piiPlain, dataKey);
      users.push(userRec);
    }
    saveUsers(users);

    // Set up AUTH state and encrypt initial data.
    AUTH.pinKey = dataKey;
    AUTH.pinHash = verifyHash;
    AUTH.pinSalt = verifySalt;
    AUTH.dataSalt = dataSalt;
    AUTH.unlocked = true;
    AUTH.pinAttempts = 0;
    AUTH.pii = piiPlain;

    AUTH._decryptedSnapshot = {};  // a fresh user — no prior data

    localStorage.setItem(SK.SESSION, userRec.username);
    _bumpLockTimer();

    // Hide setup, proceed into app.
    hidePinScreens();
    resetAllFields();
    startApp(userRec);

    {
      /* V8.6 C1+C2: new accounts go through the Q&A overlay (which startApp triggers
         via checkAndShowOnboarding); on completion, obComplete lands the user on
         the Dashboard. Do NOT pre-open the Profile modal — it would obscure the
         onboarding flow. */
      // openProfileModal() removed in V8.6 (was: pre-V8.6 behaviour)
      /* No toast here: "Welcome! Let's set up your tax profile." painted
         under the onboarding overlay from V8.6 until 8.36.1 raised the
         toast above it (D16), and the overlay's subtitle already says it. */
    }
    _pendingUser = null;
    _pinSetupMode = null;
  } catch (e) {
    console.error('doSetPin:', e);
    fail('Could not set PIN. Please try again.');
  } finally {
    if (setupBtn) { setupBtn.disabled = false; setupBtn.textContent = 'Set PIN & Continue'; }
  }
}

export async function doVerifyPin() {
  const pin = (gs('pin-entry-input')||'').trim();
  const err = $('pin-entry-error');
  const fail = m => { err.textContent = m; err.style.display = 'block'; };

  if (!_validatePin(pin)) { fail('PIN must be 4–8 digits.'); return; }
  if (!_pendingUser)      { fail('Session error. Please reload the page.'); return; }

  if (AUTH.pinAttempts >= 5) {
    fail('Too many failed attempts. Please reload the app.');
    return;
  }

  err.style.display = 'none';
  const verifyBtn = $('pin-entry-btn');
  if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying…'; }

  try {
    const verifySalt = new Uint8Array(b64ToBuf(_pendingUser.pinSalt));
    const dataSalt = new Uint8Array(b64ToBuf(_pendingUser.dataSalt));
    const candidateHash = await deriveKey(pin, verifySalt, 'verify');

    if (candidateHash !== _pendingUser.pinHash) {
      AUTH.pinAttempts++;
      const remain = 5 - AUTH.pinAttempts;
      fail(remain > 0 ? `Incorrect PIN. ${remain} attempt${remain===1?'':'s'} remaining.` : 'Too many attempts. Returning to sign-in.');
      if (AUTH.pinAttempts >= 5) {
        // Symmetric with the lock screen: reset to a fresh sign-in instead of a
        // dead-end that requires a manual reload.
        setTimeout(doLogout, 1000);
      }
      const i = $('pin-entry-input'); if (i) { i.value=''; i.focus(); }
      return;
    }

    // Verified — derive data key
    const dataKey = await deriveKey(pin, dataSalt, 'encrypt');
    AUTH.pinKey = dataKey;
    AUTH.pinHash = _pendingUser.pinHash;
    AUTH.pinSalt = verifySalt;
    AUTH.dataSalt = dataSalt;
    AUTH.unlocked = true;
    AUTH.pinAttempts = 0;
    _bumpLockTimer();

    // Decrypt the at-rest blob and stash for restoreData consumption
    const wrapper = loadUserDataRaw(_pendingUser.username);
    if (wrapper && wrapper.v === STORAGE_VERSION) {
      try {
        AUTH._decryptedSnapshot = await _decryptUserData(wrapper);
      } catch (decErr) {
        console.error('decrypt:', decErr);
        fail('Data decryption failed. Your PIN may be correct but the data is corrupted.');
        AUTH.pinKey = null; AUTH.unlocked = false;
        return;
      }
    } else {
      AUTH._decryptedSnapshot = wrapper || {};  // empty for new accounts
    }

    // Update lastLogin; open sealed PII
    const users = getUsers();
    const u = users.find(x => x.username === _pendingUser.username);
    if (u) {
      u.lastLogin = new Date().toISOString();
      AUTH.pii = await _openUserPii(u);
      saveUsers(users);
    }

    localStorage.setItem(SK.SESSION, _pendingUser.username);

    hidePinScreens();
    resetAllFields();
    startApp(_pendingUser);
    _pendingUser = null;
  } catch (e) {
    console.error('doVerifyPin:', e);
    fail('Could not verify PIN. Please try again.');
  } finally {
    if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Unlock'; }
  }
}

/* Enter-key / hardware-keyboard path on the hidden #lock-pin-input (design
   handoff 04-lock-screen.md §1). The keypad itself auto-submits as soon as
   a candidate length validates (_lockTrySubmit, wired from onLockPinInput);
   this is only reached via an explicit Enter press, so a mismatch here is
   always treated as a real wrong attempt regardless of length. */
export async function doUnlockFromLockScreen() {
  _lockBuffer = (gs('lock-pin-input') || '').trim();
  if (!_validatePin(_lockBuffer)) {
    const err = $('lock-pin-error');
    if (err) { err.textContent = 'PIN must be 4–8 digits.'; err.style.display = 'block'; }
    return;
  }
  await _lockTrySubmit(true);
}

/* PIN-aware bootstrap: replaces V8.2 auto-login that called startApp directly */
export async function _bootstrapAuth() {
  const savedUser = localStorage.getItem(SK.SESSION);
  if (!savedUser) return false;
  const users = getUsers();
  const user = users.find(u => u.username === savedUser);
  if (!user) {
    localStorage.removeItem(SK.SESSION);
    return false;
  }
  _pendingUser = user;
  if (!user.pinHash) {
    /* BACKLOG 78: no current build writes a record without a PIN. */
    _pendingUser = null;
    localStorage.removeItem(SK.SESSION);
    return false;
  }
  _showPinEntry();
  return true;
}

/* ── RESET ALL FIELDS (for new signups / user switch) ── */
export function resetAllFields() {
  // Clear all text/number/date inputs in the app
  document.querySelectorAll('#app input[type="text"], #app input[type="number"], #app input[type="date"], #app input[type="email"], #app input[type="tel"], #app textarea').forEach(el => {
    if(el.id === 'modal-username') return;
    el.value = '';
  });
  // Reset all selects to first option
  document.querySelectorAll('#app select').forEach(el => {
    el.selectedIndex = 0;
  });
  // Uncheck all checkboxes
  document.querySelectorAll('#app input[type="checkbox"]').forEach(el => {
    el.checked = false;
  });
  // Reset range sliders to defaults
  const sliderDefaults = {'sl-income':6,'sl-inflation':5,'sl-medical':8,'sl-years':5,'sl-ra':10,'sl-ra-pct':15};
  Object.entries(sliderDefaults).forEach(([id,val]) => { const s=$(id); if(s) s.value=val; });
  // v8.17: reset home office calendar period to full year, >50% gate to yes
  sv('ho_months_used', 12);
  sv('ho_over50', 'yes');
  sv('ho_exclusive', 'yes'); // Phase 8: reset alongside ho_over50, same default
  // Reset provisional toggle
  const provToggle = $('p_provisional_toggle');
  if(provToggle) provToggle.checked = false;
  // Reset APP state arrays
  APP.incomeItems = [];
  APP.deductionItems = [];
  APP.documents = [];
  APP.monthlyPlan = Array.from({length:12}, () => ({income:0, paye:0, retirement:0, otherDed:0, status:'estimated'}));
  APP.lumpSums = [];
  APP.history = [];
  APP.dedChecks = {};
  APP.expectedCarriedBalances = {};
  APP.carriedBalanceAnswers = {};
  APP.provisionalReviewNeeded = false;
  APP.dedUserOverride = {};
  APP.foreignIncomeYN = 'no';
  APP.foreignIncomeAttested = false; APP.profileScenarios = {};
  APP.appliedValues = {}; APP.pendingValues = {};
 
  APP.toolsWtItems = [];
  APP.cgtAssets = [];
  APP.rentalProperties = [];
  APP.donationItems = [];
  APP.it3bItems = [];
  APP.tfiItems = []; APP.tfiPriorContributions = 0; // QR9a
  APP.businessItems = [];
  APP.pensionAnnuityItems = [];
  APP.retirementLumpsums = [];
  APP.twopotWithdrawals = [];
  APP.otherReceipts = [];
  APP.employerPaye = [];
  APP.milestones = {};
  APP.bucketStatus = {};
  APP.provForecast = null;
  /* V8.9 B3.4: clear auto-toggle reason state */
  APP.autoReason = {};
  APP.pyRetExcessHandled = false;
  APP.travelMethod = 'deemed';
  APP.charts = {};
}

/* First-run login layout. On a device with no account, the sign-in form has
   nothing it can match — every username fails — so Create Account is the
   primary CTA and sits at the top of the card, with Sign In demoted below
   the divider. One account is enough to revert the card to the standard
   Sign In-first layout.

   The reordering itself is CSS (.login-card.first-run in main.css) so the
   markup stays one source of truth for both states; this only flips the
   class, the two button variants, and the card's own copy. */
/* Owner brief 2026-09-14: the first-run heading copy ("Get Started") is
   deleted, not reworded — .login-card.first-run hides #signin-heading
   outright (main.css) so there is nothing to flash before this runs. Kept
   as an empty string, not removed from the table, so a future first-run
   heading has one place to add it back rather than two. LOG-13 removed the
   sub-heading entirely (both states carried one); the field is gone with it.

   `divider` differs by state on purpose, unlike heading: first-run reads
   "If you already have a profile" because #signin-divider now sits directly
   above the username field in that layout (.login-card.first-run's `order`
   ladder); "or" stays for the returning-user layout, where the same element
   sits between the Sign In button and the secondary Create New Profile path
   and "If you already have a profile" would not make sense there. */
const LOGIN_CARD_COPY = {
  firstRun:  { heading: '', divider: 'If you already have a profile' },
  returning: { heading: 'Sign In', divider: 'or' }
};
/* Step 1's tax-residency ⓘ routes to the bottom help sheet (data-tip-long)
   rather than the tap bubble, since the physical presence test needs more
   than the ~28-word bubble budget. The day counts are law-as-data
   (PHYSICAL_PRESENCE, 01-data.js, CLAUDE.md rule 5) — this interpolates
   them into the tip rather than hardcoding "91"/"915" in body.html copy. */
export function applyResidencyTip() {
  const el = $('ob-residency-tip');
  if (!el) return;
  const p = PHYSICAL_PRESENCE;
  el.setAttribute('data-tip',
    '<strong>Physical presence test</strong>' +
    'Even without ordinary residence, you still count as a South African tax resident for the year if you were physically present in South Africa for:' +
    '<ul>' +
    '<li>More than ' + p.currentYear + ' days in this tax year;</li>' +
    '<li>More than ' + p.eachPriorYear + ' days in each of the preceding ' + p.fiveYears + ' tax years; and</li>' +
    '<li>More than ' + p.aggregatePriorYears + ' days in total across those ' + p.fiveYears + ' years.</li>' +
    '</ul>' +
    'All three must be met.');
}

/* D4 (owner decision, 2026-09-14, PLAN.md §0). Re-points the markup
   `selected` <option> on both tax-year selects (#ob-tax-year, #taxYear) to
   defaultTaxYear(), not just their live .value — clearAllUserFields()'s
   generic reset reads the option[selected] ATTRIBUTE as the field's
   default (_markupDefaultValue), so leaving the old attribute in place
   would make a post-logout reset revert to the stale hardcoded year.
   Idempotent; safe to call every boot. Falls back to the highest-value
   option if the computed year has no matching <option> (a year the three
   hardcoded options don't reach yet — out of this batch's scope). */
export function applyDefaultTaxYear() {
  const wanted = defaultTaxYear();
  ['ob-tax-year', 'taxYear'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    const opts = Array.from(sel.options);
    let match = opts.find(o => o.value === wanted);
    if (!match) match = opts.reduce((a, b) => (parseInt(b.value, 10) > parseInt(a.value, 10) ? b : a), opts[0]);
    if (!match) return;
    opts.forEach(o => o.removeAttribute('selected'));
    match.setAttribute('selected', 'selected');
    sel.value = match.value;
  });
}

export function applyFirstRunLogin() {
  const card = $('card-signin');
  if (!card) return;
  const firstRun = getUsers().length === 0;
  const copy = firstRun ? LOGIN_CARD_COPY.firstRun : LOGIN_CARD_COPY.returning;
  card.classList.toggle('first-run', firstRun);
  /* §B (07-surfaces-and-motion.md): the hero (blooms, proof ring, headline,
     trust rows) is a first-run moment only — a returning user's sign-in
     screen keeps its plain, quiet layout. */
  const screen = $('login-screen');
  if (screen) screen.classList.toggle('login-first-run', firstRun);
  const heading = $('signin-heading'); if (heading) heading.textContent = copy.heading;
  const divider = $('signin-divider'); if (divider) divider.textContent = copy.divider;
  const create  = $('btn-create-account');
  const signin  = $('btn-signin');
  if (create) { create.classList.toggle('btn-primary', firstRun); create.classList.toggle('btn-ghost', !firstRun); }
  if (signin) { signin.classList.toggle('btn-ghost', firstRun);   signin.classList.toggle('btn-primary', !firstRun); }
  /* LOG-11: the mark+Kat left-aligned pairing is the RETURNING-user sign-in
     state only — an account already exists, so this is "sign-in", not the
     first-run "create" moment (which keeps its own centred hero treatment). */
  const brand = document.querySelector('.login-brand');
  if (brand) brand.classList.toggle('signin-active', !firstRun);
  // #login-lock-kat is otherwise only populated by _lockSetKat() (the lock
  // screen) — signin-active reuses the same element, so it needs its own
  // content the first time this state is entered.
  if (!firstRun) {
    const kat = $('login-lock-kat');
    if (kat && !kat.innerHTML) kat.innerHTML = typeof katHtml === 'function' ? katHtml('waving', 66) : '';
  }
}

export function renderSavedProfiles() {
  const users = getUsers();
  /* Same registry read decides both halves of the login screen — keep them
     on one pass rather than adding a second entry point. */
  applyFirstRunLogin();
  const sec = $('saved-profiles-section');
  const list = $('saved-profiles-list');
  if(!users.length) { sec.style.display='none'; return; }
  sec.style.display = 'block';
  /* \u00a77: the active profile (the one that would resume automatically) gets a
     cyan tint + "Active" pill; the rest read "Locked \u00b7 last opened {date}" \u2014
     each profile has its own PIN/key, so a saved profile is genuinely
     locked, not just "not selected". */
  const activeUser = localStorage.getItem(SK.SESSION);
  /* LOG-16: two-line card \u2014 name + "Locked" (only when not the active
     profile; the active one already carries its own pill) on line 1,
     "Last opened {date}" on line 2. BACKLOG 71: the name is sealed PII and
     this screen is before unlock, so a profile is shown as @username, with
     the username's initial on the avatar. */
  list.innerHTML = users.map(u => {
    const [bg,fg] = getAvatarColours(u.username);
    const last = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-ZA') : '\u2014';
    const safeName = esc('@' + u.username);
    const isActive = u.username === activeUser;
    return `<div class="saved-profile-item${isActive ? ' saved-profile-active' : ''}" onclick="quickLogin('${u.username}')">
      <div class="profile-avatar" style="background:${bg};color:${fg}">${esc(getInitials(u.username))}</div>
      <div class="saved-profile-info">
        <div class="saved-profile-line1">
          <span class="saved-profile-name">${safeName}</span>${isActive ? '' : '<span class="saved-profile-status">Locked</span>'}
        </div>
        <div class="saved-profile-meta">Last opened ${last}</div>
      </div>
      ${isActive ? '<span class="saved-profile-active-pill">Active</span>' : ''}
      <button class="saved-profile-remove" onclick="event.stopPropagation();confirmRemoveProfile('${u.username}')" title="Remove" aria-label="Remove profile"><i class="material-symbols-outlined msi-delete"></i></button>
    </div>`;
  }).join('');
}
export function quickLogin(u) { $('input-username').value=u; doLogin(); }
export function confirmRemoveProfile(u) {
  showConfirm('Remove Profile', `Remove @${u} from this device? All tax data will be deleted.`, async () => {
    // BACKLOG 71: the same wipe as Delete Account (_purgeLocalProfile).
    await _purgeLocalProfile(u);
    renderSavedProfiles();
    showToast('Profile removed');
  }, { tier: 'del', okLabel: `Remove @${u}`, cancelLabel: 'Cancel',
       /* QX-DRV-4: this screen cannot reach Google (the profile is locked), so it
          does not delete cloud copies — it says so instead of claiming there are none. */
       consequence: cloudBackupHasCopiesFor(u)
         ? 'This cannot be undone. Your cloud backups in Google Drive are NOT deleted — sign in and use Delete Account first if you want them removed. Export an encrypted backup first if you may need these figures again.'
         : 'This cannot be undone and there is no cloud copy. Export an encrypted backup first if you may need these figures again.' });
}

export function startApp(user) {
  APP.user = user.username;
  $('login-screen').style.display = 'none';
  $('app').style.display = 'block';

  // B3.1/D-6: the header Profile pill (and #header-avatar with it) is gone —
  // _renderDrawerIdentity() already populates the drawer's own avatar
  // independently, so nothing here needs to replace this write.

  // Restore saved data
  restoreData(user.username);

  // Seed profile modal from user account (PII from the decrypted AUTH cache)
  const _pii = getUserPii();
  sv('modal-username', user.username);
  sv('modal-fullname', getUserFullName());
  sv('modal-dob', _pii.dob||'');
  syncDobSelectFromHidden('modal');
  sv('modal-email', _pii.email||'');
  $('modal-session-username').textContent = '@' + user.username;

  // Initialise UI — each step wrapped to continue on error
  const steps = [
    ['populateSourceCodeSelects', populateSourceCodeSelects],
    ['entInit', entInit],
    ['cloudBackupSessionStart', cloudBackupSessionStart],
    ['renderAll', renderAll],
    ['onProvisionalChange', onProvisionalChange],
    ['onProvStatusChange', onProvStatusChange],
    ['onOwnershipChange', onOwnershipChange],
    ['setTravelMethod', () => setTravelMethod(APP.travelMethod)],
    ['initMonthlyPlannerMonth', initMonthlyPlannerMonth],
    ['renderActRefInline', renderActRefInline],
    ['initTheme', initTheme],
    ['updateDrawerDeductions', () => { if(typeof updateDrawerDeductions === 'function') updateDrawerDeductions(); }],
    ['updateDrawerIncomeCalcs', () => { if(typeof updateDrawerIncomeCalcs === 'function') updateDrawerIncomeCalcs(); }],
    ['updateIncomeTabs', () => { if(typeof updateIncomeTabs === 'function') updateIncomeTabs(); }],
    ['initBackNavigation', initBackNavigation],
    ['initSwipeNav', initSwipeNav],
    ['assertIncomeTypeProxyContract', assertIncomeTypeProxyContract],
    ['initSliderValueEdit', initSliderValueEdit],
    ['initDateEchoes', initDateEchoes],
    /* Monetization M2: apply lock state to drawer/tabs/FAB after the
       renderers above have built them, then the one-time welcome dialog. */
    ['entRefreshUi', entRefreshUi],
    ['entShowWelcomeIfNeeded', entShowWelcomeIfNeeded],
    /* Q-NEW-2: the disclaimer toast fires every session (every unlock/
       start, not just the first toggle-on) while Easy View is on — restoreData()
       above already applied the class silently via hydrateFromData(), so this
       step only re-runs the (idempotent) class toggle to get its toast. */
    ['easyViewSessionToast', () => applyEasyView(APP.easyView)],
  ];
  steps.forEach(([name, fn]) => {
    try { fn(); } catch(e) {
      console.error('startApp.' + name + ':', e);
      if(typeof _showError === 'function') _showError('startApp.' + name, e);
    }
  });

  // V8.6 A3.1: one-time rand-rounding migration (data is loaded and unlocked
  // by this point — replaces the former 500ms boot poll).

  // V8.5 Batch 2: Check if onboarding needs to run (first-time users)
  const shouldShowOnboarding = checkAndShowOnboarding();
  
  // Only navigate to dashboard if onboarding wasn't shown
  if (!shouldShowOnboarding) {
    navigateTo('dashboard', '');
  }
}

/* ── DRAWER NAVIGATION ── */
export let _drawerOpen = false;
let _drawerLockTicker = null;

/* §F: identity + tax year at the top of the drawer. */
function _renderDrawerIdentity() {
  const nameEl = $('drawer-identity-name'), yearEl = $('drawer-identity-year'), avEl = $('drawer-identity-avatar');
  if (!nameEl || !APP.user) return;
  const users = getUsers();
  const u = users.find(x => x.username === APP.user);
  /* QA 2026-09: this row is now the drawer's "Profile" line (repositioned
     into the main menu order, replacing the separate Profile item that
     used to sit under Settings) — "Profile" + the preferred name, not the
     old "<tax year> return · @username" line. */
  nameEl.textContent = 'Profile';
  if (yearEl) yearEl.textContent = getUserFullName() || ('@' + APP.user);
  if (avEl && u) {
    const [bg, fg] = getAvatarColours(u.username);
    avEl.textContent = getInitials(getUserFullName() || u.username);
    avEl.style.setProperty('--av-bg', bg);
    avEl.style.color = fg;
  }
}
/* §F: lock countdown, ticking once a second while the drawer is open —
   the 5-minute auto-lock used to be entirely invisible. */
function _renderDrawerLockCountdown() {
  const el = $('drawer-lock-countdown'); if (!el) return;
  if (!AUTH.unlocked || !AUTH.lockDeadlineAt) { el.textContent = 'Locks in 5:00'; return; }
  const remainMs = Math.max(0, AUTH.lockDeadlineAt - Date.now());
  const mins = Math.floor(remainMs / 60000);
  const secs = Math.floor((remainMs % 60000) / 1000);
  el.textContent = `Locks in ${mins}:${String(secs).padStart(2, '0')}`;
}
export function toggleDrawer() {
  _drawerOpen = !_drawerOpen;
  $('drawer-overlay').classList.toggle('open', _drawerOpen);
  if (_drawerOpen) {
    _renderDrawerIdentity();
    _renderDrawerLockCountdown();
    clearInterval(_drawerLockTicker);
    _drawerLockTicker = setInterval(_renderDrawerLockCountdown, 1000);
  } else {
    clearInterval(_drawerLockTicker);
  }
}
export function closeDrawer() {
  _drawerOpen = false;
  $('drawer-overlay').classList.remove('open');
  clearInterval(_drawerLockTicker);
}

/* ── ANDROID / BROWSER BACK NAVIGATION ──
   backAction() performs exactly one contextual "back" step and returns true
   if it consumed the press. It inspects existing state at its source
   (_modalFocusStack, _drawerOpen, APP.currentMode) rather than wrapping the
   functions that mutate it. Two drivers wire into it in initBackNavigation():
   the browser history sentinel (popstate) and, under Capacitor, the native
   App.backButton listener (the plugin object is injected by the native
   bridge — no web-side import exists or is needed). */
export function backAction() {
  // Pre-auth: never trap Back on the login/lock screen.
  const login = $('login-screen');
  if ((login && login.style.display !== 'none') || !AUTH.unlocked) return false;

  // Onboarding wizard: Back = previous step; allow exit only from step 1.
  const ob = $('onboarding-overlay');
  if (ob && ob.classList.contains('active')) {
    const s1 = $('ob-screen-1');
    if (s1 && !s1.classList.contains('active') && typeof window.obStepBack === 'function') {
      window.obStepBack();
      return true;
    }
    return false;
  }

  // Topmost focus-trapped modal (handles confirm-over-modal stacks: top first).
  if (_modalFocusStack.length) {
    closeModal(_modalFocusStack[_modalFocusStack.length - 1].id);
    return true;
  }

  // Style-toggled dynamic modals built at runtime by 13-patches — window.*
  // lookup because 02-core cannot import from 13 (module evaluation order).
  const reset = document.getElementById('reset-modal');
  if (reset && reset.style.display !== 'none' && typeof window.closeResetModal === 'function') {
    window.closeResetModal();
    return true;
  }
  if (_drawerOpen) { closeDrawer(); return true; }

  // Any non-home panel: Back goes to the dashboard. Deliberately called via
  // window.navigateTo so the legacy unapplied-edits guard that wraps it
  // (hookSelectionsLanding, 13-patches) still runs.
  if (APP.currentMode && APP.currentMode !== 'dashboard') {
    window.navigateTo('dashboard', '');
    return true;
  }

  return false; // dashboard, nothing open — let the platform exit/minimise
}

/* §5.8/H14: native date inputs render US order (mm/dd/yyyy) under an en-US
   WebView regardless of lang="en-ZA". A small formatted echo under each date
   field ("12 Apr 1975") removes the ambiguity without replacing the native
   picker. Wired once for the static shell (all three date fields are static). */
export function initDateEchoes() {
  document.querySelectorAll('input[type="date"]').forEach(inp => {
    if (inp.dataset.echoWired) return;
    inp.dataset.echoWired = '1';
    const echo = document.createElement('div');
    echo.className = 'date-echo';
    echo.setAttribute('aria-hidden', 'true');
    inp.after(echo);
    const render = () => {
      if (!inp.value) { echo.textContent = ''; return; }
      const d = new Date(inp.value + 'T00:00:00');
      echo.textContent = isNaN(d) ? '' :
        d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    inp.addEventListener('input', render);
    inp.addEventListener('change', render);
    render();
  });
}

let _backNavInited = false;
/* ── B1 Simplification: swipe navigation (01-SPEC.md §9.5, owner item 45) ──

   Horizontal swipe moves between the four primary destinations:
       Dashboard ⟷ Income ⟷ Deductions ⟷ Tax
   On any sub-page, swipe-right is "back" and goes exactly where the back bar
   goes (both read PAGE_HEADS, so a gesture can never disagree with the
   button); swipe-left does nothing there.

   The gesture is deliberately hard to trigger by accident: it needs 60px of
   horizontal travel AND more than twice as much horizontal as vertical, so
   an ordinary diagonal scroll never navigates. Anything that scrolls
   sideways itself — the tab bars, seg rails, wide tables — swallows the
   gesture, as do inputs, modals and the drawer. */
const SWIPE_RAIL = [
  { mode: 'dashboard',  tab: '' },
  { mode: 'income',     tab: 'main' },
  { mode: 'deductions', tab: 'selections' },
  { mode: 'summary',    tab: 'return' }
];
const SWIPE_IGNORE_SELECTOR = [
  '.tab-bar', '.seg-ctl', '.page-head-slot',
  '.modal-overlay', '.drawer', '.drawer-overlay',
  'input', 'select', 'textarea', 'button', 'a',
  '.stmt-row', '.table-wrap'
].join(',');

/* True when the gesture started somewhere that owns horizontal movement. */
function _swipeBlocked(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches && n.matches(SWIPE_IGNORE_SELECTOR)) return true;
    /* Any scroller wider than its box is doing its own horizontal work. */
    const ox = getComputedStyle(n).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

let _swipeNavInited = false;
export function initSwipeNav() {
  if (_swipeNavInited) return;
  _swipeNavInited = true;
  const body = document.querySelector('.app-body');
  if (!body) return;

  let x0 = 0, y0 = 0, tracking = false;

  body.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;
    if (_drawerOpen || _modalFocusStack.length) return;
    if (_swipeBlocked(e.target)) return;
    x0 = e.clientX; y0 = e.clientY; tracking = true;
  }, { passive: true });

  body.addEventListener('pointerup', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy) * 2) return;
    swipeNavigate(dx > 0 ? 1 : -1);
  }, { passive: true });

  body.addEventListener('pointercancel', () => { tracking = false; }, { passive: true });
}

/* dir: +1 = swipe right (towards Dashboard / back), -1 = swipe left. */
export function swipeNavigate(dir) {
  const mode = APP.currentMode || 'dashboard';
  const tab  = APP.currentTab || '';
  const railIdx = SWIPE_RAIL.findIndex(d => d.mode === mode && d.tab === tab);

  if (railIdx < 0) {
    /* A sub-page: right = back, to wherever this page's back bar points.
       Left does nothing — there is no "forward" from a capture page. */
    if (dir < 0) return;
    const cfg = PAGE_HEADS[(MODE_PREFIX_MAP[mode] || mode) + '-' + tab];
    if (cfg) { navigateTo(cfg.backMode, cfg.backTab || ''); pageSlide(dir); }
    return;
  }

  const next = SWIPE_RAIL[railIdx - dir];
  if (next) { navigateTo(next.mode, next.tab); pageSlide(dir); }
}

/* B7 (§9.2): the panel slides in the direction of travel. Applied to the
   panel that navigateTo just made active, and removed on animationend so
   the class never accumulates. Under reduced motion the CSS collapses the
   animation but the NAVIGATION STILL HAPPENS (§9.5) — only the slide is
   suppressed, never the swipe. */
export function pageSlide(dir) {
  const panel = document.querySelector('.mode-panel.active');
  if (!panel) return;
  const cls = dir > 0 ? 'page-slide-l' : 'page-slide-r';
  panel.classList.remove('page-slide-l', 'page-slide-r');
  void panel.offsetWidth;
  panel.classList.add(cls);
  panel.addEventListener('animationend', function h() {
    panel.classList.remove(cls); panel.removeEventListener('animationend', h);
  });
}

export function initBackNavigation() {
  if (_backNavInited) return;
  _backNavInited = true;
  // Public back entry point for any embedder (native shell, tests). The
  // gen:bridge surface only covers inline-handler names, so publish directly.
  window.backAction = backAction;
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    // Registering a backButton listener replaces Capacitor's default
    // behaviour (which would exit); minimizeApp keeps state alive.
    cap.Plugins.App.addListener('backButton', () => {
      if (!backAction()) cap.Plugins.App.minimizeApp();
    });
    return;
  }
  // Browser: keep one sentinel history entry armed. Each Back pops it →
  // perform one contextual step and re-arm; if nothing consumed the press,
  // step out for real.
  history.pushState({ sentinel: 1 }, '');
  window.addEventListener('popstate', () => {
    if (backAction()) history.pushState({ sentinel: 1 }, '');
    else history.back();
  });
}

/* QA 2026-09: Income, Deductions and Taxation are mutually exclusive — only
   one of the three shows its full body at a time. */
const EXCLUSIVE_DRAWER_GROUPS = ['grp-income', 'grp-deductions', 'grp-taxation'];
export function toggleDrawerGroup(id) {
  const el = $(id);
  if(!el) return;
  const isOpen = el.classList.toggle('open');
  // Toggle chevron on parent
  const parent = el.previousElementSibling;
  if(parent) parent.classList.toggle('expanded', isOpen);
  if (isOpen && EXCLUSIVE_DRAWER_GROUPS.includes(id)) {
    EXCLUSIVE_DRAWER_GROUPS.filter(g => g !== id).forEach(g => {
      const other = $(g);
      if (other && other.classList.contains('open')) {
        other.classList.remove('open');
        const otherParent = other.previousElementSibling;
        if (otherParent) otherParent.classList.remove('expanded');
      }
    });
  }
}
/* QA 2026-09: within Income's or Deductions' drawer body, "X captured" and
   "Other X" are mutually exclusive <details> — opening one closes the
   other. Bound via ontoggle= inline on markup that 04-deductions.js
   rebuilds from scratch on every call, so there is nothing stale to guard
   against here (unlike the addEventListener idiom the dashboard's own
   accordions use, which persist across re-renders). */
export function drawerSubAccToggle(el) {
  if (!el || !el.open) return;
  const parent = el.parentElement;
  if (!parent) return;
  parent.querySelectorAll('details.drawer-sub-acc').forEach(d => {
    if (d !== el) d.removeAttribute('open');
  });
}

/* B9.1 (EXT-TITLE-1): 'summary' renamed 'Summary' → 'Taxation' — adding
   back bars to all six Taxation tabs flips the app-bar title to
   SCREEN_TITLES[mode] on every one of them (navigateTo() below), so without
   this rename every Taxation sub-page would read "Summary". The unused
   'taxation' key is deleted with it — nothing ever navigates with that mode
   string; the real mode is 'summary' throughout. */
export const SCREEN_TITLES = {
  'dashboard':   'Dashboard',
  'income':      'Income',
  'deductions':  'Deductions',
  'summary':     'Taxation',
  'projection':  'Projection',
  'taxfaqs':     'Tax FAQs',
  'actref':      'Tax Act References',
  'subscribe':   'Go Premium'
};
/* B1 Simplification (P7): plain-language page names. The statutory suffixes
   ("— s11F", "— s18A") are gone from the chrome — a section number tells a
   non-specialist nothing about what a page is for, and the law is still
   cited where it belongs, in the page help and the calculation breakdown.
   Titles here must stay in step with PAGE_HEADS in 01-data.js, which names
   the same pages in the back bar. */
export const TAB_TITLES = {
  'main':        'Income',
  'provtax':     'Provisional Tax',
  'prioryear':   'Tax balances',
  'selections':  'Deductions',
  'retirement':  'Retirement contributions',
  'medical':     'Medical',
  'travel':      'Travel',
  'homeoffice':  'Working from home',
  'interest':    'Interest exemption',
  'b2investment':'Investment income',
  'b3rental':'Rental income',
  'b4business':'Business & trade',
  'b5cgt':'Capital gains & losses',
  'b6foreign':'Foreign income',
  'b7retirement':'Retirement income',
  'b9other':'Other income',
  'b10crypto':'Crypto & digital assets',
  'paye':        'PAYE',
  'b1employment':'Employment income',
  'additional':  'Other claims',
  'tools':       'Tools & equipment',
  'cgt':         'Capital gains & losses',
  'rental':      'Rental income',
  'donations':   'Donations',
  'subscrip':    'Professional memberships',
  'subsistence': 'Away-from-home costs',
  'return':      'Taxation',
  'documents':   'Documents',
  'risk':        'Risk assessment',
  'history':     'Tax history',
  'scenario':    'Growth assumptions',
  'multiyear':   'Year-by-year projection',
  'optimise':    'Ways to pay less',
  'calculator': 'Earlier-year calculator',
  'comparison': 'Compare two years',
  'forecast':    'Provisional — forecast',
  'payments':    'Provisional — payments',
  'penalty':     'Provisional — penalty check',
};

/* QA 2026-08 (B2-G-4); OD-18 (2026-09): which colour area a screen belongs
   to.

   Mostly this is just the mode, but two areas are tabs inside the Taxation
   panel and own their own identity — the SARS Account (prior-year balances,
   amber) and Provisional tax (rose, TOK-9/6.14). Those are matched first,
   so landing on them from anywhere repaints the whole page rather than
   leaving Taxation's navy on the surrounding chrome. Both used to be
   cross-panel jumps (Income tab / standalone mode) that got this colour "for
   free" from the panel change; OD-18 made them real tabs of Taxation, so the
   amber/coral exception is now explicit here instead.

   The mapped name is stamped on .app-body; main.css turns it into an
   --area-accent for the chrome that sits outside the mode panel. */
/* Colour plumbing only (2026-09 polish, B5 follow-up): 'risk', 'calculator'
   and 'comparison' are Taxation's three remaining tabs that still fell
   through to the mode's own navy by omission rather than by a stated
   colour — added here, each pointed at a navy placeholder in main.css's
   --area-accent block, so a real colour is a one-line swap later rather
   than a structural change. Named after their own tab values, matching
   'prioryear'/'provtax' above — NOT 'historical'/'projection', which would
   collide with the unrelated standalone Projection mode's own
   data-area="projection" (cyan, scenario/multiyear/optimise). */
const AREA_BY_TAB = { prioryear: 'prioryear', provtax: 'provtax', risk: 'risk', calculator: 'calculator', comparison: 'comparison' };
export function currentArea(mode, tab) {
  return (tab && AREA_BY_TAB[tab]) || mode || 'dashboard';
}
export function setAreaAttr(mode, tab) {
  const area = currentArea(mode, tab);
  const body = document.querySelector('.app-body');
  if (body) body.setAttribute('data-area', area);
  /* Also on the panel itself. The body alone cannot colour what lives INSIDE
     the panel once area and mode diverge: the SARS Account and Provisional tax
     render their page head and tab rail inside #mode-income, which would
     otherwise keep Income's emerald. Stamped on the active panel only, so a
     hidden panel never holds a stale area. */
  document.querySelectorAll('.mode-panel[data-area]').forEach(p => p.removeAttribute('data-area'));
  const panel = document.getElementById('mode-' + mode);
  if (panel) panel.setAttribute('data-area', area);
  /* B3.3: also on #app, the shared ancestor of .app-header and .app-body —
     the app-bar title (#header-title) lives in .app-header, a DOM sibling of
     .app-body, so it can only ever see --area-accent via this scope. */
  const appEl = document.getElementById('app');
  if (appEl) appEl.setAttribute('data-area', area);
}

/* QR2.1 (QD-09): the one way to reach a captured item's own input. Every
   outstanding row and income-breakdown chip calls this with a CAPTURE_ROUTES
   key (01-data.js) instead of navigateTo(mode, tab) — a tab alone lands on the
   right page but leaves the user to find the field. `arrive` says what
   happens once there; see CAPTURE_ROUTES for the vocabulary.

   Returns the route (or null for an unknown key) so callers and the smoke
   check can read where it went. An unknown key is a programming error, not
   user state: it logs and does nothing rather than guess a page. */
/* The [mode, tab] pair of a route, for callers that still need one (the
   "still to add" markers read nav[1] as the tab). Derived, never hand-kept. */
export function captureNav(key) {
  const rt = CAPTURE_ROUTES[key];
  return rt ? [rt.mode, rt.tab] : null;
}

/* QR2.2 (Q-UIC-3): keep a label's ⓘ with the label's last word. A plain or
   no-break space is not enough — a browser may still break before an
   inline-flex box — so the last word and the ⓘ share a nowrap span
   (.lbl-tail), and in a narrow column the ⓘ wraps WITH that word instead of
   onto a line of its own (the QR0.3 geometry check). `label` is plain text
   or markup-free at its tail; if the tail holds a tag, it is left alone. */
export function lblWithInfo(label, infoHtml) {
  const i = label.lastIndexOf(' ');
  const tail = label.slice(i + 1);
  if (tail.indexOf('<') >= 0 || tail.indexOf('>') >= 0) return label + ' ' + infoHtml;
  return label.slice(0, i + 1) + '<span class="lbl-tail">' + tail + ' ' + infoHtml + '</span>';
}

export function navigateToCapture(key) {
  const rt = CAPTURE_ROUTES[key];
  if (!rt) { console.error('navigateToCapture: no route for', key); return null; }
  /* Through window.navigateTo, not the local binding: 13-patches.js wraps it
     with the unapplied-changes guard and the snapshot-on-arrival hook, and a
     tap on an outstanding row must get both exactly as the old inline
     navigateTo(...) onclick did. If the guard opened its dialog, the page did
     not change and there is nothing to arrive at yet. */
  (window.navigateTo || navigateTo)(rt.mode, rt.tab);
  const parts = rt.arrive.split(':');
  const section = document.getElementById('tab-' + (MODE_PREFIX_MAP[rt.mode] || rt.mode) + '-' + rt.tab);
  const modePanel = document.getElementById('mode-' + rt.mode);
  if (!modePanel || !modePanel.classList.contains('active') || !section || !section.classList.contains('active')) return rt;
  if (parts[0] === 'openAddIfEmpty') {
    /* Built here, not at module scope: these are imports from modules that
       import this one (hard rule 10). */
    const adders = { addEmployerPaye, addIncomeItem, addIt3bItem, addBusinessItem,
                     addRentalProperty, addCgtAsset, addOtherReceipt };
    if (!(APP[rt.list] || []).length && adders[rt.add]) adders[rt.add]();
  } else if (parts[0] === 'focusFirst') {
    const first = section && Array.from(section.querySelectorAll('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])'))
      .find(el => el.checkVisibility && el.checkVisibility());
    if (first) first.focus({ preventScroll: false });
  } else if (parts[0] === 'expandBalanceRow') {
    const row = document.getElementById('carried-seg-' + parts[1]);
    if (row) {
      row.setAttribute('open', '');
      row.scrollIntoView({ block: 'center' });
      const input = row.querySelector('.ledger-row input');
      if (input && input.checkVisibility && input.checkVisibility()) input.focus({ preventScroll: true });
    }
  }
  return rt;
}

export function navigateTo(mode, tab) {
  /* QA 2026-09: "Your return" always opens collapsed on arrival at the
     Dashboard — it previously remembered the user's last open/closed
     choice (APP._completenessOpen) across visits, and also defaulted OPEN
     once anything had been captured. Both meant a returning user could
     land on an already-expanded card. Reset here, on every navigation INTO
     dashboard, rather than in renderCompletenessCard() itself — that
     function reruns on every keystroke while already on the dashboard,
     which would collapse the card under the user's own open toggle. */
  /* S3 Batch 2 (C4): the reward and balance cards are the same kind of
     expandable dashboard card as "Your return" above, and the brief asks
     for the same "always collapsed on arrival" behaviour across all of
     them, not just this one — reset alongside it. */
  if (mode === 'dashboard') { APP._completenessOpen = false; APP._rewardOpen = false; APP._dashBalanceOpen = false; }

  /* Update header title. B1: a page that carries a back bar already names
     itself there, so the header falls back to the AREA name — otherwise the
     same words appeared twice, one above the other. Pages with no back bar
     keep the previous behaviour and title themselves in the header. */
  const pageHead = PAGE_HEADS[(MODE_PREFIX_MAP[mode] || mode) + '-' + (tab || '')];
  const hasBackBar = !!pageHead;
  const title = (tab && !hasBackBar) ? (TAB_TITLES[tab] || SCREEN_TITLES[mode] || mode)
                                     : (SCREEN_TITLES[mode] || mode);
  const headerTitleEl = $('header-title');
  headerTitleEl.textContent = title;
  /* B3.3/D-2: a main/selector page (its own PAGE_HEADS entry's backMode is
     'dashboard') already names itself in the in-page heading beside the
     back button — the app-bar title above would just repeat it. Hidden via
     a class (visibility, not display) so the header's flex geometry never
     shifts between a page that shows the title and one that hides it. */
  headerTitleEl.classList.toggle('header-title-hidden', !!pageHead && pageHead.backMode === 'dashboard');

  /* QR11: an AREA change plays the edge sweep. What is needed from the
     outgoing panel is read here, before the swap hides it. */
  const _appBody = document.querySelector('.app-body');
  const _prevArea = _appBody && _appBody.getAttribute('data-area');
  const _areaChanged = !!_prevArea && _prevArea !== currentArea(mode, tab);
  const _prevPanel = _areaChanged ? document.querySelector('.mode-panel.active') : null;
  const _prevRect = _prevPanel ? _prevPanel.getBoundingClientRect() : null;

  // Show correct mode panel
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
  const panel = $('mode-' + mode);
  if(panel) panel.classList.add('active');

  /* QA 2026-08 (B2-G-4): stamp the current AREA on .app-body so the chrome
     that lives OUTSIDE the mode panel — the sticky tax-year bar, the page-head
     back link, the tab rail — can take the area's colour too. A mode panel
     alone cannot reach them: they are its siblings, not its descendants.

     Area is not always the same thing as mode. The SARS Account and
     Provisional tax are their own areas that happen to be tabs inside the
     Income panel, so they resolve by tab first. */
  setAreaAttr(mode, tab);

  // Open every panel at its heading, not wherever the previous panel was scrolled.
  window.scrollTo(0, 0);

  // Switch tab within mode if specified.
  // skipEffects=true: navigateTo runs its own effects map below, which covers
  // every key switchTab would fire — without it each renderer ran twice.
  if(tab) {
    switchTab(mode, tab, true);
  }

  // Deep links can target a deduction tab that isn't enabled in Selections
  // (its section is display:none) — offer activation instead of a blank page.
  if (mode === 'deductions') {
    try { maybeOfferDedActivation(tab || ''); } catch(e) { console.error('dedActivation:', e); }
  }

  // Update drawer active states
  document.querySelectorAll('.drawer-item, .drawer-subitem').forEach(el => el.classList.remove('active'));
  const screenKey = tab ? (MODE_PREFIX_MAP[mode]||mode) + '-' + tab : mode;
  const activeEl = document.querySelector(`[data-screen="${screenKey}"]`);
  if(activeEl) {
    activeEl.classList.add('active');
    // Also highlight parent group and ensure it's expanded
    const parentGroup = activeEl.closest('.drawer-subitems');
    if(parentGroup) {
      parentGroup.classList.add('open');
      const groupToggle = parentGroup.previousElementSibling;
      if(groupToggle) {
        groupToggle.classList.add('active');
        groupToggle.classList.add('expanded');
      }
    }
  }

  // Sync bottom-nav active state (maps every screen to its primary destination;
  // screens without a bottom-nav home — e.g. projection, reference — clear all).
  // OD-18 (2026-09): the SARS Account and Provisional tax tabs are now real
  // tabs of the Taxation (summary) panel, so mode already IS 'summary' here —
  // no special-case needed (previously this remapped mode==='income' to
  // 'summary' for exactly these two, back when they were cross-panel jumps).
  document.querySelectorAll('.bottom-nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));

  // Side effects
  const effects = {
    'dashboard':        () => { if(typeof renderDashboard === 'function') renderDashboard(); },
    'summary-return':   () => { renderTaxReturn(); openTaxGlance(); },
    'summary-risk':     () => renderRiskAssessment(),
    'summary-provtax':  () => { if(typeof renderProvTaxHub === 'function') renderProvTaxHub(); },
    'proj-scenario':    () => {},
    'proj-multiyear':   () => updateProjection(),
    'proj-optimise':    () => renderOptimisation(),
    'summary-calculator': () => onHistYearChange(),
    'actref':           () => { renderActRefInline(); renderRateTableInline(); },
    'taxfaqs':          () => { renderTaxFaqs(); },
    'subscribe':        () => renderSubscribePanel(),
  };
  const effectKey = tab ? (mode === 'income' ? 'income-'+tab : mode === 'deductions' ? 'ded-'+tab : mode === 'projection' ? 'proj-'+tab : mode + '-' + tab) : mode;
  /* Monetization M2: locked screens render the entitlement overlay as a
     first-class state INSTEAD of their normal effect (00-DESIGN §4.2 —
     navigation is allowed; the module's own renderer is what's gated). */
  let _entGated = false;
  try { _entGated = entGateScreen(mode, tab); } catch(e) { console.warn('entGate:', e); }
  if(!_entGated && effects[effectKey]) {
    try { effects[effectKey](); } catch(e) { if(typeof _showError === 'function') _showError('nav.' + effectKey, e); }
  }

  /* v8.22 D6: keep yes/no tile-radios in sync with their backing selects on every navigation */
  if(typeof syncYn === 'function') { try { syncYn(); } catch(e){} }

  closeDrawer();

  // V8.4 IX: persist current mode/tab so modal open/close can refresh FAB correctly
  APP.currentMode = mode;
  APP.currentTab = tab;

  // Update FAB
  if(typeof updateFAB === 'function') {
    try { updateFAB(mode, tab); } catch(e) { console.error('FAB:', e); }
  }

  /* QR11: the sweep for an area change, then the mascot's page-entry
     reaction. Both are queued behind this function's own re-renders
     (katReact waits a frame), so neither lands on a node about to be
     replaced. katReact('entry') replaces the old katGreetOnEnter(), which
     held its wave with a 1.5s timer. */
  if (_areaChanged) _areaSweep(_prevPanel, _prevRect, panel);
  katReact('entry');

  /* QR2.5 (QD-20): a panel becoming visible is itself a trigger, independent
     of renderAll() — a hero whose value changed while its panel was hidden
     only gets its "first view after the change" here, not at the render
     that actually changed the value. */
  try { animateHeroFigures(); } catch(e) { console.error('navigateTo.animateHeroFigures:', e); }
}


/* WCAG 4.1.2: decorate the five static tab bars with the ARIA tabs pattern.
   Section id = 'tab-' + button data-tab, so the association is derived rather
   than hand-maintained across 13 buttons. Runs once at boot. */
export function initTabA11y() {
  document.querySelectorAll('.tab-bar').forEach(bar => {
    bar.setAttribute('role', 'tablist');
    bar.querySelectorAll('.tab-btn').forEach(b => {
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
      const section = document.getElementById('tab-' + b.dataset.tab);
      if (section) {
        b.setAttribute('aria-controls', section.id);
        section.setAttribute('role', 'tabpanel');
        if (!b.id) b.id = 'tabbtn-' + b.dataset.tab;
        section.setAttribute('aria-labelledby', b.id);
      }
    });
  });
}

export function switchTab(mode, tab, skipEffects) {
  // Determine tab bar ID and prefix
  const barMap = {
    'income':'tabs-income', 'deductions':'tabs-deductions', 'summary':'tabs-summary',
    'projection':'tabs-projection'
  };
  const barId = barMap[mode];
  const prefix = MODE_PREFIX_MAP[mode];
  if(!barId) return;

  /* Tab changes can cross an AREA boundary without going through navigateTo:
     the Taxation tab rail carries the SARS Account and Provisional tax,
     which are their own colour areas (QA 2026-08, B2-G-4; OD-18). Re-stamp
     here too, or tapping those tabs directly would leave Taxation's navy on
     the chrome. */
  setAreaAttr(mode, tab);

  document.querySelectorAll(`#${barId} .tab-btn`).forEach(b => {
    const on = b.dataset.tab === `${prefix}-${tab}`;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const panel = $(`mode-${mode}`);
  if(panel) panel.querySelectorAll('.tab-section').forEach(s =>
    s.classList.toggle('active', s.id === `tab-${prefix}-${tab}`)
);

  /* B1 Simplification: repaint the mode's back bar for the page now showing.
     switchTab is the single funnel every tab change goes through (navigateTo
     delegates here), so this is the one place the head needs updating. */
  if(typeof updatePageHead === 'function') {
    try {
      updatePageHead(mode, tab);
      /* The bar is fresh DOM, so its ⓘ needs the same keyboard/ARIA pass
         every other info button gets (a11y is load-bearing — CLAUDE.md 11). */
      const _slot = $('page-head-' + mode);
      if(_slot && typeof a11yWireInfoBtns === 'function') a11yWireInfoBtns(_slot);
    } catch(e) { console.error('pageHead:', e); }
  }

  // B0 Simplification P5: reset page to primary section (collapses open sections
  // + resets seg-ctls to their first button) — ensures every tab entry lands on
  // the primary content, never a sub-section left open from a prior visit.
  const activeSection = panel && $(`tab-${prefix}-${tab}`);
  if(activeSection) resetPageToPrimary(activeSection);

  /* Batch 2: rebuild the income tab bar's CONTENT (not just which button is
     marked active) on every income-tab transition — needed because the
     SARS Account tab swaps the whole button set to tax-related
     destinations instead of income buckets, and must swap back on leaving
     it. updateIncomeTabs() previously only ran at boot and on income-type
     toggle, missing plain tab-to-tab navigation. Runs before the
     skipEffects guard so it fires from both direct tab-button clicks and
     navigateTo(). */
  if(mode === 'income' && typeof updateIncomeTabs === 'function') updateIncomeTabs();

  // Side effects (only when called directly from a tab button —
  // navigateTo passes skipEffects and fires its own effects map)
  if(skipEffects) return;
  /* Monetization M2: static tab bars (e.g. summary → Risk) reach here
     without navigateTo — apply the same locked-overlay gate and skip the
     screen's renderer when locked. */
  let _entGated = false;
  try { _entGated = entGateScreen(mode, tab); } catch(e) { console.warn('entGate:', e); }
  if(_entGated) return;
  const effects = {
    'summary-return':   () => { renderTaxReturn(); openTaxGlance(); },
    'summary-risk':     () => renderRiskAssessment(),
    /* OD-18: Provisional Tax is now a real Taxation tab, reachable by a
       direct tab-button click as well as navigateTo() — needs its own
       renderer here too (navigateTo's effects map already has it). */
    'summary-provtax':  () => { if(typeof renderProvTaxHub === 'function') renderProvTaxHub(); },
    'proj-multiyear':   () => updateProjection(),
    'proj-optimise':    () => renderOptimisation(),
  };
  if(effects[`${prefix}-${tab}`]) effects[`${prefix}-${tab}`]();
}

/* ── MODALS ── */
/* Focus trap (WCAG 2.4.3 / 2.1.2): Tab cycles inside the open dialog,
   focus moves into the dialog on open and returns to the opener on close.
   A stack supports dialogs over dialogs (e.g. confirm over profile). */
export const _modalFocusStack = [];
export function _modalFocusables(el) {
  return Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(e => !e.disabled && e.offsetParent !== null);
}
export function _modalTrapKeydown(e) {
  /* Batch C (UX #14): Enter in a text-like field submits the modal — clicks the
     footer's primary save button. Only fires when that button's action is a
     save* (so the profile modal's "Exit" and the danger-class confirm dialog are
     never auto-triggered); never from textareas, selects, or toggles. */
  if (e.key === 'Enter') {
    const t = e.target;
    const okTypes = ['text','number','email','tel','date','password','search','url',''];
    if (t && t.tagName === 'INPUT' && okTypes.indexOf((t.type||'').toLowerCase()) >= 0) {
      const save = e.currentTarget.querySelector('.modal-footer-right .btn-primary');
      if (save && /save/i.test(save.getAttribute('onclick') || '')) { e.preventDefault(); save.click(); }
    }
    return;
  }
  if (e.key !== 'Tab') return;
  const f = _modalFocusables(e.currentTarget);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || !e.currentTarget.contains(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}
/* B7.7 (IEM-1) — `.fx-widget-gated` instances (fxWidgetHtml(), 00-forms.js)
   used to be gated here, in bulk, on the app-wide APP.foreignIncomeYN
   profile flag. That gated every foreign-currency widget in a modal
   together regardless of what THIS record's own domestic/foreign field
   said — a user who had declared foreign income saw the widget on every
   record, including ones they had just marked domestic, and a user who
   hadn't declared it saw no widget even on a record they explicitly
   flagged foreign right there in the same modal.

   Gating now lives with each record's own source field instead:
   rentalToggleType(), penToggleForeign() and bizToggleForeign() (their own
   files) call showFxWidgetFor() below directly, and IT3(b)'s foreign rows
   need no separate call at all — their fx-widgets sit inside a row that is
   already hidden until its line is added (it3bAddLine(), 05-list-modules.js),
   so removing this blanket gate is the whole fix there.
   These per-record toggles already run via each modal's `onForm` callback
   when it opens (existing wiring — not new), so no replacement call is
   needed in openModal() below. */
/* B7.7 — hides a foreign-only row AND clears every field inside it,
   including its own fx-conversion widget. A hidden form-group's input still
   reaches collect() at Save (display:none doesn't remove it from the DOM),
   and a foreign-tax field feeds the real s6quat credit (FOREIGN_EXCHANGE_RATES,
   s25D) — so switching a record back to domestic must not silently leave a
   stale credit behind. */
export function showForeignRow(rowId, show) {
  const row = $(rowId); if (!row) return;
  row.style.display = show ? '' : 'none';
  if (!show) row.querySelectorAll('input, select').forEach(el => { el.value = ''; });
}
/* ══════════════════════════════════════════════════════════════
   QR7.3 (Q-ONB-1/2/3, Q-INV-2, QD-10, QD-24) — PROFILE-SCENARIO GATING
   The one mechanism that decides whether a low-frequency field, option or
   wizard step is asked for, from APP.profileScenarios (onboarding/Profile).
   Capture configs (00-forms.js) declare `showWhen: '<gate>'` on a field,
   an option or a step; renderField/renderStep stamp it as data-show-when,
   and applyScenarioGates() below evaluates it every time a modal opens
   (openModal), after the form has been cleared or loaded — so it sees the
   record being edited.

   Gates: jointOwnership | cgtJointOwnership | minorChildAccount | tfsa |
   foreign:<FOREIGN_SCENARIO_CATEGORIES key>.

   Three rules, each load-bearing:
   1. Unanswered = SHOW (QD-24). Only an explicit No closes a gate.
   2. Captured data is NEVER hidden. A closed gate still shows a row whose
      input holds something other than its hidden value, an option the
      select currently holds, or a step with an amount in it — with a
      mismatch note instead of the "you told us" note.
   3. A hidden field submits its `hiddenValue`, never ''. An ownership share
      hidden because the user owns alone is 100 %: every collector reads an
      empty share as 0 (makeCrudModule's `gv()||0`, the rental/CGT
      `gv() != null` guards — gv('') is 0, not null), so clearing it the way
      showForeignRow() does would tax NOTHING. Do not reuse showForeignRow()
      here (QR7.3 trap; 06-HANDOFF §4 trap 4).
   Per-record domestic/foreign toggles (rentalToggleType, penToggleForeign,
   bizToggleForeign, cgtToggleType) still run first and still decide within
   an allowed category — this sits above them, never in place of them
   (IEM-1, QD-10). */
export function foreignCategoryAllowed(cat) {
  const f = (APP.profileScenarios || {}).foreign;
  if (!f || !Array.isArray(f.categories)) return true;        // layers 2-3 never answered
  if (APP.foreignIncomeYN !== 'yes') return false;            // layer 1 answered No
  return f.categories.length === 0 || f.categories.indexOf(cat) >= 0;  // Yes with nothing ticked = unanswered
}
export function scenarioAllows(gate) {
  const ps = APP.profileScenarios || {};
  if (gate.indexOf('foreign:') === 0) return foreignCategoryAllowed(gate.slice(8));
  const q = SCENARIO_QUESTIONS.find(x => x.key === gate);
  if (!q) return true;
  /* A follow-up (#2) only counts while its parent (#1) is Yes; otherwise the
     parent alone decides — a stale follow-up answer the user can no longer
     see in Profile must never keep a field closed. */
  if (q.requires && ps[q.requires] !== 'yes') return ps[q.requires] !== 'no';
  return ps[gate] !== 'no';
}
/* Is there something the user already captured inside `el`? For a row with
   a hidden value: its input holds anything else. For a step: any amount or
   text field (not the currency converter's own inputs) holds a value. */
function _scnCaptured(el) {
  const hv = el.getAttribute('data-hidden-value');
  if (hv != null) {
    const inp = el.querySelector('input, select');
    if (!inp || inp.value === '') return false;
    return inp.tagName === 'SELECT' ? inp.value !== hv : parseFmt(inp.value) !== parseFmt(hv);
  }
  return Array.from(el.querySelectorAll('input, select')).some(inp => {
    if (inp.closest('.fx-widget') || inp.closest('.cp') || inp.type === 'hidden') return false;   // QR9a: a code picker is a chooser, not captured data
    return inp.tagName === 'SELECT' ? false : (inp.classList.contains('mono') ? parseFmt(inp.value) !== 0 : !!String(inp.value || '').trim());
  });
}
/* QR9b.3: has the user typed anything into this sheet? Amounts, text and
   dates count; selects, radio tiles and tick boxes do not (they always hold
   a default), nor do the currency converter or a code picker's search box.
   Used before a capture sheet is swapped for another kind's, so nothing
   typed is thrown away without asking. */
export function formHoldsInput(root) {
  return Array.from(root.querySelectorAll('input')).some(inp => {
    if (inp.closest('.fx-widget') || inp.closest('.cp')) return false;
    if (inp.type === 'hidden' || inp.type === 'radio' || inp.type === 'checkbox') return false;
    return inp.classList.contains('mono') ? parseFmt(inp.value) !== 0 : !!String(inp.value || '').trim();
  });
}
export function applyScenarioGates(root) {
  const scope = root || document;
  const keptByGate = {};
  scope.querySelectorAll('[data-show-when]').forEach(el => {
    const gate = el.getAttribute('data-show-when');
    const allowed = scenarioAllows(gate);
    let keep = allowed;
    if (el.tagName === 'OPTION' || el.tagName === 'OPTGROUP') {
      const sel = el.closest('select');
      const holds = el.tagName === 'OPTION' ? (sel && sel.value === el.value)
        : Array.from(el.querySelectorAll('option')).some(o => sel && o.value === sel.value);
      if (!allowed && holds) { keep = true; keptByGate[gate] = true; }
      el.hidden = !keep; el.disabled = !keep;
      return;
    }
    if (!allowed && _scnCaptured(el)) { keep = true; keptByGate[gate] = true; }
    el.classList.toggle('scn-off', !keep);
    if (el.classList.contains('wiz-step')) {
      if (keep) el.removeAttribute('data-gated-off'); else el.setAttribute('data-gated-off', '1');
    }
    const hv = el.getAttribute('data-hidden-value');
    if (!keep && hv != null) {
      const inp = el.querySelector('input, select');
      if (inp) inp.value = hv;
    }
  });
  /* QR7.4: the "You told us…" note for each closed gate in this scope, or
     the mismatch note where captured data kept something visible. Copy is
     built from FOREIGN_SCENARIO_CATEGORIES (data, not typed here). */
  scope.querySelectorAll('.scn-note[data-scn-gate]').forEach(box => {
    const gate = box.getAttribute('data-scn-gate');
    if (scenarioAllows(gate)) { box.classList.add('u-hidden'); box.innerHTML = ''; return; }
    const cat = FOREIGN_SCENARIO_CATEGORIES.find(c => 'foreign:' + c.key === gate);
    const noun = cat ? cat.noun : 'this';
    /* UI-NOTE-1: one line — the reason in a few words, the action as a link. */
    const link = '<button type="button" class="btn-link" onclick="openProfileScenarios()">Change in Profile</button>';
    box.innerHTML = '<i class="' + iconClassFor('info') + ' u-mr-5"></i>' + (keptByGate[gate]
      ? 'Foreign entry, but your profile says no ' + esc(noun) + '. ' + link
      : 'No ' + esc(noun) + ' in your profile, so ' + esc(cat ? cat.omitted : 'it is not asked for') + '. ' + link);
    box.classList.toggle('scn-kept', !!keptByGate[gate]);   // UI-CAP-1: the mismatch wording (main.css shows only this one under a kind select)
    box.classList.remove('u-hidden');
  });
  syncProfileChips(scope, { collapse: true });   // a sheet opens with every answer folded to its line
}
/* ══════════════════════════════════════════════════════════════
   UI-CAP-0 (owner 2026-10-05; shared rule 3) — PROFILE ANSWER ROWS
   A field rendered with `profileChip` (00-forms.js) shows its answer as one
   line with a one-tap switch instead of asking. The real input sits
   collapsed in the same row, so everything that reads or writes it is
   unchanged, and applyScenarioGates() above still hides the whole row when
   the profile answer is No.

   Ownership share ('share'): a record starts as held alone (100 %) — the
   conservative position, so an item the user holds alone is never
   under-taxed because a joint default was left in place. "Held jointly"
   applies the one usual share stored in Profile (APP.profileScenarios
   .usualShare); "Change %" opens the input for this record only.
   Law: a co-owner is taxed only on the share that accrues to them (s1
   "gross income"; see SCENARIO_QUESTIONS, 01-data.js).

   Account holder ('holder'): the IT3(b) minor-child select — own account
   (no) or a minor child's account funded by the user (yes, s7(3)). */
export function profileUsualShare() {
  const v = Number((APP.profileScenarios || {}).usualShare);
  return v > 0 && v < 100 ? v : null;
}
export function syncProfileChips(root, opts) {
  (root || document).querySelectorAll('.pchip').forEach(chip => {
    if (opts && opts.collapse) { const ed = chip.parentNode.querySelector('.pchip-edit'); if (ed) ed.hidden = true; }
    const inp = document.getElementById(chip.getAttribute('data-for'));
    const t = chip.querySelector('.pchip-t'), acts = chip.querySelector('.pchip-acts');
    if (!inp || !t || !acts) return;
    const btn = (act, label) => '<button type="button" class="pchip-btn" onclick="pchipAct(this,\'' + act + '\')">' + label + '</button>';
    if (chip.getAttribute('data-pchip') === 'holder') {
      const child = inp.value === 'yes';
      t.innerHTML = child ? '<b>Your minor child\u2019s account</b> \u00b7 taxed as yours' : '<b>Your own account</b>';
      acts.innerHTML = child ? btn('own', 'My own') : btn('child', 'My minor child\u2019s');
      return;
    }
    const v = parseFmt(inp.value) || 100;
    if (v >= 100) {
      t.innerHTML = '<b>You hold this alone</b> \u00b7 100 % yours';
      acts.innerHTML = btn('joint', 'Held jointly');
    } else {
      const usual = profileUsualShare();
      t.innerHTML = '<b>Held jointly</b> \u00b7 your share ' + esc(String(v)) + ' %' + (usual === v ? ' (from Profile)' : '');
      acts.innerHTML = btn('edit', 'Change %') + btn('alone', 'Held alone');
    }
  });
}
export function pchipAct(btn, act) {
  const row = btn.closest('.pchip-row'), chip = row && row.querySelector('.pchip');
  const inp = chip && document.getElementById(chip.getAttribute('data-for'));
  if (!inp) return;
  const set = (v) => {
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const edit = row.querySelector('.pchip-edit');
  if (act === 'child') set('yes');
  else if (act === 'own') set('no');
  else if (act === 'alone') { set('100'); if (edit) edit.hidden = true; }
  else if (act === 'joint') {
    const usual = profileUsualShare();
    if (usual) set(String(usual));
    else { set(''); if (edit) { edit.hidden = false; inp.focus(); } }   // no usual share in Profile yet: ask once, here
  }
  else if (act === 'edit' && edit) { edit.hidden = false; inp.focus(); }
  syncProfileChips(row);
}
/* QR7.2: the shared pieces onboarding (12-) and Profile (13-) both build
   their scenario questions from, so the two surfaces cannot disagree about
   which question applies or how its chips look. */
export function scenarioQuestionApplies(q, selectedTypes, answers) {
  if (!q.appliesTo.some(t => selectedTypes.indexOf(t) >= 0)) return false;
  return !q.requires || answers[q.requires] === 'yes';
}
/* Layer 3's choices: every currency SARS has published an average rate for
   in any year (FOREIGN_EXCHANGE_RATES), so the list follows QR3.3's table. */
export function scenarioCurrencies() {
  const seen = [];
  Object.keys(FOREIGN_EXCHANGE_RATES).forEach(y => Object.keys(FOREIGN_EXCHANGE_RATES[y]).forEach(c => { if (seen.indexOf(c) < 0) seen.push(c); }));
  return seen;
}
/* Checkbox chips for layers 2 and 3 (`name` scopes them per surface). */
export function scenarioChipsHtml(name, items, checked, handlerAttr) {
  return '<div class="ob-chip-wrap">' + items.map(it =>
    '<label class="ob-chip"><input type="checkbox" name="' + name + '" value="' + esc(it.value) + '"' + (checked.indexOf(it.value) >= 0 ? ' checked' : '') + handlerAttr + '>'
    + '<i class="material-symbols-outlined msi-check"></i>' + esc(it.label) + '</label>').join('') + '</div>';
}
/* prefix 'ob' (onboarding: read on Next/Finish, no handler) or 'p' (Profile:
   saved on every tick). The handler is a literal so gen-bridge.js sees it. */
export function foreignLayersHtml(prefix) {
  const f = (APP.profileScenarios || {}).foreign || {};
  const h = prefix === 'p' ? ' onchange="onProfileForeignLayers()"' : '';
  const cats = FOREIGN_SCENARIO_CATEGORIES.map(c => ({ value: c.key, label: c.label }));
  const curs = scenarioCurrencies().map(c => ({ value: c, label: c }));
  return '<div class="form-label" id="' + prefix + '-fcat-lbl" style="margin-top:12px">From what? <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">(tick all that apply)</span></div>'
    + '<div role="group" aria-labelledby="' + prefix + '-fcat-lbl">' + scenarioChipsHtml(prefix + '-fcat', cats, f.categories || [], h) + '</div>'
    + '<div class="form-label" id="' + prefix + '-fcur-lbl" style="margin-top:12px">Which currencies? <span class="u-c-tx3" style="font-weight:normal;font-size:0.6875rem">(from SARS’s published rates)</span></div>'
    + '<div role="group" aria-labelledby="' + prefix + '-fcur-lbl">' + scenarioChipsHtml(prefix + '-fcur', curs, f.currencies || [], h) + '</div>';
}
export function checkedValues(name) {
  return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(el => el.value);
}
/* QR7.5 (QD-24): the one-off Dashboard card for existing users. Only worth
   showing if at least one new question applies to what they declared. */
export function scenarioReviewApplies() {
  const ps = APP.profileScenarios || {};
  if (!APP.onboardingCompleted || ps.reviewDismissed) return false;
  /* Answering any of them (in Profile, say) makes the card's "nothing has
     changed for you yet" untrue — it has done its job. */
  if (ps.foreign || SCENARIO_QUESTIONS.some(q => ps[q.key])) return false;
  const sel = getSelectedIncomeTypes();
  return APP.foreignIncomeYN === 'yes' || SCENARIO_QUESTIONS.some(q => scenarioQuestionApplies(q, sel, ps));
}
export function scenarioReviewDone(openProfile) {
  APP.profileScenarios = Object.assign({}, APP.profileScenarios, { reviewDismissed: true });
  debounceSave();
  const host = $('dash-scenario-review'); if (host) host.innerHTML = '';
  if (openProfile) openProfileScenarios();
}

/* The live (not gated-off) steps of a wizard modal, in order. wizGoto/
   wizNext (00-forms.js) count and index these, so a gated-off step is
   skipped and "Step n of N" counts only what the user will see. */
export function wizLiveSteps(m) {
  /* data-kind-off: a step the record's kind leaves out (UI-CAP-1 — an
     IT3(b) without both halves, it3bApplyKind). */
  return Array.from(m.querySelectorAll('.wiz-step')).filter(s => !s.hasAttribute('data-gated-off') && !s.hasAttribute('data-kind-off'));
}
/* "Change this in Profile": close whatever capture sheet is open, open
   Profile on the Income Sources section and bring the scenario questions
   into view (QR7.4). */
export function openProfileScenarios() {
  const open = document.querySelector('.modal-overlay.open');
  if (open && open.id !== 'modal-profile') {
    /* Leaving a capture sheet drops what was typed in it (add/edit start
       from a clean form) — say so before going. */
    showConfirm('Leave this form?', 'What you have entered here is not saved yet. Open Profile anyway?', () => {
      closeModal(open.id);
      _openProfileAtScenarios();
    }, { tier: 'del', okLabel: 'Open Profile' });
    return;
  }
  _openProfileAtScenarios();
}
function _openProfileAtScenarios() {
  openProfileModal();
  const head = $('prof-income-head');
  if (head && !head.classList.contains('open')) cardSecToggle('prof-income');
  const target = $('prof-scenarios');
  if (target) { try { target.scrollIntoView({ block: 'start' }); } catch (e) {} }
}

/* B7.7 — gates one always-visible amount field's OWN fx-conversion widget
   (found by DOM position, not a hardcoded id — the widget's id is an
   auto-incremented counter assigned at module load). Unlike showForeignRow,
   this never touches the amount field itself: `pen-amount`/`rental-income`/
   `biz-income` hold a real Rand figure regardless of the record's source,
   only the currency-conversion HELPER is foreign-only. */
export function showFxWidgetFor(targetFieldId, show) {
  const input = $(targetFieldId); if (!input) return;
  const grp = input.closest('.form-group'); if (!grp) return;
  const widget = grp.querySelector('.fx-widget'); if (!widget) return;
  widget.classList.toggle('u-hidden', !show);
  if (!show) widget.querySelectorAll('input, select').forEach(el => { el.value = ''; });
}
export function openModal(id)  {
  const el = $(id); if(!el) return;
  applyScenarioGates(el);   // QR7.3: after the form was cleared/loaded, before it is seen
  const top = _modalFocusStack[_modalFocusStack.length - 1];
  if (!top || top.id !== id) {
    _modalFocusStack.push({ id, opener: document.activeElement });
    el.addEventListener('keydown', _modalTrapKeydown);
  }
  el.classList.add('open','active');
  /* STD-COL-2 (design-system-audit-2026-09, OD-15): --area-accent is stamped
     on .app-body and the active .mode-panel (setAreaAttr, above) — neither of
     which a modal is a descendant of, so every "this button in a modal should
     be the category colour" finding fell back to --accent (cyan) even after
     STD-COL-1 landed. Copy the CURRENT area onto the modal each time it
     opens (not once at boot) so a modal always reflects whichever area was
     active on the page underneath it, and a shared/reused modal (help,
     confirm) never carries a stale area from its previous opener. */
  const _areaBody = document.querySelector('.app-body');
  const _area = _areaBody && _areaBody.getAttribute('data-area');
  if (_area) el.setAttribute('data-area', _area); else el.removeAttribute('data-area');
  // Mask any fields populated programmatically before this open (edit flows).
  if (typeof maskAll === 'function') maskAll(el);
  // Always open at the heading: reset the modal's scroll region(s) to the top,
  // regardless of where they were left on a previous open.
  el.scrollTop = 0;
  const _mbody = el.querySelector('.modal-box > .modal-body'); if (_mbody) _mbody.scrollTop = 0;
  const _msheet = el.querySelector('.modal-sheet'); if (_msheet) _msheet.scrollTop = 0;
  setTimeout(() => {
    if (!el.classList.contains('open')) return;
    const f = _modalFocusables(el);
    /* UI-CAP-1: a sheet opened on its kind chooser starts on a tile. */
    if (el.getAttribute('data-kind-stage') === 'pick') {
      const t = el.querySelector('.kind-switch .kind-tile.sel:not(.u-hidden)') || el.querySelector('.kind-switch .kind-tile:not(.u-hidden)');
      if (t) { t.focus({ preventScroll: true }); return; }
    }
    // v8.23: focus the first form FIELD, not merely the first focusable — info
    // tooltip triggers (.info-btn) are now focusable and must not steal a
    // dialog's initial focus from its first input.
    // preventScroll: focusing must not scroll the body and push the pinned
    // heading off-screen — the field already sits directly under it.
    let field = f.find(e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && e.type !== 'hidden');
    /* QR9b.4: a radio group is entered at its ticked option (a 'choice' field,
       the first control on the crypto disposal sheet), not at its first. */
    if (field && field.type === 'radio') field = el.querySelector('input[type="radio"][name="' + field.name + '"]:checked') || field;
    if (field) field.focus({ preventScroll: true });
    else if (f.length) f[0].focus({ preventScroll: true });
    else { const box = el.querySelector('.modal-box') || el.querySelector('.modal-sheet'); if (box) { box.setAttribute('tabindex','-1'); box.focus({ preventScroll: true }); } }
  }, 0);
  // V8.4 IX: refresh FAB visibility (hides on profile modal)
  if(typeof updateFAB === 'function') {
    try { updateFAB(APP.currentMode || 'dashboard', APP.currentTab || ''); } catch(e) {}
  }
}
export function closeModal(id) {
  const el = $(id); if(!el) return;
  el.classList.remove('open','active');
  el.removeAttribute('data-kind-stage');   // UI-CAP-1: the next opener decides whether it starts on the chooser
  el.removeEventListener('keydown', _modalTrapKeydown);
  for (let i = _modalFocusStack.length - 1; i >= 0; i--) {
    if (_modalFocusStack[i].id === id) {
      const opener = _modalFocusStack[i].opener;
      _modalFocusStack.splice(i, 1);
      if (i === _modalFocusStack.length && opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
      break;
    }
  }
  if(typeof updateFAB === 'function') {
    try { updateFAB(APP.currentMode || 'dashboard', APP.currentTab || ''); } catch(e) {}
  }
  /* Last, once the dialog is fully closed, so a callback may open another. */
  if (id === 'modal-confirm' && _confirmCancelCb) { const f = _confirmCancelCb; _confirmCancelCb = null; f(); }
}

export let _confirmCb = null;
/* opts.onCancel (D20): runs when #modal-confirm closes any way other than
   its action button — Cancel, the back button, Escape — so a caller that
   must know about "No" hears every one of them (closeModal, above). */
let _confirmCancelCb = null;

/* Tier -> {icon, eyebrow} for the confirm dialog's chip/consequence glyph and
   eyebrow label (design handoff 03-confirms-and-toasts.md). Colour itself is
   CSS-driven (.confirm-box[data-tier]), these are just the fixed per-tier
   icon + label pairing the spec leaves to the implementation to pick. */
const CONFIRM_TIER = {
  tax:     { icon: 'gavel',  eyebrow: 'Changes your return' },
  elig:    { icon: 'rule',   eyebrow: 'Eligibility' },
  del:     { icon: 'delete', eyebrow: 'Deletes data' },
  /* CONF-7 (§L.8): the Toggle-Off Row confirm (confirmContradiction, below)
     gets its own amber tier, distinct from 'tax' — CONF-8 removes its
     "Changes your return" eyebrow specifically, and this is the
     replacement, not a re-use of 'elig' (that eyebrow reads wrong here). */
  toggle:  { icon: 'gavel',  eyebrow: 'Turning this off' },
  /* Data-safety commit (05-data-safety.md §4): import replaces the whole
     profile, which is neither a tax-figure change, an eligibility test, nor
     a plain delete — its own violet tier, "Replaces your data". */
  importc: { icon: 'upload_file', eyebrow: 'Replaces your data' },
  /* D20: "Is your backup saved?" (_askIfSaved) — a question about a file,
     not a change to anything; none of the eyebrows above reads right. */
  export:  { icon: 'help', eyebrow: 'Export' },
};

/* opts (B5 + design handoff 03): { okLabel, cancelLabel } — plain-language
   buttons for confirms that are a choice rather than a destructive action
   ("Turn it off" / "Keep it on" reads as the decision it is; "Confirm"/
   "Cancel" does not). Both default to today's labels, so a caller that
   passes neither is unaffected.
   opts.tier ('tax' | 'elig' | 'del', default 'tax') drives the icon chip,
   eyebrow, accent and confirm-button fill. opts.consequence is the optional
   "what changes as a result" panel — omit it for confirms with nothing
   worth stating (e.g. a plain delete). opts.hold forces the 600ms press-
   and-hold gate; it is implied by tier==='del' and never needed elsewhere. */
export function showConfirm(title, msg, cb, opts) {
  opts = opts || {};
  const tier = opts.tier || 'tax';
  const tierMeta = CONFIRM_TIER[tier] || CONFIRM_TIER.tax;
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = msg;
  const box = $('confirm-box');
  if (box) box.dataset.tier = tier;
  const chipIco = $('confirm-ico');
  if (chipIco) chipIco.className = iconClassFor(tierMeta.icon);
  const eyebrow = $('confirm-eyebrow');
  if (eyebrow) eyebrow.textContent = tierMeta.eyebrow;
  const consEl = $('confirm-consequence');
  if (consEl) {
    if (opts.consequence) {
      consEl.hidden = false;
      const consIco = $('confirm-consequence-ico');
      if (consIco) consIco.className = iconClassFor(tierMeta.icon);
      const consText = $('confirm-consequence-text');
      if (consText) consText.textContent = opts.consequence;
    } else {
      consEl.hidden = true;
    }
  }
  // Reset any showChoice() state so it can never leak into a plain confirm.
  const alt = $('confirm-alt-btn');
  if (alt) { alt.style.display = 'none'; alt.onclick = null; }
  const cancel = $('confirm-cancel-btn');
  if (cancel) cancel.textContent = opts.cancelLabel || 'Cancel';
  const act = $('confirm-action-btn');
  act.textContent = opts.okLabel || 'Confirm';
  act.setAttribute('data-tier-fill', '');
  _confirmCb = cb;
  _confirmCancelCb = opts.onCancel || null;
  /* N5 (OWNER-DECISIONS-2026-09, Batch-1 deletion notes; also CONF-10) —
     the mandatory 600ms press-and-hold on a destructive confirm is REMOVED,
     along with its "Destructive actions hold for 600ms before firing"
     caption, its .confirm-hold / .holding styling and the _resetConfirmHold
     bookkeeping that existed only to service it.

     This deliberately REVERSES two earlier positions: §A's CONF-9 wanted the
     hold ADDED, and §I.3 Q1 wanted the mechanism kept with only the caption
     deleted. The owner overrode both. The hold guarded against an accidental
     tap destroying captured data on a touch device, and the owner has
     accepted that trade-off explicitly — recorded here because the guard is
     being removed on purpose, not lost by oversight. Every destructive
     confirm still requires an explicit, labelled confirmation press; what is
     gone is the requirement to keep holding it. */
  act.onclick = () => { _confirmCancelCb = null; closeModal('modal-confirm'); if (_confirmCb) _confirmCb(); };
  openModal('modal-confirm');
}

/* Three-way dialog on the same #modal-confirm chrome: Cancel (stock button)
   plus a primary and an alternate action. Replaces the old window.prompt()
   typed-keyword flow — WebViews render native prompts with browser chrome,
   and typing keywords is hostile on mobile. */
export function showChoice(title, msg, primaryLabel, primaryCb, altLabel, altCb) {
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = msg;
  const box = $('confirm-box');
  if (box) box.dataset.tier = 'tax';
  const tierMeta = CONFIRM_TIER.tax;
  const chipIco = $('confirm-ico');
  if (chipIco) chipIco.className = iconClassFor(tierMeta.icon);
  const eyebrow = $('confirm-eyebrow');
  if (eyebrow) eyebrow.textContent = tierMeta.eyebrow;
  const consEl = $('confirm-consequence');
  if (consEl) consEl.hidden = true;
  _confirmCancelCb = null;
  const alt = $('confirm-alt-btn');
  alt.textContent = altLabel;
  alt.style.display = '';
  alt.onclick = () => { closeModal('modal-confirm'); if (altCb) altCb(); };
  const act = $('confirm-action-btn');
  act.textContent = primaryLabel;
  act.setAttribute('data-tier-fill', '');
  _confirmCb = primaryCb;
  act.onclick = () => { closeModal('modal-confirm'); if (_confirmCb) _confirmCb(); };
  openModal('modal-confirm');
}


/* Resolves a Material Symbols name to the class string an <i>/<span> should
   carry, via the codebase's `.msi-<name>` codepoint convention (vendor/
   material-symbols.css — see msIconHtml() in 01-data.js). Font Awesome and
   the fa- -> Material Symbols ICON_MAP that bridged it are gone (icon-
   unification step 5 — every call site now passes a Material Symbols name
   directly); an unrecognised name degrades to "no icon" rather than an
   unstyled/blank glyph box, same as msIconHtml()'s own fallback. */
export function iconClassFor(name) {
  return MS_ICON_SET.has(name) ? 'material-symbols-outlined msi-' + name.replace(/_/g, '-') : '';
}
function _applyIcon(el, rawIcon) { el.className = iconClassFor(rawIcon); }

/* ── TOAST ──
   severity: 'info' | 'success' | 'warning' | 'error', default 'info'
   (design handoff 03-confirms-and-toasts.md). Sets a 3px left rule + glyph
   colour via [data-severity] in main.css; toasts stay onscreen 3.4s. */
/* BACKLOG 76: the severity defaults FROM the icon — an 'error' or 'warning'
   glyph is that severity unless the caller says otherwise. Eighteen calls
   passed 'error' as the icon alone (the onboarding "Please answer" prompts
   among them) and so showed the error glyph on the cyan info rule. */
const TOAST_SEVERITY_BY_ICON = { error: 'error', warning: 'warning' };
export function showToast(msg, icon='check_circle', severity) {
  const t = $('toast'); const ic = t.querySelector('i');
  _applyIcon(ic, icon);
  t.dataset.severity = severity || TOAST_SEVERITY_BY_ICON[icon] || 'info';
  $('toast-message').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3400);
}

/* ── REPORT A PROBLEM (BACKLOG 67, DECISIONS RP-1) ──
   A tester's report used to arrive as free text with no version, device or
   error: Android vitals sees native crashes only, never a JavaScript error
   inside the WebView, and the app has no analytics by design. The drawer row
   and About's link open the share sheet with a prepared message the tester
   reads before choosing WhatsApp or e-mail; nothing is sent by the app.
   Privacy rule, held by tests/smoke.js: no amount and no profile field ever
   enters the message — only build, device, layout, page and entitlement
   facts, and uncaught errors reduced to a redacted message and a location. */
const RECENT_ERRORS_MAX = 5;
const _recentErrors = [];
/* An error message can quote data ("Cannot parse 123 456"): every run of
   three or more digits (with digit-group separators) becomes "#", and the
   message is cut short. The location keeps only file:line:col. */
export function noteUncaughtError(message, source, line, col) {
  const msg = String(message == null ? '' : message)
    .replace(/\d[\d\s,.\u00a0]*\d{2,}/g, '#').slice(0, 160);
  const file = String(source || '').split(/[\\/]/).pop().split('?')[0];
  const where = file ? file + ':' + (line || 0) + ':' + (col || 0) : '';
  _recentErrors.push({ msg, where });
  if (_recentErrors.length > RECENT_ERRORS_MAX) _recentErrors.shift();
}

export function buildProblemReport() {
  const ua = navigator.userAgent || '';
  const android = (ua.match(/Android ([\d.]+)/) || [])[1];
  const webview = (ua.match(/Chrome\/([\d.]+)/) || [])[1];
  const ver = (document.title.match(/v(\d+)\.(\d+)\.(\d+)/) || []);
  const version = ver.length ? ver[1] + '.' + ver[2] + '.' + ver[3]
    + ' (versionCode ' + (ver[1] * 10000 + ver[2] * 100 + +ver[3]) + ')' : 'unknown';
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const panel = document.querySelector('.mode-panel.active');
  const tab = panel && panel.querySelector('.tab-section.active');
  const page = panel ? panel.id.replace(/^mode-/, '') + (tab ? ' / ' + tab.id.replace(/^tab-[a-z]+-/, '') : '') : 'none';
  let access = 'unknown';
  try {
    const e = getEntitlement();
    access = e.tier + (e.tier === 'trial' ? ' (' + e.trialDaysLeft + ' days left)' : e.state && e.state !== e.tier.toUpperCase() ? ' (' + e.state + ')' : '');
  } catch (err) { /* entitlement unreadable — say so rather than guess */ }
  const errors = _recentErrors.length
    ? _recentErrors.map((e, i) => (i + 1) + '. ' + e.msg + (e.where ? ' (' + e.where + ')' : '')).join('\n')
    : 'none';
  return [
    'InspiredTax problem report',
    'What went wrong? Please describe it here:',
    '',
    '',
    '— Details for the developer (no amounts or personal details) —',
    'Version: ' + version,
    'Device: ' + (android ? 'Android ' + android : 'not Android') + (webview ? ' · WebView ' + webview : ''),
    'Screen: ' + window.innerWidth + '×' + window.innerHeight + ' @' + (Math.round((window.devicePixelRatio || 1) * 10) / 10) + 'x · text ' + Math.round(rootPx / 16 * 100) + '%',
    'Theme: ' + (document.documentElement.getAttribute('data-theme') || 'default') + ' · Easy View ' + (APP.easyView ? 'on' : 'off'),
    'Page: ' + page,
    'Access: ' + access,
    'Recent errors: ' + (_recentErrors.length ? '' : 'none'),
  ].join('\n') + (_recentErrors.length ? '\n' + errors : '');
}

export function reportProblem() {
  const text = buildProblemReport();
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Share) {
    /* A dismissed sheet rejects "Share canceled" — not a failure here. */
    cap.Plugins.Share.share({ title: 'InspiredTax problem report', text, dialogTitle: 'Report a problem' })
      .catch(e => { if (!/cancel/i.test(String((e && e.message) || e))) showToast('Could not open the share screen — e-mail ' + SUPPORT_EMAIL + ' instead', 'error'); });
    return;
  }
  window.location.href = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('InspiredTax problem report') + '&body=' + encodeURIComponent(text);
}

/* BACKLOG 83 / DECISIONS SHARE-1: *Share InspiredTax* opens WhatsApp with
   APP_SHARE_MESSAGE (01-data.js) ready to send; the user picks the chat.
   wa.me with no number is WhatsApp's own "choose a contact" link. On a phone
   Capacitor hands any off-app URL to Android (Bridge.launchIntent), which
   opens WhatsApp, or the browser's WhatsApp page when it is not installed —
   the same path entManageSubscription's Play link takes. In a browser it
   opens in a new tab. Nothing about the user goes into the message. */
export function shareAppUrl() {
  return 'https://wa.me/?text=' + encodeURIComponent(APP_SHARE_MESSAGE);
}
export function shareApp() {
  window.open(shareAppUrl(), '_blank');
}

/* ── EASY VIEW (Q-NEW-2, qa-remediation-2026-09 §12) ──
   Opt-in, off by default, per-profile (persistData()/hydrateFromData(), same
   as every other profile setting — not the device-level localStorage the
   theme toggle uses, per the owner's per-profile decision). Applying it is
   a single class on <html> (main.css's html.easy-view rule) because every
   size in the app is already rem (CLAUDE.md rule 9) — nothing else needs to
   change. `{ silent: true }` is used at hydrate time, where the caller
   (startApp()) decides when the once-per-session disclaimer toast fires,
   so hydration itself never shows it. */
export function applyEasyView(on, opts) {
  document.documentElement.classList.toggle('easy-view', !!on);
  const cb = $('easy-view-toggle');
  if (cb) cb.checked = !!on;
  if (on && !(opts && opts.silent)) {
    showToast('Easy View is on. Some screens may not lay out exactly as designed on every phone.', 'accessible', 'info');
  }
}

export function toggleEasyView(on) {
  APP.easyView = !!on;
  applyEasyView(APP.easyView);
  debounceSave();
}

/* ── PROFILE MODAL ── */
export function openProfileModal() {
  const users = getUsers(); const u = users.find(x => x.username === APP.user);
  if(!u) return;
  const pii = getUserPii();
  sv('modal-username', u.username);
  sv('modal-fullname', getUserFullName());
  sv('modal-dob', pii.dob||'');
  syncDobSelectFromHidden('modal');
  sv('modal-email', pii.email||'');
  sv('p_taxref', pii.taxRef||gs('p_taxref')||'');
  $('modal-session-username').textContent = '@' + u.username;
  // V8.4 B: Age display removed from profile; age is auto-calculated internally for tax logic.
  // Apply income-type-dependent visibility (employer, self-emp subs, provisional auto-status)
  if(typeof onIncomeTypeChange === 'function') onIncomeTypeChange();
  if(typeof onMedicalAidToggle === 'function') onMedicalAidToggle();
  openModal('modal-profile');
  /* V8.6 D1 + D2: enable auto-save on every Profile input */
  if (typeof wireProfileAutoSave === 'function') wireProfileAutoSave();
  /* V8.75 3a-e: reflect current deduction state in the Profile questions */
  if (typeof initProfileDeductionQs === 'function') initProfileDeductionQs();
  if (typeof renderTaxYearCard === 'function') renderTaxYearCard();
}

/* BAK-1 (§L.9): Backup & Export's own open handler, now that it is a
   top-level drawer item with its own modal rather than a section at the
   bottom of Profile. Same dynamic-content refresh openProfileModal() used
   to run for this section (status card, offline banner, local backup
   status) — moved here rather than left behind, since none of it applies
   inside Profile any more. modal-session-username needs no handling here:
   it is set once, session-wide, right after login/unlock — long before the
   drawer becomes reachable — so it is already correct by the time this
   modal can be opened. */
export function openBackupModal() {
  renderLocalBackupStatus();
  const dsResult = $('ds-result'); if (dsResult) dsResult.classList.add('u-hidden');
  _renderDsStatusCard();
  _renderDsOfflineBanner();
  refreshCloudBackupRow();   // QR10a.6 — Row 2; stays hidden while the kill-switch is off
  openModal('modal-backup');
}

/* Renders the "local backup snapshot" line next to the manual export
   buttons (see writeLocalBackupSnapshot()). Reads the snapshot file's own
   mtime — async, off the Filesystem plugin — rather than a separately
   persisted timestamp. Silently does nothing on web/test builds (no
   Capacitor) or before any snapshot has been written yet. */
export function renderLocalBackupStatus() {
  const el = $('local-backup-status'); if (!el) return;
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) { el.textContent = ''; return; }
  el.textContent = 'Checking local backup status…';
  getLastLocalBackupAt().then(when => {
    if (!when) { el.innerHTML = '<i class="material-symbols-outlined msi-history"></i> No local backup snapshot yet — one is written automatically when the app locks.'; return; }
    const mins = Math.round((Date.now() - when.getTime()) / 60000);
    const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins/60)} hr ago` : `${Math.round(mins/1440)} day(s) ago`;
    /* OD-41/6.2: dropped the "Android may sync this to your Google account
       automatically" line — an OS-backup reference the app cannot verify or
       control, sitting right next to the one status this card CAN speak to
       honestly (the local snapshot itself). */
    el.innerHTML = `<i class="material-symbols-outlined msi-history"></i> Local backup snapshot: ${rel} — on this device only.`;
  });
}

/* ── Data safety: status card, result panel, offline banner ──
   (design handoff 05-data-safety.md). */

/* §1: status card, always visible — storage pressure is shown continuously,
   not only once a write has already failed. Uses the Storage API where the
   platform has it; degrades to the plain "current" state where it doesn't
   (the API is unavailable in some WebViews), which is still strictly better
   than the old "say nothing until it breaks" behaviour. */
/* BAK-6/OD-41 (§L.9), scoped by owner decision 6.2: fix the honesty bug —
   this card was titled "Auto backup current" next to a cloud icon,
   unconditionally, no matter what had or hadn't happened. What it actually
   showed (getLastLocalBackupAt()) is a LOCAL file's mtime, an automatic
   on-device snapshot, not a cloud backup — nothing was fabricated, but the
   label claimed a guarantee (off-device safety) the app cannot make.
   Row 1 is now honest and conditional: the last MANUAL export (JSON/CSV via
   _recordManualExport()), the one action that actually gets a copy off this
   device. "Populate Row 2 with real Google Drive status once app-managed
   Drive backup ships" (6.2) is deferred — that's the cloud-state redesign,
   not this relabel; see docs/product/BACKUP-DRIVE-PLAN-2026-09.md for the
   deferred feature's implementation plan. */
export async function _renderDsStatusCard() {
  const card = $('ds-status-card'); if (!card) return;
  if (card.dataset.failed === '1') return;  // a real write failure wins until Retry
  const icon = $('ds-status-icon'), title = $('ds-status-title'), sub = $('ds-status-sub'), fill = $('ds-storage-meter-fill');
  card.dataset.state = 'ok';
  const lastExportRaw = APP.user ? localStorage.getItem(SK.lastExport(APP.user)) : null;
  const lastExport = lastExportRaw ? Number(lastExportRaw) : null;
  if (icon) icon.className = 'material-symbols-outlined ' + (lastExport ? 'msi-check-circle' : 'msi-info');
  if (title) title.textContent = lastExport
    ? `Last manual export: ${new Date(lastExport).toLocaleString()}`
    : 'Never — export a backup';
  /* Independent async reads — run concurrently rather than one blocking the
     other (the storage estimate and the local snapshot mtime never depend
     on each other's result). */
  const estimateP = (navigator.storage && navigator.storage.estimate)
    ? navigator.storage.estimate().catch(() => null)  // unsupported/denied — meter just stays at 0
    : Promise.resolve(null);
  const [est, when] = await Promise.all([estimateP, getLastLocalBackupAt()]);
  const pct = (est && est.quota) ? Math.min(100, Math.round((est.usage || 0) / est.quota * 100)) : 0;
  if (fill) fill.style.width = pct + '%';
  if (sub) {
    const users = getUsers();
    const profCount = users.length;
    const ty = typeof getActiveTaxYear === 'function' ? (getActiveTaxYear().label || '') : '';
    const snapPart = when ? `local snapshot ${new Date(when).toLocaleString()}` : 'no local snapshot yet';
    sub.textContent = `${snapPart} · ${profCount} profile${profCount === 1 ? '' : 's'}${ty ? ' · ' + ty : ''}`;
  }
}
/* §6: storage-full becomes a persistent card, red, with Retry — never just
   "storage is full". The retry button re-attempts the local snapshot write,
   which is representative of the write path that just failed. */
export function _setDsStatusFailed() {
  const card = $('ds-status-card'); if (!card) return;
  card.dataset.failed = '1';
  card.dataset.state = 'fail';
  const icon = $('ds-status-icon'), title = $('ds-status-title'), sub = $('ds-status-sub'), fill = $('ds-storage-meter-fill'), retry = $('ds-status-retry');
  if (icon) icon.className = 'material-symbols-outlined msi-sd-card-alert';
  if (title) title.textContent = 'Device storage is full';
  if (sub) sub.textContent = 'Your figures are safe in memory but could not be written. Remove old documents or an unused profile, then tap Retry — do not close the app first.';
  if (fill) fill.style.width = '99%';
  if (retry) retry.classList.remove('u-hidden');
}
export function retryLocalBackupSnapshot() {
  const card = $('ds-status-card');
  if (card) { card.dataset.failed = '0'; }
  const retry = $('ds-status-retry'); if (retry) retry.classList.add('u-hidden');
  try { debounceSave(); } catch (e) { /* no-op if nothing pending */ }
  _renderDsStatusCard();
}

/* §7: offline is a feature of this product, never styled as a failure. */
export function _renderDsOfflineBanner() {
  const el = $('ds-offline-banner'); if (!el) return;
  el.classList.toggle('u-hidden', navigator.onLine !== false);
}
export function _wireDsOfflineBanner() {
  window.addEventListener('online', _renderDsOfflineBanner);
  window.addEventListener('offline', _renderDsOfflineBanner);
  _renderDsOfflineBanner();
}

/* §0: shared result panel for every backup/export/import outcome that used
   to report through a toast and outlive its 3.4s lifespan — "a warning
   that outlives the moment gets a surface, not a toast." kind is one of
   'success' (mint) | 'amber' | 'emerald' | 'error' (red). */
export function _showBackupResult(kind, icon, title, sub) {
  const el = $('ds-result'); if (!el) return;
  el.dataset.kind = kind;
  const icoEl = $('ds-result-icon'); if (icoEl) icoEl.className = iconClassFor(icon);
  const titleEl = $('ds-result-title'); if (titleEl) titleEl.textContent = title;
  const subEl = $('ds-result-sub'); if (subEl) subEl.textContent = sub || '';
  el.classList.remove('u-hidden');
}

/* V8.6 D1 + D2: auto-save Profile inputs + single Exit button
   Pattern: every Profile input change saves immediately via debounceSave + users-record sync.
   Exit button simply closes the modal — no separate Save action. */
export function autoSaveProfile() {
  const nm  = (gs('modal-fullname')||'').trim();
  const dob = gs('modal-dob');
  const em  = (gs('modal-email')||'').trim();
  /* B5: email dropped from the required set — it is hidden and stores ''.
     Name and DOB still gate the write (DOB drives age-based rebates and the
     medical credit, so a blank there is a tax-correctness problem). */
  if (nm && dob) {
    /* Merge over what is already sealed: the Profile form knows dob/email/taxRef
       only, and a replace would silently drop the bound driveAccount (QR10a). */
    const piiPlain = Object.assign({}, AUTH.pii, { dob, email: em, taxRef: gs('p_taxref'), fullName: nm });
    AUTH.pii = piiPlain;
    // Registry write is async (PII is AES-sealed); serialize on the write chain.
    _enqueueWrite(async () => {
      if (!AUTH.pinKey) return;   // locked mid-edit — next unlock re-syncs
      const users = getUsers();
      const idx = users.findIndex(x => x.username === APP.user);
      if (idx < 0) return;
      await _sealUserPii(users[idx], piiPlain);   // fullName is sealed with the rest (BACKLOG 71)
      try { saveUsers(users); } catch(e) { /* handled by saveUsers internally */ }
    });
    // B3.1/D-6: the header avatar is gone with the Profile pill — refresh the
    // drawer's own identity avatar instead, so an edited name shows there.
    _renderDrawerIdentity();
  }
  debounceSave();
}

/* QD-05 / QX-DRV-3: bind (or rebind) this profile's cloud backup to a Google
   account. The e-mail is sealed into the registry record with the rest of the
   PII (hard rule 8) — never written plain anywhere. Rejects if the vault is
   locked; resolves once the sealed record is saved. */
export async function _bindDriveAccount(email) {
  if (!APP.user || !AUTH.pinKey) throw new Error('locked');
  AUTH.pii = Object.assign({}, AUTH.pii, { driveAccount: String(email || '') });
  const plain = AUTH.pii;
  let failed = null;
  await _enqueueWrite(async () => {
    try {
      if (!AUTH.pinKey) throw new Error('locked');
      const users = getUsers();
      const idx = users.findIndex(x => x.username === APP.user);
      if (idx < 0) throw new Error('no profile');
      await _sealUserPii(users[idx], plain);
      saveUsers(users);
    } catch (e) { failed = e; }
  });
  if (failed) throw failed;
}

export function exitProfile() {
  // Final flush before exit
  autoSaveProfile();
  closeModal('modal-profile');
  if (typeof renderAll === 'function') renderAll();
}

/* Wire auto-save to all Profile modal inputs on first open */
export function wireProfileAutoSave() {
  const modal = document.getElementById('modal-profile');
  if (!modal || modal._v86Wired) return;
  modal._v86Wired = true;
  modal.querySelectorAll('input,select,textarea').forEach(el => {
    if (el.id === 'modal-username') return; // readonly
    el.addEventListener('input', autoSaveProfile);
    el.addEventListener('change', autoSaveProfile);
  });
}

export function openDeleteAccountModal() {
  closeModal('modal-profile');
  let modal = document.getElementById('delete-account-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'delete-account-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <div class="modal-title"><i class="material-symbols-outlined msi-person-remove" style="color:var(--er)"></i> Delete Account</div>
          <button class="modal-close" onclick="closeDeleteAccountModal()">×</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--er);font-weight:600">Permanently deletes your account and all tax data on this device.</p>
          <p style="margin-top:8px;color:var(--tx2);font-size:var(--fs-sm)">This cannot be undone. Your profile, income items, deductions, and calculations will be erased.</p>
          <label style="display:block;margin-top:14px;font-weight:600">Type <span style="color:var(--er)">DELETE</span> to confirm:</label>
          <input type="text" class="modal-confirm-input" id="delete-account-input" autocomplete="off" oninput="onDeleteAccountInput()">
          <div id="delete-account-cloud"></div>
          <p id="delete-account-error" class="note warning u-hidden" role="alert" aria-live="polite" style="margin-top:10px"></p>
          <div class="modal-actions" style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="closeDeleteAccountModal()">Cancel</button>
            <button class="btn btn-danger" id="delete-account-confirm-btn" disabled onclick="deleteAccount()">Delete Account</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('delete-account-input').value = '';
  document.getElementById('delete-account-confirm-btn').disabled = true;
  const _delErr = document.getElementById('delete-account-error'); if (_delErr) _delErr.classList.add('u-hidden');
  /* QX-DRV-4: when cloud backup has been on, offer to delete the profile's
     Drive copies too. Ticked by default here — the FAQ promises Delete Account
     "removes everything". Renders nothing while the kill-switch is off. */
  renderCloudDeleteOffer('delete-account-cloud', 'delete-account-cloud-cb', true);
  /* ONB-4 (design-system-audit-2026-09): same fix as openResetModal() — this
     hand-rolled style.display toggle never added the .open class main.css
     requires for real visibility/interactivity, and never got the focus trap
     hard rule 11 requires. Route through the shared lifecycle instead. */
  openModal('delete-account-modal');
}

export function closeDeleteAccountModal() {
  closeModal('delete-account-modal');
}

export function onDeleteAccountInput() {
  const inp = document.getElementById('delete-account-input');
  const btn = document.getElementById('delete-account-confirm-btn');
  const match = inp.value.trim().toUpperCase() === 'DELETE';
  inp.classList.toggle('match', match);
  btn.disabled = !match;
}

export async function deleteAccount() {
  /* QX-DRV-4: the cloud copies are deleted FIRST, while the account binding and
     the profile key are still readable — and only if that worked, or the user
     un-ticked the offer, does the local wipe go ahead. A failure is said out
     loud (never a silent "deleted") and leaves the account untouched. */
  const delBtn = document.getElementById('delete-account-confirm-btn');
  if (delBtn) delBtn.disabled = true;   // a slow network must not allow a second tap to run this twice
  const cloud = await cloudBackupDeleteRequested('delete-account-cloud-cb');
  if (!cloud.ok) {
    const err = document.getElementById('delete-account-error');
    if (err) { err.textContent = cloud.message; err.classList.remove('u-hidden'); }
    if (delBtn) delBtn.disabled = false;
    return;
  }
  closeDeleteAccountModal();
  const username = APP.user;
  /* BACKLOG 71: the shared wipe — its storage keys go synchronously inside
     this call; the Android files (snapshot, export copies) follow. */
  const files = _purgeLocalProfile(username);
  // The registry entry and encrypted blob for this account are now gone.
  // doLogout() awaits persistData() before dropping the key; leaving APP.user
  // set would make that write re-create an orphaned encrypted blob for the
  // just-deleted user (no registry entry references it). Clear the session
  // identity first so persistData() early-returns on its `!APP.user` guard.
  APP.user = null;
  /* doLogout() reloads the page once its own (bounded) work is done; the file
     deletes are a few local calls and are awaited first, so the reload never
     cuts them off. */
  await files;
  doLogout();
}

export function toggleProfileGuidance(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  const trigger = el.querySelector('.profile-guidance-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', el.classList.contains('open') ? 'true' : 'false');
}

/* ── PROFILE EVENT HANDLERS ── */
export function onTaxYearChange() { persistData(); if(typeof renderAll === 'function') renderAll(); }
export function onProfileDobChange() {
  // V8.4 B: Age display removed from profile (auto-calculated from DOB internally).
  // No longer setting p_age_display.
  debounceSave();
}
export function updateCalc() { debounceSave(); }

/* B0 Simplification (A1 decision): ⓘ buttons now use a press-and-hold bubble
   for short tips (≤28 words, no data-tip-long), and the bottom help sheet for
   long tips and for all keyboard/AT activation.
   This supersedes the v8.23/H7 "sheet is the one ⓘ pattern app-wide" exemplar —
   that reversal is deliberate and owner-directed (A1, 00-DECISION-LOG.md). */

function _showPop(anchor, html){
  var title = 'About';
  var m = /^<strong>(.*?)<\/strong>/.exec(html);
  if (m) { title = m[1]; html = html.slice(m[0].length).replace(/^(<br\s*\/?>)+/, ''); }
  var t = document.getElementById('help-sheet-title');
  var b = document.getElementById('help-sheet-body');
  if (!t || !b) return;
  t.textContent = title.replace(/<[^>]*>/g, '');
  b.innerHTML = html;
  openModal('modal-help');
}
export function showObPop(e, title, desc){
  e.preventDefault(); e.stopPropagation();
  _showPop(e.currentTarget, '<strong>' + title + '</strong>' + desc);
}

/* Every ⓘ affordance in the app goes through ONE engine. `.info-btn` is the
   bordered dot; `.u-hint-help` is the inline ⓘ glyph inside form labels and
   onboarding questions; `.tile-tip` is the corner dot on an income bucket
   tile. The latter two used to carry a `title` attribute instead of a tip —
   `title` is a hover affordance, so on the Android WebView this ships in they
   did nothing at all when tapped. They now carry data-tip like everything
   else, and this selector is what makes one engine serve all three. */
export const TIP_TRIGGER_SEL = '.info-btn, .u-hint-help[data-tip], .tile-tip[data-tip]';
function _tipTrigger(target) {
  return target && target.closest ? target.closest(TIP_TRIGGER_SEL) : null;
}

/* B0: hold-bubble engine. _showBubble positions #tip-bubble above the anchor
   (flipping below when space is tight). _hideBubble hides it. */
function _tipWordCount(text) {
  return text.trim().split(/\s+/).length;
}
function _isBubbleTip(el) {
  if (el.hasAttribute('data-tip-long')) return false;
  var tip = el.getAttribute('data-tip') || '';
  /* Spec P1: "bubble content is plain text only — anything that needs
     structure is a sheet tip by definition". Classifying on word count alone
     let the provenance breakdowns through (<strong>title</strong><br>row<br>
     row): the bubble renders textContent, so every <br> vanished with no
     separator and the rows ran into one unreadable line — "Refund / amount
     owingTax payable for the year: R126,536Less PAYE already paid: …". Markup
     means structure, and structure means the sheet. */
  if (/<[a-z/!][^>]*>/i.test(tip)) return false;
  return _tipWordCount(tip) <= 28;
}
var _bubbleAnchor = null;    /* the ⓘ the visible bubble belongs to */
/* The ⓘ whose press the pointer engine has already served. A press produces
   pointerdown → pointerup → click, and showInfoTip is on that click: without
   this, the click after a press re-opened the bubble the press had just
   toggled shut. Cleared once the click it belongs to has been declined. */
var _pointerHandledTip = null;
/* QA 2026-08 (owner): the bubble is now TAP-TO-TOGGLE and persistent.

   It used to be a press-and-hold affordance that lived out a fixed 1.8s dwell
   after release. Two owner-reported symptoms came from that one design:

     "ⓘ tooltip is not functioning" — a tap put readable text on screen for
     under two seconds and then took it away, which on a form the user is
     still reading is indistinguishable from a control that did nothing.

     "remove the vibration after a second or two" — press-and-hold IS the
     Android long-press gesture, so the platform fired its selection haptic
     underneath the app's own tooltip. Nothing in the app was vibrating; the
     gesture the tooltip asked for was.

   A tap now shows the bubble and it STAYS until the user dismisses it —
   tapping the same ⓘ again, tapping anywhere else, scrolling, pressing
   Escape, or opening a different tip. There is no timer, so there is no
   window in which the bubble disappears out from under someone, and no
   reason for a user to hold a control they only need to tap. */
function _showBubble(anchor) {
  var tip = anchor.getAttribute('data-tip');
  if (!tip) return;
  var bubble = document.getElementById('tip-bubble');
  if (!bubble) return;
  /* Plain text by construction — _isBubbleTip sends anything with markup to
     the sheet, so there is nothing to strip here. */
  bubble.textContent = tip;
  bubble.removeAttribute('hidden');
  bubble.classList.remove('bubble-above', 'bubble-below');
  var r = anchor.getBoundingClientRect();
  var bw = bubble.offsetWidth || 200;
  var bh = bubble.offsetHeight || 40;
  var spaceAbove = r.top;
  var above = spaceAbove >= bh + 12;
  var left = Math.max(8, Math.min(r.left + r.width / 2 - bw / 2, window.innerWidth - bw - 8));
  var top = above ? r.top - bh - 10 : r.bottom + 10;
  bubble.style.left = left + 'px';
  bubble.style.top = top + 'px';
  bubble.classList.add(above ? 'bubble-above' : 'bubble-below');
  _bubbleAnchor = anchor;
}
function _hideBubble() {
  var bubble = document.getElementById('tip-bubble');
  if (bubble) bubble.setAttribute('hidden', '');
  _bubbleAnchor = null;
}
function _bubbleVisible() { return !!_bubbleAnchor; }

/* Wire the tap-bubble on the document (capture phase so we see every ⓘ). */
export function initTipBubble() {
  document.addEventListener('pointerdown', function(e) {
    var btn = _tipTrigger(e.target);
    _pointerHandledTip = null;
    if (!btn) { _hideBubble(); return; }
    if (!_isBubbleTip(btn)) return;  /* sheet tip — let the click through */
    e.preventDefault();
    _pointerHandledTip = btn;
    /* Tap-to-toggle: the same ⓘ closes the bubble it opened, a different one
       replaces it. Either way the press is fully served here. */
    if (_bubbleVisible() && _bubbleAnchor === btn) _hideBubble();
    else _showBubble(btn);
  }, true);
  /* No pointerup handler: a release must NOT dismiss the bubble — persistence
     is the whole point of the QA 2026-08 change. pointercancel still does,
     because a cancelled pointer means the gesture never happened. */
  document.addEventListener('pointercancel', _hideBubble, true);
  document.addEventListener('scroll',        _hideBubble, true);
  /* Escape closes the bubble. The sheet is a real modal and owns its own
     Escape handling; the bubble is not, so it needs this. Not capture-phase:
     a modal that wants Escape gets it first. */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _bubbleVisible()) _hideBubble();
  });
  /* Android WebView fires its text-selection haptic on long-press — the
     "vibration after a second or two". The bubble no longer asks anyone to
     hold, but a held ⓘ would still buzz, so suppress the gesture the platform
     is responding to. CSS carries -webkit-user-select/-webkit-touch-callout;
     this covers the context-menu path those two do not. */
  document.addEventListener('contextmenu', function(e) {
    if (_tipTrigger(e.target)) e.preventDefault();
  }, true);
  /* Keyboard activation is NOT wired here — it is a pointer-free path and
     lives in the one keydown listener below, so a keypress cannot end up
     served by two handlers (which would put a bubble behind the sheet). */
}

/* showInfoTip: the click path into the tip engine — the capture-phase click
   listener below, and the wrapping stat cards whose whole surface delegates
   to the ⓘ they contain. A sheet tip opens the sheet. A bubble tip toggles the
   same persistent bubble a tap on the ⓘ itself would: this used to return
   early on the assumption that the pointer engine had already shown one, which
   was only true when the press landed on the 15px dot — tapping the card
   around it produced nothing at all. */
export function showInfoTip(el){
  var tip = el && el.getAttribute('data-tip');
  if (!tip) return;
  if (!_isBubbleTip(el)) { _showPop(el, tip); return; }
  /* The press that produced this click already went through the pointer
     engine — showing or toggling shut. Either way the interaction is spent. */
  if (_pointerHandledTip === el) { _pointerHandledTip = null; return; }
  if (_bubbleVisible() && _bubbleAnchor === el) _hideBubble();
  else _showBubble(el);
}

/* Batch B/B-2 (UX #1/#5): provenance popovers. Build a live "where this figure
   came from" breakdown and an inline .info-btn that surfaces it through the
   shared #ob-pop popover (showInfoTip). rows = [[label, value], ...]; falsy
   values are dropped. Values go through fmt() so they carry no quotes, and
   labels are plain ASCII — both safe inside the data-tip HTML attribute. */
export function provTip(title, rows, totalLabel, totalVal) {
  var h = '<strong>' + title + '</strong>';
  rows.forEach(function (x) { if (x[1]) h += '<br>' + x[0] + ': ' + fmt(x[1]); });
  if (totalVal != null) h += '<br><strong>' + (totalLabel || 'Total') + ': ' + fmt(totalVal) + '</strong>';
  return h;
}
export function provBtn(tip) {
  return ' <span class="info-btn" data-tip="' + tip + '" tabindex="0" role="button" aria-label="Where this figure comes from"><i class="material-symbols-outlined msi-info"></i></span>';
}

/* B6.3/B7.5/B9.3 (D-15/SC-3) — the one breakdown-donut component every
   expandable card's circle graph builds from: inline SVG stroke-dasharray
   segments, matching _mockups/hero-breakdown-prototype.html and the
   dashboard section of ui-polish-2026-09.html (neither uses Chart.js,
   despite 03-IMPLEMENTATION.md B6.3 saying it is vendored — the approved
   prototypes settled on plain SVG, so callers follow the prototype rather
   than the doc). segments = [{label, val, color}], values already computed
   by calcFullTax() — this only turns numbers into arc lengths, no tax math. */
export function donutHtml(segments, opts) {
  opts = opts || {};
  var size = opts.size || 70, r = 15.9, cx = 21, cy = 21, sw = opts.strokeWidth || (opts.compact ? 8 : 7);
  var live = segments.filter(function(s){ return (s.val || 0) > 0; });
  var sum = live.reduce(function(s, seg){ return s + seg.val; }, 0);
  /* `whole` (compact only): the figure the slices are a part of, when that is
     more than their own sum — the unfilled remainder shows as the track. A
     part larger than its whole is not a share of it, so nothing is drawn. */
  var total = opts.compact && opts.whole != null ? opts.whole : sum;
  if (total <= 0 || sum > total + 0.5) return '';
  /* A sliver of surface between adjacent slices so two neighbouring hues
     never fuse; a slice smaller than the gap keeps half its own length. */
  var C = 2 * Math.PI * r, offset = 0, gap = live.length > 1 ? 0.8 : 0;
  var shareTxt = function(v) { var p = v / total * 100; return (p > 0 && p < 1 ? '<1' : Math.round(p)) + '%'; };
  var circles = live.map(function(s, i) {
    var dash = (s.val / total) * C;
    var drawn = Math.max(dash - gap, dash / 2);
    var circle = '<circle ' + (opts.compact ? '' : 'class="donut-seg" data-i="' + i + '" ') + 'cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + s.color
      + '" stroke-width="' + sw + '" stroke-dasharray="' + drawn.toFixed(2) + ' ' + (C - drawn).toFixed(2)
      + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"></circle>';
    offset += dash;
    return circle;
  }).join('');
  /* HERO-2 (_mockups/hero-breakdown-prototype.html): the ring in a small
     card's collapsed head. The same arcs with a track behind them and nothing
     else — no legend, no slice buttons, no live region — because it sits
     inside a <summary>, where a second tap target would open the card and pin
     a slice in one press. It is decoration for a figure the card states in
     text and breaks down in its rows, hence aria-hidden. */
  if (opts.compact) {
    return '<svg class="mini-ring" viewBox="0 0 42 42" aria-hidden="true" data-ring-whole="' + total + '" data-ring-sum="' + sum + '">'
      + '<circle class="mini-ring-track" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke-width="' + sw + '"></circle>'
      + circles + '</svg>';
  }
  var legend = live.map(function(s, i) {
    return '<button type="button" class="donut-leg-item" data-i="' + i + '" data-share="' + shareTxt(s.val) + '" aria-pressed="false">'
      + '<i style="background:' + s.color + '"></i><span>' + esc(s.label) + ' · ' + fmt(s.val) + '</span></button>';
  }).join('');
  return '<div class="donut-wrap" data-donut-total="' + total + '">'
    + '<div class="donut-fig" style="width:' + size + 'px;height:' + size + 'px"><svg class="donut-svg" width="' + size + '" height="' + size
    + '" viewBox="0 0 42 42" aria-hidden="true">' + circles + '</svg><span class="donut-center" aria-hidden="true"></span></div>'
    + '<div class="donut-legend">' + legend + '</div><span class="sr-only" aria-live="polite"></span></div>';
}

/* One slice at a time is "active": its legend row is pressed, the other
   slices dim, and the ring's hole states its share of the total. Mouse
   hover previews; a tap or Enter pins it; tapping it again clears. */
function _donutSet(wrap, i, pinned) {
  var segs = wrap.querySelectorAll('.donut-seg'), legs = wrap.querySelectorAll('.donut-leg-item');
  var centre = wrap.querySelector('.donut-center'), live = wrap.querySelector('[aria-live]');
  segs.forEach(function(el){ el.classList.toggle('is-active', i != null && el.dataset.i === String(i)); });
  legs.forEach(function(el){
    var on = i != null && el.dataset.i === String(i);
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-pressed', on && pinned ? 'true' : 'false');
  });
  wrap.classList.toggle('has-active', i != null);
  if (pinned !== undefined) wrap.dataset.pinned = (i != null && pinned) ? String(i) : '';
  var leg = i != null ? wrap.querySelector('.donut-leg-item[data-i="' + i + '"]') : null;
  if (centre) centre.textContent = leg ? leg.dataset.share : '';
  if (live && pinned) live.textContent = leg ? leg.textContent + ', ' + leg.dataset.share + ' of the total' : '';
}
function _donutTarget(e) {
  var t = e.target && e.target.closest ? e.target.closest('.donut-wrap [data-i]') : null;
  return t ? { el: t, wrap: t.closest('.donut-wrap') } : null;
}
function _donutRestore(wrap) {
  var p = wrap.dataset.pinned;
  _donutSet(wrap, p ? p : null);
}
document.addEventListener('click', function(e){
  var t = _donutTarget(e); if (!t) return;
  var i = t.el.dataset.i;
  _donutSet(t.wrap, t.wrap.dataset.pinned === i ? null : i, true);
});
document.addEventListener('pointerover', function(e){
  if (e.pointerType !== 'mouse') return;
  var t = _donutTarget(e); if (t) _donutSet(t.wrap, t.el.dataset.i);
});
document.addEventListener('pointerout', function(e){
  if (e.pointerType !== 'mouse') return;
  var t = _donutTarget(e); if (!t) return;
  if (!e.relatedTarget || !t.wrap.contains(e.relatedTarget) || !e.relatedTarget.closest('[data-i]')) _donutRestore(t.wrap);
});
document.addEventListener('focusin', function(e){
  var t = _donutTarget(e); if (t) _donutSet(t.wrap, t.el.dataset.i);
});
document.addEventListener('focusout', function(e){
  var t = _donutTarget(e); if (!t) return;
  if (!e.relatedTarget || !t.wrap.contains(e.relatedTarget)) _donutRestore(t.wrap);
});

/* Proportional stacked bar: segments share one track in proportion to
   their values (flex-grow on a zero basis, so the 2px gaps come out of the
   track, not the proportions). `wholeVal` is stamped for casting checks;
   the legend carries every figure as text, so colour is never alone. */
export function stackBarHtml(wholeVal, segments) {
  const live = segments.filter(function(s){ return (s.val || 0) > 0; });
  if (!live.length) return '';
  const track = live.map(function(s) {
    return '<span class="compbar-seg" data-val="' + s.val + '" style="flex:' + s.val + ' 1 0;background:' + s.color + '"></span>';
  }).join('');
  const legend = live.map(function(s) {
    return '<span class="donut-leg-item"><i style="background:' + s.color + '"></i>' + esc(s.label) + ' · ' + fmt(s.val) + '</span>';
  }).join('');
  return '<div class="dhero-compbar" data-whole="' + wholeVal + '"><div class="compbar-track" aria-hidden="true">' + track + '</div></div>'
    + '<div class="donut-legend compbar-legend">' + legend + '</div>';
}

/* Cap meter: how much of a statutory limit is used. Any amount over the
   cap is drawn past the cap mark as an amber hatch — amber because an
   over-cap amount carries forward and becomes a prior-year balance.
   opts: { used, cap, over, unit, color, label, remainLabel, overLabel } */
export function capMeterHtml(opts) {
  const cap = Math.max(0, opts.cap || 0);
  const used = Math.max(0, Math.min(opts.used || 0, cap));
  const over = Math.max(0, opts.over || 0);
  if (cap <= 0 && over <= 0) return '';
  const domain = Math.max(cap, used + over) || 1;
  const usedPct = used / domain * 100, overPct = over / domain * 100, capPct = cap / domain * 100;
  const share = cap > 0 ? Math.round(used / cap * 100) : 0;
  const usedTxt = fmt(used) + ' of ' + fmt(cap) + ' ' + (opts.unit || 'used');
  const tail = over > 0
    ? fmt(over) + ' ' + (opts.overLabel || 'over the limit')
    : fmt(cap - used) + ' ' + (opts.remainLabel || 'unused');
  return '<div class="cap-meter' + (over > 0 ? ' is-over' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="' + Math.round(cap)
    + '" aria-valuenow="' + Math.round(used) + '" aria-valuetext="' + esc(usedTxt + ', ' + tail) + '"'
    + (opts.label ? ' aria-label="' + esc(opts.label) + '"' : '') + '>'
    + '<div class="cap-meter-track" aria-hidden="true">'
    + '<span class="cap-meter-fill" style="width:' + usedPct.toFixed(2) + '%;background:' + (opts.color || 'var(--violet)') + '"></span>'
    + (over > 0 ? '<span class="cap-meter-over" style="left:' + capPct.toFixed(2) + '%;width:' + overPct.toFixed(2) + '%"></span>'
               + '<span class="cap-meter-mark" style="left:' + capPct.toFixed(2) + '%"></span>' : '')
    + '</div>'
    + '<div class="cap-meter-text"><span>' + usedTxt + '</span><span class="cap-meter-pct">' + share + '%</span></div>'
    + '<div class="cap-meter-sub' + (over > 0 ? ' is-over' : '') + '">' + tail + '</div>'
    + '</div>';
}

/* UI-CARD-1 (BACKLOG 28, _mockups/tax-cards.html option B): the one card.
   The Dashboard's .mini-card — lip in the card's colour, label over figure,
   an optional ring on the figure's line, a chevron — built in one place so
   the Dashboard and the Tax screens cannot drift. s = { lbl, key, c, val
   (formatted), raw, ring, body (rows), chart, nav (onclick JS), navLabel,
   rate — the figure is a percentage, so the rand count-up skips it }.
   opts: { group — cards sharing it open one at a time and remember which is
   open (APP._miniCardOpen[group]); chart — show s.chart; split — chart
   beside the rows (they stack when the card is narrow, CSS) }. A card with
   no body has nothing to break down, so it renders without a chevron. */
export function miniCardHtml(s, opts) {
  opts = opts || {};
  var raw = s.raw != null ? s.raw : 0;
  var style = s.c ? ' style="--card-c:' + s.c + '"' : '';
  var head = '<div class="mini-sum-main"><div class="mini-name">' + esc(s.lbl) + '</div><div class="mini-fig">' + (s.ring || '')
    + '<div class="mini-val"' + (s.key && !s.rate ? ' data-count="' + raw + '" data-count-key="' + esc(s.key) + '"' : '') + '>' + s.val + '</div></div></div>';
  if (!s.body) return '<div class="mini-card is-static" data-card="' + esc(s.lbl) + '" data-raw="' + raw + '"' + style + '><div class="mini-head">' + head + '</div></div>';
  var chart = opts.chart && s.chart ? s.chart : '';
  var inner = chart && opts.split
    ? '<div class="mini-split">' + chart + '<div class="mini-lines">' + s.body + '</div></div>'
    : s.body + chart;
  var link = s.nav ? '<div class="mini-row"><a href="javascript:void(0)" onclick="event.stopPropagation();' + s.nav + '">' + esc(s.navLabel || 'Open') + ' →</a></div>' : '';
  var open = opts.group && APP._miniCardOpen && APP._miniCardOpen[opts.group] === s.key;
  return '<details class="mini-card" data-card="' + esc(s.lbl) + '" data-raw="' + raw + '"'
    + (opts.group ? ' data-group="' + esc(opts.group) + '" data-key="' + esc(s.key) + '" ontoggle="onMiniCardToggle(this)"' : '')
    + (open ? ' open' : '') + style + '>'
    + '<summary>' + head + '<i class="material-symbols-outlined msi-expand-more mini-chev"></i></summary>'
    + '<div class="mini-body">' + inner + link + '</div></details>';
}

/* One open card per group (the Dashboard's rule), remembered across the
   re-render every recalculation does. UI state only — no figures in APP. */
export function onMiniCardToggle(el) {
  var g = el.dataset.group; if (!g) return;
  APP._miniCardOpen = APP._miniCardOpen || {};
  if (el.open) {
    APP._miniCardOpen[g] = el.dataset.key;
    document.querySelectorAll('details.mini-card[data-group="' + g + '"][open]').forEach(function(o){ if (o !== el) o.removeAttribute('open'); });
  } else if (APP._miniCardOpen[g] === el.dataset.key) {
    APP._miniCardOpen[g] = '';
  }
}

/* Bars on one shared scale, the label and amount above each bar (so they
   read in both themes and at any text size). items = [{label, val, color,
   cap}] — cap draws a faint limit behind the bar. opts: { max (the scale;
   defaults to the largest value or cap), fmt (amount formatter), label,
   keepZero — draw a zero item as an empty track instead of dropping it }. */
export function barsHtml(items, opts) {
  opts = opts || {};
  var f = opts.fmt || fmt;
  var live = items.filter(function(it){ return it && (it.val > 0 || it.cap > 0 || (opts.keepZero && it.val === 0)); });
  if (!live.some(function(it){ return it.val > 0 || it.cap > 0; })) return '';
  var max = opts.max || Math.max.apply(null, live.map(function(it){ return Math.max(it.val || 0, it.cap || 0); }));
  if (!(max > 0)) return '';
  var pct = function(v){ return Math.max(0, Math.min(100, v / max * 100)).toFixed(2) + '%'; };
  return '<div class="bars" role="img" aria-label="' + esc((opts.label ? opts.label + ': ' : '') + live.map(function(it){ return it.label + ' ' + f(it.val) + (it.cap > 0 ? ' of ' + f(it.cap) : ''); }).join(', ')) + '">'
    + live.map(function(it){
        return '<div class="bar-item"><div class="bar-text"><span>' + esc(it.label) + '</span><span class="v">' + f(it.val || 0) + (it.cap > 0 ? ' of ' + f(it.cap) : '') + '</span></div>'
          + '<div class="bar-track" aria-hidden="true">' + (it.cap > 0 ? '<span class="bar-cap" style="width:' + pct(it.cap) + '"></span>' : '')
          + ((it.val || 0) > 0 ? '<span class="bar-fill" style="width:' + pct(it.val) + ';background:' + (it.color || 'var(--card-c,var(--navy))') + '"></span>' : '') + '</div></div>';
      }).join('') + '</div>';
}

/* The tax-year brackets as steps, rate as height, the bracket holding
   `taxable` filled, a mark where taxable income sits inside it. brackets are
   the year's own table (TAX_YEARS[..].brackets: {min, max, rate}). */
export function bracketLadderHtml(brackets, taxable) {
  if (!brackets || !brackets.length) return '';
  var top = brackets[brackets.length - 1].rate || 1, idx = 0;
  brackets.forEach(function(b, i){ if (taxable >= b.min) idx = i; });
  var cur = brackets[idx];
  var frac = cur.max ? Math.max(0, Math.min(1, (taxable - cur.min) / (cur.max - cur.min))) : 0;
  var rate = function(b){ return Math.round(b.rate * 100) + '%'; };
  return '<div class="ladder" role="img" aria-label="' + esc('Tax brackets from ' + rate(brackets[0]) + ' to ' + rate(brackets[brackets.length - 1]) + '; your taxable income is in the ' + rate(cur) + ' bracket') + '">'
    + brackets.map(function(b, i){
        return '<div class="ladder-step' + (i === idx ? ' is-yours' : '') + '"><div class="ladder-col"><div class="ladder-bar" style="height:' + (25 + b.rate / top * 75).toFixed(1) + '%">'
          + (i === idx && cur.max ? '<span class="ladder-mark" style="left:' + (frac * 100).toFixed(1) + '%"></span>' : '') + '</div></div>'
          + '<span class="ladder-rate">' + rate(b) + '</span></div>';
      }).join('') + '</div>';
}

/* Waterfall: a running total built step by step, one row per step, each
   bar drawn at its true position on one shared scale. steps =
   [{label, val, kind:'add'|'sub'|'total', color}] — 'total' draws the
   running total from zero. Values are already-computed engine figures; the
   running sum here is display geometry only. `ariaLabel` names the list. */
export function waterfallHtml(steps, ariaLabel) {
  let run = 0, hi = 0;
  const rows = steps.map(function(s) {
    const v = Math.max(0, s.val || 0);
    let from, to;
    if (s.kind === 'add') { from = run; to = run + v; run = to; }
    else if (s.kind === 'sub') { from = run - v; to = run; run = from; }
    else { from = 0; to = run; }
    hi = Math.max(hi, to);
    return { s: s, v: v, from: from, to: to };
  }).filter(function(x){ return x.v > 0 || x.s.kind === 'total'; });
  if (hi <= 0) return '';
  const body = rows.map(function(x) {
    const sign = x.s.kind === 'sub' ? '−' : x.s.kind === 'add' && x.from > 0 ? '+' : '';
    const amount = x.s.kind === 'total' ? x.to : x.v;
    return '<li class="wf-row wf-' + x.s.kind + '" data-kind="' + x.s.kind + '" data-val="' + amount + '">'
      + '<span class="wf-lbl">' + esc(x.s.label) + '</span><span class="wf-amt">' + sign + fmt(amount) + '</span>'
      + '<span class="wf-track" aria-hidden="true"><span class="wf-bar" style="left:' + (x.from / hi * 100).toFixed(2)
      + '%;width:' + Math.max(0.6, (x.to - x.from) / hi * 100).toFixed(2) + '%;background:' + x.s.color + '"></span></span></li>';
  }).join('');
  return '<ol class="waterfall" data-end="' + run + '" aria-label="' + esc(ariaLabel || '') + '">' + body + '</ol>';
}

/* v8.19: accordion toggle + count sync for Screen 2 accordions */
export function obAccToggle(id) {
  var el = document.getElementById(id); if(el) el.classList.toggle('open');
}
export function obAccSyncCounts() {
  /* G1: onboarding accordions now use name="income-type" (was "ob-income") */
  document.querySelectorAll('.ob-acc').forEach(function(acc){
    var n = acc.querySelectorAll('input[name="income-type"]:checked').length;
    var cnt = acc.querySelector('.ob-acc-count');
    if(cnt){ cnt.textContent = n; cnt.style.display = n > 0 ? '' : 'none'; }
    acc.classList.toggle('has-sel', n > 0);
  });
}
/* v8.19: sync .sel on ob-income tiles and ob-radio-item tiles after restore/load */
export function obSyncAllTiles() {
  document.querySelectorAll('.ob-acc .ob-tile, .ob-acc .ob-chip').forEach(function(el){
    var inp = el.querySelector('input'); if(inp) el.classList.toggle('sel', inp.checked);
  });
  document.querySelectorAll('.ob-radio-item').forEach(function(el){
    var inp = el.querySelector('input[type="radio"]'); if(inp) el.classList.toggle('sel', inp.checked);
  });
  obAccSyncCounts();
}
/* Global listener: sync counts + tiles on any income-type or onboarding radio change */
document.addEventListener('change', function(e){
  /* G1: onboarding tiles now use name="income-type"; scope to onboarding overlay */
  if(e.target.name === 'income-type' && e.target.closest && e.target.closest('#onboarding-overlay')) { obAccSyncCounts(); }
  if(e.target.closest && e.target.closest('.onboarding-screen')){
    var el = e.target.closest('.ob-radio-item'); if(el){ el.classList.add('sel'); }
    // clear siblings in the same radio group
    var grp = e.target.closest('.ob-radio-group');
    if(grp) grp.querySelectorAll('.ob-radio-item').forEach(function(r){
      var inp = r.querySelector('input[type="radio"]'); if(inp) r.classList.toggle('sel', inp.checked);
    });
  }
});
/* v8.23: an ⓘ opens its tip on tap. Capture phase + stop so tapping the ⓘ
   inside a clickable row/label/tile does not also activate that row. */
document.addEventListener('click', function(e){
  var info = _tipTrigger(e.target);
  if(info){ e.preventDefault(); e.stopPropagation(); showInfoTip(info); }
}, true);
/* Keyboard / AT: Enter or Space on a focused ⓘ always opens the SHEET,
   whatever the tip's class — a hold gesture cannot be expressed on a keyboard
   and a bubble that vanishes on a timer is unusable with a screen reader
   (spec P1). This is the only keydown path into the tip engine. */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter' && e.key !== ' ') return;
  var info = _tipTrigger(e.target);
  if(!info) return;
  var tip = info.getAttribute('data-tip');
  if(!tip) return;
  e.preventDefault();
  _hideBubble();
  _showPop(info, tip);
});
/* H7: .info-acc summaries open the same help sheet instead of expanding
   inline — one info surface app-wide. Capture phase blocks the native
   <details> toggle; content stays in the markup as the source of truth. */
function _openInfoAccSheet(sum){
  var det = sum.closest('details.info-acc');
  var body = det && det.querySelector('.body');
  if (!body) return;
  var title = sum.textContent.replace(/[▾ⓘ]/g, '').trim();
  /* GLOB-1 (design-system-audit-2026-09): _showPop() writes this title via
     t.textContent (below), not innerHTML — escaping it here HTML-encoded the
     "&" in e.g. "PAYE & UIF information" to "&amp;", and textContent renders
     that literally instead of decoding it. sum.textContent is already
     entity-decoded plain text; esc() belongs at an innerHTML sink, not this
     one (STD-SEC-2: escape for the sink you are writing to). */
  _showPop(sum, '<strong>' + title + '</strong>' + body.innerHTML);
}
document.addEventListener('click', function(e){
  var sum = e.target.closest && e.target.closest('details.info-acc > summary');
  if (sum) { e.preventDefault(); e.stopPropagation(); _openInfoAccSheet(sum); }
}, true);
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var sum = e.target.closest && e.target.closest('details.info-acc > summary');
  if (sum) { e.preventDefault(); e.stopPropagation(); _openInfoAccSheet(sum); }
}, true);

/* v8.18: sync tile/chip .sel class to checkbox state (fallback for WebViews without :has, and for restore/reset).
   G1: both profile and onboarding tiles now use name="income-type" so this naturally covers both. */
export function obSyncTiles() {
  document.querySelectorAll('.ob-tile, .ob-chip').forEach(function(el){
    var inp = el.querySelector('input[name="income-type"]');
    if(inp) el.classList.toggle('sel', inp.checked);
  });
}

/* G1: Shared income grid renderer. Generates the income source selection UI from
   INCOME_TYPE_DEFS metadata. Both UIs use name="income-type" checkboxes.
   mode='onboarding' → expandable .ob-acc accordions (detailed, first-time setup)
   mode='profile'    → flat .ob-sec grouped sections (compact, settings view) */
export function renderIncomeGrid(containerId, opts) {
  var container = $(containerId);
  if (!container) return;
  /* Flat 2-column tile grid. Every candidate income type stays visible — no
     income type is ever hidden from view (tax-correctness: users must see
     every candidate income type). The category jump-chip row that used to sit
     above the grid was removed as redundant navigation (the tiles are already
     all on-screen). */
  /* QA 2026-08: ONE continuous 2-column grid, not one grid per group.

     The groups (Employment / Passive / Business & Trade / Capital / Other)
     render no heading and no visible separator here — they were purely
     invisible containers, and each one started a fresh CSS grid. Two of the
     five hold a single type (Employment, and Business & Trade), and a third
     holds three, so the `:last-child:nth-child(odd)` full-width rule fired on
     each of those: "Retirement Income" and "Your own business" each took a
     whole row to themselves while the tiles around them sat two-up. That is
     the owner's report, and it was a grid-container artefact rather than a
     layout choice.

     Group ORDER is preserved — the tiles come out in exactly the sequence the
     grouped version produced — so nothing about the taxonomy moves; only the
     row breaks between groups go away. */
  /* Literal handler strings (not a spliced name) so gen-bridge.js can see both. */
  var scnHandler = (opts && opts.mode === 'onboarding')
    ? 'onchange="onIncomeTypeChange();obUpdateScenarioQuestions()"'
    : 'onchange="onIncomeTypeChange();refreshProfileScenarioQs()"';
  var tiles = INCOME_TYPE_GROUPS.reduce(function(acc, grp) {
    return acc.concat(INCOME_TYPE_DEFS.filter(function(d) { return d.group === grp.id; }));
  }, []).map(function(d) {
    var safeLabel = esc(d.label);
    var safeTip = esc(d.tip);
    return '<label class="ob-tile">' +
      /* QR7.2: each surface re-evaluates which scenario questions apply as
         tiles change (onboarding: obUpdateScenarioQuestions, 12-; Profile:
         refreshProfileScenarioQs, 13-). */
      '<input type="checkbox" name="income-type" value="' + d.value + '" ' + scnHandler + '>' +
      '<span class="ob-tile-ico ' + d.color + '"><i class="' + iconClassFor(d.icon) + '"></i></span>' +
      '<span class="ob-tile-label">' + safeLabel + '</span>' +
      '<span class="ob-tile-check"><i class="material-symbols-outlined msi-check"></i></span>' +
      '<button type="button" class="ob-tile-info" onclick="showObPop(event,\'' + safeLabel.replace(/'/g, '&#39;') + '\',\'' + safeTip.replace(/'/g, '&#39;') + '\')"><i class="material-symbols-outlined msi-info"></i></button>' +
      '</label>';
  }).join('');
  container.innerHTML = '<div class="ob-sec"><div class="ob-tiles">' + tiles + '</div></div>';
}

/* ── B2 Simplification: income-type write-through (01-SPEC.md §2.1) ──

   THE TRAP this exists to avoid: getSelectedIncomeTypes() does not read
   state — it reads checked `input[name="income-type"]` out of the DOM, with
   the onboarding overlay filtered out. A second set of checkboxes carrying
   that name would silently DOUBLE-COUNT every income source and corrupt
   provisional status, bucket status, outstanding items and deduction
   recommendations alike.

   So the Income page's toggles are proxies, never a second switch: they
   carry no `name`, and their change handler calls this, which sets the one
   authoritative Profile checkbox and lets the existing render chain repaint
   the proxy. Profile stays the single source of truth. */
/* ── B5 Simplification: un-toggle write-back (01-SPEC.md §3.3, decision A4) ──
   Turning OFF something the user declared during setup is a contradiction
   between two of their own answers. Rather than silently honouring the
   newer one, say what is about to happen in plain language, and on confirm
   WRITE BACK to the setup answer — so Profile and the selector can never
   afterwards disagree, and the item leaves the outstanding list for good.

   cfg: { thing, onConfirm } — `thing` is the plain-language noun as the user
   would say it ("rental income", "the medical deduction"). */
export function confirmContradiction(cfg) {
  const thing = cfg && cfg.thing ? cfg.thing : 'this';
  /* CONF-7/CONF-8 (§L.8): amber 'toggle' tier replaces 'tax', dropping the
     "Changes your return" eyebrow; the body no longer claims "we'll leave
     it out of your tax" — CONF-6 already recorded that toggling a category
     off does not itself exclude its captured entries from the engine, so
     the sentence overclaimed a consequence this action does not deliver.
     CONF-3 removes the provisional-taxpayer wording from the `consequence`
     line entirely — STD-BEHAV-2/OD-17 forbid this dialog from asserting (or
     silently causing) any change to provisional-taxpayer status. Where that
     status might genuinely need re-checking, the divergence is surfaced
     separately on the Profile/Provisional screen (see
     _flagProvisionalReviewIfDiverged, below), never in this dialog. */
  showConfirm(
    'This contradicts an earlier answer',
    'When you set up, you told us you have ' + thing + '. Turning this off updates your profile answer to match.',
    function() { if (cfg && typeof cfg.onConfirm === 'function') cfg.onConfirm(); },
    { tier: 'toggle', okLabel: 'Update the profile', cancelLabel: 'Keep my profile answer' }
  );
}

export function setIncomeType(value, on) {
  const cb = Array.from(document.querySelectorAll('input[name="income-type"][value="' + value + '"]'))
    .filter(el => !el.closest('#onboarding-overlay'))[0];
  if (!cb) return false;
  if (cb.checked === !!on) return true;   /* already there — don't churn renders */
  cb.checked = !!on;
  onIncomeTypeChange();
  return true;
}

/* R1 (02-IMPACT.md): the proxy contract above is invisible at runtime — a
   stray name="income-type" would just quietly double every count. Assert at
   boot that the only such checkboxes outside onboarding are the Profile
   grid's own, so the failure is loud and immediate instead of arriving as
   wrong tax months later. Reported through window.__incomeTypeProxyLeak for
   tests/smoke.js; console.error makes it fail the smoke gate too. */
export function assertIncomeTypeProxyContract() {
  const all = Array.from(document.querySelectorAll('input[name="income-type"]'))
    .filter(el => !el.closest('#onboarding-overlay'));
  const grid = $('prof-income-grid');
  const owned = grid ? grid.querySelectorAll('input[name="income-type"]').length : 0;
  const leaked = all.length - owned;
  window.__incomeTypeProxyLeak = leaked;
  if (leaked > 0) {
    console.error('income-type proxy contract violated: ' + leaked
      + ' checkbox(es) named "income-type" outside the Profile grid — '
      + 'getSelectedIncomeTypes() will double-count. Selector toggles must '
      + 'use data-income-type + setIncomeType(), never name="income-type".');
  }
  return leaked;
}

/* Income type checkbox handler. Runs on any change to the profile grid.

   2026-09 (Atlas F1): this hand-rolled its own partial refresh —
   updateProvisionalAutoStatus() + renderBucketNav() — which is the parallel
   refresh path CLAUDE.md hard rule 12 forbids, and it left out
   renderDeductionsChecklist() entirely. So changing an income type re-coloured
   the bucket cards but never re-evaluated the Recommended/Consider pills: even
   with recommendDeductionFor() returning the right answer, the row kept
   whatever it had rendered last. refreshDerived() is the single post-mutation
   refresh (autoToggleFromPriorYear + renderAll + updateProvisionalAutoStatus),
   and renderAll covers both renderBucketNav and renderDeductionsChecklist, so
   card status and pills now settle in one pass and cannot disagree.

   A doc-comment describing this function used to sit ~380 lines above, stranded
   over _showPop() by an intervening edit, still claiming the function "fires
   evaluateDeductionRules to update amber/green bucket status". It never did.
   That function has been removed (see its tombstone further down). */
/* Owner brief 2026-09-14 (PLAN.md §8 step 2): the "no income source
   selected" toast (obValidateCurrentStep case 2) only fires on Next — it
   says nothing while the user is still looking at the grid. This is the
   standing explanation, aria-live so it is announced the moment the last
   tile is unchecked, not just read on demand. */
export function updateNoIncomeNote() {
  const note = $('ob-no-income-note');
  if (!note) return;
  const anyChecked = document.querySelectorAll('#onboarding-overlay input[name="income-type"]:checked').length > 0;
  note.style.display = anyChecked ? 'none' : '';
}

export function onIncomeTypeChange() {
  // G1: self-emp-subs panel removed (business types are now individual tiles)
  const subs = $('self-emp-subs');
  if(subs) subs.style.display = 'none';

  // V8.5 Session 5: rebuild income tab bar (bucket subpages now live here)
  if(typeof updateIncomeTabs === 'function') updateIncomeTabs();
  if(typeof obSyncTiles === 'function') obSyncTiles();
  updateNoIncomeNote();

  /* Hard rule 12: one refresh path, then one save path. */
  if(typeof refreshDerived === 'function') refreshDerived();
  debounceSave();
}

export function getSelectedIncomeTypes() {
  /* G1: exclude onboarding overlay checkboxes — only the profile section is
     authoritative for the engine and persistence. Onboarding syncs to profile
     on completion via obComplete(). */
  return Array.from(document.querySelectorAll('input[name="income-type"]:checked'))
    .filter(cb => !cb.closest('#onboarding-overlay'))
    .map(cb => cb.value);
}

/* ── V8.5: INCOME BUCKET NAVIGATION ──────────────────────────────────────────
   Renders the 9-bucket card grid on the Income page.
   Status logic:
     amber    = bucket active (income selected) but calculator/data not yet applied
     complete = bucket active + applied value > 0 OR IRP5 items present (B1)
     inactive = bucket not active (income type not selected)
   Net-calculator buckets (B3 Rental, B4 Business, B5 CGT, B6 Foreign) stay amber
   until their calculator is applied and value > 0. */

export function getBucketDesc(b) {
  switch(b.id) {
    case 1: {
      const parts = ['Add IRP5 income sources'];
      if(APP.travelAllowanceYN === 'yes') parts.push('check travel deduction');
      const selfEmpTypes = INCOME_TYPE_DEFS.filter(d => d.group === 'business').map(d => d.value);
      const sel = getSelectedIncomeTypes();
      if(APP.workFromHomeYN === 'yes' || selfEmpTypes.some(v => sel.includes(v)))
        parts.push('check home office & T&E deductions');
      return parts.join(' · ');
    }
    case 2: return 'Add IT3(b) certificates · interest exemption auto-applied';
    case 3: return 'Add properties · calculate net rental income';
    case 4: return 'Add business income & expenses · calculate net profit / loss';
    case 5: return 'Add asset disposals · calculate capital gain less base cost';
    case 6: return 'Add foreign income · foreign tax credit applied when allowed';
    case 7: return 'Add pension / annuity receipts · lump sum calculator';
    case 9: return 'Add other taxable receipts';
    default: return '';
  }
}


/* ── v8.20 D5a: accordion utilities ── */
export function mainAccToggle(id) {
  var head = document.getElementById(id + '-head');
  var body = document.getElementById(id + '-body');
  if (!head || !body) return;
  var isOpen = head.classList.contains('open');
  head.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}
/* Batch M: only one .card-sec/.ded-step section may be open at a time
   within a page/modal — opening one closes any other open section in the
   same .tab-section or .modal-body ancestor. */
/* §5.8/H10: generic segmented control — one .seg-panel visible at a time.
   prefix scopes the group (panels are `${prefix}-*`, matched via data-seg). */
export function segShow(prefix, btn) {
  const seg = btn.dataset.seg;
  btn.closest('.seg-ctl').querySelectorAll('.seg-btn').forEach(b => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.seg-panel[id^="' + prefix + '-"]').forEach(p_ =>
    p_.classList.toggle('active', p_.id === seg));
}

/* Prototype #33: generalizes Retirement's "jump straight to your summary"
   pattern to every income page's pinned hero card (Option B: a secondary
   link on the existing hero, no new button element). Pages with a
   segmented "At a glance"/Summary sub-nav switch to that panel via the
   same segShow() every seg-ctl already uses; flat pages (no tabs) scroll
   to their totals block instead. */
export var HERO_BREAKDOWN_TARGETS = {
  retirement: { type: 'seg', prefix: 'ret-seg', panel: 'ret-seg-glance' },
  foreign:    { type: 'seg', prefix: 'foreign-seg', panel: 'foreign-seg-summary' },
  crypto:     { type: 'seg', prefix: 'crypto-seg', panel: 'crypto-seg-glance' },
  investment: { type: 'seg', prefix: 'invest-seg', panel: 'invest-seg-glance' },
  rental:     { type: 'scroll', target: 'rental-aggregate' },
  business:   { type: 'scroll', target: 'business-aggregate' },
  cgt:        { type: 'scroll', target: 'cgt-result' },
  other:      { type: 'scroll', target: 'other-receipts-summary' }
};
export function jumpToPageBreakdown(pageKey) {
  var cfg = HERO_BREAKDOWN_TARGETS[pageKey]; if (!cfg) return;
  if (cfg.type === 'seg') {
    var btn = document.querySelector('[data-seg="' + cfg.panel + '"]');
    if (btn && typeof segShow === 'function') segShow(cfg.prefix, btn);
    var ctl = btn && btn.closest('.seg-ctl');
    if (ctl) ctl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    var el = document.getElementById(cfg.target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
/* Shared hero-card fragment: appended only in each renderer's has-data
   branch (never the empty state — nothing to jump to yet). */
export function heroBreakdownLink(pageKey) {
  return '<span class="jump-link" onclick="event.stopPropagation();jumpToPageBreakdown(\'' + pageKey + '\')">View breakdown <i class="material-symbols-outlined msi-arrow-downward"></i></span>';
}

export function cardSecToggle(id) {
  var head = document.getElementById(id + '-head');
  var body = document.getElementById(id + '-body');
  if (!head || !body) return;
  var isOpen = head.classList.contains('open');
  var scope = head.closest('.tab-section') || head.closest('.modal-body') || document;
  scope.querySelectorAll('.card-sec-head.open, .ded-step-head.open').forEach(function(h) {
    if (h === head) return;
    h.classList.remove('open');
    var b = document.getElementById(h.id.replace(/-head$/, '-body'));
    if (b) b.classList.remove('open');
  });
  head.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}
/* Collapse every .card-sec/.ded-step/.stmt-row section within a container
   back to closed — used on tab entry so sections never persist open across
   navigation (Batch M; Batch E extended this to the SARS Account statement
   rows for the same reason: the page should be short every time you land
   on it, not just the first time). */
export function collapseAllSections(container) {
  if (!container) return;
  container.querySelectorAll('.card-sec-head.open, .ded-step-head.open').forEach(function(h) { h.classList.remove('open'); });
  container.querySelectorAll('.card-sec-body.open, .ded-step-body.open').forEach(function(b) { b.classList.remove('open'); });
  container.querySelectorAll('details.stmt-row[open]').forEach(function(d) { d.removeAttribute('open'); });
}
/* B0 Simplification P5: extends collapseAllSections() to also reset every
   .seg-ctl on the page to its first button and panel, so entering a page
   always lands on the primary (first) section, never on a sub-section the
   user left open during a previous visit. */
export function resetPageToPrimary(container) {
  if (!container) return;
  collapseAllSections(container);
  /* B3 (P5 — open on the primary thing, every single time): on a page built
     from numbered chevron steps, the primary thing is step 1. Collapsing
     everything left those pages showing nothing but three headings, which
     got worse in B3 as Medical and Retirement joined Travel and Home Office
     on this pattern. Scoped to .ded-step-head deliberately: a numbered step
     has an unambiguous first, while .card-sec-head collapsibles elsewhere
     (SARS-account rows and the like) are a list where none is primary.
     B-2: applied PER .card, not once for the whole container — every tab
     built this way still has exactly one such card (so behaviour there is
     unchanged), but Travel now has two independent step-calculators (the
     allowance one, and the company-car one below it), each with its own
     unambiguous "step 1" that should open on tab entry. */
  var _cardScopes = container.querySelectorAll('.card');
  (_cardScopes.length ? _cardScopes : [container]).forEach(function(scope) {
    var firstStep = scope.querySelector('.ded-step-head');
    if (!firstStep) return;
    firstStep.classList.add('open');
    var body = document.getElementById(firstStep.id.replace(/-head$/, '-body'));
    if (body) body.classList.add('open');
  });
  container.querySelectorAll('.seg-ctl').forEach(function(ctl) {
    var btns = ctl.querySelectorAll('.seg-btn');
    if (!btns.length) return;
    var prefix = btns[0].dataset.seg;
    if (prefix) prefix = prefix.replace(/-[^-]+$/, '');
    btns.forEach(function(b, i) {
      var on = i === 0;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (prefix) {
      document.querySelectorAll('.seg-panel[id^="' + prefix + '-"]').forEach(function(p, i) {
        p.classList.toggle('active', i === 0);
      });
    }
  });
}
/* ── v8.22 D6: yes/no tile-radio ↔ backing <select> bridge ──
   The original <select> stays in the DOM (hidden) so all existing JS that reads
   its .value keeps working. Tiles set the select value then dispatch 'change',
   firing whatever onchange handler the select already had — no handler is rewritten. */
export function ynPick(tile, selectId) {
  var inp = tile.querySelector('input[type="radio"]');
  var sel = document.getElementById(selectId);
  if (inp && sel) {
    sel.value = inp.value;
    sel.dispatchEvent(new Event('change', {bubbles:true}));
  }
  syncYn();
}
/* v8.22 HO: self-employed / trade detector (IN28 s23(m) limits apply to EMPLOYEES only).
   Bond interest + the employee-specific rules differ for freelancers / sole props / contractors. */
export function isSelfEmployed() {
  /* G1: updated to use canonical biz_* values */
  var sel = (typeof getSelectedIncomeTypes === 'function') ? getSelectedIncomeTypes() : (APP.selectedIncomeTypes || []);
  var bizTypes = INCOME_TYPE_DEFS.filter(function(d){ return d.group === 'business'; }).map(function(d){ return d.value; });
  return sel.some(function(v){ return bizTypes.indexOf(v) >= 0; });
}
/* v8.22 HO-EMP: employment detector for the home-office bond-interest rule.
   Employment is indicated either by the income-type selection (permanent /
   contract salary) OR by any captured IRP5 employment-bucket code (3601 etc.).
   The s23(m) bond-interest disallowance keys off being an EMPLOYEE regardless of
   how the income was captured, so we must look at the actual IRP5 items too —
   the selection checkboxes alone missed users who entered a 3601 directly. */
export function hasEmploymentIncome() {
  var sel = (typeof getSelectedIncomeTypes === 'function') ? getSelectedIncomeTypes() : (APP.selectedIncomeTypes || []);
  if (sel.includes('employment_income')) return true;
  return (APP.incomeItems || []).some(function(i){
    var d = IRP5_CODE_MAP.get(i.code);
    return d && d.bucket === 1 && (i.amount || 0) > 0;
  });
}
/* s23(m) commission carve-out (owner decision, 2026-06): an employee whose
   remuneration is MAINLY (>50%) commission (cat 'commission': codes 3606/3656)
   is not subject to the s23(m) limitations and may claim home-office bond
   interest under s11(a), like the self-employed. Tested quantitatively from
   the captured IRP5 items against the Fourth Schedule remuneration base. */
export function isMainlyCommission() {
  var items = APP.incomeItems || [];
  var rem = (typeof calcRemunerationBase === 'function') ? calcRemunerationBase(items) : 0;
  if (rem <= 0) return false;
  var comm = items.reduce(function(s, i){
    var d = IRP5_CODE_MAP.get(i.code);
    return s + (d && d.cat === 'commission' ? (i.amount || 0) : 0);
  }, 0);
  return comm > rem / 2;
}
/* v8.22 HO: Apply gate — over50='no' means s23(b) does not qualify; deduction is R0.
   Require explicit confirmation before applying.
   engine-remediation W15: the >50%-duties proviso (b) test only applies where
   the trade "constitutes any employment or office" (s23(b) proviso (b)) — a
   PURE self-employed taxpayer (no employment income at all) is not subject to
   it, so over50='no' no longer zeroes their deduction. A MIXED profile
   (employment AND self-employment income) answering 'no' still defaults to R0,
   but can override with an explicit confirmation that the office serves the
   non-employment trade — mirroring the bond-interest confirm below. */
export function applyHomeoffice() {
  var over50 = (gs('ho_over50') || 'yes') === 'yes';
  /* Phase 8 (F2/E1): same confirm-before-R0 treatment the >50%-duties gate
     already gets below — checked first, since a non-exclusive space fails
     regardless of the duties test. This mirrors calcHomeOffice()'s own
     ordering; the AMOUNT itself is never recomputed here, only whether to
     interrupt with a confirm dialog before committing what calcHomeOffice()
     already calculated into pendingValues. */
  var exclusive = (gs('ho_exclusive') || 'yes') === 'yes';
  if (!exclusive) {
    showConfirm('Home office does not qualify',
      'You indicated this space is also used for something other than work. SARS requires exclusive use, so the s23(b) deduction does not qualify and will be applied as R 0. Continue?',
      function(){ applyDeduction('homeoffice'); },
      { tier: 'elig', okLabel: 'Claim anyway', cancelLabel: 'Review my answers',
        consequence: 'Turning it on anyway leaves an unsupportable deduction in your return. SARS routinely requests floor plans and employer letters for s23(b) claims.' });
    return;
  }
  var _hasEmpGate = (typeof hasEmploymentIncome === 'function') && hasEmploymentIncome();
  var _selfEmpGate = (typeof isSelfEmployed === 'function') && isSelfEmployed();
  var gateApplies = _hasEmpGate;
  if (!over50 && gateApplies) {
    if (_selfEmpGate) {
      showConfirm('Confirm non-employment use',
        'Your profile includes both employment and business/trade income, and you indicated 50% or less of your duties are performed in this office. To still claim the s23(b) deduction, confirm this office is used mainly for your non-employment trade.',
        function(){ APP.appliedValues.ho_mixed_override = true; applyDeduction('homeoffice'); },
        { tier: 'elig', okLabel: 'Confirm apportionment', cancelLabel: 'Cancel',
          consequence: 'The apportionment is by floor area and time. Confirming keeps the claim but reduces it to the business share.' });
      return;
    }
    APP.appliedValues.ho_mixed_override = false;
    showConfirm('Home office does not qualify',
      'You indicated 50% or less of your duties are performed in this office. The s23(b) deduction does not qualify and will be applied as R 0. Continue?',
      function(){ applyDeduction('homeoffice'); },
      { tier: 'elig', okLabel: 'Claim anyway', cancelLabel: 'Review my answers',
        consequence: 'Turning it on anyway leaves an unsupportable deduction in your return. SARS routinely requests floor plans and employer letters for s23(b) claims.' });
    return;
  }
  APP.appliedValues.ho_mixed_override = false;
  /* v8.22 HO-EMP: employment is detected from the income-type selection OR captured
     IRP5 codes (3601 etc.). Self-employed/trade and mainly-commission earners keep
     bond interest under s11(a); a plain employee does NOT (IN28 / s23(m), disallowed
     from 2023). */
  var _hasEmp = (typeof hasEmploymentIncome === 'function') && hasEmploymentIncome();
  var _selfEmp = (typeof isSelfEmployed === 'function') && isSelfEmployed();
  var _mainlyComm = (typeof isMainlyCommission === 'function') && isMainlyCommission();
  var _empOnly = _hasEmp && !_selfEmp && !_mainlyComm;
  var _own = gs('ho_ownership') === 'own';
  var _bond = gv('ho_bond_int') || 0;
  /* Require an explicit acknowledgement that bond interest is excluded before an
     employee owner applies the deduction. */
  if (_empOnly && _own && _bond > 0) {
    showConfirm('Bond interest excluded — confirm',
      'Your profile indicates employment income (salary / IRP5 remuneration), so as an employee you may NOT claim home-office bond interest of ' + fmt(_bond) + ' — disallowed from the 2023 year of assessment under IN28 / s23(m). Rates &amp; taxes, electricity, levies, cleaning and security remain claimable. The deduction will be applied with bond interest excluded. Continue?',
      function(){ applyDeduction('homeoffice'); },
      { tier: 'tax', okLabel: 'Understood', cancelLabel: 'Show me the calculation',
        consequence: 'Excluding it lowers your home-office deduction by the interest portion. Rates, electricity and repairs stay in.' });
    return;
  }
  /* Neither employment nor business income -> require explicit non-employment confirmation */
  if (!_hasEmp && !_selfEmp) {
    showConfirm('Confirm business use',
      'Your profile has neither employment nor business income selected. Confirm this home office is NOT used for employment duties, but for a home-based business or trade.',
      function(){ applyDeduction('homeoffice'); },
      { tier: 'tax', okLabel: 'Confirm the ratio', cancelLabel: 'Re-check my logbook',
        consequence: 'A ratio this high is a common audit trigger and needs a compliant logbook for every trip claimed.' });
    return;
  }
  applyDeduction('homeoffice');
}
export function syncYn() {
  document.querySelectorAll('.yn-group[data-yn-select]').forEach(function(grp){
    var sel = document.getElementById(grp.getAttribute('data-yn-select'));
    if (!sel) return;
    grp.querySelectorAll('.yn-tile').forEach(function(tile){
      var inp = tile.querySelector('input[type="radio"]');
      if (!inp) return;
      var match = (inp.value === sel.value);
      inp.checked = match;
      tile.classList.toggle('sel', match);
    });
  });
}

/* ── v8.20 D5a: income bucket accordion groups ── */
export var BUCKET_GROUPS = [
  {id:'inc-passive', label:'Passive Income',        icon:'paid',          colour:'ico-bg-blue',   buckets:[2,3,7]},
  {id:'inc-business',label:'Business & Trade',      icon:'storefront',    colour:'ico-bg-green',  buckets:[4,6]},
  {id:'inc-capital', label:'Capital & Alternative', icon:'trending_up',   colour:'ico-bg-purple', buckets:[5,10]},
  {id:'inc-other',   label:'Other',                 icon:'receipt_long', colour:'ico-bg-amber',  buckets:[9,8]}
];
export var BUCKET_TILE_COLOURS = {
  2:'ico-bg-blue',3:'ico-bg-teal',4:'ico-bg-green',5:'ico-bg-orange',
  6:'ico-bg-blue',7:'ico-bg-purple',8:'ico-bg-grey',9:'ico-bg-amber',10:'ico-bg-orange'
};

/* ── v8.20 D5a: deduction accordion groups ── */
export var DED_GROUPS = [
  {id:'ded-retmed',  label:'Retirement & Medical', icon:'monitor_heart',       colour:'ico-bg-blue',  ids:['retirement','medical']},
  {id:'ded-work',    label:'Work & Business',      icon:'work',         colour:'ico-bg-green', ids:['travel','homeoffice','tools','subscrip','subsistence']},
  {id:'ded-charity', label:'Charitable Giving',    icon:'volunteer_activism',colour:'ico-bg-amber', ids:['donations']}
];

/* G1: incomeVals uses lazy getters — INCOME_TYPE_DEFS lives in 01-data.js and the
   01-data ↔ 02-core import cycle means 01-data exports are not yet initialised at
   02-core module-eval time (they are initialised later in the bundle). Accessing them
   inside a getter defers the lookup to call time, by which point all modules have
   finished evaluating (per CLAUDE.md "never access a foreign const at module-eval time"). */
export const BUCKET_DEFS = [
  {id:1,  label:'Employment',      icon:'work',              get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===1).map(d=>d.value);},  netCalc:false},
  {id:2,  label:'Investment',      icon:'finance_mode',        get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===2).map(d=>d.value);},  netCalc:false},
  {id:3,  label:'Rental',          icon:'home',              get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===3).map(d=>d.value);},  netCalc:true},
  {id:4,  label:'Business & Trade',icon:'storefront',        get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===4).map(d=>d.value);},  netCalc:true},
  {id:5,  label:'Capital Gains',   icon:'arrow_split',       get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===5).map(d=>d.value);},  netCalc:true},
  {id:6,  label:'Foreign Income',  icon:'public',             get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===6).map(d=>d.value);},  netCalc:true},
  {id:7,  label:'Retirement',      icon:'beach_access',      get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===7).map(d=>d.value);},  netCalc:false},
  {id:9,  label:'Other Receipts',  icon:'receipt_long',      get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===9).map(d=>d.value);},  netCalc:false},
  {id:10, label:'Crypto',          icon:'currency_bitcoin',  get incomeVals(){return INCOME_TYPE_DEFS.filter(d=>d.bucket===10).map(d=>d.value);}, netCalc:false},
];

/* V8.9 B3.1: income items store {code,name,cat,...} but NOT a .bucket field.
   Derive the routing bucket from the IRP5 code at read time (migration-safe). */
export function incomeBucket(item) {
  if(!item || !item.code) return null;
  var def = (typeof IRP5_CODE_MAP !== 'undefined') ? IRP5_CODE_MAP.get(item.code) : null;
  return (def && def.bucket) ? def.bucket : null;
}
export function hasBucketIncome(id) {
  /* v8.16: bucket 10 uses cryptoDisposals/cryptoRevenue, not incomeItems */
  if(id === 10) return (APP.cryptoDisposals||[]).length > 0 || (APP.cryptoRevenue||[]).length > 0;
  return (APP.incomeItems || []).some(function(i){ return incomeBucket(i) === id; });
}

export function getBucketStatus(bucket) {
  const selected = getSelectedIncomeTypes();
  /* V8.9 B3.1: a bucket is also active if any captured IRP5 code routes to it */
  const active = bucket.incomeVals.some(v => selected.includes(v)) || hasBucketIncome(bucket.id) || (bucket.id === 10 && ((APP.cryptoDisposals||[]).length > 0 || (APP.cryptoRevenue||[]).length > 0));
  if(!active) return 'inactive';
  if(bucket.id === 1) {
    /* V8.9 B3.1a: Employment greens only on genuine employment income.
       Codes that economically belong to Business (commission/contractor/NED-director)
       must NOT green the Employment card — they signal B4 needs attention instead. */
    const empGenuine = (APP.incomeItems || []).some(function(i){
      return incomeBucket(i) === 1 && ['commission','contractor','director'].indexOf(i.cat) === -1;
    });
    return empGenuine ? 'complete' : 'amber';
  }
  if(bucket.id === 2) {
    return (APP.it3bItems && APP.it3bItems.length > 0) ? 'complete' : 'amber';
  }
  if(bucket.id === 9) {
    return (APP.otherReceipts && APP.otherReceipts.length > 0) ? 'complete' : 'amber';
  }
  if(bucket.id === 10) {
    return ((APP.cryptoDisposals||[]).length > 0 || (APP.cryptoRevenue||[]).length > 0) ? 'complete' : 'amber';
  }
  /* V8.75 4e + V8.9 B3.1b: retirement income — also greens on IRP5 codes 3610/3611/3618/3619 (bucket 7) */
  if(bucket.id === 7) {
    var hasRet = (APP.pensionAnnuityItems && APP.pensionAnnuityItems.length)
              || (APP.retirementLumpsums && APP.retirementLumpsums.length)
              || (APP.twopotWithdrawals && APP.twopotWithdrawals.length);
    return (hasRet || hasBucketIncome(7)) ? 'complete' : 'amber';
  }
  if(bucket.netCalc) {
    const av = APP.appliedValues || {};
    /* engine-remediation W9: appliedValues.foreign is retired (the s6quat
       credit is now a single overall calcFullTax output, not a UI-computed
       residual pool) — bucket 6's status/amount now reads collectForeignIncome
       directly, the same one-source-of-truth collector the engine uses. */
    const applied = bucket.id === 3 ? av.rental
                  : bucket.id === 4 ? av.business
                  : bucket.id === 5 ? av.cgt
                  : bucket.id === 6 ? _foreignIncomeTotal()
                  : 0;
    /* V8.9 B3.1c: Foreign greens on applied net OR on IRP5 foreign codes 3651/3655/3656 (bucket 6) */
    if(bucket.id === 6 && hasBucketIncome(6)) return 'complete';
    return (applied && applied !== 0) ? 'complete' : 'amber';
  }
  return 'complete';
}

export function renderBucketNav() {
  var el = document.getElementById('income-bucket-grid'); if(!el) return;
  var html = '';
  BUCKET_GROUPS.forEach(function(grp) {
    var grpBuckets = BUCKET_DEFS.filter(function(b){ return grp.buckets.indexOf(b.id) >= 0 && b.id !== 1; });
    var activeCount = 0;
    grpBuckets.forEach(function(b){ var st = getBucketStatus(b); if(st==='amber'||st==='complete') activeCount++; });
    var badge = '<span class="m-acc-head-badge" id="' + grp.id + '-badge"' + (activeCount>0?'':' style="display:none"') + '>'
                + (activeCount>0 ? activeCount + ' active' : '') + '</span>';
    var tilesHtml = '';
    grpBuckets.forEach(function(b) {
      var st = getBucketStatus(b);
      var tileCls = 'inc-tile';
      if(st==='inactive') tileCls+=' inc-inactive';
      else if(st==='amber') tileCls+=' inc-amber';
      else if(st==='complete') tileCls+=' inc-complete';
      var icoCol = BUCKET_TILE_COLOURS[b.id] || 'ico-bg-blue';
      var onclk = 'onclick="switchToBucket(' + b.id + ')"';
      /* v8.22 D6: description moved to the tile's ⓘ; shorter tile labels.
         The description used to sit in a `title` attribute — hover-only, so
         on touch it showed nothing AND the tap fell through to the tile's own
         onclick, navigating instead of explaining. data-tip puts it on the
         shared tip engine, whose capture-phase click handler also stops the
         navigation. */
      var BUCKET_SHORT = {4:'Business', 6:'Foreign', 9:'Other'};
      var lbl = BUCKET_SHORT[b.id] || b.label;
      var tipHtml = (st!=='inactive')
        ? ('<span class="tile-tip" data-tip="' + esc(getBucketDesc(b)) + '" role="button" tabindex="0" aria-label="About ' + esc(lbl) + '"><i class="material-symbols-outlined msi-info"></i></span>')
        : '';
      var amt = getBucketAmount(b);
      var amtHtml = (st==='complete'&&amt&&amt>0) ? ('<div class="inc-tile-amt">' + fmt(amt) + '</div>') : '';
      var badgeHtml = '';
      if(st==='amber') badgeHtml = '<span class="inc-tile-badge amber">Action needed</span>';
      else if(st==='complete') badgeHtml = '<span class="inc-tile-badge green">Active</span>';
      /* STD-COL-4 (§L.6, OD-2): "Completed" used to render every category in
         the same shared --au green. icoCol (e.g. 'ico-bg-blue') can't be
         reused directly on the outer tile — that class also carries the
         full icon-chip visual system ([class*="ico-bg-"][class] in
         main.css), which would restyle the whole row as a 35x35 chip. A
         lightweight row-accent-* class (main.css) sets only --row-c, the
         variable .inc-complete's CSS reads. */
      tilesHtml += '<div class="' + tileCls + ' ' + icoCol.replace('ico-bg-', 'row-accent-') + '" ' + onclk + '>'
        + tipHtml
        + '<div class="inc-tile-ico ' + icoCol + '"><i class="' + iconClassFor(b.icon) + '"></i></div>'
        + '<div class="inc-tile-lbl">' + esc(lbl) + '</div>'
        + amtHtml + badgeHtml
        + '</div>';
    });
    html += '<div class="m-acc" data-inc-group="' + grp.id + '">'
      + '<div class="m-acc-head open" id="' + grp.id + '-head" onclick="mainAccToggle(\'' + grp.id + '\')">'
      + '<div class="m-acc-head-ico ' + grp.colour + '"><i class="' + iconClassFor(grp.icon) + '"></i></div>'
      + '<span class="m-acc-head-lbl">' + grp.label + '</span>'
      + badge
      + '<i class="material-symbols-outlined msi-expand-more m-acc-head-chev"></i>'
      + '</div>'
      + '<div class="m-acc-body open" id="' + grp.id + '-body">'
      + '<div class="inc-tiles">' + tilesHtml + '</div>'
      + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
}

/* V8.75 4d: net/captured amount per income bucket (safe sums; null = no amount shown) */
export function getBucketAmount(b) {
  var av = APP.appliedValues || {};
  if(b.id === 3) return av.rental  || 0;
  if(b.id === 4) return av.business|| 0;
  if(b.id === 5) return av.cgt     || 0;
  if(b.id === 6) return _foreignIncomeTotal();
  if(b.id === 2) { var t = 0; taxableIt3bItems().forEach(function(i){ t += (i.localInterest||0)+(i.sarsInterest||0)+(i.foreignInterest||0)+(i.foreignDividends||0)+(i.reitDistributions||0)+(i.reitTaxableDividends||0)+(i.foreignCapitalGains||0)-(i.otherReceiptsLoss||0)+(i.taxableLocalDividends||0); }); return t; } /* v8.21 F1: corrected field names (was i.local/i.reit — matched no property); Batch M: +4114 -4215; A4: +4238; C-11: excludes TFSA-flagged certificates (s12T exempt) */
  if(b.id === 1) return (APP.incomeItems||[]).reduce(function(s,i){ return s + (i.amount||0); }, 0);
  if(b.id === 9) return (APP.otherReceipts||[]).reduce(function(s,i){ return s + (i.amount||0); }, 0);
  if(b.id === 10) {
    var ct = typeof cryptoTotals === 'function' ? cryptoTotals() : {netRevenue:0,cgtNet:0};
    return Math.round((ct.netRevenue||0) + Math.max(0, ct.cgtNet||0));
  }
  /* coverage-gap C-13: a lump sum flagged as a fund-to-fund transfer is not
     income at all (tax-neutral, see walkLumpsums) — excluded here too so the
     bucket's own "amount captured" glance figure can't overstate it. */
  if(b.id === 7) { var r = 0; ['pensionAnnuityItems','retirementLumpsums','twopotWithdrawals'].forEach(function(k){ (APP[k]||[]).forEach(function(i){ if(i.eventType === 'transfer') return; r += (i.amount||i.gross||0); }); }); return r; }
  return null;
}

export function switchToBucket(bucketId) {
  /* V8.6 E3: Bucket 1 (Employment) — always navigate to income main where IRP5 capture lives */
  if(bucketId === 1) {
    navigateTo('income','main');
    setTimeout(() => {
      const el = document.querySelector('#tab-income-main .card:nth-child(3)');
      if(el) el.scrollIntoView({behavior:'smooth'});
    }, 100);
    return;
  }
  if(bucketId === 2) { navigateTo('income','b2investment'); return; }
  if(bucketId === 3) { navigateTo('income','b3rental'); return; }
  if(bucketId === 4) { navigateTo('income','b4business'); return; }
  if(bucketId === 5) { navigateTo('income','b5cgt'); return; }
  if(bucketId === 6) { navigateTo('income','b6foreign'); return; }
  if(bucketId === 7) { navigateTo('income','b7retirement'); return; }
  if(bucketId === 9) { navigateTo('income','b9other'); return; }
  if(bucketId === 10) { navigateTo('income','b10crypto'); return; }
  /* A bucket without a dedicated screen lands on a real one, never a
     dead end. */
  navigateTo('income','b9other');
}

/* 2026-09 (Atlas F3): evaluateDeductionRules() lived here — Layer C of a
   three-layer "Facts → Deduction Candidates" design. It was exported,
   referenced by a comment on the income-type handler as though it were wired,
   and never called by anything. Its income-type tests were the CURRENT
   taxonomy values while the function the UI actually calls,
   recommendDeductionFor() in 04-deductions.js, still tested the retired ones —
   a fork on one responsibility where the stale branch won and nobody noticed,
   because no test covered the pills.

   It is removed rather than wired. Its usable income-type rules now live in
   recommendDeductionFor(), which has the per-id 'strong'|'consider'|null
   contract the checklist renderer needs. What did NOT carry over, and why:
     - its confidence:'high' branches read factMap.b4 from APP.facts. That
       screening layer was never built; APP.facts is only ever persisted and
       restored, so those branches could not fire.
     - it emitted ids 'rental', 'cgt', 'business' and 'interest', none of
       which are in DEDUCTION_CHECKLIST — they became income buckets in
       V8.5 Session 5.
     - its "any income at all ⇒ retirement is high confidence" rule is the
       information-free pill that QA 2026-08 (B2-DED-B2-4) removed from
       `donations`. Reintroducing it would undo that.
   tests/deduction-rules.js now covers the surviving rules. */

/* V8.4 B: Auto-determine provisional status from income selections.
   Triggers: a provisional income type (PROVISIONAL_INCOME_TYPES) or income over the par 20 threshold.
   User can override via the radio buttons. */
export function isProvisionalAutoDetermined() {
  const selected = getSelectedIncomeTypes();
  /* QA 2026-08 (B2-BUG-3): derive the trigger list, never hand-copy it. This
     was a literal ['rental_income','business_income','crypto_income'] while
     updateProvisionalAutoStatus below built its reasons text from
     PROVISIONAL_INCOME_TYPES. The two agreed only by luck — editing
     isProvisional in 01-data would have made the determination and the
     explanation shown to the user silently disagree. Same values today, so
     this is a de-duplication with no behaviour change. */
  const PROV_TRIGGERS = PROVISIONAL_INCOME_TYPES;
  /* QA 2026-08 (owner decision, supersedes coverage-gap B-9 item 5): selecting a
     provisional income type triggers provisional status on its own, with no
     amount required. B-9 had added a "captured amount > 0" guard so that an
     empty toggle would not trigger; the owner has reversed that. Selecting the
     type IS the declaration that the income exists, and under the s1
     "provisional taxpayer" definition a natural person deriving income other
     than remuneration is provisional regardless of amount. The safe direction
     here is to over-report status, never to under-report it: telling someone
     they are NOT provisional when they are is the single most expensive wrong
     answer this determination can give. */
  const triggered = selected.some(t => PROV_TRIGGERS.includes(t));
  /* Captured amounts are still read below, as a SECOND path: income that was
     captured without its type being toggled on still has to reach the
     de-minimis test. The type toggle above is now the primary trigger. */
  let r = null;
  try { r = calcFullTax(); } catch (e) { /* ignore — the type test above stands alone */ }
  /* v8.8 D8: provisional STATUS test corrected. The previous trigger compared gross
     income to the para-20 threshold (R1.8m) — but that figure governs the 80/90%
     underestimation PENALTY tier, not who is a provisional taxpayer. Per the s1
     "provisional taxpayer" definition, an individual whose only other income is
     passive (interest + taxable dividends) becomes provisional once that passive
     income exceeds the de-minimis.
     engine-remediation W12: para 18(1)(c) Fourth Schedule sets a single R30,000
     de-minimis for ALL ages — there is no age-65 variant (the previous
     age>=65 branch to R34,500 had no statutory basis). */
  const deMinimis = getFact('provisional.deMinimis');
  let passiveIncome = 0;
  taxableIt3bItems().forEach(function (i) {
    passiveIncome += (i.localInterest || 0) + (i.sarsInterest || 0) + (i.foreignInterest || 0) + (i.foreignDividends || 0) + (i.reitDistributions || 0) + (i.reitTaxableDividends || 0);
  });
  /* coverage-gap B-9, items 1-2: royalties/maintenance/settlements/recoveries/
     and the B6 foreign catch-all field were invisible to this test, so
     a taxpayer whose only non-remuneration income was e.g. R60,000 of royalties
     was told they were not provisional. Both are summed below.
     QA 2026-08: other_income is isProvisional:true in
     01-data, so selecting it triggers status directly via the type test
     above. These amount sums remain as the second path — they still catch
     income captured without its type toggled on.
     Deliberately NOT implemented here (needs primary-source confirmation
     before touching, per CLAUDE.md's tax-engine citation rule): the
     "taxable income will not exceed the tax threshold" exclusion in para 18.
     Getting that boundary wrong risks a false NEGATIVE (told NOT provisional
     when they are), which is the most expensive wrong answer this
     determination can give — worse than erring toward provisional.
     cgt stays isProvisional:false by owner decision (QA 2026-08): a taxable
     capital gain is included in taxable income via s26A but is not "income"
     for the s1 provisional-taxpayer definition, and para 19(1)(d) excludes
     taxable capital gains from the basic amount. */
  const otherReceiptsAmt = r ? (r.otherReceiptsIncome || 0) : 0;
  let foreignCatchAll = 0;
  try { foreignCatchAll = collectForeignIncome().catchAll || 0; } catch (e) {}
  const nonRemuneration = passiveIncome + otherReceiptsAmt + foreignCatchAll;
  const abovePassive = nonRemuneration > deMinimis;
  return { auto: triggered || abovePassive, triggered, abovePassive, passiveIncome, otherReceiptsAmt, foreignCatchAll, nonRemuneration, deMinimis, selected, threshold: deMinimis };
}

export function updateProvisionalAutoStatus() {
  const r = isProvisionalAutoDetermined();
  const msgEl = $('provisional-auto-msg');
  const choice = gs('p_prov_status') || 'auto';
  /* STD-BEHAV-2/OD-17 (§L.8): a Toggle-Off confirm (confirmContradiction)
     syncs the profile answer it asked about, per CONF-1 — but CONF-2
     forbids that same confirm from moving provisional-taxpayer status, even
     as a side effect of the answer it just changed. This is that guard: the
     message below still shows what auto-determination would say, but the
     write-through to p_provisional is skipped while a review is pending, and
     a separate non-blocking notice (below) tells the user why, so the
     divergence is surfaced rather than silently resolved in either
     direction. Cleared by acknowledgeProvisionalReview(). */
  const reviewEl = $('provisional-review-notice');
  if (reviewEl) reviewEl.style.display = APP.provisionalReviewNeeded ? 'block' : 'none';
  if(msgEl) {
    if(!r.selected.length) {
      msgEl.innerHTML = '<i class="material-symbols-outlined msi-info u-mr-5"></i>Make at least one income selection to auto-determine status.';
      msgEl.className = 'note info';
    } else if(r.auto) {
      /* QA 2026-08: say WHICH sources, in the user's own words. The list is
         filtered by the same PROVISIONAL_INCOME_TYPES the determination uses,
         so the answer and its stated reason cannot disagree, and the labels
         come from INCOME_TYPE_DEFS rather than printing raw values. */
      const reasons = [];
      if(r.triggered) {
        const trig = r.selected
          .filter(t => PROVISIONAL_INCOME_TYPES.includes(t))
          .map(t => { const d = INCOME_TYPE_DEFS.find(x => x.value === t); return d ? d.label.toLowerCase() : t; });
        reasons.push('you selected ' + trig.join(', ') + ', which is income other than a salary');
      }
      if(r.abovePassive) reasons.push('your interest, dividends, royalties and other non-salary income comes to ' + fmt(r.nonRemuneration) + ', above the ' + fmt(r.deMinimis) + ' threshold');
      setNote(msgEl, 'ok', 'You are a <strong>provisional taxpayer</strong>.', 'Auto-determined because ' + reasons.join('; and ') + '.<br><br>SARS treats you as a provisional taxpayer if you earn income that is not a salary. Capital gains on their own do not count.', { icon: 'check_circle', title: 'Provisional taxpayer: yes' });
    } else {
      setNote(msgEl, 'info', 'You are <strong>not</strong> a provisional taxpayer.', 'You have not selected any income other than a salary, and your interest, dividends and other non-salary income is at or below ' + fmt(r.deMinimis) + '. Select the source under Income Sources above if it applies to you, or override below.', { title: 'Provisional taxpayer: no' });
    }
  }
  // Apply the determined value if user is on 'auto' mode — suspended while
  // provisionalReviewNeeded (see comment above); the user's own explicit
  // override choice (onProvisionalChoice, below) is never suspended, only
  // this automatic recompute.
  if(choice === 'auto' && !APP.provisionalReviewNeeded) {
    sv('p_provisional', r.auto ? 'yes' : 'no');
  }
}

/* STD-BEHAV-2/OD-17: clears the review-pending flag set when a Toggle-Off
   confirm synced an answer isProvisionalAutoDetermined() reads. Called from
   the notice's own acknowledgement button — the user has seen the current
   auto-determination and either it is already right (nothing left to do,
   auto-recompute simply resumes) or they use the override radios above to
   set it explicitly, which is unaffected by this flag either way. */
export function acknowledgeProvisionalReview() {
  APP.provisionalReviewNeeded = false;
  updateProvisionalAutoStatus();
  debounceSave();
  noteStepCompleted('provisional');   // QR10a.3: provisional tax has no other discrete save — its fields autosave
}

/* V8.4 B: User override of auto-determined provisional status. */
export function onProvisionalChoice(choice) {
  sv('p_prov_status', choice);
  const r = isProvisionalAutoDetermined();
  const overrideEl = $('provisional-override-msg');
  if(choice === 'auto') {
    sv('p_provisional', r.auto ? 'yes' : 'no');
    if(overrideEl) overrideEl.style.display = 'none';
  } else {
    sv('p_provisional', choice);
    // Warn if user choice contradicts auto-determination
    if(overrideEl) {
      const userYes = choice === 'yes', autoYes = r.auto;
      if(userYes !== autoYes) {
        overrideEl.innerHTML = '<div class="note warning" style="margin:0"><i class="material-symbols-outlined msi-warning u-mr-5"></i>Your override (<strong>' + choice.toUpperCase() + '</strong>) differs from auto-determination (<strong>' + (autoYes ? 'YES' : 'NO') + '</strong>). Ensure this is correct.</div>';
      } else {
        overrideEl.innerHTML = '';
      }
      overrideEl.style.display = (userYes !== autoYes) ? 'block' : 'none';
    }
  }
  onProvisionalChange();
  debounceSave();
}

export function onProvisionalChange() {
  /* V8.6 L2: respect auto-determined status, not only the p_provisional hidden field.
     If override is 'auto', use the auto result. Otherwise use the override value. */
  const status = gs('p_prov_status') || 'auto';
  let show;
  if (status === 'auto') {
    const r = (typeof isProvisionalAutoDetermined === 'function') ? isProvisionalAutoDetermined() : { auto: false };
    show = !!r.auto;
    /* Also sync the hidden p_provisional field so downstream reads agree */
    sv('p_provisional', show ? 'yes' : 'no');
  } else {
    show = gs('p_provisional') === 'yes';
  }
  const content = $('card-provisional');
  const notApplicable = $('prov-not-applicable');
  if(content) content.style.display = show ? 'block' : 'none';
  if(notApplicable) notApplicable.style.display = show ? 'none' : 'block';
}

export function onProvStatusChange() {
  const s = gs('p_prov_status');
  const show = (id, cond) => { const e=$(id); if(e) e.style.display = cond ? 'block' : 'none'; };
  show('row-prov-p1', s !== 'none');
  show('row-prov-p2', s === 'p1p2' || s === 'all');
  show('row-prov-topup', s === 'all');
  debounceSave();
}

/* V8.4 B: Medical aid member toggle - show/hide scheme name field. */
export function onMedicalAidToggle() {
  const v = gs('p_has_medical_aid');
  const field = $('medscheme-field');
  if(field) field.style.display = v === 'yes' ? 'block' : 'none';
  if(v === 'no') {
    sv('p_medscheme', '');
  }
  debounceSave();
}

/* V8.4 B: SARS Tax Reference - 10 digits numeric validation. */
export function onTaxRefInput(el) {
  // Strip non-digits as user types
  el.value = (el.value || '').replace(/\D/g, '').slice(0, 10);
  const ok = el.value.length === 0 || el.value.length === 10;
  el.style.borderColor = !ok ? 'var(--er)' : '';
  const errEl = $('taxref-error'); if(errEl) errEl.style.display = !ok ? 'block' : 'none';
  debounceSave();
}

/* ── ONBOARDING INPUT MASKS + INLINE VALIDATION ──────────────────────────────
   Masks display formatting while storing raw digits; inline errors hold back
   until the user has entered enough to judge (full length, or on blur) so we
   never scold mid-typing. Raw digits are re-extracted on save. */
export function _obSetFieldError(id, msg) {
  const el = $(id); if (el) el.style.borderColor = msg ? 'var(--er)' : '';
  const e = $(id + '-error');
  if (e) { if (msg) { e.textContent = msg; e.style.display = 'block'; } else e.style.display = 'none'; }
}
/* ── ON-BLUR FIELD VALIDATION (owner interview 2026-10-07, BACKLOG 36) ──────
   One validator for every capture form (list-editor sheets, wizards, the
   deduction tabs). A problem shows INLINE under its field — red border, one
   line of text, aria-invalid, aria-describedby — never as a toast.
     when   silent while typing; checked when the field is left; cleared as
            soon as the value is fixed. An empty required field the user never
            touched is flagged only by Save / Next (checkScope includeEmpty).
     what   generic: required (data-req) and min/max on masked numbers;
            field-specific: FIELD_CHECKS (01-data.js), incl. plausibility rules
            evaluated at their field.
     level  'error' blocks Save / Next and the deduction tabs' auto-commit;
            'warning' (amber) never blocks.
   Copy: copy deck C-65. */
const FV_MSG_REQUIRED = { num: 'Enter an amount.', select: 'Choose an option.', text: 'This is required.' };
function _fvBox(el) { return el.closest('.form-group') || el.parentElement; }
/* The control the user sees for a field: a 'choice' or code picker keeps its
   value in a hidden <select> — mark the tiles / combobox instead. */
function _fvVisible(el) {
  const box = _fvBox(el);
  return (box && (box.querySelector('.cp-q') || box.querySelector('.yn-group'))) || el;
}
/* Live = not switched off by the form: inside a hidden / .u-hidden /
   display:none ancestor, or a gated-off wizard step. An inactive wizard step
   still counts (Save checks every step); a closed modal does not matter —
   callers scope to an open one. */
function _fvLive(el, root, anyDisplay) {
  if (el.disabled) return false;
  for (let n = _fvBox(el); n && n !== root && n !== document.body; n = n.parentElement) {
    if (n.hidden || (n.classList && (n.classList.contains('u-hidden') || n.hasAttribute('data-gated-off')))) return false;
    if (!anyDisplay && n.style && n.style.display === 'none') return false;
  }
  return true;
}
function _fvNum(id) { return gv(id) || 0; }
function _fvStr(id) { return gs(id) || ''; }
const _fvEnv = { remuneration: () => calcRemunerationBase(APP.incomeItems) };
/* The problem with one field, or null. `includeEmpty` flags an empty
   required field (Save / Next, or the user cleared it). */
/* BACKLOG 63 (OI-C1d): the costs that reduce an income-type other receipt —
   only on a kind in OTHER_RECEIPT_COST_KINDS (01-data, which cites s11(a) and
   s23(g)), and never below nil: a loss belongs on Business (s20). */
export function otherReceiptCosts(r) {
  if (!r || r.receiptType !== 'income' || OTHER_RECEIPT_COST_KINDS.indexOf(r.category) < 0) return 0;
  const costs = (r.expenses || []).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
  return Math.min(Math.max(0, r.amount || 0), Math.max(0, costs));
}

export function fieldProblem(el, includeEmpty) {
  if (!el || !el.id) return null;
  const raw = String(el.value == null ? '' : el.value).trim();
  const isNum = el.classList.contains('mask-rand') || el.classList.contains('mask-pct') || el.classList.contains('mask-int');
  if (el.hasAttribute('data-req') && includeEmpty) {
    const empty = isNum ? (el.getAttribute('data-req') === 'zero-ok' ? raw === '' : !(parseFmt(raw) > 0)) : raw === '';
    if (empty) return { level: 'error', msg: FV_MSG_REQUIRED[isNum ? 'num' : (el.tagName === 'SELECT' ? 'select' : 'text')] };
  }
  if (isNum && raw !== '') {
    const v = parseFmt(raw), pct = el.classList.contains('mask-pct') ? '%' : '';
    const min = el.getAttribute('min'), max = el.getAttribute('max');
    if ((min != null && min !== '' && v < Number(min)) || (max != null && max !== '' && v > Number(max))) {
      return { level: 'error', msg: 'Enter a value from ' + (min || 0) + pct + ' to ' + max + pct + '.' };
    }
  }
  for (const fc of FIELD_CHECKS) {
    if (fc.el !== el.id) continue;
    if (fc.check) { const m = fc.check(_fvNum, _fvStr); if (m) return { level: fc.level || 'error', msg: m }; }
    if (fc.plausibility) {
      const hits = plausibilityHits(fc.plausibility, fc.ctx(_fvNum, _fvStr, _fvEnv));
      if (hits.length) return { level: hits.some(h => h.blocksSave) ? 'error' : 'warning', msg: hits[0].text, note: fc.note };
    }
  }
  return null;
}
/* Paint (or clear, p = null) one field's problem. */
export function showFieldProblem(el, p) {
  const box = _fvBox(el); if (!box) return;
  const vis = _fvVisible(el);
  const msgId = 'fvm-' + el.id;
  let m = document.getElementById(msgId);
  box.classList.toggle('fv-error', !!p && p.level === 'error');
  box.classList.toggle('fv-warn', !!p && p.level === 'warning');
  if (!p) {
    vis.removeAttribute('aria-invalid');
    if (m) m.remove();
    const d = (vis.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== msgId && !x.startsWith('fvn-')).join(' ');
    if (d) vis.setAttribute('aria-describedby', d); else vis.removeAttribute('aria-describedby');
    return;
  }
  if (p.level === 'error') vis.setAttribute('aria-invalid', 'true'); else vis.removeAttribute('aria-invalid');
  /* A plausibility rule's text already shows in its own note under the field:
     point at that note rather than print the sentence twice. */
  let describedBy = msgId;
  if (p.note && document.getElementById(p.note)) {
    if (m) m.remove();
    describedBy = p.note;
  } else {
    if (!m) {
      m = document.createElement('div');
      m.id = msgId; m.className = 'field-msg'; m.setAttribute('aria-live', 'polite');
      box.appendChild(m);
    }
    m.className = 'field-msg ' + (p.level === 'error' ? 'is-error' : 'is-warn');
    m.textContent = p.msg;
  }
  const ids = (vis.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== msgId && x !== describedBy);
  ids.push(describedBy);
  vis.setAttribute('aria-describedby', ids.join(' '));
}
const FV_SEL = 'input.form-input, select.form-select, select.cp-store, select[data-req], textarea.form-input';
/* Check every live field in `root`; paint each; return the first field with
   an error (or null). `focus` moves to it — Save / Next. `anyDisplay`: a
   field in a section the user has merely collapsed (inline display:none)
   still counts — the deduction tabs, whose figures stand whether or not
   their section is open. */
export function checkScope(root, opts) {
  opts = opts || {};
  let first = null;
  root.querySelectorAll(FV_SEL).forEach(el => {
    if (!el.id || !_fvLive(el, root, opts.anyDisplay)) { if (el.id) showFieldProblem(el, null); return; }
    const p = fieldProblem(el, opts.includeEmpty !== false);
    showFieldProblem(el, p);
    if (p && p.level === 'error' && !first) first = el;
  });
  if (first && opts.focus !== false) _fvFocus(first);
  return first;
}
/* Show a problem a list editor's own validate() found ({el, msg}). */
export function flagField(id, msg) {
  const el = $(id); if (!el) return null;
  showFieldProblem(el, { level: 'error', msg });
  _fvFocus(el);
  return el;
}
function _fvFocus(el) {
  /* A field on another wizard step: go to that step first. */
  const step = el.closest('.wiz-step'), m = el.closest('.modal-overlay');
  if (step && m && m.id && !step.classList.contains('active')) { const i = wizLiveSteps(m).indexOf(step); if (i >= 0) wizGoto(m.id, i); }
  const t = _fvVisible(el);
  const target = t.classList && t.classList.contains('yn-group') ? (t.querySelector('input') || t) : t;
  try { target.focus({ preventScroll: true }); } catch (e) {}
  try { (_fvBox(el) || target).scrollIntoView({ block: 'center' }); } catch (e) {}
}
function _fvTarget(t) {
  if (!t || !t.matches) return null;
  if (t.matches(FV_SEL)) return t;
  /* A choice tile or code-picker combobox stands for its hidden select. */
  if (!t.matches('.cp-q, .yn-group input')) return null;
  const box = t.closest('.form-group');
  return box ? box.querySelector('select.cp-store, select[hidden]') : null;
}
/* Mark a field touched on input; recheck a field already showing a problem
   so it clears as soon as it is fixed. */
document.addEventListener('input', e => {
  const el = _fvTarget(e.target); if (!el || !el.id) return;
  el.dataset.fvTouched = '1';
  const box = _fvBox(el);
  if (box && (box.classList.contains('fv-error') || box.classList.contains('fv-warn'))) showFieldProblem(el, fieldProblem(el, true));
});
document.addEventListener('focusout', e => {
  const el = _fvTarget(e.target); if (!el || !el.id || !el.closest('.modal-overlay, [id^="tab-ded-"]')) return;
  showFieldProblem(el, fieldProblem(el, el.dataset.fvTouched === '1'));
});
document.addEventListener('change', e => {
  const el = _fvTarget(e.target); if (!el || !el.id || !el.closest('.modal-overlay, [id^="tab-ded-"]')) return;
  el.dataset.fvTouched = '1';
  showFieldProblem(el, fieldProblem(el, true));
});
/* Clear every painted problem in root (a sheet opened afresh). */
export function clearFieldProblems(root) {
  if (!root) return;
  root.querySelectorAll(FV_SEL).forEach(el => { if (el.id) { delete el.dataset.fvTouched; showFieldProblem(el, null); } });
}

/* SARS 10-digit reference, grouped xxxx/xxx/xx/x. */
export function fmtSarsRef(d) {
  d = String(d || '').replace(/\D/g, '').slice(0, 10);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '/' + d.slice(4, 7);
  if (d.length > 7) out += '/' + d.slice(7, 9);
  if (d.length > 9) out += '/' + d.slice(9, 10);
  return out;
}
export function onObTaxRefInput(el) {
  const d = (el.value || '').replace(/\D/g, '').slice(0, 10);
  el.value = fmtSarsRef(d);
  /* clear the error as soon as it is empty or complete; stay silent while typing */
  if (d.length === 0 || d.length === 10) _obSetFieldError('ob-sars-ref', '');
}
export function onObTaxRefBlur(el) {
  const d = (el.value || '').replace(/\D/g, '');
  _obSetFieldError('ob-sars-ref', (d.length > 0 && d.length !== 10) ? 'SARS reference must be 10 digits.' : '');
}
/* Integer mask: digits only, strip any leading zero (never 0x). */
export function onObIntegerInput(el) {
  el.value = (el.value || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3);
}

/* ── EMAIL SUFFIX AUTOCOMPLETE (account creation) ──
   Populates a native <datalist> with common SA + global domains so the user
   can pick a full address without typing the suffix, yet stay free to enter
   any address. */
export const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'hotmail.com', 'live.com', 'webmail.co.za', 'mweb.co.za', 'telkomsa.net', 'vodamail.co.za'];
export function onEmailInput(el) {
  const dl = $('email-domain-suggestions'); if (!dl) return;
  const v = (el.value || '').trim();
  const at = v.indexOf('@');
  let opts = '';
  if (v && at === -1) {
    opts = EMAIL_DOMAINS.map(d => `<option value="${esc(v)}@${d}">`).join('');
  } else if (at >= 0) {
    const local = v.slice(0, at), part = v.slice(at + 1).toLowerCase();
    opts = EMAIL_DOMAINS.filter(d => d.startsWith(part)).map(d => `<option value="${esc(local)}@${d}">`).join('');
  }
  dl.innerHTML = opts;
}

/* ── HOME OFFICE OWNERSHIP TOGGLE ── */
export function onOwnershipChange() {
  const isOwn = gs('ho_ownership') === 'own';
  const show = (id, v) => { const e=$(id); if(e) e.style.display = v ? 'block' : 'none'; };
  show('ho-rent-wrap', !isOwn);
  show('ho-bond-wrap', isOwn);
  show('ho-rates-wrap', isOwn);
}

/* ── MEDICAL AID AUTOCOMPLETE (UX #15/#16) ── */
/* Smart-default ordering: common schemes first, then the rest alphabetical. */
function _medSchemeOrdered() {
  const common = SA_MEDICAL_AIDS_COMMON.filter(m => SA_MEDICAL_AIDS.indexOf(m) >= 0);
  const rest = SA_MEDICAL_AIDS.filter(m => common.indexOf(m) < 0);
  return common.concat(rest);
}
function _renderMedSchemeSuggestions(matches) {
  const sug = $('medscheme-suggestions'); if(!sug) return;
  if(!matches.length) { sug.style.display='none'; return; }
  sug.innerHTML = matches.map(m => `<div class="autocomplete-item" data-medscheme="${esc(m)}">${esc(m)}</div>`).join('');
  sug.style.display = 'block';
  // L-3 + H-2 fix: use event delegation instead of inline onclick string-escape.
  // Use mousedown (fires before the input's blur) + preventDefault (keeps focus)
  // so the selection lands reliably — a plain click was being pre-empted by the
  // blur-triggered hide on touch/WebView, so tapping an option did nothing.
  if (!sug._delegated) {
    sug.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (item && item.dataset.medscheme != null) {
        e.preventDefault();
        selectMedScheme(item.dataset.medscheme);
      }
    });
    sug._delegated = true;
  }
}
export function onMedSchemeInput(el) {
  debounceSave();
  const val = (el.value||'').toLowerCase();
  const list = _medSchemeOrdered();
  // Empty query → offer the common-first list so the user can pick without typing.
  _renderMedSchemeSuggestions(val ? list.filter(m => m.toLowerCase().includes(val)) : list);
}
/* UX #15: surface the list the moment the field is focused ("make the app do
   the typing"); hide shortly after blur so a suggestion click still registers. */
export function onMedSchemeFocus(el) {
  if (!el._blurWired) {
    el.addEventListener('blur', () => setTimeout(() => {
      const s = $('medscheme-suggestions'); if(s) s.style.display='none';
    }, 150));
    el._blurWired = true;
  }
  onMedSchemeInput(el);
}
export function selectMedScheme(name) {
  sv('p_medscheme', name); $('medscheme-suggestions').style.display='none'; debounceSave();
}

/* Fill a native <datalist> with the SA medical-scheme list (common first) so a
   plain text input gets autocomplete while still accepting any free-text name. */
export function populateMedSchemeDatalist(id) {
  const dl = $(id); if (!dl) return;
  dl.innerHTML = _medSchemeOrdered().map(m => `<option value="${esc(m)}">`).join('');
}

/* Medical-scheme membership (entitles the taxpayer to the s6A credit) is now
   derived from the captured contributions rather than an explicit "Self-paying?"
   question (removed 2026-06): any contribution to a registered scheme — paid by
   the member OR the employer — means the person is a member. Reads the live DOM. */
export function isMedicalSchemeMemberDom() {
  return (gv('med_monthly') > 0) || (gv('med_employer') > 0);
}

/* ── SOURCE CODE SELECTS ── */
/* V8.5: Income code dropdown uses workbook group order with tooltip (title) attribute.
   Groups maintain workbook insertion order (Main Income Codes first, then classification
   groups). Within each group, codes are ascending by code number.
   Bucket 6 (Foreign Service) codes are included for IRP5/IT3(a) capture;
   bucket-specific subpages route them in V8.5 Batch 2+. */
export function populateIncomeCodes() {
  const incSel = $('add-income-code');
  if(!incSel) return;
  /* task #17: Pension & Annuity removed from this general picker, same
     rationale as the earlier Lump Sums removal (RR v8.9.1) below — codes
     3603/3610/3611/3618 etc. duplicate the dedicated "Add Pension /
     Annuity" flow in the Retirement section (M_pension, 05-list-modules.js),
     which is the correct entry point and already offers them. 3610/3611/3618
     stay in IRP5_INCOME/IRP5_CODE_MAP; 3603 is offered only by that sheet
     (BACKLOG 24 audit). All four still power S10C_ANNUITY_CODES/para 5-6
     relief — only this picker's group list changed. */
  const GROUP_ORDER = ['Main Income Codes','Employment / Remuneration','Allowances','Fringe Benefits','Foreign Service']; /* RR (v8.9.1): Lump Sums removed from income-code capture — captured in the dedicated Retirement section (lump-sum + two-pot calculators) for correct table/cumulative tax */
  const groups = {};
  IRP5_INCOME.forEach(function(x){ if(!groups[x.group]) groups[x.group]=[]; groups[x.group].push(x); });
  const existing = incSel.value;
  /* S3 Batch 8/13 (D6): short name + plain hyphen, not the full SARS
     wording + em-dash \u2014 the tooltip (title=) still carries the full name
     for anyone who needs the exact SARS wording. INCOME_CODE_SHORT
     (01-data.js) is the one map D7's captured-row list also reads, so
     neither can drift from the other. */
  /* QR7.3 (Q-ONB-3 layer 2): foreign-service codes are offered only if the
     profile allows income from working abroad (`foreign:employment`) — the
     same gate on the code, its optgroup and its filter chip, evaluated by
     applyScenarioGates() at the end of this function. That also gates the
     emp-fx converter (onIncomeCodeChange shows it only for these codes) and
     the Foreign page's days test (locked until such a code is captured). */
  const FS_GATE = 'foreign:employment';
  const isFs = function(x){ return x.group === 'Foreign Service'; };
  const opt = function(x){
    const name = INCOME_CODE_SHORT[x.code] || x.name;
    return '<option value="' + esc(x.code) + '" title="' + esc(x.tooltip || x.name) + '" data-name="' + esc(name) + '"' + (isFs(x) ? ' data-show-when="' + FS_GATE + '"' : '') + '>' + esc(x.code) + ' - ' + esc(name) + '</option>';
  };

  /* QR8: this <select> is the picker's store — the combobox (00-forms.js,
     syncCodePicker) reads its options and groups on demand and writes the
     chosen code back here, so the options are the one source of what is
     offered. Fixed SARS groups in workbook order; Main Income Codes opens
     first (QD-15). */
  incSel.innerHTML = GROUP_ORDER.filter(function(g){ return groups[g]; }).map(function(g){
    return '<optgroup label="' + esc(g) + '"' + (g === 'Foreign Service' ? ' data-show-when="' + FS_GATE + '"' : '') + '>' + groups[g].map(opt).join('') + '</optgroup>';
  }).join('');

  /* Keep the selection if the list still offers it; otherwise none. A rebuilt
     <select> would default to its first code (3601) — the picker shows an
     empty box instead, never a code the user did not choose. */
  incSel.value = existing || '';
  applyScenarioGates(incSel.closest('.modal-overlay') || document);   // QR7.3: options were just rebuilt
  syncCodePicker(incSel);
}

export function populateSourceCodeSelects() {
  populateIncomeCodes();
  // Deduction codes
  const dedSel = $('add-ded-code');
  if(dedSel) {
    const dgroups = {};
    IRP5_DEDUCTIONS.forEach(x => { if(!dgroups[x.group]) dgroups[x.group]=[]; dgroups[x.group].push(x); });
    dedSel.innerHTML = Object.entries(dgroups).map(([g,items]) =>
      `<optgroup label="${esc(g)}">${items.map(x=>`<option value="${esc(x.code)}" data-name="${esc(x.name)}">${esc(x.code)} \u2014 ${esc(x.name)}</option>`).join('')}</optgroup>`
    ).join('');
    dedSel.value = '';   // QR8: the code is optional — never pre-select the first one
    syncCodePicker(dedSel);
  }
}

/* ── APPLY DEDUCTION (generic) ── */
/* V8.4 B3: APPLY BUTTON PATTERN
   When Apply is pressed:
   - The pending (live-calculated) value for this deduction is committed to APP.appliedValues
   - Full re-render is triggered, which propagates the new value to:
       * tax calculation and return (calcFullTax reads appliedValues)
       * selection page toggle amount (reads appliedValues)
       * subpage "Allowed" display
   - Toast confirms the action.
   Until Apply is pressed, none of those displays update — user sees the live preview
   in the calculator's own card but downstream displays remain frozen at last-applied state. */
/* v8.13 B1: Input-level dirty tracking — banner reflects USER EDITS, not calc drift.
   Snapshot stores restorable JSON (fields object or array clone) so DISCARD can
   do a full restore. Fingerprint uses the same JSON form for consistent compare. */
export var DIRTY_FIELDS = {
  retirement: ['ded_pension','ded_provident','ded_ra'],
  medical:    ['med_self_premium','med_monthly','med_employer','med_has_deps','med_deps','med_oop','med_disability','med_main'],
  travel:     ['tv_vehicle_val','tv_acq_type','tv_date_acq','tv_odo_open','tv_odo_close','tv_bus_km','tv_fuel','tv_maint','tv_insure','tv_finance','tv_lease_pay'], /* removed non-input travelMethodToggle */
  homeoffice: ['ho_ownership','ho_area_total','ho_area_office','ho_over50','ho_exclusive','ho_months_used','ho_rent','ho_bond_int','ho_rates','ho_elec','ho_levies','ho_phone','ho_other_direct'],
  subscrip:   ['ded_subscrip'],
  subsistence: ['subsistence-days','subsistence-rate-type']
};
export var DIRTY_ARRAYS = {
  tools:'toolsWtItems', donations:'donationItems', rental:'rentalProperties',
  cgt:'cgtAssets', business:'businessItems', interest:'it3bItems'
};
export function inputFingerprint(type) {
  if (DIRTY_ARRAYS[type]) return JSON.stringify(APP[DIRTY_ARRAYS[type]] || []);
  var f = DIRTY_FIELDS[type] || [], snap = {};
  f.forEach(function(id){ var el=document.getElementById(id); if(el) snap[id] = el.value; });
  return JSON.stringify(snap);
}
export function snapshotInputs(type) {
  if(!APP.inputSnapshot) APP.inputSnapshot = {};
  APP.inputSnapshot[type] = inputFingerprint(type);
}
export function hasUnappliedEdits(type) {
  if(!APP.inputSnapshot || APP.inputSnapshot[type] == null) return false;
  return inputFingerprint(type) !== APP.inputSnapshot[type];
}
/* U2a DISCARD = full restore (LOCKED). Restores fields/array to the snapshot,
   then caller re-snapshots + re-renders so the banner clears. */
export function restoreInputs(type) {
  if(!APP.inputSnapshot || APP.inputSnapshot[type] == null) return;
  if (DIRTY_ARRAYS[type]) {
    try { APP[DIRTY_ARRAYS[type]] = JSON.parse(APP.inputSnapshot[type]); } catch(e){}
  } else {
    var snap = {}; try { snap = JSON.parse(APP.inputSnapshot[type]); } catch(e){}
    Object.keys(snap).forEach(function(id){ var el=document.getElementById(id); if(el) el.value = snap[id]; });
  }
}
/* N1a: Navigate-up map — verified against v8.12 PRE-FLIGHT (do not change without re-running) */
export var APPLY_PARENT = {
  retirement:['deductions','selections'], medical:['deductions','selections'],
  travel:['deductions','selections'], homeoffice:['deductions','selections'],
  tools:['deductions','selections'], donations:['deductions','selections'],
  subscrip:['deductions','selections'], subsistence:['deductions','selections'],
  interest:['income','main'], rental:['income','main'],
  cgt:['income','main'], business:['income','main']
};

/* Commit the live pending value for a deduction type into appliedValues
   (the store the tax engine reads). Pure state mutation — no render, no toast.
   Used by applyDeduction and by the list-CRUD save/remove auto-commit path. */
export function commitPending(type) {
  const pendingVal = APP.pendingValues[type];
  if(pendingVal != null) {
    APP.appliedValues[type] = pendingVal;
  } else if(APP.appliedValues[type] == null) {
    APP.appliedValues[type] = 0;
  }
  /* IT3(b) foreign tax (codes 4112/4113) is no longer flattened into an
     appliedValues.ftcIt3b store here: calcFullTax() computes the dividend and
     interest s6quat baskets directly from APP.it3bItems, ring-fenced per source
     code. The legacy pooled fallback is gone (it double-taxed the limitation). */
  /* Snapshot inputs so any residual dirty-state machinery reads "clean". */
  if (typeof snapshotInputs === 'function') snapshotInputs(type);
}

/* Batch A (UX #7) — "save as you go". applyDeduction is now the silent
   auto-commit invoked on field blur / select change / list save: it commits
   pending→applied, persists, re-renders downstream, and flashes a transient
   "Saved" indicator. The old Apply-button behaviour (loud toast + navigate to
   Selections) is gone — there is no Apply button. The appliedValues engine
   contract is unchanged, so the golden tests are unaffected. */
export function applyDeduction(type) {
  /* On-blur validation (BACKLOG 36): a field-level error on this tab — an
     impossible value, or a plausibility rule with `blocksSave` (QD-19 as
     amended 2026-10-05) — keeps the value out of the calculation; the last
     committed figure stands. Warnings never block. Not-yet-entered required
     fields are not checked here: these tabs save as you go. */
  const tab = $('tab-ded-' + type);
  if (tab && checkScope(tab, { includeEmpty: false, focus: false, anyDisplay: true })) return;
  /* subscrip has no live calc — read its value straight from the DOM. */
  if (type === 'subscrip') {
    const el = document.getElementById('ded_subscrip');
    if (el) APP.pendingValues[type] = parseFmt(el.value);
  }
  const prev = APP.appliedValues[type];
  /* B-2 / PAYE-GEN-01-G03 review: the company-car deduction
     (calcCompanyCarDeduction, 04-deductions.js) shares the Travel tab with
     the s8(1)(b) allowance deduction, and the foreign-subsistence
     deduction (calcForeignSubsistence) shares the Subsistence tab with the
     local one — each pair tracked under its own appliedValues key so their
     distinct SARS citations never merge into one trace line. Commit the
     companion key on any blur of its tab, and treat either changing as a
     real edit for the no-op check below. */
  const _companion = { travel: 'companycar', subsistence: 'foreignSubsistence' }[type];
  const prevCompanion = _companion ? APP.appliedValues[_companion] : undefined;
  commitPending(type);
  if (_companion) commitPending(_companion);
  /* No-op blur (value unchanged): persist quietly but skip the heavy re-render
     and the "Saved" flash — avoids yanking focus/scroll on every tab-out. */
  const _noRealChange = (APP.appliedValues[type] === prev)
    && (!_companion || APP.appliedValues[_companion] === prevCompanion);
  if (_noRealChange) { debounceSave(); return; }
  persistData();
  noteStepCompleted('deduction');   // QR10a.3: a deduction figure the user just committed
  if(typeof renderAll === 'function') renderAll();
  if(typeof renderTaxReturn === 'function') renderTaxReturn();
  if(typeof updatePendingIndicators === 'function') updatePendingIndicators();
  flashSaved();
}

/* Batch A (UX #7) — transient "Saved" indicator (top-right). Behaves like the
   toast (a timed transient, excluded from screenshot baselines): only fires on
   real user edits, never during render/fixtures. */
var _savedTimer = null;
var _savedPhaseTimer = null;
/* Save pill morph (design handoff 07-surfaces-and-motion.md §E): saving
   (200ms, spinner) -> saved (mint check, held) -> idle, 1.6s total —
   replaces the old flat "Saved" text swap. */
export function flashSaved() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show', 'saving');
  el.innerHTML = '<i class="material-symbols-outlined msi-progress-activity save-indicator-spin"></i> Saving…';
  clearTimeout(_savedTimer);
  clearTimeout(_savedPhaseTimer);
  _savedPhaseTimer = setTimeout(function () {
    el.classList.remove('saving');
    el.innerHTML = '<i class="material-symbols-outlined msi-check"></i> Saved';
  }, 200);
  _savedTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
}

/* Batch A (UX #7) — delegated auto-commit. A bubble-phase listener (runs AFTER
   the field's own inline oninput/onchange handler has refreshed pendingValues):
     • change  → commit (covers selects, radios and the yn-tile pickers, which
                 dispatch a bubbling 'change' on the hidden control)
     • focusout→ commit (text/number inputs, "the moment you click out")
   Scoped to the field-driven deduction tabs + the prior-year inputs. The
   list-driven calculators (interest/rental/cgt/business/donations/tools) commit
   from their save/remove handlers instead. */
var AUTO_APPLY_TAB_TYPE = {
  'tab-ded-retirement': 'retirement',
  'tab-ded-medical':    'medical',
  'tab-ded-travel':     'travel',
  'tab-ded-homeoffice': 'homeoffice',
  'tab-ded-subscrip':   'subscrip',
  'tab-ded-subsistence': 'subsistence'
};
function _autoApplyFromEvent(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.id && t.id.indexOf('py_') === 0) {     /* Prior Year amounts */
    if (typeof applyPriorYear === 'function') applyPriorYear();
    return;
  }
  const tab = t.closest('.tab-section');
  if (!tab) return;
  const type = AUTO_APPLY_TAB_TYPE[tab.id];
  if (type) applyDeduction(type);
}
export function initAutoApply() {
  if (APP._autoApplyInit) return;
  APP._autoApplyInit = true;
  document.addEventListener('change', _autoApplyFromEvent);   /* bubble phase */
  document.addEventListener('focusout', _autoApplyFromEvent); /* bubble phase */
}

/* V8.4 B3 → V8.13 B1: delegates to input-level hasUnappliedEdits so banner
   is driven by USER EDITS only (calc drift no longer fires it). */
export function hasPendingChanges(type) {
  return (typeof hasUnappliedEdits === 'function') ? hasUnappliedEdits(type) : false;
}

export function updatePendingIndicators() {
  const types = ['retirement','medical','travel','homeoffice','interest','tools','cgt','rental','donations'];
  types.forEach(t => {
    const btn = document.querySelector('[data-apply-btn="' + t + '"]');
    if(btn) {
      const pending = hasPendingChanges(t);
      btn.classList.toggle('btn-pending', pending);
      const badge = btn.querySelector('.pending-badge');
      if(pending && !badge) {
        const b = document.createElement('span');
        b.className = 'pending-badge';
        b.textContent = '\u2022';
        b.style.cssText = 'margin-left:6px;color:var(--wn);font-size:1.125rem;line-height:0';
        btn.appendChild(b);
      } else if(!pending && badge) {
        badge.remove();
      }
    }
  });
  /* v8.22 FINAL: single choke point — every indicator refresh repaints EVERY banner system.
     Root cause of "Unapplied changes persists": income-tab + prior-year banners were painted
     only by renderAll (which runs BEFORE the arrival re-baseline) and nothing repainted them
     after the dirty state was cleared, so a stale 'active' class stayed visible. */
  if (typeof updateAllDirtyBanners === 'function') { try { updateAllDirtyBanners(); } catch(e){} }
  if (typeof updateIncomeDirtyBanners === 'function') { try { updateIncomeDirtyBanners(); } catch(e){} }
  if (typeof updatePriorYearDirty === 'function') { try { updatePriorYearDirty(); } catch(e){} }
}


