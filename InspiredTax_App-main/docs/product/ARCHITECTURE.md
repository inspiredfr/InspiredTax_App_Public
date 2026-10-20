# Architecture

The map of what lives where, how data flows, and how the gates catch
regressions. Read it for module-structure work, a new tax year, a new list
editor or a new gate — not by default. Rules are in `CLAUDE.md`; this file
explains them. Verified against `src/` at `15a9d6e` (2026-10-04).

## 1. Deployment model

- **One self-contained HTML file**, `InspiredTax_v<maj>_<min>.html`
  (filename from `package.json`), committed at the repo root. `build.js`
  inlines everything: the esbuild bundle, `main.css`, Chart.js and the fonts
  and Material Symbols subset from `vendor/` as base64 data URIs.
- **Android:** a Capacitor 8 wrap (`capacitor.config.json`, appId
  `za.co.inspiredtax.app`, `webDir: www`). `npm run cap:sync` copies the
  artifact to `www/index.html` and syncs `android/`. Release builds use the
  minified `dist/InspiredTax_v*.release.html` (`npm run build:release`).
  `www/` and `dist/` are gitignored.
- **No server.** All user data is in `localStorage`, encrypted client-side.
- **Network.** The WebView code itself makes no network request. Three native
  plugins do, all via Google Play services: `PlayBillingPlugin`
  (subscriptions), `TrialAnchorPlugin` (trial start timestamp in the user's
  Drive app-data folder) and `CloudBackupPlugin` (encrypted backups in the same
  folder — switched off by `CLOUD_BACKUP_ENABLED = false`).

## 2. Source tree

```
src/
  head.html            <head> — meta, title (version-stamped by build.js)
  body.html            static markup: login/PIN, header, drawer, 8 mode panels
                       (dashboard, income, deductions, summary, projection,
                       actref, taxfaqs, subscribe), 14 static modals, the
                       #modals-dynamic mount, onboarding
  styles/main.css      the one stylesheet — tokens, both themes, components
  js/
    00-forms.js        config-driven modal renderer (renderField/Section/Modal);
                       income, IT3(b), code-picker and wizard modal configs;
                       the kind chooser a multi-kind sheet opens on
                       (cfg.kinds → kindSwitchHtml; data CAPTURE_KINDS)
    01-data.js         pure data: TAX_YEARS (2025–2027), HIST_TAX (2016–2025),
                       SARS travel/subsistence tables, IRP5/IT3(b) code tables,
                       INCOME_DEDUCTION_LINKS, FX rates, filing deadlines,
                       feature switches (RINGFENCE_ENABLED, CLOUD_BACKUP_ENABLED,
                       STEP_TRANSITION), FAQ content
    02-core.js         APP/AUTH state; helpers ($ gv gs sv fmt parseFmt esc);
                       WebCrypto vault; persistence; auth/PIN; navigation;
                       openModal/closeModal; the tax engine — calcFullTax(),
                       calcTaxForYear() and their primitives; export/import;
                       shared chart components; mascot controller (katReact);
                       the shared UI components below
    03-income.js       income pages, employer PAYE, provisional tax and the
                       para-20 penalty (PARA20), carried balances
    04-deductions.js   deduction selector and calculators (retirement, medical,
                       travel, home office, tools, donations); recommendation
                       pills; renderSelectorList()
    05-list-modules.js makeCrudModule() factory (incl. the chooser stage:
                       pickKind / changeKind / onKind, data-kind-stage; save()
                       runs checkScope(), then cfg.validate() → {el, msg}) and
                       most list editors
    06-crypto.js       crypto disposals and revenue
    06a-rental.js      rental properties (s20A manual ring-fence toggle)
    06b-cgt.js         CGT assets
    06c-other-receipts.js  other receipts
    07-render-summary.js   refreshDerived() keystone; Taxation pages — return,
                       risk, history, Act references; taxHeroState()
    08-dashboard-theme.js  Dashboard, completeness, theme
    09-projection.js   multi-year projection, RA analyser, tips
    10-current-year-planner.js  month-by-month planner
    11-historical.js   historical calculator, year comparison, rate tables
    12-bootstrap-onboarding.js  DOMContentLoaded boot, error banner, onboarding;
                       installs 16-debug-harness.js behind __DEBUG_HARNESS__
    13-patches.js      rand rounding and load-time migrations. Legacy name: the
                       monkey-patch layer it once held is gone — do not revive it
    14-entitlement.js  trial/subscription state machine and the plan table
                       (ENT_PLANS: months, prepaid, list price). Imports nothing
                       from other app modules (02-core imports from it);
                       Node-testable
    15-entitlement-ui.js  every gating surface (locked overlay, paywall,
                       subscribe panel, trial chip)
    16-debug-harness.js   in-file cross-screen audit tests; enabled by
                       localStorage iss_debug=1; run by tests/run-debug-harness.js.
                       In the review artifact only — build.js defines
                       __DEBUG_HARNESS__ false for the release bundle (BACKLOG 73)
    16-dob-selector.js date-of-birth Year/Month selects
    17-cloud-backup.js cloud-backup rules and the JS ↔ native contract. Imports
                       nothing; Node-testable (tests/cloud-backup.js)
    18-cloud-backup-ui.js  binds 17 to the clock, plugin, storage and vault;
                       Backup modal Row 2. No-op while the switch is off
    all.js             re-exports the 22 modules above in evaluation order
    index.js           bundle entry: all.js, then the window bridge
    99-window-bridge.js  GENERATED (npm run gen:bridge): republishes the 284
                       functions inline on* handlers call onto window
```

