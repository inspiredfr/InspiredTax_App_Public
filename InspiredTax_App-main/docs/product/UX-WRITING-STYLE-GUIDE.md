# InspiredTax UX Writing Style Guide

## Philosophy

InspiredTax writing serves tax correctness first, then user clarity. Copy is:
- **Precise** — every sentence conveys exactly one idea; ambiguity is a bug
- **Action-oriented** — sentences tell users what to do or what they can do, not what the system thinks
- **Tense-invariant** — always present tense; tax rules do not change by recounting them in past tense
- **User-centered when instructing; neutral when ruling** — shift voice to match the context

Tax data stays on the device; copy about calculations, saving and export uses
no network, cloud, "sync" or "upload" framing. Three features genuinely go
online and say so plainly: Google sign-in for the free trial, Play billing and
cloud backup (C-10, C-10b, C-10c — `docs/DECISIONS.md`).

> **Rules that override older examples in this guide** (owner decisions after
> it was written; see `docs/DECISIONS.md`):
> 1. **No statutory references in user-facing copy** (OD-16 / STD-PRES-1):
>    no "s11F", "s18A(1)", "para 53" in titles, notes, ⓘ sheets or tooltips.
>    The primary source goes in a code comment beside the string (WR-10) and
>    in the copy deck.
> 2. **No typed figures.** A rate, cap or threshold is interpolated from
>    `01-data.js` for the selected tax year (`CLAUDE.md` rule 5, STD-NUM-4).
> 3. **New or changed copy is drafted in the copy deck for owner review**
>    (QD-16).

---

## Core Rule: Tense

**ALL copy is present tense.** No exceptions.

- ✅ "Your data is encrypted on this device"
- ❌ "Your data was encrypted on this device"
- ✅ "Deductions are the same whether you edit here or on the home page"
- ❌ "Deductions were the same..."
- ✅ "This balance carries forward to next year"
- ❌ "This balance carried forward to next year"

**Why:** Present tense is the tense of tax law. The Income Tax Act states "is exempt," "must be included," "shall be charged." Adopting past tense invites confusion about whether a rule has changed or when it applied. The user's current action is always in the present.

---

## Five Writing Categories

### 1. Instructional (Direct Command)

**Used for:** User actions, steps, enabling features, form entry

**Voice:** Imperative (you implied, omitted)  
**Tense:** Present  
**POV:** 2nd person (you/your)  
**Style:** Direct, action verb first  
**Object focus:** User-centered — what the user should do now

**Pattern:**
```
[Verb] [object/target]. [Optional: reason or constraint].
```

**Examples:**
- "Enter only the [field name] from your last SARS assessment (ITA34)"
- "Turn on everything that applies to you. Tap a row to enter the figures"
- "Choose a 4–8 digit PIN — use all 8 digits for the strongest protection"
- "Enable it to open its calculator — a tab will appear and your figures save automatically"

**Anti-patterns:**
- ❌ "The field must be filled in" → ✅ "Enter your username"
- ❌ "You are required to click here" → ✅ "Click to continue"
- ❌ "This can be turned on if you want" → ✅ "Turn on everything that applies to you"

---

### 2. Explanatory (User Capability)

**Used for:** Explaining what the user can do, constraints on their actions, permissions, options

**Voice:** Active, 2nd person  
**Tense:** Present  
**POV:** 2nd person (you/your)  
**Style:** Conversational explanation; modal verbs (can, may, must, need to)  
**Object focus:** User-centered — what's possible for the user

**Pattern:**
```
You can [action] [when/if condition]. [Optional: consequence or reason].
You may [only] [action] [constraint].
You must [action] [when condition].
You need [to/a] [object] [to do what].
```

**Examples:**
- "You can still view this any time from Profile → Tax Year, but you won't be able to edit it"
- "You may only claim either lease payments OR wear and tear on the same vehicle, not both"
- "You need a letter from your employer confirming you use your home office exclusively for work"
- "You must still file a return at year-end even if you owe nothing extra"
- "You need to spend more than half your working time in the home office to claim"

