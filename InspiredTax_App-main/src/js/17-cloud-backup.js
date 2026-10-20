/* ============================================================
   InspiredTax — CLOUD BACKUP RULES (qa-remediation-2026-09 QR10a)

   The rules engine for backing a profile up to the user's own Google Drive
   app-data folder: WHEN a backup runs (scheduler), WHEN the user is reminded
   (QD-08), WHAT the user is told when it does not work (reason codes), and
   the JS <-> native contract (below). No I/O of its own.

   Everything ships behind CLOUD_BACKUP_ENABLED (01-data.js, false). While it
   is off nothing here does anything: no scheduler, no reminder, no UI.

   Deliberately imports nothing from the other app modules and touches no
   DOM, no localStorage and no plugin directly — every dependency (clock,
   plugin, storage, kill-switch, envelope builder, account binding) is INJECTED
   by 18-cloud-backup-ui.js. Same shape as 14-entitlement.js and for the same
   reasons: no import cycles (02-core imports FROM 18), and tests/cloud-backup.js
   can `require` it in Node with a mock plugin and a fake clock.

   ── Native plugin contract (window.Capacitor.Plugins.CloudBackup) ──────────
   Implemented by QR10b: android/…/CloudBackupPlugin.java, sharing
   TrialAnchor's account/token/HTTP helpers through GoogleDrivePlugin.java.
   Without the native plugin (browser, old APK) the accessor finds nothing and
   every call resolves { ok:false, code:'UNAVAILABLE' }. tests/cloud-backup.js
   §11 checks the Java side against this header.
     enable({ interactive:true, accountHint? })            -> { account }
         Always shows Google's sign-in screen (the user picks the account;
         accountHint is not used, so an account that left the phone can be
         replaced).
     putBackup({ profileKey, accountHint, envelope, interactive:false })
                                                            -> { savedAt }
         `envelope` is the JSON string of the encrypted backup envelope.
         Rotates current -> previous (QD-06), then writes current.
     listBackups({ profileKey, accountHint, interactive })  -> { backups:[{ slot, savedAt }] }
         slot is 'current' | 'previous'; newest first.
     getBackup({ profileKey, slot, accountHint, interactive }) -> { envelope }
     deleteBackups({ profileKey, accountHint, interactive:false }) -> { deleted }
   `profileKey` is the profile's username; native names files by a HASH of it
   (no PII in Drive file names):
     "itx-backup-" + sha256("inspiredtax-cloud-backup-v1:" + profileKey) + ".json"
   That prefix and salt must NEVER change — a reinstall finds its backups by them. Every backup is a new file; after
   it is written, copies past the newest two (by Drive's createdTime) are
   deleted, never the new one — `current` is the newest, `previous` the next.
   `accountHint` is the bound Google account e-mail (sealed PII on the JS
   side, QD-05): when present, native uses exactly that account; when absent,
   a silent call rejects SIGN_IN_REQUIRED (it never guesses) and an
   interactive one shows Google's sign-in screen. A call with
   interactive:false NEVER shows UI: it rejects SIGN_IN_REQUIRED instead
   (QX-AUTH-1). Reject codes: USER_DECLINED, SIGN_IN_REQUIRED, NETWORK_ERROR,
   NO_ACCOUNT, NO_PLAY_SERVICES, QUOTA_EXCEEDED, DRIVE_ERROR, NOT_FOUND, and
   ERROR for malformed arguments (a JS bug; cbReason's generic text).
   Only explicit user actions pass interactive:true (QD-01): turning cloud
   backup on, and restoring from it. Those three call sites are the top-level
   cb*Interactive() functions below — tests/entitlement.js's call-site audit
   allow-lists them by name, so a fourth cannot appear unnoticed.
   ============================================================ */

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

/* QD-08 / brief §2.2. Named here, not inline (hard rule 5's spirit). */
export const CB_INTERVAL_MS = 30 * MIN_MS;          // foreground-unlocked time between attempts
export const CB_REMIND_AGE_MS = 24 * HOUR_MS;       // oldest un-backed change older than this
export const CB_REMIND_EARLY_AGE_MS = 3 * HOUR_MS;  // ... or older than this AND
export const CB_REMIND_EARLY_STEPS = 5;             // ... this many un-backed completed steps
export const CB_REMIND_GAP_MS = 24 * HOUR_MS;       // at most one reminder per this
export const CB_BACKOFF_BASE_MS = 5 * MIN_MS;       // first retry delay; doubles per failure
export const CB_BACKOFF_MAX_MS = 6 * HOUR_MS;
/* A logout reloads the page, which would kill an in-flight upload; the caller
   waits for the backup at most this long (an offline logout must not hang). */
