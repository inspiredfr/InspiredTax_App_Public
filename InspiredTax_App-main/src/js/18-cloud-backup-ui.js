/* ============================================================
   InspiredTax — CLOUD BACKUP: wiring + UI (qa-remediation-2026-09 QR10a)

   17-cloud-backup.js holds the rules and imports nothing; this module binds
   them to the app — the clock, the Capacitor plugin, this profile's storage,
   the vault (envelope + sealed account e-mail), the one restore path — and
   draws the Backup & Export modal's Row 2. The split mirrors
   14-entitlement.js / 15-entitlement-ui.js.

   EVERYTHING here is behind CLOUD_BACKUP_ENABLED (01-data.js, false): every
   exported hook returns immediately, the controller is never even built, and
   Row 2 stays hidden. The hooks are called from 02-core.js (save, lock,
   foreground, logout, deduction/CRUD/onboarding/provisional steps) — they are
   the only coupling, and they cost nothing while the switch is off.
   ============================================================ */
import { CLOUD_BACKUP_ENABLED } from './01-data.js';
import { $, APP, SK, getUserPii, openModal, closeModal, showToast, katReact, openBackupModal, _showBackupResult,
         _sealBackupEnvelope, _fingerprintOf, _importFromParsed, _bindDriveAccount } from './02-core.js';
import { createCloudBackup, cbWait, cbReason, CB_EXIT_WAIT_MS } from './17-cloud-backup.js';

/* The native plugin, or null where there is none (a browser, a test build). */
function _plugin() {
  return (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins
    && window.Capacitor.Plugins.CloudBackup) || null;
}

/* Lazy, so nothing is constructed (and no foreign binding is read at module
   evaluation — hard rule 10) unless the feature is on. */
let _cb = null;
function cb() {
  if (_cb) return _cb;
  _cb = createCloudBackup({
    now: () => Date.now(),
    plugin: _plugin,
    switchOn: () => CLOUD_BACKUP_ENABLED,
    load: user => {
      const u = user || APP.user;
      if (!u) return null;
      try { return JSON.parse(localStorage.getItem(SK.cloudBackup(u))); } catch (e) { return null; }
    },
    save: (rec, user) => {
      const u = user || APP.user;
      if (!u) return;
      try { localStorage.setItem(SK.cloudBackup(u), JSON.stringify(rec)); } catch (e) { /* quota — the record just stays stale */ }
    },
    profileKey: () => APP.user,
    account: () => getUserPii().driveAccount || '',
    setAccount: email => _bindDriveAccount(email),
    buildEnvelope: () => _sealBackupEnvelope(),
    applyRestore: parsed => _importFromParsed(parsed, { source: 'cloud' }),
    remind: (text) => { showToast(text, 'cloud_alert', 'warning'); katReact('backup'); },   // QR11: the mascot's backup-reminder reaction
    onChange: () => { renderCloudBackupRow(); renderCloudBackupOffer(); },
  });
  return _cb;
}

/* ── Hooks called from 02-core / 05 / 12 (all no-ops while the switch is off) ── */

/* persistData() just serialised the saved data block. Fingerprint it and let
   the scheduler decide (data-changed test, the 30-minute foreground rule). */
export function cloudBackupNoteSaved(dataJson) {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const c = cb();
  if (!c.isLive()) return;
  _fingerprintOf(dataJson).then(fp => c.noteDataChanged(fp)).catch(e => console.warn('cloud backup fingerprint:', e));
}
/* One "a step was completed" signal (CRUD save, deduction commit, onboarding,
   provisional review) — QR11's mascot reuses it rather than adding a second. */
