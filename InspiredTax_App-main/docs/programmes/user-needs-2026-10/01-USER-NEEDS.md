# 01 — User needs (expanded)

Source personas: `.sweetclaude/state/personas.yaml`. This file expands each
into a full needs profile. Persona P4 is **new and proposed** — see §5 and
`04-MARKET-EVIDENCE.md` §2 for why.

## 0. How to read this

Every persona has the same seven sections. Success criteria are written to be
**binary and measurable** so `07-ESPRESSO-QA-SPEC.md` can test them directly.

**Knowledge levels.** Each persona can arrive at three levels. The QA spec
tests every critical journey at all three.

| Level | Tax knowledge | Numeracy / reading | What they need from the app |
|---|---|---|---|
| **K1 — novice** | Has never filed alone; doesn't know "taxable income" from "turnover" | Reads short plain sentences; avoids tables; may use large text | One question at a time, plain words, examples in rand, no section numbers without a gloss, a safe default |
| **K2 — informed** | Has filed on eFiling; knows IRP5, IRP6, deductions exist | Comfortable with a summary table | Fast capture, clear labels, the "why" one tap away |
| **K3 — expert** | Accountant-level; knows para 20, s11(a), s23 | Reads dense figures | Shortcuts, full calc trace, citations, nothing hidden or rounded away |

A screen passes only if K1 can finish it unaided **and** K3 is not slowed
down. That rules out both "wizard only" and "power-user only" designs.

---

## 1. Universal expectations (all personas)

Anyone who pays for a tax app reasonably expects these. Breaking any of them
is a deal-breaker regardless of persona.

| # | Expectation | Measurable form |
|---|---|---|
| U1 | **The numbers are right** | Matches SARS ITA34 / eFiling estimate to the rand for the same inputs |
| U2 | **The numbers agree with each other** | Dashboard, Return, Planner and Export show the same tax for the same data |
| U3 | **Private** | No tax data leaves the device; the app says so plainly |
| U4 | **Works offline** | Every calculation works in flight mode |
| U5 | **Nothing is lost** | Data survives app close, phone restart, update; backup restores it fully |
| U6 | **Explains itself** | Every computed figure has a reason one tap away |
| U7 | **Tells me what to do next** | Each screen has one obvious next action |
| U8 | **Respects my time** | First useful answer in minutes, not after full capture |
| U9 | **Honest about uncertainty** | Estimates are labelled as estimates, with what they assume |
| U10 | **Fair price, clear paywall** | I know what's free, what's paid, and what I'd lose by not paying, before I invest effort |
| U11 | **Fits my phone** | Readable at 360 px and at 130 % system font size |
| U12 | **Doesn't pretend to file** | It's clear the return is filed on eFiling, and how |

---

## 2. P1 — Thandi, the contractor (core)

**Profile.** 34, IT contractor, Johannesburg, ~R950k irregular billing
(R60k–R120k a month), home office, car for client visits, no PAYE. Provisional
taxpayer. Typical level **K2**; a first-year contractor is **K1**.

**Context of use.** On her phone, evenings, 2–3 weeks before 31 August and
end-February; again at filing season. Has a spreadsheet of invoices and a
banking app.

### Needs (jobs)
1. Know the exact IRP6 amount and due date, each period.
2. Avoid the para 20 penalty **without** overpaying and starving cash flow.
3. Know what she can deduct (home office, travel, equipment, RA) and what each is worth.
4. Set aside the right amount monthly so the deadline isn't a shock.
5. Reconcile at year end: what is still owed or refunded.
6. Carry the figures to eFiling (IRP6 and ITR12) without retyping errors.

### Steps — current-best journey
1. Install → sign in → trial starts.
2. Onboarding: tick "Freelance/contractor", "work from home", "travel".
3. Income → Business → add record: turnover, expense rows.
4. Deductions → Home office; Travel (logbook or deemed).
5. Provisional tax → Forecast tab → see P1 recommendation and penalty check.
6. Pay on eFiling; record P1 paid in the app.
7. Repeat at P2 with updated figures; year-end → ITR12 report.

### Reasonable expectations
- Entering a year's turnover and costs once is enough to get an IRP6 figure.
- Any deduction she adds changes the IRP6 figure straight away.
- The app knows today's date and tells her which period she's in.
- It tells her the *minimum* safe payment and the *full* payment, and the difference.
- When billing changes mid-year, updating one figure updates everything.

