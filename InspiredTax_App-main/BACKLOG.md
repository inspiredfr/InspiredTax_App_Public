# Backlog — open work only

## How this file works

- **Scope.** Every open item, and nothing else. History lives in
  `CHANGELOG.md` (user-facing), `docs/PROGRAMMES.md` (programme record) and
  `git log`; owner rulings in `docs/DECISIONS.md`. `STATUS.md` summarises
  priorities and points here.
- **IDs are permanent.** Each item has a number that is never reused, so a
  reference such as "BACKLOG 28" in a commit, comment or doc keeps resolving.
  Numbers 1–10 and any number missing below are closed. **Next free ID: 110.**
- **States.** `ready` — Claude can start now. `decision` — the owner must
  answer the *Decision needed* line first. `owner` — an owner action (Play
  Console, a phone, a review); nothing for Claude to do until it is reported.
- **Order.** The index lists items in recommended execution order. Work top
  down within what your role can do.
- **Every item has the same fields:** state and next action, what and why,
  files, done when (acceptance criteria), depends on, decision needed.
- **To add an item:** run `npm run next:id` and take the number it gives —
  it reads every pushed branch, not just this checkout, so a parallel session's
  item is not handed out twice (DECISIONS ID-1; `npm run check:ids` fails CI
  on a duplicate). Then add an index row where it
  belongs in the order, add its block under *Items* (blocks are in ID order),
  bump *Next free ID*.
- **To update:** edit the block; if the state or order changes, edit the
  index row too. Date anything owner-reported.
- **To close:** delete the block and the index row, then record the outcome
  in `CHANGELOG.md` and/or `docs/PROGRAMMES.md`.

