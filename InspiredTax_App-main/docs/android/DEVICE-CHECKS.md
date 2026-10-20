# Owner device checks

Everything that only a real phone can verify, in one place: how to build and
capture, the checklists, and where to record results. A change that touches
native code, the WebView, Play services, Google sign-in, Drive or frame rate
stays **implemented, not verified** until its row here reads *pass*
(working rule WR-3, `CLAUDE.md`).

- **Status 2026-10-07:** no check below has been run (owner). Plan: run them on
  the closed-testing build during the 14-day period (`CLOSED-TESTING.md` §6),
  except D1, D2, D4, D11, D13 and D16, which run on that build **before the
  first install link** (`CLOSED-TESTING.md` §0 G2, 2026-10-14);
  A2/A3 need the debuggable build. Cases D16–D19 (added 2026-10-05/07) are in §2.3; all four are *implemented, not verified*.
- **2026-10-15 (owner-reported):** G2 ran on 8.36.0 from Play internal
  testing — D1, D2, D4, D11, D13, §6 and D24 (a)–(c) pass; D16 and D20
  fail, and the owner's screenshot showed oversized Tax balances chips on
  onboarding step 7. All three are fixed for 8.36.1; re-run D16, D20 and the
  step-7 check on it (§4).
- **Sources merged here:** the QA remediation tracker's *Owner device
  verification* section and the sign-in troubleshooting compendium §3–§6
  (both retired; `git show 15a9d6e:docs/programmes/qa-remediation-2026-09/05-TRACKER.md`,
  `…/monetization/05-SIGNIN-TROUBLESHOOTING-COMPENDIUM.md`), plus the
  polish pass's D-1 list.
- **Maintenance.** The session that ships a native/WebView-dependent change
  adds its cases here; the owner records results in §4; the next session
  deletes passed rows and closes the matching BACKLOG item.

---

## 1. Build, install, capture

Commands are PowerShell on the owner's Windows machine, run from the repo root.

**Diagnostic build** (gives `chrome://inspect` and JS logs in logcat):

1. In `android/app/build.gradle`, inside `buildTypes { release { … } }`, add
   `debuggable true` — **temporary; never commit; Play Console rejects a
   debuggable build on every track, Internal included.**
2. `npm run cap:sync`, then `cd android; .\gradlew assembleRelease; cd ..`.
   This is the `release` build type, so it signs with the upload key whenever
   `android/app/keystore.properties` exists — the SHA-1 registered for Google
   sign-in. A plain Android Studio *Debug* build signs with the debug key,
   which is **not** registered, and sign-in fails with `statusCode=10`.
3. Afterwards remove `debuggable true`.

Play Billing needs a Play-installed build, so billing cases (D11) run on a
Play track build, not the sideloaded diagnostic one.

**Install** (uninstall first whenever switching between a Play-installed and
a sideloaded build — different signing keys):

```powershell
adb devices                       # expect "device", not "unauthorized"/"offline"
adb uninstall za.co.inspiredtax.app
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

`unauthorized` → unlock the phone and accept the USB-debugging prompt.
`offline` → `adb kill-server; adb start-server`, replug. Nothing listed → try
another cable (charge-only cables are common). Wireless: Developer options →
Wireless debugging → *Pair device with pairing code*, then `adb pair <ip:port>`
and `adb connect <ip:port>`.

**Capture** — never rely on a live tag filter:

```powershell
adb logcat -c                                   # before each case
# … run the case on the phone …
adb logcat -b all -v threadtime -d > logcat_full.txt
Select-String -Path logcat_full.txt -Pattern "Capacitor|TrialAnchor|CloudBackup" | Out-File hits.txt
```

**State without the UI** — `chrome://inspect#devices` → *inspect* → Console:
`JSON.parse(localStorage.getItem('iss_device'))` (trial and entitlement
record) and `JSON.parse(localStorage.getItem('iss_cloud_backup_<username>'))`
(`lastResultCode`, `lastSuccessAt`). Native log lines never contain the
e-mail, the username or backup content.

---

## 2. Device sessions (debuggable build)