### Deal-breakers
| # | Deal-breaker | Why it ends the relationship |
|---|---|---|
| D1.1 | IRP6 figure differs from eFiling's pre-fill or the final assessment with no explanation | Trust in U1 is gone |
| D1.2 | Must capture everything before seeing any number | Abandons at the gate |
| D1.3 | Her income type and deductions are paywalled before she has seen value | Uninstalls; "it's a calculator for salaried people" |
| D1.4 | Price above what a once-off accountant IRP6 costs (~R600) for a planning tool | Value comparison fails |
| D1.5 | Adding a deduction doesn't change the payment | "The app is broken" |
| D1.6 | Double-counted income makes the tax absurd | Instant distrust |
| D1.7 | Loses her data | Never returns |

### Success criteria (binary)
| # | Criterion | Measure |
|---|---|---|
| S1.1 | First IRP6 amount visible from cold start | ≤ 10 min and ≤ 25 taps for K2; ≤ 15 min for K1 |
| S1.2 | P1 amount = ½ × annual tax − PAYE to Aug, to the rand | Engine fixture |
| S1.3 | Para 20 check states yes/no and the shortfall | Present on screen with rand values |
| S1.4 | Adding a R10,000 deduction lowers the IRP6 figure within the same session, no extra step | Value changes on next view |
| S1.5 | Captured vs projected income shown separately, with the assumption stated | Text present |
| S1.6 | Minimum penalty-safe and full payment both shown | Two figures |
| S1.7 | Every planner figure has a citation one tap away | Tap test on every figure |
| S1.8 | No income counted twice whatever order she captures in | Fixture: business record + planner months |
| S1.9 | Next deadline and days remaining shown on the Dashboard | Present |
| S1.10 | Figures carry to eFiling field labels | Export lists IRP6 fields |

### Failure modes
| # | Failure | Likely cause |
|---|---|---|
| F1.1 | Enters year-to-date billing as if annual (or annual as YTD) | Field doesn't say which |
| F1.2 | Types invoices into planner months **and** a business record | Two capture places, no warning |
| F1.3 | Adds home office; IRP6 unchanged; assumes it's ineligible | Deduction not in forecast |
| F1.4 | Pays full-tax recommendation; cash crunch | No minimum-safe option shown |
| F1.5 | Never finds the planner | It's a tab inside Provisional tax |
| F1.6 | Trial ends in March; P1 is in August; never sees the planner work | Trial anchored at install |
| F1.7 | Claims private car costs as business and as travel | Overlap warning missed |
| F1.8 | Skips onboarding question; contractor pages hidden | Profile filters too aggressively |

---

## 3. P2 — Sipho, salaried with side income

**Profile.** 41, salaried engineer ~R780k, one Airbnb flat, investment
portfolio; newly pulled into provisional tax. **K2**.

**Context.** Triggered by a SARS letter, first IT3(b) or Airbnb payout
statement. Wants one answer: what does the side income cost?

### Needs
1. The extra tax caused by the side income, as one figure.
2. Whether he must register as provisional and when.
3. Which flat expenses are deductible (interest yes, capital no; levies, rates, cleaning, Airbnb fees).
4. Interest and dividend exemptions applied automatically.
5. Avoid retyping what his IRP5 already says.

### Steps
1. Install → onboarding: salary + rental + investments.
2. Income → Salary (IRP5) → Rental → Investments (IT3(b)).
3. Expenses for the flat.
4. Outcome / Provisional tax.

### Reasonable expectations
- PAYE already paid is credited; he only sees the gap.
- The app says if he is now a provisional taxpayer and what that means.
- Airbnb as short-term rental is handled (not just long-let).

### Deal-breakers
| # | Deal-breaker |
|---|---|
| D2.1 | Can't see what the side income alone costs |
| D2.2 | PAYE double-counted or not credited |
| D2.3 | Has to retype the whole IRP5 line by line before any answer |
| D2.4 | Any hint data leaves the phone |
| D2.5 | Rental expenses rejected with no reason |

### Success criteria
| # | Criterion | Measure |
|---|---|---|
| S2.1 | "Side income adds R x to your tax" shown | One figure, = tax(all) − tax(salary only) |
| S2.2 | Provisional status verdict with reason | Text present |
| S2.3 | Exempt interest/dividends shown as excluded | Line items |
| S2.4 | Deductible vs non-deductible rental costs with one-line reason | Each row |
| S2.5 | Salary-only quick entry (gross + PAYE) gives a correct result | ≤ 2 fields |

