# Programmes and QA sessions — consolidated record

Every programme, QA round and batch series run on this repo, from the first
PR (2026-06-11) to 2026-10-04: what it set out to do, what shipped, how it was
verified, and what it left open. **Read on demand** — not at session start.

- **Evidence base.** Built from `git log origin/main` (1,389 commits, PRs
  #1–#387, merge and squash messages), the programme documents themselves,
  and spot checks of `src/`. Where a statement rests only on a programme's own
  closing report, it says so.
- **Open items are not tracked here.** Every open residue below names the
  `BACKLOG.md` item that now owns it. This file is history plus pointers.
- **Retired documents.** The programme folders were removed on 2026-10-04
  (docs audit). Every path named under *Source docs* below can be read with
  `git show 15a9d6e:<path>`. Code comments that cite these documents resolve
  the same way.
- **Maintenance.** When a programme opens, add a row to the timeline and a
  section; when it closes, record the outcome and move its open residue to
  `BACKLOG.md`. See `docs/DOCS-INDEX.md` for the full maintenance rule.

---

## 1. Timeline

| # | Programme / series | Dates | PRs | Versions | Outcome |
|---|---|---|---|---|---|
| P1 | v8.22 audit and reconstruction | 06-11 → 06-12 | #1–#8 | 8.22.0 | Closed |
| P2 | UX standardisation and UX-principles batches A–E | 06-13 → 06-15 | #9–#19, #22–#23 | — | Closed |
| P3 | Mobile UI overhaul (onboarding, bottom nav, batches A–P) | 06-15 → 06-21 | #24–#29, #35–#55 | 8.23.0–8.25.0 | Closed |
| P4 | Native-shell attempt | 06-17 | #30, #31 | — | **Reverted** (#31) |
| P5 | Data-entry architecture (config-driven editors) | 06-21 → 06-22 | #56–#61 | 8.26.0 | Closed |
| P6 | v8.27 engine and UX batches | 06-29 → 07-01 | #67–#87, #89–#93 | 8.27.0 | Closed |
| P7 | Android production readiness (Capacitor wrap) | 07-02 → 07-03 | #94–#96 | — | Closed |
| P8 | SARS engine remediation | 07-03 → 07-05 | #97, #100–#106 | 8.28.0 | Closed |
| P9 | Monetization (freemium, Play Billing, trial anchor) | 07-05 → 07-17 | #107, #109, #110, #149, #150 | 8.30.0 | Closed |
| P10 | Play Store launch preparation | 07-05 → ongoing | #108, #112–#114, #135, #146–#148, #164–#169, #208 | — | **Open** — closed testing |
| P11 | Tax-calc standardisation | 07-10 → 07-11 | #115–#134 | 8.29.0 | Closed |
| P12 | Citation audit (P-H2) and tax-year close-out (P-H1) | 07-13 | #139–#144 | — | Closed |
| P13 | Release runbook and repo-readiness review | 07-18 | #155–#160 | — | Closed |
| P14 | Device QA and Google sign-in (MZ-2) | 07-18 → 08-01 | #161–#163, #166–#175, #192, #195, #197, #198, #209 | 8.30.2 | Closed into QR1 |
| P15 | UI/UX remediation batches D/E/I/J/K | 07-24 → 07-25 | #176–#183 | — | Closed |
| P16 | Simplification and personality (B0–B7) + owner-feedback follow-up | 07-26 → 08-24 | #184–#210, #228–#239 | 8.31.x–8.33.2 | Closed |
| P17 | Visual refresh → design system applied app-wide | 07-31 → 08-13 | #207, #210, #211, #214 | 8.33.0 | Closed |
| P18 | CI and release automation | 08-13 → 09-14 | #212, #216, #217, #223, #224, #311, #312, #314 | — | Closed |
| P19 | Tax coverage and gap analysis | 08-14 → 08-28 | #218–#222, #229, #231, #234, #242, #243, #246–#250 | 8.33.1–8.33.3 | Closed (8 items deferred) |
| P20 | QA 2026-08 rounds | 08-26 → 09-09 | #236, #240, #251–#263, #287–#293, #297 | 8.33.3–8.33.5 | Closed |
| P21 | Design handoff 2026-08-30 | 08-30 → 10-02 | #264–#285, #289, #381 | 8.33.4 | Closed |
| P22 | App Atlas and decision studio | 08-21 → 09-10 | #227, #237, #238, #302, #303 | — | Closed (tooling kept) |
| P23 | Design-system audit 2026-09 | 09-09 → 09-14 | #295, #296, #298–#301, #304–#310 | 8.33.6 | Closed (residue in BACKLOG) |
| P24 | Login and onboarding UX | 09-14 | #315–#321 | 8.33.7 | Closed |
| P25 | UI/UX polish pass 2026-09 (B0–B10) | 09-16 → 09-19 | #330–#335 | 8.33.8, 8.34.0 | Closed (residue in BACKLOG) |
| P26 | Calculation audit 2026-09 (S1–S4) | 09-19 → 09-20 | direct commits, #337 | 8.34.1, 8.34.2 | Closed (residue in BACKLOG) |
| P27 | QA remediation 2026-09 (QR0–QR12) | 09-25 → 10-02 | #339–#379 | — | Closed (residue in BACKLOG) |
| P28 | Post-close-out batch | 10-01 → 10-03 | #368, #370, #372, #380–#387 | 8.35.0, 8.35.1 | Closed |
| P29 | Docs audit 2026-10 | 10-04 | #389 | — | Closed |
| P30 | Owner interview and clearance | 10-05 | #391 | — | Closed (residue in BACKLOG) |
| P31 | Font-scale and capture remediation (owner screenshots 2026-10-05) | 10-05 → | #390, #392–#395 | — | Open (BACKLOG) |
| P32 | On-blur field validation (FV-1, promoted in P30) | 10-07 | #396 | — | Closed (residue in BACKLOG) |
| P33 | Post-merge integrity audit of sessions A/B/C | 10-07 | this PR | — | Closed (residue in BACKLOG) |
| P34 | Branch audit — unmerged work classified and cleared | 10-07 | this PR | — | Closed |
| P40 | User needs 2026-10 — personas, app assessment, market evidence, implementation spec | 10-16 → 10-17 | this PR | — | Closed into BACKLOG 100–109 |

Dates are 2026. Versions are the `package.json` values on `main` (first-parent
history); 8.31.x was cut on a branch and reached `main` through #194–#199.

---

## 2. Programme records

### P1 · v8.22 audit and reconstruction (06-11 → 06-12)

- **Scope.** Rebuild a patch-on-patch codebase into maintainable source.
- **Shipped.** Patch-layer merge, golden tests, `makeCrudModule` factory,
  security and a11y hardening (#1); one shared `calcTaxForYear()` engine for
  forecast and history (#2); ARIA tabs and live regions (#3); para-20
  constants (#4); s23(m) commission carve-out and the window bridge (#5);
  real ES modules bundled by esbuild (#6); px → rem typography (#7);
  `CLAUDE.md` and the first architecture doc (#8).
- **Lasting effect.** Hard rules 1–7 and 9–10 in `CLAUDE.md` come from here.
- **Source docs.** `docs/archive/AUDIT_REPORT.md`.

### P2 · UX standardisation, UX-principles batches A–E (06-13 → 06-15)

- **Shipped.** Design-token mockup lab and phase 1 (#9, #10); save-as-you-go
  replaced Apply buttons (#12); provenance popovers (#13, #14); medical-aid
  autocomplete (#15); Enter-to-submit and single-column forms (#16);
  accordion modals (#17); modal layout fixes (#18, #19).
- **Source docs.** `docs/archive/UX_PRINCIPLES_AUDIT.md`,
  `docs/archive/UX_VISUAL_SPEC.md`.

### P3 · Mobile UI overhaul (06-15 → 06-21)

- **Shipped.** Onboarding overhaul (#24); income-engine module split (#26);
  bottom nav and compact density (#27); safe-area fixes (#29); batches A–P —
  progressive disclosure, prior-year sub-pages, profile ↔ onboarding sync,
  9-type income taxonomy, bottom-sheet modals, config-driven modal renderer,
  rental/business/CGT redesigns, FAB save (#35–#55).
- **Source docs.** `docs/product/ONBOARDING_SYSTEM_SPEC.md` (spec of 06-18;
  superseded by later onboarding work — the App Atlas is the current
  reference).

### P4 · Native-shell attempt (06-17) — reverted

#30 converted the SPA into a locked native-app shell; #31 reverted it the same
day. The Capacitor wrap (P7) replaced the idea.

### P5 · Data-entry architecture (06-21 → 06-22)

- **Shipped.** Universal config-driven record editors in wizard mode; crypto,
  income, PAYE and deduction-code entry moved onto the shared factory;
  dead-code removal (#56–#59, #61). Crypto capital gains were dropped from the
  CGT base when no manual asset existed — fixed (#60).

### P6 · v8.27 engine and UX batches (06-29 → 07-01)

- **Shipped.** Deduction tile notes and credit totals (#67); hamburger menu,
  FAQs, About (#68); carry-forward fields, FTC wiring, lump-sum breakdown
  (#70); engine blueprint v1.0 (#71); Focus hero (#72, #73); five
  tax-correctness fixes (#74, #75); module refinements (#76–#84); audit
  close-out and guided deduction stepper (#85–#87); s6quat FTC dividend and
  interest baskets (#89); Batch M dashboard/onboarding/income UX (#90–#93).
- **Note.** #89's basket design was later replaced by P8's W9 (one overall
  limitation, per IN18).

### P7 · Android production readiness (07-02 → 07-03)

- **Shipped.** Capacitor wrap, asset vendoring, back-stack fixes (#94); two
  review cycles (#95, #96).
- **Decision that still binds.** Native code is a dumb pipe; all logic stays
  in JS (restated by every plugin since).
- **Source docs.** `docs/android/ANDROID_HANDOVER_PLAN.md`,
  `docs/android/ANDROID_UX_REVIEW.md`. Live runbook: `docs/android/ANDROID.md`.

### P8 · SARS engine remediation (07-03 → 07-05)

- **Scope.** Full engine audit → challenge pass → scored owner interview →
  staged fixes behind a new verification design.
- **Shipped.** Stage 0 verification tiers — invariants, legislative fixtures,
  differential suite, reference constants (#100); Stages 1–5: data fixes
  W1/W2/W7/W16/W17, module fixes W3/W12–W15/W19, pipeline changes W4/W5/W8,
  lump-sum relief and ordering W10, directive withholding W11, s6quat rebuild
  W9, code tables W6/W20 (#101–#105); mutation pass and close (#106).
- **Verification.** The four-tier gate (`npm run test:engine`,
  `test:release`) still runs today: 20 legislative fixtures, 14 differential
  checks and reference constants for 8 tax years pass on `15a9d6e`
  (run 2026-10-04).
- **Backlog items it raised.** A1–A4, A6, A8 are built (codes 3718–3721,
  3805, 3816, 3907, 3922, 4116, 4017, 4238 are in `01-data.js`; the
  personal-use CGT note and the leased-vehicle note are live). **A5** is
  `RF-1`; **A7** is the ITR12 code audit. R1 (farming, s10A, trust income
  and others) was rejected as disclose-only.
- **Source docs.** `docs/programmes/engine-remediation/` (00–05).

### P9 · Monetization (07-05 → 07-17)

- **Shipped.** Design and prototypes (#107); M1 entitlement service and trial
  (#109); M3.5 cross-reinstall trial anchor (#110); M2–M6 gating UI, Play
  Billing plugin, release build protection, docs (#149, #150).
- **Live specs kept.** `docs/programmes/monetization/00-DESIGN.md`
  (entitlement behaviour), `02-BILLING-PLUGIN.md`, `04-TRIAL-ANCHOR.md`
  (native contracts).
- **Open residue.** Billing `REFUNDED` renders as `EXPIRED` (BACKLOG
  deferred table).

### P10 · Play Store launch (07-05 → ongoing)

- **Shipped (repo side).** Launch spec (#108); decision tracking (#112);
  disclaimer and Terms (#113, #114); INTERNET permission, app name, version
  in About (#135); Android Auto Backup (#136); adaptive icon, contrast, R8,
  signing runbook (#146, #147); store copy and assets (#164, #165); Play
  rejection fix — SARS source link (#167, #169); support email (#208);
  rename to "InspiredTax" (#175); leaked `keystore.properties` untracked
  (#154).
- **Owner-reported.** All Console-side preparation complete by 2026-09-09.
  **Closed-testing track created 2026-10-02; no testers recruited yet**
  (owner, 2026-10-04). 2026-10-14: invite adopted and license testing set
  up (closed BACKLOG 52); recruitment by hand (DECISIONS CT-1); tester gift
  = one-time promo codes (CT-2).
- **Closed-testing readiness assessment (2026-10-14).** Before the first
  invite, the playbook, the code, CI and Play's rules were checked against
  each other. Found: the track can hold at most 8.35.2 (last build
  2026-10-03) while `main` is 66 commits ahead with the D13 fix and a crypto
  tax correction; no device check has run; Android vitals cannot see a
  web-layer error and the app has no other error channel; Google judges
  engagement, which nothing in the playbook drove after day 7. Added: the
  go/no-go gate (`CLOSED-TESTING.md` §0), BACKLOG 66–69, the de-identified
  feedback log and feature-task matrix
  (`docs/programmes/closed-testing-2026-10/`, retired at production access),
  the `tester-feedback` skill, automatic release tagging
  (`tag-release.yml`), and a 500-character 8.36.0 *What's new* draft.
- **Compliance scan and bug hunt (2026-10-14).** review-ready (privacy,
  billing, permissions, metadata, crash-risk auditors) and a qa-bug-hunter
  pass on the first-five-minutes and test-period flows. No Play blocker;
  boot smoke clean on the dev and a minified release artifact. Found, with
  failing repros: the native bridge never reports the base plan, so prepaid
  3-month and cancelled subscriptions lose paid access; a future clock
  high-water locks out subscribers; the export reports success before
  anything is saved; Delete Account leaves the backup snapshot; no in-app
  privacy link; Data safety drafts that do not match the app. Recorded as
  BACKLOG 70–74 and an updated 33. Same day, on the same PR: 72 fixed
  (`_downloadBlob` returns the outcome; smoke `assertExportOutcome`, shown
  failing on the pre-fix build) and 71 part 1 (privacy link in About and
  Terms); device case D20; copy deck C-69, C-70. Then 70, the billing
  verifier: Play listing the purchase decides Premium
  (`verifiedAtEffective`), plan hints from the purchase delta,
  `CANCELLED_PAID_THROUGH` for non-renewing purchases, full-list-only
  expiry, an in-flight guard, a first-ever trial resetting a future clock
  high-water, days capped at 7, and the unlock resync. Test 17 (native
  shape) fails case by case on the previous code; smoke
  `assertPremiumWording`; device case D21; copy deck C-71–C-73 (PR #409).
  Then 71 (new PR): one profile wipe (`_purgeLocalProfile`) for Delete
  Account and Remove profile — keys, own snapshot, export copies; Reset
  reloads the empty profile through `restoreData()` and awaits the save;
  the Auto Backup snapshot write, refused for want of `encoding: 'utf8'`
  since it was added, now lands; `fullName` sealed PII (owner chose
  *encrypt*), with the lock-screen unlock now saving its migration. Smoke
  `assertProfilePurge`, `assertResetClears`, `assertNameSealed`, each shown
  failing on the previous code; device case D22; copy deck C-74. The owner
  approved copy C-69–C-73 the same day (PR #410). Then 73, launch polish:
  Go Premium sells only Play's plans with every figure from Play's prices
  (one plan table, `ENT_PLANS`); adaptive icon inside the safe zone, themed
  icon centred, navy splash (`tools/make-android-icons.py`); billing
  connection and Drive executor released on destroy; sign-in trimmed to
  e-mail + drive.appdata; `file_paths.xml` cache-only; `getUsers()` shape
  check; versionCode packing guard, release line numbers, debug harness out
  of the release bundle. The Android debug and release builds compiled in
  the session (local SDK). Smoke `assertRegistryShape`,
  `assertSubscribePricing` and `tests/release-tools.js`, each failing on the
  previous tree; device cases D23 and B3; copy deck C-75. The
  `AuthorizationClient` move is planned as BACKLOG 75 (PR #411, merged). Then 74 (its own PR),
  the copy corrections, with the owner's calls (ribbon *LAUNCH PRICE*, PIN
  claim reworded, inspiredfr@gmail.com everywhere): the welcome dialog
  offers the trial, honest About/FAQ/Terms data lines, a Terms subscriptions
  clause, Terms and Privacy linked from Go Premium, no grace-day count; the
  Play listing and release notes corrected; the website's privacy policy
  (Google sign-in, purchases, identity details, `#delete`) and terms in site
  PR #22. Smoke `assertTruthfulCopy` fails on the previous tree; copy deck
  C-76–C-80. Then 33 (2026-10-15): the owner reported the Data safety form
  has always answered *No*; checked against Play's definitions it holds
  except for the install ID purchases sent Google Play, which the owner
  chose to remove (DECISIONS DS-1). 8.36.0 sends none (`tests/entitlement.js`
  17m, failing on the previous tree); site PR #23 drops the policy sentence
  once 8.36.0 is on the track. Then 75 built (2026-10-15): Google sign-in on
  `AuthorizationClient` (play-services-auth 22.0.0), drive.appdata only,
  e-mail from Drive for cloud backup (DECISIONS AUTH-2); it shipped in
  8.36.0 by the owner's choice.
- **8.36.0 on Play and the first owner check (2026-10-15).** The owner
  uploaded 8.36.0 to internal and closed testing and ran G2 on it from Play
  (owner-reported): D1, D2, D4, D11, D13, §6 and D24 (a)–(c) pass — D13
  closes BACKLOG 12, and D24 (b) shows no stored account is needed. Three
  failures, all fixed the same day for 8.36.1: D16 (onboarding prompts
  painted under the overlay — toast z-index), D20 (every export read *Backup
  not saved*: Share reports a Drive/Files save as cancelled — the app now
  asks, owner's choice DECISIONS EXP-1) and the step-7 Tax balances chips
  (the UI-FS-1 tile rule's font-size). The sweep also fixed two `[hidden]`
  elements that still displayed and removed a first-run toast no one had
  seen; it found 18 error toasts styled as info (BACKLOG 76, open). Each
  fix has a smoke check that fails on `main` @ `d7d6f57`. Re-run on 8.36.1:
  D16 and D20 (BACKLOG 66).
- **Open.** `C-H2` closed testing (gate first: BACKLOG 66, 69), then
  `C-H3`, `H-H1`, `R-E4`, `MZ-4` (BACKLOG, Launch).
- **Live doc kept.** `docs/programmes/play-store-launch/03-STORE-COPY.md`
  (listing copy and Data safety answers — needed again before cloud backup
  is switched on).

### P11 · Tax-calc standardisation (07-10 → 07-11)

- **Shipped.** Income hub and sub-page exemplars (#115–#119); SARS Account
  and balances page (#120, #121); s18A carry-forward T-10 (#122); real s10C
  annuity exemption T-3 (#123); crypto trading double-count T-1 (#124);
  home-office rent T-4 (#125); wear-and-tear pro-rating T-5 (#126); PAYE
  prefill, provisional netting, foreign catch-all T-6b/T-9/T-7 (#127);
  local/foreign interest card T-2 (#128); foreign-pension FTC (#129); one
  non-deducted-contributions balance T-C2 (#130); carried-balances
  onboarding (#132, #133); FAQ panel and CHANGELOG (#137, #138).

### P12 · Citation audit P-H2 and tax-year close-out P-H1 (07-13)

- **Shipped.** Close-out year snapshot and carry-forward (#139, #140);
  verification of 42 trace, 70 tooltip and 160 dynamic citations (#141–#143);
  seven defects fixed (#144).
- **Source docs.** `docs/programmes/citation-audit/`.

### P13 · Release runbook and repo readiness (07-18)

- **Shipped.** `RELEASE.md` and `npm run release:bump` (#155); tax-display
  fixes FIX-002–006 (#156); docs truth pass (#157); version-sync and artifact
  verification (#158); mockup clean-up (#159); release-build troubleshooting
  (#160).

### P14 · Device QA and Google sign-in, MZ-2 (07-18 → 08-01)

- **Shipped.** PIN auto-lock (#161); onboarding account bleed and sign-in
  nagging (#162); tax-return countdown year (#163); TrialAnchor diagnostics
  and the activity-result bridge fix (#168, #170, #195); concurrent sign-in
  guard (#197); request e-mail scope (#198); troubleshooting compendium
  (#192).
- **Superseded by.** QA remediation QR1 (P27), which rebuilt the
  silent/interactive sign-in contract.

### P15 · UI/UX remediation batches (07-24 → 07-25)

- **Shipped.** Copy, render triggers, CGT, Tools CRUD, travel (#176); profile
  field removal (#177); SARS Account accordion (#178); income-hero losses
  (#179); retirement bucket fix (#180); hamburger menu (#181, #182); engine
  items A5 (manual) and A8 (#183).

### P16 · Simplification and personality (07-26 → 08-24)

- **Shipped.** Spec (#184); B0 foundations (#185, #186); B1 navigation (#187,
  #188); B2 income main (#189); B3 deductions (#190); B4 dashboard (#191);
  B5/B6 field census and copy pass (#193); B7 motion and mascot (#194);
  owner-feedback follow-up rounds and batch 3 (#200–#206); B7+ close-out
  (#228–#235, #239).
- **Gap found later.** Page transitions asked for in August were dropped
  without a record (RET-08); built in QR11.
- **Source docs.** `docs/programmes/simplification/` (incl.
  `second-batch-of-issues/`).

### P17 · Visual refresh → design system (07-31 → 08-13)

- **Shipped.** Design critique and five prototypes (#207); three refined
  directions and the UX writing style guide (#210); the approved design system
  applied to every screen (#211, #214).
- **Live doc kept.** `docs/product/UX-WRITING-STYLE-GUIDE.md`.

### P18 · CI and release automation (08-13 → 09-14)

- **Shipped.** `Build InspiredTax` dispatch workflow — bump, test, sign,
  build APK/AAB, open a draft release PR (#212); hardening (#216, #217);
  fingerprint normalisation and AAB verification (#223, #224); version-gate
  repair after a docs edit broke it (#311); PR-level `CI` workflow (#312);
  release PRs skip CI (#314).
- **Lasting effect.** `STATUS.md`'s **Version** line is a release input,
  parsed by `tools/status-version.js` — see `CLAUDE.md`.

### P19 · Tax coverage and gap analysis (08-14 → 08-28)

- **Shipped.** Analysis Parts A–D (#218); Stage 0/1 fixes — foreign rental
  net into s6quat, rental NaN, s10(1)(u) maintenance, residency gate C-1a,
  rental improvements, s10C code default, multi-employer note, s18A
  certificate, primary-residence copy (#219, #220, #222); Stage 2/3 — B-9,
  B-10, B-12, C-11, C-13 (#242), company car B-2 and PSP disclosure C-10
  (#246), currency conversion C-3 and subsistence allowances (#247),
  ownership share C-2a (#248), 11 golden scenarios plus the coverage gate
  (#249); close (#250).
- **Partial.** B-9 (provisional "below threshold" exclusion not built), C-13
  (vested rights not built), C-3 (Eighth Schedule para 43 not built).
- **Open residue.** 8 owner-deferred items and 12 declined items — recorded in
  `BACKLOG.md` (Deferred) and `docs/DECISIONS.md` (Declined).
- **Source docs.** `docs/programmes/coverage-gap-analysis/` (07-FINAL-STATUS is
  the closing record).

### P20 · QA 2026-08 rounds (08-26 → 09-09)

- **Shipped.** QA collation and prototypes rev 1–3 (#236, #240, #251); QA
  batch 2 copy and defects (#252–#255); batch 1 audit, balances data shape,
  pills follow toggles (#256–#259); further QA rounds (#260–#262, #287, #288,
  #290–#293, #297).
- **Reconciled by.** QA remediation 2026-09's retrospective (RET-01…RET-20),
  which re-checked every earlier programme's completion claims against the
  code on 2026-09-25.
- **Source docs.** `docs/product/QA-2026-08-*.md`, `_mockups/12-*`.

### P21 · Design handoff 2026-08-30 (08-30 → 10-02)

- **Shipped.** Light-mode surfaces (#264); icon unification and removal of
  Font Awesome (#265, #266, #272); tiered confirms and toasts (#267); PIN lock
  screen (#268); data-safety surfaces (#269); eight subscription states
  (#270); motion and drawer identity (#271); celebration, history, entry
  sheets, first-run hero, paywall hero, screen-standards convergence
  (#273–#284); lip tiles (#289); first-run CTA sheen (#381).
- **Closed by the owner 2026-10-02 without building:** skeleton loaders (the
  app renders synchronously) and the §A list-rows pattern (an app-wide restyle
  not wanted).
- **Source docs.** `docs/design-handoff-2026-08-30/`,
  `docs/design-handoff-qa-2026-08/`, `docs/product/DESIGN-HANDOVER.md`.

### P22 · App Atlas and decision studio (08-21 → 09-10)

- **Shipped.** Decision studio stage 1–2 (#227, #237, #238); the generated,
  verified App Atlas replacing v8.8-era reference files (#302, #303).
- **Live.** `docs/reference/app-atlas.*`, `docs/reference/decision-model.json`,
  `tools/decision-studio/`.
- **Finding (2026-10-04).** `npm run check:atlas` reports drift: the
  committed atlas was generated for 8.35.0 and the 8.35.1 bump did not
  regenerate it. Not gated (not in `pretest`). BACKLOG item 15.

### P23 · Design-system audit 2026-09 (09-09 → 09-14)

- **Shipped.** Audit and owner interview — 52 decisions (#295, #296,
  #300, #304); Batch 0 bugs and Batch 1 root causes (#298); Batches 0b–6 —
  icons, geometry, IA, backup honesty, entitlement (#305–#309); Taxation tabs
  OD-18 (#309).
- **Durable output.** The standards register (principles, standards,
  guidelines) — now `docs/product/DESIGN-SYSTEM.md`.
- **Open residue.** RISK-2 field list, render-path inventory, GLOB-2
  keep/convert review, full ITR12 code audit, s11F(2) external review
  (BACKLOG).
- **Source docs.** `docs/product/DESIGN-SYSTEM-AUDIT-2026-09.md`,
  `docs/product/OWNER-DECISIONS-2026-09.md`.

### P24 · Login and onboarding UX (09-14)

- **Shipped.** Brand mark R-only (#316); login order, copy, contrast (#317);
  date-of-birth Year/Month selector (#318); onboarding chrome, taxonomy and
  tax-year default (#319); steps 3–6 (#320); step 7 summary (#321).
- **Source docs.** `docs/programmes/login-onboarding-ux-2026-09/PLAN.md`.

### P25 · UI/UX polish pass 2026-09 (09-16 → 09-19)

- **Shipped.** Pre-pass UI batch (#330, #331); planning and decisions D-1…D-31
  (#332, #333); B0–B10 built in one PR, released as 8.34.0 (#334); open-items
  audit (#335).
- **Deliberately not built.** `BAL-2` — the six Tax-balances rows stay static
  DOM; migrating them to `renderSelectorList()` risks the single-character
  entry bug `d78477a` fixed, with no gate to catch it.
- **Open residue.** D-1 device re-check of shipped items (owner,
  `docs/android/DEVICE-CHECKS.md` B2).
- **Source docs.** `docs/programmes/ui-ux-polish-2026-09/`.

### P26 · Calculation audit 2026-09 (09-19 → 09-20)

- **Scope.** "The engine is sound; the display layer is where the defects
  are" (audit headline).
- **Shipped.** S1 calculation layer (rounding, exempt local dividends, `gi`/
  `tei`, lump-sum display, 2026/2027 rate tables, deduction base, in-file
  debug harness); S2 displayed amounts (dashboard and income cards rebuilt on
  engine breakdowns, refund/owing bar, withholding sweep); S3 layout and copy;
  S4 visual design, donut colour gate, APK glyph fix (#337).
- **Open residue (per its closing report, re-checked 2026-10-04).**
  - C2 sign-in re-prompt → fixed in code by QR1; device check owed.
  - E16 glyph size → replaced by QD-26 (8.35.0); device check owed.
  - **E12 chart palette** — only 5 of the 11 category hues are mutually
    distinguishable; slices share hues in declared families. A chart-specific
    palette is an open design decision. BACKLOG item 14 (was untracked).
  - C12 and D2 — never located in any document; the original brief is not in
    the repo.
  - E10 — onboarding info dot is cyan on steps 1/3, amber elsewhere, as briefed.
- **Kept.** `docs/programmes/calc-audit-2026-09/run-audit-fixtures.js` (loaded
  by `tests/run-debug-harness.js`).
- **Source docs.** `docs/programmes/calc-audit-2026-09/01–07`,
  `docs/InspiredTax_test_fixtures.md`.

### P27 · QA remediation 2026-09 (09-25 → 10-02)

- **Scope.** Owner QA brief of 2026-09-25 (76 finding IDs) plus a
  retrospective of every earlier programme against the code.
- **Shipped.** QR0 gates and inventories; QR1 sign-in policy, purchase and
  import landings (#342–#349); QR2 navigation and form conventions (#341,
  #344, #346, #357); QR3 investment income (TC-010, TC-011); QR4 option notes,
  income ↔ deduction table, plausibility notes (#359, #360); QR5
  investigations; QR6a/b capture and motion prototypes (#361); QR7 onboarding
  scenario questions (#367); QR8 code picker (#369); QR9a IT3(b) by code and
  Tax-free investments with s12T(7) (#371); QR9b one Add per area, tools list,
  QD-30/32 (#373, #374, #376); QR10a/b cloud backup behind a kill-switch
  (#362, #363, #365); QR11 mascot reactions and transitions (#377, #378);
  QR12 close-out (#379). Post-brief: Q-NEW-1 deductions count, Q-NEW-2 Easy
  View (#352, #353).
- **Verification.** Every finding has a closure row with commit and check
  (tracker, retired). Native, WebView, Play, Drive and frame-rate behaviour is
  **implemented, not verified** until the owner's device checks pass.
- **Working rules WR-1…WR-10** now live in `CLAUDE.md` (Working rules).
- **Open residue.** Device checks A1–A5 and eyeballs (DEVICE-CHECKS.md);
  copy-deck review (C-11–C-23, C-30–C-41, C-28a/b); 19 decisions built on
  recommendation and never answered (QD-01, 03–10, 13–20, 24, 25 —
  `docs/DECISIONS.md`); cloud-backup switch-on checklist; mascot gaps;
  GLOB-2 residual; RISK-2; render-path inventory; ITR12 code audit; shots
  baseline refresh (BACKLOG).
- **Kept.** `docs/programmes/qa-remediation-2026-09/07-COPY-DECK.md` (owner
  review pending). Generated evidence moved to `docs/reference/`.
- **Source docs.** `docs/programmes/qa-remediation-2026-09/` (00–08, 99,
  evidence).

### P28 · Post-close-out batch (10-01 → 10-03)

- **Shipped.** Dataviz batch — year comparison, medical breakdown, cap
  meters, balance waterfall, donut interaction (#368, #370); HERO-2 ring per
  Dashboard card (#372); C-10 FAQ/Terms no longer claim the app never goes
  online (#380); first-run CTA sheen (#381); IT3(b) codes to SARS G05 —
  s8E/8EA on 4292, new 4238 REIT line (#382); GLOB-2 statutory figures from
  data, RENT-12 (#383); QD-26 glyph-only fix, released as **8.35.0**, tag
  `v8.35.0` (#384); INC-20 Exempt income card lists every exemption, font
  gate keyed by selector, C-10c (#385); STD-BEHAV-4/5 selector sections and
  add buttons (#386); **8.35.1** (#387).
- **Pending.** Draft PR #388 — bot release prep for 8.35.2, no code change;
  its release note is the line `- bump` (owner's, left as is).

### P29 · Docs audit 2026-10 (10-04)

- **Scope.** Every core document re-verified against git history, PRs and
  `src/`; stale, superseded and duplicate documents removed; this record,
  `docs/DECISIONS.md`, `docs/DOCS-INDEX.md`, `docs/product/DESIGN-SYSTEM.md`
  and `docs/android/DEVICE-CHECKS.md` created.
- **Findings recorded elsewhere.** Atlas drift, stale bench, E12 untracked,
  coverage-gap deferrals untracked, hard rule 9's glyph exception undocumented
  — see BACKLOG items 14–16 and `CLAUDE.md`.

### P30 · Owner interview and clearance (10-05)

- **Scope.** One interview cleared every item waiting on the owner: 19
  recommendation decisions ratified (QD-19 and QD-24 amended), the copy deck
  approved (four rows edited), launch-offer ribbon corrected to 100, donut
  palette declined (E12), v1 launches without cloud backup (LAUNCH-1), shots
  baseline refreshed, promoted on-blur validation and B-8 copy.
- **Found.** The published privacy policy still claimed zero network requests
  (PR #18 on the site repo). Opens: s11F(2) review decision, tester
  recruitment, device checks (planned for the closed-testing build).
- **Gates.** See `STATUS.md`.

### P31 · Font-scale and capture remediation (10-05 →)

- **Source.** The owner's screenshots at Android font size *very large* and
  display size *large* (2026-10-05), and the capture-flow prototype
  (`_mockups/capture-flows.html`, retired 10-07 — `git show 903a995:<path>`; options A–D; owner chose B and all six
  shared rules — DECISIONS UI-CAP-0).
- **Shipped.** #390: UI-FS-1 (layout at large text sizes, smoke text-zoom
  passes), UI-PILL-1 (section pills), UI-CAP-0a/0b (joint ownership and
  minor child's account answered in onboarding / Profile, one-line answer
  rows). #392: UI-NOTE-1 (every note one line + More). #393: UI-CARD-1 prototype `_mockups/tax-cards.html`. #395: **UI-CARD-1** built as option B — the Return, Provisional and Prior-years cards open to full width with a chart and the lines behind the figure; Tax balances rows gain the lip and movement bars; one card builder shared with the Dashboard; prototype deleted. #394: **UI-CAP-1** — every multi-kind capture sheet (rental,
  business, CGT, other receipts, lump sum, tools, IT3(b), retirement,
  crypto) opens on its kind chooser and is titled for the kind; rental,
  business and IT3(b) 3 → 2 steps (IT3(b) 1 for one half), pension, lump
  sum and other receipts one screen; one-line step header; usual cost lines
  and *Add a cost* chips. Capture prototype deleted.
- **Gates (2026-10-07).** `npm run test:engine` exit 0 (golden unchanged);
  `node tests/smoke.js` exit 0 incl. the rewritten `assertCaptureKinds` and
  the chooser screens in the modal text-zoom sweep.
- **Gates (#395, 2026-10-07).** `npm run test:engine` exit 0; smoke exit 0
  incl. the new `assertTaxCards` (7 failures on the previous build);
  `node tests/run-debug-harness.js` exit 0.
- **Open.** Device check D13 (BACKLOG 12); cards app-wide (28); lump-sum
  card at R 0 (43); UI-CAP-1 leftovers and confirmations (38, 44, 45); copy
  review (46).

### P32 · On-blur field validation — FV-1 (10-07)

- **Source.** Promoted in the owner interview (P30, ex-BACKLOG 36); owner
  answers 2026-10-07: every capture form; required, format, impossible and
  plausibility checks; inline under the field, no toast; checked on leaving a
  touched field, untouched empties only on Next/Save; Next blocks; warnings
  never block; built without a prototype (owner's choice).
- **Shipped.** #396: one validator in `02-core.js` (`fieldProblem`,
  `checkScope`, `flagField`), field rules as data (`FIELD_CHECKS`), the
  QD-19 `blocksSave` path moved onto it, `makeCrudModule` `validate()` →
  `{el, msg}`, donations and the planner's *Add* on the same pattern.
- **Gates (2026-10-07).** `npm run test:engine` exit 0; smoke exit 0 incl.
  `assertFieldValidation` (8 failures on the pre-change build).
- **Open.** Copy review C-65 (46); date-range rules (42); device check D19
  (18). Onboarding keeps its own toast-plus-inline pattern (out of scope).


### P33 · Post-merge integrity audit of sessions A/B/C (10-07)

- **Scope.** Three sessions worked concurrently 10-05 → 10-07 (A: #391,
  #396; B: #390, #392, #393, #395; C: #394) with manual conflict resolutions.
  Git history was the source of truth; the handoffs were claims to check.
- **Method.** Each PR's tree on `main` compared with its PR head (all
  identical); every added `src/`/`tests/` line from the 11 session commits
  checked against HEAD (none lost — the remainder were later deliberate
  replacements); the five in-branch merges (`79ff070`, `2574b3f`, `82f6581`,
  `d70e930`, `3a2ef1f`) read with `--remerge-diff`; an import/export scan;
  a browser probe of FV-1 against every chooser kind (36, all errors on
  reachable fields).
- **Found and fixed.** F6 stale `validate()` contract comment; F7 two
  orphaned imports; F9 four crypto-disposal assertions dropped in the
  UI-CAP-1 rewrite (restored with positive controls); F10 the FV-1 tools
  test drove a hidden select (now the real edit route); F8 two onboarding
  validators for one rule (merged; the toast names the open question); F12
  a non-workflow `main.yml` failing every push (deleted); F4 device checks
  D16–D19 had no table or result rows, D13 omitted notes and cards; F5
  PROGRAMMES/ARCHITECTURE gaps; F3 14 open items tracked only in handoffs
  (BACKLOG consolidated and reformatted, DECISIONS AUD-5); F13 handoffs
  retired; F2 STATUS stale.
- **Owner ruling (10-07).** The copy deck's duplicate C-65: FV-1 keeps
  C-65, the UI-CARD-1 card copy is C-66; rows put in order.
- **Hand-over.** `NEXT-SESSION-PROMPT.md` (root, written after #400 merged):
  four standalone prompts (branch audit, owner interview, owner
  walkthrough, backlog work) for separate sessions; the last to finish
  deletes the file.
- **Left open.** Atlas drift (15); every other item in `BACKLOG.md`.
- **Gates.** On `db28d6e` and on the audit branch (code `6038728`): build,
  pretest, `test:release`, smoke, debug harness, `check:version`,
  `test:artifact` all exit 0; `check:atlas` and `check:bench` fail as before
  (BACKLOG 15). See `STATUS.md`.

---

## 3. Lessons that became rules

| Lesson (where it was learned) | Rule now |
|---|---|
| Docs claimed work done that the code did not contain (QA remediation retrospective, RET-*) | Status words and evidence per item; `CLAUDE.md` working rules WR-1…WR-10 |
| A docs-only edit broke the release pipeline (`4bb88f6`, P18) | CI runs on every PR, docs included; STATUS's **Version** line is machine-read |
| Piping a gate through `tail` reported `tail`'s exit code (P26) | Run gates unpiped; read the exit status |
| `test:release` does not run `tests/smoke.js` (P26) | Smoke is a separate required step for UI changes and releases |
| A live audit went stale while it was being written (#335) | Re-verify against `origin/main` immediately before publishing |
| Analysis docs read as open long after their items shipped (P19, P23) | Closed programmes are summarised here and their working docs retired |

### P34 · Branch audit — unmerged work classified and cleared (10-07)

- **Scope.** Owner request (BACKLOG 48): no branch left holding changes that
  were never implemented on `main` and never deliberately set aside. Five
  remote branches besides `main`. The session clone was shallow, so history
  was fetched in full first — ahead/behind counts from a shallow clone are
  wrong.
- **Method.** Patch-ID equivalence (`git cherry`) per branch, then each
  "not equivalent" commit checked against `main` by content, because squash
  merges and rewrites change hashes. PR metadata was unusable: #111–#114
  report `merged:false` beside a `merged_at` timestamp, so classification
  rests on content, not on the PR record.
- **Classifications.** 16 non-merge commits ahead in total.
  - `claude/github-repo-restructure-qb2cy8` (13 ahead, 9 content): all 9
    **already on main** — exact patch-ID twins `7d74de6→1ad517f`,
    `a7331c7→7848528`, `3321aee→282a5b7`, `ed4800c→0023b3b`,
    `3fe21fe→e9ffd9d`, `a9b98f4→4be7baf`, `c81e777→a4ceb7c`,
    `5c410af→6631d12`, `54f7ee5→feac8c3`.
  - `claude/modal-tip-copy-p3` (1): **already on main** — patch-ID
    `19235cb6…` is `8ed0502`, byte-identical.
  - `claude/inspiredtax-disclaimer-terms-1xgxtf` (1): **obsolete** — edits
    `COMPLETED.md` (since deleted) and `BACKLOG.md` rows C-E4/C-E5 (since
    retired), and asserts the GitHub Pages URL that `03-STORE-COPY.md`
    §1 marks stale in favour of the custom domain (C-E7). The Terms and
    About modals it tracked are live on `main`.
  - `claude/it12-test-personas-kgf4qk` (5): 4 **superseded**, 1 **still
    wanted**. The 9-persona golden wiring and `docs/TEST_PERSONAS.md` never
    reached `main`, which covers the same intent through
    `tests/legislative/` (20 fixtures), `tests/differential.js` (14 checks),
    `bench/personas/` and `check-golden-coverage.js`. Of the four findings in
    its `INDEPENDENT_SARS_CROSSCHECK.md`, Finding 2 (s6quat proportional
    limitation) is fixed on `main` at `02-core.js:2031` by engine-remediation
    W9, Finding 3 (s18A donation cap post-s20) at `02-core.js:1974` by W8,
    and Finding 4 needed no action. **Finding 1 was still live.**
- **Brought in.** `calcTaxOnIncome` subtracted `brackets[i].min` where the
  SARS formula method taxes income above the bracket *threshold*, and the
  data convention stores `min` as threshold+1 — an understatement of
  `rate × R1` per bracket. Re-applied fresh from `main` rather than merging
  the four-month-old branch (which carried the `v8_22` artifact and stale
  screenshot baselines). 64 of 76 bracket tops across the 13 year tables
  disagreed with their own table's published `base`; none does now. The
  branch's own commit called it sub-rand and cosmetic, which was true while
  `fmt()` showed cents; `fmt()` now renders whole rand, and the error crossed
  a rounding boundary often enough that the **displayed** figure was R1 below
  the SARS table for 38.4% of 2025/26 taxable incomes above the first bracket.
- **Found while gating it.** `HIST_TAX['2019']` and `['2020']` carried a
  top-bracket base of 532042 against a published 532041 (Budget Tax Guide
  2019 p.1; SARS Archive Tax Rates). The same wrong figure sat in
  `reference-constants.2020.json` marked `_verified`, which is why
  `check-constants` could not see it — the reference and the data agreed with
  each other and not with SARS. Both corrected and cited; the historical
  calculator overstated tax by R1 above R1.5m for those two years.
- **Gate added (WR-2).** `tests/invariants.js` now asserts
  `Math.round(calcTaxOnIncome(brackets[i].max)) === brackets[i+1].base` for
  all 76 bracket tops in all 13 year tables — exact, since SARS rounds each
  published base to the whole rand. The pre-existing continuity check could
  not see either defect: its tolerance is R2, wider than the largest possible
  `rate × R1` error. Reverting either fix makes it exit 1.
- **Done** Owner deleted the four branches and tag two
- **Owner rulings (10-07).** All four branches approved for deletion; archive
  tags for the two holding abandoned work only; the engine fix taken with a
  gate; version left at 8.35.2 for the next release cut (DECISIONS BR-1–BR-3).

### P35 · Owner interview — decisions, confirmations and the parked list (10-08)

Hand-over prompt 2. **Method fault, recorded:** the round was put as one
message of six topics instead of rounds of 2–4 with an answer recorded
between them, and it did not open on the status questions. The owner raised
it; `OI-P1` is the rule that replaces the practice. The verification the
prompt required was done — every fact stated to the owner was checked against
the code or a primary source first — but the method was not followed.

**Answered and recorded** (`docs/DECISIONS.md` `OI-*`): the status questions
(`STATUS.md`, owner-reported 10-08); B1 the two reference checks (blocking in
CI); B3 the lump-sum card (opens whenever lump sums exist); B4 the Dashboard
cards (full width, all four charts, prototype first); B6 cost-list
consistency (crypto yes, the three selects no); B7 the four not-gated checks
(all four, two of them re-scoped); B8 the screenshot baselines (cloud, after
the harness is fixed); C1a–c the three confirmations; the foreign-currency
ruling, which the owner specified in full (`OI-FX-1`, `OI-FX-2`); and all 17
rows of the parked list (`OI-D1`, `OI-D1a`–`OI-D1d`).

**Four findings the preparation and the owner's own questions produced**, none
of them on the agenda:

1. **The s11F(2) premise was false.** `ARCHITECTURE.md` said the engine applies
   "two of three limbs". It applies all three — `Math.min(retPctTest,
   retCapTest, retTIcap)` — with the taxable capital gain included in limb
   (b)(ii) and excluded from limb (c), exactly as the Act reads. No taxpayer's
   result was wrong. The real gap was the gate: **no legislative fixture
   covered the cap at all** (item 55).
2. **The foreign-currency behaviour was blocking a conversion the law allows.**
   s25D(1) makes spot the default and needs no published table; s25D(3) makes
   the average an election; s1(1) defines the average as a computation, not a
   SARS publication; SARS says its tables are "not compulsory". The recorded
   rationale for refusing a typed rate — that it would be a second conversion
   path — was also wrong: `fxApply()` writes only the rand figure.
3. **Other taxable receipts cannot carry costs** (item 63) — the engine taxes
   the gross, and a capital receipt's base cost has no income-side equivalent.
4. **The screenshot harness never photographs the new chooser screens**
   (item 47) — `openModal()` sets no kind stage, so the chooser is hidden and
   only the form is captured; and the list covers 8 of 16 capture sheets. The
   agenda had assumed a re-capture was a one-command refresh.

Two smaller ones from the owner's questions: the tools cost echo says "/yr"
on a one-off write-off (item 50), and a crypto disposal switched from trading
to investment keeps costs the user can no longer see (item 53).

**Left open, by design:** the date rules per capture form (42 — the engine
evidence is now in, the rule is the owner's), whether the s11F(2) external
review still happens (35), expenses on other receipts (63), the drawer metric
(64) and the balance reason (65). Each states exactly what is being asked.

**Backlog:** 16 new items (50–65); item 45 closed; the Deferred table reduced
from 17 rows to 4; the index re-ordered. **Not done in this round:** the copy
review (46), which the walkthrough handles.

**Second round (10-09).** Eight questions back, three of them reversing what
the first round had recorded — which is the method working: the first round
promoted items on the owner's one-line answers, the second put the
consequences to them and three were withdrawn.

- **Pre-2001 valuation-date base cost is retired indefinitely** (`OI-D2`) —
  not deferred, not parked, off the roadmap and not to be re-raised. The CGT
  dates it needed stay declined. Connected-person disposals rode in the same
  parked row and were never separately ruled on, so they return to parked
  (`OI-D2a`) rather than following it out.
- **Vested rights left out** (`OI-D3`) and **the SARS-statement catch-all
  balance dropped** (`OI-D4`), both reversing the previous day's promotion.
- **No outside s11F(2) review** (`OI-S11F-3`); decision 6.1 closed. Assurance
  is the legislative fixtures in item 55 instead — which is the gap the
  verification actually found.
- Date checks, the drawer metric and the balance reason all settled as
  recommended (`OI-B5`, `OI-D1e`, `OI-D1f`).
- Expenses on other receipts: royalties and "something else" only; **farming
  removed** from the categories rather than kept with a caveat (`OI-C1f`).

**One scope limit held back deliberately.** "Remove farming entirely" was
answered inside a question about other-receipts expenses, but farming is also
an onboarding income subtype, a member of `provTriggers` and part of the
self-employment test that activates deduction tiles. Removing it there would
stop flagging a farmer as a provisional taxpayer — a tax-behaviour change, not
a UI one. The other-receipts category is retired through the existing
retired-option gate (saved records intact); the other three are untouched
until the owner rules on them. Recorded rather than executed, which is what
`OI-P1` and the hard rule on state both require.

**Programme outcome.** The interview is closed. 40 backlog items, none in the
`decision` state; 2 dropped, 1 retired; the Deferred table holds 5 rows. The
build order is the index.

### P36 · Owner interview — decisions and the copy review (10-15)

Asked in five rounds of two to four questions, status first (`OI-P1`), each
answer recorded before the next round. Two answers were put back once with
their consequence spelled out; the owner kept one and reversed the other.

- **Status:** 8.36.1 not built yet (BACKLOG 66).
- **Decisions** (`docs/DECISIONS.md`): *Report a problem* built for the
  day-7 update, share sheet (RP-1, BACKLOG 67 → ready); Play upload
  automation after launch (`O-CI1`, 68 → Deferred); 69's additions 1–6
  declined, confirmed when asked again (CT-5); farming removed everywhere,
  silently — kept after the provisional-flag consequence was put (`OI-C1h`,
  63); foreign currency one rate per currency, editable every year — the
  lock was reversed after the s25D(1) point — and all three stages now
  (`OI-FX-3`, 54 → ready).
- **Copy review closed** (COPY-4, BACKLOG 46): C-44–C-83, the C-58 short
  lines, `USUAL_COSTS` and the 8.36.1 *What's new*. Eight edits applied in
  code. The WR-1 sweep for the typed *40 %* in C-49 found nine strings and
  one wrong figure: the crypto summary's *R40,000 annual exclusion* (2026/27
  is R50,000). All nine converted; BACKLOG 25 carries the rest.
- **Backlog:** no item in the `decision` state; 46, 68 and 69 closed; the
  blocks of 35, 41, 45, 51 and 53 (closed 10-08/09, recorded in P35) removed;
  the index de-duplicated (38 rides with 63).

### P37 · Backlog run in index order (10-15)

Owner instruction: "start on the backlog items in index order", after P36.
One commit per item on branch `ccr-d41f7abf-mlh5bm`, each with its WR-1 sweep
and a check shown failing first (WR-2).

- **Closed:** 15 (atlas and bench regenerate with the tooling; `check:atlas`
  and `test:bench` block in CI), 49 (store-copy references), 76 (error toasts
  styled by their icon), 40 (test-only — real-UI check added), 26 (dead PAYE
  path), 13 (mascot reactions), 16 and 57 (ring-fencing as notices only).
- **Built, owner step left:** 67 (*Report a problem* — copy C-84, device
  check D25).
- **Defects found on the way, each fixed and gated:** the verification bench
  passed 0/8 personas (wrong path, an undefined build constant, and five
  missing imports the window bridge had hidden — `cgtAggregate` in
  `calcFullTax` among them); the risk assessment and optimisation tips
  counted PAYE as R0 in the para 20 provisional-penalty test and could warn
  of a penalty the PAYE already covers; a business with costs and no income
  could not be saved at all; a ring-fenced loss in older data was dropped on
  load; the crypto summary quoted a R40,000 annual exclusion (R50,000 for
  2026/27).
- **New item:** 77 (`verify:atlas` step-2 probe fails on `main`).
- **Copy for owner review:** C-84–C-87.

### P38 · Backlog run 2 — DATA-1, 77, 78, 23, 24 (10-15)

Owner instruction: C-84–C-86 approved, C-87 withdrawn (no earlier-version
data is carried — DATA-1); "pick up backlog @ 77, item 23 & rest follow in
index order". PR #425 (DATA-1 + 77) merged; 78, 23 and 24 follow in the next
PR on the same branch.

- **Closed:** 77 (`verify:atlas` probe answers the step-2 questions; CI
  step), 78 (legacy-data migrations removed; schema-1 imports refused), 23
  (render-path inventory), 24 (ITR12 code audit —
  `docs/reference/itr12-code-audit.md`).
- **Defects found by 24, each fixed and gated:** the Other claims sheet
  deducted any IRP5 deductions-block code in full — PAYE (4102) came off
  taxable income, retirement/donations bypassed their caps, medical aid
  became a deduction (smoke `deduction-code-routes`); a foreign-service
  bonus or commission alone never opened the s10(1)(o)(ii) question (five
  disagreeing code lists unified, smoke `foreign-service-codes`).
- **New items:** 79 (owner: component categories), 80 (long-service award
  exclusion), 81 (IRP5 codes with no capture path), 82 (foreign-service
  allowance/fringe variants).
- **Copy for owner review:** C-89–C-92 (renumbered on merging #426, which took C-88 and BACKLOG 78 for *Share InspiredTax* — now BACKLOG 83).

### P39 · Backlog run 3 — ID guard (ID-1), 80 (10-15)

Owner instruction: build a guard against two sessions handing out the same
"next free ID", then continue the backlog.

- **ID-1:** `npm run next:id` reads every pushed branch before naming the
  next BACKLOG / copy / device-check / programme number; `check:ids` (pretest,
  CI) fails on a duplicate. Fails on `main` @ `82e6fc2` (the #426/#427
  collision). PR #428.
- **Closed:** 80 — the long service cash award (3622) exclusion
  (`TAX_YEARS[y].longServiceAward.exclusion`, s1 "gross income" par (c)
  proviso (vii), Act 20 of 2021 s4(1)(d), checked against the gazetted Act);
  out of the taxable and s11F remuneration bases; fixture TC-022.
- **25 (2026-10-16):** keep/convert proposal for the remaining typed
  percentages (`docs/reference/glob2-residual-proposal.md`), with the owner.
  Five of them were wrong figures and are fixed: the RA top-up analyser and
  RA-room tip ran their own s11F cap on IRP5 gross (a negative saving with a
  lump sum in the year); the donations tip and risk check used income after
  donations; the medical tip typed a stale amount. Smoke `ra-analyser`.
- **22, 37 (2026-10-17):** drafts for the owner. RISK-2 field list —
  12 third-party pre-filled fields from the ITR12 guide rev 40, mapped to app
  fields (`docs/reference/risk2-field-list.md`). B-8 — IN28 (Issue 3)
  Example 9 forbids time-apportioning yearly home-office costs, which
  `calcHomeOffice()` does; options and copy in
  `docs/reference/b8-home-office-period-draft.md`.
- **43 (2026-10-17):** the Lump-sum tax card opens whenever lump sums exist (OI-B3), with the opening pool, s10C carry-forward and the retirement tax-free amount left (new engine output `retirementTaxFreeRemaining`). Smoke `tax-cards` R 0 case.
- **50 (2026-10-17):** closed as already shipped — `493f843` (OI-C1e) made a one-year write-off read *saves ~R… this year*, with the smoke assertion and copy C-67; the backlog entry was stale.
- **42 (2026-10-17):** date checks (OI-B5). Lump-sum date blocks outside the tax year; tools *brought into use* blocks only after it (a before-year date is a continuing write-off — BACKLOG 89 asks the owner to confirm); two-pot date warns. Smoke `date-checks`. WR-1 sweep of every `type="date"` input (5): `or-date` is not read by the engine; `tv_date_acq` has the same fault plus a typed 28 February — BACKLOG 90.
- **90 (2026-10-17):** travel *date brought into use*: one month count (`monthsInTaxYearFrom`) for the deemed fixed cost and vehicle W&T; a date after the year blocks. Fixed a real defect on the way: a car first used on the year's last day got R 0 W&T in South African time (UTC parse). WR-1: `new Date(<date field>)` in src/ — 3 hits; two fixed here, `calcToolItemWt` counts calendar months so the hour offset cannot move it. Found BACKLOG 91 (vehicle W&T not apportioned in the period's last year). Smoke `date-checks` → `car date`.
- **88, 91 (2026-10-17):** the s11F percentage was multiplied by 100 in the over-the-limit warning (never fired) and the cap-meter tip (*2750.0%*); a third use was dead code, deleted. The RA-room tip priced the room at one marginal rate; it now shares the analyser's engine difference (`taxWithMoreRetirement`). Vehicle W&T now apportions the write-off period's last year, through one window rule shared with tools (`writeOffMonthsInTaxYear`; tools unchanged, proven date for date). WR-1: `pct * 100` over src/ — 3 hits, all fixed; other `* 100` hits are fractions (business km, deduction ratio). Single-rate pricing: the two tools cost echoes (`~R…` per item) left — a single small item stays in one bracket. Smoke `ra-room` (new `--only` key) and `date-checks`, each failing on the build before.
- **44 (2026-10-17):** rule 6 for both crypto cost lists (OI-B6a): `USUAL_COSTS.crypto`, seeded by holding (disposal) and by income type, with chips; the cost-line helpers are shared by all four lists. WR-1: bare *+ Add cost/expense* buttons in src — 0 left. Smoke `capture-kinds` (e); the build before fails it (no crypto data).
- **63, 38 (2026-10-17):** costs on Royalties and Something else (OI-C1d), netted by `otherReceiptCosts` and floored at nil; farming retired everywhere (OI-C1h) through the `retired` gate — the onboarding/Profile selectors never showed the subtype and the legacy `farming` values matched nothing, so no tax result moved; item 38's line now shows only on a saved farming receipt. Found and fixed: `.yn-tile{display:flex}` outranked `.u-hidden`, so syncKindTiles never actually hid a gated or retired chooser tile. WR-1: a live sweep of every `.u-hidden` element across all modals — the only other hit is `main#app`, shown by inline style on purpose. Fixture TC-023 and smoke `other-receipts`, each failing on the build before.
- **92 (2026-10-17):** farming deleted (FARM-2), superseding 63's retired gate before it merged: the kind, `B9_CATEGORIES.farming`, the note and the category-line element, every comment treating farming as handled; saved farming receipts are filtered in `hydrateFromData` (load and import). One statement remains — the *Other receipts* tip says farming is not covered. WR-1: `grep -rni farming src/` → the tip, its comment, the load filter and the DeFi label. Also: the costs block now notes costs above the receipt (owner, OI-C1d). Smoke `other-receipts`, failing on the build before.
- **87 (2026-10-17):** option (a) (PROV-1): `effectivePlan()` projects from `capturedPlan()` while the plan is empty, read-only, with a note above the tax cards; `prefillFromActual()` writes the same `capturedPlan()`. WR-1: every `APP.monthlyPlan` reader checked — the month table shows the user's own entries by design, and the actual-PAYE sum counts only months marked actual. Smoke `prov-captured`, failing on the build before.
- **93 (2026-10-17):** removal inventory (`docs/reference/removal-inventory.md`) and two batches deleting nine items: income protection (engine term, input, page), the legacy crypto receipt categories, pre-taxonomy income values (Tax Facts had silently lost the par 20, interest, CGT and foreign facts), the partnership subtype, a pre-2001 placeholder, the dead duplicate-income banner, the trust bucket and its *Phase 2* machinery, the tools Vehicle type and the `retired` gate. Saved data: income-protection flag, `B8` status and vehicle assets dropped on load; a crypto-category receipt re-filed as Other (income kept). WR-1 greps in each commit. Smoke `removed-items` and `tools-list`, failing on the builds before; golden moved only by the 26 `incprotDed: 0` deletions.
- **Owner, 2026-10-17:** C-88–C-93, C-98, C-100–C-103 approved (COPY-6); 43 and 42 approved as shipped; 89 closed (before-year tools date stays allowed); 37 option A (HO-1) and 25 every row (GLOB-2a) moved to ready. Still with the owner: C-99 (RISK-2), C-94–C-96, BACKLOG 79, D25, D26.

### P40 · User needs 2026-10 — personas, assessment, market evidence (10-16 → 10-17)

Owner brief 2026-10-16: make persona needs comprehensive, assess the live app
against them, propose improvements (incl. a rough-estimate route into the
planner), gather market evidence, spec the competitor research; implementation
and Espresso specs only after owner confirmation. Started from SweetClaude
onboarding (L3 discovery, personas, SLC stories; PR #430). Records in
`docs/programmes/user-needs-2026-10/`.

- **Findings (live app, v8.36.0):** the free tier covers salary and
  retirement only, so the core persona meets the paywall on her first income
  type; deductions captured on their pages never reach the IRP6
  recommendation; the planner can double-count business income and caps s11F
  on a different base from the return; the Dashboard provisional chip links to
  a removed tab.
- **Market evidence (SARS Tax Statistics 2024):** 36% of assessed provisional
  taxpayers earn R500k+ (not 65%), 55% are 55+; core SAM ~70–100k, not
  200–300k. No published penalty counts — PAIA draft written. TaxTim prices
  verified (R895 freelancer return + R600 IRP6); the R200–R450 willingness to
  pay is unsourced and below the app's own R495.
- **Owner decisions 2026-10-16:** OD-1–OD-4 as recommended; OD-5 add persona
  P4 (55+); OD-6 keep the 7-day trial at sign-in, Basic shows the P1 amount
  and date from a quick estimate; OD-7 (pricing) open; Espresso spec on hold.
- **Open work:** BACKLOG 100–109.