| # | What | Cases | Closes |
|---|---|---|---|
| A1 | Sign-in policy, purchase landing, import landing | D1–D12, D14, D15 | Q-AUTH-1/2/3, QX-AUTH-1, RET-01 (BACKLOG 18) |
| A2 | Cloud backup against real Google Drive — a local build with the switch on | C1–C13 | Q-DRV-1/3, QX-DRV-3/4 (BACKLOG 11) |
| A3 | Wizard-step triangles hold 60 fps on the slowest phone to hand: *Income → Investment → Add*, Next/Back several times, change area a few times. For a number: `chrome://inspect` → Rendering → *Frame rendering stats*. If they stutter, tell Claude — the fallback is `STEP_TRANSITION = 'B'` in `01-data.js`. Desktop Chromium at 4× CPU throttle measured 43–54 fps | — | Q-MOT-2, QD-22 (BACKLOG 18) |
| A4 | Motion in both themes, then with *Remove animations* on (see §3) | — | Q-MOT-1/2 |
| A5 | Glyph size at system font 100 %, 130 % and larger; check 360 px layouts at large scales | D13 | RET-04, QD-26 (BACKLOG 12) |
| A6 | Owner-interview and on-blur validation behaviour on a Play build (no debuggable build needed) | D16–D23 | QD-24, QD-19, D-M5, FV-1 (BACKLOG 18) |

### 2.1 Sign-in policy — D1–D15

Every TrialAnchor call logs `getAnchor interactive=<bool>` /
`putAnchor interactive=<bool>` at entry.

| # | Case | Expected | Logcat evidence |
|---|---|---|---|
| D1 | Fresh install → create profile → PIN | Welcome modal; **no** Google prompt before the CTA | `getAnchor interactive=false`, then `SIGN_IN_REQUIRED`; no `Launching sign-in intent` |
| D2 | Welcome CTA → consent | Account picker + consent; toast *Trial started — 7 days…*; `trialStart` set | `getAnchor interactive=true`, `Launching sign-in intent`, `signInResult invoked`; **no** `Unable to find a Capacitor plugin` |
| D3 | Background > 5 min → return → PIN unlock (trial verified) | No prompt | No TrialAnchor call, unless D2's `putAnchor` never confirmed — then one silent retry, still no UI |
| D4 | Fresh install → welcome CTA → decline | Toast *Sign-in not completed…*; stays Basic | `signInResult invoked` → `USER_DECLINED` |
| D5 | After D4: background and return; then > 5 min and unlock | No prompt either time | Only `interactive=false`; `SIGN_IN_REQUIRED` |
| D6 | After D4: Go Premium → *Start free trial* | Prompt; completing it starts the trial; banner disappears | `getAnchor interactive=true` |
| D7 | Consent screen: untick the Drive app-data permission | Toast *Sign-in not completed…*; no second prompt | `without the drive.appdata grant` → `USER_DECLINED` |
| D8 | Airplane mode → *Start free trial* | Toast *You're offline…*; no loop | `NETWORK_ERROR` (native maps `statusCode=7` since #347) |
| D9 | A Google account that was never a test user, on the §1 diagnostic build | Sign-in succeeds (consent screen published 2026-09-25) | `authorize failed, statusCode=…` or `Sign-in failed … statusCode=…` if it fails; `10` means the build was debug-signed |
| D10 | Uninstall, reinstall, create profile | Trial inherited silently if Google still holds the grant; otherwise Basic + welcome CTA | `getAnchor interactive=false` → resolves, or `SIGN_IN_REQUIRED` |
| D11 | Buy a plan (licence-tester account, Play build); then a downgrade | Purchase lands on the Dashboard with *Premium is active…*; note whether *Plan change confirmed…* shows; no unexpected Dashboard jump later | JS: no `billing purchase` warning |
| D12 | JSON import from Backup, export, Restore | Lands on the Dashboard under the result panel | — |
| D13 | Glyph size and layout at system font 100 % / 130 % / largest, display size default and Large (QD-26 as amended by UI-FS-1) | Body text scales; every icon glyph sits inside its tile at the 24/32 ratio; Tax at a Glance, captured rows, Tax balances rows and pills fit with no sideways scroll; app-bar title never under the billing chip. UI-CAP-1 (2026-10-07): Add rental / IT3(b) / tools open on their question; every tile, its second line and the header's *Change* fit; *Step 1 of 2* never wraps. UI-NOTE-1 (2026-10-07): every note is one line plus *More*, which opens the help sheet. UI-CARD-1 (2026-10-07): on Taxation → Return, Provisional and Prior years an opened card takes the full width; its chart, bars, bracket ladder and lines fit; Tax balances rows show their movement bars. Failed 2026-10-05 (owner: very large font, large display) — re-run on the UI-FS-1 + UI-CAP-1 build | — |
| D14 | Reinstall after the trial window closed → welcome CTA, or Go Premium → *Start free trial* | Toast *This Google account has no free trial left…*; Go Premium then offers no trial | `getAnchor interactive=true` resolves; no `USER_DECLINED` |
| D15 | Revoke the app's Drive access (Google Account → Security → third-party connections → InspiredTax → delete) without signing out → *Start free trial* | Google's consent screen; completing it starts the trial; declining shows *Sign-in not completed…* | `Launching sign-in intent` (after `Drive HTTP 401 — clearing the token and authorizing again` if a stale token was cached), then `signInResult invoked … resultCode=-1`; a second broken attempt rejects without a third screen |