**Anti-patterns:**
- ❌ "Only lease payments may be claimed, not wear and tear" (passive, obscures that user chooses) → ✅ "You may only claim either lease payments OR wear and tear, not both"
- ❌ "A letter from your employer is required" (passive, system-centered) → ✅ "You need a letter from your employer"

---

### 3. Regulatory / Tax Rule

**Used for:** Stating tax law, SARS rules, statutory limits, exemptions, rates, calculations

**Voice:** Passive or impersonal active  
**Tense:** Present  
**POV:** 3rd person (impersonal)  
**Style:** Neutral, factual; the law is cited in the code comment, not the copy  
**Object focus:** Process/rule-centered — what the tax system does

**Pattern:**
```
[Subject] is [status/action] [constraint/condition].
[Subject] [is/are] exempt/capped/deductible [constraint].
[Constraint], [subject] [does/does not] [action].
```

**Examples:**
- "Deductible up to ${cap} of taxable income — the excess is not lost; it carries forward to next year" *(`${cap}` from the year's donation percentage)*
- "Pension and annuity income is exempt up to your balance of retirement contributions that were never deducted"
- "Applies only to pay for work done outside South Africa. The first ${limit} is exempt; the rest is taxable"
- "Local dividends are exempt; foreign dividends are partly taxable"
- "A gain on selling a personal-use asset — a private car, furniture, appliances — is not taxed"

**Anti-patterns:**
- ❌ "You are limited to ${cap} of taxable income" (shifts focus to user constraint) → ✅ "Deductible up to ${cap} of taxable income"
- ❌ "We have capped this at ${cap}" (first person, implies discretion) → ✅ "Capped at ${cap} of taxable income"
- ❌ "The law says you must include this" (addresses user) → ✅ "Must be included in taxable income"

---

### 4. Context Note / System State

**Used for:** Describing what the system has done, what data is visible/hidden, what fields pre-fill, what's available

**Voice:** Passive or active 3rd person  
**Tense:** Present  
**POV:** 3rd person or implicit 2nd (depends on audience)  
**Style:** Descriptive, explanatory  
**Object focus:** System-centered — what the app shows or does

**Pattern:**
```
[Data/feature] [is/are] [state]. [Optional: why/where it comes from].
Only [constraint] [is/are] shown below.
[Data] [is shown/appears/is pre-filled] [source/reason].
```

**Examples:**
- "Pre-filled on eFiling from your IRP5(s)"
- "Only balances that apply to you are shown below"
- "Amounts here are the same amounts shown on their home page (Retirement Deductions, Capital Gains, etc.) — edit either one and both update"
- "Informational only for now — not yet wired into the tax calculation"
- "Balances you carry from one tax year to the next"

**Anti-patterns:**
- ❌ "We only show balances that apply to you" (first person) → ✅ "Only balances that apply to you are shown"
- ❌ "You can see the data pre-filled from your IRP5" (imperative framing) → ✅ "Pre-filled on eFiling from your IRP5(s)"

---

### 5. Field Metadata (Labels, Placeholders, Hints)

**Used for:** Input labels, placeholders, brief field hints, field state labels

**Voice:** Imperative or noun phrase  
**Tense:** Present  
**POV:** 2nd person implied (you)  
**Style:** Minimal, scannable  
**Object focus:** System-centered — what the field is

**Pattern:**
```
[Verb] [object] / [Noun phrase] / [Constraint label]
```

**Examples:**
- "Enter your username to continue"
- "required field"
- "Username (cannot change)"
- "Tax reference must be exactly 10 digits"
- "Session locked after 5 minutes of inactivity. Enter your PIN to resume"

**Anti-patterns:**
- ❌ "Username field; it cannot be changed" (too conversational) → ✅ "Username (cannot change)"
- ❌ "Please enter your PIN here to unlock your session" (placeholder too long) → ✅ "Enter your PIN"

---

## Special Contexts

### Error Messages and Validation

**Voice:** 2nd person active or imperative, depending on blame  
**Tense:** Present  
**POV:** User-centered

**If user error (user did something wrong):**
```
[Constraint stated as rule]. Enter [what].
```
- ✅ "Tax reference must be exactly 10 digits"
- ✅ "Username cannot change once created"

**If user must take action (blocked state):**
```
[Action needed] to [consequence]. [How to fix].
```
- ✅ "Enable Medical to open its calculator — a tab will appear and your figures save automatically"

### Explanations of Deductions / Income Types

**Voice:** Mix of regulatory + user capability  
**Tense:** Present  
**POV:** Starts 3rd (rule), may shift to 2nd (user's qualification)

**Pattern:**
```
[Rule — what it is]. [User scope — who should claim]. [Constraint — what disqualifies].
```

**Example:**
```
Retirement-fund contributions are deductible up to an annual cap.
Employees and the self-employed can claim, including contributions your
employer made for you (your IRP5 shows them as a fringe benefit).
```

### Notes on Carried-Forward Balances / Prior-Year Data

**Voice:** Passive or active, depending on who controls it  
**Tense:** Present  
**POV:** 3rd person (system state)

**Pattern:**
```
[Data type] is [source]. [Constraint on manual entry]. [How it updates].
```

**Examples:**
- "From your prior year SARS assessment (ITA34) — leave at 0 if this is your first lump sum. After that, this amount accumulates automatically as you add retirement lump sums and updates when a new tax year is rolled over"
- "Balances you carry from one tax year to the next. Enter only the [field], from your last SARS assessment (ITA34) or your own records — [what] are calculated automatically"

---

## Common Patterns and Phrases

| Context | Pattern | Example |
|---------|---------|---------|
| Optional data | Optional, but it can [benefit] | "Optional, but it can lower what you must pay" |
| Future feature not wired | Informational only — not yet wired | "Informational only for now — not yet wired into the tax calculation" |
| Data sources | Pre-filled from [source] | "Pre-filled on eFiling from your IRP5(s)" |
| Constraints | Only [condition] [qualifies/applies] | "Only expenses that are not reimbursed" or "Applies only to codes 3701/3704" |
| Modal (what's possible) | You [can/may/must] [action] [condition] | "You may claim either option, but not both" |
| What the system does | [Data] is [state/location/source] | "Amounts here are the same amounts shown on their home page" |
| Law reference | [Concept] under [section], see [Guide/IN] | "Exempt under s10C, see SARS Guide" |

---

## Prohibited Patterns

| ❌ Wrong | ✅ Right | Why |
|---------|---------|-----|
| "Your data was encrypted" | "Your data is encrypted" | Always present tense |
| "The system requires you to enter" | "Enter your username" | Direct imperative, not system-centered |
| "We calculate this for you" | "Calculated automatically from income" | No first-person plural; passive + active 3rd |
| "You are allowed to claim" | "You can claim" / "Claimable under s11" | Simpler modal; avoid "allowed" (sounds permission-y) |
| "Will be saved automatically" | "Saves automatically" / "Saved automatically" | Present tense, not future |
| "The app requires a 4-8 digit PIN" | "Choose a 4–8 digit PIN" | User-centered action, not system requirement |
| "If you fail to enter this..." | "Enter this to continue" | Avoid negative framing |
| "This feature is coming soon" | "Not yet wired into the tax calculation" | Specific constraint, not vague promise |

---

## Spelling: South African English

**The app is written in South African English**, which follows British
convention. This is not a preference — it is the register SARS itself
publishes in, and a return that spells things differently from the forms it
mirrors reads as foreign to the person filing it.

| ✅ Use | ❌ Not | Appears in |
|--------|--------|------------|
| instalment | installment | Provisional payments, lump sums |
| utilised | utilized | Assessed loss, carried balances |
| deductible | deductable | Every deduction screen |
| apportion / apportioned | prorate / prorated | Home office, rental |
| organisation | organization | PBO / s18A donations |
| recognised | recognized | Income recognition prose |
| -ise / -isation generally | -ize / -ization | Throughout |

**Acronyms follow SARS, not intuition.** The foreign tax credit is **FTC**.
It is never "FCT" — that transposition appears in the QA source documents and
must not be imported from them.

> ⚠ **For anyone working from the 2026-09 QA documents:** those documents
> contain `installment`, `Utilized`, `deductable` and `FCT`. In every case the
> app is already correct and the QA document is wrong. Do not "fix" the app to
> match them. This was verified against `src/` in the 2026-09 design-system
> audit.

**Currency, dates and numbers** keep their existing conventions: `R` prefix,
space-grouped thousands (a non-breaking space, so an amount never wraps
mid-number), and `en-ZA` date formatting.

---

## Casing: sentence case

**Headings, buttons, labels and modal titles are sentence case** — capitalise
the first word and proper nouns only.

| ✅ Use | ❌ Not |
|--------|--------|
| Add rental | Add Rental |
| Add other taxable receipt | Add Other Taxable Receipt |
| Tools & equipment | Tools & Equipment |
| Professional memberships | Professional Subscriptions |

**Acronyms and SARS form names keep their own casing** inside a sentence-case
string: `Add IRP5 deduction`, `Add CGT disposal`, `Add PAYE / UIF`,
`IT3(b)`, `ITA34`.

---

## Checklist for New Copy

Before shipping any user-facing text, verify:

- [ ] **Tense:** Is it present tense only? No past tense?
- [ ] **Category fit:** Does the text match one of the five categories above?
- [ ] **Voice:** Is it active (user capability / instruction) or passive (rules / system state) as appropriate?
- [ ] **POV:** Is it 2nd person for user-centered, 3rd for system/rule-centered?
- [ ] **Clarity:** Can a user read it once and understand what to do or what applies?
- [ ] **No jargon:** Are technical terms explained or linked to SARS references?
- [ ] **Law cited — in the code, not the copy:** Is the primary source in a comment beside the string and in the copy deck, with no section number in the visible text?
- [ ] **Honest about the network:** On-device features never mention cloud or sync; sign-in, billing and cloud backup say plainly that they go online.
- [ ] **No typed figures:** Is every rate, cap and threshold interpolated from data?
- [ ] **No hedging:** Avoid "may," "might," "possibly" unless stating user capability or uncertainty in law.
- [ ] **Concise:** Can it be cut by 20% without losing meaning?

---

## Examples by Screen

### Deductions Checklist

**Heading (Instructional):**
```
Turn on everything that applies to you. Tap a row to enter the figures.
```

**Toggle label (Field metadata):**
```
Retirement Deductions
```

**Status note (Context note):**
```
Recommended
```

**Input hint (Field metadata):**
```
Amount claimed this year
```

---

### Retirement Deduction Detail Page

**Introductory note (Regulatory + User capability):**
```
Retirement-fund contributions are deductible up to an annual cap.
Employees and the self-employed can claim, including contributions your
employer made for you (your IRP5 shows them as a fringe benefit).
```

**Field label (Field metadata):**
```
Enter your contribution this year
```

**Constraint note (Regulatory):**
```
Capped at ${retCap} for ${taxYearLabel}. The excess carries forward — it does not expire.
```

**Carried-forward hint (Context note):**
```
Unused contributions from earlier years: ${carried} remaining. You can claim up to ${headroom} more this year.
```

---

## Questions? Edge Cases?

If you encounter a situation this guide doesn't cover:
1. **Is it instruction?** Use imperative, 2nd person.
2. **Is it rule?** Use passive/neutral, 3rd person; cite the law in a code comment.
3. **Is it user capability?** Use "you can/may/must" + present tense.
4. **Is it system state?** Use passive + present, no first-person.
5. **When in doubt, present tense wins.**

Escalate unusual patterns to product review before shipping.