export const CB_EXIT_WAIT_MS = 8000;

/* ── Reasons (QD-08; Q-DRV-5 codes) ──
   The user is always told WHY a backup is not current. `short` reads after
   "…isn't in your cloud backup yet." and in the status row. `action` names
   the button that fixes it: 'allow' (re-authorise), 'retry', or none.
   FEATURE_OFF is deliberately absent — the kill-switch is never shown to
   users (cbReason returns null for it). */
export const CB_REASONS = {
  PENDING:           { short: 'The backup has not run since your latest changes.', action: 'retry' },
  NOT_ENABLED:       { short: 'Cloud backup is off.', action: null },
  SIGN_IN_REQUIRED:  { short: 'Google needs your permission again.', action: 'allow' },
  USER_DECLINED:     { short: 'Google access was not allowed.', action: 'allow' },
  NO_ACCOUNT:        { short: 'No Google account is signed in on this phone.', action: 'allow' },
  NETWORK_ERROR:     { short: 'You are offline. The backup runs again when you are back online.', action: 'retry' },
  QUOTA_EXCEEDED:    { short: 'Your Google Drive is full. Free some space, then tap Back up now.', action: 'retry' },
  DRIVE_ERROR:       { short: 'Google Drive could not save the backup.', action: 'retry' },
  NO_PLAY_SERVICES:  { short: 'Google Play services is not available on this phone.', action: null },
  UNAVAILABLE:       { short: 'Cloud backup is not available on this device.', action: null },
  ERROR:             { short: 'The last backup attempt failed.', action: 'retry' },
};
export function cbReason(code) {
  if (!code || code === 'OK' || code === 'FEATURE_OFF') return null;
  return CB_REASONS[code] || CB_REASONS.ERROR;
}

/* ── Per-profile record (QR10a.2) ──
   Plain, non-PII: the bound account e-mail is NOT here — it is sealed PII in
   the profile registry (hard rule 8). `lastFingerprint` is a SHA-256 of the
   saved data block, not the data. */
export const CB_STATE_VERSION = 1;
export function cbDefaultState() {
  return {
    v: CB_STATE_VERSION,
    enabled: false,
    lastSuccessAt: null,     // ms
    lastAttemptAt: null,     // ms
    lastResultCode: null,    // 'OK' | reason code
    lastFingerprint: null,   // fingerprint of the data in the last successful backup
    oldestUnbackedAt: null,  // ms of the oldest change not yet in a successful backup
    stepsSinceBackup: 0,     // completed steps not yet in a successful backup
    failures: 0,             // consecutive failed attempts (drives the backoff)
    backoffUntil: null,      // ms — automatic triggers wait until then
    lastReminderAt: null,    // ms
    offerDismissed: false,   // QD-07: the one dismissible offer
  };
}
/* Merge a stored record over the defaults, dropping anything of the wrong
   type — a corrupt record must degrade to "off", never throw. */
export function cbNormaliseState(raw) {
  const s = cbDefaultState();
  if (!raw || typeof raw !== 'object' || raw.v !== CB_STATE_VERSION) return s;
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  s.enabled = raw.enabled === true;
  s.lastSuccessAt = num(raw.lastSuccessAt);
  s.lastAttemptAt = num(raw.lastAttemptAt);
  s.lastResultCode = typeof raw.lastResultCode === 'string' ? raw.lastResultCode : null;
  s.lastFingerprint = typeof raw.lastFingerprint === 'string' ? raw.lastFingerprint : null;
  s.oldestUnbackedAt = num(raw.oldestUnbackedAt);
  s.stepsSinceBackup = Math.max(0, num(raw.stepsSinceBackup) || 0);
  s.failures = Math.max(0, num(raw.failures) || 0);
  s.backoffUntil = num(raw.backoffUntil);
  s.lastReminderAt = num(raw.lastReminderAt);
  s.offerDismissed = raw.offerDismissed === true;
  return s;
}

/* Delay before the next automatic attempt after `failures` failures in a row:
   5 min, 10, 20 … capped. Manual "Back up now" ignores it. */
