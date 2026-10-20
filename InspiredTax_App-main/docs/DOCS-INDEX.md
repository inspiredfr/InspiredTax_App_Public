# Documentation register

Which documents are **core**, what each holds, when a session reads it, who
keeps it current, and how it is audited. Read this file only when adding,
retiring or auditing documentation — `CLAUDE.md` carries the reading map a
normal session needs.

Established by the docs audit of 2026-10-04 (`docs/PROGRAMMES.md` P29), which
re-verified every core document against git history, PRs and `src/`.

---

## 1. Principles

1. **Code first.** `src/`, `tests/` and the tools are the truth. A document
   that disagrees is corrected from the code, never the reverse.
2. **One home per fact.** Each kind of information has exactly one document
   (§3). Others point to it; they do not restate it.
3. **Open vs history.** Open work lives only in `BACKLOG.md` (detail) and
   `STATUS.md` (priority summary). History lives only in `CHANGELOG.md`
   (user-facing), `docs/PROGRAMMES.md` (programme record) and `git log`.
4. **Verified or labelled.** A status claim names its evidence (commit, PR,
   gate run, date) or says *owner-reported* / *not verified*.
5. **Cheap to start.** Session-start reading is `CLAUDE.md` only (it is loaded
   automatically). Everything else is read on demand, by task.
6. **Retire, don't accumulate.** When a programme closes, its working
   documents are summarised in `docs/PROGRAMMES.md`, open residue moves to
   `BACKLOG.md`, decisions to `docs/DECISIONS.md`, and the folder is deleted.
   Git keeps the originals.

## 2. Core documents

Read cost, 2026-10-04 (KB; ≈ 250 tokens per KB): `CLAUDE.md` 9 · `STATUS.md`
4.5 · `BACKLOG.md` 11 · `RELEASE.md` 16 · `PROGRAMMES.md` 24 · `DECISIONS.md`
16 · `ARCHITECTURE.md` 11 · `DESIGN-SYSTEM.md` 12 · style guide 16 ·
`ANDROID.md` 13 · `DEVICE-CHECKS.md` 14 · `CHANGELOG.md` 98 (history — read
only the section you need). The audit cut the repo's Markdown/text from 3.2 MB
to 0.53 MB. Keep `CLAUDE.md` under ~10 KB and `STATUS.md` under ~6 KB — they
are the start-of-work reads.

| Document | Contains | Read when | Maintained by / when |
|---|---|---|---|
| `CLAUDE.md` (auto-loaded) | Hard rules, working rules, gates, architecture in brief, document map, change process, closing rule | Every session (automatic) | Any session that changes a rule, a gate or the document map |
| `STATUS.md` | Current build, verified gate results, what no gate covers, open items in priority order, watchlist | Picking up open work; before a release | Every PR that changes the version, gate results or what is open. **Its `**Version**` bullet is machine-read** (`tools/status-version.js`) |
| `BACKLOG.md` | Every open item: an index in execution order, then one block per item with fixed fields (state, what and why, files, done when, depends on, decision needed); launch steps; deferred and optional items. Its header states the rules (permanent IDs, next free ID, states) | Picking up specced work | Whenever an item opens, changes or closes (delete the block and index row when done) |
| `CHANGELOG.md` | User-facing release notes per version (becomes Play "What's new") | Writing release notes; history | Every user-visible change, under `[Unreleased]`; `release:bump` dates it |
| `RELEASE.md` | Release runbook — automated workflow and manual loop, troubleshooting | Cutting a release | When the release tooling or workflow changes |
| `docs/PROGRAMMES.md` | Every programme/QA round: scope, PRs, versions, outcome, open residue pointer | History questions; opening or closing a programme | When a programme opens or closes |
| `docs/DECISIONS.md` | Standing owner decisions: scope, tax, accounts/backup, UX/design | Before building in an area; when unsure what the owner wants | In the PR that records a decision or reversal |
| `docs/DOCS-INDEX.md` | This register | Adding/retiring/auditing docs | When the core set changes |
| `docs/product/ARCHITECTURE.md` | Deployment, module map, state and persistence, engine, gates, release pipeline | Module-structure work; a new tax year; a new gate | When modules, state shape, persistence or gates change |
| `docs/product/DESIGN-SYSTEM.md` | Tokens, principles, standards, guidelines, enforcement, known deviations | Any UI or visual work | When tokens or a design rule change |
| `docs/product/UX-WRITING-STYLE-GUIDE.md` | Copy voice, tense, patterns, spelling | Writing user-facing copy | When a copy rule changes |
| `docs/product/MESSAGING.md` | Positioning, approved claims with evidence, claims we do not make, boilerplate, pitches, sales-kit formats, where every description lives | Writing any description of the app (Play, About, site, comms, pitches) | When a feature, price, permission or tax year a claim rests on changes — then every surface in its §9 |
| `docs/product/DEDUCTION-PILL-TRIGGERS.md` | The Recommended/Consider pill rules, mirrored from `INCOME_DEDUCTION_LINKS` | Changing deduction recommendations | With any change to `INCOME_DEDUCTION_LINKS` or `deductionRecommendationFor()` |
| `docs/android/ANDROID.md` | Capacitor wrap, native integrations, build, signing, device QA, Play Console checklist | Android or native work | When the native project, plugins or signing change |
| `docs/android/CLOSED-TESTING.md` | Recruiting testers and running the 14-day closed-testing period | Play Console closed testing | When Play's rules or the Console steps change |
| `docs/android/DEVICE-CHECKS.md` | Every owner device check: build/capture method, checklists, results table | Shipping a native/WebView-dependent change; owner device sessions | Session adds cases; owner records results; next session prunes passed rows |

