# Closed-testing feedback log — 2026-10

Working document for the 14-day closed test (`docs/android/CLOSED-TESTING.md`,
BACKLOG 34). It holds two things the production-access form asks for and
nothing else can answer: which features testers actually used, and what
feedback came in and what changed because of it (guide §5). **Retired at
production access:** summarise §3 into `docs/PROGRAMMES.md` P10, move any open
residue to `BACKLOG.md`, delete this folder (`docs/DOCS-INDEX.md` §1.6).

**No personal information in this file — it is in git.** Testers appear only
as their Tester ID (`T01`…, guide §2c); names, phone numbers, e-mail
addresses, ID and tax reference numbers stay in the private sheet. Describe
a tax figure only when it is needed to reproduce a problem, and then as the
tester's hypothetical or rounded amounts, never a copied certificate. The
`tester-feedback` skill (`.claude/skills/tester-feedback/SKILL.md`) applies
these rules when it records an entry.

Open work found here goes to `BACKLOG.md` as an item (WR-9); this log only
points at it.

---

## 1. Feature tasks

Every feature should have at least two testers who used it (gate G6). Assign
from this table into the sheet's *Feature task* column, one task every three
or four days per tester, and fill *Used by* from their replies. *Basic* rows
are free; the rest are Premium (`ENT_FEATURES`, `src/js/14-entitlement.js`),
so from day 8 a tester needs the test card first (guide §2a).

| Area | Task for the tester | Tier | Assigned | Used by (FB refs) |
|---|---|---|---|---|
| Sign-in and trial | Install, create a profile, start the free trial with Google | Basic | all | |
| Onboarding | Answer the income-sources step honestly for your own situation | Basic | all | |
| Salary (IRP5) | Add an IRP5 — real figures or made up | Basic | | |
| Backup | Export a backup, then restore it (Menu → Backup, export, Restore) | Basic | | |
| Paywall and test card | After day 7: subscribe with the Google test card; note what Premium unlocks | Premium | all | |
| Investment income | Add an IT3(b) with interest and dividends | Premium | | |
| Rental income | Add a rental property with two or three costs | Premium | | |
| Business and freelance | Add freelance or side-business income with expenses | Premium | | |
| Capital gains | Add a share or property sale | Premium | | |
| Foreign income | Add foreign interest, dividends or earnings | Premium | | |
| Other receipts | Add a royalty, prize or other receipt | Premium | | |
| Crypto | Add a crypto sale, as an investment and then as trading | Premium | | |
| Medical | Add medical aid contributions and out-of-pocket costs | Premium | | |
| Travel | Add a travel allowance and a logbook claim | Premium | | |
| Home office | Add a home-office claim | Premium | | |
| Donations | Add an s18A donation | Premium | | |
| Tools and equipment | Add a laptop or tool used for work | Premium | | |
| Professional memberships | Add a professional body subscription | Premium | | |
| Subsistence | Add a subsistence allowance with nights away | Premium | | |
| Projections | Open the projection and try one suggestion | Premium | | |
| Provisional tax | Open provisional tax and the planner; read the next due date | Premium | | |
| Prior years | Run a historical-year calculation | Premium | | |
| Risk assessment | Open the risk view and say whether it made sense | Premium | | |
| ITR12 report | Open the ITR12 report | Premium | | |
| CSV export | Export the CSV and open it | Premium | | |
| Large text | If your phone uses large text: does anything overlap or run off? | Basic | | |
| SARS comparison | Already filed 2025/26 and have the SARS assessment (ITA34)? Enter the same figures in a 2025/26 profile and report only the difference, in rand | Premium | | |

The last row is the strongest correctness test available before launch: a
real assessment against the app's result. The message that would have asked
for it was declined on 2026-10-15 (DECISIONS CT-5), so this row fills only if
a tester offers it; testers report a difference, never their figures.

## 2. Log

Types: **tax** (a figure looks wrong) · **broken** (does not work, error,
crash) · **confusing** (works, but they got lost) · **copy** (wording) ·
**request** (something new) · **question** · **install** (Play, sign-in,
opt-in). *Outcome* is one of: `BACKLOG nn`, `fixed in x.y.z`, `already fixed
in x.y.z`, or `no change — <reason>`.

| FB | Date | Tester | Build | Area | Type | What they reported (de-identified) | Outcome |
|---|---|---|---|---|---|---|---|

## 3. Summary for the production-access form

Fill in when the dashboard shows the requirement met (guide §5). Each line
should be answerable from §1 and §2 alone.

- **Recruiting:** how many invited, how many confirmed signing in, how long
  it took (from the sheet, counts only).
- **Engagement:** features used, from §1 — how many rows reached
  two testers; which did not and why.
- **Feedback and how it was collected:** WhatsApp, one chat per tester,
  logged here by type — counts per type.
- **What changed because of the test:** each version shipped during the
  test, with the FB numbers it answered.
- **How readiness was decided:** no open `broken` or `tax` entry; device
  checks in `docs/android/DEVICE-CHECKS.md` §4.
