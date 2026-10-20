# Play Console copy — store listing, Data Safety, content rating, release notes

> **Status 2026-10-04.** Kept as the record of what was submitted to Play
> Console; the Console is the source of truth for the live listing. The
> spec and handover it cites were retired (`git show 15a9d6e:<path>`).
> **Before cloud backup is switched on**, the Data safety answers and every
> "tax data never transmitted" statement below must be revised — encrypted
> backups would then leave the device for the user's own Drive (BACKLOG
> item 11). **2026-10-16:** the title, short and full descriptions follow
> `docs/product/MESSAGING.md` (DECISIONS MSG-1 to MSG-4); the "traceable to
> the exact section of the Act" line is gone (MSG-2). The new short and full
> descriptions are C-95 — paste into Console after owner review.

Drafted 2026-07-15 against `00-SPEC.md` §5 (listing copy) and §9 (Data
Safety/policy forms). Amended 2026-07-18 (H-E5 review): short-description
and release-notes "zero data collection" claim corrected (it contradicted
§2's post-monetization Data Safety answers), stale website URL replaced
with the live custom domain, offline-claim bullet tightened. Amended
2026-07-19 (owner decision): short description reworded to lead with
SARS-cited accuracy and the two flagship calculators (deductions,
provisional tax) instead of the privacy/offline framing — owner's call
that most users care more about "what does it do" than the on-device
storage angle; full description rewritten with a fuller income/deduction
list, an expanded feature list, and a reworded "ACCURATE AND UPDATED"
section (renamed from "BUILT TO SHOW ITS WORKING"). Ready to paste into
Console; the owner should give each section a final read before
submitting (character limits below are Play's hard limits — Console will
reject anything over). Amended 2026-07-21 (Play Store rejection —
"Violation of Misleading Claims policy: Missing Source Link for
Government Information"): the flagged location was the store listing
description itself, not just in-app content — added an explicit
`https://www.sars.gov.za/` source link (plain text; Play auto-links URLs
in descriptions) to the "ACCURATE AND UPDATED" section. The existing
"NOT A SUBSTITUTE FOR PROFESSIONAL ADVICE" section already carries the
required non-affiliation disclaimer. Amended 2026-07-30 (DECISIONS C-E6 —
owner decision): support contact confirmed as `inspiredfr@gmail.com` —
the owner is using the existing personal address for launch rather than
standing up a dedicated `support@inspiredtax.co.za` inbox. Contact-email
line below finalized; the in-app About modal now also carries a "Contact
us" mailto link to the same address (`src/body.html`, H-M2).

Status tracked in `BACKLOG.md`: C-M6 (listing copy), C-M5 (policy forms).

---

## 1. Store listing copy (C-M6)

### App title (max 30 chars)

```
InspiredTax: SA Tax Calculator
```
(30/30 chars — at the limit, includes the two highest-value search terms:
"tax" and "SA"/"South Africa" via "Calculator".)

### Short description (max 80 chars)

```
Work out your SA income tax and what to pay at each provisional tax deadline.
```
(77/80 chars. Amended 2026-10-16 (C-95, DECISIONS MSG-1/MSG-2): leads with
provisional tax; "SARS-cited" dropped — statutory references left the UI with
OD-16. Paste into Console after owner review. Previous wording: *Calculate SA
income tax offline. SARS-cited deductions and provisional tax* (74/80).
Amended 2026-07-19: reworded per owner decision to lead with
SARS-cited accuracy and the two flagship calculators — deductions and
provisional tax — rather than the privacy/offline framing. The privacy
and on-device-storage claims aren't dropped from the listing; they're
covered in full in the "PRIVATE BY DESIGN" section of the full description
below and in the Data Safety form (§2).)

### Full description (max 4000 chars)

```
If PAYE doesn't settle your tax — freelance fees, rent, interest, a side business — InspiredTax works out your South African income tax and what to pay at each provisional tax deadline. Everything you enter stays on your phone. InspiredTax is an independent tool: it is not affiliated with or endorsed by SARS.

Salary, PAYE and retirement are free. Most calculators, planners and reports need Premium — start with a 7-day free trial, no card needed.

PROVISIONAL TAX WITHOUT GUESSING
• Estimates for the first payment (31 August), the second (end of February) and the optional third.
• A check against the underestimation penalty before you pay.
• What-if scenarios and multi-year projections.

EVERY KIND OF INCOME
• Salary and PAYE from your IRP5, by source code (free).
• Retirement income, including lump sums (free).
• Interest, dividends and IT3(b) amounts, with the interest exemption applied.
• Rental properties, Airbnb included, and their expenses.
• Your own business or freelance income.
• Capital gains and losses, with the annual exclusion and primary-residence relief.
• Crypto disposals, treated as capital or revenue.
• Foreign income with foreign tax credits.

TEN DEDUCTION AREAS
Retirement contributions and income protection (free); medical credits, travel (logbook or deemed cost), home office, donations, tools and equipment, professional memberships, subsistence, and other codes from your certificates.

READY FOR FILING
• A risk review of your return before you file.
• A field-by-field ITR12 guide built from your figures, to copy into eFiling.
• Close out a year and carry unused amounts into the next.
• Earlier tax years back to 2015/16, and a year-on-year comparison.
• CSV export.

BUILT ON SARS'S PUBLISHED TABLES
Each tax year — 2024/25, 2025/26 and 2026/27 — uses that year's own rates, rebates, thresholds and medical credits from SARS's published tables. A Tax Act references page lists the law behind the rules. Official source for tax law and rates: https://www.sars.gov.za/

YOUR DATA STAYS ON YOUR PHONE
• Your figures are stored only on this device, encrypted with AES-256-GCM under a key made from your PIN. The app locks itself after 5 minutes.
• No ads, no analytics, no tracking. We run no server and never receive your tax data.
• Calculations work with no connection.
• The internet is used for two things only: Google Play purchases, and a one-time Google sign-in that saves your trial start date in a hidden app folder in your own Google Drive. No tax data goes there.
• Export an encrypted backup file at any time and import it on a new phone.

ONE PERMISSION
InspiredTax asks for internet access only, for the two uses above. It does not read your contacts, location, photos, files, camera or messages.

ALSO
• A separate PIN-protected profile for each person who uses the phone.
• Easy View: text one and a half times larger across the app.

NOT A SUBSTITUTE FOR PROFESSIONAL ADVICE
InspiredTax is an independent estimation and planning tool. It is not affiliated with, endorsed by, or connected to the South African Revenue Service (SARS) or the South African Government, and it is not official eFiling software. All results are estimates for informational purposes — verify anything significant with a registered tax practitioner before you file.

Questions: inspiredfr@gmail.com
```
(Character count: 3,335/4000, measured 2026-10-16.
Rewritten 2026-10-16 (C-95, DECISIONS MSG-1 to MSG-3) from
`docs/product/MESSAGING.md`: opens with provisional tax for people whose
tax PAYE does not settle; the "every figure traceable to the exact section
of the Act / tap (i)" claim is gone (OD-16 removed statutory references
from the UI) and "ACCURATE AND UPDATED" became "BUILT ON SARS'S PUBLISHED
TABLES", which keeps the `https://www.sars.gov.za/` source link Play
required on 2026-07-21; "Historical … up to 10 years" became "back to
2015/16"; free items are marked. The opening still says most features need
Premium (BACKLOG 74). Paste into Console after owner review; the previous
text is in git history.)

### Category & tags

- Category: **Finance**
- Tags (up to 5): "Personal finance", "Tax", "SARS", "South Africa",
  "Tax calculator" (or whatever exact tag set Play offers in-region —
  confirm at submission time, tag lists change).

### Contact email & website

- Contact email: **`inspiredfr@gmail.com`** — confirmed 2026-07-30 (owner
  decision, DECISIONS C-E6). The app uses this one address consistently: Console
  listing, in-app Terms modal, and the in-app About modal's "Contact us"
  link (H-M2).
- Website: `https://inspiredtax.co.za` (the owner's GitHub Pages site,
  repo `inspiredfr/InspiredTax`, custom domain via `CNAME` — live since
  2026-07; the previous `inspiredfr.github.io/InspiredTax` default URL is
  stale — the in-app Terms modal already links the custom domain).

---

## 2. Data Safety form answers (C-M5)

Play's Data Safety questionnaire is asked as a series of yes/no + category
picks. Answers below are accurate to what the app actually does — do not
soften or embellish; a mismatch between this form and real behavior is a
policy-strike risk (per `00-SPEC.md` §9.1).

**Submitted** (*owner-reported 2026-10-14*; unchanged since the first
submission). Why each answer is accurate: `docs/DECISIONS.md` DS-1. The draft
this section held before — "Yes — Financial info" — was never submitted, and
it misread Play's definition: "collect" means sent off the device by the app,
so data kept on the phone is not declared.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No.** Tax figures, the profile and notes never leave the phone; Google Play collects payment details itself and the app keeps the purchase record on the phone; the sign-in e-mail stays on the phone; the trial date sits in the user's own Drive. Purchases carry no identifier from 8.36.0 (earlier builds sent Play a hashed install ID; removed by the owner's choice 2026-10-15, BACKLOG 33) |
| Account creation (if asked) | **The app does not let users create an account** in Play's sense: the username + PIN profile is created and operated offline (Play Console Help 13327111: not an app account), and Google sign-in creates no account on a developer server |
| Privacy policy URL | `https://inspiredtax.co.za/privacy.html` |
| Advertising ID | **No** — no dependency adds `AD_ID` |