### 2.2 Cloud backup — C1–C13

**Build:** set `export const CLOUD_BACKUP_ENABLED = true;` in
`src/js/01-data.js` (`npm test` fails on this tree by design), `npm run
cap:sync`, then the §1 diagnostic build. Afterwards
`git checkout src/js/01-data.js`. **Never commit this build.** Drive contents:
Google Drive (web) → Settings → Manage apps → InspiredTax (hidden app-data
size, including the small trial-anchor file).

| # | Case | Expected | Logcat evidence |
|---|---|---|---|
| C1 | Menu → *Backup, export, Restore* → Cloud backup on → pick account → allow | *Cloud backup is on*; Row 2 shows the account and first backup time | `enable interactive=true`, `Launching sign-in intent`, `signInResult invoked … resultCode=-1`, `putBackup interactive=false bound=true`, `putBackup saved, copies=1 pruned=0` |
| C2 | Two Google accounts on the phone; second profile → Cloud backup on | Google lets you **choose** the other account. **Fail** if it reuses the first silently (fallback: an `AccountPicker` chooser) | `enable interactive=true`, `Launching sign-in intent` |
| C3 | Save an entry, then a second and a third | Each save backs up with no Google screen; Row 2 time updates | `copies=2 pruned=0`, then `copies=3 pruned=1` (two kept, QD-06) |
| C4 | Throughout C3, C5, C6 | No Google screen appears by itself | No `Launching sign-in intent` except after a tap on the toggle, *Allow access* or *Restore* |
| C5 | Airplane mode → change something → *Back up now*; back online → *Back up now* | *You are offline…*; then saved | `putBackup network failure: UnknownHostException…`, then `putBackup saved` |
| C6 | Change something, wait for auto-lock (5 min); change something and sign out | A backup on lock and on sign-out, before reload | `putBackup saved` at each (sign-out waits at most 8 s) |
| C7 | *Restore from cloud backup* → *Previous*, confirm with PIN; then *Latest* | Both listed with times; each restore lands on the Dashboard | `listBackups interactive=true bound=true`, `found=2`, `getBackup interactive=true bound=true` |
| C8 | Uninstall → reinstall → same username → *Restore from cloud backup* → same account → old PIN | Latest backup found and restored | `listBackups interactive=true bound=false`, `Launching sign-in intent`, `found=2` |
| C9 | Revoke the app's access, then change something | No prompt; Row 2: *Google needs your permission again.* with *Allow access*; tap it → allow → *Back up now* works | Automatic: `putBackup interactive=false bound=true`, **no** `Launching sign-in intent`; after tap: `enable interactive=true` |
| C10 | *Reset all data* with the cloud box unticked; then *Delete Account* with it ticked | Reset keeps the cloud copies; Delete removes them (Manage apps size drops to the trial anchor) | `deleteBackups interactive=false bound=true`, `deleted=2` |
| C11 | Two profiles bound to two accounts (needs C2); back up both; open *Restore* in each | Each lists only its own copies | `bound=true` on every call; per-profile `found=` |
| C12 | Re-run D1, D2, D15 on this build | As in §2.1 | Same TrialAnchor lines |
| C13 | **Observe only:** after C2/C11 bind a second account, background > 5 min and unlock | Record which account the trial check uses (decides the deferred TrialAnchor-account item) | `getAnchor interactive=false` and its result |