Consolidated 2026-10-07 by the post-merge audit of sessions A/B/C (PRs
#390–#399) against `origin/main` @ `db28d6e`: the previous backlog, every open
item in the three session handoffs (retired), and the audit's findings, each
re-checked against the code.

---

## Index — in execution order

| # | ID | Item | State | Next action |
|---|---|---|---|---|
| 1 | 85 | Support site articles show 2025/26 tax tables as 2026/27 | ready | Claude (blocked: site-edit permission rule) |
| 2 | 99 | Smoke text-collision check failed once in CI on income/main (passed on re-run) — find the race | ready | Claude |
| 3 | 100 | Dashboard provisional chip opens a tab that no longer exists | ready | Claude |
| 4 | 101 | Planner and return disagree: captured deductions, double count, retirement cap base | ready | Claude |
| 5 | 22 | RISK-2: build the eFiling-sourced multi-select (9 options, as recommended) | ready | Claude |
| 6 | 79 | Component categories: record Section card and Chips & badges; Surfaces stays per screen | ready | Claude |
| 7 | 94 | Consolidation: one static line row for `.sum-line` + `.mini-row` (prototype first) | ready | Claude, then owner |
| 8 | 95 | Consolidation: the twelve one-off `*-row` classes into Rows (prototype first) | ready | Claude, then owner |
| 9 | 96 | Consolidation: one saved-record row for the saved-record `.card` (prototype first) | ready | Claude, then owner |
| 10 | 97 | Consolidation: one choice tile for the four `*-tile` classes (prototype first) | ready | Claude, then owner |
| 11 | 98 | Consolidation: `.inc-hero` into `.dhero` (prototype first) | ready | Claude, then owner |
| 12 | 54 | Foreign currency: spot and average, both bases — all three stages | ready | Claude |
| 13 | 47 | Fix the screenshot harness, then re-capture in the cloud | ready | Claude |
| 14 | 55 | s11F cap: legislative fixtures + the retirement cap card (RA-2) | ready | Claude |
| 15 | 28 | Cards app-wide — full width, all four charts, prototype first | ready | Claude, then owner |
| 16 | 56 | Completion indicator on the Dashboard and tax pages | ready | Claude |
| 17 | 64 | Drawer rows: record count for lists, completion count for questions | ready | Claude |
| 18 | 65 | Balance-reason sub-line — largest cause, rest behind More | ready | Claude |
| 19 | 59 | Extra two-pot questions (B-15 interview) | ready | Claude, then owner |
| 20 | 60 | Employer low-interest loans and employer accommodation | ready | Claude, then owner |
| 21 | 62 | Two part-builds: below-threshold exclusion and para 43 | ready | Claude, then owner |
| 22 | 81 | IRP5 codes with no capture path (taxable, non-taxable, 3614) | ready | Claude, then owner |
| 23 | 82 | Foreign-service variants of allowances and fringe benefits | ready | Claude |
| 24 | 37 | Home office part-year: option A — drop *Months used*, area ratio only (IN28) | ready | Claude |
| 25 | 25 | GLOB-2: convert the typed percentages, every row as proposed; widen the lint | ready | Claude |
| 26 | 105 | *What your side income costs* card | ready | Claude |
| 27 | 102 | Quick estimate into the planner, free P1 headline, two payment figures (prototype first) | ready | Claude, then owner |
| 28 | 103 | Shortcuts at the point of friction (prototype first) | ready | Claude, then owner |
| 29 | 104 | Goal lenses, incl. retirement-income lens for P4 (prototype first) | ready | Claude, then owner |
| 30 | 106 | Competitor research: TaxTim teardown, SA and international apps | ready | Claude (own session) |
| 31 | 108 | Espresso QA spec — on hold | decision | Owner |
| 32 | 109 | Seasonal pricing (OD-7), after 106 | decision | Owner |
| 33 | 84 | Messaging refresh: review C-94–C-96, publish the site, paste the Play copy | owner | Owner |
| 34 | 86 | Store listing assets: upload screenshots and feature graphic, publish site phones | owner | Owner |
| 35 | 67 | In-app *Report a problem* — built; device check D25 | owner | Owner |
| 36 | 83 | *Share InspiredTax* on WhatsApp — built; device check D26 | owner | Owner |
| 37 | 66 | Put a current build on the closed track before the first install link — 8.36.1 | owner | Owner |
| 38 | 75 | Google sign-in on AuthorizationClient — device checks on 8.36.0 | owner | Owner |
| 39 | 34 | Closed-testing tester recruitment (launch critical path) | owner | Owner |
| 40 | 18 | Remaining device checks, incl. D16–D23 | owner | Owner |
| 41 | 11 | Cloud backup switch-on (post-launch) | owner | Owner |
| 42 | 107 | Send the PAIA request for provisional penalty statistics | owner | Owner |

**User needs programme 2026-10-16 (`docs/PROGRAMMES.md` P40) added 100–109.**
108 (Espresso spec, on hold) and 109 (seasonal pricing, after 106) are the
only `decision` items. 101 is what remains of the planner/return gap after
87 (#439) fixed the empty plan.

**Owner interview 2026-10-15 — nothing is in the `decision` state.** 67 is
to build for the day-7 update (DECISIONS RP-1); 68 is deferred to after
launch (`O-CI1`, Deferred table); 69's additions 1–6 are declined (CT-5);
63's farming scope is answered — everywhere, silently (`OI-C1h`); 54's three
questions are answered — one rate per currency, editable every year, all
three stages now (`OI-FX-3`); the copy review, 46, is closed (COPY-4). Items
35, 41, 45, 51 and 53, closed or built 2026-10-08/09 and recorded in
`docs/PROGRAMMES.md` P35 and `DECISIONS.md`, lose their blocks here.

The closed-testing path: 66 (8.36.1 — *owner-reported 2026-10-15:* not built
yet; its *What's new* is approved, `03-STORE-COPY.md` §3) comes before the
first install link; then 34, 75 and 18 run on it. 67 rides the day-7 update.

Closed or retired by the 2026-10-08/09 interview: 45 (confirmations), 35 (no
outside s11F review), 58 (catch-all balance, dropped), 61 (pre-2001
valuation, **retired indefinitely** — `OI-D2`, not to be re-raised). Vested
rights left out of 62.


---

## Items

### 11 · Cloud backup switch-on (post-launch)

- **State:** owner · **Next action:** owner, after launch
- **What and why:** Built behind `CLOUD_BACKUP_ENABLED = false` (QX-DRV-5):
  JS rules and UI (QR10a), native `CloudBackupPlugin` (QR10b, stub-compiled
  only). v1 launches without it (LAUNCH-1, 2026-10-05). Copy C-28a/C-28b are
  approved.
- **Files:** `src/js/01-data.js` (`CLOUD_BACKUP_ENABLED`);
  `docs/android/DEVICE-CHECKS.md` A2 (C1–C13);
  `docs/programmes/play-store-launch/03-STORE-COPY.md` (Data safety answers);
  privacy policy in the support-site repo.
- **Done when:** the Play Data safety form and the hosted privacy policy
  describe backup; device protocol C1–C13 passes; the switch ships.
- **Depends on:** launch; 33.
- **Decision needed:** after case C13 — TrialAnchor's Google account (see
  Deferred).

### 18 · Remaining device checks, incl. D16–D23

- **State:** owner · **Next action:** owner (phone)
- **Owner-reported 2026-10-15 (G2, 8.36.0):** D1, D2, D4 and D11 pass;
  D16 and D20 failed and are fixed for 8.36.1 (re-run there, BACKLOG 66).
- **What and why:** None run as of 2026-10-07. Sign-in policy and landings
  D1–D12, D14, D15 (A1); wizard-step frame rate (A3 — if they stutter, set
  `STEP_TRANSITION = 'B'`); motion in both themes (A4); onboarding forced
  answers, km/area save block, ribbon figure and on-blur messages D16–D19,
  export outcome D20, billing states D21, profile wipe and sealed name D22,
  launch polish D23 (A6); the 360 px eyeball list (B1), polish re-checks (B2)
  and large screens (B3). Plan
  (2026-10-05): run on the closed-testing build during the 14-day period.
- **Files:** `docs/android/DEVICE-CHECKS.md` §2–§4; `docs/android/CLOSED-TESTING.md` §6.
- **Done when:** each §4 row reads *pass* with build and date; failures go
  to Claude with the `hits.txt` lines.
- **Depends on:** closed-testing build; A2 and A3 need the debuggable build.
- **Decision needed:** none.

### 22 · RISK-2 eFiling-sourced multi-select — build

- **State:** ready · **Next action:** Claude · *owner approved the recommendation, 2026-10-17 (DECISIONS RISK-2a)*
- **What and why:** Build the Risk Assessment question *Did any of these
  differ from what eFiling showed?* from `docs/reference/risk2-field-list.md`
  §1, with the recommended merges: 4+5 *Interest*, 6+7 *Foreign interest or
  dividends, or the foreign tax on them*, 8+9 *Dividends taxed as income* —
  nine options. A ticked option raises the score **and** shows a line telling
  the user to keep the third party's corrected certificate (G05: ask the
  third party to resend). The §2 no-third-party-source fields are flagged
  automatically, as now.
- **Files:** `src/js/01-data.js` (options as data, with their app fields),
  `src/js/07-render-summary.js` `renderRiskAssessment()`; copy C-99 updated
  for the merges.
- **Done when:** the nine options are data; ticking one moves the score and
  shows the certificate line; a smoke check fails without it; the draft doc
  records the outcome.
- **Depends on:** none. **Decision needed:** none.

### 25 · GLOB-2 residual list

- **State:** ready · **Next action:** Claude · *owner kept every row as proposed and approved C-98, 2026-10-17 (DECISIONS GLOB-2a)*
- **What and why:** Statutory figures typed into strings the inline-figure
  lint does not scan (hard rule 5). **Proposal delivered 2026-10-16:**
  `docs/reference/glob2-residual-proposal.md`. It sorts 20 strings into
  *interpolate* (same words, figure from data; no review needed) and
  *reword* (drop the figure; new copy, C-98), plus 2 keeps. Five strings
  were **wrong numbers**, not just typed ones, and are fixed in the same
  batch: the RA top-up analyser and the RA-room tip used their own
  `min(gross × 27.5%, cap)` and rebuilt tax from IRP5 gross (a negative
  saving with a lump sum in the year); the donations tip and the donations
  risk check applied 10% to taxable income after donations; the medical tip
  typed a stale R4,368. Gate: smoke `ra-analyser`.
- **Files:** as listed in the proposal.
- **Done when:** every interpolation and reword in the proposal's §2 is
  built, and the inline-figure lint widens to the string kinds in its §3.
- **Depends on:** none. **Decision needed:** none.

### 28 · Cards app-wide (UI-CARD-1 follow-on)

- **State:** ready · **Next action:** Claude, then owner · *decided `OI-B4` 10-08*
- **What and why:** The owner asked (2026-10-05) for every card to have the
  lip, an expanded breakdown and a chart; only the Tax screens are done
  (#395). Left: 13 `.stat-card` uses — `04-deductions.js` medical (2) and
  interest (3) summaries, `09-projection.js` two four-card rows (8); the
  Dashboard (`renderDashboard`, built with `glanceCardSpecs()`; opens in
  place, only the gross card has a chart) and Income (`renderIncomeMiniCards`,
  own markup) grids; the Deductions `.mini-card` uses (retirement cap, medical
  breakdown, tax saving, medical credits).
- **Files:** `src/js/02-core.js` `miniCardHtml`; `07-render-summary.js`
  `taxCardsHtml`; `03-income.js`; `04-deductions.js`; `08-dashboard-theme.js`;
  `09-projection.js`; `.stat-card*` in `src/styles/main.css`.
- **Done when:** no `.stat-card` is left (CSS deleted); every summary card is
  built by `miniCardHtml` with the lip, opens as decided, and shows a chart
  and lines from engine output only (hard rule 2); `assertTaxCards` (or a
  generalised version) covers the new screens and fails on the old build;
  the debug harness passes; new copy is in the copy deck.
- **Depends on:** 43 (the R 0 rule applies to every card).
- **Decision needed:** (1) Dashboard: open to full width (option B) or keep
  open-in-place? (2) Should the Dashboard's other three cards show charts?

### 34 · Closed-testing tester recruitment (launch critical path)

- **State:** owner · **Next action:** owner
- **What and why:** Play needs at least 12 testers opted in for 14
  consecutive days before production access (see *Launch* below). No
  testers enrolled (owner, 2026-10-04). *Owner-reported 2026-10-14:* the
  invite (§2b) is adopted, license testing is set up (§2a), and every setup
  item in §1 is done except the second-account end-to-end check. Recruitment
  is run by hand from personal WhatsApp (DECISIONS CT-1). 2026-10-14
  readiness assessment: the first install link (M3) waits for the guide's
  go/no-go gate (§0) — a current build on the track (66), the owner's
  second-account and first-five-minutes checks on it, the privacy policy
  matching the Data safety form (site PR #23, with 66), feedback intake and feature tasks. Asking for e-mails (M1) need not
  wait.
- **Files:** `docs/android/CLOSED-TESTING.md`;
  `docs/programmes/closed-testing-2026-10/FEEDBACK-LOG.md`.
- **Done when:** ≥ 12 testers opted in (aim for 20); the start date
  recorded in STATUS; 14 consecutive days at ≥ 12; production access
  applied for (guide §5).
- **Depends on:** none.
- **Decision needed:** none.

### 37 · B-8 home office used for part of the year — option A

- **State:** ready · **Next action:** Claude · *owner chose option A and approved C-100, 2026-10-17 (DECISIONS HO-1)*
- **What and why:** Promoted by the owner 2026-10-05 as copy only. **Draft
  delivered 2026-10-17:** `docs/reference/b8-home-office-period-draft.md`.
  The primary source turned this into a calculation question. SARS IN28
  (Issue 3) §4.6.1 Example 9 note 2 says yearly costs **may not** be
  time-apportioned by months; only the actual costs for the qualifying
  months, apportioned by floor area. `calcHomeOffice()` applies
  `area × months/12` to yearly costs. That is wrong when costs vary month to
  month, and it understates when the user enters part-year costs. Tests
  can't see it: every persona uses 12 months.
- **Files:** `src/body.html` (`ho_months_used`), `04-deductions.js`
  `calcHomeOffice()`, a legislative fixture from IN28 Example 9, copy deck
  (C-100).
- **Done when:** *Months used* is gone, `calcHomeOffice()` applies the area
  ratio only, with the IN28 citation (WR-10) and the Example 9 fixture
  (R135,000, 16 of 253 m² → R8,537); C-100 copy in place; test:engine and
  smoke pass.
- **Depends on:** none. **Decision needed:** none.

### 47 · Screenshot baselines refresh

- **State:** ready · **Next action:** Claude · *decided `OI-B8` 10-08*
- **What and why:** `tests/screens/*.png` were captured 2026-10-05, before
  #392–#396 changed most screens, so `npm run shots` differs heavily. Not a
  gate. Baselines are environment-specific (fonts). Checked 2026-10-08, two
  coverage facts matter before re-capturing: `tests/screenshots.js` opens
  each sheet with `openModal()`, which sets no `data-kind-stage`, so the
  chooser is hidden (main.css) and the FORM is captured — the new chooser
  screens are in no baseline at all; and its `MODALS` list holds 8 of the 16
  capture sheets (missing IRP5, PAYE, tax-free investment, tools, donation,
  other claims, and both crypto sheets). Re-capturing alone therefore leaves
  the most-changed screens uncovered.
- **Files:** `tests/screens/`; `npm run shots:update`.
- **Done when:** re-captured on current `main` after a 360 px eyeball in both
  themes; the STATUS note updated.
- **Depends on:** none.
- **Decision needed:** none. Owner 10-08: the cloud session, where they are
  compared, and every shot is retained there — but the harness is fixed
  first (the two coverage facts above), not just re-run.


### 54 · Foreign currency: spot and average, both bases

- **State:** ready · **Next action:** Claude — all three stages, owner
  2026-10-15 (`OI-FX-3`)
- **What and why:** `OI-FX-1` carries the owner's specification and the law;
  `OI-FX-2` the question rewording. Live now, not hypothetical:
  `FOREIGN_EXCHANGE_RATES` has no 2027 row and `fxActiveYear()` defaults to
  2027, so every foreign-amount widget shows the notice today.
- **What the survey found (2026-10-09), which changes the shape of the job:**
  - The **opt-in already exists**: `fxWidgetHtml()` renders the converter
    collapsed behind *Enter in foreign currency instead?*, so the spec's
    "checkbox that reveals the optional forex fields" is that expander. What
    is missing inside it is a **rate** field — today the rate comes only from
    `FOREIGN_EXCHANGE_RATES`, and in a year with no published row
    `fxRefreshWidgets()` hides the grid entirely.
  - There are **16 widget instances**: 13 from `MODAL_CONFIGS`
    (`grep -n "fxWidgetHtml(" src/js/00-forms.js`) and 3 hand-written on the
    Foreign Income page (`src/body.html`).
  - **Provenance is the big piece.** The `-rate/-source/-date` hidden fields
    exist on every instance, but only the **employment** sheet persists them
    (`M_income`, via the explicit id `emp-fx`; every other instance takes an
    auto-incrementing id, which `fxWidgetHtml`'s own comment says shifts if a
    `MODAL_CONFIGS` entry is added or removed). So `OI-FX-1`(e) — provenance
    whenever the fields are captured — is **1 of 16 today**.
- **Proposed build, in three stages, each gated and committed on its own:**
  1. **The rate field and both bases.** A rate input inside the widget,
     pre-filled with the published average where there is one and editable
     either way; `fxApply()` prefers the typed rate and labels the source
     accordingly; a year with no published row shows currency + rate + amount
     instead of hiding the grid; the `OI-FX-1`(d) note; the `OI-FX-1`(f)
     plausibility rule in `FIELD_CHECKS` (warning, never blocking).
  2. **Provenance for all 16, through one mechanism, not 48 field entries.**
     `makeCrudModule` sweeps `.fx-widget` inside its sheet on collect and
     stores `fx: { '<targetFieldId>': { cur, amt, rate, source, date } }` on
     the record, with the mirror on clear and load — one reader, the way
     `cryptoDisposalCosts()` is (WR-8). The employment sheet's bespoke
     `fxRate`/`fxRateSource`/`fxRateDate` keys migrate into it rather than
     living alongside. Where provenance was not captured, the
     "not reproducible, record it in the note" advice of `OI-FX-1`(e).
     **This touches the save/load/backup path** (`PERSIST`-style field lists,
     `_buildExportPayload`, `hydrateFromData`), and hard rule "never add a
     parallel persistence path" applies — so it rides the existing record, and
     needs `test:engine`, smoke and a cloud-backup round-trip. A rate is not
     PII, so `PII_FIELDS` is unaffected.
  3. **The declared average rate and the reworded question.** Captured in
     onboarding and Profile when the foreign question is answered yes, then
     offered as the widget's default for the year; `OI-FX-2`'s wording.
- **Files:** `fxWidgetHtml` (`src/js/00-forms.js`); `fxRefreshWidgets`,
  `fxApply` (`src/js/02-core.js`); `makeCrudModule`
  (`src/js/05-list-modules.js`); `FIELD_CHECKS`, `FOREIGN_EXCHANGE_RATES`
  (`src/js/01-data.js`); the three hand-written widgets (`src/body.html`);
  the profile/onboarding foreign question; the copy deck.
- **Done when:** all six parts of `OI-FX-1` hold; a smoke assertion covers a
  year with and without published rates, and provenance surviving a save,
  load and export round-trip; `npm run test:engine` and smoke pass; copy-deck
  rows for the note, the rewording and the warning.
- **Depends on:** none.
- **Decision needed:** none. Answered 2026-10-15 (`OI-FX-3`): one rate
  **per currency** per year; the rate is **editable in every year**,
  pre-filled with SARS's average where published (the owner first chose to
  lock it, then reversed on the s25D(1) point); **all three stages now**,
  stage 2's persistence change included — so a cloud-backup and export
  round-trip is part of its gate.

### 55 · s11F cap: legislative fixtures and the retirement cap card (RA-2)

- **State:** ready · **Next action:** Claude
- **What and why:** `OI-S11F-1`/`OI-S11F-2`/`OI-RA-2`. All three s11F(2) limbs
  are applied, but **no legislative fixture covers the cap** — the one real
  gap the 10-08 verification found. RA-2 (the card showing the three limbs,
  the "lowest of" relation and the year's cap) is commissioned, and the card
  must name which limb bound. `ARCHITECTURE.md`'s "two of three limbs" is
  corrected in the same change.
- **Files:** `tests/legislative/` (new fixtures); `src/js/02-core.js` (expose
  the binding limb alongside `retMax`); `07-render-summary.js` (the card);
  `docs/product/ARCHITECTURE.md`; the copy deck.
- **Done when:** one fixture per binding limb (rand cap, 27.5 % test, the
  taxable-income cap), each citing s11F(2)(a)/(b)/(c) and the year's figures
  as data; the card names the binding limb; `npm run test:engine` and smoke
  pass; the architecture doc corrected.
- **Depends on:** none (item 35, closed 10-09, no longer gates it).
- **Decision needed:** none for the card or the fixtures (item 35 only asked
  whether the outside review still happens).

### 56 · Completion indicator on the Dashboard and tax pages

- **State:** ready · **Next action:** Claude
- **What and why:** `OI-D1a` carries the owner's counting rules. Promoted out
  of the parked list 10-08. Income already computes a version
  (`getIncomeOutstanding()`); deductions and the hero containers do not.
- **Files:** `src/js/02-core.js`; `03-income.js` `getIncomeOutstanding`;
  `07-render-summary.js`; `04-deductions.js`.
- **Done when:** the indicator shows on the Dashboard and the
  tax-calculation pages only; the denominator follows `OI-D1a` exactly
  (PAYE excluded, foreign income not double-counted, one item per main source
  or deduction type, tax balances counting expected vs captured **opening**
  balances only); unit-checked on a fixture with multiple records per source;
  smoke asserts it appears on those pages and nowhere else.
- **Depends on:** 28 (same surfaces).
- **Decision needed:** none.

### 59 · Extra two-pot questions

- **State:** ready · **Next action:** Claude, then owner
- **What and why:** Coverage gap B-15, promoted out of parked 10-08
  (owner: "Add additional two-pot questions"). Withdrawal frequency,
  directive-versus-received, and forewarning. Needs an interview before
  building, because the questions decide what the engine can check.
- **Files:** `CFG_TWOPOT` (`src/js/00-forms.js`); `M_twopot`
  (`05-list-modules.js`); `02-core.js` two-pot paths.
- **Done when:** the questions are agreed with the owner, built, cited to the
  Second Schedule / s1 "savings withdrawal benefit", and gated by a
  legislative fixture where an answer moves a result.
- **Depends on:** none.
- **Decision needed:** the question set (interview).

### 60 · Employer low-interest loans and employer accommodation

- **State:** ready · **Next action:** Claude, then owner
- **What and why:** Coverage gap C-7, promoted out of parked 10-08. Seventh
  Schedule fringe benefits: para 11 (interest-free or low-interest loans,
  against the official rate) and para 9 (residential accommodation). Needs an
  interview: both have formula inputs the app does not collect.
- **Files:** `IRP5_INCOME` / `IRP5_CODE_MAP` (`src/js/01-data.js`);
  `02-core.js`; a capture surface to be designed.
- **Done when:** the inputs are agreed, the official rate is data with a
  citation (never inlined), the benefit is computed in `calcFullTax()`, and a
  legislative fixture per benefit passes.
- **Depends on:** none.
- **Decision needed:** the question set and scope (interview).

### 62 · Two part-builds: below-threshold exclusion and para 43

- **State:** ready · **Next action:** Claude, then owner
- **What and why:** Promoted out of parked 10-08, **narrowed 10-09**
  (`OI-D3`): **two** part-builds, not three. B-9: the provisional-taxpayer
  "below the tax threshold" exclusion. C-3: Eighth Schedule para 43
  (foreign-currency translation for capital gains). **Vested rights (C-13) are
  left out** — owner 10-09, reversing the previous day's promotion.
- **Files:** `02-core.js` provisional paths; `01-data.js` thresholds;
  CGT paths for para 43 (note it interacts with item 54 — para 43 has its own
  translation rule, outside s25D).
- **Done when:** both are built with their primary source cited, each has a
  legislative fixture, and para 43's rule is visibly distinct from `OI-FX-1`'s
  s25D rule so the two cannot be confused (para 43 has its own translation
  rule and is expressly outside s25D).
- **Depends on:** 54 (para 43 must not be built on the s25D rule).
- **Decision needed:** scope per part (Claude proposes, owner confirms).

### 64 · Drawer rows with a per-area metric

- **State:** ready · **Next action:** Claude · *decided `OI-D1e` 10-09*
- **What and why:** Moved out of the parked table 10-08 so it is tracked as an
  item. Today each drawer row carries a badge only — *Has data* / *In
  progress* / nothing (`_drawerBadgeHtml`, `04-deductions.js`). The parked idea
  was a number instead. What the number counts is the content decision.
- **Files:** `src/js/04-deductions.js` `_drawerBadgeHtml`, `_drawerRowHtml`.
- **Done when:** the chosen measure is rendered per area, with a smoke
  assertion, and the copy deck records the wording.
- **Depends on:** none.
- **Decision needed:** none. Owner 10-09: a **record count** where the area is
  a list (*4 assets*, *3 trips*) and a **completion count** where it is a set
  of questions (*2 of 5 answered*, reusing item 56's rules).

### 65 · Balance-reason sub-line

- **State:** ready · **Next action:** Claude · *decided `OI-D1f` 10-09*
- **What and why:** Moved out of the parked table 10-08 so it is tracked as an
  item. Decision 4.1 / DASH-3 parked cause-specific balance sub-lines until a
  `balanceReason` engine output is specified and `test:engine`-gated. The owner
  asked on 10-08 what is needed from them: the **list of causes to name** and
  their **priority when several apply**. Code cannot choose that — the figure
  has many contributing causes at once and ranking them is a judgement about
  what the user most needs told.
- **Files:** `src/js/02-core.js` (`calcFullTax` return); `07-render-summary.js`
  and the Dashboard hero.
- **Done when:** the cause list and priority are recorded here, `balanceReason`
  returns one cause per calculation, a `test:engine` case pins each cause, and
  the sub-line copy is in the copy deck.
- **Depends on:** none.
- **Decision needed:** none. Owner 10-09: name the **single largest
  contributing cause**, the rest behind *More*, so the line is always one
  sentence. The candidate causes are those listed above; `balanceReason`
  returns the largest and the magnitude of each, and a `test:engine` case
  pins which cause wins on a fixture built to make two of them close.

### 66 · Put a current build on the closed track before the first install link

- **Owner-reported 2026-10-15 (interview):** 8.36.1 not built yet. Its
  *What's new* is approved (`03-STORE-COPY.md` §3, COPY-4) and #422 is merged.
- **State:** owner · **Next action:** owner — run
  *Build InspiredTax* as a **patch** (8.36.1), merge its release PR, upload
  the AAB to Internal and Closed testing, then re-run D16 (with the step-7
  pills) and D20 on it from Play (`CLOSED-TESTING.md` §0 G2), and G3
- **2026-10-15 — G2 on 8.36.0 failed (owner-reported):** D1, D2, D4, D11,
  D13, §6 and D24 (a)–(c) pass; D16 (blocked, no toast), D20 (every export
  read *Backup not saved*) and the step-7 Tax balances chips (oversized)
  fail (`DEVICE-CHECKS.md` §4). All three are fixed for 8.36.1: the toast
  sits above the onboarding overlay, the export asks *Is your backup saved?*
  when Android cannot say (owner's choice, DECISIONS EXP-1), and the chips
  are pills again. Release PR #417 is merged (8.36.0 on `main`) and #419
  (8.35.3) is closed unmerged — checked on GitHub 2026-10-15.
- **Owner-reported 2026-10-15:** 8.36.0 (versionCode 83600, *Build
  InspiredTax* run 42, release PR #417) is uploaded to Play. A second run
  (43) built the same commit as 8.35.3 (release PR #419) because #417 was
  still open; it is not uploaded, and #420 now stops the workflow while a
  release PR is unmerged. Site PR #23 merged 13:21 UTC.
- **What and why:** Found by the closed-testing readiness assessment
  (2026-10-14). The newest build is 8.35.2 (*Build InspiredTax* run 40,
  2026-10-03), so the closed track carries 8.35.2 or older; `main` has 66
  commits since and CI is green on it (`f4f3303`, run 240). Missing from the
  track: UI-FS-1/UI-PILL-1 (the fix for D13, which failed on the owner's
  phone), UI-CAP-0/1, UI-NOTE-1, UI-CARD-1, FV-1 on-blur validation, the
  crypto para 20(1)(c) base-cost correction (a tax defect: running costs
  reduced a capital gain, TC-021) and the bracket-threshold fix. Testers on
  the old build would report what is already fixed; the day-7 update would
  replace most add forms under them; and the device checks scheduled "on the
  closed-testing build" could not test the changes they exist for. Minor,
  not patch: new user-facing features.
- **Files:** `.github/workflows/build-inspiredtax.yml` (dispatch);
  `CHANGELOG.md` `[Unreleased]`; `docs/programmes/play-store-launch/03-STORE-COPY.md`
  §3 (draft *What's new*, for owner approval); `RELEASE.md` §5–§6.
- **Done when:** a release ≥ 8.36.1 is merged and tagged; its AAB is on
  Internal testing and Closed testing; the closed release shows as available;
  guide §0 G2 has passed on it — on 8.36.1 that means D16 and D20, the rest
  having passed on 8.36.0 (`docs/android/DEVICE-CHECKS.md` §4).
- **Depends on:** none.
- **Riding along:** closed items 72 (export claim, PR #407), 70 (billing
  verifier, PR #409), 71 (deletion, privacy link, sealed name, PR #410) and
  73 (launch polish — merge its PR before the dispatch) ship in 8.36.0, and
  so does 33's outcome: purchases stop sending Google Play an install ID
  (DECISIONS DS-1), and 75's sign-in on `AuthorizationClient` (owner's
  choice 2026-10-15; G2 runs D24 a–c). **When 8.36.0 is on the closed track,
  merge site PR `inspiredfr/InspiredTax` #23**, which drops the privacy
  policy's install-ID sentence and its e-mail line for the trial — until
  then the track build still does both.
- **Decision needed:** none. The *What's new* text is copy (QD-16): the
  owner approves or edits the draft when merging the release PR. The
  `[Unreleased]` section opens with the branch-audit record (48), which is
  not user-facing — it stays out of the Play notes.

### 67 · In-app *Report a problem* with a diagnostics line

- **State:** owner · **Next action:** owner — D25 on the first Play build
  that carries it (WR-3). Copy C-84 approved 2026-10-15 (COPY-5)
- **Built 2026-10-15 — implemented, not verified on a phone.** A drawer row
  (after *Backup, export, Restore*) and an About link call `reportProblem()`
  (`02-core.js`): on a phone `Share.share({ text })` with the message from
  `buildProblemReport()`; in a browser a `mailto:` to `SUPPORT_EMAIL`
  (`01-data.js`, the one address — smoke holds About's link to it). The last
  five uncaught errors and unhandled rejections are kept by
  `noteUncaughtError()`, fed from the existing `error` listener in
  `12-bootstrap-onboarding.js` (no second listener) and a new
  `unhandledrejection` one; digit runs of three or more are redacted and only
  file:line:col is kept. Smoke `assertReportProblem` (fails with the
  redaction removed) checks the version line, the error location, that none
  of the fixture's amounts or profile values appear, and the share sheet.
  It rides the day-7 update — 8.36.1 is the G2 patch and does not need it.
- **What and why:** Found by the readiness assessment (2026-10-14). The test
  has no view of failures in the web layer: Android vitals records native
  crashes and ANRs only, a JavaScript error inside the WebView never reaches
  it, and the app has no analytics by design (`O-H2` stays optional). A
  tester's report arrives as free text with no version, device or error. The
  only in-app contact is the `mailto:` link at the foot of About
  (`src/body.html`), while testing runs on WhatsApp (DECISIONS CT-1).
  Proposal: a *Report a problem* row (drawer and About) that opens the share
  sheet (`@capacitor/share`, already a dependency) with a prepared message —
  version and versionCode, Android and WebView version (user agent), screen
  width, text zoom, theme, the current screen, entitlement state (trial /
  Premium / Basic), and the last few uncaught errors (message and source
  location only) from an in-memory ring buffer filled by `window.onerror` and
  `unhandledrejection`. No amounts, no profile fields, nothing sent
  automatically: the tester chooses WhatsApp or e-mail and sees the text
  first.
- **Files:** `src/js/02-core.js` (ring buffer, message builder);
  `src/body.html` (drawer row, About link); `src/js/01-data.js` (one support
  channel constant); copy deck (QD-16); `tests/smoke.js`.
- **Done when:** the row opens the share sheet with the diagnostics; a smoke
  assertion fails if a profile field or an amount appears in the message and
  checks the version line; About's contact link and the row read one channel
  constant; copy approved.
- **Depends on:** ships through 66's release loop after 8.36.1.
- **Decision needed:** none. Answered 2026-10-15 (RP-1): build it, for the
  day-7 update; the row opens the **share sheet** and the tester picks the
  app (WhatsApp or e-mail); About's link stays inspiredfr@gmail.com — so
  "one support channel constant" means the e-mail address both read. The
  row's copy goes to the copy deck for review (QD-16).

### 75 · Google sign-in on AuthorizationClient — device checks on 8.36.0

- **State:** owner · **Next action:** owner — D24 (d)–(e), the rest of
  D1–D15 and C1–C13 (D24 (a)–(c) passed in G2)
- **2026-10-15 — D24 (a)–(c) pass on 8.36.0 (owner-reported).** (b): no
  prompt after a full close and reopen, so Google remembers the chosen
  account and no stored account is needed. (a): the trial started after one
  account tap with no consent screen, because the account already held the
  app's Drive grant; the consent screen's content is still unseen — D15
  (revoke, then *Start free trial*) shows it.
- **2026-10-15 — ships in 8.36.0 (owner's choice).** PR #415 merged before
  the 8.36.0 dispatch: the first attempt (run 41) failed on a
  `tests/release-tools.js` probe written for 73, and its fix (#416) landed
  after #415. Asked whether to revert 75 out of the build, the owner chose
  to keep it: testers then start on the new sign-in and never cross from
  the old one mid-test. The trade is that the new sign-in is unverified on
  a phone, so G2 now runs D24 (a)–(c) before the first invite; if one fails,
  a patch comes before the invites (DECISIONS AUTH-2).
- **What and why:** Planned in BACKLOG 73; **built 2026-10-15**.
  `GoogleDrivePlugin` (base of `TrialAnchorPlugin` and `CloudBackupPlugin`)
  now authorizes with Identity Services `AuthorizationClient` on
  play-services-auth 22.0.0. That release no longer ships the legacy
  `GoogleSignIn` API, so staying on 21.x was a dead end. Choices
  (DECISIONS AUTH-2):
  - the grant is **drive.appdata only** (no e-mail scope);
  - TrialAnchor uses the app's default Google account;
  - CloudBackup uses the profile's bound account (`setAccount`) and forces
    the chooser only for *enable* or a restore with no bound account;
  - the e-mail CloudBackup binds comes from Drive's `about.get`;
  - a Drive 401 clears the token and authorizes once more (F6).
  The JS contract is unchanged: method names, `interactive`, reject codes.
  TrialAnchor's silent revoked-grant code is now `SIGN_IN_REQUIRED` (was
  `USER_DECLINED`); JS treats the two alike. `tests/cloud-backup.js` §11
  pins both plugins and fails on the previous tree. Debug and release
  (R8) builds compile.
- **Not verified (WR-3):** how a phone that started its trial on the old
  sign-in behaves after the upgrade (D24 d); the consent screen's content
  (D15).
- **Release step:** the privacy policy's sign-in paragraph no longer says
  Google tells the app your e-mail address — the trial no longer receives
  it. That edit rides in site PR `inspiredfr/InspiredTax` #23, merged when
  8.36.0 is on the track (BACKLOG 66).
- **Files:** `android/app/src/main/java/za/co/inspiredtax/app/GoogleDrivePlugin.java`,
  `TrialAnchorPlugin.java`, `CloudBackupPlugin.java`; `android/app/build.gradle`;
  `tests/cloud-backup.js`; `docs/programmes/monetization/04-TRIAL-ANCHOR.md`;
  `docs/android/DEVICE-CHECKS.md` (D24, D9, D15, C4, C9).
- **Done when:** D24, D1–D15 and C1–C13 pass on a Play build that carries it.
- **Depends on:** BACKLOG 66 (8.36.0 on the track).
- **Decision needed:** none.

### 79 · Component categories — record the owner's calls

- **State:** ready · **Next action:** Claude · *owner approved the recommendation, 2026-10-17 (DECISIONS UI-CAT-1)*
- **What and why:** From `docs/reference/render-path-inventory.md` §3:
  **Section card** and **Chips & badges** become categories beside OD-1's six;
  **Surfaces** (login, lock, welcome, backup status) is not a category —
  consistency is per screen. The §4 consolidations are BACKLOG 94–98 in the
  recommended order (glance strips are already BACKLOG 28).
- **Files:** `docs/product/DESIGN-SYSTEM.md`, `docs/DECISIONS.md`, the
  inventory.
- **Done when:** DESIGN-SYSTEM names the eight categories and the Surfaces
  rule; the inventory points at 94–98.
- **Depends on:** none. **Decision needed:** none.

### 81 · IRP5 codes with no capture path (taxable, non-taxable, 3614)

- **State:** ready · **Next action:** Claude, then owner (copy)
- **What and why:** BACKLOG 24 gaps G-2, G-3, G-7. Taxable: 3613 restraint
  of trade, 3619 labour broker (IRP30), 3707 share options, 3806 services,
  3809/3829/3831 taxable bursaries, 3833 bargaining council, 3835 long-service
  award in kind. Non-taxable: 3815/3830/3832 bursaries, 3834 residential
  loan, 3908 exempt policy proceeds. Today a user files these under a
  stand-in code (same tax, wrong code on the return) or leaves them out.
- **Files:** `IRP5_INCOME`, `INCOME_CODE_SHORT` (`01-data.js`); atlas regen.
- **Done when:** each code is in `IRP5_INCOME` with its G06 citation,
  `cat`, `bucket` and `remunerationBase`; names/tooltips in the copy deck.
- **Depends on:** none. 3835 must join the long-service cap in
  `longServiceAwardExcluded()` (`02-core.js`, BACKLOG 80 closed) when added.
- **Decision needed:** none to start; copy review after.

### 82 · Foreign-service variants of allowances and fringe benefits

- **State:** ready · **Next action:** Claude
- **What and why:** BACKLOG 24 gap G-4. Only 3651/3655/3656 exist. Every
  allowance and fringe code has a "+50" foreign-service variant (3751 travel,
  3851 general fringe, 3860 medical aid, 3663 restraint of trade …). They
  are remuneration for s10(1)(o)(ii), so leaving them out understates the
  exemption for a foreign-service worker whose employer reports them.
  `FOREIGN_SERVICE_CODES` (bucket 6) picks up any code added there.
- **Files:** `IRP5_INCOME`; the allowance/fringe treatments that key on the
  local code (travel 3701 → s8(1)(b), subsistence, medical 3810 → s6A
  deemed contribution) must also recognise the variant (WR-8).
- **Done when:** the variants a foreign-service IRP5 can carry are capturable,
  treated like their local code, and counted in the exemption pool; a
  fixture covers one allowance and one fringe benefit.
- **Depends on:** 81 (shared data shape).
- **Decision needed:** none.

### 83 · *Share InspiredTax* on WhatsApp

- **State:** owner · **Next action:** owner — D26 (copy C-88 approved 10-17, COPY-6)
  on the first Play build that carries it (WR-3) — the site's `/get` change
  is live (site PR #24, merged 2026-10-15); at production launch set `PLAY_LIVE`
  on the site (`docs/android/CLOSED-TESTING.md` §5)
- **Built 2026-10-15 — implemented, not verified on a phone.** A drawer row
  (after *Report a problem*) and an About link call `shareApp()`
  (`02-core.js`), which opens `https://wa.me/?text=` with
  `APP_SHARE_MESSAGE` (`01-data.js`): WhatsApp's choose-a-contact screen
  with the message ready. The message ends with `APP_SHARE_URL`,
  `https://inspiredtax.co.za/get` — never a Play URL (DECISIONS SHARE-1).
  The site's `/get` decides where that leads: during the closed test, an
  *Ask for an invite* card to `/join` above the existing install steps;
  at production, `PLAY_LIVE = true` forwards people to the Play listing
  while WhatsApp's crawler still reads the preview card. Smoke
  `assertShareApp` checks the host, both entry points, the wa.me URL and
  that no profile value is in the message; it fails with `APP_SHARE_URL`
  pointed at the Play listing (positive control).
- **What and why:** Owner request 2026-10-15: an easy way to share the app on
  WhatsApp from inside it, using `/join` or `/get`, knowing the Play link
  changes when the app goes to production. An installed app keeps the link
  it was built with until the user updates, so the link must be one the
  website can re-point.
- **Files:** `src/js/01-data.js`, `src/js/02-core.js`, `src/body.html`,
  `tests/smoke.js`; site `get/index.html`.
- **Done when:** C-88 approved; D26 passes. (Site PR #24 merged 2026-10-15.)
- **Depends on:** ships through the release loop after 8.36.1, like 67.
- **Decision needed:** none — the approach is SHARE-1; the owner may veto
  it when reviewing C-88.

## Launch — Play Store

Console-side status is owner-reported; nothing here is verifiable from the
repo. No repo-side engineering blocks the launch.

- **C-H2 · Closed testing — the critical path.** Track created 2026-10-02;
  **no testers enrolled** (owner, 2026-10-04). Personal accounts created after
  2023-11-13 need at least 12 testers opted in for 14 *consecutive* days before
  they can apply for production access; a tester who opts out resets their own
  count (Play Console Help, "App testing requirements for new personal
  developer accounts", answer 14151465, checked 2026-10-04).
  1. Recruit and enrol the testers; share the opt-in link
     (`docs/android/CLOSED-TESTING.md`). Owner blockers 2026-10-05: no list of
     people to ask, and unclear Console opt-in steps — the guide covers both.
     2026-10-14: invite adopted, license testing set up; recruitment by hand
     (DECISIONS CT-1). The first install link waits for the guide's go/no-go
     gate (§0; item 66 and site PR #23 — merged 2026-10-15).
  2. Keep the count at or above the minimum for 14 continuous days; check
     crashes, ANRs and feedback daily; fix critical issues as patch releases
     (`RELEASE.md`).
  3. Apply for production access when Console allows.
- **Downstream, not yet reachable:** C-H3 pre-launch report findings (Google
  generates it after a track upload — fix blocking crashes and security,
  should-fix accessibility) · H-H1 staged rollout · R-E4 launch CHANGELOG
  entry · MZ-4 launch-plan retirement watch (post-launch).

---

## Deferred — needs an owner decision or a prerequisite

| Item | Why it is parked |
|---|---|
| **Billing `REFUNDED` renders as `EXPIRED`** | `14-entitlement.js` collapses every non-active purchase to EXPIRED. The owner left this to best practice (10-08): Claude's call, after launch — a refund is rare and the honest state machine is a post-launch change |
| **v2 backend billing verifier** | Client-only at launch (D-M1, owner). Without Play's real `expiryTime`, v1 cannot date a purchase made on another install (the UI shows no date) and cannot close the forward-clock offline window (`02-BILLING-PLUGIN.md` §4 "Known v1 limit", found in BACKLOG 70). Needs an owner decision to run a backend |
| **Coverage gap C-5a** | Connected-person CGT disposals. It rode in the same parked row as pre-2001 valuation and was never separately ruled on; retiring pre-2001 (`OI-D2`) does not settle it, and it is still blocked by the same declined CGT acquisition/disposal dates (`OI-D2a`, 10-09) |
| **Coverage gap B-3** | Multi-vehicle travel; design alongside the company-car work when picked up (still parked, owner 10-08) |
| **Coverage gap C-8a** | s7/s7C attribution questions and disclosure; needs an interview and a prototype (still parked, owner 10-08) |
| **Play upload from the release workflow (`O-CI1`, was item 68)** | Owner 2026-10-15: revisit after launch. Manual upload through the closed test; setup would be a Play Console service account with Workload Identity Federation (no stored key) and a draft-release job; `tag-release.yml` already tags each release on merge |
| **Coverage gap C-14** | Recoupments and capital/revenue elicitation; needs an interview (still parked, owner 10-08) |

Everything else that was parked here was settled on 2026-10-08/09: promoted
to the items above (56, 59, 60, 62, and the debug-harness to-do, folded into
49's doc sweep); decided outright (`OI-D1b` s20A, `OI-D1c` tax-balance rows,
`OI-D1d` the trial clock, `OI-D1e` the drawer metric, `OI-D1f` the balance
reason); or **dropped** — the catch-all balance (`OI-D4`) and vested rights
(`OI-D3`) are declined, and pre-2001 valuation is **retired indefinitely**
(`OI-D2`): it is off the roadmap, not parked, and is not to be re-raised.

Declined items (out of scope until reopened) are listed in
`docs/DECISIONS.md` §1.

## Optional — not planned

`O-E1` multi-language · `O-E2` launch social posts · `O-E3` promo graphic ·
`O-H1` promo video · `O-H2` crash/analytics SDK · `O-H3` Play Integrity API.
O-H2 and O-H3 have real post-launch value if the owner wants them.
`O-CI1` a Play upload workflow is in *Deferred* (owner 2026-10-15) — the
bare-step `main.yml` was deleted 2026-10-07 because it was not a workflow.

### 84 · Messaging refresh: review and publish

- **State:** owner · **Next action:** owner — review copy C-94 (in-app),
  C-95 (Play) and C-96 (site), then (a) say *push* for the site branch,
  (b) paste the C-95 short and full description into Play Console, and
  (c) approve the two GitHub repo descriptions below. Claude pushes and opens
  the site PR on (a) and sets the descriptions on (c).
- **Built 2026-10-16.** `docs/product/MESSAGING.md` is the one source for
  every description (DECISIONS MSG-1 to MSG-4). In-app: About intro and
  bullet, Tax return page intro (C-94). Play: `03-STORE-COPY.md` short and
  full description (C-95). Site branch `claude/messaging-refresh` in
  `inspiredfr/InspiredTax` (not pushed): home page head and structured data
  (no R449 price, Afrikaans or *Coming soon*), hero and trust line, the
  eight sections commit `120b5ba` (2026-10-07, "Update social preview
  image") deleted by mistake restored with corrected copy — every nav and
  CTA anchor (`#download`, `#engine`, `#calculators`, `#articles`) had
  pointed at nothing since — the deduction comparison and phone mock-ups
  recomputed on 2026/27 tables (they showed 2025/26 figures), App FAQ
  rewritten (14 questions), footer line on 30 pages, article template CTA
  card on 20 articles, the security article's inaccurate claims, and the
  privacy page's waitlist sentence (the waitlist never posted: its form
  action was `formspree.io/f/YOUR_FORM_ID`).
- **Repo descriptions (drafts):** `InspiredTax_App` — *InspiredTax: an
  offline-first Android app that works out South African personal income tax
  and provisional tax on the phone. Single-file SPA in a Capacitor shell.*
  `InspiredTax` — *Support site for InspiredTax (inspiredtax.co.za): free tax
  calculators, articles, FAQ and app install page.* Replace *absolute
  compliance with SARS methodologies* and the income bands (MSG-1, MSG-2).
- **Done when:** C-94–C-96 approved; site PR merged; Console shows the new
  short and full description; both repo descriptions updated.
- **Depends on:** nothing. **Decision needed:** the review above.

### 85 · Support site articles show 2025/26 tax tables as 2026/27

- **State:** ready · **Next action:** Claude
- **What and why:** Found 2026-10-16 (BACKLOG 84 sweep). Four live articles
  in `inspiredfr/InspiredTax` (`how-to-submit-irp6-south-africa`,
  `provisional-tax-calculator-south-africa` and two others matched by
  `grep -lE "R237,100|R17,235|R364|8,736" articles/*.html`) label the
  2025/26 brackets (first band R237,100), primary rebate (R17,235) and
  medical credits as 2026/27. The app's 2026/27 figures are R245,100,
  R17,820 and R376 (`01-data.js` `TAX_YEARS['2027']`). Readers planning
  provisional tax from the article get the wrong number.
- **Files:** `content/articles/sources/*.md` for those articles, then
  `PYTHONUTF8=1 python3 scripts/build-articles.py` (without
  `PYTHONUTF8` the build fails on Windows, cp1252).
- **Done when:** every figure labelled 2026/27 on the site matches
  `TAX_YEARS['2027']`, worked examples recomputed; the grep above returns
  no file whose figure is labelled 2026/27.
- **Found 2026-10-17 (first pass, not yet pushed):** the same four articles
  also tax R12,000 of exempt interest in the calculator example, use R30,900
  for the provisional-tax interest line (R30,000, `provisional.deMinimis`), and
  state the paragraph 20 test the wrong way round — up to the threshold the
  February estimate needs 90% of actual or the basic amount, above it 80%
  (`para20Threshold`, R1.8m from 2026/27 per Budget 2026; GEN-PT-01-G01 rev 26
  §4 for the test). The inversion is also in the live
  `paragraph-20-threshold.md` and several queued articles. Waiting on the
  owner's permission for Claude to edit and push the site's article sources,
  and on whether the paragraph 20 fix covers those other articles too.
- **Depends on:** nothing. **Decision needed:** scope of the paragraph 20 fix
  (four articles, or every article that states it).

### 86 · Store listing assets and the site's phone screens

- **State:** owner · **Next action:** owner — (b) after BACKLOG 84's copy
  review, upload the eight screenshots, their alt text
  (`assets/branding/store-screenshots/ALT-TEXT.md`) and the feature graphic
  in Play Console; (c) say *push* for the site branch `claude/store-visuals`
  (stacked on 84's `claude/messaging-refresh`). Claude pushes on (c).
  (a) is done: the owner chose the *deadline* feature graphic on 2026-10-16
  (DECISIONS MSG-6); `FEATURE = 'deadline'` and the committed file is it.
- **Built 2026-10-16.** `tools/store-shots.js` rewritten: the golden suite's
  sign-up and loader (`APPLY_SCENARIO`, moved to `tests/harness.js`), a
  frozen clock (16 Nov 2026), a paid-Premium device record, and one made-up
  person, Thandi Mokoena (salary, freelance consulting, a rental flat; DECISIONS
  MSG-5). Eight 1080x1920 screenshots in the launch package's order (Dashboard,
  IRP5 code picker, provisional tax, deductions, ITR12, lock screen, RA
  analyser, years 2015/16-2024/25), dark first, a Premium chip on Premium
  screens, one-line captions under 20% of the image, 24-bit PNG. The July set
  showed 2025/26, the old interface and the citations OD-16 removed. The July
  feature graphic was the R icon and wordmark — Play forbids branding that
  duplicates the app icon; the new designs carry no device, screenshot or icon.
  `--clips` records the five phone clips the support site now plays: the
  app's own area sweep, figure count-ups and ring fills, frame by frame on
  Playwright's clock (30 fps, WebM/VP9, 190-320 KB each), each with its last
  frame as the poster (site commits `d776ac0` real stills, replacing
  hand-drawn mock-ups; `2c1f737` the clips). Owner 2026-10-16: WebM only for
  now — a browser that cannot play it (older Safari) shows the poster; an MP4
  copy would need ffmpeg.
- **Done when:** Console shows the new screenshots, alt text and feature
  graphic; the site branch merged.
- **Depends on:** 84 (listing copy review). **Decision needed:** none.

### 94 · Consolidation: one static line row for `.sum-line` + `.mini-row`

- **State:** ready · **Next action:** Claude, then owner · *owner 2026-10-17*
- **What and why:** Owner 2026-10-17 (DECISIONS UI-CAT-1, BACKLOG 79): consolidate `.sum-line` (138 uses) and `.mini-row` (34)
  per `docs/reference/render-path-inventory.md` §4. A visual change — by the
  change process it starts with a prototype in `_mockups/` (both themes,
  360 px) and the owner's choice.
- **Files:** `src/styles/main.css`, the render functions that emit the classes; `_mockups/`.
- **Done when:** prototype approved; one component replaces the old classes; no screen loses content; smoke passes and `npm run shots` is eyeballed at 360 px.
- **Depends on:** none. **Decision needed:** none.

### 95 · Consolidation: the twelve one-off `*-row` classes into the Rows component

- **State:** ready · **Next action:** Claude, then owner · *owner 2026-10-17*
- **What and why:** Owner 2026-10-17 (DECISIONS UI-CAT-1, BACKLOG 79): consolidate the one-off row classes the inventory lists
  per `docs/reference/render-path-inventory.md` §4. A visual change — by the
  change process it starts with a prototype in `_mockups/` (both themes,
  360 px) and the owner's choice.
- **Files:** `src/styles/main.css`, the render functions that emit the classes; `_mockups/`.
- **Done when:** prototype approved; one component replaces the old classes; no screen loses content; smoke passes and `npm run shots` is eyeballed at 360 px.
- **Depends on:** none. **Decision needed:** none.

### 96 · Consolidation: one saved-record row for the saved-record `.card`

- **State:** ready · **Next action:** Claude, then owner · *owner 2026-10-17*
- **What and why:** Owner 2026-10-17 (DECISIONS UI-CAT-1, BACKLOG 79): consolidate the saved-record `.card` template uses in 05/06*
  per `docs/reference/render-path-inventory.md` §4. A visual change — by the
  change process it starts with a prototype in `_mockups/` (both themes,
  360 px) and the owner's choice.
- **Files:** `src/styles/main.css`, the render functions that emit the classes; `_mockups/`.
- **Done when:** prototype approved; one component replaces the old classes; no screen loses content; smoke passes and `npm run shots` is eyeballed at 360 px.
- **Depends on:** none. **Decision needed:** none.

### 97 · Consolidation: one choice tile for `.yn-tile`/`.kind-tile`/`.qa-tile`/`.ob-tile`

- **State:** ready · **Next action:** Claude, then owner · *owner 2026-10-17*
- **What and why:** Owner 2026-10-17 (DECISIONS UI-CAT-1, BACKLOG 79): consolidate the four tile classes
  per `docs/reference/render-path-inventory.md` §4. A visual change — by the
  change process it starts with a prototype in `_mockups/` (both themes,
  360 px) and the owner's choice.
- **Files:** `src/styles/main.css`, the render functions that emit the classes; `_mockups/`.
- **Done when:** prototype approved; one component replaces the old classes; no screen loses content; smoke passes and `npm run shots` is eyeballed at 360 px.
- **Depends on:** none. **Decision needed:** none.

### 98 · Consolidation: `.inc-hero` into `.dhero`

- **State:** ready · **Next action:** Claude, then owner · *owner 2026-10-17*
- **What and why:** Owner 2026-10-17 (DECISIONS UI-CAT-1, BACKLOG 79): consolidate `.inc-hero`
  per `docs/reference/render-path-inventory.md` §4. A visual change — by the
  change process it starts with a prototype in `_mockups/` (both themes,
  360 px) and the owner's choice.
- **Files:** `src/styles/main.css`, the render functions that emit the classes; `_mockups/`.
- **Done when:** prototype approved; one component replaces the old classes; no screen loses content; smoke passes and `npm run shots` is eyeballed at 360 px.
- **Depends on:** none. **Decision needed:** none.

### 99 · Smoke text-collision check: intermittent failure on income/main

- **State:** ready · **Next action:** Claude · *found 2026-10-17, PR #437*
- **What and why:** CI run 39029412760 (head `507ed2f`) failed
  `assertNoTextCollisions(page, 'FIXTURE')` with three pairs on income/main at
  360x640 — the quick-action labels *Add income*, *Add deductions*, *Tax
  Calculation* over the bucket labels *Employment*, *PAYE*, *Investment*. The
  same commit passed locally and on the one CI re-run, and the PR does not
  touch that page, so the check is reading a layout that is still moving
  (an animation, a late render or a font swap) on a slow runner. A gate that
  passes or fails on timing proves nothing either way.
- **Files:** `tests/smoke.js` `assertNoTextCollisions`; the income/main
  quick actions (`src/body.html` ~448) and bucket rows.
- **Done when:** the race is identified (reproduce with CPU throttling) and
  removed at source — the check waits for a settled layout through a real
  signal, never a longer sleep — and 20 throttled runs pass.
- **Depends on:** none. **Decision needed:** none.

### 100 · Dashboard provisional chip opens a tab that no longer exists

- **State:** ready · **Next action:** Claude · *found 2026-10-16, user-needs programme (P40) F14*
- **What and why:** The at-a-glance provisional chip calls
  `navigateTo('income','provisional')` (`08-dashboard-theme.js:1007`).
  Provisional tax moved to Taxation (`summary-provtax`, OD-18), so the tap
  lands nowhere useful. Not yet confirmed in a browser.
- **Files:** `src/js/08-dashboard-theme.js` (`renderDashboardGlanceBottom`).
- **Done when:** confirmed in the browser; the chip opens the Provisional tab;
  WR-1 sweep for other `navigateTo` targets with no screen; smoke check
  failing first.
- **Depends on:** none. **Decision needed:** none.

### 101 · Planner and return disagree: captured deductions, double count, retirement cap base

- **State:** ready · **Next action:** Claude · *owner approved 2026-10-16 (OD-1)*
- **What and why:** 87 (#439, PROV-1) fixed the empty plan: with every month
  blank, `effectivePlan()` projects the captured year. What is left
  (`docs/programmes/user-needs-2026-10/02-ASSESSMENT.md` F3, F4, F15):
  (1) once any month or lump sum is entered, captured deductions stop
  reaching the IRP6 recommendation — adding a home-office claim later does
  not lower the payment; (2) `capturedPlan()` takes only travel, home office
  and tools, while the return's `otherDed` also holds income protection,
  subscriptions, subsistence, foreign subsistence and company car, plus
  `additionalDed`; (3) the planner's *Gross Income* column invites monthly
  invoices while captured business income is already added, with nothing on
  screen saying so — an easy double count; (4) `calcTaxForYear()` tests the
  s11F cap on `gross` unless `retBase` is passed (`02-core.js:1284`), and the
  planner passes none.
- **Files:** `src/js/10-current-year-planner.js` (`capturedPlan`,
  `effectivePlan`, `calcCurrentYear`); `src/js/02-core.js` (additive
  `s11fBase` return field); `src/body.html:1873`.
- **Done when:** as `06-IMPLEMENTATION-SPEC.md` B1: captured deductions read
  from `calcFullTax()` output (`otherDed + additionalDed`, `retTotal`) for
  any plan, month rows are adjustments only, 87's *Based on the income you
  captured* note kept for the empty plan, column renamed with an *Already
  included* line, `retBase` passed, a one-time review card for plans holding
  copied deductions; fixtures *R10k home office added after a month is
  planned lowers P1* and *RA near the cap — same `retAllowed` in planner and
  return*, each failing first; `npm run test:engine`.
- **Depends on:** none (87 shipped). **Decision needed:** none.

### 102 · Quick estimate into the planner, free P1 headline, two payment figures

- **State:** ready · **Next action:** Claude (prototype), then owner
- **What and why:** The core user (contractor) must capture everything,
  behind the paywall, before the planner shows a number (`02-ASSESSMENT.md`
  F1, F5, F6, F7). Owner 2026-10-16: route C (OD-2), and keep the 7-day trial
  at sign-in with Basic showing the P1 amount and date from a quick estimate,
  no detail (OD-6). Estimates are ordinary Business / Salary records flagged
  `source: 'estimate'` — no second engine path. Also: *Full year or so far?*
  on business income; minimum penalty-safe and full payment shown together;
  check the paywall overlay against `docs/product/MESSAGING.md` (spec B6).
- **Files:** `_mockups/` (both themes, 360 px) first; then
  `src/js/12-bootstrap-onboarding.js`, `03-income.js`, `05-list-modules.js`,
  `08-dashboard-theme.js`, `15-entitlement-ui.js`.
- **Done when:** owner approves the prototype; built per `06` B2 and B6; a
  Basic user with only a quick estimate sees *Recommended: R…* and the date on
  the Dashboard; `npm run test:engine` + smoke.
- **Depends on:** 101. **Decision needed:** prototype approval.

### 103 · Shortcuts at the point of friction

- **State:** ready · **Next action:** Claude (prototype), then owner
- **What and why:** Alternatives exist but users do not see them when they
  need them (`03-SUGGESTIONS.md` S-D; OD-3). Design rule into
  `docs/product/UX-WRITING-STYLE-GUIDE.md`; build the empty-planner card, the
  third-expense-row hint, leaving onboarding with nothing captured, deadline
  within 21 days with no forecast, and Help → *Ways to get your answer*.
- **Files:** style guide; `08-dashboard-theme.js`; `05-list-modules.js`;
  `12-bootstrap-onboarding.js`; `src/body.html` (Help).
- **Done when:** prototype approved; built per `06` B3; `npm test`.
- **Depends on:** 102. **Decision needed:** prototype approval.

### 104 · Goal lenses, including a retirement-income lens (persona P4)

- **State:** ready · **Next action:** Claude (prototype), then owner
- **What and why:** One engine, tailored surfaces (OD-4, OD-5). Onboarding
  asks *What do you want to do first?* (provisional payments · side-income
  cost · prepare return / catch up · retirement income · salary only) and
  reorders the Dashboard and drawer; it never hides capability. SARS Tax
  Statistics 2024: 55% of assessed provisional taxpayers are 55+
  (`04-MARKET-EVIDENCE.md` §2), so P4 gets a lens, a large-text pass at 130 %
  and 200 %, and a check that birth year + month lands the right side of 65
  at year end.
- **Files:** `12-bootstrap-onboarding.js`, `08-dashboard-theme.js`, profile.
- **Done when:** prototype approved; built per `06` B4; `npm test`;
  `npm run shots` eyeballed.
- **Depends on:** 102. **Decision needed:** prototype approval.

### 105 · *What your side income costs* card

- **State:** ready · **Next action:** Claude
- **What and why:** Persona P2's single need (`01-USER-NEEDS.md` S2.1): the
  extra tax caused by rental, investment or side income, as one figure =
  `calcFullTax()` with and without those sources (two runs, no new formula).
- **Files:** `07-render-summary.js` or the Dashboard; `02-core.js` (no
  formula change).
- **Done when:** built per `06` B5; fixture where the card equals the
  difference of the two runs; `npm run test:engine`.
- **Depends on:** none. **Decision needed:** none.

### 106 · Competitor research: TaxTim teardown, SA and international apps

- **State:** ready · **Next action:** Claude (own session)
- **What and why:** Owner request 2026-10-16. Spec:
  `docs/programmes/user-needs-2026-10/05-COMPETITOR-RESEARCH-SPEC.md` (Parts
  A–D, evidence-graded, no accounts or purchases, no decompiling). First pass
  in `04-MARKET-EVIDENCE.md` §4–§5.
- **Files:** `docs/programmes/user-needs-2026-10/research/` (new).
- **Done when:** TAXTIM.md, SA-LANDSCAPE.md, INTERNATIONAL.md and
  SYNTHESIS.md written with every row graded.
- **Depends on:** none. **Decision needed:** none.

### 107 · Send the PAIA request for provisional penalty statistics

- **State:** owner · **Next action:** owner sends
- **What and why:** SARS publishes no count or value of provisional-tax
  penalties for individuals (`04-MARKET-EVIDENCE.md` §3). Draft:
  `docs/programmes/user-needs-2026-10/08-PAIA-REQUEST-DRAFT.md` — check the
  current form, address and fee in the SARS PAIA manual first.
- **Files:** the draft; log the reference in `04` §3 when sent.
- **Done when:** sent and the reference logged; reply figures recorded in
  `04` §3 and `.sweetclaude/state/discovery.yaml`.
- **Depends on:** none. **Decision needed:** none.

### 108 · Espresso QA spec: are user expectations met

- **State:** decision · **Next action:** owner — *on hold, owner 2026-10-16*
- **What and why:** Spec Espresso journeys per persona × knowledge level
  K1–K3 measuring the deal-breakers and success criteria in
  `01-USER-NEEDS.md` (taps, time to first figure, dead ends, misleading
  flows). Android has only the Capacitor placeholder test today
  (`android/app/src/androidTest`).
- **Files:** `docs/programmes/user-needs-2026-10/07-ESPRESSO-QA-SPEC.md` (new).
- **Done when:** spec written and approved.
- **Depends on:** the owner lifting the hold. **Decision needed:** go-ahead.

### 109 · Seasonal pricing (OD-7)

- **State:** decision · **Next action:** owner, after 106
- **What and why:** The provisional need peaks twice a year; R75/month for the
  two deadline months is R150 against R495/year (`02-ASSESSMENT.md` F10).
  TaxTim charges R600 for both IRP6 submissions and R895 for a freelancer's
  return (`04-MARKET-EVIDENCE.md` §4). Options in `03-SUGGESTIONS.md` S-J.
- **Files:** `src/js/14-entitlement.js` plans; Play Console.
- **Done when:** the owner decides; any change specced.
- **Depends on:** 106. **Decision needed:** keep, reprice monthly, or a
  provisional-season pass.