With *No*, Play asks none of the data-type, encryption-in-transit or
deletion questions (Help 10787469). Any new data flow that leaves the phone
reopens this section first.

### Advertising declaration
**None** — the app shows no ads.

### Government app declaration
**No** — this is an independent third-party tool, not official SARS or
government software (see the in-app and store-listing non-affiliation
disclaimer).

### Financial Services declaration
**Yes** — the app assists with personal income tax estimation and
planning. It does not process payments, hold funds, or provide regulated
financial advice; it is a calculation/estimation tool only. Cite the
in-app disclaimer text verbatim if the form asks for it (§4, *Non-affiliation
disclaimer*).

### Content rating questionnaire (IARC)

The app has no violence, sexual content, profanity, gambling, or
user-generated/social content of any kind — it's a private calculator.
Expected outcome: **rated for all ages** (PEGI 3 / Everyone equivalent).
Answer every IARC category question "No"/"None" — there is nothing in
this app that would trigger a higher rating.

---

## 3. Release notes (Play Console "What's new")

Play Console caps release notes at **500 characters per language**,
spaces and line breaks included; longer text is refused in the Console and
by the Publishing API (corrected 2026-10-14 — this section used to call the
limit informal). Draft for the first production release:

```
Welcome to InspiredTax — your offline South African income tax calculator. This release includes:

• Full ITR12 tax computation for the 2026/27 tax year (Budget 2026 rates)
• Multi-year support: close out a tax year and carry your assessed loss, capital losses, retirement and donation excess forward
• Every figure traces to its SARS source — tap (i) on any number
• Offline calculations, AES-GCM-256 encryption, no ads or tracking

Questions? See the in-app FAQ (menu → FAQ).
```
(477 characters, measured 2026-10-14 — trimmed from 522 for BACKLOG 74: shorter carry-forward line, no "100%", the support-site line dropped. Owner copy, QD-16.)