**Module rules.** Evaluation order is `all.js` order. Function-to-function
import cycles are safe (ESM hoists function declarations); reading a foreign
`const` at module-evaluation time is not, because a cycle can flip the order.
Keep derived indexes beside their tables in `01-data.js` (e.g. `IRP5_CODE_MAP`
next to `IRP5_INCOME`). The two `14/15` and `17/18` pairs split rules (pure,
import-free, Node-tested) from UI (DOM, plugins).

**Shared UI components (`02-core.js`).** One implementation each (WR-8):

- *Field validation (FV-1).* `fieldProblem()` / `showFieldProblem()` /
  `checkScope()` / `flagField()` / `clearFieldProblems()`, with delegated
  `input`/`focusout`/`change` listeners. Generic rules come from the markup
  (`data-req`, `min`/`max` on masked numbers); field-specific rules, incl.
  plausibility rules evaluated at their field, are data in `FIELD_CHECKS`
  (`01-data.js`). Errors show inline under the field and block Save / Next
  and the deduction tabs' commit; warnings never block. A list editor's
  `validate()` returns `{el, msg}`.
- *Notes (UI-NOTE-1).* `noteHtml()` / `setNote()` / `noteBody()`: one line
  plus *More*, which opens the help sheet; option notes use `short`/`title`
  in `OPTION_NOTES`.
- *Cards (UI-CARD-1).* `miniCardHtml(spec)` with `onMiniCardToggle()` (one
  open card per `data-group`), `barsHtml()`, `bracketLadderHtml()`; the Tax
  screens' specs are built in `07-render-summary.js` (`glanceCardSpecs()`,
  shared with the Dashboard).

## 3. State and persistence

- **`APP`** — the document: profile fields, data arrays (`incomeItems`,
  `it3bItems`, `tfiItems`, `cgtAssets`, `rentalProperties`, `businessItems`,
  `pensionAnnuityItems`, `otherReceipts`, `retirementLumpsums`,
  `twopotWithdrawals`, `donationItems`, `toolsWtItems`, `employerPaye`,
  `cryptoDisposals`, `cryptoRevenue`, `monthlyPlan`, `lumpSums`), `dedChecks`,
  `profileScenarios`, `easyView`, Chart.js instances (destroy before
  recreate). Some arrays are created by the reset path (`02-core.js`), not the
  `APP` literal.
- **Value flow.** Input → `APP.pendingValues` → (blur/change) →
  `APP.appliedValues` → `calcFullTax()` → render. The engine reads applied
  values only; never store engine results in `APP`, never read engine output
  back from the DOM. After changing an `APP` array: `refreshDerived()` +
  `debounceSave()`.
- **`AUTH`** — session: unlocked flag, data key, decrypted PII.
- **Storage.** `debounceSave()` (600 ms) → `persistData()` → one AES-GCM-256
  blob per profile, key derived from the PIN with PBKDF2-SHA-256, 200 000
  iterations (`PBKDF2_ITERATIONS`). The registry `iss_users` keeps username and
  PIN verifier in clear for the login screen; everything else is sealed
  (`_sealUserPii`/`_openUserPii`, `PII_FIELDS`). Device-scope keys:
  `iss_device` (entitlement, plaintext), `iss_session`,
  `iss_cloud_backup_<user>`. One export payload (`_collectUserData()`) serves
  export, snapshot, import and cloud backup. One wipe (`_purgeLocalProfile()`)
  serves Delete Account and Remove profile: the profile's keys, its Auto
  Backup snapshot and the export copies in the app cache (BACKLOG 71).

