# Changelog

Product, engineering and support-relevant changes for release history.
User-facing changes are also distilled into the Play Store release notes.
Internal implementation details, test infrastructure and documentation-only
changes are included where they materially affect release, support or
maintenance; see `git log` and `STATUS.md` for the complete engineering history.
Documents cited by entries before 2026-10-04 may since have been retired; read
them with `git show 15a9d6e:<path>` (`docs/DOCS-INDEX.md` §6).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Removed items deleted, not hidden (BACKLOG 93, DECISIONS FARM-2)

- **Removed: the income-protection deduction page.** Premiums have not been deductible since 2015; the page, its tip and the hidden field the calculation still read are gone. Code 4018 on an IRP5 is still refused with the reason.
- **Removed: the five old crypto categories on Other receipts** (mining, staking, airdrops, DeFi, other) — crypto has its own page. A receipt saved under one of them loads as *Other*, with its amount still taxed.
- **Fixed: Tax Facts left out facts that apply to you.** It tested income-type answers the app stopped producing, so the provisional threshold never showed for a business, rental, crypto or other-receipts user, and the interest exemption, CGT and foreign facts showed only once something was captured. It now follows your income types.
- **Removed: the Vehicle asset type under Tools.** A vehicle is claimed under Travel or with your business. A vehicle asset saved by an earlier build is dropped when your data loads or is imported, so the same vehicle cannot be claimed twice.
- **Removed: the unused Trust income category** and its *Phase 2* tile styling. The *Other receipts* tip now says trust distributions, like farming, are not covered by this app.
- **Removed:** the partnership income subtype (it had no capture path; the *Other receipts* tip still says where a partnership share goes), a duplicate-income warning that could no longer fire, and a pre-2001 example in the CGT note.
- Internal: `docs/reference/removal-inventory.md` lists every removal candidate with its decision. `incprotDed` leaves `calcFullTax()` (golden: 26 `incprotDed: 0` leaves deleted, no figure moved). Smoke `removed-items` and `tools-list`. The `retired` scenario gate is gone with its last user; `decision-model.json` drops the trust topic and divergence D4.

### Provisional tab works from what you captured (BACKLOG 87, DECISIONS PROV-1)

- **Fixed: with a salary and PAYE captured but no months planned, the Provisional tab projected only your other income** — PAYE R 0 and a payment recommendation that could be a fifth of what was owed. Until you plan a month or add a lump sum, it now projects from the salary, PAYE, retirement contributions and deductions you captured, spread over the year, and says so. Nothing is saved into your plan until you edit it.
- Internal: `capturedPlan()` is the one source for *Pre-fill from actual* and the new `effectivePlan()`, which `calcCurrentYear()`, the chart and the provisional forecast read. Smoke `prov-captured`. Copy C-107.

### Costs on royalties and other receipts; farming removed; hidden chooser tiles really hide (BACKLOG 63, 38, 92)

- **New: royalties and "something else" receipts take costs** — agent or publisher fees, professional fees, materials and so on. The usual lines are already there; the costs come off the amount that is taxed, down to nil at most (a business making a loss belongs on the Business page). Recoveries, maintenance and settlements take no costs.
- **Removed: farming.** The app does not handle farming income, and says so on the *Other receipts* income type. The farming receipt kind is gone, and a farming receipt saved by an earlier build is dropped when your data loads or is imported (DATA-1). (BACKLOG 92, DECISIONS FARM-2)
- **New: costs above the amount received get a note** saying they are not deducted here and that a business making a loss belongs on the Business page.
- **Changed:** the line under the receipt category that repeated the tile you had just picked is gone.
- **Fixed: a chooser tile that should be hidden still showed** — for example a foreign kind after you told us you have no foreign income in that category. The tiles were marked hidden, but the styling overrode it.
- Internal: `OTHER_RECEIPT_COST_KINDS` and `OTHER_RECEIPT_COSTS` (`01-data.js`), `otherReceiptCosts()` (`02-core.js`) used by `calcFullTax()` and the list; the cost-row builder (`addCostRow`, `collectCostRows`) moved from `06-crypto.js` to `05-list-modules.js` and serves crypto and other receipts. `.kind-tile.u-hidden` CSS rule. Saved farming receipts are filtered in `hydrateFromData` (load and import). Legislative fixture TC-023 (gross R113,000 → taxed R90,000); smoke `other-receipts`. Copy C-105, C-106.

### Crypto costs start with the usual lines (BACKLOG 44, DECISIONS OI-B6a)