Optional: with a full Drive, *Back up now* shows *Your Google Drive is
full…* (`Drive HTTP 403 reason=storageQuotaExceeded -> QUOTA_EXCEEDED`).

### 2.3 Onboarding, saving blocks, ribbon, on-blur messages — D16–D19

Any Play build; TalkBack on for D19. D20–D23 added 2026-10-14; D24 (sign-in on `AuthorizationClient`, BACKLOG 75) 2026-10-15 — 8.36.0 carries it: (a)–(c) belong to the go/no-go owner check (`CLOSED-TESTING.md` §0 G2), the rest with D1–D15 and C1–C13.

| # | Case | Expected | Logcat evidence |
|---|---|---|---|
| D16 | New profile → onboarding step 2 (Income sources): tick an investment tile, leave the foreign-income question or a shown scenario question unanswered → Continue. Then finish onboarding with at least one step-6 Tax balances answer *Yes* and no deduction (8.36.1) | Step does not advance; toast *Please answer: [the first open question]* shows above the onboarding screen; answering every shown question lets it advance. Step 7: each Tax balances answer is a small amber pill and *None selected* a small grey pill, text the size of the summary's other values | — |
| D17 | Deductions → Travel: business km above (closing − opening) odometer; Home office: office area above total area. Then PAYE above remuneration on an employer entry | Travel and Home office: red message under the field and the figure is not saved (the last good figure stays); PAYE: a warning only, the entry saves | — |
| D18 | Open the plan ribbon (Play build) | Reads *LAUNCH PRICE* (D-M5 amended 2026-10-14; was *FIRST 100 SUBSCRIBERS*) | — |
| D19 | In any capture sheet, type in a required field, clear it and leave it; then fix it. Repeat with the Android keyboard's Next/Done | The message appears under the field when you leave it and clears as soon as it is fixed; TalkBack reads it; the keyboard never covers it | — |
| D21 | Billing states on a Play build with a licence-tester account (test subscriptions renew every few minutes — that is expected): (a) buy *3 Months* (prepaid) with the test card; (b) buy *Monthly*, then cancel it in Play Store → Payments & subscriptions, return to the app; (c) with *Monthly* bought on this install, choose *Annual*; (d) after a reinstall (plan unknown), choose another auto-renewing plan; (e) set the date 40 days ahead, open and unlock, set it back to automatic, tap *Restore purchases* (BACKLOG 70, 2026-10-14). From 8.36.0 the purchase carries no identifier (BACKLOG 33, 2026-10-15) | (a) the purchase completes; chip *Access until <date>*, never *Renews*; (b) Premium stays, chip *Access until*; (c) Play's sheet shows a plan change (proration), not a second subscription; (d) toast *Change your plan in Google Play — opening Subscriptions* and Play's subscription page opens; (e) *Premium restored*, Premium stays | JS: no `billing purchasesUpdated` warning |
| D20 | Menu → *Backup, export, Restore* → *Export encrypted backup*: (a) swipe the share sheet away; (b) export again and save to Files or Drive; (c) *Export CSV summary* and save it. Then Menu → About → *Privacy policy* (BACKLOG 72, 71 — 2026-10-14; ask-the-user 8.36.1, DECISIONS EXP-1) | (a) the question *Is your backup saved?* → *No* → *Backup not saved* and the *Last manual export* row unchanged; (b) either *Encrypted backup exported* straight away, or the same question → *Yes, it’s saved* → *Encrypted backup exported* — the row shows now either way, and the file is where you saved it; (c) *CSV summary downloaded*, with *Is your CSV summary saved?* first if Android does not report the save; the privacy link opens inspiredtax.co.za/privacy.html in the browser | JS: no `exportBackup:` error for (a) |
| D22 | Profile data on a Play build (BACKLOG 71, 2026-10-14): (a) open the app, lock it (power button), unlock, then Menu → *Backup, export, Restore*; (b) export an encrypted backup to Files, then Profile → *Delete Account* (or, from the login screen, remove a second profile); (c) on a profile with figures, Profile → *Reset all data*, finish onboarding, then lock and unlock; (d) look at the login screen's profile list and the lock screen | (a) the backup screen reads *Local backup snapshot: just now — on this device only*, not *No local backup snapshot yet* (no snapshot had ever been written before this fix); (b) on the next profile created, the backup screen shows no snapshot until it locks once, and *Last manual export* is not carried over; (c) no earlier figure or answer reappears; (d) profiles read *@username* with the username's initial, the lock title *Welcome back, @username*; after unlock the Dashboard greets by first name | JS: no `writeLocalBackupSnapshot:` error; `purge snapshot:` / `purge export copies:` warnings mean a file was left — send the line |
| D23 | Launch polish on a Play build (BACKLOG 73, 2026-10-14): (a) the home-screen icon on a round-mask launcher (Pixel) and a squircle one (Samsung), and with *Themed icons* on (Android 13+); (b) cold start; (c) airplane mode on, cold start, Menu → Go Premium; then airplane mode off, *Try again*; (d) on a fresh install, the first *Start free trial* consent screen; (e) Developer options → *Don't keep activities* on, open Go Premium, switch to another app and back, tap Subscribe | (a) the whole R visible inside every mask, centred; the themed icon centred and the same size; (b) navy screen with the R — never a blue X on white; (c) *Loading plans from Google Play…* then *Google Play didn’t send the plans…* with *Try again*, no prices and Subscribe disabled; after *Try again* the plans with Play’s own prices, a crossed-out price on the launch offer equal to the full-price plan’s; (d) Google asks for the app’s Drive data only — not e-mail, name or profile picture (8.36.0 carries BACKLOG 75; before it, e-mail too); (e) the plans load again and the purchase sheet opens | JS: no `billing getProducts` error after *Try again*; native: no `IllegalStateException` from BillingClient |
| D24 | Sign-in on `AuthorizationClient` (BACKLOG 75, 2026-10-15), on 8.36.0 from Play: (a) fresh install → welcome CTA; (b) close the app fully, reopen, unlock; (c) with two Google accounts on the phone, Go Premium → *Start free trial* on a fresh install; (d) **upgrade** a phone that started its trial on 8.35.2 or older (old sign-in) to this build, open and unlock, then Go Premium → *Restore purchases*; (e) on the C-build (cloud backup on), Cloud backup on while the trial's account already granted Drive access | (a) Google's account chooser and a consent screen that asks for the app's Drive data only — not e-mail, name or photo; trial starts; (b) **no** prompt — the trial check passes silently (if it asks again or fails silently every time, the chosen account is not remembered: record it, it decides whether 75 needs a stored account); (c) the chooser lists both accounts; (d) the trial stays (record whether the silent check after the upgrade passes or says `SIGN_IN_REQUIRED`); Restore asks at most once; (e) the account chooser still appears (the user picks), and Row 2 shows the chosen account's e-mail | (a) `Launching sign-in intent`, `signInResult invoked … resultCode=-1`; (b) `getAnchor interactive=false` resolves, no `authorization needs the user`; (e) `enable interactive=true`, `Launching sign-in intent`; **no** `enable: Drive returned no account e-mail` |
| D25 | *Report a problem* (BACKLOG 67, 2026-10-15), on the first Play build that carries it: (a) Menu → *Report a problem*; (b) Menu → About → *Report a problem*; (c) open it and swipe the share sheet away | (a) the Android share sheet opens with *InspiredTax problem report*; picking WhatsApp or Gmail pre-fills the message: the describe-it line at the top, then *Version* (this build and its versionCode), *Device* (Android and WebView versions), *Screen*, *Theme*, *Page*, *Access* and *Recent errors* — **no rand amount, name, ID or e-mail anywhere**; (b) the same; (c) nothing happens — no error message | JS: none expected |
| D26 | *Share InspiredTax* (BACKLOG 83, 2026-10-15), on the first Play build that carries it, with the site's `/get` change live: (a) Menu → *Share InspiredTax*; (b) Menu → About → *Share InspiredTax*; (c) send it to yourself or a willing friend and tap the link on another phone; (d) if a phone without WhatsApp is to hand, tap the row there | (a) WhatsApp opens on its choose-a-chat screen with the message ready, ending *inspiredtax.co.za/get*; after picking a chat the preview card shows *Get InspiredTax* with the R logo; (b) the same; (c) the *Get InspiredTax* page: *No invite yet?* card (its button opens a WhatsApp chat with the owner) above the install steps; (d) the browser opens WhatsApp's own page — the app is unharmed. If (a) does nothing, record it: Android did not hand the link on | JS: none expected |
| D27 | Sticky bars (BACKLOG 86, 2026-10-16), on the first Play build that carries it: Tax → Return, then scroll slowly down the page; repeat on Deductions and Income | The tax-year bar sits flush under the app header and the page heading flush under the tax-year bar; no page content shows between the bars while scrolling (before: a strip of about 24px under the tax-year bar showed content scrolling past) | Implemented, not verified (WR-3). Smoke `assertStickyStack` pins it in Chromium |

