# Messaging — what we say about InspiredTax

The one source for every description of the app: Play listing, in-app About,
the support site, tester and launch messages, pitches and press. Copy a line
from here rather than writing a new one; change it here first (DECISIONS
MSG-1 to MSG-4, 2026-10-16). Each claim names the code that makes it true —
if the code changes, fix the claim here and in every surface in §9.

---

## 1. Positioning

**For** South Africans who have to work out their own tax — freelancers and
contractors, salaried people with rental, investment or side income, and sole
proprietors — **InspiredTax is** an Android app that works out their income
tax and what to pay at each provisional tax deadline, **on their phone, with
their figures kept there.** **Unlike** the SARS eFiling calculator (built for
salary), a spreadsheet, or a practitioner seen once a year, it covers every
income type, runs all year, and never sends the figures anywhere.

- **Lead with:** provisional tax and the penalty it avoids (MSG-1).
- **Second:** everything else a self-managed return needs — rental, business,
  investments, CGT, crypto, foreign income, ten deduction areas.
- **Then:** privacy, as proof, not as the headline.
- **Free entry:** salary, PAYE and retirement are free, so a salaried person
  can start there. Mention it second; don't build the pitch around refunds.
- **Not for:** taxpayers whose return SARS fills in completely (auto-assessed,
  nothing to work out).

## 2. Who it is for

| Segment | Their moment | What they need from us |
|---|---|---|
| Contractors and freelancers (e.g. an IT contractor billing about R950k, income swinging month to month) | Mid-August, the first payment due on the 31st | The amount to pay, and what home office, car and medical are worth |
| Salaried with side income (rental, Airbnb, interest, a side business) | First year the extra income pushes them into provisional tax | What the extra income adds, and what they can deduct against it |
| Sole proprietors | Year-end, or a lender asking for tax compliance | Business profit flowing into personal tax, with the expenses right |

Source: owner discovery, PR #430 (`.sweetclaude/state/discovery.yaml`).

## 3. The problem, in rand

On the 2026/27 tables (`01-data.js` `TAX_YEARS['2027']`), someone whose
taxable income ends at **R900,000** after paying provisional tax on an
estimate of **R750,000** (under 65, no safe-harbour basis):

- owes **R58,760** more tax than they planned for when the assessment arrives;
- pays a para 20 underestimation penalty of **R4,680** — 20% of the tax on
  90% of actual income (R211,933) less the tax on the estimate (R188,533) —
  plus interest on the shortfall.

Recompute this example whenever the brackets change; quote it with the tax
year.

## 4. Proof points (approved claims)

Every claim below is true at `main` and may be used anywhere. The right-hand
column is what makes it true.

| Claim | Evidence |
|---|---|
| Works out personal income tax for 2024/25, 2025/26 and 2026/27, each on that year's published SARS tables | `01-data.js` `TAX_YEARS` |
| Recalculates earlier years back to 2015/16 | `01-data.js` `HIST_TAX`; Premium `historical` |
| Salary and PAYE captured from the IRP5 by source code | `03-income.js` tabs `b1employment`, `paye` |
| Nine income areas: employment, investment, rental, own business, capital gains, retirement, foreign, other receipts, crypto | `03-income.js` income tabs |
| Ten deduction areas: retirement, medical, travel, home office, tools and equipment, donations, income protection, memberships, subsistence, other | `04-deductions.js` |
| Provisional tax: first, second and optional third payment, with the underestimation penalty check | `03-income.js` P1/P2/P3; `10-current-year-planner.js` |
| A field-by-field ITR12 guide built from your figures | `07-render-summary.js` `exportITR12` |
| A risk review of the return before you file | Premium `risk` |
| Built on SARS's published tables; a Tax Act references page lists the law behind the rules; official source: https://www.sars.gov.za/ | `01-data.js`; drawer *Tax Act References* (`mode-actref`); MSG-2 |
| Your figures stay on your phone, encrypted with AES-256-GCM under a key made from your PIN | `02-core.js` `deriveKey` (PBKDF2-SHA-256, 200,000 iterations) |
| The app locks itself after 5 minutes | `02-core.js` `AUTO_LOCK_MS` |
| One Android permission: internet | `AndroidManifest.xml` |
| No ads, analytics or tracking; we run no server | `android/app/build.gradle` (Play Billing and Play Services Auth only); DECISIONS DS-1 |
| Calculates with no connection | single-file artifact, all assets bundled |
| The internet is used for Google Play purchases and a one-time Google sign-in that saves the trial start date in a hidden app folder in the user's own Drive | `PlayBillingPlugin.java`; `TrialAnchorPlugin.java`; `drive.appdata` scope |
| Encrypted backup file to move to a new phone | `02-core.js` `exportDataAsJson` / `importDataFromJson` |
| Separate PIN-protected profiles for each person on the phone | login screen profiles |
| Salary, PAYE, retirement income, retirement contributions and income protection are free; the rest is Premium | `14-entitlement.js` `ENT_SCREEN_KEYS` |
| 7-day Premium trial: Google sign-in, no payment details, does not turn into a paid plan | `ENT_TRIAL_DAYS`; Terms §6 |
| Monthly, annual and prepaid plans, billed by Google Play | `15-entitlement-ui.js` plan list |

