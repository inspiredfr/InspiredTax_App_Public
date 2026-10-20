# 03 — Suggestions and options

Each suggestion names the finding (`02`) and need (`01`) it serves, the
options, a recommendation and its cost. "Cost" is relative build effort and
risk, not calendar time. Owner decisions are collected in §5.

## 1. Fix the plumbing first (prerequisite for everything else)

### S-A. Planner forecast reads every captured deduction live — F3, D1.5, U2
Make `calcCurrentYear()` take retirement, home office, travel, tools and the
other deductions from `calcFullTax()`'s output (as T-6(a) already does for
income), so the planner and the return can never disagree. The month rows
become **adjustments for what isn't captured elsewhere**. "Pre-fill" becomes
unnecessary.
- **Recommendation:** do it. Cost: medium (engine-adjacent → `test:engine`; new golden fixture "deduction lowers IRP6").
- Hard rule 2 is the reason: today the planner is a second aggregation path.

### S-B. Remove the double-count trap — F4, D1.6
Rename the column **"Other income not captured elsewhere"** and show a live
line above the table: *"Already included: Business R420,000 · Rental R96,000"*.
If a month's entry looks like it duplicates a captured source, ask once.
- **Recommendation:** do it with S-A. Cost: low.

## 2. Lower the gate — the rough-estimate route

### S-C. Quick estimate ("Rough year") — F5, F7, D1.2, U8
**Is it possible today?** Partly: one Business record with annual turnover and
one expense row works mechanically. What's missing is a front door, a label,
and plumbing (S-A).

| Option | What the user sees | Cost | Trade-off |
|---|---|---|---|
| **A. Onboarding fork** | After income types: *"Start with a 2-minute estimate, or capture in detail?"* Estimate = 4 fields: expected turnover, expected expenses, salary + PAYE (if any), provisional paid so far | Low–med | Seen once; must be re-findable |
| **B. Planner empty state** | Instead of "Complete Step 1": a 4-field card *"No time? Rough figures get you a P1 amount now"* | Low | Only helps those who find the planner |
| **C. Both + upgrade path** | A + B; every estimate-sourced figure carries an **Estimate** chip; replacing it with detailed capture is one tap ("Turn this estimate into a full record") | Medium | Best coverage; needs one data model for "estimate" vs "captured" |

- **Recommendation: C.** Store the estimate as a normal Business/Salary record flagged `source: 'estimate'` — no parallel engine path (hard rule 2), and it upgrades in place.
- Also add **"Is this for the full year or so far?"** to business income (S1.5): if "so far", ask months covered and show the annualised figure separately as *projected*.

### S-D. Make alternatives visible at the moment of friction — U7
A general rule, not one screen. When a user hits friction, offer the shortcut
**where they are**:

| Moment | Prompt |
|---|---|
| Empty planner | the S-C card |
| 3rd expense row on a business record | *"Rough total is fine for planning — itemise later"* |
| Leaving onboarding with nothing captured | *"Want a number first? Quick estimate"* |
| Deadline ≤ 21 days, no forecast | Dashboard banner with the quick estimate |
| Help menu | *"Ways to get your answer"* — every route listed once |

- **Recommendation:** adopt as a design rule in `docs/product/UX-WRITING-STYLE-GUIDE.md`, build the first four. Cost: low each.

### S-E. Two payment figures — F6, S1.6
Show **"Minimum to stay penalty-safe: R x"** (safe-harbour) and **"Pay in full
to avoid a year-end bill: R y"**, with the difference and the interest cost of
the gap. Both already computed by the engine.
- **Recommendation:** do it. Cost: low.

## 3. Serve the right people — generalist vs bespoke

### The trade-off
| Approach | Benefit | Cost |
|---|---|---|
| **Generalist** (everything for everyone) | One engine, one codebase, covers edge cases | Every user wades through what isn't theirs; the core promise gets buried |
| **Bespoke** (separate apps / modes per segment) | Sharp promise per segment | Multiplied QA; tax-law changes land N times; violates hard rule 2 risk |
| **One engine, tailored surfaces** (recommended) | Correctness stays single-source; each user sees *their* journey | Needs a profile → surface map and tests per lens |

### S-F. Goal-based lenses — U7, F1.8
Add one onboarding question: **"What do you want to do first?"**
- Plan my provisional payments → Dashboard leads with the planner (P1, P4)
- See what my side income costs → leads with the side-income card (P2)
- Prepare my return / catch up years → leads with ITR12 report and year picker (P3)
- Just check my salary tax → Basic path (anti-profile, free)

The answer re-orders the Dashboard and navigation; **it never hides capability**.
Cost: medium. Builds on the existing onboarding (`12-bootstrap-onboarding.js`).

### S-G. Side-income cost card — F8, S2.1
"Your side income adds **R x** to your tax this year" = engine run with and
without the side sources. Two `calcFullTax()` runs, no new formula. Cost: low–medium.

### S-H. 55+ lens and persona P4 — F9
Large-text-first QA, annuity + age rebate + interest exemption surfaced on the
Dashboard, drawdown what-if. Store listing copy that names semi-retired
consultants. Cost: medium. **Owner decision** (adds a persona).

### Measuring which users we actually have (no analytics)
Privacy rules out telemetry. Use, in order: the closed-test feature table
(`FEEDBACK-LOG.md` §1); an **opt-in, on-device-only** "what brought you here?"
answer (the S-F question) shown in a backup export the user may share; Play
Console acquisition data; and the Espresso journey metrics (`07`).

## 4. Commercial

### S-I. Let the core user see the promise before the paywall — F1, F2
| Option | Effect | Risk |
|---|---|---|
| **A. Free headline** | Basic shows the P1 amount and due date from a quick estimate; detail, penalty check and capture of business/rental stay Premium | Smallest change that shows value |
| **B. Trial starts on first Premium screen**, not sign-in | Trial lands when needed | Needs anchor redesign (`04-TRIAL-ANCHOR.md`) |
| **C. Deadline pass** | Trial re-opens for 7 days before each IRP6 deadline once per year for non-subscribers | Abuse-limited by the Drive anchor |
| **D. Status quo** | — | F1/F2 stand |

- **Recommendation: A**, then measure; consider C. Owner decision.

### S-J. Seasonal pricing — F10
Options: keep monthly but price it so 2 months ≈ annual (e.g. R199/month), or
offer a **"Provisional season" pass** (Aug + Feb). Owner decision; informed by
`04` §3 (TaxTim charges R600 just to submit both IRP6s).

### S-K. Say why InspiredTax, where the user decides — F11
On the paywall and store listing: *offline, nothing leaves your phone, every
figure cited, planning all year — then file on eFiling yourself.* Cost: copy only.

## 5. Owner decisions

**Answered 2026-10-16:** OD-1 to OD-4 as recommended; OD-5 yes; OD-6 =
keep the 7-day trial at sign-in **and** show Basic users the P1 amount and
date from a quick estimate, no details; OD-7 open. Espresso spec on hold.

| # | Decision | Recommended |
|---|---|---|
| OD-1 | Fix forecast plumbing (S-A, S-B) before any new feature | **Yes** |
| OD-2 | Rough-estimate route option | **C** (onboarding fork + planner card + upgrade path) |
| OD-3 | Adopt "alternatives at the point of friction" as a design rule (S-D) | **Yes** |
| OD-4 | Goal-based lenses (S-F) | **Yes** |
| OD-5 | Add persona P4 and the 55+ lens (S-H) | **Yes** — SARS data |
| OD-6 | Paywall / trial change | **A** (free headline) |
| OD-7 | Seasonal pricing | Decide after `05` research |