---

## 3. Eyeball checks (any current build, 360 px, both themes)

### B1 · QA remediation screens

- **Motion (QR11).** Change area from the bottom bar (edge sweep in the
  destination colour; none within an area); *Income → Investment → Add*,
  Next/Back (triangles); the mascot on Dashboard, Income and Deductions on
  arrival; save a record from the Income landing; leave Income open a minute
  (it looks around, then dozes; a tap wakes it). Repeat with *Remove
  animations* on — no transition, still mascot.
- **Medical (QD-32).** *Deductions → Medical → Medical aid contributions*: the
  two *Annual contribution* labels and the line under them.
- **QR9b.** *Income → Retirement → Add* (three cards; pick *A lump sum*; type a
  fund name then pick another card — it asks first); *Income → Crypto → Add*;
  *Income → Business → Add* as *Freelancer / Contractor* (three chained
  questions); *Deductions → Retirement → What you paid in*; *Deductions →
  Tools → Add asset* (no *Vehicle*; the *Small tool* note); any wizard (the
  *ⓘ About …* line on step 1 only).
- **QR9a.** *Income → Investment*: IT3(b) *Add an amount* (type `4201`,
  `dividend`; edit a saved certificate); *Tax-free investments* (add one over
  the yearly limit — meter, warning, earlier-years field); *Summary → Tax*
  (*Plus: Tax-free investment excess*); import a pre-QR9a backup with a TFSA
  certificate and check the *moved* note.