**Prices** come from Google Play and are shown in the app before anyone pays.
Where a rand price must be quoted (site FAQ, sales sheet), use the base plans
in `15-entitlement-ui.js` and say "launch offer" where the plan ID does:
monthly R75; annual R495 (launch offer R300); prepaid 1 month R95, 3 months
R245 (launch offer R150). Never put a price in the Play title or short
description.

## 5. Claims we do not make

| Don't say | Why | Say instead |
|---|---|---|
| Every figure is traced to the Income Tax Act / tap (i) to see the section | Removed from the UI by OD-16 | Built on SARS's published tables, with a Tax Act references page |
| Works out your tax exactly / the same way SARS does / 100% accurate / absolute compliance | Unprovable; the app is an estimate | Works out your tax on that year's SARS tables |
| Files your return / eFiling | It doesn't submit anything | Gives you the ITR12 fields to copy into eFiling |
| SARS-approved, official, endorsed | Not affiliated | Independent; not affiliated with SARS |
| 100% offline | Trial start and purchases need a connection | Calculates offline |
| No account, ever | The trial needs Google sign-in | No InspiredTax account; Google sign-in only to start the trial |
| POPIA compliant | No assessment has been done | Your figures never reach us |
| Most powerful, best, #1, revolutionary, all-in-one, seamless | Unverifiable; Play bans rankings | Name the feature |
| Afrikaans | English only | — |
| Cloud backup, sync | Built but switched off (`CLOUD_BACKUP_ENABLED = false`) | Encrypted backup file |
| iPhone, tablet | Android phones, portrait | Android 7.0 and later |
| Income bands (R300k–R1.6m, R500k–R1.5m) as a fact about the app | Nothing in the code limits income | Describe the situation (own tax to work out), not a band |
| Bank-grade, used by intelligence agencies | Hype | AES-256-GCM, key made from your PIN |

Every public surface carries the non-affiliation line (§6). Every Play
listing carries the source link `https://www.sars.gov.za/` (Play rejected the
listing without it on 2026-07-21).

## 6. Boilerplate

**Name.** InspiredTax (one word, capital I and T). Store title:
*InspiredTax: SA Tax Calculator* (MSG-3).

**Tagline.** Your South African tax, worked out on your phone.

**One line (about 20 words).** InspiredTax works out your South African
income tax and provisional tax payments on your Android phone, and your
figures never leave it.

**Short (about 50 words).** InspiredTax is an Android app for South Africans
who work out their own tax. It covers salary, freelance and business income,
rental, investments, capital gains, crypto and foreign income, ten deduction
areas and provisional tax, on each year's SARS tables. Your figures are
encrypted with your PIN and stay on your phone.

**Long (about 100 words).** InspiredTax is an Android app for South Africans
whose tax isn't settled by PAYE: freelancers and contractors, salaried people
with rental or investment income, and sole proprietors. It works out income
tax for the current and two previous tax years on SARS's published tables,
estimates each provisional tax payment, checks the underestimation penalty,
and turns the result into the ITR12 fields to copy into eFiling. Everything
runs on the phone. Figures are encrypted with a key made from the user's PIN,
the app has one permission and no analytics, and the developer runs no
server. Salary and retirement are free; Premium has a 7-day free trial.

