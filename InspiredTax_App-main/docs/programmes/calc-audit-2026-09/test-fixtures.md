# InspiredTax Africa – test cases for the calculation audit (tax year 2026)

> **Status 2026-10-04.** The owner's scenario list behind
> `run-audit-fixtures.js` (same folder), which `tests/run-debug-harness.js`
> loads. The rest of the calculation-audit programme is summarised in
> `docs/PROGRAMMES.md` P26.

## How to use this file

**Two kinds of result:**

* **Fixed results** are given below. They are plain arithmetic (sums, the annual exemption for interest, the percentage cap on retirement deductions) and do not depend on the 2026 rate tables.

**Rate-dependent results**: tax on taxable income, rebates, medical tax credits, lump-sum tax and foreign tax credit limits. Work these out from the verified 2026 SARS tables and check them against Allan's QA answer key. Never take them from the app's own output.

**Every scenario must pass these checks:**

* All the amount-matching tests (TEST-1 to TEST-11) that apply to it.
* No screen shows NaN, "undefined" or a negative zero.
* Charts follow the chart rule, including the zero and negative cases.
* Every figure updates after an edit, and again after a delete.

\---

## Summary of scenarios

|#|Who / situation|Main things tested|
|-|-|-|
|S1|Low earner, income below the tax threshold|Tax of R0; cards and charts when amounts are zero|
|S2|Salaried, one employer, refund|Refund bar; retirement deduction within the cap; medical tax credit|
|S3|Two employers, amount owing|PAYE note for more than one employer (D9); owing bar|
|S4|Mixed income sources (the original F1)|Full chain of cards; exempt interest; foreign income; income hero breakdown (A5)|
|S5|Age 65–74, pension with investments|Higher interest exemption; exempt local dividends; secondary rebate; medical credit for 65+|
|S6|Age 75+, just above the tax threshold|Tertiary rebate; very small amount of tax|
|S7|Retirement contributions above the percentage cap|Cap calculation; amount brought forward and carried forward (B9, B10)|
|S8|High earner above the R350,000 cap|Rand cap; travel allowance; fringe benefit|
|S9|Foreign employment|Foreign employment exemption; foreign-currency entry (C8); foreign tax credit; foreign dividends|
|S10|Retirement lump sums (includes F2)|Running total of lump sums (A1); crossing into the taxed band; two-pot savings withdrawal|
|S11|Sole proprietor paying provisional tax|Business income; provisional tax payments; owing or refund|
|S12|Business loss, and assessed loss from a prior year|Loss set off against salary; assessed loss brought forward and carried forward|
|S13|Rental income and capital gains|Net rental income; CGT exclusion and inclusion; capital loss smaller than the exclusion|
|S14|Person with a disability, medical expenses|Additional medical expenses tax credit for disability|
|S15|Only an "Other" deduction|A2, A3, C16|
|S16|Nothing captured, or data reset|All amounts R0; no charts shown; no errors|
|S17|Same data under 2026 and 2027 tables|Rate tables load correctly for each year (A8)|
|S18|Amounts with cents|Rounding rule|

\---

## S1 – Below the tax threshold

* **Inputs:** age 30; salary R90,000; PAYE R0.
* **Fixed results:** gross income = gross taxable income = taxable income = R90,000.
* **Checks:**

  * The tax payable card shows the calculation ending in R0. It must not show a negative number.
  * The refund/owing bar shows a zero state, not a broken bar.

## S2 – One employer, refund

* **Inputs:**

  * Age 40; salary R420,000; PAYE R85,000 (deliberately too high).
  * RA contributions R30,000.
  * Medical scheme: main member plus spouse, 12 months; contributions R48,000.
* **Fixed results:**

  * Retirement cap: 27.5% × R420,000 = R115,500, so the full R30,000 is deductible and nothing is carried forward.
  * Taxable income: R420,000 − R30,000 = R390,000.
* **Checks:**

  * The refund bar: provisional tax + PAYE + fund withholding = R85,000, split into the refund and tax payable.
  * Tax saved on the dashboard equals tax saved on the Deductions page (TEST-4).

## S3 – Two employers, amount owing

* **Inputs:**

  * Age 35.
  * Employer A: salary R300,000, PAYE R50,000.
  * Employer B: salary R250,000, PAYE R37,000.