export function cloudBackupNoteStep(kind) {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  cb().noteStepCompleted(kind);
}
/* Unlock / start of a session. */
export function cloudBackupSessionStart() {
  if (!CLOUD_BACKUP_ENABLED) return;
  /* FAQ sentences that describe cloud backup ship hidden and appear only when
     the feature is on — the copy must never promise what the switch withholds. */
  document.querySelectorAll('[data-cloud-backup-copy]').forEach(el => el.classList.remove('u-hidden'));
  const c = cb();
  c.resetSession();
  c.noteActive(true);
  c.checkReminder('unlock');
  renderCloudBackupRow();
}
/* Foreground (true) / background or lock (false): only foreground unlocked
   time counts toward the 30-minute rule; returning to the app is a natural
   moment for the reminder. */
export function cloudBackupActive(on) {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const c = cb();
  c.noteActive(!!on);
  if (on) c.checkReminder('resume');
}
/* Auto-lock: the caller has NOT yet cleared the vault key — the envelope is
   built synchronously inside this call. The upload may finish after the lock. */
export function cloudBackupOnLock() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return null;
  return cb().onLock();
}
/* Logout: same, but the page reloads right after, so the caller awaits the
   returned promise — bounded, so an offline logout never hangs. */
export function cloudBackupOnLogout() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return null;
  return cbWait(cb().onLogout(), CB_EXIT_WAIT_MS);
}

/* ── Deletion (QX-DRV-4) ── */

/* The tick-box offered in Delete Account and Reset all data when this profile
   has (or may have) cloud copies. Renders nothing while the switch is off. */
export function renderCloudDeleteOffer(containerId, checkboxId, checked) {
  const el = $(containerId);
  if (!el) return;
  if (!CLOUD_BACKUP_ENABLED || !APP.user || !cb().hasCloudCopies()) { el.innerHTML = ''; return; }
  /* Constant ids and copy only — no user text reaches this markup. */
  el.innerHTML = '<div class="form-group" style="margin-top:14px"><label class="cloud-delete-offer" for="' + checkboxId + '">'
    + '<input type="checkbox" id="' + checkboxId + '"' + (checked ? ' checked' : '') + '> '
    + '<span>Also delete my cloud backups from Google Drive</span></label></div>';
}
/* Called before the local wipe, while the account binding is still readable.
   { ok:true } means "go ahead" (nothing asked for, or the delete worked);
   { ok:false, message } means the user asked and it did not work — the caller
   shows the message and stops. */
export async function cloudBackupDeleteRequested(checkboxId) {
  if (!CLOUD_BACKUP_ENABLED) return { ok: true };
  const box = $(checkboxId);
  if (!box || !box.checked) return { ok: true };
  const r = await cb().deleteCloudCopies();
  if (r.ok) return { ok: true };
  const why = cbReason(r.code);
  return { ok: false, message: 'Your cloud backups could not be deleted' + (why ? ': ' + why.short : '.')
    + ' Untick the box to continue without deleting them, or try again.' };
}

/* After a Reset all data that kept the cloud copies: pause cloud backup. The next
   automatic backup would upload the emptied profile and rotate the old data
   into the only "previous" slot — a second one destroys it. The user turns it
   back on when ready. Called once the reset has gone ahead. */
export function cloudBackupPauseAfterReset() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const c = cb();
  if (!c.isLive()) return;
  c.disable();
  showToast('Cloud backup is off after the reset. Turn it on again when you are ready.', 'cloud_off', 'info');
}
/* Does a profile that is NOT signed in (the saved-profiles list) have cloud
   copies? Reads its plain record only — no Google call. */
export function cloudBackupHasCopiesFor(user) {
  if (!CLOUD_BACKUP_ENABLED || !user) return false;
  try {
    const r = JSON.parse(localStorage.getItem(SK.cloudBackup(user)));
    return !!(r && (r.enabled === true || typeof r.lastSuccessAt === 'number'));
  } catch (e) { return false; }
}

/* ── The one offer (QD-07) ── */

/* The Backup entry's own label, read from the drawer rather than typed here,
   so renaming that entry cannot leave this card pointing at a name that no
   longer exists (WR-7). */
function _backupEntryLabel() {
  const el = document.querySelector('.drawer-item[onclick*="openBackupModal"] .drawer-item-label');
  return (el && el.textContent.trim()) || 'Backup';
}