export function cbBackoffMs(failures) {
  const n = Math.max(1, failures | 0);
  return Math.min(CB_BACKOFF_MAX_MS, CB_BACKOFF_BASE_MS * Math.pow(2, n - 1));
}

/* ── Reminder rule (QD-08) — pure ──
   Returns null, or { code, reason, ageMs } when the user should be told their
   latest changes are not in a cloud backup. Callers evaluate it only at
   natural moments (unlock, return to foreground, step completed) — never on a
   timer. ctx: { switchOn, sessionReminded }. */
export function cbReminderDue(rec, now, ctx) {
  if (!ctx || !ctx.switchOn) return null;                       // kill-switch off: nothing surfaces
  if (!rec || !rec.enabled) return null;                        // off by the user's choice: they were told when they switched it off
  if (rec.oldestUnbackedAt == null) return null;                // nothing un-backed
  if (ctx.sessionReminded) return null;                         // once per session
  if (rec.lastReminderAt != null && now - rec.lastReminderAt < CB_REMIND_GAP_MS) return null;  // once per 24 h
  const ageMs = now - rec.oldestUnbackedAt;
  const stale = ageMs >= CB_REMIND_AGE_MS
    || (ageMs >= CB_REMIND_EARLY_AGE_MS && rec.stepsSinceBackup >= CB_REMIND_EARLY_STEPS);
  if (!stale) return null;
  const code = (rec.lastResultCode && rec.lastResultCode !== 'OK') ? rec.lastResultCode : 'PENDING';
  const reason = cbReason(code) || CB_REASONS.PENDING;
  return { code, reason, ageMs };
}

/* ── The explicit-action plugin calls (QD-01) ──
   Top-level functions ON PURPOSE: tests/entitlement.js 15i finds the enclosing
   function of every `interactive: true` and allow-lists it by name. */
export function cbEnableInteractive(plugin, accountHint) {
  return plugin.enable({ interactive: true, accountHint: accountHint || undefined });
}
export function cbListInteractive(plugin, profileKey, accountHint) {
  return plugin.listBackups({ profileKey, accountHint: accountHint || undefined, interactive: true });
}
export function cbFetchInteractive(plugin, profileKey, slot, accountHint) {
  return plugin.getBackup({ profileKey, slot, accountHint: accountHint || undefined, interactive: true });
}

function _codeOf(e) { return (e && e.code) ? String(e.code) : 'ERROR'; }

/* ── The controller ──
   deps (all injected):
     now()                 -> ms
     plugin()              -> the CloudBackup plugin or null
     switchOn()            -> CLOUD_BACKUP_ENABLED
     load(user) / save(rec, user) -> that profile's record (localStorage); `user`
                              is omitted for "the current profile" and passed by an
                              attempt so its result is recorded against the profile it
                              started for even after logout has cleared the session
     profileKey()          -> APP.user
     account()             -> bound Google account e-mail ('' if none)
     setAccount(email)     -> Promise — seals it into the profile's PII
     buildEnvelope()       -> Promise<{ envelope, fingerprint, builtAt }>. Called
                              SYNCHRONOUSLY at the start of an attempt: it must
                              capture the vault key / salt / user before its first
                              await, because _lockApp and doLogout clear them right
                              after (the envelope needs AUTH.pinKey).
     applyRestore(parsed)  -> hands a parsed envelope to the app's ONE import
                              path (QX-DRV-2) — confirm, pre-import snapshot,
                              replace, land on the Dashboard.
     remind(text, code)    -> surface a reminder
     onChange(rec)         -> refresh UI */
