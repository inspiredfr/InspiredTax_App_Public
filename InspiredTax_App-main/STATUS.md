# STATUS — InspiredTax

What is true now and what is open, in priority order. Not a delivery record:
history is in `CHANGELOG.md`, `docs/PROGRAMMES.md` and `git log`; item detail
is in `BACKLOG.md`; rules are in `CLAUDE.md`. Every claim below was checked
on 2026-10-07 by the post-merge audit (`docs/PROGRAMMES.md` P33) and the
branch audit (P34) against `origin/main` @ `c58b710` and the branch-audit
branch, unless it says *owner-reported*. Update this file whenever the version, the gate results or
what is open changes (see `docs/DOCS-INDEX.md`).

## Current build

- **Version** 8.36.0; artifact `InspiredTax_v8_36.html`; Android
  `versionCode` 83600 (maj·10000+min·100+patch — `docs/android/ANDROID.md`).
- **Gates** — **verified 2026-10-07** on the branch-audit branch
  `ccr-2e1be1fd-1sjf9t` (engine fix at `521eed9`; later commits are docs
  only): `npm run build` (artifact in sync), `npm run test:release` (pretest,
  golden 29 sets, invariants, 20 legislative fixtures, 14 differential checks,
  8 reference-constants files) and `node tests/smoke.js` — all exit 0. The
  golden baseline was re-captured for the `calcTaxOnIncome` threshold fix
  (`npm run test:update`); 162 leaves moved, 0 structural, every money delta
  within the +R0.45 ceiling. Same suite on `main` @ `db28d6e` before the
  post-merge audit: all exit 0. CI "CI" green on `db28d6e`.
- **Release workflow guard (2026-10-15):** *Build InspiredTax* now refuses
  to start while an unmerged `release/x.y.z` branch is ahead of `main`
  (`tools/release-pending.js`, covered by `tests/release-tools.js`). This
  came from the owner's 8.36.0 minor run followed by a patch run, which built
  8.35.3 from the same `main`. #417 (8.36.0) is merged and #419 (8.35.3)
  closed unmerged (checked on GitHub 2026-10-15), so the next run is free.
- **Backlog run 4 (2026-10-17)** — 93 batches A and B on branch
  `ccr-d41f7abf-mlh5bm` (87 at `30cbd7d` on `main` @ `c16fdc5`): `npm run
  test:release`, `node tests/smoke.js`, `npm run check:atlas`, `npm run
  verify:atlas`, `npm run test:bench`, `npm run check:ids` exit 0. Golden
  re-captured for the removed `incprotDed` leaf only (26 deletions, all 0).
  Smoke `removed-items` and `tools-list` fail on the pre-batch builds
  (`30cbd7d`, `19e1013`; positive controls). Batch B moved no golden leaf.
- **8.36.1 fix batch (2026-10-15)** — the three G2 failures on 8.36.0
  (toast under the onboarding overlay, export outcome, step-7 chips), on
  branch `claude/closed-testing-readiness-09njok` from `main` @ `d7d6f57`:
  `npm run build`, `npm test`, `npm run test:engine` and
  `node tests/smoke.js` exit 0. Three new smoke checks and the reworked
  `assertExportOutcome` each fail on `d7d6f57` (positive controls).
- **Store visuals (2026-10-16, BACKLOG 86)** — branch `claude/store-visuals`
  stacked on `claude/messaging-refresh` @ `627a3cd`: `npm run build`,
  `npm run test:engine`, `node tests/smoke.js`, `npm run check:atlas` and
  `npm run check:version` exit 0. New smoke checks `assertRaRoomFromEngine`
  (fails on the pre-fix build: R 62 500 shown for R 204 515) and
  `assertStickyStack` (fails with the old `top: var(--header-h)`: bar at
  56px under an 80px header). The sticky fix is implemented, not verified
  on a phone (D27, WR-3). Site clips (`--clips`, MSG-7, 2026-10-16):
  `npm test` exit 0 after `bootAndUnlock`'s `clockTime` option; clips
  checked in headless Chromium (site commit `2c1f737`).
- **Messaging refresh (2026-10-16, BACKLOG 84)** — branch
  `claude/messaging-refresh` from `main` @ `54e62bf`: `npm run build`,
  `npm run test:engine` (pretest, golden, invariants, legislative,
  differential), `node tests/smoke.js`, `npm run check:atlas` and
  `npm run check:version` exit 0. Copy only (C-94); the wording is
  **not gated** (no check reads About or `PAGE_HELP` text).