**Supporting documents** — accurate as of 2026-10-04, read only for their
specific task:

| Document | Purpose |
|---|---|
| `docs/programmes/monetization/00-DESIGN.md`, `02-BILLING-PLUGIN.md`, `04-TRIAL-ANCHOR.md` | Live entitlement design and native plugin contracts (cited by Java and JS) |
| `docs/programmes/play-store-launch/03-STORE-COPY.md` | Store listing and Data safety answers as submitted |
| `docs/programmes/closed-testing-2026-10/FEEDBACK-LOG.md` | Closed-test feature tasks and de-identified feedback log; source of the production-access answers. Retired at production access |
| `.claude/skills/tester-feedback/SKILL.md` | How a session triages a tester's feedback into the log, BACKLOG and a reply. Retired with the log |
| `docs/programmes/qa-remediation-2026-09/07-COPY-DECK.md` | Copy awaiting owner review; where new copy is drafted (QD-16) |
| `docs/programmes/user-needs-2026-10/` | Expanded personas, live-app assessment, suggestions with owner decisions, SARS market evidence, competitor research spec, implementation spec B0–B6, PAIA draft. Start at `00-README.md` |
| `docs/programmes/calc-audit-2026-09/test-fixtures.md` + `run-audit-fixtures.js` | Scenario list and fixtures loaded by `tests/run-debug-harness.js` |
| `docs/reference/README.md` | What the generated references are and how to regenerate them |
| `docs/reference/render-path-inventory.md` | Which component category each card, hero, row, pill and chip belongs to; the uncategorised ones and proposed homes (BACKLOG 23, 2026-10-15) |
| `docs/reference/removal-inventory.md` | Every abandoned, declined or deferred item: removed (with batch) or kept as a live feature or scope statement (BACKLOG 93, DECISIONS FARM-2, 2026-10-17) |
| `docs/reference/itr12-code-audit.md` | ITR12/IRP5 SARS-code coverage: what was fixed, what is open (with citations), what was checked (BACKLOG 24, 2026-10-15) |
| `docs/reference/glob2-residual-proposal.md` | Statutory figures typed outside the inline-figure lint's reach: what was fixed, and the keep/convert proposal per string (BACKLOG 25, 2026-10-16) |
| `docs/reference/risk2-field-list.md` | eFiling-sourced (third-party pre-filled) fields for the Risk Assessment multi-select, and the no-source fields flagged automatically — draft (BACKLOG 22, 2026-10-17) |
| `docs/reference/b8-home-office-period-draft.md` | Home office used for part of a year: IN28's no-time-apportionment rule, what the app does, options and copy — draft (BACKLOG 37, 2026-10-17) |
| `tests/legislative/README.md` | How to write a legislative fixture |
| `bench/README.md`, `bench/BENCH_SPEC.md` | Verification bench |
| `tools/decision-studio/README.md` | Onboarding decision-model tool |
| `vendor/README.md` | Vendored assets and how to regenerate them |
| `assets/branding/README.txt`, `assets/branding/brand/BRAND_PALETTE_LOGO_DIRECTION.md` | Brand asset map and logo direction |
| `_mockups/README.md` | Prototype lifecycle |

**Generated or machine-read — never edit by hand:** `docs/reference/app-atlas.*`
(`npm run gen:atlas`), `docs/reference/inline-figures.md`
(`node tools/lint-inline-figures.js`), `docs/reference/modal-inventory.md`
(`node tests/modal-inventory.js`), `src/js/99-window-bridge.js`
(`npm run gen:bridge`), `bench/bench.html` (`npm run build`, which also rebuilds it),
`tests/expected.json` (`npm run test:update`, justified line by line).
Hand-authored but machine-checked: `docs/reference/decision-model.json`
(`npm run check:decisions`), `docs/reference/engine-blueprint/*.json`
(`tests/check-constants.js`, `run-legislative.js`).

## 3. Where each kind of information goes

| You have… | It goes in | Not in |
|---|---|---|
| A new open item, defect or follow-up | `BACKLOG.md` (+ one line in `STATUS.md` if it changes priorities) | A programme doc, a code comment alone |
| An owner decision or reversal | `docs/DECISIONS.md` | Only the PR description |
| A user-visible change | `CHANGELOG.md` `[Unreleased]` | — |
| A finished batch or programme | `docs/PROGRAMMES.md` | A new standing doc |
| A device check the owner must run | `docs/android/DEVICE-CHECKS.md` | `STATUS.md` prose only |
| A design token or rule | `src/styles/main.css` + `docs/product/DESIGN-SYSTEM.md` | — |
| A rule every session must follow | `CLAUDE.md` | — |
| A large programme's working plan | A new `docs/programmes/<name>/` folder while it runs; retired at close (§1.6) | Root-level files |

