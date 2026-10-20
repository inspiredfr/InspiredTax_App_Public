# 05 — Competitor research spec

Spec for a full-spectrum investigation. Run it as its own session (it is
web-heavy and independent of `src/`). Output goes to
`docs/programmes/user-needs-2026-10/research/`.

## Ground rules

- **Evidence grade every claim:** V = verified on the vendor's own page/app
  this run (cite URL + access date) · R = reputable third party · E = estimate
  (show the working) · U = unverified. No ungraded claims.
- **Never create an account, sign in, pay, or submit anything to SARS** on a
  competitor. Use public pages, store listings, help centres, published
  reviews, demo videos, and app UI reachable without an account.
- No copying of competitor text or screenshots into the repo beyond short
  quotes (< 15 words) with attribution; describe, don't reproduce.
- Code inspection is limited to what is publicly observable (web page source,
  tech fingerprints, public job ads, published APK metadata). **No
  decompilation of competitor apps.**

## Part A — TaxTim deep teardown

| # | Area | Questions | Method |
|---|---|---|---|
| A1 | **Company** | Ownership after Sep 2025, headcount, founders' roles, practitioner registration, partners (banks/insurers) and their terms | Press, Benchmark Intl note, LinkedIn public pages, partner pages |
| A2 | **Products & prices** | Every tier and add-on, how tier assignment works, partner discounts, price history (Wayback) | Price page, Wayback snapshots 2020–2026 |
| A3 | **Functions** | Full feature inventory: interview flow, income types, deductions, IRP6, CGT, crypto, foreign, rental, multi-year, prior years, verification/audit support, document storage, bank importer, logbook, expense tracker, TimAI | Help centre, blog, guides, public UI |
| A4 | **Use cases & audience** | Who each tier targets; which personas in `01` it serves and how well (score each D/S criterion: meets / partly / no / unknown) | A3 mapped onto `01` |
| A5 | **Market** | Users/returns claims, refunds processed (R700m+), app installs and ratings over time, review themes | Play/App Store, review mining (top 100 reviews by theme) |
| A6 | **Design, UI, UX** | Onboarding length, questions before first number, time-to-first-figure (estimate from walkthroughs/videos), jargon level, mobile vs web parity, accessibility | Public demos, store screenshots, help articles |
| A7 | **Provisional tax depth** | Does it model para 20, safe harbour, basic amount, top-up, interest? Year-round tracking or filing-time only? | Calculator + guides, tested with the `01` S1 fixtures (public calculator only) |
| A8 | **Privacy & data** | Where data lives, what is shared with partners, POPIA statements, Play data-safety form | Privacy policy, Play data safety |
| A9 | **Technology** | Stack fingerprint (web), mobile framework, eFiling integration method, AI vendor if stated | Page source, BuiltWith-style fingerprint, job ads |
| A10 | **Cost estimate — build** | Rebuild cost of A3 scope: team shape × months × SA rates | E-grade model with stated rates |
| A11 | **Cost estimate — run & maintain** | Hosting, AI inference, practitioner helpdesk staffing (seasonal), annual tax-law update effort, SARS integration upkeep | E-grade model |
| A12 | **Limitations** | What it can't do; where users complain; where InspiredTax is stronger (offline, privacy, citations, planning) and weaker (filing, verification help, brand) | A3–A8 synthesis |
| A13 | **Threat assessment** | With Octoco's AI push, what would it take for TaxTim to ship year-round planning? Likely timeline signals | Job ads, product announcements |

**Deliverable A:** `research/TAXTIM.md` — summary, A1–A13 sections, a
persona-coverage matrix (`01` criteria × TaxTim), and a one-page "how we win
/ where we lose".

## Part B — Other South African tax apps and tools

1. **Search** Play Store, App Store, Huawei AppGallery, web: "SARS", "tax
   calculator", "provisional tax", "IRP6", "freelancer tax South Africa",
   "eFiling helper"; banks' in-app tax tools (FNB, Capitec, Discovery, Absa,
   Nedbank, Standard Bank, TymeBank); accounting apps with SA tax (Sage One,
   Xero, QuickBooks SA, Zoho Books SA); investment apps with tax tools (Franc,
   EasyEquities, Satrix).
2. **Include** anything an SA individual could use to estimate or plan
   personal income tax. Exclude payroll-only and company-only tools.
3. **Teardown each** on a short form: owner, price, platforms, installs,
   rating, income types, deductions, provisional depth, offline, privacy,
   files or not, time-to-first-figure, target persona, verdict.

**Deliverable B:** `research/SA-LANDSCAPE.md` — table of all found, short
teardowns of the top 8, and a positioning map (axes: planning depth ×
filing; privacy × convenience).

## Part C — International analogues

1. **Scope:** products for self-employed individuals that estimate and plan
   income tax during the year: US (Keeper, FlyFin, QuickBooks Self-Employed,
   SnapTax, TurboTax), UK (Coconut, FreeAgent, Taxfix/TaxScouts, Hammock,
   Sage Sole Trader), AU/NZ (Hnry, Thriday), EU (Taxfix DE, Accountable BE/DE),
   India (ClearTax) — and any **offline/privacy-first** tax tool anywhere.
2. **Same short-form teardown** plus: business model (subscription / per
   return / % of income / bank partnership), bank-feed dependence, and the
   one idea worth borrowing.

**Deliverable C:** `research/INTERNATIONAL.md` — table, top-6 teardowns,
"ideas worth borrowing" list mapped to `03` suggestions.

## Part D — Synthesis

`research/SYNTHESIS.md`: where InspiredTax is unique, where it's behind, what
the evidence says about price (`04` §4), and changes to `03` it implies.

## Done means

- Every row evidence-graded; every V/R claim has a URL and access date.
- Persona-coverage matrix filled for TaxTim and the top 3 SA alternatives.
- Cost estimates show inputs and can be recomputed.
- No accounts created, nothing purchased, nothing decompiled.