/* QD-07: cloud backup is off until the user turns it on, and is offered
   exactly once — a dismissible card on the Dashboard once onboarding is done.
   Turning it on or pressing "Not now" retires the card for good (offerDue,
   17-cloud-backup.js); after that the only way in is the Backup screen.
   Shown only where turning it on can work: the feature live, a profile
   unlocked, and the native plugin present. Same shape as the QD-24 card
   (renderScenarioReviewCard, 08-dashboard-theme.js), which sits just above.
   `dueOverride` lets a test draw the card without the real (off) switch. */
export function renderCloudBackupOffer(dueOverride) {
  const host = $('dash-cloud-offer');
  if (!host) return;
  const due = dueOverride != null ? !!dueOverride
    : !!(CLOUD_BACKUP_ENABLED && APP.user && APP.onboardingCompleted && _plugin() && cb().offerDue());
  if (!due) { if (host.childElementCount) host.innerHTML = ''; return; }
  if (host.childElementCount) return;   // renderDashboard runs on every renderAll — don't rebuild (and re-announce) an unchanged card
  /* Constant copy only — no user text reaches this markup. */
  host.innerHTML = '<div class="note info" style="margin:0 0 16px"><strong>Back up to your own Google Drive?</strong> '
    + 'Cloud backup keeps an encrypted copy of your return in your Google Drive, so you can restore it if you lose or replace your phone. '
    + 'Only your PIN unlocks it. It stays off unless you turn it on.'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    + '<button type="button" class="btn btn-primary btn-sm" style="min-height:44px" onclick="cloudBackupOfferAccept()">Turn on cloud backup</button>'
    + '<button type="button" class="btn btn-ghost btn-sm" style="min-height:44px" onclick="cloudBackupOfferDismiss()">Not now</button></div></div>';
}
/* "Turn on cloud backup": the same explicit action as the Backup screen's
   toggle (QD-01 — this is one of the places a Google prompt may appear), run
   from that screen so its toggle, account line and result message are what
   the user sees. The card goes only if it really was turned on; a declined or
   failed sign-in leaves the offer standing. */
export async function cloudBackupOfferAccept() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  openBackupModal();
  await cloudBackupToggle(true);
  renderCloudBackupOffer();
}
/* "Not now": never offered again; say where to find it. */
export function cloudBackupOfferDismiss() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  cb().dismissOffer();
  renderCloudBackupOffer();
  showToast('You can turn on cloud backup any time under ' + _backupEntryLabel() + ' in the menu.', 'cloud_off', 'info');
}

/* ── Backup & Export modal, Row 2 (OD-41) ── */

function _fmt(ms) { return new Date(ms).toLocaleString(); }

/* Entirely hidden while the switch is off. `viewOverride` lets a test drive
   the states without the real (off) switch. */
export function renderCloudBackupRow(viewOverride) {
  const card = $('ds-cloud-card');
  if (!card) return;
  const v = viewOverride || (APP.user && CLOUD_BACKUP_ENABLED ? cb().view() : null);
  if (!v || !v.switchOn) { card.classList.add('u-hidden'); return; }
  card.classList.remove('u-hidden');
  const failing = v.enabled && !!v.reason;
  card.dataset.state = failing ? 'fail' : 'ok';
  const icon = $('ds-cloud-icon');
  if (icon) icon.className = 'material-symbols-outlined ' + (!v.enabled ? 'msi-cloud-off' : failing ? 'msi-cloud-alert' : 'msi-cloud-done');
  const sub = $('ds-cloud-sub');
  if (sub) sub.textContent = !v.enabled
    ? 'Off — nothing is saved to Google Drive.'
    : v.lastSuccessAt ? 'Last cloud backup: ' + _fmt(v.lastSuccessAt) : 'No cloud backup yet.';
  const acct = $('ds-cloud-account');
  if (acct) { acct.textContent = (v.enabled && v.account) ? 'Google account: ' + v.account : ''; acct.classList.toggle('u-hidden', !(v.enabled && v.account)); }
  const reason = $('ds-cloud-reason');
  if (reason) { reason.textContent = failing ? v.reason.short : ''; reason.classList.toggle('u-hidden', !failing); }
  const toggle = $('ds-cloud-toggle');
  if (toggle) { toggle.checked = !!v.enabled; toggle.disabled = !!v.inFlight; }
  const now = $('ds-cloud-now'); if (now) { now.classList.toggle('u-hidden', !v.enabled); now.disabled = !!v.inFlight; }
  const allow = $('ds-cloud-allow'); if (allow) allow.classList.toggle('u-hidden', !(failing && v.reason.action === 'allow'));
}
/* Called when the Backup modal opens. */
export function refreshCloudBackupRow() { renderCloudBackupRow(); }