## 4. The closing update (every operation)

`CLAUDE.md` requires every PR, batch, stage or session to end by updating the
documents its work touched. Checklist:

1. `BACKLOG.md` — add what was found; delete what was finished.
2. `STATUS.md` — version, gate results with date and commit, open-item order.
3. `CHANGELOG.md` — user-visible changes under `[Unreleased]`.
4. `docs/DECISIONS.md` — any decision taken or reversed.
5. `docs/PROGRAMMES.md` — the batch/programme row and outcome.
6. `docs/android/DEVICE-CHECKS.md` — new device cases.
7. `ARCHITECTURE.md`, `DESIGN-SYSTEM.md`, `ANDROID.md`, `RELEASE.md`,
   `CLAUDE.md` — if the thing they describe changed.
8. Regenerate generated references the change affects (atlas, bridge,
   inline-figures).

A docs-only change still runs CI (`check:version` reads `STATUS.md` and
`CHANGELOG.md`): keep the `**Version**` bullet's format and the
`## [Unreleased]` heading intact.

## 5. Audit

**When:** at every minor release, at a programme's close, and whenever a
session finds a document contradicting the code.

**How:**

1. `git fetch origin`; work from `origin/main`.
2. For each core document, check every factual claim against `src/`,
   `git log`, merged PRs and a fresh gate run — not against another document.
3. Run the drift checks: `npm run check:version`, `npm run check:atlas`,
   `npm run check:bench`, `npm run check:decisions`,
   `node tools/lint-inline-figures.js` (diff the output).
4. Grep kept documents for paths that no longer exist and for retired IDs.
5. Record the audit as a row in `docs/PROGRAMMES.md` and its findings in
   `BACKLOG.md`.

## 6. Retired documents

Removed on 2026-10-04. Every path below is readable with
`git show 15a9d6e:<path>`; code comments that cite them resolve the same way.

| Retired | Now covered by |
|---|---|
| `docs/programmes/{engine-remediation,coverage-gap-analysis,citation-audit,simplification,login-onboarding-ux-2026-09,ui-ux-polish-2026-09}/` | `docs/PROGRAMMES.md`, `docs/DECISIONS.md`, `BACKLOG.md` |
| `docs/programmes/qa-remediation-2026-09/` (all but `07-COPY-DECK.md`; evidence moved to `docs/reference/`) | `docs/PROGRAMMES.md` P27, `docs/android/DEVICE-CHECKS.md`, `docs/DECISIONS.md`, `CLAUDE.md` working rules |
| `docs/programmes/calc-audit-2026-09/01–07` | `docs/PROGRAMMES.md` P26, `BACKLOG.md` |
| `docs/programmes/monetization/01-SPEC.md`, `03-HANDOVER.md`, `05-SIGNIN-TROUBLESHOOTING-COMPENDIUM.md`, `06-SIGNIN-AI-HANDOVER-BRIEF.md`, `mockups/` | `00-DESIGN.md` (kept), `docs/android/DEVICE-CHECKS.md` §1 |
| `docs/programmes/play-store-launch/` (all but `03-STORE-COPY.md`) | `BACKLOG.md` Launch, `RELEASE.md`, `docs/DECISIONS.md` |
| `docs/product/DESIGN-SYSTEM-AUDIT-2026-09.md`, `OWNER-DECISIONS-2026-09.md`, `DESIGN-HANDOVER.md` | `docs/product/DESIGN-SYSTEM.md`, `docs/DECISIONS.md` |
| `docs/product/QA-2026-08-*.md`, `BACKUP-DRIVE-PLAN-2026-09.md`, `ONBOARDING_SYSTEM_SPEC.md`, `TEST_PERSONAS.md`, `SESSION_KICKOFF_PROMPT.md`, `REPO_READINESS_REVIEW_PROMPT.md` | `docs/PROGRAMMES.md`; the App Atlas for onboarding; legislative fixtures for test cases |
| `docs/android/ANDROID_HANDOVER_PLAN.md`, `ANDROID_UX_REVIEW.md` | `docs/android/ANDROID.md`, `docs/PROGRAMMES.md` P7 |
| `docs/design-handoff-2026-08-30/`, `docs/design-handoff-qa-2026-08/`, `_mockups/*` (prototypes) | Built; `docs/PROGRAMMES.md` P17, P20, P21 |
| `docs/reference/engine-blueprint/{ENGINE_BLUEPRINT,SPEC,TEST_AUTHORING_GUIDE}.md`, `io-catalogue.csv`, `docs/reference/engine-pilot/` | `docs/product/ARCHITECTURE.md` §4, `tests/legislative/README.md` |
| `docs/archive/`, `docs/research-notes/`, `docs/*.txt`, `testing/espresso-automation/`, `.design-sync/` | Obsolete inputs, prompts and tooling notes; no replacement |
