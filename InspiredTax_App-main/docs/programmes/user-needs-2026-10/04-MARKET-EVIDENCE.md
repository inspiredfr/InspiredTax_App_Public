# 04 — Market evidence

First pass, 2026-10-16. Primary sources are SARS publications; everything
else is marked as commentary or unverified. The deep competitor teardown is
specced in `05`.

## 1. SARS figures

| Figure | Value | Source |
|---|---|---|
| Provisional taxpayers filed, 2024 tax year | **543,252** (517,356 in 2023, +5.0%) | [SARS media release, 31 Jan 2025](https://www.sars.gov.za/media-release/preliminary-figures-on-2024-2025-filing-season/) |
| Provisional taxpayers filing **prior-year** returns that season | **162,690** (242,911 the year before) | same |
| Assessed provisional taxpayers, 2023 tax year | 509,834 (87.9% assessed) | [Tax Statistics 2024](https://www.sars.gov.za/wp-content/uploads/Docs/TaxStats/2024/Tax-Statistics-2024.pdf) Table A2.1.1(b) |
| Individuals' **3rd (top-up) provisional payments**, 2023 | R1,133m (3.6% of R31,868m) | Tax Statistics 2024 Table 2.3 |

The top-up figure is the nearest published proxy for "found out after year
end that I'd underpaid": individuals voluntarily paid R1.1bn after year end
to stop interest running.

## 2. Is the SAM right? (it is about half the stated size)

Discovery recorded SAM = 200–300k using two unsourced steps. SARS's own
tables test both:

| Step | Discovery assumed | SARS 2023 (Table) | Source table |
|---|---|---|---|
| Earn R500k+ | 65% | **36.0%** (183,792 of 509,834) | A2.1.1(b) |
| Earn R500k–R2m | — | **30.0%** (152,929) | A2.1.1(b) |
| Aged 25–50 | 55% | **41.6%** are 25–54; **22.1%** are 25–44 | A2.1.4(b) |
| Aged 55+ | — | **55.0%** (280,254) | A2.1.4(b) |

Income × age is not cross-tabulated. Assuming independence (conservative —
income peaks 45–64): 543k × 30% × 41.6% ≈ **68k**; with the R500k+ cut
≈ **81k**. A defensible statement is **~70–100k core, ~200k at R500k+ of any
age.** The "+100k salaried with side income" in the research is already
inside the 543k (they *are* provisional taxpayers) and should not be added.

**Implication:** the 25–45 framing excludes the majority; persona P4 (55+)
is proposed in `01` §5.

Age breakdown, 2023: 25–34 37,495 · 35–44 75,115 · 45–54 99,691 ·
55–64 116,303 · 65–74 95,257 · 75+ 68,694.

## 3. SARS penalty counts — what exists

**Not published.** Searched the full text of Tax Statistics 2024 (17,711
lines): the only underestimation-penalty mentions describe the rule for
companies; no counts or rand values for individuals. SARS Annual Report
2024/25 summaries report compliance revenue (R304bn) without a penalty
breakdown ([summary](https://accountingacademy.co.za/news/read/sars-annual-report-2024-2025)).

Routes to an actual number, best first:

| Route | What to ask | Notes |
|---|---|---|
| **PAIA request to SARS** | Count and rand value of para 20 (Fourth Schedule) penalties and s89bis late-payment penalties levied on individuals, per tax year 2019–2024 | Statutory route; PAIA allows 30 days (+30 extension). Aggregate counts should not identify any taxpayer, but SARS may still refuse — check the TAA confidentiality grounds before filing |
| SARS Annual Report full PDF, financial statements | "Penalties and interest" revenue line | Gives rand value, not counts, not provisional-specific |
| Parliamentary written question (Standing Committee on Finance) | Same as PAIA | Slow; public answer |
| SARS Tax Statistics team | Ask whether the series exists | Informal |

Until then, use the proxies in §1 and the worked example in
`.sweetclaude/state/discovery.yaml` (R900k case: ~R4.7k penalty, ~R3.8k
interest, R58.8k cash shock).

## 4. Willingness to pay

**Verdict: the R200–R450 range is unsourced and probably understates WTP for
the core segment.** No SA survey of WTP for tax software was found. The best
market evidence is what people already pay:

| Evidence | Price | Source |
|---|---|---|
| TaxTim ITR12 — Lite / Smart / **Ultra** (freelancers, rental) | R215 / R565 / **R895** per return | [TaxTim price list](https://www.taxtim.com/za/services/) |
| TaxTim **individual IRP6** (both periods) | **R600** | same |
| ⇒ A Thandi-like user via TaxTim | **R1,495 / year** | derived |
| InspiredTax (code) | R75/month · **R495/year** · launch R300/year · prepaid 3m R150 | `src/js/14-entitlement.js:283-288` |
| Practitioner IRP6/ITR12 fees | No published list found; quoted per client | [example](https://glenfinadvice.co.za/tax-practitioner-services/) |
| Individual compliance costs (academic) | 3.61–5.31% of PIT revenue (2018); self-employed highest | [Stark, UNISA 2020](https://ir.unisa.ac.za/handle/10500/27270) — full thesis has rand figures; not yet extracted |

Reading:
- The **R495 annual price already sits above** the stated R450 ceiling — the
  owner's own pricing contradicts the range.
- People in the core segment demonstrably pay **~R1,500/yr** to TaxTim — but
  that includes *filing*, which InspiredTax doesn't do. A planning-only tool
  plausibly sits at **one-third to one-half** of that: R500–R750.
- **To validate:** a Van Westendorp price question in the closed test
  (4 questions, owner-sent), and the Stark thesis's per-taxpayer rand cost.

## 5. Competitors — first pass

Verified = read from the vendor's own page this session.

### South Africa
| Product | What it does | Price | Overlap with InspiredTax | Status |
|---|---|---|---|---|
| **TaxTim** (Twofold Capital consortium incl. Octoco, Sep 2025) | Guided ITR12/IRP6 completion **and submission**; TimAI; free calculators, expense tracker, logbook, bank importer, reminders; 1,300+ checks; registered practitioner PR-0009352 | R215–R895 + R600 IRP6 | High on planning tools (free); InspiredTax can't file | Verified ([price](https://www.taxtim.com/za/services/), [deal](https://www.benchmarkintl.com/insights/benchmark-international-successfully-facilitated-the-acquisition-of-human-robot-pty-ltd-ta-taxtim-by-a-consortium-led-by-twofold-capital-pty-ltd/)) |
| SARS eFiling / MobiApp | Filing; auto-assessment; basic IRP6 calc | Free | Filing destination, not planning | Known |
| **Franc** | Investment/stokvel app with a free provisional calculator: income + expenses per period → tax for the period | Free tool | **Exactly the "rough estimate" input** — benchmark for S-C | Verified ([tool](https://www.franc.app/tools/provisional-tax-calculator)) |
| ZarTax "SA Tax Calculator 2026" | Multi-type calc, provisional estimate, SBC calculator, offline, tables 2020/21–2026/27 | Free (listing) | Medium | Listing only ([Play](https://play.google.com/store/apps/details?id=com.zartax.app&hl=en_US)) |
| SA Tax Calc (Dapps) | Monthly PAYE calculator | Free | Low | Listing only |
| Accounter, SA Calculator Hub | Web freelancer / provisional calculators | Free | Low–medium | Unverified |

### International analogues
| Product | Market | Closest feature | Price | Status |
|---|---|---|---|---|
| Keeper | US 1099 | Quarterly estimate, safe-harbor amount, write-off finder | ~US$16/mo (review) | Partly verified |
| QuickBooks Self-Employed | US/UK | Income/expense tracking + quarterly estimates | ~US$15/mo (review) | Unverified |
| SnapTax | US | Free quarterly estimates + reminders | from US$4.99/mo | Unverified |
| Coconut | UK sole traders, MTD ITSA | Tax-as-you-go estimate from bank feed | £0–14/mo (sources disagree) | Unverified |
| FreeAgent | UK | Tax timeline; free with some banks | ~£19/mo sole trader | Unverified |
| Taxfix (ex-TaxScouts) | UK/DE | Accountant-reviewed filing | from £169/yr | Unverified |
| Hnry | AU/NZ | Tax taken at source for sole traders, % fee | — | No result this pass |
| TurboTax / Intuit | US | Filing + live experts | — | Benchmark only |

**Pattern abroad:** the winning products either *file* (TurboTax, Taxfix) or
*connect to the bank* to estimate tax continuously (Keeper, Coconut). Neither
fits InspiredTax's offline/no-server promise — its defensible niche is
**private, cited, year-round planning**, which nobody abroad sells on.
