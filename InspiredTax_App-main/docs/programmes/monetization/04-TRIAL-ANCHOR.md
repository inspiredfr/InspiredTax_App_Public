# 04-TRIAL-ANCHOR — Custom Capacitor plugin for the cross-reinstall trial anchor

> **Status 2026-10-04.** Live contract for `TrialAnchorPlugin.java` (on the
> shared `GoogleDrivePlugin` base since QR10b) and `14-entitlement.js`.
> Device verification of the silent/interactive policy:
> `docs/android/DEVICE-CHECKS.md` A1.

Minimal, dependency-light native plugin that anchors the 7-day trial
**start timestamp** in the user's Google Drive `appDataFolder` so
uninstall/reinstall no longer grants a fresh trial (00-DESIGN §3.3, D-M6).

Design invariant (same as the billing plugin, 02-BILLING-PLUGIN §3): the
Java class is a **dumb I/O pipe** — it obtains an OAuth token and does
Drive REST reads/writes, and returns a bare timestamp. **No entitlement
logic, no reconciliation, no `min` computation in Java.** The single source
of truth stays in `src/js/14-entitlement.js`, which owns
`_reconcileTrialStart()`.

Reached from JS via `window.Capacitor.Plugins.TrialAnchor` (guarded,
native-only — same idiom as `PlayBilling` / `_downloadBlob`; no ES import).

## 1. Files

| File | Change |
|---|---|
| `android/app/src/main/java/za/co/inspiredtax/app/TrialAnchorPlugin.java` | new (~250 lines). *2026-09-30 (qa-remediation QR10b):* its sign-in client, activity callbacks, token fetch and Drive HTTP helpers moved to `GoogleDrivePlugin.java`, shared with `CloudBackupPlugin`; `withAccount()` and the anchor I/O stay here. Log lines are unchanged. **One behaviour change:** Drive HTTP calls now time out (15 s connect, 60 s read). A connection that used to hang indefinitely, or answered only after more than 60 s, now rejects `NETWORK_ERROR`. JS already fails closed on that, so the user sees the offline message and can retry *Start free trial* *2026-10-15 (BACKLOG 75):* authorization moved to Identity Services `AuthorizationClient` in the base — `authorize()`, the consent callback `signInResult`, `reauthorize()` after a Drive 401; `withAccount()` and `silentSignIn()` are gone, `getAnchor`/`putAnchor` go through `begin()`. |
| `android/app/src/main/java/za/co/inspiredtax/app/MainActivity.java` | `registerPlugin(TrialAnchorPlugin.class);` in `onCreate` before `super` (add alongside `PlayBillingPlugin`) |
| `android/app/build.gradle` | `implementation "com.google.android.gms:play-services-auth:22.0.0"` — `AuthorizationClient`; 22.0.0 no longer ships the legacy `GoogleSignIn` API (BACKLOG 75, 2026-10-15) |
| `android/app/proguard-rules.pro` | §6 keep rules |

**Dependency note**: `play-services-auth` is a *new* native dependency,
explicitly permitted for this plugin by D-M6 (03-HANDOVER amends the
"Java side: only billing" constraint). No new npm/JS runtime dependency —
the JS side calls the plugin and the platform `fetch` is not used (all HTTP
is Java-side, keeping the OAuth token off the JS bridge).

## 2. Plugin API (JS surface)

All methods promise-based; every rejection carries
`{ code: <stable string>, message }`. JS treats **any** rejection as
"unverified" and **fails closed** — no trial is granted (hard-gate, D-M6).

```ts
isAvailable(): Promise<{ available: boolean }>
  // Google Play services present AND a Google account is obtainable.
  // false on no-Play / no-account devices → Basic, no trial (hard-gate),
  // no errors, no UI.

getAnchor(opts?: { interactive?: boolean }): Promise<{ trialStart: string | null }>
  // Obtain an account holding drive.appdata per the silent/interactive
  // contract below, then:
  //   GET /drive/v3/files?spaces=appDataFolder
  //       &q=name='trial-anchor.json'&fields=files(id)
  //   → if a file exists: GET /drive/v3/files/{id}?alt=media, parse JSON,
  //     return its trialStart (ISO string).
  //   → if no file: resolve { trialStart: null } (first launch on this
  //     Google account — JS will create it via putAnchor).

putAnchor(opts: { trialStart: string, interactive?: boolean }): Promise<{ ok: true }>
  // Idempotent create-or-update of appDataFolder/trial-anchor.json with
  // body { "v": 1, "trialStart": <opts.trialStart> }. If the file exists,
  // PATCH its media; else multipart-create under parent 'appDataFolder'.
  // Body carries ONLY v + trialStart — never PII, username, entitlement,
  // or user data.
```

