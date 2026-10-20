# Design system

The rules every screen follows, and the tokens they are built from. **Read it
before design or UI work.** Copy rules are separate:
`docs/product/UX-WRITING-STYLE-GUIDE.md`. The owner decisions behind these
rules are in `docs/DECISIONS.md` §4.

- **Source of truth for values is `src/styles/main.css`.** The tables below
  were read from it on 2026-10-04 (`15a9d6e`); if they disagree, the CSS wins
  and this file is corrected.
- **Origin.** Principles, standards and guidelines come from the design-system
  audit's standards register (2026-09-09, owner interview 2026-09-10), updated
  for later reversals (D-19, N5, OD-16). Retired source:
  `git show 15a9d6e:docs/product/DESIGN-SYSTEM-AUDIT-2026-09.md` (§D).
- **Rule types.** *Principle* — why; resolves conflicts. *Standard* — one
  correct answer app-wide; two instances differing is a defect. *Guideline* —
  a default; deviating needs a code comment. *Local* — one component only; do
  not generalise.

---

## 1. Tokens

### Colour — two independent channels

**Category** colours say *what* something is (an area); fill/swatch only.
**Semantic** colours say whether an outcome is good or bad; only they may glow.

| Token | Area / meaning | Dark | Light |
|---|---|---|---|
| `--cyan` | Dashboard, projection (app accent) | `#1ADDE3` | `#097C82` |
| `--emerald` | Income | `#21C97A` | `#0A8153` |
| `--violet` | Deductions | `#9B7BFF` | `#6A4BE0` |
| `--navy` | Taxation (summary, risk, calculator, comparison; placeholder for other Taxation tabs, D-31) | `#4B87FF` | `#0B52DA` |
| `--amber` | Prior-year balances | `#F2A32B` | `#9A6109` |
| `--rose` | Provisional tax | `#FF6FB5` | `#A81E63` |
| `--blue` | PAYE | `#5D7CA7` | `#3B547A` |
| `--mint` | Semantic: gain, saving, refund | `#5DF2B8` | `#097852` |
| `--red` | Semantic: owing | `#FF5C7A` | `#C7264A` |
| `--neutral` | Totals, reference pages (`actref`, `taxfaqs`, `subscribe`) | `#8B94AB` | `#646D7F` |

- `--area-accent` is set per `data-area` on `#app` and on each
  `.modal-overlay`; components read it, never a hue directly.
- Surfaces and text: `--canvas`, `--surf`, `--surf-2`, `--surf-solid`,
  `--line`, `--line-2`, `--text`, `--dim`, `--faint`, `--on-accent` (ink on a
  category fill). Legacy aliases (`--bg*`, `--sf*`, `--tx*`, `--au`, `--er`,
  `--wa` …) map onto these — use the new names in new code.
- Light theme: `[data-theme="light"]` redefines every token; the contrast gate
  checks both themes.

### Type

| Token | Value |
|---|---|
| `--ff` | Inter — body |
| `--fh` | Space Grotesk — headings |
| `--fnum` | Space Grotesk — financial figures (never the monospace face) |
| `--mono` | JetBrains Mono — codes and raw output only |
| `--fs-micro` … `--fs-8xl` | 16 steps, rem on a 16 px root: 8, 9, 10, 11, 12, 13, **14 (body, `--fs-base`)**, 15, 16, 18, 20, 22, 24, 28, 30, 42 px. `--fs-8xl` is the Dashboard hero number only |

All fonts and the Material Symbols subset are vendored (`vendor/`) and inlined
at build.

### Shape, space, density