## 4. Tax engine

- **`calcFullTax()`** — the ITR12 return: income aggregation by bucket,
  exemptions (s10(1)(i) interest, s10(1)(o)(ii) foreign employment, s10B
  foreign dividends, s10C annuities), s11F retirement cap (two of three limbs —
  see the s11F(2) review in BACKLOG), s18A donations cap and carry-forward,
  CGT aggregation, s12T(7) TFSA excess, lump-sum tables with lifetime
  cumulation, s6A/s6B medical credits, s6quat single limitation with 7-year
  carry-forward, assessed loss, s5(2)(c) flooring, directive withholding.
  Its output fields are the golden suite's expectations (`tests/expected.json`).
- **`calcTaxForYear(inputs, ty)`** — the shared single-year engine for
  projection, planner, historical, RA analyser and the para-20 path. Accepts a
  composition or a direct `taxable`. Any forecast or what-if consumes this —
  never re-derive `max(0, max(0, toi − rebates) − credits)` inline.
- **Adding a tax year.** Add the year to `TAX_YEARS` with its Budget/Gazette
  citation (move the oldest to `HIST_TAX` when it becomes historical), add
  `docs/reference/engine-blueprint/reference-constants.<year>.json`, add or
  refresh a golden scenario, run `npm run test:release`. Existing years must not
  move. Year-keyed tables with no figure yet (`FOREIGN_EXCHANGE_RATES`,
  `FILING_DEADLINES`, subsistence) stay unset — never guessed.

## 5. Gates

| Gate | Command | What it proves |
|---|---|---|
| Static checks | `npm run pretest` | Artifact matches `src/` (`build.js --check`); bridge complete; decision model; contrast pairs; no `font-size: Npx` outside the glyph allow-list; donut colours; motion limits; golden coverage of every calc category; static form conventions; release tools (versionCode packing guard, release line numbers, no debug harness in the release bundle — `tests/release-tools.js`) |
| Unit + golden | `npm test` | pretest + structural invariants, entitlement Tests 1–16, cloud-backup rules, 13 tax-hero states, then boots the artifact headless and byte-compares `calcFullTax()` for every golden scenario, bracket/rebate units, CRUD lifecycle over every list editor, handler audit |
| Engine | `npm run test:engine` | `npm test` + 20 SARS legislative fixtures (`tests/legislative/`, expected values from primary sources) + 14 `calcFullTax`↔`calcTaxForYear` differential checks |
| Release | `npm run test:release` | `test:engine` + `check-constants` against the human-verified SARS reference constants (8 tax years) |
| Boot smoke | `node tests/smoke.js` | No page/console errors, `__missingHandlers` empty, 360 px overflow at 100/125/150 % font scale, modal overflow, CRUD field existence, route/geometry/motion/form assertions. **Not part of `test:release`** — run it separately |
| Debug harness | `node tests/run-debug-harness.js` | Cross-screen DOM-vs-engine equality over the calc-audit fixtures |
| Artifact | `npm run test:artifact` | Smoke on the minified release build |
| CI | `.github/workflows/ci.yml` | Every PR and push to `main`: `check:version`, `test:release` (whose pretest checks the artifact and the bench), smoke, `check:atlas`, `verify:atlas`, `test:bench` |

Manual tools, not gates: `npm run shots` (screenshots, both themes — baseline
stale since QR2), `npm run gen:atlas`, `node
tests/modal-inventory.js`, `node tools/lint-inline-figures.js`, `python3
tools/make-android-icons.py` (launcher layers and splash; needs Pillow).

**What no gate covers:** native Java, the real WebView, Play services, Google
sign-in, Drive I/O, frame rate — `docs/android/DEVICE-CHECKS.md`.

## 6. Release pipeline

`RELEASE.md` is the runbook. In short: the GitHub Actions workflow *Build
InspiredTax* (dispatch only) bumps the version (`tools/release-bump.js`),
rebuilds, runs `test:release`, signs and verifies the APK and AAB against the
pinned upload-certificate fingerprint, uploads them as workflow artifacts and
opens a draft `release/x.y.z` PR. When the version bump reaches `main`,
*Tag release* (`tag-release.yml`) tags the commit `vx.y.z`.
`tools/status-version.js` parses
`STATUS.md`'s **Version** bullet — keep its format.