### Silent / interactive contract (QA remediation 2026-09 QR1; AuthorizationClient since BACKLOG 75)

`interactive` defaults to **false**. Every call asks Google Identity
Services' `AuthorizationClient` for a `drive.appdata` token for the app's
default Google account (`GoogleDrivePlugin.authorize()`):

1. **already granted** → the token, no UI, on either kind of call;
2. **needs the user** (no grant yet, a grant revoked server-side) and **not
   interactive** → reject `SIGN_IN_REQUIRED`. **Never starts an activity.**
   Boot, PIN unlock and foreground resume only ever make this call;
3. **needs the user** and **interactive** → Google's account chooser /
   consent screen (the result's `PendingIntent`, launched through
   Capacitor's activity-result bridge; result in `signInResult`). A result
   without the `drive.appdata` grant rejects `USER_DECLINED` rather than
   prompting again.

The grant is `drive.appdata` alone — no e-mail, name or photo; the anchor
needs no account identity. (Before BACKLOG 75 the plugin used the legacy
`GoogleSignIn` API: cached account → `silentSignIn()` → sign-in intent,
launched synchronously because an async hop broke Capacitor's request-code
matching, MZ-2. `AuthorizationClient` hands back its `PendingIntent`
asynchronously by design; the launch runs on the main thread and JS starts
one interactive call at a time, #197.)

**Revoked-grant recovery (F6, QR1 post-merge review, Option A — owner
2026-09-28):** a grant the user revoked server-side (Account → Security →
Third-party access) can surface as a Drive 401 on a still-cached token. The
plugin then clears that token (`ClearTokenRequest`) and authorizes once
more: an **interactive** call gets the consent screen and, on success,
retries the same call; a **silent** call rejects `SIGN_IN_REQUIRED`, no UI.
Bounded to one re-authorization per call — a second 401 rejects outright
rather than re-prompting.

JS passes `interactive: true` only on explicit user actions (QD-01): the
welcome CTA, Go Premium → *Start free trial*, and Restore purchases while the
trial is unverified. `tests/entitlement.js` Test 15 enforces this.

### Error codes (stable strings)

`OK, NO_PLAY_SERVICES, NO_ACCOUNT, USER_DECLINED, SIGN_IN_REQUIRED,
NETWORK_ERROR, DRIVE_ERROR, ERROR`

`NETWORK_ERROR` can arise two ways: the usual Drive HTTP/`IOException`
path, and — since the QR1 review's F3 fix — `signInResult`'s own
`ApiException` with `statusCode == ConnectionResult.NETWORK_ERROR` (7),
when Google's account picker/consent screen itself fails for lack of
connectivity. Both read the same to JS.

JS handling (14-entitlement `_syncTrialAnchor`, all fail-closed): every
non-OK outcome → leave `trialStart` untouched (no trial granted on a fresh
device; an already-verified device keeps its cached trial), set no error
UI, `console.warn` only (never `console.error` — the smoke gate treats
those as failures). A silent boot/resume call with no trial yet simply
rejects `SIGN_IN_REQUIRED` until the user takes an explicit trial action —
nothing retries *that* on its own. Once a trial **is** established, though,
a silent call still has one job left (F4, Option A): if the matching
`putAnchor()` to Drive never confirmed, it retries that write alone (no
sign-in, no read) on every later boot/unlock until it succeeds — the
device's `anchorSynced` flag tracks this. `_syncTrialAnchor` resolves
`{ ok, code }` so explicit actions can word the reason (QD-03).

## 3. Java implementation notes

- `@CapacitorPlugin(name = "TrialAnchor")`.
- **Authorization**: request scope
  `https://www.googleapis.com/auth/drive.appdata` (least privilege — the
  app can see only its own hidden config folder, never the user's real
  Drive files) with `Identity.getAuthorizationClient(...).authorize()`
  (BACKLOG 75); if consent is needed, launch the result's `PendingIntent`
  through the Capacitor activity-result path and reject `USER_DECLINED` on
  cancel.
- **HTTP**: plain `HttpURLConnection`/OkHttp against Drive REST v3 —
  endpoints in §2. No Drive client library (keeps the dependency surface to
  auth only). Non-2xx → `DRIVE_ERROR`; `IOException`/no connectivity →
  `NETWORK_ERROR`.
- All work off the main thread; resolve the `PluginCall` directly
  (Capacitor handles the thread hop); never touch views.
- **No app logic**: the plugin never decides trial state, never compares
  timestamps, never writes `iss_device`. It reads a string, writes a
  string. Reconciliation (`earliest wins`) is JS-only.
- **No PII**: assert in review that the only field ever written to Drive
  is `{ v, trialStart }`. The Google account identity stays with Google;
  the app never stores the email/account id.

## 4. Reconciliation contract (JS side — for reference)

The plugin returns raw values; `14-entitlement.js` decides:

```
localStart  = _readDevice().trialStart          // null until verified (hard-gate)
anchorStart = (await getAnchor()).trialStart     // may be null
established  = _reconcileTrialStart(localStart, anchorStart) ?? now  // establish or inherit
if established !== localStart:  _writeDevice({ ...device, trialStart: established })
if established !== anchorStart: await putAnchor({ trialStart: established })
entRefreshUi()
```

Two properties: (1) **earliest-wins** is the anti-abuse core — a reinstall
starts with `localStart = null`, so an older anchor always wins and the
trial cannot be reset by wiping app data. (2) **`?? now`** establishes the
trial on a genuine first-ever verified launch (both sides null). Because
this only runs *after* `getAnchor()` succeeds, a failed/absent Sign-In
never reaches it — the hard-gate.

## 5. Fail-closed behaviour (hard-gate, D-M6)

The trial is granted ONLY by a successful Sign-In + anchor read. Every
other path leaves `trialStart` untouched:

- No plugin (browser, sideload, no Play services) → `_anchor()` is
  undefined → `_syncTrialAnchor()` returns immediately → **Basic, no trial**.
- Offline at first launch → `getAnchor()` rejects `NETWORK_ERROR` → **Basic**;
  the next online boot re-runs the sync and establishes/inherits the anchor.
- Sign-In declined → `USER_DECLINED` → **Basic**; the Sign-In CTA (M2) lets
  the user start the trial on a later launch.
- No Google account / no Play services → `NO_ACCOUNT` / `NO_PLAY_SERVICES`
  → **Basic** permanently (these users cannot subscribe either).
- **Verify-once**: once a launch has established `trialStart` locally, later
  offline launches honour that cached value — the sync simply no-ops on
  failure, it never revokes an already-started trial.

## 6. Proguard / R8 (folds into stage M4)

```
# Capacitor bridge (reflection over plugin methods) — already kept for billing
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
# Google Sign-In / auth (library ships consumer rules; belt-and-braces)
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }
```

## 7. On-device QA checklist (manual — Play Console internal testing)

Run on a real device signed into a Google account (the anchor needs Play
services + Drive):

1. **First launch** → one-time `drive.appdata` consent screen appears;
   accept → trial starts; confirm `trial-anchor.json` is created (trial =
   7 days).
2. **Reinstall while signed in, mid-trial** → uninstall, reinstall → trial
   **continues from the original start** (days-left not reset); no second
   consent prompt (already granted).
3. **Reinstall after the trial expired** → reinstall → app is in **Basic
   immediately**, no fresh trial.
4. **Decline sign-in / consent** → **Basic, no trial** (hard-gate); no
   crash, no error toast. Relaunch and accept → trial then starts.
5. **Offline first launch** → **Basic, no trial**; reconnect, relaunch →
   Sign-In succeeds, anchor is written and the trial starts.
6. **Second Google account** on the device → fresh trial (documented
   per-account limit, D-M6/§7) — not a bug.
7. **No console errors** in the WebView during any of the above (`chrome://
   inspect`), consistent with the smoke gate.