function _showCloudFailure(title, code) {
  const why = cbReason(code);
  _showBackupResult('error', 'cloud_alert', title, why ? why.short : 'Please try again.');
}

export async function cloudBackupToggle(on) {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const c = cb();
  if (!on) {
    c.disable();
    _showBackupResult('amber', 'cloud_off', 'Cloud backup is off', 'Your existing cloud backups stay in your Google Drive until you delete the account or reset your data.');
    return;
  }
  const r = await c.enable();
  renderCloudBackupRow();
  if (!r.ok) { _showCloudFailure('Cloud backup is not on', r.code); return; }
  /* It IS on. The first backup is a separate result: say so honestly if it failed. */
  if (r.backup && !r.backup.ok && !r.backup.skipped) { _showCloudFailure('Cloud backup is on, but the first backup did not run', r.backup.code); return; }
  _showBackupResult('success', 'cloud_done', 'Cloud backup is on', 'Your encrypted backup is saved to your own Google Drive. Your PIN unlocks it.');
}

export async function cloudBackupNow() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const r = await cb().attempt('manual');
  renderCloudBackupRow();
  if (r.ok && r.skipped === 'UNCHANGED') { _showBackupResult('success', 'cloud_done', 'Already up to date', 'Nothing has changed since your last cloud backup.'); return; }
  if (r.ok) { _showBackupResult('success', 'cloud_done', 'Cloud backup saved', 'Your encrypted backup is saved to your own Google Drive.'); return; }
  _showCloudFailure('Cloud backup did not run', r.code);
}

/* "Allow access" — re-authorise: the same explicit action as turning it on. */
export async function cloudBackupAllow() { return cloudBackupToggle(true); }

export async function cloudBackupRestoreOpen() {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  const list = $('cloud-restore-list');
  if (list) list.textContent = 'Looking for your cloud backups…';
  openModal('modal-cloud-restore');
  const r = await cb().listRestorePoints();
  if (!list) return;
  list.textContent = '';
  if (!r.ok) { const why = cbReason(r.code); list.textContent = 'Could not reach your cloud backups. ' + (why ? why.short : 'Please try again.'); return; }
  if (!r.backups.length) { list.textContent = 'No cloud backups found for this profile.'; return; }
  const labels = { current: 'Latest backup', previous: 'Previous backup' };
  r.backups.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ds-export-action';
    const slot = b.slot === 'previous' ? 'previous' : 'current';
    btn.addEventListener('click', () => cloudBackupRestore(slot));
    const label = document.createElement('span'); label.className = 'ds-export-label'; label.textContent = labels[b.slot] || 'Backup';
    const sub = document.createElement('span'); sub.className = 'ds-export-sub'; sub.textContent = typeof b.savedAt === 'number' ? _fmt(b.savedAt) : '';
    btn.append(label, sub);
    list.appendChild(btn);
  });
}

export async function cloudBackupRestore(slot) {
  if (!CLOUD_BACKUP_ENABLED || !APP.user) return;
  closeModal('modal-cloud-restore');
  const r = await cb().restore(slot === 'previous' ? 'previous' : 'current');
  if (!r.ok) _showCloudFailure('Restore did not run', r.code);
}