- **Backlog run (2026-10-15, P37)** — items 15, 49, 76, 67, 40, 26, 13, 16
  and 57 on branch `ccr-d41f7abf-mlh5bm` from `main` @ `28d5238`:
  `npm run test:engine`, `node tests/smoke.js`, `npm run test:bench`,
  `npm run check:atlas` and `npm run pretest` exit 0 on the final tree
  (`e7557f1`). New CI steps: `check:atlas`, `test:bench`.
- **Backlog run 3 (2026-10-15, P39)** — ID-1 guard and BACKLOG 80 on
  branch `ccr-d41f7abf-mlh5bm` from `main` @ `ee48fe2`: `npm run
  test:release`, `node tests/smoke.js`, `npm run check:atlas`, `npm run
  verify:atlas`, `npm run test:bench`, `npm run check:ids` exit 0. Golden
  baseline re-captured for the new `TAX_YEARS` field only (26 scenarios,
  `ty` alone, 78 lines added, no money field moved). TC-022 and
  `tools/ids.js` each fail on the pre-change tree (positive controls).
- **Backlog run 2 (2026-10-15, P38)** — 78, 23 and 24 on branch
  `ccr-d41f7abf-mlh5bm` (rebased onto `main` @ `a0499dd`, #425):
  `npm run test:release`, `node tests/smoke.js`, `npm run check:atlas`,
  `npm run verify:atlas`, `npm run test:bench` and `npm run check:version`
  exit 0 on the item-24 tree. The two new smoke checks
  (`foreign-service-codes`, `deduction-code-routes`) fail on the pre-audit
  build (positive controls).
- **COPY-4 batch (2026-10-15)** — the owner's copy decisions applied in
  code on branch `ccr-d41f7abf-mlh5bm` from `main` @ `013a7c0`:
  `npm run build`, `npm run test:engine` and `node tests/smoke.js` exit 0.
- **Share on WhatsApp (BACKLOG 83, 2026-10-15)** — branch
  `ccr-917044ea-jl3gqk` from `main` @ `99ab64b`: `npm run test:engine`,
  `node tests/smoke.js` and `npm run pretest` exit 0; the new smoke check
  `assertShareApp` fails with the link pointed at Play (positive control).
  Rides with 67 after 8.36.1; site `/get` change merged (site PR #24); D26 pending
  (WR-3).
- Suite shape: read `tests/expected.json` — don't hardcode scenario count.
- **Atlas and bench checks pass and are blocking (BACKLOG 15, closed
  2026-10-15):** `npm run build` rebuilds the bench and `build.js --check`
  (pretest) verifies it; `check:atlas` is a CI step; `release:bump` moves
  the atlas version; the atlas generator normalises digit grouping, so two
  Chromium builds write the same file.
- **What no gate covers** (RET-18): native Java (`TrialAnchorPlugin`,
  `CloudBackupPlugin`, `PlayBillingPlugin`, `MainActivity`), the real Android
  WebView, Play services (billing, in-app review), real Google sign-in, real
  Drive I/O, and frame rate on a phone. Only the owner's device checks
  (`docs/android/DEVICE-CHECKS.md`) verify these — a green gate here is not
  evidence they work. Every UI change since 8.35.0 (UI-FS-1, UI-PILL-1,
  UI-CAP-0/1, UI-NOTE-1, UI-CARD-1, FV-1) is *implemented, not verified* on a
  phone.
- **Not verified:** `tests/screens` baselines (2026-10-05, cloud sandbox)
  predate #392–#396 and are environment-specific (BACKLOG 47). Not a gate —
  and not re-captured for the threshold fix, which moves displayed whole-rand
  tax figures by up to R1 on some inputs.
- **New gate (2026-10-07):** `tests/invariants.js` holds every year table to
  its own published figures — tax at a bracket's top must reproduce the next
  bracket's `base`. It is what caught the `calcTaxOnIncome` threshold error
  and the `HIST_TAX` 2018/19–2019/20 top-bracket base of 532042 (published
  532041); the older continuity check has a R2 tolerance and could see
  neither.

## Open — in priority order

Detail, acceptance criteria and execution order are in `BACKLOG.md`.

1. **Play Store closed testing (C-H2, BACKLOG 34).** Guide:
   `docs/android/CLOSED-TESTING.md`. *Owner-reported 2026-10-08:* track
   created 2026-10-02; **no invitations sent yet** and no testers enrolled, so
   the mandatory 14-day period has not started. *Owner-reported 2026-10-14:*
   invite adopted and license testing set up (guide §2a–§2b). Recruitment
   is by hand from personal WhatsApp (DECISIONS CT-1). The launch's only
   critical-path item. **2026-10-14:** the first install link waits
   for the guide's go/no-go gate (§0): the track holds 8.35.2 or older while
   `main` (`f4f3303`, CI green) is 66 commits ahead, so first a minor release
   on the track (BACKLOG 66 — *owner-reported 2026-10-15:* 8.36.0 uploaded
   to Play), the owner's checks on it from Play (G2 — *owner-reported
   2026-10-15:* run on 8.36.0 and failed on D16, D20 and the step-7 Tax
   balances chips; all three fixed for 8.36.1, a patch build whose G2
   re-run is D16 and D20; everything else passed), and the
   privacy policy matching the Data safety form (site PR #23, merged with
   66). Asking for e-mails can start now. The same day's
   compliance scan and bug hunt found no Play blocker. Its four code items
   are closed and ride in 8.36.0: the export claim (BACKLOG 72, PR #407), the
   billing verifier (70: prepaid and cancelled subscribers lost paid access,
   PR #409), deletion (71: Delete Account, Remove profile and Reset left
   data behind, the Auto Backup snapshot was never written, the name is now
   sealed PII — owner chose *encrypt*, PR #410) and launch polish (73: Go
   Premium sells only Play's plans at Play's prices, icon safe zone, navy
   splash, sign-in trimmed to e-mail + Drive app data, native and build
   hardening). For 73, `npm run pretest`, `npm run test:engine`,
   `node tests/smoke.js`, `npm run test:artifact` and
   `node tests/run-debug-harness.js` exit 0 on 2026-10-14 (branch
   `claude/closed-testing-readiness-09njok` on `main` @ `22812cc`), and the
   Android debug and release builds compile. Native and visual behaviour
   waits on device cases D20–D23 and B3 (WR-3). The `AuthorizationClient`
   sign-in move, BACKLOG 75, is built (2026-10-15: `npm test`,
   `node tests/smoke.js` and the Android debug and release builds exit 0);
   it ships in 8.36.0 (owner's choice 2026-10-15, after #415 merged ahead of
   the dispatch), so the go/no-go owner check G2 now runs D24 (a)–(c). The scan's copy item, 74, is closed (PR #411
   carried 73; 74 follows in its own PR) with the owner's three calls — ribbon *LAUNCH
   PRICE*, PIN claim reworded, inspiredfr@gmail.com everywhere — and the
   website's privacy policy and terms in site PR #22 (merged 2026-10-14);
   `npm run test:engine` and `node tests/smoke.js` exit 0 for it on
   2026-10-14. The Data safety form (33) answers *No* to collecting or
   sharing user data and has since the first submission (owner-reported
   2026-10-14, DECISIONS DS-1); its one gap closed 2026-10-15 — the owner
   chose to stop sending Google Play an install ID with each purchase, so
   8.36.0 sends none, and site PR #23 drops the policy's sentence about it
   when 8.36.0 is on the track (BACKLOG 66). `npm test`,
   `node tests/smoke.js` and the Android debug and release compiles pass
   for it on 2026-10-15.
2. **Owner device checks — G2's set run on 8.36.0** (BACKLOG 18, 75).
   *Owner-reported 2026-10-15:* D1, D2, D4, D11, D13, the §6 purchase flow
   and D24 (a)–(c) pass; D16 and D20 failed and re-run on 8.36.1
   (`DEVICE-CHECKS.md` §4). D13 passing closes BACKLOG 12. Still to run:
   D1–D15 (the rest), D16 and D20 (on 8.36.1), D17–D19 (km/area save
   block, ribbon figure, on-blur messages), D21–D23 (billing states, profile
   wipe and sealed name, launch polish), D24 (d)–(e), B3 large screens,
   frame rate (fallback
   `STEP_TRANSITION = 'B'`), motion, cloud backup against real Drive.
3. **Owner reviews and decisions — none outstanding** (owner interview
   2026-10-15). Recorded in `docs/DECISIONS.md`: 67 is built for the day-7
   update (RP-1); 68 is deferred to after launch (`O-CI1`); 69's additions
   1–6 are declined (CT-5); farming leaves every surface, silently
   (`OI-C1h`, risk accepted by the owner); foreign currency is one rate per
   currency, editable every year, all three stages now (`OI-FX-3`); the copy
   review is closed — every row through C-83, the C-58 short lines and
   `USUAL_COSTS` (COPY-4), with edits applied in code and the 8.36.1
   *What's new* approved. *Owner-reported 2026-10-15:* 8.36.1 not built yet.
   **Since the interview:** C-84–C-86 approved and C-87 withdrawn
   (2026-10-15, COPY-5); DATA-1 — no earlier-version data is carried.
   **Owner, 2026-10-17:** copy C-88–C-93, C-98 and C-100–C-103 approved
   (COPY-6); 43 and 42 approved as shipped; 89 closed — a tools date before
   the year stays allowed; 37 option A (HO-1); 25 every row as proposed
   (GLOB-2a); site-article editing granted for 85.
   Left with the owner: device checks D25 (BACKLOG 67) and D26 (BACKLOG
   83); BACKLOG 22 — the RISK-2 field list (C-99); BACKLOG 79 — component
   categories; copy C-94–C-96 and the site push, Play Console paste and repo
   descriptions of the messaging refresh (BACKLOG 84, DECISIONS MSG-1 to
   MSG-4, 2026-10-16); the Play upload of the screenshots and the *deadline*
   feature graphic (chosen 2026-10-16, MSG-6) (BACKLOG 86).
   The draft-then-owner items (59, 60, 62) wait on Claude's drafts, not on
   the owner.
   **User needs programme (2026-10-16, P40):** two decisions left with the
   owner — 108 (Espresso QA spec, on hold) and 109 (seasonal pricing, after
   the competitor research 106) — and one action, 107 (send the PAIA request
   for penalty statistics; draft in `docs/programmes/user-needs-2026-10/`).
   Prototype approvals will follow for 102–104.
4. **Play Data safety form** answers *No* to collecting or sharing user data
   (*owner-reported 2026-10-14:* unchanged since the first submission;
   DECISIONS DS-1). Nothing to change in the Console: from 8.36.0 purchases
   carry no identifier (owner's choice 2026-10-15, BACKLOG 33 closed). Site
   PR #23, which brings the privacy policy into line, merged 2026-10-15
   (checked on GitHub 2026-10-16).
5. **Branch cleanup (BACKLOG 48) is done.** Verified 2026-10-14 with
   `git ls-remote`: `main` is the only remote branch besides live session
   branches, and both `archive/claude/*` tags exist.
5. **Cloud backup is built and switched off; v1 launches without it
   (LAUNCH-1, 2026-10-05).** `CLOUD_BACKUP_ENABLED` (`01-data.js`) stays
   `false` until the Data safety form, the privacy policy and device protocol
   C1–C13 are done (BACKLOG 11). Backups exported before 2026-09-30 are
   missing 20 saved fields (QX-DRV-6) — testers should export again.
6. **Claude-owned, ready now** — `BACKLOG.md` index order: 85 (site
   articles with 2025/26 tables labelled 2026/27, blocked on a site-edit
   permission rule), then 99, 100 (dead Dashboard provisional link) and 101
   (planner and return still disagree once a month is planned, on the full
   deduction set, the double count and the s11F base), 22, 79,
   the consolidation prototypes 94–98, then 54 onward (43, 42, 90, 88, 91, 44, 63, 38, 92, 87 and 93 closed, 50 found already shipped, 2026-10-17); 81
   and 82 (IRP5 code coverage) follow 62, then 37 (home office, option A)
   and 25 (GLOB-2 conversions), then the user-needs items 105 (side-income
   cost card), 102–104 (quick estimate with free P1 headline, friction
   shortcuts, goal lenses — prototype first) and 106 (competitor research,
   own session). 85 is blocked in this session: the auto-mode
   classifier refuses edits to the site repo until the owner adds a
   permission rule. 80 closed 2026-10-15.
7. **Decided 2026-10-05:** no chart-specific donut palette (E12); shared hue
   families stay.

## Watchlist

- `para20Threshold` (`01-data.js`) is R1.8m for 2027 and R1m for 2026 and
  earlier, pending TLAB 2026 enactment — recheck when enacted.
- The 2026 filing season closes 2026-10-23 (non-provisional) and 2027-01-22
  (provisional) — `FILING_DEADLINES`. 2027's dates are not gazetted yet; add
  them when SARS publishes.
- `FOREIGN_EXCHANGE_RATES` has no 2027 row until SARS publishes Table A after
  February 2027; until then the FX widgets show the QD-11 notice for 2027.