| Token | Value |
|---|---|
| Radius | `--r-sm` 12 px (inputs, chips) · `--r` 16 px (cards, tiles, modals) · `--r-lg` 20 px · `--r-pill` 999 px (all buttons) |
| Spacing (4-pt) | `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 px |
| Rows (D-7) | `--row-pad-y` 6 · `--row-pad-x` 8 · `--row-gap` 6 · `--row-min-h` **44 px** (WCAG 2.5.8 floor for every tappable row) |
| Form fields (D-22) | `--field-min-h` 40 px |
| Chrome | `--header-h` 56 · `--tax-year-h` 36 · `--bottom-nav-h` 54 · `--drawer-w` 280 px; safe-area insets resolved once |
| Focus | `--focus-ring` — 4 px ring in the area accent at 22 % |

### Icons and motion

- Material Symbols Outlined, vendored subset. Every glyph name used in code is
  in `MS_ICON_SET` (`01-data.js`) **and** in the vendored subset — an
  unvendored name renders nothing, silently. Adding one is an `npm run vendor`
  change.
- Free-standing glyph `font-size` is in **px** — the one exception to rem
  typography (QD-26). The allowed rules are listed in
  `tools/check-font-px.js`. Android does not deliver its font size as a
  bigger root font: the WebView applies it as **text zoom**, which multiplies
  every computed font size (px, rem and vw alike) but no box. So px glyphs do
  grow with the setting, and anything that pairs a fixed-size box with text
  must size the box in **em** of that text (UI-FS-1, 2026-10-05).
- **Icon tiles** (`[class*="ico-bg-"]`): the tile's `font-size` is the glyph
  size (`--glyph`, rem) and its width/height are `--tile-em` × 1em, so tile
  and glyph scale together under text zoom and Easy View. Ratio 32/24
  (`--tile-em` 1.3333) by default; `.ico-sz-28…48` set both. Defaults live in
  `:where()` so the size modifiers win; never size a tile with px width or an
  inline style. Gate: `tests/smoke.js` text-zoom passes ("glyph larger than
  its tile").
- **Two-up grids** (`.stat-row`, `.mini-grid`, `.glance-cards`, `.yn-group`,
  `.seg-ctl-cta`): `repeat(auto-fit, minmax(min(100%, Nem), 1fr))` — the
  column count follows the text, dropping to one column when the figures no
  longer fit two-up. Label/amount rows wrap the amount to its own line;
  amounts never clip, overlap or spill.
- **Notes** (UI-NOTE-1): a note is ONE short line plus *More*, built by
  `noteHtml(tone, short, detail, opts)` / `setNote(el, …)` / `noteBody()`
  (`02-core.js`); *More* opens the help sheet with the full explanation and
  its section reference. Notes are `--fs-sm`. Option-dependent notes
  (`OPTION_NOTES`) carry `short` + `title` beside `html` (the detail). A
  plain note over 110 characters fails `tests/smoke.js` (`assertNotesCompact`);
  `.note-data` marks a block of figures, not prose.
- **Cards** (UI-CARD-1): one summary card, `.mini-card`, built by
  `miniCardHtml(spec, opts)` (`02-core.js`) — lip in the card's colour,
  uppercase label over the figure, an optional ring on the figure's line, a
  chevron. A card whose figure is R 0 has no chevron and does not open. On
  the Tax screens (`.tax-cards`, option B) an open card takes the whole row:
  its chart across the top (`donutHtml`, `barsHtml`, `bracketLadderHtml`),
  the lines that make the figure under it, then *Open [page] →*; one card is
  open per screen and stays open across a recalculation. Every line and
  chart value is an engine output or a plain sum of them. The four cards the
  Dashboard and the Return tab share come from `glanceCardSpecs()`
  (`07-render-summary.js`). Tax balances rows stay rows (they hold inputs);
  a row carrying an amount wears the lip and shows its movement as bars.
  Gate: `tests/smoke.js` `assertTaxCards`. `.stat-card` is retired on the
  Tax screens; its remaining uses are BACKLOG 28.
- **Section pills** (`.tab-btn` in the Income, Deductions and Taxation rows):
  one equal-width three-column grid; every pill carries the lip, status only
  changes its strength; the active pill keeps a deeper lip (UI-PILL-1).
- Motion (QD-21/22, `tools/check-motion.js`): mascot reactions finite and
  ≤ 1.2 s; transitions 450 ms, `transform`/`opacity` only — edge sweep between
  areas, triangle tessellation between wizard steps (fallback
  `STEP_TRANSITION = 'B'`); no transition and a still mascot under reduced
  motion. Figures count up the first time they are seen after a change
  (QD-20).

---

## 2. Principles

| ID | Principle |
|---|---|
| P-COLOUR-1 | Colour carries two independent channels, *category* and *semantic*; a hue serves one channel only |
| P-COLOUR-2 | Category colour is fill only — never a glow, bloom or shadow; that channel belongs to semantic colours |
| P-COLOUR-3 | Identity is carried by the icon; colour is reserved for area and state |
| P-STATE-1 | Zero is a value, not evidence of completion. Completion needs a captured entry or an explicit attestation |
| P-DATA-1 | One canonical value per tax figure. Two fields may mirror; they may never diverge |
| P-COPY-1 | Copy is present tense, action-verb first, second person |
| P-A11Y-1 | No meaning by colour alone; no affordance by hover alone (the WebView has no hover) |
| P-FIX-1 | Fix at the source, once; no second mechanism beside a working one (`CLAUDE.md` rule 3) |

## 3. Standards

| ID | Standard |
|---|---|
| **D-19** | Icon tiles take **one colour per page** (the area accent), app-wide. The Dashboard's breakdowns are the deliberate exception: per-category colour there encodes data. *(Reverses D-3.)* |
| STD-COL-1 | The primary CTA takes the area colour: `.btn-primary { background: var(--area-accent, var(--accent)) }` |
| STD-COL-2 | Modals inherit the `data-area` of the screen that opened them; global modals (backup, PIN, terms) stay neutral |
| STD-COL-3 | No hard-coded hex in `src/js/` or `src/body.html`; colour comes from a token (palette data in `01-data.js` and the token block in `main.css` excepted) |
| STD-COL-4 | Row status colour: *Still to add* amber · *Completed* the row's own category colour · *Off* neutral |
| STD-COL-5 | Every category/semantic token clears 4.5:1 against canvas and card, both themes, including glyph-on-tile; `--on-accent` clears 4.5:1 on every fill (`tools/check-contrast.js`) |
| STD-TYPE-1 | Type sizes come from the `--fs-*` scale only; glyphs are the px exception above |
| STD-NUM-1 | A money amount is one unbreakable token: U+00A0 after `R` and as the thousands separator, `white-space: nowrap` on `--fnum`; a sentence wraps around it, never inside it. Exports and Copy normalise U+00A0 to a space (6.11) |
| STD-NUM-2 | One currency-format module serves the writer (`fmt`), the mask (`maskRand`) and the reader (`parseFmt`) |
| STD-NUM-3 | An input mask preserves the caret around any `el.value` reassignment |
| STD-NUM-4 | A year in copy is interpolated from the selected tax year, never typed (statutory citations naming a year excepted) |
| STD-COPY-1…7 | Sentence case (SARS, ITR12, IRP5, IT3(b), PAYE, UIF keep theirs) · South African English · `&` in labels, `and` in prose · one destination, one name everywhere · "Professional memberships" · audit risk long/short forms (5.9) · `Continue` / `Next: [destination]` / `Back` |
| STD-COPY-8 | No implementation detail in user-facing copy |
| STD-COPY-9 | No network/cloud framing for offline features; Google sign-in, billing and Drive backup are genuinely online and say so (C-10) |
| STD-IA-1 | List pages follow one order: Still to add → Hero → Small cards → Completed → Off → Prior-year balance → About link (5.7: every page with that shape; not reference pages) |
| STD-IA-2 | The help link reads `ⓘ About [page title]`, at the bottom, in the area colour; no duplicate ⓘ top-right |
| STD-IA-3 | Help content for a topic has one source, used by the page and its entry modal |
| STD-IA-4 | A control that looks like a tab is a tab; cross-panel navigation uses a distinct affordance |
| STD-ICON-1 | One glyph, one meaning. Recorded shares only: `trending_up` (Investment / CGT / capital losses — a known weakness), `public` (Foreign income / SA residency), `account_balance` (Owed / Refund) |
| STD-ICON-2 | Every glyph used is in `MS_ICON_SET` and vendored |
| STD-BEHAV-1 | Profile answers and captured data stay in sync both ways; provisional-taxpayer status is never changed by that sync |
| STD-BEHAV-2 | No confirmation modal changes provisional-taxpayer status; a divergence is surfaced, never resolved silently |
| STD-BEHAV-3 | Untoggling is blocked where captured entries depend on it, warn-and-allow where the objection is advisory (PAYE) |
| STD-BEHAV-4 | *Completed* and *Off* sections start collapsed on every visit; only one open at a time (built #386) |
| STD-BEHAV-5 | The add CTA is at the top, always visible: "Add your first [item]", then "Add [item]" (built #386) |
| STD-BEHAV-6 | Progress = items completed ÷ items applicable; several entries in one category are one item |
| STD-RISK-1 | Risk Assessment flags fields with no third-party source automatically; asks only about eFiling-sourced fields that diverged (OD-31) |
| STD-SEC-1 | Session teardown clears by enumerating what exists, not an allow-list; logout is a full reload (0.1) |
| STD-SEC-2 | User text into `innerHTML` goes through `esc()`; text into `textContent` is not escaped |
| STD-CAP-1 | A capture sheet that holds more than one kind of record opens on its kind chooser (question + one `.kind-tile` per kind, each with a second line); the pick shows the form and the title names the kind ("Add Airbnb rental"); *Change* in the header returns to the chooser. One live kind: no chooser. Data: `CAPTURE_KINDS` (UI-CAP-1, built 10-07). **A cross-sheet group has exactly one Add on its page** (retirement → `addPensionAnnuity`, crypto → `addCryptoDisposal`), so every route into the group passes its chooser; a kind's own sheet is never given an Add of its own, which would skip the question. Gated by `assertCaptureKinds` ("page has N add buttons, want 1") (verified 10-09, `OI-C1a`) |
| STD-CAP-2 | A capture form has two steps at most; a step holds three inputs or a decision that reshapes the next screen, else it merges. The step header is one line — *Step n of N* (never wraps) and the step name — over a segmented bar; no header when one step is live (UI-CAP-1) |
| STD-CAP-3 | Amounts as lines: a cost list starts with the usual lines for its kind and offers the next ones as *Add a cost* chips plus *Another cost* (`USUAL_COSTS`, UI-CAP-1) |
| STD-PRES-1 | Statutory references do not appear in user-facing UI — titles, headings, heroes, ⓘ modals, tooltips (OD-16, stricter option). Code, comments and constants keep citations. Residual review: BACKLOG item 25 |
| ~~STD-RULE-1~~ | *Superseded by N5:* destructive confirms do **not** hold 600 ms |
| ~~STD-ICON-3~~ | *Superseded:* tile and glyph sizes were set in the lip/tile/pill prototype (§L.6.1 export) rather than a fixed step list |

## 4. Guidelines

| ID | Guideline |
|---|---|
| GDL-1 | Small cards under a hero use a strict two-column grid |
| GDL-2 | A list row targets 2 lines (icon · name · amount + ⓘ + count); 3 at most |
| GDL-3 | Checkboxes sit left of their label; toggles far right, one line |
| GDL-4 | A chevron expands more of the same data in place; ⓘ explains it |
| GDL-5 | A rule that cannot be shortened without loss moves into the ⓘ sheet rather than being deleted |
| GDL-6 | An amount that does not fit steps down the `--fs-*` scale; never computed |
| D-18 | "Reduce by 25 %" means two steps down the scale where it still fits, 10 px floor |

## 5. Local decisions (do not generalise)

LOC-1 Owed/Refund share `account_balance` · LOC-3 Foreign income attestation
(the general form is 6.9) · LOC-4 the Local-vs-Foreign card breaks down
foreign sources only · LOC-5 the Tax-balances pill is amber inside the navy
Taxation bar · LOC-6 Tax-at-a-glance cards expand one at a time, to the full row (UI-CARD-1) · LOC-7 no
audit-risk flag for an RA excess (removed from the score's denominator too) ·
LOC-8 the "Congratulations…" line sits in the reward card's expanded state.

## 6. Enforcement and known deviations

| Rule | Gate |
|---|---|
| STD-COL-5 | `tools/check-contrast.js` (pretest) |
| STD-TYPE-1, glyph exception | `tools/check-font-px.js` (pretest) |
| Donut slice colours by source | `tools/check-donut-colours.js` (pretest) |
| Motion limits | `tools/check-motion.js` (pretest), smoke `assertMotion` |
| Form conventions | `tools/check-static-form.js` (pretest), smoke `assertFormConventions` |
| STD-CAP-1…3 | smoke `assertCaptureKinds`; each chooser screen in the modal text-zoom sweep |
| 360 px, no horizontal scroll, 100/125/150 % font scale | `tests/smoke.js` |

Known deviations, measured 2026-10-04:

- **STD-COL-3:** 32 six-digit hex literals remain outside `01-data.js` —
  `09-projection.js` 10, `07-render-summary.js` 9,
  `12-bootstrap-onboarding.js` 6 (error banner), `11-historical.js` 4,
  `10-current-year-planner.js` 3 (mostly chart colours); none in
  `body.html`. Not gated.
- **Chart palette:** only 5 of the 11 category hues are mutually
  distinguishable as chart slices (calc-audit E12); a chart-specific palette is
  an open owner decision (BACKLOG item 14).