export function createCloudBackup(deps) {
  let inFlight = null;          // { trigger, promise }
  let activeSince = null;       // ms — start of the current foreground+unlocked stretch
  let activeMs = 0;             // foreground-unlocked ms accumulated since the last attempt
  let currentFp = null;         // fingerprint of the latest saved data (from noteDataChanged)
  let sessionReminded = false;
  let deleting = false;         // a delete of the cloud copies is running — no new uploads

  const rec = user => cbNormaliseState(deps.load(user));
  const persist = (r, user) => { deps.save(r, user); if (deps.onChange) deps.onChange(r); return r; };
  const live = () => deps.switchOn() && rec().enabled;
  const foregroundMs = () => activeMs + (activeSince != null ? deps.now() - activeSince : 0);

  /* Foreground-unlocked time (brief §2.2): counted, not timed — the 30-minute
     rule is evaluated whenever data is saved (noteDataChanged) rather than by
     a polling timer (hard rule 3). Auto-lock is 5 minutes idle, so the lock
     trigger fires a backup long before a quiet session could go stale. */
  function noteActive(on) {
    const t = deps.now();
    if (on && activeSince == null) activeSince = t;
    else if (!on && activeSince != null) { activeMs += t - activeSince; activeSince = null; }
  }

  function noteDataChanged(fingerprint) {
    if (!live()) return null;
    currentFp = fingerprint;
    const r = rec();
    if (fingerprint !== r.lastFingerprint) {
      if (r.oldestUnbackedAt == null) { r.oldestUnbackedAt = deps.now(); persist(r); }
    } else if (r.oldestUnbackedAt != null) {
      r.oldestUnbackedAt = null; persist(r);   // edited back to exactly what is backed up
    }
    /* Nothing to back up (same as the last success) → no envelope build at all. */
    if (fingerprint === r.lastFingerprint && r.lastSuccessAt != null) return null;
    return foregroundMs() >= CB_INTERVAL_MS ? attempt('interval') : null;
  }

  /* One signal for "the user finished a step" (QR10a.3) — QR11's mascot
     consumes the same signal rather than making a second one. */
  function noteStepCompleted(kind) {
    if (!live()) return null;
    const r = rec();
    r.stepsSinceBackup += 1;
    if (r.oldestUnbackedAt == null) r.oldestUnbackedAt = deps.now();
    persist(r);
    return attempt('step').then(res => { checkReminder('step'); return res; });
  }

  function _record(patch, user) {
    const r = Object.assign(rec(user), patch);
    return persist(r, user);
  }

  /* Run one backup. Never interactive. `trigger`: 'interval' | 'step' | 'lock'
     | 'logout' | 'manual'. Resolves { ok, code?, skipped? } and never throws. */
  function attempt(trigger) {
    if (!deps.switchOn()) return Promise.resolve({ ok: false, code: 'FEATURE_OFF', skipped: true });
    const r0 = rec();
    if (!r0.enabled) return Promise.resolve({ ok: false, code: 'NOT_ENABLED', skipped: true });
    if (deleting) return Promise.resolve({ ok: false, code: 'ERROR', skipped: true });
    if (inFlight) return inFlight.promise;                                   // one in flight
    const manual = trigger === 'manual';
    const t0 = deps.now();
    if (!manual && r0.backoffUntil != null && t0 < r0.backoffUntil) {
      return Promise.resolve({ ok: false, code: r0.lastResultCode || 'ERROR', skipped: true, backoff: true });
    }
    const plugin = deps.plugin();
    if (!plugin) {
      _record({ lastAttemptAt: t0, lastResultCode: 'UNAVAILABLE', failures: r0.failures + 1, backoffUntil: t0 + cbBackoffMs(r0.failures + 1) }, deps.profileKey());
      return Promise.resolve({ ok: false, code: 'UNAVAILABLE' });
    }
    /* SYNCHRONOUS: capture the key/salt/user now (see deps.buildEnvelope). */
    let built;
    try { built = Promise.resolve(deps.buildEnvelope()); } catch (e) { built = Promise.reject(e); }
    const stepsAtBuild = r0.stepsSinceBackup;
    const profileKey = deps.profileKey();     // captured now: logout clears it before the upload ends
    const accountHint = deps.account() || undefined;
    const save = (r) => { deps.save(r, profileKey); return r; };   // no onChange here — see tracked below
    const promise = (async () => {
      let up;
      try {
        const { envelope, fingerprint, builtAt } = await built;
        const r1 = rec(profileKey);
        if (r1.lastSuccessAt != null && fingerprint === r1.lastFingerprint) {
          /* Nothing changed since the last successful backup — not an attempt. */
          if (r1.oldestUnbackedAt != null || r1.stepsSinceBackup) { r1.oldestUnbackedAt = null; r1.stepsSinceBackup = 0; save(r1); }
          return { ok: true, skipped: 'UNCHANGED' };
        }
        activeMs = 0; if (activeSince != null) activeSince = deps.now();      // the 30-minute count restarts
        save(Object.assign(rec(profileKey), { lastAttemptAt: deps.now() }));
        const res = await plugin.putBackup({ profileKey, accountHint, envelope: JSON.stringify(envelope), interactive: false });
        up = { fingerprint, builtAt, savedAt: (res && typeof res.savedAt === 'number') ? res.savedAt : null };
      } catch (e) {
        const code = _codeOf(e);
        try {
          const r3 = rec(profileKey);
          r3.lastAttemptAt = deps.now(); r3.lastResultCode = code; r3.failures += 1;
          r3.backoffUntil = deps.now() + cbBackoffMs(r3.failures);
          if (r3.oldestUnbackedAt == null) r3.oldestUnbackedAt = deps.now();
          save(r3);
        } catch (e2) { /* storage trouble must not turn into a throw */ }
        return { ok: false, code };
      }
      /* The upload SUCCEEDED. Bookkeeping errors from here on are local storage
         trouble, not a failed backup — never recorded as one. */
      try {
        const r2 = rec(profileKey);
        r2.lastSuccessAt = up.savedAt != null ? up.savedAt : deps.now();
        r2.lastResultCode = 'OK';
        r2.lastFingerprint = up.fingerprint;
        r2.failures = 0; r2.backoffUntil = null;
        r2.stepsSinceBackup = Math.max(0, r2.stepsSinceBackup - stepsAtBuild);
        /* Changes saved while the upload was running are not in it. */
        r2.oldestUnbackedAt = (currentFp != null && currentFp !== up.fingerprint) ? (up.builtAt || deps.now()) : null;
        save(r2);
      } catch (e) { console.warn('cloud backup bookkeeping:', e); }
      return { ok: true };
    })();
    /* Clear the in-flight marker BEFORE the UI refresh (a render that still sees
       inFlight would leave the toggle disabled), and only if it is still ours. */
    const tracked = promise.then(res => {
      if (inFlight && inFlight.promise === tracked) inFlight = null;
      try { if (deps.onChange) deps.onChange(rec(profileKey)); } catch (e) { console.warn('cloud backup onChange:', e); }
      return res;
    });
    inFlight = { trigger, promise: tracked };
    return tracked;
  }

  /* End-of-session triggers. The caller has just finished persistData() and
     has NOT yet cleared the vault key. Lock lets the upload finish after the
     screen locks; logout reloads the page, so the caller waits (bounded) on
     the returned promise with cbWait(). */
  const onLock = () => attempt('lock');
  const onLogout = () => attempt('logout');

  /* Reminders — natural moments only (QD-08). */
  function checkReminder(moment) {
    const r = rec();
    const due = cbReminderDue(r, deps.now(), { switchOn: deps.switchOn(), sessionReminded });
    if (!due) return null;
    sessionReminded = true;
    r.lastReminderAt = deps.now();
    persist(r);
    deps.remind('Your latest changes are not in your cloud backup yet. ' + due.reason.short, due.code, moment);
    return due;
  }

  /* Turning cloud backup on — an explicit user action (QD-01), so this is one
     of the two places a Google prompt may appear. Binds the chosen account to
     THIS profile (QD-05) and takes the first backup straight away. */
  async function enable() {
    if (!deps.switchOn()) return { ok: false, code: 'FEATURE_OFF' };
    const plugin = deps.plugin();
    if (!plugin) return { ok: false, code: 'UNAVAILABLE' };
    try {
      const got = await cbEnableInteractive(plugin, deps.account());
      const account = got && got.account;
      if (!account) return { ok: false, code: 'NO_ACCOUNT' };
      await deps.setAccount(account);
      const r = rec();
      r.enabled = true; r.failures = 0; r.backoffUntil = null; r.offerDismissed = true;
      persist(r);
    } catch (e) {
      return { ok: false, code: _codeOf(e) };
    }
    /* Two results, not one: turning it ON worked (the account is bound and the
       switch is live) even if the first backup then fails — the caller must not
       say "not on" for a failed first upload. */
    return { ok: true, backup: await attempt('manual') };
  }
  /* Turning it off keeps the bound account and any cloud copies — deleting
     those is a separate, explicit choice (deleteCloudCopies, QX-DRV-4). */
  function disable() {
    const r = rec(); r.enabled = false; persist(r);
    return { ok: true };
  }
  function dismissOffer() { const r = rec(); r.offerDismissed = true; persist(r); }
  /* QD-07: one dismissible offer, only while the feature is live and off. */
  function offerDue() { const r = rec(); return deps.switchOn() && !r.enabled && !r.offerDismissed; }

  /* Restore (QX-DRV-2): fetch the chosen copy, then hand it to the app's ONE
     import path. Explicit user action → may prompt for Drive access. */
  async function listRestorePoints() {
    const plugin = deps.plugin();
    if (!deps.switchOn() || !plugin) return { ok: false, code: deps.switchOn() ? 'UNAVAILABLE' : 'FEATURE_OFF', backups: [] };
    try {
      const got = await cbListInteractive(plugin, deps.profileKey(), deps.account());
      const backups = ((got && got.backups) || []).filter(b => b && (b.slot === 'current' || b.slot === 'previous'));
      return { ok: true, backups };
    } catch (e) { return { ok: false, code: _codeOf(e), backups: [] }; }
  }
  async function restore(slot) {
    const plugin = deps.plugin();
    if (!deps.switchOn() || !plugin) return { ok: false, code: deps.switchOn() ? 'UNAVAILABLE' : 'FEATURE_OFF' };
    try {
      const got = await cbFetchInteractive(plugin, deps.profileKey(), slot, deps.account());
      const parsed = JSON.parse(got && got.envelope);
      await deps.applyRestore(parsed);
      return { ok: true };
    } catch (e) { return { ok: false, code: (e instanceof SyntaxError) ? 'ERROR' : _codeOf(e) }; }
  }

  /* Delete this profile's cloud copies (QX-DRV-4). Silent — a deletion must
     not start a Google prompt; when Google cannot be reached the caller says
     so and the user decides. Resets what the record claims is in the cloud. */
  async function deleteCloudCopies() {
    if (!deps.switchOn()) return { ok: true, skipped: true };
    const plugin = deps.plugin();
    if (!plugin) return { ok: false, code: 'UNAVAILABLE' };
    /* An upload still running would land AFTER the delete and re-create the copy:
       let it finish first, and keep new ones out while deleting. */
    deleting = true;
    if (inFlight) { try { await inFlight.promise; } catch (e) { /* never rejects */ } }
    try {
      await plugin.deleteBackups({ profileKey: deps.profileKey(), accountHint: deps.account() || undefined, interactive: false });
      const r = rec();
      r.lastSuccessAt = null; r.lastFingerprint = null; r.oldestUnbackedAt = null; r.stepsSinceBackup = 0;
      r.lastResultCode = null; r.failures = 0; r.backoffUntil = null;
      persist(r);
      return { ok: true };
    } catch (e) {
      const code = _codeOf(e);
      /* Nothing to delete is a success for the caller's purposes. */
      return code === 'NOT_FOUND' ? { ok: true } : { ok: false, code };
    } finally { deleting = false; }
  }
  /* Does this profile have (or may it have) cloud copies worth offering to delete? */
  function hasCloudCopies() { const r = rec(); return deps.switchOn() && (r.enabled || r.lastSuccessAt != null); }

  /* What the UI shows. `reason` is null when the last attempt succeeded. */
  function view() {
    const r = rec();
    const code = r.lastResultCode;
    return {
      switchOn: deps.switchOn(),
      enabled: r.enabled,
      account: deps.account() || '',
      lastSuccessAt: r.lastSuccessAt,
      lastAttemptAt: r.lastAttemptAt,
      code,
      reason: cbReason(code),
      unbacked: r.oldestUnbackedAt != null,
      inFlight: !!inFlight,
    };
  }

  return {
    noteActive, noteDataChanged, noteStepCompleted, onLock, onLogout,
    attempt, checkReminder, enable, disable, dismissOffer, offerDue,
    listRestorePoints, restore, deleteCloudCopies, hasCloudCopies, view,
    isLive: live,
    resetSession() { sessionReminded = false; activeSince = null; activeMs = 0; currentFp = null; },   // never drops an upload that is still running
  };
}

/* Wait for `promise` at most `ms`, resolving either way — for a caller about
   to reload the page (logout) that must not hang on an offline upload. */
export function cbWait(promise, ms) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish({ ok: false, code: 'TIMEOUT' }), ms);
    Promise.resolve(promise).then(v => { clearTimeout(timer); finish(v); }, () => { clearTimeout(timer); finish({ ok: false, code: 'ERROR' }); });
  });
}