**Non-affiliation line (every surface).** InspiredTax is an independent
estimation tool. It is not affiliated with or endorsed by the South African
Revenue Service (SARS), is not eFiling, and does not submit returns. Results
are estimates, not tax advice.

**Footer line (support site).** Provisional and personal income tax for
South Africans who work out their own, on your Android phone. Made in South
Africa.

## 7. Pitches

**10 seconds.** If PAYE doesn't cover your tax, InspiredTax tells you what to
pay SARS and when, worked out on your phone, with your figures kept there.

**30 seconds — customer.** Freelance fees, rent, interest or a side business
mean PAYE doesn't cover your tax, and SARS expects you to estimate it twice a
year. Get it wrong and the bill arrives at assessment, with a penalty. On
this year's tables, someone who earns R900,000 but pays on R750,000 owes
another R58,760 and a R4,680 penalty. InspiredTax works out your tax and each
provisional payment from your actual figures, all year, on your phone. Your
figures are encrypted and never leave it.

**60 seconds — customer.** Add your IRP5 by the codes on the certificate.
Add your freelance income, your rent, your interest, and what you spent on a
home office, the car, medical aid or a retirement annuity. InspiredTax shows
what you'll owe or get back, what to pay by 31 August and the end of
February, and whether you're heading for the underestimation penalty. When
it's time to file, it gives you the ITR12 fields to copy into eFiling, after
a risk review. It runs on each year's SARS tables and works offline. Your
figures are encrypted with your PIN and stay on your phone: one permission,
no ads, no tracking, no server. Salary and retirement are free; try the rest
free for 7 days.

**30 seconds — investor or collaborator.** Around provisional tax deadlines,
South Africans with income outside PAYE choose between SARS's
salary-focused calculator, a spreadsheet, or a practitioner they see once a
year. InspiredTax is a full personal-tax engine in an Android app: nine
income areas, ten deduction areas, provisional tax and an ITR12 guide, on
each year's tables, with legislative test fixtures behind the figures. It
runs entirely on the phone — one permission, no analytics, no server — so it
holds no customer data to secure or lose. Revenue is a Play subscription or
prepaid pass after a free core and a 7-day trial. It's in closed testing now.

## 8. Formats

### Advocate kit (testers, friends, anyone who likes the app)

*How to describe it in a sentence:* "It's an app that works out your SARS
tax, including provisional tax, on your phone. Your figures never leave it."

*Who to tell:* anyone who pays provisional tax, freelances, rents out a
flat, or has interest or a side business on top of a salary.

*Three things worth saying:*
1. It tells you what to pay in August and February, and warns you before you
   underpay.
2. It handles the awkward stuff — rental, freelance, crypto, foreign income.
3. Nothing is uploaded. It works on the phone, encrypted with your PIN.

*What not to say:* that it files your return, that SARS approves it, or that
it's exact. It's an estimate to help you prepare.

*Forwardable message (WhatsApp):*
> I've been using InspiredTax to work out my SARS tax and provisional
> payments on my phone. It does rental, freelance and investments too, and
> your figures stay on your phone. Android: https://inspiredtax.co.za/get

*In-app share message* (`APP_SHARE_MESSAGE`, C-88) is the short version and
stays as approved.

### One-page sales sheet

- **Headline:** Know what to pay SARS before the deadline.
- **Sub:** Income tax and provisional tax for South Africans who work out
  their own, on your Android phone.
- **The problem:** §3 example.
- **What it does:** income (nine areas), deductions (ten areas), provisional
  tax with the penalty check, projections, earlier years, risk review, ITR12
  guide.
- **Why trust it:** each year's SARS tables; Tax Act references page; one
  permission; encrypted with your PIN; no server.
- **Price:** salary and retirement free; Premium monthly, annual or prepaid
  through Google Play; 7-day free trial.
- **Get it:** https://inspiredtax.co.za/get
- **Footer:** non-affiliation line.

### Two-minute demo script

1. *(0:00)* "This is Thandi. She's an IT contractor; her income swings every
   month and her first provisional payment is due on the 31st."
2. *(0:15)* Open the app, PIN. "It's locked with her PIN; everything is
   encrypted on the phone."
3. *(0:25)* Income → Your own business: add the year's invoices so far. Home
   office and travel under Deductions.