* **Fixed results:** gross income = taxable income = R550,000; total PAYE R87,000.
* **Checks:**

  * The D9 note appears.
  * "Total PAYE withheld" shows R87,000.
  * The owing bar: tax payable = PAYE + amount owing.

## S4 – Mixed income sources

* **Inputs:**

  * Age 45.
  * Employment R480,000; pension/annuity R90,000; foreign employment R60,000 (does not qualify for the foreign employment exemption); local interest R30,000.
  * RA contributions R60,000; other deductions R5,000.
  * Medical scheme: main member only, 12 months.
  * Foreign tax paid R6,000.
  * PAYE R110,000 (two employers); provisional tax R20,000; tax withheld by fund R4,000.
* **Fixed results:**

  * Gross income R660,000.
  * Exempt interest R23,800, so gross taxable income R636,200.
  * Taxable interest R6,200.
  * Deductions R65,000 (retirement cap is 27.5% × R630,000, so the full R60,000 is within it).
  * Taxable income R571,200.
* **Checks:**

  * The income hero includes pension/annuity (A5).
  * The donut shows taxable sources only (Employment, Pension, Foreign, Taxable interest R6,200).
  * The Exempt income card shows R23,800. The Foreign income card shows R60,000.

## S5 – Age 65–74, pension with investments

* **Inputs:**

  * Age 68; annuity R240,000.
  * Local interest R60,000; local dividends R20,000.
  * Medical scheme contributions R60,000 (main member only); out-of-pocket medical expenses R15,000.
* **Fixed results:**

  * Gross income R320,000.
  * Exempt income: R34,500 interest + R20,000 dividends = R54,500.
  * Gross taxable income R265,500.
  * Taxable income R265,500.
* **Checks:**

  * The Exempt income card breakdown shows interest and dividends.
  * The dividends are shown but are left out of the taxable-sources donut.

## S6 – Age 75+, just above the threshold

* **Inputs:** age 78; annuity R180,000; local interest R40,000.
* **Fixed results:**

  * Exempt interest R34,500.
  * Gross taxable income = taxable income = R185,500.

## S7 – Retirement contributions above the percentage cap

* **Inputs:**

  * Age 50; salary R800,000.
  * Pension fund R100,000; RA R150,000.
  * Contributions brought forward from last year that were not deducted: R40,000.
* **Fixed results:**

  * Cap: 27.5% × R800,000 = R220,000.
  * Available: R100,000 + R150,000 + R40,000 = R290,000.
  * Deductible R220,000; carried forward R70,000.
  * Taxable income R580,000.
* **Checks:**

  * The B9 cap card: cap R220,000 − current contributions R250,000 − brought forward R40,000 = −R70,000, shown as R70,000 carried forward.
  * The B10 hero shows pension, RA, brought forward and carried forward.
  * Neither card has a chart.

## S8 – High earner above the rand cap

* **Inputs:**

  * Age 55; salary R1,500,000; RA R400,000.
  * Travel allowance R120,000, with no business-travel claim (no logbook).
  * Company car fringe benefit R60,000.
  * PAYE R520,000.
* **Fixed results:**

  * Gross income R1,680,000. The full travel allowance is taxable because nothing is claimed against it. (Only 80% is subject to PAYE, but that affects PAYE, not the final tax calculation.)
  * Cap: 27.5% × R1,680,000 = R462,000, which is above R350,000, so the cap is R350,000.
  * Deductible R350,000; carried forward R50,000.
  * Taxable income R1,330,000.
* **Check:** the cap card shows the R350,000 limit as the one that applies.

## S9 – Foreign employment

* **Inputs:**

  * Age 38.
  * Foreign employment income USD 90,000, entered in USD. The app looks up the rate; record the rate used as X.
  * Worked outside South Africa for more than 183 days in the year, including more than 60 days in a row.
  * Foreign tax paid: USD 12,000.
  * Foreign dividends R30,000.
* **Fixed results:**

  * Foreign employment in rand = 90,000 × X.
  * Exempt: the lesser of that rand amount and R1,250,000. Taxable foreign employment = rand amount − exempt amount.
* **Checks:**

  * The currency entry stores the rate and where it came from (C8).
  * The Foreign income card and the Exempt income card add up correctly and agree with each other.

