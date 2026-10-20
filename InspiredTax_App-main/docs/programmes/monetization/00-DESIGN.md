# 00-DESIGN — Freemium & Google Play Subscription Programme

Status: **owner-approved design** (2026-07-05), **built** (M1–M6, PRs #109,
#110, #149, #150). Still the normative description of entitlement behaviour
(`14-entitlement.js` cites it). Native contracts: `02-BILLING-PLUGIN.md`,
`04-TRIAL-ANCHOR.md`. The staged spec, handover and UI prototypes it mentions
were retired on 2026-10-04 (`git show 15a9d6e:<path>`); the UI is now defined
by the code. Later changes that override this document: **D-M4 is
superseded** — app-managed Drive backup is built behind
`CLOUD_BACKUP_ENABLED` (QD-05–08); Go Premium shows three plans (D-16); the
silent/interactive sign-in policy is QD-01 (`04-TRIAL-ANCHOR.md` §2). See
`docs/DECISIONS.md` §3.

## 1. Product summary

- Every new device gets **7 days of unrestricted access** after a one-time
  **Google Sign-In** that starts the trial (D-M6 hard-gate — the Sign-In is
  what anchors the trial and blocks reinstall-farming). No payment method,
  no card, no hold, no auto-conversion. At day 7 the app drops to **Basic
  mode** automatically. Devices with no Google Play / no Google account
  (sideload, emulator, desktop browser) cannot Sign-In and therefore get
  **Basic directly, no trial** (they cannot subscribe either).
- **Basic mode (free forever)**: dashboard, IRP5 income + PAYE,
  retirement deduction, tax calculation (summary view), reference screens
  (Act refs, FAQs), profile/settings, and **JSON backup export/import**
  (data portability is never paywalled — user data is theirs; this also
  reads well for Play policy review).
- Everything else stays **visible but locked**: greyed, lock icon, short
  explainer, "Subscribe" CTA.
- **Premium** unlocks everything, via Google Play subscriptions.

## 2. Owner decisions (binding)

| # | Decision | Choice |
|---|---|---|
| D-M1 | Purchase verification | **Hybrid**: client-only at launch (Billing Library purchase state + acknowledgment + local cache) behind a pluggable verifier interface; a backend (Play Developer API verification + automatic launch-offer counter) can be slotted in later without reworking the entitlement service. Launch-offer 100-cap is **managed manually in Play Console** (owner deactivates the two launch base plans at ~100 sales). |
| D-M2 | Code protection | esbuild **minify** for the release artifact + **R8** (`minifyEnabled true`) for the native shell. **No asset encryption** (the WebView must decrypt to run; key would ship in the APK — rejected as snake oil). Play Integrity is an optional future verifier hook, not a launch item. |
| D-M3 | Trial/entitlement scope | **Per-device**, anchored at first launch of the billing-enabled version. NOT per user profile (prevents trial reset by creating profiles) and NOT `user.created` (existing users upgrading get a fresh 7 days). |
| D-M4 | Drive backup | Stays **share-sheet** (`@capacitor/share`), upholding decision D14 of the Android handover plan (retired; `git show 15a9d6e:docs/android/ANDROID_HANDOVER_PLAN.md`). No Drive API/OAuth **for user data**. Narrowed by D-M6 for the trial-anchor timestamp only. |
| D-M5 | Launch-offer copy | UI says "first **500** subscribers" per owner instruction; the real cap is 100, enforced manually (see D-M1). |
| D-M6 | Cross-reinstall trial anchor | The 7-day trial **start timestamp** is anchored in the Google Drive **`appDataFolder`** (hidden per-app storage, scope `drive.appdata` only) so uninstall/reinstall no longer grants a fresh trial (§3.3, §8). Supersedes D-M4 **solely for this one non-PII timestamp** — user-data backup stays share-sheet and D14's "no Drive API for user data" otherwise stands. **Posture: HARD-GATE, fail-closed** (owner-chosen). The trial does not exist until a successful Google Sign-In establishes the anchor: **no Sign-In ⇒ no trial ⇒ Basic**. Enforcement is **verify-once-to-start** — Sign-In is required once to *begin* the 7 days; thereafter the trial runs normally, **including offline**, for its remainder (the established `trialStart` is cached device-locally). Devices that cannot Sign-In (no Play services / no account / sideload / browser) get **Basic, no trial**. Coverage is **per Google account**: a second account gets its own trial; on a rooted device the anchor is deletable — honest limits (§7), not bypass-proof. |

## 3. Entitlement architecture

### 3.1 Single service — `src/js/14-entitlement.js` (new module)

Centralized entitlement checking (hard requirement): every premium
feature asks ONE service. Nothing else in the codebase may compute
trial/subscription state.

Public surface (exact names; all other functions module-private):

```js
export const ENT_FEATURES = { /* feature-key registry — §4 */ };
export function getEntitlement()      // → snapshot object, cheap, sync
export function entUnlocked(key)      // → boolean; THE gate everyone calls
export function entInit()             // boot: anchor trial, clock guard, billing sync kick-off
export function entOnLockedTap(key)   // opens #modal-locked for that feature
export function entRefreshUi()        // re-applies lock state to drawer/tabs/FAB/panels
```

`getEntitlement()` returns:

```js
{ tier: 'trial' | 'premium' | 'basic',
  state,             // TRIAL | ACTIVE | IN_GRACE | ON_HOLD | PAUSED |
                     // CANCELLED_PAID_THROUGH | EXPIRED | REVOKED | BASIC
  trialDaysLeft,     // int ≥ 0 (0 when tier !== 'trial')
  plan,              // basePlanId or null
  expiryTimeMs,      // number or null
  offline }          // true when last Play sync failed/stale
```

### 3.2 State machine

```
                +--------------------------- purchase verified ------------------+
                v                                                                |
 first launch → TRIAL (7 days from iss_device.trialStart)                        |
                | trial expiry (clock-guarded)                                   |
                v                                                                |
              BASIC ←──────────────────────────────┐                             |
                                                   |                             |
 PREMIUM states (mirror Play):                     |                             |
   ACTIVE ── renewal fails → IN_GRACE ── grace ends → ON_HOLD ── recovers → ACTIVE
   ACTIVE ── user pauses  → PAUSED    ── resumes   → ACTIVE                     |
   ACTIVE ── user cancels → CANCELLED_PAID_THROUGH ── expiry → EXPIRED → BASIC  |
   any    ── refund/revoke → REVOKED → BASIC (immediate on next sync)           |
```

Access rule: `tier === 'premium'` (unlocked) for ACTIVE, IN_GRACE,
CANCELLED_PAID_THROUGH. ON_HOLD, PAUSED, EXPIRED, REVOKED → `basic`.
(IN_GRACE keeps access per Play best practice — payment is being retried;
ON_HOLD does not.)

### 3.3 Device-level storage — new localStorage key `iss_device`

Plaintext (readable pre-unlock — gating must work at the login screen and
across all user profiles), device-scoped, **never** included in
`persistData()` / `hydrateFromData()` / `_buildExportPayload()`.
Entitlement NEVER rides a JSON backup; on reinstall or device change,
premium is restored via `getPurchases()` on first billing connection.

The **trial start** is anchored off-device in the Google Drive
`appDataFolder` (D-M6, **hard-gate**). A fresh `iss_device` has
`trialStart: null` — **no trial yet**. `_computeState()` maps a null/absent
`trialStart` to Basic, so an un-verified device is Basic. At `entInit()`,
`_syncTrialAnchor()` (async, **fail-closed**, never throws) is the only
thing that establishes the trial: on a **successful** Google Sign-In it
reads the anchor and computes
`established = _reconcileTrialStart(localStart, anchorStart) ?? now` —
`_reconcileTrialStart()` = **the earliest of the two** (earliest wins, so a
reinstall inherits its old start and can never obtain a fresh one; a
genuine first-ever verified launch starts at `now`) — then writes
`established` to both the local record and Drive. **Any** failure to verify
(no native plugin — browser / sideload / no Play services; Sign-In
declined; offline; Drive error) leaves `trialStart` untouched, so a fresh
device stays **Basic, no trial**. Verify-once: once `trialStart` is
persisted locally, later launches honour it offline (this sync no-ops on
failure). The Drive anchor body carries **only** `{ v, trialStart }` — no
PII, no username, no entitlement, no user data; it is not a backup, it is
one timestamp.

```json
{ "v": 1,
  "trialStart": null,
  "clockHighWater": 1751706000000,
  "entitlement": {
    "productId": "premium",
    "basePlanId": "annual-r495",
    "purchaseToken": "…",
    "expiryTimeMs": 1783242000000,
    "autoRenewing": true,
    "state": "ACTIVE",
    "lastVerified": 1751706000000
  } }
```

`trialStart` is `null` until Sign-In establishes it (above); once set it is
an ISO string. `entitlement` is `null` until a purchase is seen.
Corrupt/missing `iss_device` → recreate with `trialStart = null`
(fail-closed to Basic, never to a crash; deleting it is equivalent to a
reinstall — no trial until the Drive anchor re-verifies, which inherits the
old start rather than granting a fresh one).

### 3.4 Clock-tamper guard

No server time exists (offline-first). Defence is a **monotonic
high-water mark**: `clockHighWater = max(clockHighWater, Date.now())`,
updated at `entInit()` and on every `debounceSave()` flush (cheap: one
`localStorage` read-modify-write alongside the existing write).

Rules — evaluate ALL time comparisons against
`effectiveNow = max(Date.now(), clockHighWater)`:
- Trial: `trialDaysLeft = 7 - floor((effectiveNow - trialStart)/86400000)`.
  Rolling the clock back never adds days; rolling forward burns them (the
  high-water then keeps them burnt — the tamperer only loses).
- Cached premium expiry: compared against `effectiveNow` too, so a
  rolled-back clock cannot resurrect an expired subscription.
- Play sync is always ultimate truth when reachable: whatever
  `getPurchases()` returns overwrites the cache.

### 3.5 Pluggable verifier

```js
// v1 (launch): local — purchase came from the Billing Library on-device,
// purchaseState === PURCHASED, then acknowledge.
// v2 (future): POST {token, productId} to a backend that calls
// purchases.subscriptionsv2.get and returns a signed entitlement;
// optional Play Integrity verdict alongside.
async function verifyPurchase(purchase) → { ok, entitlement }
```

The entitlement service only ever consumes the verifier's output, so
swapping v1→v2 touches one function.

### 3.6 Offline behaviour

- Cached entitlement grants access while offline within a validity
  window: **auto-renew plans: `expiryTimeMs` + 30 days** (covers grace/
  retry realities without Play reachability); **prepaid plans:
  `expiryTimeMs` + 3 days** (prepaid has no renewal to be generous about).
  Since BACKLOG 70 the window runs from the later of `expiryTimeMs` and
  `verifiedAtEffective` — the last moment Play listed the purchase, on the
  same tamper-guarded clock — so a purchase Play lists is never expired by
  a derived date or a future clock high-water mark (02-BILLING §4).
- Resync (`getPurchases()` + `getProducts()`) runs at: app boot, app
  resume (`@capacitor/app` `appStateChange` — listener already exists for
  back-nav; extend at source, don't add a second listener), and after a
  purchase flow. Failures are silent (offline flag set); success rewrites
  the cache and `lastVerified`.
- Play unreachable AND cache window exceeded → `basic` with a
  non-punitive "Reconnect to verify your subscription" note on the
  subscribe panel (never a lockout dialog in the user's face mid-task).

## 4. Feature keys & gated surfaces

`ENT_FEATURES` registry (key → surfaces). FREE surfaces are simply absent
from the registry — `entUnlocked()` returns `true` for unknown keys, so
free flows never consult billing state.

| Feature key | Locked surfaces (panel/tab ids, drawer `data-screen`, FAB/CRUD entry points) |
|---|---|
| `income.investment` | tab `income-b2investment`, drawer item, IT3(b) CRUD |
| `income.rental` | tab `income-b3rental`, drawer, FAB `addRentalProperty`, `M_rental` |
| `income.business` | tab `income-b4business`, drawer, business CRUD |
| `income.cgt` | tab `income-b5cgt`, drawer, FAB `addCgtAsset`, `M_cgt` |
| `income.foreign` | tab `income-b6foreign`, drawer, foreign CRUD |
| `income.other` | tab `income-b9other`, drawer, `M_otherReceipt` |
| `income.crypto` | tab `income-b10crypto`, drawer, FAB `addCryptoDisposal`, crypto modals |
| `ded.medical` … `ded.subsistence` | every `ded-*` tab EXCEPT `ded-retirement`; one key per deduction (`ded.medical`, `ded.travel`, `ded.homeoffice`, `ded.donations`, `ded.tools`, `ded.subscriptions`, `ded.subsistence`) |
| `projection` | `mode-projection` (all tabs), drawer `proj-scenario` |
| `provtax` | `mode-provtax` incl. monthly planner, drawer `provtax` |
| `historical` | `mode-historical` (both tabs), drawer `hist-calculator` |
| `risk` | tab `summary-risk`, drawer `summary-risk` |
| `export.itr12` | `exportITR12()` / `copyITR12` buttons (summary panel) |
| `export.csv` | `exportTaxYearAsCsv()` button (profile modal) |

FREE (never gated): `mode-dashboard`, `income-main`, `income-paye`,
`ded-retirement`, `summary-return` (view + its calc), `mode-actref`,
`mode-taxfaqs`, profile/settings/theme, onboarding, **JSON backup
export/import**, login/multi-user.

### 4.1 Data policy (firm, per CLAUDE.md rule precedence #1)

**Tax correctness overrides monetization.** Data already entered in
locked modules is retained, still persists, still exports in backups, and
the engine **keeps computing the full, correct tax with it**. The app
never shows a wrong tax number to sell a subscription. Gating blocks
*navigating into, adding, and editing* locked modules — not the math.
The locked-panel overlay on a module that holds data says so explicitly
("Your N rental entries are safe and still included in your tax
calculation").

### 4.2 Enforcement points (at source — no wrapper/patch layers)

- `navigateTo()` side-effects map (02-core.js): for a locked mode/tab,
  render the panel's **locked overlay** (pattern: `#ded-activation-prompt`)
  instead of the normal renderer. Navigation itself is allowed — the
  locked state is a first-class screen, not a bounce.
- `updateDrawerDeductions` / `updateDrawerIncomeCalcs` / `updateIncomeTabs`
  / `updateDeductionTabs` (04-deductions.js): add `.ent-locked` class +
  `fa-lock` glyph to locked items **instead of hiding them** (requirement:
  visible but disabled). Tap → `entOnLockedTap(key)`.
- `getFABConfig` (08-dashboard-theme.js): locked context → FAB becomes
  the Subscribe action.
- CRUD save/add handlers (05-list-modules `makeCrudModule` config +
  the module-specific add FABs): guard with `entUnlocked(key)`; blocked →
  `entOnLockedTap(key)`. Belt-and-braces for deep links/back-stack.
- `exportITR12` / `exportTaxYearAsCsv`: guard at function top.

Onboarding is NOT gated: during trial everything is open, and after
expiry onboarding answers still record intent (a locked bucket the user
activates in onboarding shows locked afterwards) — onboarding logic
unchanged.

## 5. Google Play product model

One subscription product **`premium`**, six base plans:

| Base plan id | Type | Price | Notes |
|---|---|---|---|
| `monthly-r75` | auto-renewing, P1M | R75/mo | |
| `annual-r495` | auto-renewing, P1Y | R495/yr | |
| `prepaid-1m-r95` | prepaid, P1M | R95 | user extends manually |
| `prepaid-3m-r245` | prepaid, P3M | R245 | |
| `annual-launch-r300` | auto-renewing, P1Y | R300/yr | launch offer |
| `prepaid-3m-launch-r150` | prepaid, P3M | R150 | launch offer |

Rationale: prepaid base plans model the non-renewing "1 Month / 3 Months"
products (Play best practice — do NOT fake these with managed products);
launch prices are **separate base plans**, not offers, because prepaid
plans cannot carry offers and a separate plan is what the owner can
deactivate in Play Console with one switch. The client renders whatever
`getProducts()` returns as active — when the owner retires the launch
plans, they vanish from the UI with zero code change. Nothing about plan
availability is hardcoded.

Upgrade/downgrade (auto-renew plans only): `launchBillingFlow` with
`SubscriptionUpdateParams` — upgrade `CHARGE_PRORATED_PRICE`, downgrade
`DEFERRED`. Prepaid → auto-renew: normal purchase; Play stacks prepaid
time first. See `02-BILLING-PLUGIN.md` §5.

## 6. UX design (approved prototypes are the contract)

Three surfaces, prototyped in `_mockups/` at 360×640 + 412×915, both
themes, using the current unified token system (base tokens canvas/surf/text,
category tokens per-screen colour, semantic tokens for outcomes):

1. **Subscribe panel** (`mode-subscribe`, drawer item "Go Premium" +
   dashboard chip + every locked CTA): trial/status header, plan cards
   (launch plans highlighted, "First 500 subscribers" ribbon),
   free-vs-premium comparison accordion, Restore purchases,
   Manage subscription (deep link
   `https://play.google.com/store/account/subscriptions?sku=premium&package=za.co.inspiredtax.app`),
   fine print (cancel anytime, Play handles payment).
2. **Locked-feature modal** (`#modal-locked`, via `openModal` — focus
   trapped): feature icon + name, one-line value explainer (per-key copy
   in `ENT_FEATURES`), "Subscribe" → `navigateTo('subscribe')`,
   "Not now" dismiss.
3. **Locked-state visuals**: `.ent-locked` drawer items/tabs (greyed,
   `fa-lock`), locked panel overlay with explainer + CTA + data-retention
   note, dashboard **trial chip** ("Premium trial — N days left", turns
   amber at ≤2 days, becomes "Go Premium" in basic), one-time
   **trial-start welcome dialog** at first launch — under the D-M6
   hard-gate this dialog carries the **"Sign in with Google to start your
   7-day free trial"** CTA (the Sign-In is what establishes the trial);
   declining leaves the user in Basic with the CTA still available later.

A11y: lock state carried by `aria-disabled="true"` + visually-hidden
"(Premium)" suffix; chip is a button; modal via `openModal`/`closeModal`
only; all copy through `esc()` where user data is interpolated.

## 7. Security considerations

- **Threat model honesty**: client-only entitlement on a rooted device is
  bypassable. Accepted at launch (D-M1); the verifier interface is the
  upgrade path. What we DO defend: casual clock tampering (§3.4), trial
  reset via new profiles (device anchor), **trial reset via
  uninstall/reinstall** (Drive `appDataFolder` anchor, D-M6/§3.3),
  entitlement forgery via backup import (entitlement never in backups),
  refunded-purchase retention (resync overwrites cache; REVOKED → basic
  immediately). The reinstall defence is a **hard-gate** (D-M6): no
  Google Sign-In ⇒ no trial, so a reinstaller cannot farm a fresh trial —
  the anchor either grants nothing (declined/offline/no-Play) or inherits
  the old start (signed in). Its honest residual limits: coverage is **per
  Google account** (a second account gets its own trial) and on a **rooted
  device** the `appDataFolder` file is deletable — not a hard DRM claim.
- **Trial-anchor privacy & scope** (D-M6): Google Sign-In is requested
  with the **least-privilege** `drive.appdata` scope only — the app cannot
  see, read, or write the user's real Drive files, only its own hidden
  config folder. The anchor file holds a single non-PII timestamp
  (`{ v, trialStart }`). This introduces a Google-account identifier +ne
  a network dependency at first launch (in addition to Play Billing) — the
  data-safety narrative (§7 release note below, stage M6, `ANDROID.md`)
  must declare Google Sign-In and the `drive.appdata` access. D14 (no
  Drive API for user-data backup) still stands; the share-sheet backup is
  unchanged.
- **Release-build protection** (D-M2): `build.js --release` → esbuild
  `minify: true` (whitespace + identifier mangling + syntax) on the IIFE.
  Window-bridge globals survive (explicit `window.x =` property writes).
  Release artifact is a **separate output** (`dist/`), consumed by
  `tools/make-www.js`; the committed dev artifact stays unminified so
  `pretest --check`, the golden suite, and diffability are untouched.
  Native shell: `minifyEnabled true` + `shrinkResources true` + proguard
  keep rules (Capacitor bridge, billing plugin, WebView JS interfaces).
- **No secrets in the client.** No API keys, no license keys. **Amended
  2026-10-15 (DECISIONS DS-1, BACKLOG 33):** no billing identity is sent —
  the `obfuscatedAccountId` (SHA-256 of a random install UUID) is dropped so
  the Data safety form's "no data collected" stays true; an `installId`
  already stored in `iss_device` is inert.
- Backup hardening (existing flow, small change): encrypted export stays
  the default; plaintext export moves behind a dedicated exception dialog
  with explicit PII warning + "I understand the risks" checkbox
  (`01-SPEC.md` stage M5).
- **Data-safety narrative change**: billing introduces the app's first
  network dependency (Play Billing via Play Services). `docs/android/
  ANDROID.md`'s "zero network requests / no third-party SDKs" claim must
  be updated before store submission (stage M6). D14 (no Drive API)
  stands.

## 8. Edge cases (normative)

| Case | Behaviour |
|---|---|
| Refund / revoke | Next sync sees REVOKED → cache overwritten → basic immediately; no dialog, subscribe panel shows state |
| Cancel, still paid | CANCELLED_PAID_THROUGH → premium until `expiryTimeMs`, panel shows "Cancelled — access until {date}, Resubscribe" |
| Renewal payment fails | IN_GRACE → keep premium, banner "Payment issue — update in Google Play" with deep link; ON_HOLD → basic, same banner |
| Pending purchase (slow payment method) | `purchaseState = PENDING` → toast "Purchase pending — you'll be unlocked when payment completes"; NO unlock; resolves via `purchasesUpdated` or next resync; never acknowledge a PENDING purchase |
| ITEM_ALREADY_OWNED on purchase | Run restore (`getPurchases()`), unlock silently |
| Restore on new device / reinstall | Subscribe panel "Restore purchases" → `getPurchases()`; also runs automatically at every boot sync, so reinstall self-heals without the button |
| First launch, Sign-In accepted | Trial established (`trialStart = now`), 7 days begin; anchor written to Drive |
| First launch, Sign-In declined / offline / no Play services | **Basic, no trial** (hard-gate, fail-closed); the Sign-In CTA stays available to start the trial later |
| Reinstall mid-trial (signed in) | Inherits the **original** `trialStart` from the Drive anchor — continues the same trial (earliest-wins), never a fresh one |
| Reinstall after trial expired (signed in) | Anchor's old `trialStart` → **Basic immediately**, no fresh trial |
| Second Google account | Its own trial (documented per-account limit, D-M6/§7) |
| Verify-once then offline | Established `trialStart` is cached locally → the trial runs offline for its remainder; the anchor sync no-ops on failure |
| Clock rollback / forward | §3.4 — user can only lose time, never gain. Exception (v1 client verifier): a paid purchase synced with the clock forward, then kept offline, outlasts a lapse by the jump + grace (02-BILLING §4 "Known v1 limit"); an online launch ends it |
| Airplane-mode purchase attempt | `SERVICE_UNAVAILABLE` → toast "You're offline — connect to subscribe"; panel stays usable read-only |
| No Play services / sideload / desktop browser | `isAvailable()` false → **Basic, no trial** (hard-gate — Sign-In impossible, D-M6); subscribe panel explains Play is required; purchase buttons hidden, no errors |
| Multiple Google accounts on device | Whatever account completes the Play flow owns the sub; `getPurchases()` reflects the active Play account — document in FAQ, no code |
| Multiple app profiles | One device entitlement covers all profiles (D-M3) |
| Trial expiry mid-session | State computed on each `entRefreshUi()` (nav + resume); no mid-keystroke rug-pull — next navigation shows locks; dashboard chip flips |

## 9. Why these choices (alternatives rejected)

- **RevenueCat / cordova-plugin-purchase** rejected for a custom minimal
  Capacitor plugin: zero third-party services preserves the app's privacy
  story (a selling point in the Play data-safety form), Billing Library 8
  surface needed here is small (~400 lines Java), and cordova-plugin-
  purchase's abstraction layer is bigger than the problem.
- **Offers instead of launch base plans** rejected: prepaid plans can't
  carry offers; separate base plans give the owner a one-switch manual
  kill (D-M1) and identical client code for all six plans.
- **Hiding locked features** rejected by requirement (visible + greyed +
  lock + CTA).
- **Blocking the engine for locked data** rejected: tax correctness is
  rule-precedence #1 (§4.1).
- **Reinstall-trial defence — Drive `appDataFolder` chosen** (D-M6) over:
  (a) *Play native free-trial offer* — the only server-robust option, but
  requires a payment method on file + auto-conversion at day 7, reversing
  the "no card, no auto-conversion" product promise (§1) — rejected;
  (b) *own backend trial ledger* (+ Play Integrity / Sign-In token) —
  card-free and robust, but adds a hard network dependency at first launch,
  reverses D-M1's client-only-at-launch, and undercuts the
  zero-third-party-service privacy story (§7) — deferred with the rest of
  the v2 backend; (c) *stay client-only, accept resets* — keeps every
  decision but delivers no block. The Drive anchor is the card-free,
  no-own-backend middle path: it survives reinstall via Google's storage
  and uses the least-privilege `drive.appdata` scope. Owner chose the
  **hard-gate, fail-closed** posture (no Sign-In ⇒ no trial), enforced
  **verify-once-to-start**. Its honest cost is per-account (not per-device)
  coverage and a mandatory first-launch Sign-In/consent before the trial —
  accepted (D-M6, §7).