- **Changed: both crypto cost lists now open with the costs you most likely have**, as rental and business already did — an investment sale starts with the exchange and network fees, a trading sale adds trading software, mining income starts with electricity, pool fees and hardware, staking with validator and hosting costs. The next few are one-tap chips under them; *Another cost* gives the full list. Lines you leave at R 0 are not saved. Switching between investment and trading, or changing the income type, swaps the starting lines only while you have typed nothing in them.
- Internal: `USUAL_COSTS.crypto` (`01-data.js`); `costRowsUntouched`, `costChipsHtml` and `renderCostChips` (`05-list-modules.js`) now serve all four lists. The *+ Add cost* / *+ Add expense* buttons are gone (the chips' *Another cost* replaces them). `assertCaptureKinds` (e) covers both crypto lists. No new copy.

### Retirement limit warning, RA-room saving, last year of a car's write-off (BACKLOG 88, 91)

- **Fixed: the warning for retirement contributions above the yearly percentage limit never showed.** The limit was compared as 2750% instead of 27.5%. It now shows, with the amount carried forward to next year.
- **Fixed: the Retirement cap meter's tip read *Cap (2750.0%)*.** It reads the year's percentage.
- **Fixed: the *RA top-up capacity* tip overstated the saving** when the unused room crossed a tax bracket — it priced all of it at your top rate. It now comes from the tax calculation, the same way as the RA analyser.
- **Fixed: a car's wear and tear in the last year of its write-off period was a full year's amount.** It is now cut to the months left, as tools already were.
- Internal: `writeOffMonthsInTaxYear()` (`01-data.js`) is the one write-off window for vehicle and tools wear and tear; `calcToolItemWt` moved onto it unchanged (checked date for date over 2017–2028, lives 1–6, SAST and UTC). `taxWithMoreRetirement()` (`09-projection.js`) serves the RA analyser and the tip. The dead `updateRetirementCapText()` is gone. Smoke `ra-room` and `date-checks` cover each fix. Copy C-104.

### Car wear and tear: first used on the last day of February (BACKLOG 90)

- **Fixed: a car first used on the last day of the tax year got no wear and tear.** The date was read as midnight in UTC, which is 02:00 in South Africa, so it counted as after the year end. It now gets one month, like any other date in February.
- **A travel *date brought into use* after the tax year is refused**, as for tools. Before, the deemed-cost method gave the full year's fixed cost for it.
- Internal: `monthsInTaxYearFrom(date, key)` (`01-data.js`) is the one month-count for the deemed fixed cost and vehicle wear and tear, reading the date as text with the year end from `taxYearDates` (29 February counts in a leap year — both paths typed 28 February). Smoke `date-checks` part `car date` (fails on the build before). Copy C-103. Found on the way: BACKLOG 91.

### Dates outside the tax year are caught on capture (BACKLOG 42, DECISIONS OI-B5)

- **A lump-sum date outside the tax year you are capturing is now refused**, with the year's dates in the message. The date decides the order lump sums are taxed in, so a mistyped year changed the tax.
- **A tools *brought into use* date after the tax year is refused** — it gave R 0 wear and tear with no sign why. A date before the year is still allowed: that is an item you are still writing off.
- **A two-pot withdrawal date outside the year shows a warning** but can be saved; the tax does not use it.
- Internal: `taxYearDates(key)` (`01-data.js`) gives a year's first and last day (28 or 29 February); three `FIELD_CHECKS` rows; a row's new `level: 'warning'` makes a `check` non-blocking. Smoke `date-checks` (fails on the build before). Copy C-102.

### Lump-sum tax card opens even when no tax is due (BACKLOG 43, DECISIONS OI-B3)

- **The Lump-sum tax card now opens whenever you captured a lump sum**, even when the tax on it is R 0. It shows what you received before this year, this year's lump sums and relief, the running total, the non-deducted contributions still to carry forward, and how much of the tax-free retirement amount is left.
- Internal: `walkLumpsums()` returns `retirementTaxFreeRemaining` (the retirement table's zero-rate band, read from `TAX_YEARS`, less the lifetime pool), carried through `calcFullTax()`. `assertTaxCards` names the card as the exception to "a R 0 card does not open" and adds a R 0 lump-sum case. Copy C-101.

### Real store screenshots, site clips, no gap under the tax-year bar (BACKLOG 86)

- **Fixed: scrolling showed a strip of the page between the tax-year bar and the page heading.** The bar ignored the top safe-area inset, so it slid under the app header and left a gap of about 24px (device check D27).
- **Store listing:** eight new screenshots from the current app with one made-up person's figures (DECISIONS MSG-5), alt text for each, and a new feature graphic, the *deadline* design (DECISIONS MSG-6); the July set showed 2025/26 and the citations OD-16 removed, and the July feature graphic repeated the app icon, which Play does not allow.
- **Support site:** the phone screens on inspiredtax.co.za play short clips of the app's own animations (the figures counting up, the rings filling), with the still as a poster for browsers that cannot play them or visitors who prefer reduced motion.
- Internal: `tools/store-shots.js` rewritten on the golden suite's sign-up and scenario loader, with `--clips` recording the site's clips frame by frame on Playwright's clock (`bootAndUnlock` takes `clockTime`); `APPLY_SCENARIO` moved from `tests/run-tests.js` to `tests/harness.js` (one loader, WR-8); `bootAndUnlock` takes optional context options, display name and an init script. New smoke checks `assertStickyStack` (fails on the old CSS) and `assertRaRoomFromEngine`, which guards the *Ways to pay less* RA tip when taxable income exceeds salary — the fix itself landed with BACKLOG 25 (#433), which also carries the analyser check. Found on the way: BACKLOG 87 (the Provisional tab ignores captured salary until the forecast is prefilled) and 88 (an s11F percentage shown as 2750%).

### One description of the app everywhere (DECISIONS MSG-1 to MSG-4, BACKLOG 84)

- **Changed: the About screen now says the app works out what to pay at each provisional tax deadline**, and says it works on each year's SARS tables rather than "the same way SARS does". The Tax return page's intro says the same (copy C-94).
- Internal: `docs/product/MESSAGING.md` is the one source for every description of the app — positioning (people who work out their own tax), approved claims with the code behind each, claims we do not make, boilerplate, pitches and the sales-kit formats. The Play short and full description in `03-STORE-COPY.md` are rewritten from it (C-95, not yet pasted into Console); the support site is rewritten on a branch (C-96, BACKLOG 84). Found on the way: the site's home page lost eight sections to an unrelated commit on 2026-10-07, and four site articles show 2025/26 tables as 2026/27 (BACKLOG 85).

### Retirement top-up and donations figures now come from the tax calculation (BACKLOG 25)

- **Fixed: the retirement-annuity top-up calculator showed the wrong limit and the wrong tax saving** for anyone with more than a salary. It took 27.5% of IRP5 income and rebuilt your tax from that, so rental, business, investment income and capital gains were missing and a lump sum counted as pay. With a lump sum in the year it could show a *negative* saving. It now uses the same limit and tax calculation as the rest of the app, including the donations limit and the medical credit, which both move when your taxable income does.
- **Fixed:** the *RA top-up capacity* tip used the same wrong limit; the *Section 18A donations* tip and the donations risk check measured the limit against income after donations instead of before; the medical-credit tip quoted an old year's amount.
- Internal: `calcFullTax()` returns `medInputs` (the medical answers behind the credit); `analyseRA()` works from `retMax`, `retTotal + pyRetExcess`, `tbd` and `donTotal`, and takes every result as a difference from the unchanged year. Smoke `ra-analyser`. Keep/convert proposal for the remaining typed percentages: `docs/reference/glob2-residual-proposal.md`. Copy C-98.

### Long service awards: the tax-free part is no longer taxed (BACKLOG 80)

- **Fixed: a long service cash award (IRP5 code 3622) is no longer taxed in full.** The first R5,000 of a qualifying award (15 unbroken years, then each further 10) is not income — the Income Tax Act's "gross income" definition, paragraph (c) proviso (vii), since 1 March 2022. Your IRP5 shows the full award, so the app now takes the tax-free part off itself, from both your taxable income and the remuneration your retirement-contribution limit is based on. The code's tip no longer quotes a figure.
- Internal: `TAX_YEARS[y].longServiceAward.exclusion` (2025–2027) with the statutory citation; `longServiceAwardExcluded()` (`02-core.js`) read by `calcRemunerationBase()` and `nonTaxableTotal`; legislative fixture TC-022; Act 20 of 2021 added to `docs/reference/sars-sources/`. Copy C-93.

### One number per item across parallel sessions (DECISIONS ID-1)

- Internal: `npm run next:id` (`tools/ids.js next`) fetches origin and reads every pushed branch before naming the next BACKLOG item, copy row, device check and programme record; `npm run check:ids` (in pretest, so in CI) fails on a duplicate in any of the four, a stale *Next free ID* or an index row with no block. Added after #426 and #427 both took BACKLOG 78 and copy C-88. Test `tests/ids.js`; the check fails on `main` @ `82e6fc2`, the collided tree.

### ITR12 code audit — two tax fixes (BACKLOG 24)

- **Fixed: PAYE and other IRP5 deductions-block codes no longer come off your income as "Other claims".** Choosing PAYE (4102), a retirement contribution (4001–4007), medical aid (4005/4474), a donation (4030) or income protection (4018) on the Other claims sheet used to deduct the full amount from taxable income — PAYE twice over, the others past their limits or as a deduction instead of a credit. The sheet now refuses those codes and says where each belongs; the engine ignores them if one is ever present. Code 4042 (salary or a restraint-of-trade amount paid back to your employer) is the one IRP5 code still claimed there.
- **Fixed: a foreign-service bonus (3655) or commission (3656) on its own now opens the foreign-employment exemption question** (s10(1)(o)(ii)). Before, only a foreign salary (3651) did. The exemption note now names codes 3651/3655/3656.
- The Other claims example no longer suggests income protection premiums, which have not been deductible since the 2016 tax year.
- Internal: gap list with a primary-source citation per gap, `docs/reference/itr12-code-audit.md`; one foreign-service code set (`FOREIGN_SERVICE_CODES`) replaces five hand-typed lists; `DEDUCTION_CODE_ROUTES`/`deductionCodeRoute()` in `01-data.js`; smoke checks `foreign-service-codes` and `deduction-code-routes`. Open gaps are BACKLOG 80 (long-service award R5,000 exclusion), 81 (IRP5 codes with no capture path) and 82 (foreign-service allowance/fringe variants).

### Render-path inventory (BACKLOG 23)

- Internal: `docs/reference/render-path-inventory.md` maps every card, hero, row, pill and chip class to OD-1's six component categories, lists the uncategorised ones with a proposed home, names three recurring groups the six do not cover, and orders six consolidations by reach. No code change; the owner's calls are BACKLOG 79.

### Data from earlier versions is no longer upgraded (BACKLOG 78, DECISIONS DATA-1)

- **A backup from an earlier version that this version cannot read is refused** with a clear message, and your current figures stay as they are. Testers start fresh rather than restoring an 8.36.0 or older backup.
- Internal: removed the V8.2 plaintext/PIN-setup migration (a registry record without a PIN is refused at login; a plaintext data blob is never loaded), plaintext-PII sealing at unlock (`_migrateUserPii`), the T-C2 `py_s10c_bal` merge, `INCOME_TYPE_MIGRATION` (and the atlas's migration table), `migrateTfsaCertificates` with `tfiMovedCount` and its note, the rental individual-field format in `M_rental.onLoad` and `calcRentalNet`, `migrateRoundAllNumericInputs`, `loadUserData()` and `CODE_MIGRATION`. `importDataFromJson` refuses `dataSchema` older than `DATA_SCHEMA_VERSION`. Smoke: `assertOlderImportRefused` replaces `assertTfsaMigration`; `assertNameSealed` checks the no-PIN refusal instead of the plaintext reseal — both fail on the 8.36.0 build. Copy C-89, C-90.

### Share the app on WhatsApp (BACKLOG 83)

- **New: *Share InspiredTax*** in the menu and in About opens WhatsApp with a short message and the link inspiredtax.co.za/get, ready to send to whoever you choose. Nothing about you or your figures goes into it.
- Internal: `APP_SHARE_URL` / `APP_SHARE_MESSAGE` (`01-data.js`) and `shareApp()` (`02-core.js`). The link is the website's `/get`, never a Play URL, so the move from closed testing to production is a website change, not an app update (DECISIONS SHARE-1). Smoke `assertShareApp` (fails with the link pointed at Play). Copy C-88 and device check D26 pending (WR-3).

### Atlas claims checked in CI (BACKLOG 77)

- Internal: `tests/verify-atlas.js` failed *step 2: one income source passes* because its probe asked step 2 to continue before answering the foreign-income and scenario questions, which AUD-1/C-57 made required — the probe, not the app, was out of date. It now answers them, and a new assertion holds the rule (sources picked, questions open: blocked). `npm run verify:atlas` exits 0 and is a CI step.

### No earlier-version data carried (DECISIONS DATA-1)

- Internal: the owner's DATA-1 (every profile starts fresh in the next build): the earlier-version ring-fenced balance (`py_ringfence_loss`, its Tax balances notice C-87, `APP.ringfenceLossLegacy`) and the rental s20A answer passthrough are removed. Smoke `assertRingfenceRetired` (b) now holds that no such balance is saved. Copy C-84–C-86 approved (COPY-5).

### Fixes from the owner's 8.36.0 check on Play (G2)

- **Saving a backup to Drive or Files no longer reads as "Backup not saved".** Android reports a save through those two as cancelled, so the app could not tell it from closing the share screen. When Android cannot say, the app now asks *Is your backup saved?* — *Yes* records the backup and *Last manual export*; *No* (or going back) shows *Backup not saved* as before. The CSV summary asks the same (owner's choice, DECISIONS EXP-1).
- **Onboarding says why a step will not continue.** The *Please answer: …* message (and the other onboarding prompts such as *Please select at least one income source.*) appeared behind the onboarding screen, so a blocked step gave no reason. It now shows above it.
- **Onboarding's last step shows Tax balances at the right size.** The *Tax balances* answers (and *None selected*) are small pills again, not oversized text; *None selected* no longer spills out of a tiny square.
- **Confirm dialogs lose an empty bar** that showed above the buttons whenever there was no consequence to state; the rental property sheet loses an empty gap above its expenses.
- Internal: `.toast` z-index 500 → 1300 (above the onboarding overlay and the help sheet, below the unlock overlay); the never-visible first-run toast *Welcome! Let's set up your tax profile.* is removed (C-83). `.profile-chip[class*="ico-bg-"]` takes back the pill's type and box from the universal icon-tile rule, which since UI-FS-1 sets the tile's own font-size. `showConfirm` gains `opts.onCancel` (fired from `closeModal` on every close but the action button) and an `export` tier; `_askIfSaved()` in `02-core.js` (copy C-81, C-82). `.confirm-consequence[hidden]` and `.note-line[hidden]` restore `display: none`. New smoke checks `assertObSummaryChips`, `assertToastAboveOverlay` and `assertHiddenStaysHidden`; `assertExportOutcome` answers the question (Yes, No, back) — each fails on `main` @ `d7d6f57`. Device re-runs D16 and D20 pending (WR-3).

### Copy review (owner, 2026-10-15 — DECISIONS COPY-4)

- **Income and Deductions count *items*, not *steps*,** under their Completed and Off headings.
- **No more typed capital-gains figures in the app's copy.** Nine notes and labels named the 40 % inclusion rate, and the crypto summary still said *R40,000 annual exclusion*, which is wrong for 2026/27 (the exclusion is R50,000). They now name the inclusion rate and yearly exclusion without a figure; the Taxation return line and income hero read *Capital Gains*.
- **Clearer wording in six places:** the small-tool message points to *Change* (the asset-type select it named is gone); the movables sale tile says it is *taxed only if you used it mainly for work*; the other-receipts capital option reads *Capital — goes to capital gains*; the welcome dialog says core tools *stay free* (it promised *free forever*); three short notes (finance charges, code 3703, Tax Act references) say what they mean.
- **A new freelance business starts with a home-office cost line** instead of wear and tear (which moves to *Another cost*).
- Internal: `itemCount()` (`01-data.js`) replaces the two per-page `stepWord` helpers (WR-8). Copy deck rows C-44–C-83, the C-58 short lines and `USUAL_COSTS` marked reviewed. Not gated: no check scans copy for typed percentages outside `inline-figures` (BACKLOG 25).

### Reference checks that stay green (BACKLOG 15)

- Internal: `npm run build` also rebuilds `bench/bench.html`, and `build.js --check` (pretest) verifies it; `release:bump` moves `docs/reference/app-atlas.json`'s `modelFor` and re-renders the page; `gen-app-atlas.js` normalises en-ZA digit grouping (a reduced-ICU Chromium printed commas where a full-ICU one prints a no-break space, so two machines wrote different files); CI runs `npm run check:atlas`; the release workflow commits the bench and the atlas. Atlas regenerated (it gained the onboarding usual-share input from #390). `tests/release-tools.js` checks the bump and the workflow's commit list. Each check shown failing on a deliberate drift and passing after regeneration; a patch bump in a scratch copy keeps `check:atlas` green (OI-B1).

### Store-copy references (BACKLOG 49)

- Internal: `03-STORE-COPY.md` no longer sends readers to retired backlog rows. The non-affiliation disclaimer (retired C-E4, owner-approved 2026-07-08) is inlined verbatim in §4 — recovered from history, identical to the About dialog; C-E6 points at DECISIONS; the website line states the hosting instead of C-E7.

### Error messages look like errors (BACKLOG 76)

- **A message that stops you now shows the red error style**, not the blue information style — the onboarding *Please answer: …* prompt among them. Warnings (*Mark at least one month as Actual first*, a list editor's warning) show amber.
- Internal: `showToast(msg, icon, severity)` defaults the severity from the icon (`error` → error, `warning` → warning, else info), so the 18 calls that passed `'error'` as the icon alone, and the two passing `'warning'`, are styled by their meaning. Smoke (b4) asserts the onboarding toast's `data-severity` is `error` — it fails on the previous code.

### Verification bench works again (found by BACKLOG 15)

- Internal: `npm run test:bench` passed 0 of 8 personas. Three faults, fixed in order: the runner still read `_bench/` (renamed to `bench/`); `build-bench.js` did not define `__DEBUG_HARNESS__`, so the engine bundle threw before `window.ENGINE` existed; and five cross-module references had no import (hard rule 10), resolved in the app only through the window bridge's globals — `cgtAggregate` in `calcFullTax` (02-core), `cssColour` (10-current-year-planner, 11-historical), `TAX_YEARS` (11-historical) and `debounceSave` (12-bootstrap-onboarding). Now 8/8, and `test:bench` is a CI step (about 2 s). No behaviour change in the app: the bridge supplied the same functions.

### Report a problem (BACKLOG 67)

- **Menu → Report a problem** (and a link in About) opens Android's share screen with a ready message: a line for you to describe the problem, then the app version, Android and WebView versions, screen size and text size, theme, the page you were on, your access (trial, Premium or Basic) and the last few app errors. It holds no amounts and nothing from your profile; you choose WhatsApp or e-mail and see it before it is sent.
- Internal: `buildProblemReport()`, `reportProblem()` and `noteUncaughtError()` (`02-core.js`), a five-entry ring of uncaught errors and unhandled rejections (digits redacted, file:line:col kept), `SUPPORT_EMAIL` (`01-data.js`). Smoke `assertReportProblem` — fails with the redaction removed. Copy C-84 (owner review owed); device check D25. *Implemented, not verified* on a phone (WR-3).

### Tools navigate-away guard (BACKLOG 40)

- Internal: the stale *Unapplied changes on Tools* dialog after UI-CAP-1 was **test-only**. A sheet save re-baselines the page (`commitPending` → `snapshotInputs`); `assertToolsList` then wrote `APP.toolsWtItems` directly, which the guard correctly read as an edit. New smoke `assertToolsLeaveClean` adds and deletes an asset through the real UI and leaves the page: no dialog. It fails with `commitPending` removed from the CRUD save. Not bisected: the real-path check settles the question the bisect was for.

### Provisional-tax warning counts your PAYE (BACKLOG 26)

- **Fixed: the Tax risk assessment and the optimisation tips no longer warn a salaried provisional taxpayer of an underestimation penalty their PAYE already covers.** The para 20 test counts PAYE and provisional payments together, but these two places read PAYE from a field the app removed in V8.4 and counted R0. The Provisional tax page was not affected (it passes the PAYE itself).
- Internal: `calcProvisionalPenalty(r, opts)` defaults `payeTotal` to `r.payeDeducted`. The dead single-field path is removed: `gv('paye_deducted')` and `gv('uif_deducted')` (no element since V8.4 II.3) from the engine, the save/restore and close-out lists, `renderProvSummary()` (its `#prov-summary` host is gone) and its render-chain entry, and the test harnesses' `set('paye_deducted')` and the schema key. Engine check `prov_penalty_counts_engine_paye` — false on the previous code; `npm run test:update` added that one key and moved no existing value.

### Mascot reactions (BACKLOG 13)

- **The mascot no longer shakes its head at you when a warning appears by itself** — on first opening, after an import or a year switch. It still reacts when your own edit brings one up. And a reaction no longer cuts off half-way when the page redraws.
- Internal: `beginRenderPass()`/`endRenderPass()` (`02-core.js`) bracket `renderAll()`; `notePlausibility()` records a surface's first evaluation and anything inside a render pass silently. At the end of a pass `_katRestore()` puts a live reaction back on the rebuilt mascot with its animations offset by the time already run (`--kat-skip`, `main.css`), so it ends when it would have. Smoke motion (f) and (g) — each fails with its fix removed.

### Losses and ring-fencing (BACKLOG 16, 57)

- **Fixed: a business with costs but no income yet can be saved.** The sheet refused it — the income field would not accept R 0, and the confirmation it then asked for was hidden. Now R 0 is accepted and, when there is no income, the sheet asks *is this a business you are actively running to earn income?*; tick it and the record saves, its loss set against your other income.
- **Loss notes say plainly that the app does not apply s20A ring-fencing**, and when SARS could: only if your income before the loss reaches the top tax bracket, and the trade has lost money in 3 of the last 5 years or lets a home mostly to relatives. The old notes promised the app would work it out "yet" and left out the top-bracket condition. The *Ring-fenced losses* FAQ now explains the same.
- Internal: `RINGFENCE_ENABLED` and the dormant s20A code are deleted (`s20AThreeOfFiveYearsLoss`, `bizDetermineRingfence`, `rentalDetermineRingfence`, the exclusions, `APP.businessLoss`/`rentalRingfenceLoss`, the two hidden rental s20A inputs, `py_ringfence_loss` from the close-out carry list); last tree with them `3818366`. `py_ringfence_loss` now persists from `APP.ringfenceLossLegacy`. New field option `required:'zero-ok'` (R 0 is an answer) on `biz-income`. The dead `renderCarryForwardSummary()` (no `#cf-summary` host) is removed. *Excess s18A donations* no longer types "10%". Smoke `assertRingfenceRetired` (fails on the previous build: hidden confirmation, no save, value dropped); the s20A copy checks; the A5 engine checks now assert "not ring-fenced" without the flag; atlas regenerated; `mutation-check.js` W5 mutation follows the new code. Copy C-85–C-87.

## [8.36.0] — 2026-10-15

### Google sign-in on the current Google API (BACKLOG 75)

- **Starting the free trial asks Google for less.** The sign-in now uses Google's current authorization API: you pick the account and allow access to the app's own hidden Drive folder, and the app no longer asks for your e-mail address.
- Internal: `GoogleDrivePlugin` authorizes with Identity Services `AuthorizationClient` (play-services-auth 22.0.0, which drops the legacy `GoogleSignIn` API); the consent screen goes through Capacitor's activity-result bridge; a Drive 401 clears the token and authorizes once more; CloudBackup reads the bound account's e-mail from Drive (DECISIONS AUTH-2). JS contract unchanged; `tests/cloud-backup.js` §11 pins both plugins. Device checks D24, D1–D15 and C1–C13 pending (WR-3).

### Purchases send no identifier (BACKLOG 33)

- **A purchase no longer sends Google Play an identifier for your installation.** Earlier builds attached a scrambled random install ID (`obfuscatedAccountId`) that Google could use against fraud; it is gone, so the Play Data safety answer "no data collected" is exactly true (DECISIONS DS-1). The privacy policy drops its sentence about it when this build is on the closed track (site PR #23).
- Internal: `_obfuscatedAccountId()` removed from `14-entitlement.js` and the pass-through from `PlayBillingPlugin.java`; `tests/entitlement.js` 17m fails if either side sends an identifier again.

### Copy that says only what is true (BACKLOG 74)

- **The welcome screen offers the 7-day free trial** instead of saying you already have Premium before sign-in has started it.
- **Go Premium:** the launch plans' ribbon reads *LAUNCH PRICE* (it claimed a subscriber count the app does not keep); the line under the purchase button links the Terms of Service and the Privacy policy; the payment-retry banner no longer names a number of days.
- **About, FAQ and Terms** no longer say nothing is ever sent anywhere, or mention browser storage: your tax figures are never sent to us; Google is contacted only for the trial and purchases; Android's own backup may copy an encrypted snapshot to your Google account; the snapshot is protected by a key made from your PIN (a longer PIN is stronger).
- **Terms of Service** gain a *Subscriptions and the Free Trial* clause (billing by Google Play, renewal and cancelling, prepaid plans, refunds, what happens to your data).
- Internal: the welcome title, body and button read `ENT_TRIAL_DAYS`; `LAUNCH_OFFER_SUBSCRIBER_CAP` removed (D-M5 amended); smoke `assertTruthfulCopy` keeps the retired claims out (fails on the previous tree). Play listing and release-note drafts corrected in `03-STORE-COPY.md` (not affiliated with SARS and "most features need Premium" up front, Airbnb, no "exactly" or "save on your tax", an accurate uninstall line; first-release notes 477/500 characters). Website (site PR #22): privacy policy sections on Google sign-in, purchases, identity details and deletion (`#delete`), a subscriptions clause in the terms, and one contact address, inspiredfr@gmail.com (C-E6). Copy deck C-76–C-80.

### Launch polish and hardening (BACKLOG 73)

- **Go Premium only sells what Google Play offers, at Google Play's price.** On a phone the plan list now waits for Google Play (*Loading plans from Google Play…*); if it cannot reach Play it says so and offers *Try again*, instead of showing a built-in price list whose Subscribe button only said "still loading". A launch offer that Play no longer sells is not shown. The crossed-out price, the saving, the annual plan's monthly equivalent and every "from …/month" line are worked out from Play's prices (in Play's currency), not typed into the app.
- **New app icon fit and splash screen.** The R now sits wholly inside round and squircle icon masks (it was clipped), the themed (monochrome) icon is centred and full size, and the app opens on a navy screen with the R instead of the default Capacitor logo.
- **Google sign-in asks for less.** The trial sign-in now requests only your e-mail address and the app's own Drive data — no longer your name and profile picture, which the app never used.
- A damaged profile list no longer stops the app opening or blocks creating a profile.
- Internal: `ENT_PLANS` (`14-entitlement.js`) is the one plan table — months, prepaid, list price, launch offer → full-price plan; `entSetProducts` keeps Play's `priceAmountMicros`/`currencyCode`; `productsUnavailable` UI hook and `entRefreshProducts()`; `getUsers()` returns only records with a username; `PlayBillingPlugin` ends its connection and `GoogleDrivePlugin` shuts its executor in `handleOnDestroy`; sign-in options built from an empty `GoogleSignInOptions.Builder` (email + drive.appdata); `file_paths.xml` no longer exposes external storage; `tools/make-android-icons.py` generates the adaptive layers and splash; `values/splash.xml` sets the Android 12+ splash background. Build: `release-bump.js` and the build workflow refuse minor/patch above 99 (versionCode packing); release stacks keep line numbers (`proguard-rules.pro`); the release bundle no longer contains the debug harness (`__DEBUG_HARNESS__`, `build.js`). Smoke `assertRegistryShape`, `assertSubscribePricing`; `tests/release-tools.js` in `pretest`. Device cases D23 and B3 (large screens). Copy deck C-75. Sign-in migration to `AuthorizationClient` planned as BACKLOG 75.
- Internal fix: `tests/release-tools.js` probed the versionCode packing guard with the version literals `8.100.0`/`8.35.100`. Because the release job bumps the version before the gate runs, once the version reached 8.36.0 the probe `8.35.100` became a *downgrade*, so release-bump's downgrade guard (checked before the packing guard) rejected it with a different message and the release gate failed (CI run 38725503153). Probes are now `999.100.0`/`999.0.100`, which out-rank any real version and always reach the 0–99 packing guard; an invariant comment records why the major must stay out of reach.

### Deleting deletes, and your name is encrypted (BACKLOG 71)

- **Delete Account and Remove profile now remove everything the profile left on the phone.** Before, they left the encrypted Auto Backup snapshot, copies of exported files in the app's cache, and the *Last manual export* time. The snapshot goes only if it belongs to the profile being removed; export copies go whichever profile made them (they are copies of files you already saved elsewhere).
- **Reset all data clears every answer.** It used to keep your per-area answers, dismissed warnings, the Easy View setting and the medical-aid answer, and could start onboarding before the reset had been saved.
- **The automatic backup snapshot is now actually written.** On Android the app was meant to save an encrypted snapshot each time it locks, but the write was always refused, so the backup screen kept saying *No local backup snapshot yet*.
- **Your name is encrypted like the rest of your details.** Before you enter your PIN, the profile list and the lock screen show *@username*; your name appears once the app is unlocked. Existing profiles are converted the next time they are unlocked.
- Internal: `_purgeLocalProfile()` (`02-core.js`) is the one wipe for both deletions (WR-8); `EXPORT_FILE_RE` names the export copies; `writeLocalBackupSnapshot` passes `encoding: 'utf8'`; `executeReset` removes `SK.data(user)`, reloads the empty profile through `restoreData()`, awaits the save and rewrites the snapshot; `clearAllUserFields()` resets `facts`, `overrides`, `hasMedicalAid` and `easyView`; `fullName` joins `PII_FIELDS` (`_openUserPii` reads, `_migrateUserPii` seals plaintext left on a sealed record and never overwrites a seal that will not open; the lock-screen unlock now saves the migrated record). Smoke `assertProfilePurge`, `assertResetClears`, `assertNameSealed` — all fail on the previous build. Device case D22. Copy deck C-74; C-69–C-73 approved by the owner.

### Subscriptions keep the time you paid for (BACKLOG 70)

- **A 3-month plan lasts three months.** Google Play's app-side purchase record does not say which plan was bought, so the app treated every purchase as one month — a 3-month prepaid plan locked after about a month, and turning off auto-renew removed Premium straight away even though the period was paid. Now, while Google Play lists your purchase, Premium stays on; *Restore purchases* no longer says "No active subscription found" for a plan you have.
- **"Renews" only when it renews.** A prepaid plan, or a subscription with auto-renew off, reads *Access until <date>*. A plan bought on another phone (the app cannot know which) shows no date rather than a guessed one.
- **Changing plan:** with a plan bought on this phone, the change goes through Google Play's plan-change sheet; with a plan bought elsewhere, the app opens Google Play's subscription page.
- **A phone date that was once set ahead** no longer locks a subscriber out, or starts a new free trial already used up; a trial never shows more than 7 days.
- A purchase that is still processing (slow payment method) says so and never removes Premium you already have.
- Internal: `14-entitlement.js` — `verifiedAtEffective` and `max(expiryTimeMs, verifiedAtEffective)` in `_computeState`; plan hints per purchase token from the `purchasesUpdated` delta; `CANCELLED_PAID_THROUGH` for non-renewing purchases; full-list-only expiry; `_syncBilling` in-flight guard; first-ever trial resets a future clock high-water; `trialDaysLeft` capped. `_lockCompleteUnlock` resyncs (`02-core.js`). `tests/entitlement.js` Test 17 uses the native shape (`basePlanIds: []`) — every case fails on the previous code; smoke `assertPremiumWording`. Device case D21. Copy deck C-71–C-73.

### A backup only says "exported" once it has been saved (BACKLOG 72)

- **On Android, *Export encrypted backup* now waits for the share screen.** The confirmation and the *Last manual export* time appear only after you choose where the file goes. If you close the share screen without choosing, the app says *Backup not saved* instead of claiming a backup that does not exist; if the file cannot be written, it says the backup could not be created. The CSV summary, the ITR12 text and a closed year's export follow the same rule.
- Internal: `_downloadBlob()` (`02-core.js`) returns a promise of the outcome (`shared` / `cancelled` / `downloaded`) and rejects on failure; its five callers confirm only after it resolves. Smoke `assertExportOutcome` (stub native bridge) fails on the previous build. Copy deck C-69.

### Privacy policy link in the app (BACKLOG 71, part 1)

- **About and the Terms now link to the full privacy policy** (inspiredtax.co.za/privacy.html), as Google Play's User Data policy expects. Copy deck C-70.

### 48 · Branch audit — delete the four branches, tag two as archived

- **What and why:** The audit is done (`docs/PROGRAMMES.md` P34, DECISIONS
  BR-1–BR-3). All 16 commits ahead of `main` on the five remote branches were
  classified; the one still-wanted change (the `calcTaxOnIncome` threshold fix)
  is on `main`. 
- **Done:** `git ls-remote --heads origin` lists only `main` and any live
  session branch, and `git ls-remote --tags origin 'refs/tags/archive/*'`
  lists the two tags.


### Crypto you held as an investment: only the buying and selling fees reduce the gain

- **A running cost of trading no longer reduces a capital gain.** Where a crypto sale is held as an investment, only what you paid to buy or sell it is part of base cost — the exchange's trading fee, the network (gas) fee, a withdrawal fee on the sale. Trading software, market data, your internet share, a general accounting fee, bank charges, margin fees and interest on borrowings are running costs of a trade: deductible against trading income, never against a capital gain (Eighth Schedule para 20(1)(c); para 20(2) excludes borrowing costs). Before this, **every** cost on the record reduced the gain whatever it was.
- **How it was reached:** the cost list used to be hidden unless you said you held the asset to trade, but the figures stayed on the record and kept being subtracted. Enter trading costs, switch the holding to *As an investment*, and your gain was reduced by costs you could no longer see. If you have such a record, your capital gain will now be higher — correctly so.
- **The cost list is now on screen for both holdings**, labelled for the one you picked (*Trading costs* / *Costs of buying and selling*) with a one-line note saying which costs count, and *+ Add cost* in place of *+ Add expense*. Where a cost cannot be used, the preview and the saved row name the amount rather than leaving the arithmetic unexplained.
- Internal: one reader for what a disposal's costs do (`cryptoDisposalCosts()`, `06-crypto.js`) across the live preview, the engine feed and both list renderers. New legislative fixture TC-021 (hand-derived from para 20(1)(c), para 5 and para 10; fails by R3,600 on the pre-change build), two new engine checks, and `cryptoDisposals` added to the legislative persona — crypto's capital path previously had no fixture coverage at all. Golden baseline: two insertions, no existing value moved.

### A full write-off no longer says "per year"

- **An asset written off in one year reads *saves ~R… this year*** instead of *…/yr*, which read as recurring and overstated what a small item saves. A depreciated asset is unchanged (copy deck C-67).

### Tax figures now match the SARS tables to the cent

- **Tax on income is calculated on the amount above each bracket's threshold**, as the SARS rate tables are worded ("35 253 + 26% of taxable income above 195 850"). The calculation previously used the amount above the bracket's first rand, one rand too high, which understated tax by between 26c and 45c depending on the bracket. Because figures are shown in whole rand, the amount on screen could read R1 below the SARS table — for 2025/26 that affected 38.4% of taxable incomes above R237,100. Lump-sum tax was never affected; it already used the SARS wording.
- **The historical calculator's 2018/19 and 2019/20 top bracket is corrected.** It carried R532,042 where SARS publishes R532,041, overstating tax by R1 on taxable income above R1,500,000 for those two years.
- Internal: a new bracket-base check in the test suite holds every year's table to its own published figures — tax at the top of a bracket must reproduce the next bracket's published base. It catches both faults above; the previous bracket check had a R2 tolerance and could not.

### Onboarding names the question you missed

- **On the Income sources step, Continue now names the first unanswered question** (*Please answer: …*) for every question that applies and for the foreign-income question; before, two checks ran and most questions got the generic *Please answer every question on this step.* (copy deck C-57).
- Internal: one onboarding step-2 validator (`obValidateCurrentStep`); the `required` flag on `SCENARIO_QUESTIONS` is gone, because every question that applies is required.

### Field problems show under the field, when you leave it (on-blur validation, BACKLOG 36)

- **A problem with a field now shows under that field**, with a red border and one line saying what is wrong, instead of a "Please complete the required fields" toast. Screen readers hear it (`aria-invalid`, `aria-describedby`).
- **It appears when you leave the field and clears as soon as you fix it.** Nothing shows while you type, and an empty field you have not touched is flagged only when you tap Next or Save.
- **Next stays on a step with an error; Save opens the step holding the first error** and puts the cursor there.
- **New checks on leaving a field:** a share or percentage outside its range, a small tool costing more than the small-item limit, and an odometer end reading below the start.
- **On the deduction pages, an impossible value is not saved:** the last good figure stays in the calculation until it is fixed. Amber warnings (for example PAYE above the top rate) never block.
- Donations and the current-year planner's *Add* now flag their fields the same way.
- Internal: one validator in `02-core.js` (`fieldProblem`, `showFieldProblem`, `checkScope`, `flagField`); field-specific rules in `FIELD_CHECKS` (`01-data.js`), which also evaluates the plausibility rules at their field (the `blocksSave` path in `applyDeduction()` now goes through it). `makeCrudModule` `validate()` returns `{el, msg}`. Smoke `assertFieldValidation` (8 failures on the pre-change build).

### Tax-screen cards open with a breakdown and a chart (UI-CARD-1)

- **Every summary card on the Taxation screens opens.** Tap a Tax at a Glance card (Return), a Provisional tax summary card or a Prior years result card and it takes the full width: a chart across the top and the lines that make up the figure under it, then a link to the page where you change it. Effective rate shows tax over gross taxable income beside your marginal rate; Marginal rate shows the year's brackets with where your income sits and how far the next rate is; PAYE paid shows tax for the year less what you have paid, down to what you owe or get back. One card is open at a time, and it stays open while you edit.
- **The cards match the Dashboard's.** Same card with the coloured lip; Gross taxable income, Deductions, Taxable income and Tax payable are now built once for both screens. A card whose figure is R 0 does not open. The Provisional, Tax risk and Projection cards gain the lip too.
- **Tax balances rows show their movement.** A balance that carries an amount gets the lip, and its opening, this-year and closing amounts are drawn as bars above the lines.
- Internal: `miniCardHtml()`, `onMiniCardToggle()`, `barsHtml()`, `bracketLadderHtml()` (`02-core.js`); `glanceCardSpecs()` and the Tax card specs (`07-render-summary.js`), used by the Dashboard, Return, Provisional and Prior years. `tests/smoke.js` `assertTaxCards` (7 failures on the previous build). Prototype `_mockups/tax-cards.html` deleted. Copy deck C-66.

### Notes take one line (UI-NOTE-1)

- **Every note is now one short line with *More*.** The full explanation and its tax reference open in the help sheet at the bottom of the screen, so nothing is lost, it just stops taking over the form. Notes are also two text sizes smaller. This covers the add-forms (rental, business, capital gains, tools, investment, donations, pensions), the deduction pages, provisional tax, the Act reference and the long introductions at the top of cards.
- Internal: `noteHtml()` / `setNote()` / `noteBody()` in `02-core.js`; `OPTION_NOTES` entries carry `short` + `title`; `tests/smoke.js` `assertNotesCompact` fails any plain note over 110 characters (7 on the previous build, 0 now). Tests that read note text now read the line plus the *More* text. Copy deck C-58 lists the new short lines.

### Add forms ask what you are adding first, and have fewer steps (UI-CAP-1)

- **Every form that captures more than one kind of record now opens on one question** — *What kind of rental is it?*, *What kind of work is it?*, *What did you sell?*, *What did you receive?*, *Why was it paid?* (retirement lump sums), *What did you buy?* (tools and equipment), *What is on the certificate?* (IT3(b)), and the existing retirement and crypto choices. Each answer is a tile with a one-line description. After you pick, the form shows only what applies and its title names it — *Add Airbnb rental*, *Add share sale*, *Add foreign IT3(b)*; *Change* in the header goes back to the question. Editing a saved record opens straight on its form (*Edit Airbnb rental*).
- **Fewer steps.** Rental, business and IT3(b) go from three steps to two (rent and its costs share a step; business income moves onto Details; an IT3(b) with only South African or only foreign amounts is one step). Pension, retirement lump sum and other receipts are one screen.
- **One step header**: *Step 1 of 2* and the step's name on one line, over a bar with one segment per step.
- **Costs start with the usual lines.** A new rental or business starts with the two or three costs usual for its kind (e.g. bond interest, rates and insurance for a long-term rental), with the next few one tap away under *Add a cost*. Lines left at R0 are not saved.
- **Tools and equipment:** an item at or under the small-item limit is still written off in full automatically; *Spread it over N years instead* now turns that down (the asset-type list is no longer on the form).
- Removed from Other receipts: the *Type* select's info note, which typed the inclusion rate and annual exclusion as text.
- Internal: `CAPTURE_KINDS` (`01-data.js`) holds every chooser group — cross-sheet (`modal` per kind) or in-sheet (`field`: the select the kind writes, kept in the form and hidden, so every reader is unchanged); `renderModal` puts the chooser first and adds *Change*; `makeCrudModule` gains `pickKind` / `changeKind` / `onKind` and the `data-kind-stage` attribute; `wizLiveSteps` skips `data-kind-off` steps; `USUAL_COSTS` drives the seeded cost lines. No engine change: `npm run test:engine` unchanged. Smoke `assertCaptureKinds` rewritten for the new rules, and the modal text-zoom sweep now also measures each chooser screen.


### Large Android text sizes — icons, amounts and rows fit again (UI-FS-1, UI-PILL-1)

- **Icons sit inside their tiles at every text size.** With Android's font size set large, the icon in every tile (Still-to-add rows, Tax balances rows, section headers, Tax at a Glance) grew past its tile. Tile and icon now grow together and keep the designed proportion.
- **Amounts no longer run off cards or over labels.** Tax at a Glance and the summary cards drop to one column when the figures no longer fit two-up; captured rows (e.g. *Salary/Wages*), Income and Deductions selector rows, Tax balances rows and Provisional Tax milestones move the amount or switch to their own line instead of overlapping or cutting it off; the Dashboard's *Less primary/secondary/tertiary rebate* line keeps the whole amount; the Tools & equipment and Subsistence pages no longer scroll sideways.
- **Section pills line up.** The Income, Deductions and Taxation pill rows are one equal-width grid, and every pill — Taxation's included — has the raised lip.
- **The page title no longer runs under the Pro / Trial chip** in the top bar; it shortens beside it.
- **Field labels wrap as one line of text**, so *Your ownership share (%) (optional)* no longer overlaps itself in Add CGT disposal.
- Tables (tax bands, year comparison, travel rates) scroll inside their own box instead of widening the page.

### Joint ownership and minor child's accounts are answered once, in onboarding (UI-CAP-0)

- **Onboarding now asks for an answer** to "Do you own any of these together with someone else?" and "Do you pay into an account in your minor child's name?" when they apply, and a Yes to joint ownership asks for your **usual share** once. Profile shows and changes the same answers.
- **The investment, rental and capital-sale forms no longer ask for your share.** Each shows one line — *You hold this alone · 100 % yours* — with *Held jointly*, which applies your usual share (or *Change %* for this item only). Investment certificates show *Your own account* with *My minor child's*. Records you already saved keep their share.
- Internal: the icon-tile ladder is sized in em of its own glyph (`--glyph` rem, `--tile-em` ratio, defaults in `:where()`), which also makes the `.ico-sz-*` modifiers work for the first time and retires the never-rendered E15 glyph override; `.info-btn` and the progress rings are em-sized too; the `7vw` "font-scale-immune" amount size is removed. `tests/smoke.js` now emulates the WebView's text zoom (every computed font size × z, boxes unchanged) at 130/150/200 % on 360 px and 150 % on 320 px, with every card expanded, for panels and modals, and fails on a glyph larger than its tile, text spilling out of its box, content cut off by `overflow:hidden`, a sheet wider than the screen, or the app-bar title under the billing chip. Reproduced first: 184 failures at 130 % on the 8.35.2 build.

### Owner interview 2026-10-05

- **The launch-offer ribbon now says "FIRST 100 SUBSCRIBERS"**, the real cap, instead of 500. The figure is the named constant `LAUNCH_OFFER_SUBSCRIBER_CAP` (`01-data.js`).
- **Onboarding's Income Sources step will not continue until every question that applies is answered**, including the foreign-income question (QD-24 amended).
- **Business kilometres above the kilometres driven, and an office area larger than the home, now stop the figure saving** and show the message (QD-19 amended). PAYE notes still only warn.
- **Copy:** exempt local dividends tip, local and foreign interest notes (single threshold, shorter), and the rental Airbnb and Vehicle lease notes lose their statute citations (C-11, C-12, C-14, C-19).
- Internal: `PLAUSIBILITY_RULES` rows carry `blocksSave`; `applyDeduction()` consults it. Smoke assertions cover the block, the unblocked PAYE path and onboarding step 2, each shown failing before the fix. `tests/screens` baselines re-captured.

## [8.35.2] — 2026-10-03

- No app change: version bump after the October 2026 documentation audit.

## [8.35.1] — 2026-10-03

### Selector sections and add buttons (STD-BEHAV-4/5)

- **Deductions' *Completed, well done!* and *Off* sections now fold away, and only one is open at a time.** They used to sit open on every visit. Both start closed, each shows a count (Completed also the total deducted), and opening one closes the other. Income already started closed; it now has the same one-at-a-time rule, and so do the six *Tax balances* rows. Open or closed is remembered only while the app is running, so each visit starts from the work still to do.
- **Add buttons say "Add your first …" until there is something in the list.** On the twelve list pages (employment, investment, tax-free investments, rental, business, disposals, retirement income, receipts, crypto, tools assets, donations, other claims) the button reads, for example, *Add your first employment income*; once an entry exists it reads *Add employment income* as before.
- Internal: `renderSelectorList()` takes a group `name` (same-named `<details>` close each other natively, no handler); `initCarriedBalanceAccordion()` is deleted, its job done by `name="carried-balances"`. `syncAddCtas()` (`02-core.js`) relabels every `[data-add-list]` button from one step in `renderAll()`; each button carries its own two wordings. Smoke `assertSelectorBehaviour` covers all three (24 problems reported with the behaviours deliberately broken). Copy deck C-52, C-53.

### Sign-in screen — the offline claim now matches what the app does (copy deck C-10c)

- **The second trust line on the first-run screen now reads "Works out your return offline"** instead of "Works fully offline". Working out a return never needs a connection, so that is still true; on Android the free trial and Google Play purchases do contact Google, which "fully offline" implied they did not. It now agrees with the FAQ and Terms wording shipped in #380.
- Internal: `tools/check-font-px.js` now allows its glyph px sizes by selector, not by line number (QD-26 had listed line numbers, so any CSS added above them failed `pretest`). Checked both ways: two lines added at the top of `main.css` still pass; two new px rules fail.

### Income page — the Exempt income card now lists every exemption (INC-20)

- **The *Exempt income* card shows two more exemptions, under its total.** *Foreign dividends, exempt 25/45* and *Primary residence exclusion* appear below a line reading "Also exempt — not counted in the total above". Before, a taxpayer with a foreign dividend or a home sale saw an exempt-income card that left out a real exemption.
- **Nothing you are taxed changes.** The card's total, gross income, tax-exempt income and every tax figure keep their meaning; the two amounts are listed apart so the rows above the line still add up to the total. The card now also shows when only these two apply.
- Internal: `calcFullTax()` returns `foreignDividendsExempt` and `primaryResExcluded` (from `collectForeignIncome()` and `cgtAggregate()`); `exemptMemoBreakdown()` (`02-core.js`) feeds the card. `tests/expected.json` gains those two keys on every scenario and nothing else (52 added lines, none removed; the two non-zero values are R55 555.56 = R100 000 × 25/45 and R1 400 000 = 70% of the 2026 R2m exclusion). Debug-harness TEST-15 casts the memo lines to the engine and checks they stay out of the total; fixture S12d; TC-002 asserts `foreignDividendsExempt`.

## [8.35.0] — 2026-10-02

### QD-26: glyph-only fix (accessibility — Android font-size setting)

- **Body text now follows the Android font-size accessibility setting.** The `setTextZoom(100)` pin in `MainActivity.java` that overrode the system font scale is removed. Users who have set a larger or smaller font on their device will now see app text scale accordingly.
- **Icon glyphs are unaffected.** All Material Symbols `font-size` values are changed from `rem` to `px` so they remain at their design sizes regardless of the system font-scale multiplier. The tile (`ico-bg-*`) size ladder retains `rem` so tiles grow with text; only the glyph inside each tile is held fixed.
- Internal: `android/…/MainActivity.java` (pin removed); `src/styles/main.css` (13 `.material-symbols-outlined` rules and the `--glyph` variable in 6 tile sizes changed to `px`); `tools/check-font-px.js` `ALLOWED` list documents all 13 exceptions with a reason (hard rule 9 is not relaxed — any future px font-size must still be justified there). Owner device check D13 (130 % and larger) required before release.

### IT3(b) codes corrected to SARS G05 (#382)

- **`s8E/8EA` dividends now print source code 4292, not 4238.** SARS IT-AE-36-G05 assigns 4238 to *Distribution from a REIT / Taxable Local Dividends* and 4292 to *Dividends deemed to be income under s8E/8EA*. The app had the two codes transposed in the IT3(b) line labels and in the code-search keywords. Amounts and tax are unchanged — routing by field, not by printed code.
- **REIT distributions are now labelled 4238**, with a new *Distribution from a REIT* chip row. The previous `it3b-reit` entry (4214 *Other*) migrates to the correct code on load.
- Internal: `IT3B_CODES` table (`01-data.js`); `npm run gen:atlas` run. Legislative fixture TC-008 already covered the 4238 REIT treatment.

### First-run primary CTA sheen (#381, BACKLOG item 7)

- **The primary call-to-action button on the first-run screen now shows a sheen animation** — a single pass of light across the button 1.5 s after it appears, repeating every 3.8 s, matching the design handoff (07-surfaces-and-motion.md §B). The sheen was already present on the outcome hero (`.dhero`) and had borrowed its timing from this spec; the CTA now has its own.

### C-10 FAQ and Terms copy (#380)

- **FAQ: *Where is my data stored?*** The answer no longer says the app makes no network requests — the free-trial and cloud-backup features do. The updated text says data stays on your device, explains that the trial and backup use the network (for Drive calls when you have enabled them), and that no information is shared with third parties.
- **Terms: clause 5** no longer says the app "operates fully offline".

### QA remediation 2026-09 — QR12 (close-out)

- Nothing you can see changes.
- Internal: QR11 had been built twice (#377, then #378, which is the one that runs). The unreachable remains of the first — `src/js/19-motion.js`, the `MASCOT_REACTIONS` / `SCREEN_TRANSITIONS` tables, a no-op `mascotSync()` call and a duplicate `assertMotion` in `tests/smoke.js` — are removed. Documents reconciled to the code; every finding has a final status in the programme tracker.

### QA remediation 2026-09 — QR11 (mascot reactions; screen transitions)

- **The mascot now reacts to what you do.** Where it appears — the Dashboard reward card, the Income summary, the Deductions *Still to add* heading — it waves when you arrive, cheers when you save an item, nods when you finish a step, points at what is still to add, and looks around (then dozes) if you leave the screen alone. Each reaction lasts about a second.
- **Changing area sweeps.** Moving between Dashboard, Income, Deductions and Tax plays a short sweep in the colour of the area you are going to. Moving around inside one area is as quick as before.
- **Wizard steps change under a pattern of triangles** in the area colour.
- **Reduced motion is respected.** With the device set to reduce motion there are no transitions, and the mascot shows a still pose instead of moving.
- Changed: the mascot's existing poses are shorter — one hop instead of two, two waves instead of three, and the pointing pose no longer sways for ever.
- Internal: `katReact()`, `noteStepCompleted()` (the one step signal), `stepTransition()` (`02-core.js`); `KAT_REACTIONS`, `KAT_IDLE_MS`, `STEP_TRANSITION` (`01-data.js`); `katGreetOnEnter()` removed; new gate `tools/check-motion.js` in `pretest`; smoke `assertMotion`.

### QA remediation 2026-09 — QR9b (one Add per area; tools list; form clean-up)

- **Retirement income: one *Add retirement income* button.** The sheet opens with *What did you receive?* — pension or annuity payments, a lump sum, or a two-pot withdrawal — and shows the fields for that kind. It replaces three separate buttons. Picking another kind after typing asks before it discards what you entered.
- **Crypto: one *Add crypto* button.** *What happened?* (you sold, swapped or spent it / you earned it) and, for a disposal, *How did you hold it?* (as an investment / to trade) are now on the same screen as the amounts, each answer with its own short note. The separate "Classify" step is gone.
- **Retirement contributions: add the funds you paid into.** *What you paid in* shows only the funds you have an amount for; *Which fund did you pay into?* adds a pension fund, provident fund or retirement annuity, and each can be removed. The amounts and the calculation are unchanged.
- **Freelancers: the three "deemed employee" questions are asked one after another**, the second only after a Yes to the first and the third only after a Yes to both.
- **Tools & equipment: *Vehicle* is no longer an asset type.** A vehicle is claimed under Travel (or with your business expenses if you are self-employed). An asset already saved as a vehicle is kept exactly as it was and says so.
- **Small tools:** the note now says an item that is part of a set counts at the cost of the whole set, and that an asset bought to let out does not qualify. The limit itself is unchanged (the limit or less).
- **Form clean-up:** "(optional)" no longer appears on drop-downs that always have a value, on *Employer Name* or on *Gross rental income*; the `*` required markers are gone (the app marks what is optional instead); a wizard's *ⓘ About …* line shows on its first step only; three CGT labels lost a bracketed hint their tip already gives; the foreign-business sentence shows only for *Foreign business*; the donation tip no longer repeats the "no certificate" note.
- **Tablets are written off over 2 years, not 3**, as SARS Binding General Ruling 7 (Issue 4) lists them. A R12 000 tablet now deducts R6 000 a year for two years; one you started using more than two years before the tax year is fully written off. Furniture (6 years) and vehicles (5 years) already matched the ruling and are unchanged — an earlier proposal to shorten them rested on a mis-read of the SARS table.
- **Medical aid contributions: the labels now say *Annual contribution***, with a line under the two fields reminding you to enter the total for the whole year, not a monthly amount. Nothing else on the Medical page changed.
- Internal: `CAPTURE_KINDS` / `kindSwitchHtml` / `switchCaptureKind` (one Add, several `makeCrudModule` sheets; `makeCrudModule.byModal`), field type `choice` (radio tiles over a hidden select), `formHoldsInput()`, the `retired` option gate, `wtLife()` and `SARS_WT_RATES.option` / `.retired`, `RETIREMENT_FUNDS` / `retSyncFundRows()`, `bizPspChain()`; legislative fixtures TC-016–TC-018 (small-item boundary; write-off periods from the ruling); smoke checks *Tools list*, *Form conventions*, *Capture kinds*, *PSP chain*, *Retirement funds*. `tests/expected.json` unchanged.

### QA remediation 2026-09 — QR9a (investment certificates; tax-free investments)

- **Investment certificate amounts are added by code.** On an IT3(b) certificate, *Add an amount* is the same code box as the IRP5 codes: type `4201` or `interest`, pick the line, and its amount field appears (foreign interest and dividends bring their foreign-tax line with them). Lines already on the certificate are not offered again. The "+ chip" buttons are gone.
- **Fixed: editing a certificate hid its exempt local dividends (4306).** The amount was saved and counted, but the field did not reappear on edit.
- **Tax-free investments have their own list.** On the Investment page, *Tax-free investments* takes each TFSA as the SARS return asks for it: institution, type, policy number, contributions, transfers in and out, withdrawals, and (optionally) the returns on the certificate. A meter shows this year's contributions against the yearly limit, and an *earlier tax years* total covers the lifetime limit. Transfers between your own tax-free investments do not count toward either limit.
- **Going over a limit now changes your tax balance.** SARS adds 40 % of contributions over the yearly or lifetime limit to your tax (s12T(7)); the app used to warn about this and now includes it in the amount owing, as its own line on the Summary.
- **TFSA certificates move automatically.** A certificate captured as an IT3(b) with *Account type: TFSA* is moved to Tax-free investments the first time the app (or an imported backup) loads — nothing is lost, and a note says so until dismissed. One you had marked as your minor child's account moves as the child's TFSA and does not count toward your own limits. The *Account type* question is gone from the IT3(b) form.
- Internal: `calcTfiCharge()` / `tfiChargeForActiveYear()` (`02-core.js`), `S12T_EXCESS_CHARGE_RATE` (`01-data.js`), `APP.tfiItems` / `tfiPriorContributions` / `tfiMovedCount`, saved-data `dataSchema` 2 with `migrateTfsaCertificates()`; legislative fixtures TC-013–015; smoke `assertIt3bLines`, `assertTfiList`, `assertTfsaMigration`. `tests/expected.json` unchanged.

### Data visualisation batch — year comparison, medical breakdown, cap meters, balance waterfall

- **Projections: the year-by-year table no longer scrolls sideways.** It now compares the base year with one forecast year you pick ("Compare the base year with …", defaulting to the last year), showing each figure's change underneath. A rise is marked as better or worse for you (gross income, take-home and RA up are better; tax and effective rate up are worse; taxable income is neutral), with the sign and the words carrying it as well as the colour. The line chart above still shows every year.
- **Medical: "How your credit is worked out".** A collapsed card under your medical credit opens to show the split between the set monthly credit and the extra credit, then the extra-credit calculation line by line — contributions above 4× (or 3× at 65+/disability) the monthly credit, plus out-of-pocket expenses, less 7.5% of taxable income — with a bar showing how much of your qualifying expenses the threshold absorbs (the usual reason the extra credit is R 0).
- **Retirement, donations and travel show how much of the limit you have used.** A meter under each total: amount used of the cap, the percentage, and what is left — or, past the cap, the excess drawn as an amber hatch beyond a cap mark with what happens to it (carried forward for retirement and donations; not deductible for travel beyond the allowance received). The retirement meter is visible with its card collapsed.
- **Dashboard: the refund/owing card opens to a step-by-step waterfall.** Owing: tax payable, less PAYE, less provisional tax, less tax withheld by a fund, equals the amount owed. Refund: what you paid, less tax payable, equals the refund. Each step is drawn at its true position on one scale. PAYE and provisional tax now wear their own area colours (they were painted cyan and blue).
- **Breakdown donuts respond to touch and keyboard.** Tap a slice or its legend row to highlight it and show its share of the total in the ring's centre; tap again to clear. Legend rows are focusable buttons and the selection is announced to screen readers. Adjacent slices are separated by a thin gap. On the Income hero, the source chips now use the same colour as their slice in the donut above them.
- Internal: shared components in `02-core.js` — `donutHtml` (interactive), `stackBarHtml`, `capMeterHtml`, `waterfallHtml`; `medicalCreditComposition()` exposes the s6A/s6B intermediates and `calcMedicalCredits()` now returns a pick of it (golden output unchanged); s6B rates and multiples named in `MEDICAL_S6B` (`01-data.js`) instead of inline literals; debug-harness TEST-6 now casts the waterfall against `r.balance`.

### Dashboard at-a-glance cards — a ring in each (HERO-2)

- **Each of the four small Dashboard cards now shows a ring beside its figure.** *Gross taxable income*: your income by source. *Deductions*: retirement, travel and home office in their own colours, every other deduction together as one slice — the rows inside the card carry the same colours. *Taxable income*: how much of your gross taxable income is still taxable after deductions. *Tax payable*: how much of the tax on that income is left after rebates and credits.
- **Fixed: the Taxable income card left out an assessed loss.** With a loss brought forward that the year's income absorbed, the card showed no "Less assessed loss" line, so its rows did not add up to the taxable income it showed. The figure itself was always right; only the breakdown was short.
- Internal: `donutHtml(…, { compact: true, whole })` draws the ring (no legend or slice buttons — it sits in a `<summary>`); `deductionBreakdown()` and `DEDUCTION_RING_COLOUR` (`02-core.js`) feed the Deductions rows and ring; `tools/check-donut-colours.js` covers the new ring; debug-harness TEST-13 (card rows cast) and TEST-14 (rings cast to `calcFullTax()`), fixture S12c.

### Investment certificates — SARS codes 4238 and 4292

- **New line: *Distribution from a REIT / taxable local dividends* (code 4238).** An IT3(b) certificate had no place for a REIT distribution. It is taxed in full: neither the dividend exemption nor the tax-free interest allowance applies.
- **Fixed: the s8E/8EA line printed the wrong code.** *Dividends deemed to be income (s8E/8EA)* now shows 4292, as the SARS return does; it showed 4238, which is the REIT code. The amounts and the tax were always right — only the printed code was wrong.
- Internal: new certificate key `reitTaxableDividends` (in the engine sum, the ownership-share scaling, the bucket total and the provisional passive-income test); legislative fixture TC-020; the reference code table (`ITR12_OTHER_INCOME`) names 4214, 4238 and 4292 as SARS IT-AE-36-G05 rev 39 does; atlas regenerated.

### First-run screen — the Create button's sheen (design handoff §B)

- **The *Create New Profile* button on a new device now has a light sheen** crossing it every few seconds, in both themes. It is switched off when the device asks for reduced motion.

### FAQ — where your data is stored (copy deck C-10)

- **Fixed: the FAQ said the app "makes no network requests at all".** On Android it contacts Google for the free trial and for Google Play purchases. *Where is my data stored?* now says so, in the same words as About → Privacy & Data: your data is on your device, encrypted, and never sent to us or anyone else.
- **Terms of Service, clause 5, no longer says the app "operates fully offline".** It now says your financial data stays on your device and is not sent to external servers, and that on Android the app contacts Google only for the free trial and Google Play purchases.

### Cloud backup — the one-time offer (QD-07; switched off)

- **Nothing changes for users yet.** Cloud backup is still switched off. Once it is switched on, a new profile will see one card on the Dashboard offering to turn it on, with *Turn on cloud backup* and *Not now*; either choice retires the card for good, and the Backup screen stays the place to change it.
- Internal: `renderCloudBackupOffer()`, `cloudBackupOfferAccept()`, `cloudBackupOfferDismiss()` (`18-cloud-backup-ui.js`), slot `#dash-cloud-offer`; smoke `assertCloudBackup` extended.

### Statutory figures read from the tax tables, not typed (GLOB-2)

- **The travel page's SARS reimbursive rate now follows the tax year.** It showed "2026/27: R4.95" whichever year you were working on. It shows the rate for the year in use, and for a year whose rate the app does not hold it says so rather than showing another year's figure.
- **Rental expenses: the "Add each expense by category." line is gone.** The Airbnb note about apportioning fixed costs stays, for Airbnb only.
- Four notes no longer quote a figure that changes by year or is shown live elsewhere: the two-pot minimum withdrawal, the donations limit (form tip and explainer), and the capital treatment of *Other receipts*.
- Internal: 14 `getFact(…) || <typed figure>` fallbacks removed — the typed figures were the newest year's (e.g. the R3m primary-residence exclusion, R2m in 2025 and 2026), so a missing table entry would have applied the wrong year's law silently. `tests/invariants.js` now requires each of those facts in every tax year. New `SARS_REIMBURSIVE_RATE` (`01-data.js`). Lint: 9 → 4 hits.

### QA remediation 2026-09 — QR8 (code picker)

- **Source codes can now be typed.** On *Add IRP5 / IT3(a) income* the Source Code box takes a code (`3601`) or a word (`salary`, `travel`) and narrows the list as you type. With nothing typed, the ten most common codes are open and the other categories are collapsed with a count; tap a category to open it. The same box is used for the optional *Code from your IRP5* on *Add other deductions*.
- **Nothing is chosen for you.** A new income entry no longer starts on code 3601; you pick the code (saving still needs one).
- **The "What kind of income is it?" filter chips are gone** — the box does their job.
- Internal: `type:'codepicker'` form field over the existing hidden `<select>` (same id, same value, same `onchange`); `IT3B_CODES` data table added for the IT3(b) redesign (QR9a); `assertCodePicker` in the smoke suite.

### QA remediation 2026-09 — QR7 (onboarding asks once, forms ask less)

- **Setup now asks a few questions once, so the capture forms can skip fields you don't need.** On the *Income Sources* step, depending on what you tick: whether you own any of it jointly (and, for capital sales, whether anything you sold was jointly owned), whether you pay into an account in your minor child's name, whether you have a tax-free savings account, and — if you have foreign income — which kinds (investments, rental, own business, selling something abroad, a pension or annuity, working abroad) and which currencies. Each answer is also in *Profile → Income Sources → About your situation*.
- **Forms leave out what your answers rule out.** Say you own nothing jointly and the ownership-share fields disappear — you are taxed on the full amount, never on a blank share. Say your investments are not foreign and the investment certificate goes from three steps to two, with a note and a link to change it in Profile. Foreign options on rental, business, capital sales and pension forms, and the foreign-service salary codes, follow the same answers. Your chosen currency comes first (and is preselected if it is the only one) in every currency converter.
- **The foreign-income question in setup no longer starts on No.** Left unanswered, it hides nothing; only an actual No leaves the foreign options out of the forms.
- **Nothing you already captured is ever hidden.** A record that is already foreign, or a share other than 100 %, stays visible and editable with a note saying it doesn't match your profile. If you haven't answered a question — every existing user, until they choose to — every field is still shown; a one-off card on the Dashboard offers to review the new questions.
- Internal: one gating mechanism (`showWhen` on field/option/step config, `applyScenarioGates()` on every modal open); `APP.profileScenarios` is saved, exported and restored with the rest of your data; legislative fixture TC-012 (a hidden share taxes the full amount) and a smoke check with positive controls.

### QA remediation 2026-09 — QR10b (cloud backup Android plugin — switched off)

- **The Android side of cloud backup is built** (`CloudBackupPlugin`), still behind `CLOUD_BACKUP_ENABLED` = false, so nothing changes in the app yet. Each profile's encrypted backup goes to the Google account bound to that profile (never whichever account the phone used last), under a file name that contains no personal data; the latest and the previous copy are kept. Not yet verified on a device.
- **Free-trial sign-in no longer waits forever on a stalled connection.** Google Drive calls now time out (15 s to connect, 60 s to read) and report "offline" instead of leaving *Start free trial* waiting indefinitely. The trial-anchor code now shares its Google sign-in plumbing with cloud backup; its behaviour is otherwise unchanged.

### QA remediation 2026-09 — QR10a (cloud backup plumbing — switched off)

- **Fixed: encrypted backups, the on-device snapshot and JSON import left out part of your data.** Certificates on the IT3(b) page, business and retirement/lump-sum entries, other receipts, crypto, carried-forward CGT/foreign-tax balances, the travel/home-office/medical answers and Easy View were saved on the phone but missing from every exported backup, so importing one brought them back empty. Exports now carry everything the app saves. **Backups made before this update are incomplete — export a fresh one.** (Finding QX-DRV-6; check: a smoke test that populates all 20 fields, exports, imports and compares.)
- **Cloud backup to your own Google Drive is built but switched off** (`CLOUD_BACKUP_ENABLED` = false; the Android plugin arrives in QR10b, and the Play Data safety form and privacy policy change before it is switched on). Nothing appears in the app while it is off. When on: an opt-in toggle, *Back up now*, the time of the last cloud backup and — if one fails — the reason; restore of the latest or previous copy through the same import path as a file; Delete Account and Reset offer to delete the cloud copies too.
- The backup runs when the app locks, on sign-out, after you finish a step and after 30 minutes of use, only when something changed, never shows a Google prompt by itself, and backs off after a failure. Reminders (24 h, or 3 h and five steps) name the reason and appear only when you unlock, return to the app or finish a step.
- Internal: new import-free module `17-cloud-backup.js` (rules) and `18-cloud-backup-ui.js` (wiring); the bound Google account is sealed with the rest of your PII; the backup envelope captures the vault key before lock/logout clears it. `tests/cloud-backup.js` joins `npm test`.

### QA remediation 2026-09 — QR4 (contextual copy, cross-references, plausibility)

- **Notes that depend on your choice now show only for that choice.** Airbnb guidance appears only when the rental *Type* is Airbnb (it used to show in the Type tip, on the Expenses step and in the rental explainer for every rental). Equipment and Foreign leases each get their own note. Selecting *Vehicle / Equipment / Movables* as a capital-gains asset now explains the personal-use exclusion (a private car, caravan, furniture or appliance is not subject to CGT, and a loss cannot be claimed); the Tools & equipment modal says only work use counts.
- **Rentals: *Equipment lease* and new *Vehicle lease*.** The rule that a vehicle let to your own employer is treated as a travel allowance, not rental income, now shows only on *Vehicle lease* (it was a note at the bottom of every rental). Existing rentals keep *Equipment lease* with a "choose Vehicle lease if it is a vehicle" note. Both types are calculated identically.
- **Income and deductions now agree.** One table drives the Add-income tip, the note on a captured income row and the deduction pills, and each *Recommended* / *Consider* pill shows why (*"Your income includes 3715 (Subsistence Allowance (Foreign)) — you are paid a subsistence allowance."*, with a link to the income). Foreign subsistence (3715) now works on both sides; 3704 no longer prompts a travel deduction; the medical codes cite s6A/s6B, not s18A; 3821 (a bursary) no longer suggests a retirement deduction.
- **"Please check" notes on implausible input** (they never block saving): PAYE larger than all captured remuneration, or above the top marginal rate of it; business kilometres above the kilometres driven; office area above the home area.
- **Ring-fencing (s20A) is no longer explained while the app is not applying it**: the s20A explainer, the loss sentences in the business/rental/carry-forward explainers and the loss note in the rental and business modals now appear only if ring-fencing is switched on.
- **Typed figures replaced by data** in the CGT, tools, lump-sum and crypto copy (small-item limit, para 45 limit, annual exclusion, primary-residence exclusion). This corrects stale copy: the CGT explainer said the annual exclusion was R40 000. The tools option now reads *up to R7,000* (the code always allowed R7,000 itself). The TFSA-limit warning no longer falls back to a typed R36 000 when the year has no TFSA data.
- Checks: new smoke checks for option notes, the income ↔ deduction table, plausibility notes and typed figures (each shown to fail without the change); the CGT type options are read from the taxonomy.

### QA remediation 2026-09 — QR3 (investment and interest correctness; FX notice)

- **Exempt local dividends can now be entered** on the IT3(b) certificate (they had no input, although the engine and the tax-exempt income total already supported them). They raise your tax-exempt income and never your taxable income. Labelled with SARS source code **4306** (not 4292, which SARS assigns to s8E/8EA deemed dividends).
- The IT3(b) local-interest step now states the s10(1)(i) exemption for the year and your age, and how much is applied; the foreign-interest step says foreign interest is fully taxable and does not use the local allowance. The Investment page's *Taxable interest* card no longer pools foreign interest into the local allowance (display only — the tax calculation was already correct).
- The *Enter in foreign currency instead?* helper builds its currency list from the SARS rates published for the tax year; when SARS has not yet published rates (e.g. 2027) it says so up front and hides the converter.
- Checks: the CRUD field-existence check is now blocking; new legislative fixtures TC-010 and TC-011; new smoke checks for the interest notes and FX widgets.

### QA remediation 2026-09 — QR2.5 (count-up)

- Hero figures (Income, PAYE, Deductions, Dashboard balance, Taxation, the reward card, every income-bucket hero, and the Dashboard's summary cards) now count up the first time you actually see them change, not on every keystroke and not while you're on a different page. Returning to a page after capturing something new shows the figure animate from what it last showed to the new value; if nothing changed since you last saw it, it just displays the number.

### QA remediation 2026-09 — QR2.4 (duplicate step heading)

- The IT3(b) certificate wizard's first step no longer shows "Institution" twice (once as the step heading, once as the field's own label). A general renderer rule now applies to any wizard step whenever this happens, not just this one case.

### QA remediation 2026-09 — QR2.3 ("(optional)" dedupe)

- Fixed 8 fields that showed "(optional)" twice (Retirement lump sum date/tax withheld, Two-Pot date/tax withheld, IT3(b) account reference, CGT disposal note, Tools & equipment date, Other deduction code). Every IT3(b) amount revealed by its own chip (Local/Foreign Investment Income) no longer says "(optional)" at all — you chose to reveal it, so it is not skippable in the way that word implied.

### QA remediation 2026-09 — QR2.2 (info-btn inline geometry)

- The ⓘ on the two Deductions glance cards ("Retirement deduction cap" / "Tax saving"), the Tax balances "Donations not deducted" row and the "Non-deducted retirement contributions" row no longer wraps onto a line of its own. A shared helper keeps a label's last word and its ⓘ together, and the glance-card row now wraps to a second line when needed instead of forcing that unit into too little space (which had caused horizontal scroll at 150% text size). The retirement-contributions row was missed in the original QR2.2 commit — its own gate hadn't caught it because it was never re-run against all four known sites — and is fixed here.

### QA remediation 2026-09 — QR2.1 (capture routes)

- Tapping an outstanding item, an income-breakdown chip or a foreign-income row now goes to the page that owns that figure and arrives at its input: PAYE opens the PAYE page (and its add form when empty), a carried balance opens its own Tax-balances row with the opening balance focused, a deduction focuses its first field. Foreign-income rows previously did nothing when tapped.

### QA remediation 2026-09 — QR0 (harness extensions and report-mode audits)

No user-visible change. Test/tooling only: five new report-mode checks in
`tests/smoke.js` (CRUD field-existence, outstanding/breakdown-row routes,
render-chain invariant, ⓘ-inline geometry), one new pretest check
(`tools/check-static-form.js`), two new standalone audit tools
(`tests/modal-inventory.js`, `tools/lint-inline-figures.js`), and a
gate-coverage line in `STATUS.md`. See `docs/programmes/qa-remediation-2026-09/05-TRACKER.md` for detail.

### QA remediation 2026-09 — QR1 (sign-in, purchase landing, backup copy)

- If your Google account has already used its free trial (for example after
  a reinstall), starting the trial now says so, instead of *Sign-in not
  completed — try again*. The locked-feature dialog no longer says your trial
  has ended when it has never started.
- Google sign-in no longer appears on app start, PIN unlock or return to
  the app. It is shown only when you choose to start the free trial (welcome
  screen, or the new **Start free trial** button on Go Premium while the
  trial has not started) or restore purchases before the trial is verified.
  Android side needs a device check before release.
- If starting the trial fails, the message now says why where the app can
  tell (offline, Google Play services missing), and you can retry from Go
  Premium.
- After buying or changing a plan, the app takes you to the Dashboard with a
  confirmation.
- After a successful backup import, the app lands on the Dashboard under the
  import result.
- The FAQ's backup answer points to **Backup, export, Restore** in the menu
  and no longer claims Android syncs your data; the import confirmation no
  longer promises a recoverable snapshot the app cannot restore.
- If you revoke InspiredTax's Google Drive access from your Google Account
  settings, starting the trial now shows Google's own re-consent screen
  instead of silently failing with no way back in.
- About → Privacy & Data no longer says the app "never transmits any data
  or makes any network request" — on Android it does, for Google sign-in,
  the free-trial check and Google Play purchases. It now says exactly what
  is sent and why.
- If saving your free-trial start date to Google Drive fails, the app now
  quietly retries on your next unlock instead of giving up — so a brief
  connectivity gap right when the trial starts can no longer cause a
  reinstall to appear as a brand-new trial.

### Owner-raised fixes, outside the QA brief (`Q-NEW-1`/`Q-NEW-2`)

- The Deductions page's "total deductions" count now counts a deduction as
  active only once it has actually reduced your tax, not just because its
  toggle is on.
- New: an opt-in **Easy View** in the menu, for anyone who finds the
  default text and icon sizes too small. It steps every size up app-wide
  and shows a reminder each time you use the app that some layouts may not
  look exactly as designed at that size. Off by default; remembered per
  profile.

### Planning — QA remediation 2026-09 (documentation only)

- Owner QA brief of 2026-09-25 planned as `docs/programmes/qa-remediation-2026-09/`:
  every item verified against `src/` at `3d6ac5c`, extrapolated app-wide, and
  sequenced into standalone batches QR0–QR12 with a single live tracker.
  A retrospective of the prior two months' programmes corrected two records
  that overstated completion (calc-audit F5 exempt dividends; simplification
  E7 count-up) and relabelled six BACKLOG items that were Claude's to draft,
  not the owner's to decide. No `src/` or artifact change.

## [8.34.2] — 2026-09-20

### UI/UX polish pass 2026-09 — built, B0–B10

Owner brief of 2026-09-16, planned across `docs/programmes/ui-ux-polish-2026-09/`
(findings register, 31 settled owner decisions, per-batch build instructions,
an independent audit and its measurements — design reference
`_mockups/ui-polish-2026-09.html`) and built end to end, eleven batches.
**Round 2 (2026-09-17): `D-19` reversed `D-3`** partway through planning —
icon tiles stay one colour per page, app-wide, with the Dashboard as the
standing per-section exception — which *shrank* the pass by withdrawing
scope change `SC-1` before any code touched it.

- **B0 — test harness first (`D-17`).** The 150 % Android font-scale pass
  (on top of 100 %/125 %), a modal overflow sweep (modals were never gated
  before), and a text-collision assertion against both a standard and a
  long-content fixture. This is what found `OVF-1`'s overflows and let B10.1
  fix them with a real regression test behind them, not a screenshot.
- **B1 — icon and tile standard (`ICO-1`, `ICO-2`, `ICO-4`, `D-19`, `D-20`).**
  Icon tiles recolour to one hue per page via `--area-accent`, not per row;
  the Taxation nav rail's six inline per-tab pill colours are deleted in
  favour of the same page-wide accent. Seven glyph-on-tile colour pairs that
  failed 4.5:1 contrast are fixed, and that check is now gated in `pretest`.
- **B2 — row density and safe area (`ROW-1`, `GEN-1`, `GEN-2`, `D-7`,
  `D-22`).** Tighter list rows app-wide (`--row-min-h`, 44 px, the WCAG
  2.5.8 floor) and a separate, knowingly-lower form-field floor
  (`--field-min-h`, 40 px) — two tokens kept deliberately distinct so a
  later pass can't collapse list rows and form controls onto one number.
  Top-of-page safe-area clearance fixed on every surface.
- **B3 — app chrome (`D-6`, `D-2`, `D-4`, `D-23`, `M1`/`M3.5`).** The Profile
  pill, heading visibility/colour rule, and the billing chip's copy revised.
- **B4 — login (`LOG-10`…`LOG-16`).**
- **B5 — onboarding (`ONB-3`…`ONB-6`, `ICO-3`, `TRIAL-1`, `EXT-OVL-1`)**, plus
  a follow-up landing colour-area plumbing for Taxation's Tax risk/Prior
  years/Projection tabs (a navy placeholder pending a real hue decision).
- **B6 — Dashboard rebuild (`D-9`, `D-26`…`D-29`, `SC-5`).** The reward card
  becomes a collapsed-by-default disclosure; the balance card gains an
  expandable composition bar; "Your return" drops its ring and Kat mascot
  for a centred per-area outstanding count, with the completion percentage
  now genuinely items-done ÷ items-applicable rather than section-based.
- **B7 — Income (`INC-1`…`INC-11`, `IEM-1`…`IEM-3`).** The Foreign income row
  no longer switches on to a dead end; the PAYE-withholding note gets a
  confirm-before-relying-on-it caution; the Income hero gains an expandable
  circle-graph breakdown by income type; foreign-currency toggles clear their
  FX fields when hidden (a hidden control still reached the tax calculation
  otherwise — the one change in this batch that could move a computed figure).
- **B8 — subscribe screen rebuild (`DED-1`, `PREM-1`/`D-16`).** Three plans
  visible (the launch offers plus Monthly), the rest behind "More plans";
  a single collapsible Free-vs-Pro table replaces two duplicated benefit
  lists; the "Your tax position so far" hero card, encryption-reassurance
  copy and tax-balance references are removed as unrelated to a plan choice.
- **B9 — Taxation and tax balances (`B9.1`–`B9.5`).** Back bars added to all
  six Taxation tabs; the "Tax at a glance" cards get category colour and an
  expandable circle-graph breakdown of taxable income; captured tax balances
  show a real three-line opening/movement/closing reconciliation instead of
  one sentence, completing the assessed-loss used/carried split's move from
  Income to Tax balances (`D-14`) in the same commit as its deferred
  deletion. The tax-balances list's row *generation* deliberately stays
  static DOM rather than migrating to the shared selector-list renderer —
  documented as a considered deviation, not an oversight.
- **B9.6 — tax hero state machine (`TAXHERO-A`…`H`, `D-13`).** One
  classifier, nine states (`D-13`'s eight plus a `BALANCED` state the table
  didn't have a row for), consumed by both the Dashboard balance card and
  Taxation's own hero so the two can never disagree about what state a
  return is in. Fixed two cases that were producing false statements before
  this batch: a taxable retirement lump sum no longer reads "No tax due",
  and a lump-sum-only capture no longer reads "no income captured".
- **B10 — overflow sweep, text sweep, documentation.** The four remaining
  150 % font-scale overflows fixed at their real, distinct root causes (a
  shared button label with no wrap fallback, a grid item with no
  `min-width:0`, and one nowrap rule catching a plain word instead of the
  figure it existed to protect) — 150 % is now a plain hard gate, same as
  100 %/125 %. The text-collision sweep and its Rental two-line pattern
  target were verified clean against both fixtures, not newly built — they
  do not currently reproduce. `STATUS.md`/`BACKLOG.md` corrected: several
  items this pass's own plan doc named as "absorbed" (the Dashboard's own
  `.mini-card` circle graphs, `HERO-2`/`DASH-7`/`INC-7`/`INC-20`) were
  checked directly against `src/` and are **not** actually built 

## [8.34.1] — 2026-09-19

— a
  different card system (the Income hero and Taxation's "Tax at a glance")
  happened to satisfy the neighbouring `INC-9`/`TAX-3` asks instead.

## [8.34.0] — 2026-09-19

Thirty-one owner decisions settled across the pass (`D-1`…`D-31`). Three
decisions from the earlier design-system audit were revised along the way —
icon-tile colour (no longer a reversal in substance; `D-19` restored what
that programme's own decision already said), the Taxation back-bar decision
(`OD-18`, reversed by `D-11` — a back bar is now present on all six tabs),
and the trial-copy branch split (`D-8` — both native and browser builds now
carry the brief's wording verbatim). See `02-DECISIONS.md`'s "Reversals
recorded" table and `OWNER-DECISIONS-2026-09.md`'s header note.


## [8.33.8] — 2026-09-15

### Claude.md and Status.md
- CLAUDE.md and STATUS.md are read on most turns; trim both to essentials
  and drop the "npm test for any change" default in favour of a gate scaled
  to what the change actually touches (docs → nothing, CSS-only → pretest,
  JS logic → npm test, tax engine/data → test:engine, release → test:release).

### Delivered phase/batch
- The DELIVERED phase/batch list duplicated CHANGELOG.md and
  docs/archive/AUDIT_REPORT.md, which CLAUDE.md already designates as the
  source of truth for history. Point there instead of maintaining a second
  copy; keep only the standing architectural items with nowhere else to live.

### Fix residency gate error

#### Move resaidency gate
- The QA 2026-08 residency-gate CSS (e8ab3c7) inserted its comment and new
  .residency-gate rule before closing the prior selector list instead of
  after it: login-screen, .app-body, .mode-panel, /* comment */
  .residency-gate { position: fixed; inset: 0; z-index: 150; display: flex;

#### CSS
- Since CSS comments are invisible to the parser, .app-body and .mode-panel
  the wrappers around the entire app, not just the gate — inherited the
  gate's position:fixed/inset:0/z-index:150/display:flex rules. That put
  ordinary dashboard content above the header (z-index 100) on every
  screen, for every user, hiding the hamburger button and profile pill
  behind it since that commit — unrelated to the residency-gate feature
  itself, which behaves as designed.

#### Onboarding
- Closes the original selector list before the comment/new rule, and drops
  the now-duplicate #onboarding-overlay rule left over from the same edit.

#### Hamburger and profile pill
- Fix header/hamburger/profile-pill hidden behind dashboard content.

#### Rollback
- UX rollback prototype: restore nav labels, undo wide geometry pas

### Reverts:
- Re-apply 103199d: batch 4 part 1 geometry/IA fixes + hero prototype
- Remove accidentally committed node_modules symlinkFix ONB-2 onboarding 
- Revert 8a1dc46: batch 6 part 1 wide lip/tile/pill geometry + IA changes
- Revert 103199d: batch 4 part 1 geometry/IA + hero prototype
- Revert 09f4277: icon-only nav pills

## [8.33.7] — 2026-09-14

### Release tooling — skip CI on generated release PRs

#### Changed
- `ci.yml` no longer runs its gates on the `release/*` pull requests that
  `build-inspiredtax.yml` opens. That workflow runs the same suite —
  `check:version`, `test:release`, `smoke` — against the same tree in the same
  job that then opens the PR, so a second run proves nothing.
- This is a job-level `if` on `github.head_ref`, not an `on:` filter, because
  for `pull_request` the `branches`/`branches-ignore` filters match the **base**
  branch and release PRs target `main` like any other. Pushes and manual
  dispatches are unaffected (`head_ref` is empty for those), and a branch merely
  beginning with "release" rather than "release/" still runs.
- Scope: this skips the job. GitHub still creates the workflow run for a
  bot-authored PR and holds it at `action_required`; that badge is a
  repository/token setting, not something a workflow file controls. It does not
  block merging — such a PR reports `unstable`, not `blocked`.

## [8.33.6] — 2026-09-14

### Release tooling — signing-certificate check and PR-level CI

#### Fixed
- **`Configure release signing` failed with an empty fingerprint.** Run 27
  cleared the version gate and the whole test suite, then died on
  `UPLOAD KEY CERTIFICATE MISMATCH` with `Actual:` blank. Commit `eb2c7fc`,
  whose message describes only moving the step ahead of the Capacitor sync,
  also silently changed how the fingerprint is parsed:

  ```diff
  - sed -n 's/^[[:space:]]*SHA256:[[:space:]]*//p'
  + sed -n 's/^[[:space:]]*SHA256 Fingerprint: //p'
  ```

  `keytool -list -v` prints `<tab> SHA256: AA:BB:…` beneath
  `Certificate fingerprints:`. "SHA256 Fingerprint" is **openssl's** wording
  (`openssl x509 -fingerprint -sha256` → `sha256 Fingerprint=…`), so the new
  pattern matched nothing and the step compared the real expected value
  against an empty string. Verified against a throwaway JKS on Java 21: the
  old pattern extracts the 95-character fingerprint and correctly prefers
  SHA256 over the SHA1 line above it; the new one returns zero characters.
  The AAB check further down the same workflow still used the correct
  `SHA256:` form — the two had silently diverged.
- All three fingerprint extractions (upload keystore, release APK via
  `apksigner`, release AAB via `keytool -printcert`) now fail with an explicit
  "could not parse" message when the capture is empty. An unparseable
  fingerprint is a tooling-format failure, not a wrong signing key, and
  reporting it as a certificate mismatch sent this diagnosis down the wrong
  path. The comparison itself is unchanged: a genuinely wrong certificate is
  still rejected.

#### Added
- **`.github/workflows/ci.yml` — the repository's first PR-level CI.**
  `build-inspiredtax.yml` was the only workflow and is `workflow_dispatch`-only,
  so `npm test`, `tests/smoke.js`, the engine gates and `check:version` ran only
  when a release was dispatched by hand. That is why the STATUS.md reformat in
  `4bb88f6` broke the release pipeline silently on 2026-09-09 and was not found
  until 2026-09-13, costing six failed dispatches. CI runs `check:version` (in
  under a second, before Chromium is even provisioned), `npm run test:release`
  and `node tests/smoke.js` on every push and pull request, with no paths
  filter — STATUS.md and CHANGELOG.md are release inputs and are checked like
  any other source file. Confirmed against history: `check:version` exits 1 at
  `4bb88f6` itself, so this workflow would have caught that break on the
  offending commit.

### Release tooling — "Build InspiredTax" workflow restored

#### Fixed
- **The release workflow could not get past its own version gate.** The
  docs cleanup in `4bb88f6` reformatted the STATUS.md "Current build" bullet
  from `**Version**: 8.33.5` to `**Version** 8.33.5`. Two release tools
  matched that label with their own separate regexes, both requiring the
  colon: `tools/release-bump.js` (which rewrites the line) and
  `tools/check-version-sync.js` (which gates on it). The bumper started
  reporting `WARN: **Version**: line not found` and exiting 2, failing the
  workflow's "Bump release version" step; repairing only the bumper's regex
  moved the failure one step later, to `npm run check:version` reading the
  STATUS.md version as `null`. No APK or AAB has been produced since.
- Both tools now import a single shared matcher, `tools/status-version.js`,
  so the pattern cannot drift between them again. It accepts the label with
  or without the colon and an optional `v` prefix, and requires a semver, so
  a future reformat of the surrounding prose does not break a release.
  `replaceStatusVersion()` rewrites whatever version it finds rather than
  requiring a specific one, so a STATUS.md that has already drifted is
  corrected by the bump instead of being left stale.
- **STATUS.md's `versionName` was never bumped.** The same reformat added an
  Android `versionName` figure to the "Current build" bullet that
  `release-bump.js` had no handler for, so every release would have shipped a
  STATUS.md reading `versionCode 83400, versionName 8.33.5`. The bumper now
  rewrites `versionCode` and `versionName` through the shared module, and
  `check:version` gates both: absent from the prose is fine and reported as
  skipped, present but wrong now fails the release.

### Design-system audit 2026-09 — Batches 0b through 6

Full programme: `docs/product/DESIGN-SYSTEM-AUDIT-2026-09.md` (the audit,
§A–§M) and `docs/product/OWNER-DECISIONS-2026-09.md` (52 owner decisions
across 6 tiers, recorded 2026-09-10, plus OD-18 confirmed 2026-09-13). Two
independent QA passes plus three internal sweeps (§I/§J/§K) produced ~280
findings; every batch below cites its governing finding IDs and decision
numbers. Gates run per batch: `npm test` + `node tests/smoke.js` always;
`npm run test:engine` whenever `01-data.js`/`02-core.js`/a deduction or
income module changed. All green throughout — no golden-suite drift, no
tax-math change except where explicitly noted as engine-remediation
verification (never a behaviour change).

#### Fixed
- **SESS-4 (Tier 0, highest-severity finding in the audit).** Session
  teardown (`clearAllUserFields()`) named only 62 of 160 form field ids; 89
  fields survived logout and 44 of those reached `calcFullTax()` — one
  user's company-car kilometres, medical dependants, subsistence days or
  foreign income could silently carry into the next account's return on a
  shared device. Fixed both halves of owner decision 0.1 (option B): logout
  now does a full reload (`doLogout()`), and `clearAllUserFields()` is
  separately rebuilt selector-first from markup defaults (`defaultValue`/
  `defaultChecked`/selected `<option>`) rather than a hand-maintained
  allowlist, since `restoreData()`/`showCreateForm()` call it too and must
  not reload. `assertPiiFieldsCleared()` (decision 0.4C) now takes a list of
  DOM mirrors per PII field, not one, and is demonstrated firing against a
  known-bad state in `tests/smoke.js` (33 populated fields → guard reports
  → clean teardown).
- **ROW-22 (decisions 0.2/6.4).** A "Completed" income row's toggle was
  inert — `_on = _active || declared` repainted itself back on regardless of
  the switch. Two-branch fix: PAYE warns and allows (matching its existing
  confirmation copy); every other row blocks the untoggle while it holds
  captured entries and says why. Soft-exclusion (a third engine-input state)
  was explicitly rejected as a tax-correctness risk.
- **The `.gc-val` regression** Batch 1 shipped — prose clipped instead of
  wrapping (129px of content in a 98px box at 360px). A `.prose` modifier now
  exempts the two call sites that carry prose/multi-amount captions from the
  shared `nowrap` rule.
- **INC-17** — a bonus (3605) or commission (3606) code left Employment
  income stuck in "Still to add" and "Completed" simultaneously, because the
  same category codes also exist under the Foreign bucket. Fixed with a new
  source-code index (`EMPLOYMENT_INCOME_CODES`) instead of widening the
  ambiguous category test.
- **BAK-5** — a literal `cloud_done` ligature string rendered as text beside
  the icon instead of as the icon.
- **A11Y-1** — the PIN-entry modal bypassed `openModal()`/`closeModal()`
  (no focus trap). Re-sweeping for the *pattern* (not just the reported
  instance) found a second, more serious case: the onboarding-guidance
  overlay set `display:flex` directly, which `.modal-overlay`'s CSS never
  reveals without `openModal()`'s `.open` class — the dialog was invisible
  and undismissable, and re-armed on every visit. Both migrated.
- **BAK-6/OD-41** — the backup status card was titled "Auto backup current"
  next to a cloud icon, unconditionally, showing a local file's mtime as if
  it were a cloud backup. Nothing was fabricated, but the label overclaimed
  off-device safety the app cannot verify. Now shows "Last manual export:
  [date]" / "Never — export a backup" (new `SK.lastExport(user)`, recorded
  by both export paths), a neutral icon, and drops an unverifiable "Android
  may sync this automatically" line — see Deferred, below, for the cloud
  state this does *not* attempt to fix.
- **Icon collisions (Batch 3, §B.4)** — `badge` was both Employment income
  and Professional memberships; `savings` was both Retirement income and
  the Retirement deduction. Ten reassignments total, including an
  Employment/Business icon swap.
- **ICON-1/22/23 — selector-row icon colour.** 15 of 19 selector rows wore
  another area's category colour (Employment in PAYE blue, Business in
  Deductions violet, CGT/Crypto in Tax-Balances amber, etc.) — the reported
  "doesn't read well in dark mode" complaint on Retirement was a wrong
  colour, not a contrast problem. Now a consistent three-state rule: Still
  to add → amber, Completed → the row's own category colour, Off → neutral.
- **N3/N4** — every captured-item row's delete control is now a trash-can
  icon (nine sites used a close glyph) and reads red *at rest*, not only on
  hover — hover is unreachable on the touch device this app runs on.
- **Two vendoring near-misses caught by validation, not shipped broken** —
  `swap_horiz_circle`→`swap_horizontal_circle`, `shield_questions`→
  `shield_question`. An unvendored icon name renders nothing, silently, with
  no failing test; a new `tests/smoke.js` gate now fails the build if any
  rendered Material Symbols element resolves to no glyph.
- **RA-7 truncation risk** and other short-label clarity fixes verified
  against the new 360px overflow gate — see Testing, below.
- **RENT-9** — the rental-modal live gross/expense/net calculation showed on
  every wizard step instead of only the last one that has data to show.
- **STD-IA-3 — six help topics had drifted into two independently-edited
  copies** (a page "About X" accordion and the topic's Add/Edit modal
  notes): IRP5/IT3(a), PAYE & UIF, rental, business & trade, CGT, s18A
  donations. Each pair was read and diffed, not assumed current — most held
  true facts the other had silently dropped. Unified into one source per
  topic (`TOPIC_HELP`, `01-data.js`); the two copies can no longer diverge.
- **Two double-plus-sign buttons** ("+ Add employment income", "+ Add
  receipt") found while faithfully copying real markup into a prototype —
  an `msi-add` icon (itself a + glyph) followed by a literal "+" in the
  label. Fixed in production, matching the one button on the same page that
  already had it right.
- **OD-18 (NAV-3/TCR-1/ICON-11)** — "Provisional Tax & Deadlines" and "Tax
  balances" looked like tabs of the Taxation nav bar but were cross-panel
  jumps: one to a standalone `mode-provtax` panel, one into a tab faked
  inside Income with a synthetic back-bar and a special-case tab-bar swap.
  The amber (Tax Balances) and rose (Provisional Tax) colouring were side
  effects of the panel change, not a designed exception. Both are now real
  tabs of the Taxation panel (`switchTab('summary', 'provtax'|'prioryear')`)
  with the colour exception coded explicitly; all dead compensating
  scaffolding removed (redirect stub, fake tab-bar swap, orphaned
  `PAGE_HEADS`/`PAGE_HELP`/`ENT_SCREEN_KEYS` entries).

#### Changed
- **Copy sweep (Batch 2, ~20 items)** — sentence case on 26 add/edit labels;
  one name for the tax-return screen (drawer vs. tab bar disagreed); "What
  you can claim" → "Deductions"; "Sales: capital gains or losses" → "Capital
  gains & losses"; consolidated PAYE/IT3(b) add-buttons; retirement-carry
  wording rewritten and length-checked at 360px; the mandatory 600ms
  press-and-hold on destructive confirms **removed** (owner decision N5,
  explicitly reversing an earlier 2026-08 decision to add it); U+00A0 in
  amounts normalised to a plain space on export/copy paths only, display
  unchanged. Two items were explicitly investigated and left unchanged
  because the QA documents misquoted the source (ROW-20, RENT-3/5/6 partial)
  — resolved later in Batch 5 once the real strings were found by content
  search instead of stale line numbers.
- **`--rose` ratified for Provisional Tax** (TOK-9/6.14) and the Cumulative
  PAYE chart's steel-blue line and the 5-violet/5-amber onboarding-icon
  split (both shipped pre-audit) ratified by the owner rather than reverted.
- **Nav-pill geometry (Batch 4, §L.6.1, owner-exported from
  `_mockups/lip-tile-pill-prototype.html`).** `.tab-btn` is now a fixed
  48×48 icon-only square (was a padded text pill); labels removed from all
  8 render sites (4 static tab bars, 4 dynamic JS templates) once both
  preconditions decision 3.1/N-1 set were independently verified: a
  page-heading audit of all 39 mode/tab screens (zero missing headings) and
  an `aria-label` added to every pill (25 pills). Removing the text, not
  just resizing the box, is what actually cleared the 360px overflow gate
  (0 violations vs. 59 in an earlier same-geometry, labels-still-on
  attempt).
- **Row/tile geometry and colour (Batch 4/6, wide scope per owner
  decision).** The §L.6.1 export moved the *shared* rules
  (`[class*="ico-bg-"]`, `.ob-tile`/`.inc-tile`/`.ded-tile`/`.yn-tile`), not
  per-row overrides. "Completed" status no longer paints every category in
  one shared green — new `row-accent-*` classes set only a `--row-c` custom
  property (mirroring the icon-colour map without triggering the full
  35×35 icon-chip visual system on the whole row). `.dhero`/`.stat-card`
  borders 1px→1.25px (owner declined an added glow — colour stays fill-only
  per OD-8); tile labels clamp to 2 lines.
- **STD-IA-4/OD-18 drawer reorganisation** — Provisional Tax moved from its
  own top-level drawer section into the Taxation group, alongside Tax
  Calculation and Tax Balances (see Fixed, above).
- **NAV-4** — Historical Calculator is no longer a standalone mode; its two
  tabs (`summary-calculator`/`summary-comparison`) fold into the Taxation
  tab bar, inheriting navy instead of a former standalone cyan. The
  composite screen-key rename (`hist-calculator`→`summary-hist-calculator`
  etc.) touched entitlement gating, page-help tips, the drawer, FAB config
  and both panel-walking test fixtures in lockstep.
- **NAV-1/2, BAK-1** — the empty Settings drawer container removed;
  Light/Dark toggle unnested under Profile; Backup & Export promoted to a
  top-level drawer item with its own modal.
- **ONB-6** — tax-year settings moved out of "Other Information" into a
  dedicated Tax Year section.
- **TCR-2** — reward card moved to the top of the tax-return page;
  "Congratulations… Enjoy!" moved into its expanded state.
- **INC-9 — At-a-Glance card inventory (Income main).** Deleted a confirmed
  duplicate (two chips repeating figures the mini-cards above already
  showed); relocated the one unique chip (Income Split) below the hero
  alongside the mini-cards; the remaining two chip groups were confirmed
  not duplicated elsewhere and left in place.
- **Confirmation-dialog contract (Batch 5, GLOB-3/TB-2/CONF-3/4/7/8/
  STD-BEHAV-1/2)** — a new amber `'toggle'` confirmation tier replaces the
  old `'tax'` tier for switching a category off: drops an eyebrow claiming
  "Changes your return" and a body sentence that overclaimed tax exclusion
  (CONF-6 already established that toggling off a category does not by
  itself exclude its entries from the engine). Typing a real opening
  balance into a carried-balance row still flagged "No" in onboarding now
  prompts to flip that answer to "Yes" (`onCarriedBalanceAmountChange`) —
  previously only the display bucket changed, never the underlying answer,
  so Profile's mirrored question could silently disagree with what was just
  typed. New `APP.provisionalReviewNeeded` flag stops the provisional
  auto-determination from silently moving `p_provisional` the moment a
  contradiction is synced for a provisional-triggering income type, with a
  non-blocking "Reviewed, thanks" notice instead (STD-BEHAV-2/OD-17) —
  scoped to the one call site that actually feeds the determination; entry
  deletion across `makeCrudModule` delete sites is a broader surface not
  covered here.
- **RISK-4/OD-32** — removed the "Prior year retirement excess c/f"
  audit-risk rule; its weight-2 contribution to `maxScore` goes with it so
  other users' HIGH/MEDIUM/LOW banner doesn't shift for an unrelated
  reason. The two adjacent retirement risk rules are explicitly unaffected.
- **EMP-3/OD-25** — extended the contextual deduction-suggestion notes
  (Add Income code dropdown + captured-row notes) with six more source
  codes (Travel, Subsistence, and one code each for two already-covered
  categories), each citing `DEDUCTION_DEFS`' own code field.
- **Foreign Income selector row rebuilt as a full 2×2 (INC-2/3/4/5)** —
  previously a single "already captured" toast regardless of what was
  actually captured, and always visible even with nothing declared. Now:
  declared+captured needs an attestation checkbox before it reads
  Completed; declared+uncaptured stays Still-to-add with no checkbox yet;
  undeclared+captured reads Completed directly; undeclared+uncaptured does
  not render. New persisted `APP.foreignIncomeAttested` flag backs it.
- **N1 — "Clear all fields"** added to four single-calculator, no-list
  deduction pages (travel allowance, company car, home office, local/
  foreign subsistence) that had no delete affordance because there is no
  list item to remove.
- **RENT-13/14** — the "Bond interest vs. instalment" and "Repairs vs.
  improvements" explainer notes moved from two disconnected accordions at
  the foot of the rental modal to show contextually on the expense row the
  moment its category matches.
- **Copy deletions found by content search rather than stale line numbers**
  (ROW-20, RENT-3/5/6) — three redundant "nothing captured yet" instances
  removed from Income Main; five of six rental-note deletions applied (the
  sixth's target string never existed in `src/`, confirmed and left alone).
- **getIncomeOutstanding() rebuilt data-driven (OD-21/STD-BEHAV-6, decision
  3.4/6.10)** over the full income-type table via one lookup table,
  replacing eight hand-written `if` blocks — and fixing a real gap the
  hand-written version had no branch for at all (`other_income`, bucket 9),
  which is the specific mechanism behind HERO-16's "one captured type reads
  100%" ring-denominator bug. **Fixed at the source, for the income side
  only** — see Deferred, below, for what this does not yet reach.

#### Removed
- `RENT-15` — the free-text Note field on each rental expense row (data
  loss checked and ruled out: the collector already reads it defensively).
- The dead `income`/`provisional` redirect-stub tab, and the
  `updateIncomeTabs()` special-case that swapped in a fake tab bar whenever
  the SARS-account tab was active (both obsolete once OD-18 landed).
- `renderDeductionsOutstanding()` and its bottom-of-page "still to add" div
  — a second render of the exact list already driving the top of the page.
- Three duplicate add-CTAs that repeated an add action already available
  elsewhere on the same screen (Income Main and PAYE/Employment empty
  states).

#### Prototyped, not yet implemented
Per the repo's change process (`CLAUDE.md`), these were designed and
verified in `_mockups/` and merged as reference — **`src/` does not yet
implement either**:
- **HERO-2/8/14** (`_mockups/hero-breakdown-prototype.html`) — a real
  composition ring per mini-card, a secondary segmented outstanding-items
  ring plus an always-visible legend on the completeness card, and a
  tap-to-expand donut inside the balance Hero breaking gross income into
  taxable income (by income type)/exempt income/deductions, with tax
  payable → rebates & credits → refund/owing as a separate arithmetic
  strip. Verified against both a refund and an owing scenario.
- **STD-BEHAV-4/5** (`_mockups/selector-behavior-prototype.html`) —
  mutually-exclusive, collapsed-by-default Completed/Off sections (Income
  Main already ships the collapse half; Deductions Main ships neither
  half) via native `<details name="...">`, zero JS; and a persistent
  add-CTA that relabels rather than disappears once a list has entries.

#### Deferred
- **BAK-3/4 — the 3-state cloud-backup indicator and an explicit cloud
  restore workflow.** Scoped out per owner decision 6.2: the app cannot
  observe whether or why an OS→Google sync happened, so the reason-coded
  cloud states the audit specified are not buildable as written. A
  step-by-step implementation plan for **app-managed** Google Drive backup
  + restore is written (`docs/product/BACKUP-DRIVE-PLAN-2026-09.md`, not
  built) — it establishes the `drive.appdata` OAuth scope this needs is
  already requested by the existing Google sign-in (`TrialAnchorPlugin.java`).
- **HERO-9/HERO-16 dashboard completeness ring** — `dashCompleteness()`
  still computes `filled ÷ steps.length` (section-based), not items ÷
  items-applicable. The definition is decided (3.4/6.10) and the specific
  bug it was meant to fix is patched at the source for income
  (`getIncomeOutstanding()`, above) — the ring itself and its "x steps
  left" copy are unbuilt. Tracked in `BACKLOG.md`.
- **DASH-7/INC-7/INC-20** — the four dashboard mini-card circle graphs, a
  gross-income-by-type breakdown, and the Income page's hardcoded decorative
  polyline chart remain unbuilt in production (a real, data-driven version
  of the same idea now exists only as the HERO-2/8/14 prototype above).
  INC-20's foreign-dividend s10B(3) ratio (20/45 taxable, per OD-42) is
  independently verified correct in the engine via a legislative fixture
  (`TC-002`) — only the reconciliation *card* is missing.
- **6.1 — s11F(2) tax-technical review.** Decided (commission an external
  review before RA-2/RA-12 are built) but not commissioned this session;
  current engine code applies limbs (a) and (b) of the cap. Tax-correctness
  item — do not build RA-2/RA-12 ahead of it.
- **A real Travel-deduction pill-trigger mismap, found in passing (not
  EMP-3's own scope)** — `recommendDeductionFor()`'s Travel rule
  (3701/3704) has the same 3704↔3722 code confusion EMP-3 fixed in the
  contextual tips, on a separately-owned mechanism (which pill shows,
  not what the tip says). Flagged for the owner, not fixed here.
- Audit to-do items not reached this session: the render-path inventory
  (every card/hero/row against the six component categories), the RENT-7
  AirBnB copy rewrite, RENT-11/12's unresolved source-string question, the
  RISK-2 eFiling-sourced candidate-field list, the GLOB-2 statutory-citation
  keep/remove sweep, and the full ITR12 SARS-code audit for deduction hints
  (EMP-3 shipped only the closed 13-code list).

#### Testing and verification
- New permanent gates added this programme: a 360px overflow check across
  every panel (`tests/smoke.js`, demonstrated catching a real regression
  before it was trusted), a check that every rendered Material Symbols
  glyph actually resolves to an icon, and a contrast sweep extended to
  glyph-on-tinted-icon-chip colour pairs (advisory — surfaced 7 real
  sub-4.5:1 pairs, mostly light mode, as a palette decision for the owner,
  not gated).
- Every batch verified with `npm test`/`node tests/smoke.js`, and
  `npm run test:engine` wherever engine-adjacent files changed — zero
  golden-suite drift throughout (`tests/expected.json` byte-identical),
  8 legislative fixtures and 14 `calcFullTax`/`calcTaxForYear` differential
  checks green on every engine-gated commit.
- `tools/vendor-assets.js` fixed to run on Windows (it shelled out
  POSIX-quoted commands via `cmd.exe`, which doesn't honour single quotes) —
  unblocked Batch 3's icon vendoring, which the audit had wrongly recorded
  as network-blocked.

## [8.33.5] — 2026-08-31

### Changed
- Icon tiles across the app adopt the "Tinted front" lip construction from the `lip-tile-options` design exploration: the tile face now carries a 12% wash of its own section colour with a 22% tinted edge, and the lip behind it runs at full chroma with a tighter 2.5px offset — so a tile reads as one object in two tones instead of a dark hole with a bright sliver beside it on the dark canvas. The white inset highlight is gone and light mode uses the same construction.
- Material Symbols glyphs move from weight 300 to weight 400 (grade +50, outline), so the icon strokes hold their own against the tile behind them. The vendored icon subset was re-baked at the new weight (`vendor/material-symbols-subset.woff2`) — Google's css2 API pins the weight axis into the file it serves, so the CSS alone could not do it.

## [8.33.4] — 2026-08-30

### Added
- Company car / right-of-use-of-vehicle deduction (IRP5 codes 3802/3816): a new Company Car section on the Travel deductions page reduces the taxable benefit by business-use ratio (logbook-based) and by fuel/maintenance costs the employee bore personally, per the Seventh Schedule.
- Personal service provider disclosure on Business & Trade records: three questions (major-client concentration, client control, employee headcount) surface a warning when your answers suggest SARS may treat you as a deemed employee rather than an independent contractor — informational only, does not change your calculation.
- Foreign-currency entry: an optional "Enter in foreign currency instead?" toggle next to foreign interest, dividends, foreign tax paid, rental, business income and pension fields — converts USD/GBP/EUR/AUD to Rand using the SARS-published average exchange rate for the tax year, then fills in the Rand amount as usual.
- Foreign subsistence allowance (overseas travel): a new calculator using SARS's per-country deemed daily rates (~190 countries) converts the deemed amount to Rand and works out your deduction, alongside the existing local subsistence calculator.
- Public Office Allowance (IRP5 code 3708) and foreign subsistence allowance (code 3715) added to the income-code list — both were previously impossible to capture correctly.
- Ownership share (%) field on Rental properties, IT3(b) certificates and CGT disposals — if you co-own an asset or joint account with someone else, only your own share of the income, interest, dividends or gain is now included in your tax calculation. Enter the full property/certificate/disposal amounts as before; your share is applied automatically. Defaults to 100% (no change for anyone who owns solely).

### Fixed
- A subsistence allowance already paid tax-free by your employer (code 3714, within the SARS deemed daily rate) was incorrectly also generating its own tax deduction — effectively double relief on income that was never taxed. Now only a subsistence allowance paid ABOVE the deemed rate (code 3704) can generate a deduction; the tax-free portion is disclosed but no longer double-counted.
- The 2026 tax year's local subsistence deemed daily rates were wrong (R522/R152, from a since-superseded secondary source) — corrected to the SARS-published R570/R176, with 2025 added and 2027 re-confirmed directly from SARS's own rates page.
- The subsistence deduction card didn't recalculate automatically when your income changed elsewhere in the app — it only updated when you typed directly into its own fields. Fixed alongside adding the new foreign subsistence calculator.

### Testing and verification
- `npm run test:engine` and `npm run test:release` green (zero golden/legislative/reference-constants drift beyond new additive fields, reviewed line-by-line).
- `node tests/smoke.js` clean.
- All items verified against the real built artifact with dedicated Playwright passes.
- 11 new golden test scenarios added, each driving the real calculation pipeline (rental, local/foreign subsistence, travel allowance, home office, tools & equipment, company car, professional subscriptions, crypto, CGT primary residence, ownership share) instead of injecting a raw pre-computed value — closes a gap where these categories had little to no protection against a regression in the main test suite. A new automated check (`pretest`) now fails the build if any deduction/income category is ever left without test coverage again.

## [8.33.3] — 2026-08-27

### Added
- Tax-Free Savings Account (s12T) flag on IT3(b) certificates routes them out of taxable computation, prevents consumption of s10(1)(i) interest exemption, and excludes CGT from the capital gains aggregate. Annual and lifetime contribution limits are checked with penalty warnings if breached.
- Retirement lump-sum event types expanded: transfers between approved funds (tax-neutral, para 26A) and divorce orders for non-member spouses (taxed on withdrawal table with relief eligibility).
- Foreign Employment Exemption (s10(1)(o)(ii)) now supports day-count apportionment: optional fields for days outside South Africa and total days, with live percentage and exempt amount display.
- Minor-child interest attribution flag on IT3(b) certificates (s7(3)) for disclosure and confirmation purposes.

### Fixed
- Provisional taxpayer determination now correctly includes all passive-income types toward the R30,000 para 18(1)(c) de-minimis threshold (previously missed royalties/maintenance/settlements/recoveries/farming and the B6 foreign catch-all field).
- Provisional determination no longer triggers on empty Business/Rental/Crypto toggles; only genuine captured amounts count.

### Testing and verification
- All four coverage-gap Stage 2/3 items verified against the real built artifact with dedicated Playwright passes.
- `npm run test:engine` and `npm run test:release` green (zero golden/legislative/reference-constants drift).
- `node tests/smoke.js` clean with new field tips added to `FIELD_TIPS`.

## [8.33.2] — 2026-08-21

### Fixed
- Fixed the Android release signing and release-artifact validation workflow.
  
## [8.33.1] — 2026-08-20

### Fixed
- Hardened the Android release signing and release-artifact validation workflow.

## [8.33.0] — 2026-08-13

### Added
- Expanded onboarding and Profile setup with conditional questions for foreign income, subsistence, tools and equipment, professional subscriptions and carried-forward balances.
- Carried-forward balance questions now support a third "Not sure yet" state, allowing users to defer checking their SARS assessment without incorrectly recording a zero balance.
- Guided SARS Account balance entry covering the nine supported carried-forward balance types.
- New Income-page summaries for local versus foreign income, taxable income and total deductions.
- Employment and retirement income now have clearer summary presentation on the Income page.
- "Jump to results" navigation added to longer income sections.
- New section icons and redesigned profile control.
- New completion tick, count-up, confetti and mascot motion states.
- In-app "Contact us" link added to the About section.

### Changed
- Dashboard completeness was restructured around a six-step hierarchy, with outstanding items represented as sub-steps of the relevant task rather than as a separate contradictory list.
- Removed duplicated Dashboard information, including redundant completeness, tax-payable, PAYE-paid and deadline displays.
- Filing deadlines now derive from the configured SARS filing-season data rather than a hard-coded date.
- Income and Deductions navigation now exposes all available sections, including sections that have not yet been started.
- PAYE is automatically enabled and locked while Employment is active, with an explanation of why it is enabled.
- Onboarding and Profile conditional questions are kept synchronised.
- Business and Rental losses are now visible in Income totals and section summaries rather than disappearing from the overview.
- Foreign Income opens on its Summary tab by default, with the Foreign Employment Exemption section visible where applicable.
- Travel deduction Finance and Lease payments are now separate fields, with an explicit choice between lease payments and wear-and-tear.
- The Tax Year selector locks after data has been captured, requiring an explicit unlock action before changing the year.
- Business and Rental loss ring-fencing is now determined automatically from the applicable SARS rules rather than through a manual "Ring-fence this loss?" question.
- Small assets costing R7,000 or less now default to a full write-off in the year of purchase, while remaining user-overridable.
- Wear-and-tear now correctly handles assets whose depreciation period ends during the tax year and caps the calculation at the actual end date.
- Home-office eligibility now checks both the duties requirement and the exclusive-use requirement before applying the deduction.
- The retirement-income and carried-balance terminology has been standardised, including "Balances carried over" and clearer retirement contribution wording.
- The Retirement Income carried-forward lump-sum balance is now mirrored correctly between the Retirement Income page and the central carried-balance ledger.
- App-wide visual design was replaced with the approved unified design system across login, onboarding, Dashboard, Income, Deductions, Tax, provisional tax, projections, historical data, references, FAQs, Profile, subscription screens and modals.
- Dashboard, Income, Deductions, Tax and PAYE now have distinct category identities using cyan, emerald, violet, amber and blue respectively.
- Red and mint are reserved for semantic outcomes such as amounts owed and savings/refunds rather than category identification.
- Approximately 1,300 legacy colour-token call sites were remapped to the unified token system, with remaining hand-mixed colours and chart colours brought under the same system.
- Icon tiles were redesigned using category-tinted surfaces, category-coloured glyphs, bevels and matching borders.
- Dark mode now uses an emissive material treatment; light mode has its own warm paper-and-shadow treatment rather than simply inverting the dark theme.
- Financial amounts now use Space Grotesk with tabular figures; monospace is reserved for genuine codes and statutory references.
- The InspiredTax mascot was redesigned while preserving the existing application pose vocabulary and adding independent idle behaviours.
- Interface emoji were removed in favour of the application's own icon system.
- Button interaction feedback now uses physical-depress behaviour rather than scale animations.
- Light-theme colours were deepened where necessary to achieve the required contrast on both the canvas and card surfaces.
- Reduced-motion handling was strengthened so animations terminate in stable accessible states.

### Fixed
- A second account created on the same device could start onboarding with radio groups incorrectly cleared instead of restored to their intended defaults.
- Turning off an automatically enabled deduction could leave the corresponding Profile answer set to "Yes"; the actual Profile value is now updated when the user confirms the change.
- Return completeness could report 100% while outstanding items remained; both now derive from the same task hierarchy.
- Return deadlines could be calculated against the active tax year instead of the correct filing season.
- Tax-page "at a glance" cards could remain hidden because an unrelated legacy accordion rule overrode their display state.
- The new carried-forward retirement lump-sum mirror could update its visible value without updating the cached value consumed by the tax engine.
- Small-asset handling could fail to default qualifying assets to an immediate write-off.
- Wear-and-tear could incorrectly return zero for an asset that remained within its depreciation period for part of the tax year.
- Home-office exclusive use was previously described but not actually enforced as a calculation gate.
- Income and Deductions navigation could hide sections until they contained data.
- Several Income and Deductions controls had touch/tooltip behaviour that was ineffective on mobile; these were converted to the standard press-and-hold interaction where appropriate.
- Several mobile Add modals could exceed the 360px viewport because grid tracks used content-based automatic minimum widths; affected grids now use `minmax(0, 1fr)`.
- The About-page logo lockup could be distorted by an incorrect square sizing constraint.
- The Google Sign-In trial flow could report "Sign-in declined" after a successful Google authentication because the native sign-in configuration did not request an email account.
- Concurrent trial-anchor synchronisation could launch multiple Google Sign-In flows and cause the UI to report failure even though the trial was eventually established.
- Capacitor's Activity-result bridge could fail to match Google Sign-In results when the activity was launched from an asynchronous callback; the launch is now performed synchronously.
- The one-time first-run welcome dialog could contaminate automated screenshot baselines when tests started from a cold profile.

### Testing and verification
- The Batch 3 product work was verified against the built HTML artifact using scripted Playwright passes, with 82 assertions for PR #205 and 43 assertions for PR #206.
- `npm test`, `npm run test:release` and `node tests/smoke.js` were repeatedly run through the product changes with no golden-value drift.
- Added entitlement regression coverage for concurrent trial-anchor synchronisation.
- Verified the Google Sign-In fix with a fresh-account device test, including successful trial establishment.
- The design-system retrofit passed the complete release suite, smoke test, 70 screenshot baseline reviews in both themes, programmatic contrast testing and mascot/reduced-motion checks.
- The design-system retrofit did not alter tax-engine calculations, constants or mappings.

### Release engineering
- Added the permanent manual GitHub Actions Android release workflow supporting patch, minor, major and custom version bumps.
- Release preparation now updates and verifies the application version, Android version code, generated HTML artifact and release metadata together.
- Release builds produce signed debug/release APKs and a signed release AAB, with source-version and binary-version verification.
- Added release-branch preparation, artifact manifests and safeguards against version numbers becoming inconsistent between source, Android binaries and the Play Store release.
- The 8.32.2 release workflow successfully generated and binary-verified the release APK and AAB; the only workflow failure was the automatic PR-creation permission, which was subsequently enabled.
- Updated design-system documentation and conventions to reflect the new unified token system and current design inventory.

## [8.32.2] — 2026-08-13

### Changed
- **New design system, applied app-wide.** Every screen — login, onboarding,
  dashboard, income, deductions, tax calculation, provisional, projections,
  historical, references, FAQs, profile, about and all modals — now uses one
  colour, type, material and motion system instead of the palette each
  generation of the app had accumulated.
  - Each area has its own colour: Dashboard cyan, Income emerald, Deductions
    violet, Tax amber, PAYE blue. The colour follows you through the bottom
    nav, page headings, tabs, icon tiles and figures, so which part of the
    app you are in is readable at a glance.
  - Red and mint are now reserved for outcomes only — what you owe, and what
    you kept. They never appear as a category colour again, so a figure being
    red always means the same thing.
  - Icon tiles are redrawn as tinted, softly-bevelled tiles with the icon in
    its own colour, replacing the solid colour blocks with white glyphs.
  - Amounts are set in Space Grotesk instead of a monospace face, with hero
    figures in a lighter weight; monospace is now used only for genuine codes
    (IRP5 source codes, Act sections, the ITR12 export).
  - Dark mode gets its depth from light — a lit background and surfaces that
    glow from within. Light mode is a designed counterpart rather than an
    inversion: a warm paper background with layered shadow, and every colour
    re-cut for contrast on white.
  - The meerkat is redrawn — a truer sentinel stance with a planted tail, and
    a face built to stay clear at small sizes — with breathing, blinking,
    ear-twitch and tail idle motion, and it now greets you on first run.
  - Emoji are gone from the interface, replaced by the app's own icon set.
  - All decorative motion still stops completely when your device asks for
    reduced motion.

## [8.32.1] — 2026-07-31

## [8.31.2] — 2026-07-27

## [8.31.1] — 2026-07-27

### Fixed
- **Trial anchor (Google Sign-In)**: sign-in now succeeds and establishes
  the trial correctly; the plugin was not requesting email scope in
  GoogleSignInOptions, causing getAccount() to return null and breaking
  the Drive token fetch. Diagnostics added to distinguish sign-in declines
  from missing-email errors.
- Tools & Equipment: assets can now be edited, not just added and
  deleted; "Small Tools (under R7,000)" now blocks saving an item costing
  more than R7,000 instead of silently applying the full write-off;
  acquisition date moved out of a collapsed accordion so it's easier to
  find and verify.
- Travel: vehicle-value bracket no longer silently defaults to the
  lowest SARS table row when no vehicle value is entered; wear-and-tear
  auto-calculates even without an acquisition date (assumes full-year
  use); added a reference table of the SARS vehicle-value brackets.
- SARS Account page now shows the foreign tax credit (s6quat) line when
  a credit is used in the current year, not only when there's a
  brought-forward or carried-forward balance.
- Profile "Tax Year" card now updates immediately when the tax year is
  changed; the Subscribe screen's plan status updates immediately after
  a successful subscription instead of requiring navigating away and back.
- Fixed a literal "&amp;" appearing in the IRP5/IT3(a) certificates note,
  and a duplicated currency symbol ("RR") on the Capital Gains annual
  exclusion line.
- Capital Gains: removed two unused date fields from "Add CGT Disposal";
  the CGT section now shows as active when a gain comes from foreign
  (IT3(b)) or crypto income, not only a direct CGT-asset entry.
- Bottom navigation: SARS Account now highlights "Tax" instead of
  "Income"; taps register more reliably across the whole bar.
- The IRP5/IT3(a) income picker no longer lists Pension & Annuity codes
  that duplicate the dedicated Retirement section.
- The "Retirement Income" quick-nav button now correctly shows as active
  (and with the right amount) once you've added pension/annuity, lump
  sum, or two-pot records — it was reading the wrong internal fields and
  always showed as empty regardless of what you'd captured.

### Changed
- "Employment & Investment" renamed to "IRP5/IT3 certificates"; "Assessed
  loss b/f" is now a collapsible section within that tab instead of its
  own top-level tab.
- Removed the ID number, employer name, and business/occupation fields
  from the profile and onboarding — no longer needed and no longer stored;
  the tax reference number is kept, with a note during onboarding that it
  can be added later in Profile if you don't have it to hand.
- SARS Account page redesigned: each carried-forward balance (assessed
  loss, capital losses, foreign tax credits, etc.) is now a collapsed row
  you tap to expand into a Prior year → this year's movement → Year-end
  balance layout, instead of a tab strip with a 3-column grid. The page
  header always reads "SARS Account" now (it used to briefly show
  "Amounts brought forward and carried forward").
- Income main page: a loss-making Business or Rental total now shows on
  the section button and in "Total income captured" (in parentheses, like
  losses shown elsewhere in the app) instead of disappearing, and it's
  explained with a note that it's already included in the total shown —
  and counts toward the "N income types" badge.
- Hamburger menu: the Income and Deductions sections now always list
  every bucket/deduction, grouped into "Started" and "Not started yet"
  with a status badge — previously a section stayed hidden from the menu
  until it already had data, so Foreign Income (and anything else not yet
  started) couldn't be reached from the menu at all.

### Added
- Android app launcher icons for all device density buckets (hdpi, mdpi,
  xhdpi, xxhdpi, xxxhdpi) — required for Play Store submission and optimal
  icon display across device sizes.
- Employment income now has an "at a glance" summary chip on the Income
  page, matching the pattern used elsewhere.
- Retirement lump sums now show as their own chip on the Income main
  page's total-income breakdown — previously invisible there even though
  they were already part of the total.
- "Jump to results" links added throughout Income (Rental, Business, CGT,
  and more) — tap to scroll straight to the calculated breakdown, matching
  the button Retirement already had.

### Changed
- Business and Rental loss ring-fencing is now worked out automatically
  instead of asking you to answer a manual "Ring-fence this loss?"
  question — SARS's rule (a trade that lost money in 3 of the last 5
  years, or a rental let mostly to relatives, is ring-fenced unless you
  confirm a reasonable prospect of future profit) is applied for you.
- Tax Year selector now locks once you've started capturing data for that
  year, with an explicit "Unlock to change" step, to prevent accidentally
  re-dating existing entries to the wrong year.
- Foreign Income page now opens on the Summary tab by default, with the
  Foreign Employment Exemption tab moved up and shown (locked, if not yet
  applicable) instead of hidden; the total taxable foreign income figure
  is now pinned above the tabs.
- Travel deduction: Finance and Lease payments are now separate fields,
  each with its own explanation, instead of one field that changed
  meaning depending on your selection; choosing between claiming lease
  payments or wear-and-tear is now an explicit choice instead of a silent
  default.
- Onboarding's final "You're All Set!" review screen now genuinely comes
  last, after the Carried-Forward Balances question, instead of before it.

### Fixed
- Travel deduction note corrected: the Fixed Cost method works the same
  whether your vehicle is financed or leased — the previous note
  incorrectly suggested switching to Actual Expenses for a leased
  vehicle.

## [8.30.2] — 2026-07-23

### Play Store launch — pre-drafted entry (BACKLOG R-E4)

Convert to a real `## [x.y.z] — YYYY-MM-DD` heading at the production
release (`npm run release:bump` per `RELEASE.md`); keep in sync with the
Console "What's new" draft in
`docs/programmes/play-store-launch/03-STORE-COPY.md` §3.

- First public release of InspiredTax Africa on Google Play (South
  Africa).
- Full ITR12-aligned SARS income tax computation for the live tax years —
  every figure traceable to its Income Tax Act section, SARS
  Interpretation Note, or SARS guide via the (i) tooltips.
- Multi-year support: close out a tax year and automatically carry
  forward assessed losses, capital losses, non-deducted retirement
  contributions, foreign tax credits, donation excess, and ring-fenced
  losses.
- Offline-first and private: calculations run entirely on-device;
  AES-GCM-256 encrypted local storage; no ads, analytics, or tracking.
- Freemium: full-featured free trial (started with a one-time Google
  Sign-In); Basic tier stays free; Premium unlocks via Google Play
  subscription.

## [8.30.0] — 2026-07-18

### Added
- **Multi-year tax data**: close out a completed tax year (Profile → Tax
  Year) and the app now archives it and automatically carries forward
  your assessed loss, capital losses, non-deducted retirement
  contributions, foreign tax credits, donations excess, and ring-fenced
  losses into the new year — instead of re-entering each balance by
  hand. Closed years remain visible as a read-only summary.

### Fixed
- Seven calculated-figure citations pointed at the wrong Income Tax Act
  section or SARS guide (e.g. a swapped subsection letter on the
  retirement-fund lump-sum formula, a wrong section reference on
  home-office and short-term-rental apportionment, and a non-executive
  director fee citation that pointed at the wrong SARS guidance
  document). No calculated amount was affected — these were
  disclosure/citation text only, found and fixed during a full audit of
  all 269 citations shown in the app.
- Light theme: several status colors (refund/owing amounts, applied
  deduction totals, warning banners) were hard to read against a white
  background, falling short of WCAG AA contrast. Darkened to a
  readable, accessible level; dark theme is unaffected.

## [8.29.0] — 2026-07-11

### Added
- Automated local backup: on Android, the app now writes an encrypted
  snapshot of your data every time it locks. If your device's own backup
  setting is on, Android syncs it to your Google account in the
  background — no setup, no sign-in required. See About → Privacy & Data,
  or the FAQ.
- In-app FAQ panel (drawer menu → FAQ) — what the app does, where your
  data lives, how to back it up or delete it, and current limitations
  (e.g. tax-year data isn't yet kept separate per year).
- Non-deducted retirement contributions (excess RA/pension/provident
  contributions from a prior year) are now correctly applied in one
  order — this year's deduction, then retirement lump sums, then
  qualifying annuity/pension income — instead of two independently
  tracked balances that could occasionally double-count relief.
- Provisional tax already paid (P1/P2/top-up) now reduces your final
  balance due, alongside PAYE.
- Donations you couldn't fully deduct last year (over the 10% cap) now
  correctly carry forward and get re-tested against this year's cap,
  instead of being treated as forfeited.
- The Current Year Planner now automatically includes rental, business,
  crypto, and investment income you've already entered elsewhere in the
  app, instead of requiring it typed in twice.
- A foreign pension or annuity with tax withheld abroad now correctly
  gets credit against your South African tax.

### Fixed
- Crypto trading disposals were double-subtracting expenses from the
  taxable gain.
- Home office rent was being multiplied by 12 a second time if entered
  as a monthly figure.
- Wear-and-tear on tools/equipment wasn't pro-rated for assets bought
  partway through the year, and a blank purchase date silently zeroed
  the deduction entirely.
- "Other foreign income" you'd entered was credited toward your foreign
  tax credit but never actually added to your taxable income.
- A data-saving bug: locking the app could occasionally silently drop
  your last change instead of saving it.

### Changed
- App name standardized to "InspiredTax Africa" everywhere (was
  inconsistently "InspiredTax" in some places).
- The `INTERNET` permission was removed — the app makes no network
  requests of its own (the Android backup feature above is handled
  entirely by the operating system, not this app).
- App version number moved from the login screen into About, where it's
  actually useful for support.

## Earlier versions

Not yet reconstructed — see `git log` and `STATUS.md` for the full
history, including the SARS tax-engine remediation programme
(`docs/programmes/engine-remediation/`) and the standardization programme
that produced most of the 8.29.0 entries above.