4. *(0:55)* Dashboard: "That's her tax for the year on the 2026/27 tables."
5. *(1:10)* Taxation → Provisional tax: "And this is what she pays on the
   31st, and here's the penalty check."
6. *(1:30)* Taxation → ITR12: "At filing time, these are the eFiling
   fields."
7. *(1:45)* "No account with us, no upload, one permission. Salary is free;
   the rest is a 7-day trial."

Use made-up figures, never a real person's.

### Objections

| They say | We say |
|---|---|
| "SARS has a calculator." | It's built for salary. This one handles rental, business, investments, CGT, crypto and foreign income, and plans provisional payments through the year. |
| "My accountant does it." | Keep them. This tells you what to set aside before the deadline, and gives your accountant tidy figures. |
| "Is it accurate?" | It uses each year's published SARS tables, and every result is an estimate you should check before filing. |
| "Where does my data go?" | Nowhere. It's encrypted on your phone; we run no server and the app has one permission. |
| "What if I lose my phone?" | Export an encrypted backup file and import it on the new phone. A forgotten PIN can't be reset, so keep the backup safe. |
| "Does it file for me?" | No. It gives you the ITR12 fields to copy into eFiling. |
| "iPhone?" | Android only for now. |

### Partner pitch (tax practitioners, bookkeepers)

> Your provisional-tax clients call you in August and February with a
> spreadsheet and a guess. InspiredTax lets them keep their own figures up to
> date through the year — salary, rental, business, investments, deductions —
> and see their tax and provisional payments on their phone. You get cleaner
> records at year-end. The app never uploads anything, so there's no new
> data-processing risk on your side.

### Social posts

- *Launch:* InspiredTax is on Google Play. Your SARS income tax and
  provisional payments, worked out on your Android phone. Your figures stay
  on it. https://inspiredtax.co.za/get
- *August:* First provisional payment due 31 August. Work out what to pay
  from your actual income, not last year's plus 10%. https://inspiredtax.co.za/get
- *February:* Second provisional payment is due at the end of February.
  Check you're not heading for the underestimation penalty before you pay.
- *Privacy:* One Android permission. No ads, no analytics, no server. Your
  tax figures are encrypted with your PIN and never leave your phone.

### Press note

- **What:** InspiredTax, an Android app that works out South African personal
  income tax and provisional tax payments on the phone.
- **Who it's for:** people whose tax PAYE doesn't settle — freelancers,
  contractors, landlords, investors, sole proprietors.
- **What's different:** the whole calculation runs on the phone; one
  permission; no analytics; the developer holds no customer data.
- **Coverage:** 2024/25 to 2026/27, earlier years back to 2015/16; nine
  income areas, ten deduction areas, provisional tax, ITR12 guide.
- **Business model:** free core; Premium through Google Play; 7-day trial.
- **Maker:** independent developer, South Africa. Contact
  inspiredfr@gmail.com.
- **Non-affiliation line.**

## 9. Where each description lives

When this file changes, update these in the same batch.

| Surface | Location | Copy deck |
|---|---|---|
| Play listing, release notes, Data safety | `docs/programmes/play-store-launch/03-STORE-COPY.md` → Play Console | C-95 |
| Store screenshot captions and alt text; feature graphic headline | `tools/store-shots.js` (`SHOTS`, `FEATURES`) → `assets/branding/` | — (BACKLOG 86) |
| Support site phone clips and posters | `tools/store-shots.js --clips` → site `assets/app/` | — |
| In-app About intro, page description | `src/body.html` `#modal-about`; `src/head.html` | C-94 |
| Login tagline | `src/body.html` `.login-tag` | — |
| Share message | `src/js/01-data.js` `APP_SHARE_MESSAGE` | C-88 |
| Premium feature blurbs | `src/js/14-entitlement.js` `ENT_FEATURES` | — (BACKLOG 25 for statutory references) |
| Terms and privacy clause | `src/body.html` Terms modal | — |
| Tester and relay messages | `docs/android/CLOSED-TESTING.md` §2b, §2d | — |
| Support site: home, App FAQ, footer, article template, security article, privacy | repo `inspiredfr/InspiredTax` | C-96 |
| GitHub repo descriptions | `inspiredfr/InspiredTax_App`, `inspiredfr/InspiredTax` | — |
