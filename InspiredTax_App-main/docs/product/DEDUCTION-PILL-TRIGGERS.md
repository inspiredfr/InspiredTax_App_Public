# Deduction "Recommended" / "Consider" pills — the trigger list

> **Regenerated 2026-09-30 (QA remediation 2026-09, QR4.5, `RET-11`).** Mirrors
> `deductionRecommendationFor()` (`src/js/04-deductions.js`) and the one income
> ↔ deduction table `INCOME_DEDUCTION_LINKS` (`src/js/01-data.js`). The
> regression check is `tests/smoke.js` `assertIncomeDeductionLinks`; the Atlas
> (`docs/reference/app-atlas.html`) probes the same triggers independently.

Requested in QA 2026-08 (**B2-DED-B2-5**): *"Prepare a list of triggers.
Specifically create a real trigger for donations."*

**Two sources, no third.** A pill has two kinds of evidence:

1. **A captured IRP5 income code** — every one of these is a row in
   `INCOME_DEDUCTION_LINKS`. The same rows drive the Add-income tip, the note
   on a captured income row and the pill, so the three cannot disagree.
   **Change the table, not the function.**
2. **An income type ticked in setup, or a setup answer** — these live in the
   `switch` in `deductionRecommendationFor()`.

Either way the pill now carries its **reason**, shown under it
(*"Your income includes 3715 (Subsistence Allowance (Foreign)) — you are paid a
subsistence allowance."*). Both this file and the code are documentation of the
same rules: **change the code, then this file, in the same commit.**

Three states: `'strong'` → green **Recommended** · `'consider'` → cyan
**Consider** · `null` → no pill. A code-based level and a profile-based level
for the same deduction resolve to the higher; on a tie the code wins (evidence
beats an assumption).

---

## 1 · Evidence from IRP5 codes — `INCOME_DEDUCTION_LINKS`

| Codes | Deduction | Level | Reason under the pill | Source |
|---|---|---|---|---|
| 3817, 3825, 3828 | Retirement | Recommended | your employer contributes to a retirement fund for you | s11F |
| 3810 | Medical | Recommended | your employer pays medical aid contributions for you | s6A, s6B (**not** s18A — that is donations) |
| 3813 | Medical | *income note only* | — | s6A, s6B; 3813 = *Medical Services Costs* |
| 3701 | Travel | Recommended | you are paid a travel allowance | s8(1)(b) |
| 3702, 3722 | Travel | Consider | part of your travel reimbursement was taxed, so you may have business travel to claim | s8(1)(b) |
| 3816, 3802 | Travel | *income note only* | — | s8(1)(b); Seventh Schedule para 7 |
| 3704, 3715 | Subsistence | Recommended | you are paid a subsistence allowance | s8(1)(c) |
| 3714 | Subsistence | Consider | you were paid a non-taxable allowance, which may include a subsistence allowance | s8(1)(c) |
| 3606, 3616 | Home office · Tools & equipment · Professional memberships | *income note only* | — (their pills come from income type, §2) | s11(a), s11(e); ITR12 guide |

*Income note only* = the income side says a deduction may apply, but the code is
too weak to justify a pill on its own.

Removed in QR4.5: **3704** as a *Travel* "consider" trigger (it is a subsistence
code — BACKLOG item 12); **3821** as a retirement suggestion (it is a
non-taxable bursary); the "(s18A)" citation on the medical codes.

## 2 · Evidence from income types and setup answers — the `switch`

`selected` = income types ticked in setup/Profile (`INCOME_TYPE_DEFS` values) ·
`TRADE` = `business_income`, `other_income` · `EARNED` = `employment_income` +
`TRADE`.

| Deduction | Recommended when | Consider when |
|---|---|---|
| **Retirement** | *(code evidence only — §1)* | `EARNED` or `rental_income` selected |
| **Medical** | medical-aid question = yes ("you told us you have a medical aid"), **or** age ≥ 65 | — |
| **Travel** | *(code evidence only — §1)* | `TRADE` selected |
| **Home office** | "I work from home" = yes | `TRADE` selected |
| **Tools & equipment** | — | `TRADE` selected |
| **Professional memberships** | — | `EARNED` selected |
| **Donations** | donations captured, **or** an unused s18A excess carried forward | setup answer "I donate" = yes, nothing captured yet |
| **Subsistence** | *(code evidence only — §1)* | — |
| **Other claims** | never — a catch-all; nothing in a return can evidence it | — |

## 3 · Why two tiers

**Recommended** means *evidence already in the return* — a code on an IRP5, an
amount captured, or a carried-forward balance. **Consider** means *the user's
own setup answer suggests it, but nothing corroborates it yet* — a prompt, not
a finding. That distinction is what makes the pill informative; it is also why
the donations rule that returned `'consider'` for everyone was wrong.

Self-employed users still get prose guidance on travel, home office, tools and
subscriptions from `selfNotes` — a separate mechanism from the pills, shown
only when the deduction is switched off.

## 4 · Open — owner decision

Recorded in `BACKLOG.md` under **❓ Owner confirmation**, unanswered:

1. **Does the two-tier vocabulary stay?** QD-18's recommendation (keep both
   tiers and show the reason under the pill) is what QR4.5 built; the wider
   question of whether the app should advise what to claim is a product call.
2. **Should the pills follow the section palette** (deductions violet) rather
   than green/cyan? Green currently reads as "done" elsewhere in the app.