### Failure modes
| # | Failure | Cause |
|---|---|---|
| F2.1 | Enters bond repayment (capital + interest) as a cost | No split prompt |
| F2.2 | Treats Airbnb platform payout as net of fees | Gross vs net unclear |
| F2.3 | Doesn't know he is provisional until penalised | No proactive verdict |
| F2.4 | Pays the paywall for rental, then can't find the answer he came for | No side-income card |

---

## 4. P3 — Peter, the sole proprietor catching up (edge case)

**Profile.** Vape-shop owner making his own juice; never registered until a
third party asked for compliance proof; has invoices, no tax knowledge.
**K1**. SARS data shows **162,690 provisional taxpayers filed prior-year
returns** in the 2024–25 season (`04` §1) — catching up is not rare.

### Needs
1. Know what amounts to enter on eFiling and in which fields.
2. Know which expenses are deductible, in plain language.
3. Possibly several back years.
4. Understand the tax year (March–February).
5. Understand what happens next (assessment, penalties for late years).

### Steps
1. Install → onboarding: business income.
2. Choose tax year(s) — may be prior years.
3. Turnover + costs by category.
4. Review the deductible split.
5. ITR12 report → eFiling.

### Reasonable expectations
- Plain words, no section numbers without a gloss.
- It can do earlier years.
- It warns that late returns attract penalties, without lecturing.

### Deal-breakers
| # | Deal-breaker |
|---|---|
| D3.1 | Jargon he can't follow |
| D3.2 | "Consult a practitioner" with no answer |
| D3.3 | Can't do the back years he needs |
| D3.4 | Mixes personal and business costs and the app accepts it silently |

### Success criteria
| # | Criterion |
|---|---|
| S3.1 | Every eFiling amount mapped to its ITR12 field/source code |
| S3.2 | Each expense category marked deductible or not, with a plain one-line reason |
| S3.3 | Prior-year return computable for each year back to 2015/16 |
| S3.4 | Export opens on the phone unaided |
| S3.5 | No unexplained term on any screen in his path (glossary or inline gloss) |

### Failure modes
| # | Failure |
|---|---|
| F3.1 | Enters calendar-year figures |
| F3.2 | Puts stock purchases and personal spend in one bucket |
| F3.3 | Gets lost between current and historical years |
| F3.4 | Stops at the paywall — catch-up users have one-off need |

---

## 5. P4 — Margaret, the semi-retired consultant (**approved 2026-10-16, OD-5**)

**Why add her.** SARS's own table (`04` §2): in 2023, **55% of assessed
provisional taxpayers were 55 or older**; only 22% were 25–44, where P1–P3
sit. The single biggest group is 55–64 (116k), then 65–74 (95k).

**Profile.** 63, retired from a corporate job, does part-time consulting
(R300k), living annuity (R420k), interest and dividends, one let flat.
Provisional because annuity PAYE doesn't cover the rest. **K2**, often large
text.

### Needs
1. Provisional payments across annuity + consulting + rental + interest.
2. Age rebates and the higher interest exemption applied correctly.
3. Living-annuity drawdown rate vs tax — "what if I draw 5% instead of 7%?"
4. Medical credits incl. the 65+ rules.
5. Large readable text; no tiny tap targets.

### Deal-breakers
| # | Deal-breaker |
|---|---|
| D4.1 | Unreadable at large font sizes |
| D4.2 | Age rebates / 65+ exemption wrong |
| D4.3 | Annuity PAYE not credited |

### Success criteria
| # | Criterion |
|---|---|
| S4.1 | Usable end-to-end at 130 % and 200 % system font |
| S4.2 | Secondary rebate and 65+ interest exemption applied when DOB says so |
| S4.3 | Annuity IRP5 PAYE credited in the IRP6 recommendation |
| S4.4 | Drawdown what-if changes tax in one step |

### Failure modes
| # | Failure |
|---|---|
| F4.1 | Birth-month-only DOB puts her the wrong side of 65 at year end |
| F4.2 | Doesn't know annuity income is "remuneration" with PAYE |

---

## 6. Anti-profile

Purely salaried auto-assessment taxpayer: everything pre-populated, no
deductions, no provisional duty. **Note:** today's free tier serves exactly
this person (`02` F1).