For subsequent releases, keep the same format: 2–4 bullets of what
actually changed (pull from the relevant `CHANGELOG.md` entry), not a
generic "bug fixes and improvements."

**Draft for 8.36.0 — the closed-testing build (BACKLOG 66), for owner
approval (QD-16).** Distilled from `CHANGELOG.md` `[Unreleased]`; the
branch-audit record at its top is not user-facing and is left out. 492
characters (the last bullet, for BACKLOG 70 and 71, added 2026-10-14).
BACKLOG 33 (no purchase identifier) and 75 (sign-in on Google's current
API) are left out too: nothing a tester does changes, and 8 characters
remain.

```
What's new in 8.36
• Adding a rental, business, sale or certificate starts by asking what it is, with fewer steps
• Tax screens: tap a card for a breakdown and a chart
• Large Android text sizes: icons, amounts and rows now fit
• A problem with a field shows under it when you leave it
• Tax now matches the SARS tables to the cent
• Crypto held as an investment: only buying and selling costs reduce the gain
• Subscriptions keep the time you paid for; deleting a profile removes its backups
```

**8.36.1 — approved by the owner 2026-10-15 (COPY-4).** 232 characters.

```
What's new in 8.36.1
• Saving a backup to Drive or Files now asks whether it saved, instead of saying it didn't
• Onboarding shows why a step won't continue
• Tax balances answers on the last onboarding step are the right size again
```

---

## 4. Cross-references

- Privacy Policy / Terms / FAQ / Contact content for the support site:
  drafted directly in `inspiredfr/inspiredtax` (see that repo's
  `privacy.html`/`terms.html`/FAQ/Contact pages) rather than duplicated
  here — single source, avoids a second copy drifting out of sync with
  the in-app Terms/FAQ modals.
- CHANGELOG entry for this release: `CHANGELOG.md` (root), `[Unreleased]`
  section.
- Non-affiliation disclaimer — the in-app text, owner-approved 2026-07-08
  (retired backlog row C-E4; recovered verbatim from `git show
  3162789^:BACKLOG.md` by BACKLOG 49, 2026-10-15). It is what the About
  dialog shows (`src/body.html`, *About*); use it verbatim wherever a form
  asks for the app's disclaimer. The Play listing carries its own approved
  wording (§1, *NOT A SUBSTITUTE FOR PROFESSIONAL ADVICE*), and Terms §2
  its own legal clause.

  > InspiredTax is an independent tax estimation tool and is strictly not
  > affiliated with, endorsed by, or connected to the South African Revenue
  > Service (SARS) or the South African Government. This application is not
  > official eFiling software. All calculations provided are for estimation
  > and informational purposes only and do not constitute professional
  > financial or tax advice.