## S10 – Retirement lump sums

* **S10a (this is F2):**

  * Inputs: lump sums received in prior years R100,000; this year R9,000.
  * Expected: closing running total R109,000; lump-sum tax R0 (TEST-1, TEST-2).
* **S10b (crossing into the taxed band):**

  * Inputs: prior years R500,000; this year R200,000.
  * Expected: closing running total R700,000.
* **S10c (two-pot savings withdrawal):**

  * Inputs: salary R400,000; savings withdrawal R30,000; tax withheld by the fund R9,000.
  * Expected: the R30,000 is taxed as ordinary income at the normal rates, not under the lump-sum table. Taxable income R430,000. The R9,000 is shown as "tax withheld by fund" on the refund/owing bar.
* **Check:** the Tax balances screen shows opening balance, amount added this year and closing balance, and they add up.

## S11 – Sole proprietor paying provisional tax

* **Inputs:**

  * Age 42.
  * Business income R900,000; business expenses R350,000.
  * RA R80,000.
  * Provisional tax: first payment R60,000, second payment R70,000.
* **Fixed results:**

  * Net business income R550,000.
  * Cap: 27.5% × R550,000 = R151,250, so the full R80,000 is deductible.
  * Taxable income R470,000.
  * Provisional tax paid R130,000.
* **Check:** the business storefront row shows the net amount; if the gross amount is shown, the expanded view explains how the net is reached.

## S12 – Business losses

* **S12a (current-year loss set off against salary):**

  * Inputs: salary R400,000; PAYE R70,000; business income R200,000; business expenses R320,000.
  * Expected: business loss R120,000, set off against the salary (ring-fencing under s20A doesn't apply at this income level). Taxable income R280,000.
* **S12b (assessed loss from a prior year):**

  * Inputs: assessed loss brought forward R50,000; business profit this year R30,000; no other income.
  * Expected: taxable income R0; assessed loss carried forward R20,000.
* **Check:** the assessed loss line appears in the taxable income calculations (B3 and B5); no chart is shown when the result is R0 or negative.

## S13 – Rental income and capital gains

* **S13a:**

  * Inputs: salary R350,000; rental income R180,000; rental expenses R60,000; capital gain on shares R150,000.
  * Expected:

    * Net rental income R120,000.
    * Taxable capital gain: (R150,000 − R40,000) × 40% = R44,000.
    * Taxable income R514,000.
* **S13b:**

  * Inputs: the same as S13a, but a capital loss of R30,000 instead of the gain.
  * Expected: the R40,000 annual exclusion absorbs the loss, so the taxable capital gain is R0 and there is no capital loss to carry forward. Taxable income R470,000.

## S14 – Disability and medical expenses

* **Inputs:**

  * Age 45; the main member has a disability; salary R500,000.
  * Medical scheme: main member plus one dependant, 12 months; contributions R72,000.
  * Out-of-pocket medical expenses R40,000.
* **Check:** the tax payable card shows each credit on a separate line.

## S15 – Only an "Other" deduction

* **Inputs:** salary R250,000; one "Other" deduction of R5,000, with a description.
* **Fixed results:** taxable income R245,000.
* **Checks:**

  * The row moves to Completed and shows R5,000 (A2).
  * The hero deduction count is 1 (A3).
  * The description appears once (C16).

## S16 – Nothing captured, or data reset

* **Inputs:** none; then capture data and run a reset.
* **Expected:**

  * Every amount shows R0.
  * Donuts are hidden.
  * No NaN.
  * Cards still open and show the calculation with zeros.
  * The deduction count is 0.

## S17 – 2026 versus 2027 tax tables

* **Inputs:** run S4 under tax year 2026, then under 2027.
* **Expected:**

  * The fixed results are the same in both years.
  * The rate-dependent results match each year's verified tables.
  * Switching years never mixes one year's tables into the other.

## S18 – Rounding

* **Inputs:** salary R412,345.67; PAYE R88,123.45; RA R12,345.55; interest R1,234.49.
* **Expected:**

  * The app calculates with the unrounded amounts.
  * Every displayed total equals the sum of its displayed parts, or shows a separate rounding line.
  * The same figure is identical to the cent on every screen where it appears.