- **QR8.** *Income → Employment → Add* source-code box (`3715`, `salary`,
  `zzz`; pick; edit); *Deductions → Other claims → Add* (*I know the code
  from my IRP5*, `pension`). Also with a real Android keyboard and TalkBack —
  never checked.
- **QR7.** Onboarding *Income Sources* (Investments + Capital sales, the new
  questions, the foreign layers); *Profile → Income Sources → About your
  situation*; an IT3(b) after answering *No* to foreign investment income; the
  one-off Dashboard card on an existing profile.

### B3 · Large screens (BACKLOG 73)

At targetSdk 36 Android ignores the portrait lock on screens ≥ 600 dp, so a
tablet or a foldable shows the app in landscape. On any ≥ 600 dp device (or a
large phone in landscape with auto-rotate on): login, Dashboard, one capture
sheet, Go Premium and the Backup screen — nothing clipped or overlapping, no
horizontal scroll, sheets usable. Findings come back with a screenshot.

### B2 · Polish-pass re-checks (D-1)

Items marked done or superseded in the 2026-09 polish pass because the code
already matched; never confirmed on a phone. Use a build ≥ 8.34.0. Anything
still wrong is a **new** finding with a screenshot, not a rebuild.

- Login: logo size, sonar ring (no fixed blue circle), DoB month/year columns
  do not overlap, *Set your PIN* centred, shorter PIN fields, CTA directly
  below the second PIN field (LOG-1…LOG-8).
- Top chrome and bottom nav stay fixed while scrolling (GEN-6, GEN-7).
- Trial modal copy (TRIAL-1); onboarding *Step X of Y* fits on two lines with
  Next not overflowing (ONB-2).
- Long labels never overlap amounts in rows (TXT-1 — not reproducible in
  Chromium; needs a real long-content case on device).

---

## 4. Results

Record each case as *pass* / *fail* with build and date. Failures go to
Claude with the `hits.txt` lines.

| Item | Build / date | Result | Notes |
|---|---|---|---|
| A1 · D1–D12, D14, D15 | 8.36.0 (Play internal), 2026-10-15 | D1, D2, D4, D11 pass; the rest not run | Owner-reported, G2. D11 ran inside §6 |
| G2 · `CLOSED-TESTING.md` §6 (second account: opt in → trial → paywall → test card → Premium) | 8.36.0 (Play internal), 2026-10-15 | pass | Owner-reported. The Play install sat on *Installing…* for over 5 minutes but finished; not an app fault (M3 now warns testers) |
| A2 · C1–C13 | | | |
| A3 · step-transition frame rate | | | |
| A4 · motion, both themes, reduced motion | | | |
| A5 · D13 glyph size (QD-26) | 8.36.0 (Play internal), 2026-10-15 | pass | Owner-reported, G2. It failed on 2026-10-05, before UI-FS-1 |
| A6 · D16 onboarding forced answers | 8.36.0 (Play internal), 2026-10-15 | **fail** | Owner-reported, G2: the step stayed blocked, but no toast appeared. The toast (z-index 500) painted under the onboarding overlay (999), so every onboarding validation toast was invisible. 8.36.1 raises it (smoke `assertToastAboveOverlay`) — re-run on 8.36.1, with the step-7 pills now in the case |
| Step 7 Tax balances chips (owner screenshot) | 8.36.0 (Play internal), 2026-10-15 | **fail** | Labels at the 1.5rem tile-glyph size since UI-FS-1; *None selected* squeezed into the 32 px tile. Fixed for 8.36.1 (smoke `assertObSummaryChips`); checked again as part of D16 |
| A6 · D17 km/area block save, PAYE warns | | | |
| A6 · D18 ribbon reads LAUNCH PRICE | | | |
| A6 · D19 on-blur messages, TalkBack, keyboard | | | |
| A6 · D20 export outcome, privacy link | 8.36.0 (Play internal), 2026-10-15 | **fail** | Owner-reported, G2: every export read *Backup not saved*, saves that worked included. @capacitor/share reports a save through Drive or Files as cancelled (`SharePlugin.activityResult`). 8.36.1 asks *Is your backup saved?* (owner's choice, DECISIONS EXP-1; smoke `assertExportOutcome`) — re-run on 8.36.1. Privacy link: not reported |
| A6 · D21 billing states (prepaid, cancel, plan change, unknown plan, clock) | | | |
| A6 · D22 snapshot written, profile wipe, reset, sealed name | | | |
| A6 · D23 icon masks, splash, Go Premium offline/retry, sign-in scopes, activity recreation | | | |
| A6 · D24 sign-in on `AuthorizationClient` — (a)–(c) in G2, then (d), (e) | 8.36.0 (Play internal), 2026-10-15 | (a)–(c) pass; (d), (e) not run | Owner-reported, G2. (a): the trial started after one account tap with **no** consent screen — the account already held the app's Drive grant, so the consent screen's content (Drive app data only) is still unseen; D15 shows it. (b): no prompt, so Google remembers the account and BACKLOG 75 needs no stored account. (c) as expected |
| B1 · QR7–QR11 eyeball | | | |
| B2 · D-1 re-checks | | | |
| B3 · large screens / landscape | | | |
