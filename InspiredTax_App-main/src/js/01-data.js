import { $, APP, calcAgeAtYearEnd, esc, fmt, getActiveTaxYear, getSelectedIncomeTypes, isProvisionalAutoDetermined, navigateTo, pct, taxableIt3bItems } from './02-core.js';

/* ============================================================
   InspiredTax v8.5 — DATA LAYER
   All SARS official published tax data. Read-only constants.
   ============================================================ */

/* ── CURRENT TAX YEARS ──
   Bracket boundaries follow SARS convention: `min` is the smallest whole-rand
   value taxed at the bracket's `rate`. Since taxable income is rounded down
   to the nearest rand under s5(2)(c) of the Income Tax Act, fractional values
   never reach the bracket evaluator — the boundary is therefore precise. */
export const TAX_YEARS = {
  '2027': {
    label: '2026/27', period: '1 Mar 2026 – 28 Feb 2027',
    brackets: [
      {min:0,       max:245100,   rate:.18, base:0},
      {min:245101,  max:383100,   rate:.26, base:44118},
      {min:383101,  max:530200,   rate:.31, base:79998},
      {min:530201,  max:695800,   rate:.36, base:125599},
      {min:695801,  max:887000,   rate:.39, base:185215},
      {min:887001,  max:1878600,  rate:.41, base:259783},
      {min:1878601, max:Infinity, rate:.45, base:666339}
    ],
    rebates: {primary:17820, secondary:9765, tertiary:3249},
    thresholds: {under65:99000, age65:153250, age75:171300},
    medical: {main:376, firstDep:376, addDep:254},
    retirement: {pct:27.5, cap:430000},
    interest: {under65:23800, age65:34500},
    provisional: {deMinimis:30000},  // engine-remediation W12: Fourth Schedule para 18(1)(c) de-minimis is R30,000 for ALL ages — no age-65 variant (the removed deMinimisAge65:34500 had no statutory basis and appeared conflated with the s10(1)(i) interest exemption)
    donationPct: 10,
    cgt: {inclusion:.40, annualExcl:50000, primaryResExcl:3000000},
    tfsa: {annual:46000, lifetime:500000},
    // Retirement/death lump sum tax table (Second Schedule para 5/6, s5(10) —
    // cumulative across lifetime; retirement funds + severance both use this table)
    retirementLumpSum: [
      {min:0,       max:550000,   rate:0,    base:0},
      {min:550001,  max:770000,   rate:0.18, base:0},
      {min:770001,  max:1155000,  rate:0.27, base:39600},
      {min:1155001, max:Infinity, rate:0.36, base:143550}
    ],
    // Withdrawal lump sum tax table (same lifetime cumulative pool; table
    // selected by current benefit type — severance uses the retirement table.
    // LAPD-IT-G03 §5–7)
    withdrawalLumpSum: [
      {min:0,       max:27500,    rate:0,    base:0},
      {min:27501,   max:726000,   rate:0.18, base:0},
      {min:726001,  max:1089000,  rate:0.27, base:125730},
      {min:1089001, max:Infinity, rate:0.36, base:223740}
    ],
    twoPot: {
      effectiveDate: '2024-09-01',
      savingsPotMin: 2000,        // Min withdrawable from savings pot
      retirementPotShare: 2/3,    // 2/3 to retirement pot
      savingsPotShare: 1/3,       // 1/3 to savings pot
      seedAmount: 30000           // 10% of vested pot, capped at R30,000 seed
    },
    foreignService: {
      exemptionCap: 1250000,      // s10(1)(o)(ii) R1.25m
      daysOutsideMin: 183,        // 183 days in any 12-month period
      continuousDaysMin: 60        // 60 days continuous within that period
    },
    /* BACKLOG 80: long service award exclusion — s1 "gross income" par (c)
       proviso (vii), inserted by s4(1)(d) Taxation Laws Amendment Act 20 of
       2021 (GG 45787, 19 Jan 2022; s4(3): years of assessment commencing on
       or after 1 March 2022). A cash award for "long service" (Seventh
       Schedule par 5(4): 15 unbroken years, then each further 10) is not
       gross income to the extent it, together with any award in kind under
       par 5(2)(b), 6(4)(d) and 10(2)(e), does not exceed this figure. IRP5
       code 3622 carries the FULL value (PAYE-AE-06-G06 rev 13 p.9). */
    longServiceAward: {exclusion: 5000},
    foreignTaxCredit: {
      carryForwardYears: 7        // s6quat: para (iii) proviso to s6quat(1B)(a) — 7 yr carry-forward, all foreign-sourced income (IN18 pp.67/92)
    },
    // §5 H-4: paragraph 20 underestimation-penalty tier-flip threshold.
    // Budget 2026 (25 Feb 2026) announced increase from R1m → R1.8m for years
    // of assessment commencing on or after 1 March 2026 (i.e. 2026/27 onward).
    // Pending TLAB 2026 enactment but already used by SARS for IRP6 estimates.
    para20Threshold: 1800000
  },
  '2026': {
    label: '2025/26', period: '1 Mar 2025 – 28 Feb 2026',
    brackets: [
      {min:0,       max:237100,   rate:.18, base:0},
      {min:237101,  max:370500,   rate:.26, base:42678},
      {min:370501,  max:512800,   rate:.31, base:77362},
      {min:512801,  max:673000,   rate:.36, base:121475},
      {min:673001,  max:857900,   rate:.39, base:179147},
      {min:857901,  max:1817000,  rate:.41, base:251258},
      {min:1817001, max:Infinity, rate:.45, base:644489}
    ],
    rebates: {primary:17235, secondary:9444, tertiary:3145},
    thresholds: {under65:95750, age65:148217, age75:165689},
    medical: {main:364, firstDep:364, addDep:246},
    retirement: {pct:27.5, cap:350000},
    interest: {under65:23800, age65:34500},
    provisional: {deMinimis:30000},  // engine-remediation W12: Fourth Schedule para 18(1)(c) de-minimis is R30,000 for ALL ages — no age-65 variant (the removed deMinimisAge65:34500 had no statutory basis and appeared conflated with the s10(1)(i) interest exemption)
    donationPct: 10,
    cgt: {inclusion:.40, annualExcl:40000, primaryResExcl:2000000},
    tfsa: {annual:36000, lifetime:500000},
    retirementLumpSum: [
      {min:0,       max:550000,   rate:0,    base:0},
      {min:550001,  max:770000,   rate:0.18, base:0},
      {min:770001,  max:1155000,  rate:0.27, base:39600},
      {min:1155001, max:Infinity, rate:0.36, base:143550}
    ],
    withdrawalLumpSum: [
      {min:0,       max:27500,    rate:0,    base:0},
      {min:27501,   max:726000,   rate:0.18, base:0},
      {min:726001,  max:1089000,  rate:0.27, base:125730},
      {min:1089001, max:Infinity, rate:0.36, base:223740}
    ],
    twoPot: {
      effectiveDate: '2024-09-01',
      savingsPotMin: 2000,
      retirementPotShare: 2/3,
      savingsPotShare: 1/3,
      seedAmount: 30000
    },
    foreignService: {exemptionCap: 1250000, daysOutsideMin: 183, continuousDaysMin: 60},
    longServiceAward: {exclusion: 5000},   // BACKLOG 80 — see '2027'
    foreignTaxCredit: {carryForwardYears: 7}, // W9: para (iii) proviso to s6quat(1B)(a) — 7 years, IN18 pp.67/92
    para20Threshold: 1000000
  },
  '2025': {
    label: '2024/25', period: '1 Mar 2024 – 28 Feb 2025',
    brackets: [
      {min:0,       max:237100,   rate:.18, base:0},
      {min:237101,  max:370500,   rate:.26, base:42678},
      {min:370501,  max:512800,   rate:.31, base:77362},
      {min:512801,  max:673000,   rate:.36, base:121475},
      {min:673001,  max:857900,   rate:.39, base:179147},
      {min:857901,  max:1817000,  rate:.41, base:251258},
      {min:1817001, max:Infinity, rate:.45, base:644489}
    ],
    rebates: {primary:17235, secondary:9444, tertiary:3145},
    thresholds: {under65:95750, age65:148217, age75:165689},
    // 2024/25 unchanged from 2023/24 (Budget 2024 froze medical credits) — was
    // erroneously carrying the 2022/23 rate (347/347/234); engine-remediation W1.
    medical: {main:364, firstDep:364, addDep:246},
    retirement: {pct:27.5, cap:350000},
    interest: {under65:23800, age65:34500},
    provisional: {deMinimis:30000},  // engine-remediation W12: Fourth Schedule para 18(1)(c) de-minimis is R30,000 for ALL ages — no age-65 variant (the removed deMinimisAge65:34500 had no statutory basis and appeared conflated with the s10(1)(i) interest exemption)
    donationPct: 10,
    cgt: {inclusion:.40, annualExcl:40000, primaryResExcl:2000000},
    tfsa: {annual:36000, lifetime:500000},
    retirementLumpSum: [
      {min:0,       max:550000,   rate:0,    base:0},
      {min:550001,  max:770000,   rate:0.18, base:0},
      {min:770001,  max:1155000,  rate:0.27, base:39600},
      {min:1155001, max:Infinity, rate:0.36, base:143550}
    ],
    withdrawalLumpSum: [
      {min:0,       max:27500,    rate:0,    base:0},
      {min:27501,   max:726000,   rate:0.18, base:0},
      {min:726001,  max:1089000,  rate:0.27, base:125730},
      {min:1089001, max:Infinity, rate:0.36, base:223740}
    ],
    twoPot: {
      effectiveDate: '2024-09-01',
      savingsPotMin: 2000,
      retirementPotShare: 2/3,
      savingsPotShare: 1/3,
      seedAmount: 30000
    },
    foreignService: {exemptionCap: 1250000, daysOutsideMin: 183, continuousDaysMin: 60},
    longServiceAward: {exclusion: 5000},   // BACKLOG 80 — see '2027'
    foreignTaxCredit: {carryForwardYears: 7}, // W9: para (iii) proviso to s6quat(1B)(a) — 7 years, IN18 pp.67/92
    para20Threshold: 1000000
  }
};

/* D4 (owner decision, 2026-09-14, PLAN.md §0). Defaults the onboarding and
   Profile tax-year selects to the most recently COMPLETED year of
   assessment, not the current (in-progress) one — e.g. 2025/26 through
   most of 2026, only becoming 2026/27 once that year itself completes on
   28 Feb 2027. A tax year keyed Y runs 1 Mar (Y-1) to the last day of
   Feb Y, so it is complete once today is on/after 1 Mar of year Y.
   Computed from the current date so the default never goes stale each
   March, instead of a hardcoded <option selected>. */
export function defaultTaxYear() {
  const now = new Date();
  const y = now.getFullYear();
  const completedThisCalendarYear = now.getMonth() >= 2; // Mar(2)..Dec(11): this year's own Feb already passed
  return String(completedThisCalendarYear ? y : y - 1);
}

/* ═══════════════════════════════════════════════════════════
   FACT MODULES — BATCH 5 SESSION 1
   Centralized tax fact access + FAQ explainer content
   ═══════════════════════════════════════════════════════════ */

/* Dot-notation accessor with year fallback to active tax year.
   Examples:
     getFact('cgt.annualExcl')              → uses active year
     getFact('cgt.annualExcl', '2026')      → specific year
     getFact('retirementLumpSum')           → returns the whole array
     getFact('brackets.0.max')              → 245100 (active year, first bracket)
*/
export function getFact(path, year) {
  const ty = year ? TAX_YEARS[year] : getActiveTaxYear();
  if(!ty) return null;
  const parts = String(path||'').split('.');
  let cur = ty;
  for(const p of parts) {
    if(cur == null) return null;
    cur = cur[p];
  }
  return cur;
}

/* FAQ explainer content — paraphrased, not SARS verbatim.
   Each module: id, title, sectionRef, body (HTML), appliesWhen (predicate over APP state). */
export const FAQ_MODULES = [
  /* B3 (01-SPEC.md §7.2, item 13): moved off the Medical capture page, where
     ~300 words of s6A/s6B mechanics sat between the user and their own
     figures. The page now carries one line and a link to this entry.
     appliesWhen is unconditional: someone reading the FAQ to find out how
     their credit works has, by definition, not yet decided it applies. */
  {
    id:'medical-credits',
    title:'How medical credits work',
    sectionRef:'Sections 6A and 6B',
    appliesWhen: () => true,
    body: () => {
      const ty = (typeof getActiveTaxYear === 'function') ? getActiveTaxYear() : null;
      const m = ty && ty.medical ? ty.medical : null;
      const rates = m
        ? `<strong>${esc(ty.label)} rates:</strong> Main member R${m.main}/mo &middot; First dependant R${m.firstDep}/mo &middot; Each additional dependant R${m.addDep}/mo<br>`
        : '';
      return `
      <strong class="u-c-teal">The set monthly credit &mdash; section 6A</strong><br>
      Everyone on a registered medical scheme gets a fixed amount off their tax
      for every month they were a member. It comes off the tax you owe, not off
      your income, so it is worth the same to everyone.<br>
      ${rates}
      Your annual credit is those monthly amounts added up.<br><br>
      <strong class="u-c-teal">The extra credit &mdash; section 6B</strong><br>
      If what you paid was unusually high, a further amount may be added.<br>
      <strong>Under 65, nobody disabled:</strong> 25% of the part of your costs
      above a threshold set by your taxable income (7.5% of it), counting scheme
      contributions above four times your 6A credit plus what you paid yourself.<br>
      <strong>65 or older, or someone disabled:</strong> 33.3% of scheme
      contributions above three times your 6A credit plus what you paid
      yourself, with no income threshold at all.<br><br>
      <strong>Who counts as disabled:</strong> you, your husband or wife, or your
      child &mdash; confirmed by a doctor on the SARS form. Other relatives do not
      qualify for this treatment.<br><br>
      <strong>What you can count:</strong> contributions to a registered scheme
      (yours and your employer's), plus costs you paid yourself and were never
      paid back for &mdash; registered practitioners, hospitals, nursing services,
      and a pharmacist for prescribed medicines.`;
    }
  },
  {
    id:'provisional',
    title:'Provisional Tax — IRP6',
    sectionRef:'Para 17–28, Fourth Schedule',
    /* 2026-09 (Atlas F7): this tested eleven pre-taxonomy values, none of which
       getSelectedIncomeTypes() can return any more, so the explainer for
       provisional tax could never render — including for a taxpayer the app had
       just classified as provisional. Delegating to the same determination the
       app shows the user means the two cannot disagree, and it picks up the
       captured-amount path (para 20 de-minimis) that a type list never covered.
       Called through a typeof guard for the same reason the sel lookups are:
       01-data is imported by 02-core, so the binding is not available at
       module-eval time — only at call time. */
    appliesWhen: () => isProvisionalAutoDetermined
      ? !!isProvisionalAutoDetermined().auto
      : false,
    body: `Provisional tax is not a separate tax. It is the mechanism by which SARS collects tax in advance from people whose income is not subject to PAYE. Two payments are due each year:
      <ul>
        <li><strong>IRP6/01:</strong> 6 months into the tax year (end of August for individuals)</li>
        <li><strong>IRP6/02:</strong> last day of the tax year (end of February)</li>
      </ul>
      An optional third top-up (IRP6/03) is due 6–7 months after year-end. Underestimation penalties apply if your second-payment estimate is below the para 20 threshold tier.`
  },
  {
    id:'s10_1_i',
    title:'Interest Exemption — s10(1)(i)',
    sectionRef:'s10(1)(i)',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return sel.includes('investment_income') || (APP.it3bItems && APP.it3bItems.length > 0);
    },
    body: () => {
      const u65 = getFact('interest.under65');
      const o65 = getFact('interest.age65');
      return `Local interest received by a natural person is exempt up to:
        <ul>
          <li><strong>Under 65:</strong> ${fmt(u65)}/year</li>
          <li><strong>Age 65+:</strong> ${fmt(o65)}/year</li>
        </ul>
        Foreign interest is NOT exempt. Tax-Free Savings Account (TFSA) interest is exempt under s12T separately.`;
    }
  },
  {
    id:'s10C_lumpsum',
    title:'Retirement Lump Sum Tax',
    sectionRef:'Second Schedule para 5/6',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return sel.includes('retirement_income')
        || (APP.retirementLumpsums && APP.retirementLumpsums.length > 0)
        || (APP.pensionAnnuityItems && APP.pensionAnnuityItems.length > 0);
    },
    body: () => {
      const t = getFact('retirementLumpSum') || [];
      const rows = t.map(b => `<li>${fmt(b.min)} – ${b.max===Infinity?'+':fmt(b.max)}: ${(b.rate*100).toFixed(0)}% ${b.base?'+ '+fmt(b.base):''}</li>`).join('');
      return `Retirement lump sums (from pension, provident, or RA funds at retirement) are taxed using a separate cumulative table. The first ${fmt(getFact('retirementLumpSum.0.max'))} is tax-free — but this is a <strong>lifetime aggregate</strong>, not annual.
        <ul style="margin-top:6px">${rows}</ul>
        Severance benefits use the same cumulative pool.`;
    }
  },
  {
    id:'twopot',
    title:'Two-Pot Retirement System',
    sectionRef:'Effective 1 Sept 2024',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return sel.includes('retirement_income')
        || (APP.twopotWithdrawals && APP.twopotWithdrawals.length > 0)
        || APP.dedChecks.retirement;
    },
    body: () => {
      const tp = getFact('twoPot') || {};
      return `From 1 September 2024, all NEW retirement fund contributions split into:
        <ul>
          <li><strong>Savings pot (1/3):</strong> withdrawable once per tax year. Taxed at your marginal rate (not the lump sum table). Minimum withdrawal: ${fmt(tp.savingsPotMin)}.</li>
          <li><strong>Retirement pot (2/3):</strong> preserved until retirement.</li>
        </ul>
        Pre-September 2024 balances stay in the <strong>vested pot</strong> and follow old rules. A one-off seed amount (10% of vested balance, capped at ${fmt(tp.seedAmount)}) moved from vested to savings pot on 1 Sept 2024.`;
    }
  },
  {
    id:'cgt',
    title:'Capital Gains Tax',
    sectionRef:'Eighth Schedule',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return sel.includes('cgt') || sel.includes('crypto_income')
        || (APP.cgtAssets && APP.cgtAssets.length > 0)
        || (APP.cryptoDisposals && APP.cryptoDisposals.length > 0);
    },
    body: () => {
      const cgt = getFact('cgt') || {};
      return `When you dispose of a capital asset (shares, property, crypto held as investment), the gain is:
        <ul>
          <li>Proceeds <strong>−</strong> Base cost <strong>−</strong> Selling costs <strong>=</strong> Capital gain</li>
          <li>Less: Annual exclusion ${fmt(cgt.annualExcl)}</li>
          <li>× ${(cgt.inclusion*100).toFixed(0)}% inclusion rate = Taxable capital gain</li>
          <li>Added to taxable income, taxed at your marginal rate</li>
        </ul>
        Primary residence: first ${fmt(cgt.primaryResExcl)} of the gain excluded (if conditions met).`;
    }
  },
  {
    id:'s6quat',
    title:'Foreign Tax Credit — s6quat',
    sectionRef:'s6quat',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      const anyForeignFlag = (APP.rentalProperties||[]).some(p => p.foreign === 'yes')
                          || (APP.businessItems||[]).some(b => b.foreign === 'yes')
                          || (APP.cgtAssets||[]).some(a => a.foreign === 'yes')
                          || taxableIt3bItems().some(it => (it.foreignInterest||0)>0 || (it.foreignDividends||0)>0);
      /* 2026-09 (Atlas F6/F7): 'foreign' was never one of the nine selectable
         types — foreign income is absorbed into the matching type. The setup
         question is the only place a user declares it before capturing an
         amount, and for an EXPLAINER that answer is exactly the right trigger:
         discoverability is the whole job of this text. */
      return APP.foreignIncomeYN === 'yes' || anyForeignFlag;
    },
    body: () => {
      const ftc = getFact('foreignTaxCredit') || {};
      /* engine-remediation W9 (IN18 pp.41/58): ONE overall limitation across
         ALL foreign-sourced taxable income, not a per-source-type basket —
         the carry-forward applies to the excess over that single limitation,
         regardless of which foreign source it came from. */
      return `Foreign tax paid on foreign income can be credited against your SA tax liability under s6quat. The credit is limited to:
        <ul>
          <li>The <strong>lesser</strong> of: total foreign tax paid, OR SA tax attributable to your total foreign-sourced taxable income (one overall limitation, not per source)</li>
        </ul>
        Foreign tax blocked only by the no-refund guard (remaining SA tax after rebates/medical credits) is forfeited.
        Foreign tax blocked by the s6quat(1B) limitation itself may be <strong>carried forward ${ftc.carryForwardYears||7} years</strong> (para (iii) of the proviso to s6quat(1B)(a)).`;
    }
  },
  {
    id:'s20A',
    title:'Ring-Fenced Losses — s20A',
    sectionRef:'s20A (suspect trades)',
    /* BACKLOG 16/57 (OI-D1b): a notice, not a calculation — when SARS may
       ring-fence, and that the app does not (s20A(1)-(3)). */
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      /* s20A ring-fences losses from a trade carried on by a natural person.
         TRADE_INCOME_TYPES is the app's own list of which types are a trade,
         derived rather than hand-copied so this cannot drift from it. */
      return TRADE_INCOME_TYPES.some(v => sel.includes(v))
        || (APP.rentalProperties && APP.rentalProperties.length>0);
    },
    body: `SARS may "ring-fence" a trade or rental loss — it then cannot reduce your other income this year, and carries forward against future profits of that same trade only. It can apply only if:
      <ul>
        <li>your income before the loss reaches the top tax bracket, AND</li>
        <li>the trade has made a loss in <strong>3 of the last 5 years</strong>, OR is a listed "suspect" trade — for example a hobby-like activity, or letting a home mostly to relatives (less than 80% let to non-relatives)</li>
      </ul>
      Even then, it does not apply if the trade has a reasonable prospect of making a profit.
      <strong>InspiredTax does not apply ring-fencing:</strong> every loss is set against your other income. If this may apply to you, check with a tax practitioner.`
  },
  {
    id:'s18A_donations',
    title:'Donations to PBOs — s18A',
    sectionRef:'s18A',
    appliesWhen: () => APP.hasDonations === 'yes' || (APP.donationItems && APP.donationItems.length > 0) || APP.dedChecks.donations,
    body: () => {
      const pct = getFact('donationPct');
      return `Donations to SARS-approved Public Benefit Organisations (PBOs) are deductible from taxable income, capped at <strong>${pct}% of taxable income</strong>. Any excess above the ${pct}% cap is <strong>carried forward to the immediately following year of assessment</strong> (s18A) and is again subject to the ${pct}% cap in that year — it is not lost.
        <ul>
          <li>A valid <strong>s18A receipt</strong> is required for each donation</li>
          <li>The PBO must hold s18A approval (verify on SARS PBO list)</li>
          <li>Donations to political parties, foreign charities, or non-approved bodies do NOT qualify</li>
          <li>Carried-forward excess deducts only after the current year's own donations, still within the ${pct}% cap</li>
        </ul>`;
    }
  },
  {
    id:'medical_credits',
    title:'Medical Tax Credits',
    sectionRef:'s6A (MTC), s6B (AMTC)',
    appliesWhen: () => APP.hasMedical === 'yes' || APP.dedChecks.medical,
    body: () => {
      const m = getFact('medical') || {};
      return `Medical tax relief has two parts:
        <ul>
          <li><strong>s6A Medical Scheme Fees Tax Credit (MTC):</strong> fixed monthly credit per member. Main + first dependant: ${fmt(m.main)}/mo each. Additional dependants: ${fmt(m.addDep)}/mo each.</li>
          <li><strong>s6B Additional Medical Expenses Tax Credit (AMTC):</strong> 25% of out-of-pocket medical expenses exceeding 7.5% of taxable income (under 65). Age 65+ or with disability: 33⅓% of all qualifying expenses with no threshold.</li>
        </ul>`;
    }
  },
  {
    id:'travel_deduction',
    title:'Travel Deduction — s8(1)(b)',
    sectionRef:'s8(1)(b)',
    appliesWhen: () => APP.travelAllowanceYN === 'yes' || APP.dedChecks.travel,
    body: `If you receive a travel allowance (IRP5 code 3701/3702/3703), you can deduct business kilometres. Two methods:
      <ul>
        <li><strong>Actual costs:</strong> fuel + maintenance + insurance + finance, apportioned by business/total km ratio (logbook required)</li>
        <li><strong>SARS deemed cost table:</strong> fixed + fuel + maintenance rates per cc value band, based on logbook business km</li>
      </ul>
      A logbook is <strong>mandatory</strong> — first km of the year and total/business km per trip. Private use without logbook = 100% of allowance taxable.`
  },
  {
    id:'home_office',
    title:'Home Office — s11(a)',
    sectionRef:'s11(a) read with s23(b)',
    appliesWhen: () => APP.workFromHomeYN === 'yes' || APP.dedChecks.homeoffice,
    body: `To claim home office expenses, the space must be:
      <ul>
        <li><strong>Specifically equipped</strong> for the trade (a dedicated room — not a corner of the lounge)</li>
        <li><strong>Used regularly and exclusively</strong> for the trade</li>
        <li>Used to earn more than 50% of remuneration (for salaried earners) — relaxed for self-employed</li>
      </ul>
      Deductible expenses (apportioned by floor area %): rent or bond interest, rates, electricity, water, cleaning, repairs to the office area. <strong>Bond interest is disallowed for salaried employees</strong> (s23(m)/IN28) but remains claimable for the self-employed and commission earners. CGT note: claiming home office on your primary residence reduces the primary residence exclusion on disposal. Source: s23(b), s23(m); SARS Interpretation Note 28.`
  },
  {
    id:'assessment_framework',
    title:'How Your Tax Is Calculated — Assessment Framework',
    sectionRef:'s1, ITA; ITR12 Comprehensive Guide',
    appliesWhen: () => true,
    body: `Every individual assessment follows this order:<ol style="margin:8px 0;padding-left:18px;line-height:1.9">
      <li><strong>Gross income (s1)</strong> — total worldwide receipts and accruals, plus specific inclusions (allowances, fringe benefits, certain lump sums).</li>
      <li><strong>Less exempt income (s10)</strong> — e.g. local interest exemption, local dividends, foreign-service remuneration, portion of foreign dividends.</li>
      <li><strong>Less deductions (s11, s11F, s18A, s23)</strong> — trade expenses, retirement, donations, travel, home office, wear & tear, subject to limits.</li>
      <li><strong>Add taxable capital gain (8th Schedule)</strong> — net gain less the annual exclusion, × the inclusion rate.</li>
      <li><strong>Less assessed loss b/f (s20)</strong> — set off in full for individuals.</li>
      <li><strong>= Taxable income</strong> → tax per bracket table → less rebates (s6) → less medical credits (s6A/s6B) → less foreign tax credit (s6quat) = normal tax.</li>
      <li><strong>Lump-sum tax (Second Schedule)</strong> — calculated separately on its own cumulative tables and added to normal tax.</li>
      <li><strong>Less PAYE and provisional payments</strong> = final balance payable or refundable.</li>
    </ol>Source: SARS Guide on Income Tax and the Individual (IT01); ITR12 Comprehensive Guide.`
  },
  {
    id:'employment_income',
    title:'Employment Income & IRP5 Codes',
    sectionRef:'Fourth Schedule; ITR12 Comprehensive Guide',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      /* 2026-09 (Atlas F8): the fallback read APP.irp5Items, which is not a key
         on APP — captured IRP5 lines live in APP.incomeItems. Both halves of the
         test were dead, so a salaried user with a full IRP5 could not see this. */
      return sel.includes('employment_income') || (APP.incomeItems && APP.incomeItems.length > 0);
    },
    body: `<strong>Inclusion:</strong> Remuneration — salary (3601), bonus (3605), overtime (3607), commission (3606), leave pay (3605) — is fully taxable and forms the remuneration base for the s11F deduction cap.
    <br><br><strong>Common codes:</strong>
    <ul>
      <li>3601 Salary/wages · 3605 Annual bonus · 3606 Commission · 3607 Overtime</li>
      <li>3701 Travel allowance (taxable) · 3703 Reimbursive non-taxable · 3702 Reimbursive travel</li>
      <li>3802 Company car (fringe) · 3810 Employer medical (fringe) · 3817/3825/3828 Employer pension/provident/RA (fringe)</li>
      <li>4001/4003/4006 Pension/provident/RA deduction codes · 4015 Travel deduction (s8(1)(b))</li>
    </ul>
    <strong>Multiple employers:</strong> All IRP5s aggregate; combined income can push you into a higher bracket than any single employer withheld for, producing a balance owing on assessment. Source: ITR12 Comprehensive Guide; Fourth Schedule.`
  },
  {
    id:'fringe_benefits',
    title:'Fringe Benefits — Seventh Schedule',
    sectionRef:'Seventh Schedule; SARS PAYE-GEN-01-G02',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      /* 2026-09 (Atlas F8): the fallback read APP.irp5Items, which is not a key
         on APP — captured IRP5 lines live in APP.incomeItems. Both halves of the
         test were dead, so a salaried user with a full IRP5 could not see this. */
      return sel.includes('employment_income') || (APP.incomeItems && APP.incomeItems.length > 0);
    },
    body: `Taxable fringe benefits are valued and included as income:
    <ul>
      <li><strong>Company car (3802):</strong> generally 3.5% of determined value per month (3.25% with a maintenance plan), reduced for business km and employee contributions to the employer.</li>
      <li><strong>Employer medical contributions (3810):</strong> still counted toward the member's s6A/s6B medical credits even though taxed as a fringe benefit.</li>
      <li><strong>Employer retirement contributions (3817/3825/3828):</strong> matched by a deduction (4001/4003/4006) and feed the s11F calculation — the net position is neutral for compliant members.</li>
      <li><strong>Other (3801):</strong> general fringe benefit valued at cost to the employer.</li>
    </ul>
    Source: Seventh Schedule; SARS Guide for Employers iro Fringe Benefits.`
  },
  {
    id:'s11f_retirement',
    title:'Retirement Fund Contributions — s11F',
    sectionRef:'s11F; SARS Guide on Income Tax and the Individual',
    appliesWhen: () => APP.dedChecks && APP.dedChecks.retirement,
    body: () => {
      const cap = getFact('retirement.cap');
      const pct = getFact('retirement.pct');
      return `<strong>Deduction formula — the lesser of:</strong>
      <ul>
        <li>(a) Total contributions to pension, provident, and RA funds</li>
        <li>(b) ${pct}% of the greater of: remuneration OR taxable income before this deduction</li>
        <li>(c) R${cap.toLocaleString()} annual rand cap (2026/27)</li>
      </ul>
      <strong>Excess contributions</strong> are not lost — they carry forward indefinitely and may also be set off against retirement lump sums and annuities under s10C.
      <br><br><strong>Prior-year excess</strong> carried forward is added to current contributions before applying the cap.
      <br><br>Source: s11F; SARS Guide on Income Tax and the Individual.`;
    }
  },
  {
    id:'wear_tear',
    title:'Wear & Tear — s11(e)',
    sectionRef:'s11(e); SARS Binding General Ruling 7',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return (APP.dedChecks && APP.dedChecks.tools)
        || sel.some(v => ['business_income','other_income'].includes(v));
    },
    body: () => `Business assets are written off over SARS-accepted useful lives, apportioned for part-year. Items costing ${randText(WT_SMALL_ITEM_LIMIT)} or less may be written off in full in year one.
    <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:0.8rem">
      <thead><tr style="border-bottom:2px solid var(--bd)"><th style="text-align:left;padding:5px 6px;color:var(--tx3)">Asset</th><th style="text-align:right;padding:5px 6px;color:var(--tx3)">Period</th><th style="text-align:right;padding:5px 6px;color:var(--tx3)">Annual</th></tr></thead>
      <tbody>${
        /* QR9b (WR-8): rows come from SARS_WT_RATES, so this table cannot
           disagree with the calculation. Retired types (Vehicle, QD-31) are
           not listed. */
        SARS_WT_RATES.map(r =>
          `<tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px">${r.label}</td><td style="text-align:right;padding:6px">${r.life} year${r.life === 1 ? '' : 's'}</td><td style="text-align:right;padding:6px">${(Math.round(1000 / r.life) / 10)}%</td></tr>`
        ).join('')}
      </tbody>
    </table>
    A vehicle is not added here: with a travel allowance or reimbursement, claim it under Travel; if you are self-employed, add its costs to your business expenses.
    <br>Source: s11(e); SARS Binding General Ruling 7 (Issue 4); SARS guide to the individual income tax return (small items).`
  },
  {
    id:'trade_income',
    title:'Trade / Sole-Proprietor Income — s11(a)',
    sectionRef:'s11(a), s23, s20; ITR12 Comprehensive Guide',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      /* business_income covers freelancer/contractor/sole-prop/commission;
         other_income can still be a trade. */
      return sel.some(v => ['business_income','other_income'].includes(v));
    },
    body: () => `<strong>Taxable profit</strong> = gross trade receipts less expenses incurred in the production of income, not of a capital nature (s11(a), s23(g)).
    <br><br><strong>Prohibited deductions (s23):</strong> private/domestic expenses, expenses not in the production of income, entertainment and private-use portions. These must be excluded or apportioned.
    <br><br><strong>Capital allowances</strong> (wear & tear s11(e)) are claimed in addition to operating expenses.
    <br><br><strong>Losses:</strong> a net trade loss becomes an assessed loss carried forward (s20), set off in full against future income.
    <br><br>Source: s11(a), s23, s20; ITR12 Comprehensive Guide.`
  },
  {
    id:'rental_income',
    title:'Rental Income — What is Deductible',
    sectionRef:'s11(a), s11(d); ITR12 Comprehensive Guide',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      return sel.includes('rental_income') || (APP.rentalProperties && APP.rentalProperties.length > 0);
    },
    body: () => `<strong>Deductible expenses</strong> from gross rental: rates & taxes, levies, insurance, bond interest (on the let property), agent commission, repairs (not improvements — improvements are capital), advertising, and wear & tear on furnishings.
${(APP.rentalProperties || []).some(p => p.type === 'airbnb') ? `
    <br><br><strong>Mixed-use / Airbnb:</strong> apportion fixed premises costs by the let proportion (area and/or time); direct letting costs (agent commission, advertising, consumables) are 100% deductible.` : ''}
    <br><br><strong>Losses:</strong> a rental loss reduces your other income.
    <br><br><strong>Foreign rental:</strong> net amount is included in SA taxable income; foreign tax paid may qualify for a s6quat credit.
    <br><br>Source: s11(a), s11(d); ITR12 Comprehensive Guide.`
  },
  {
    id:'crypto_assets',
    title:'Crypto Assets — Revenue vs Capital',
    sectionRef:'SARS crypto-asset guidance; s1 gross income; para 11 Eighth Schedule',
    appliesWhen: () => {
      const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
      /* 2026-09 (Atlas F8): the fallback read APP.cryptoItems, which is not a key
         on APP — crypto lives in cryptoDisposals and cryptoRevenue. */
      return sel.includes('crypto_income')
        || (APP.cryptoDisposals && APP.cryptoDisposals.length > 0)
        || (APP.cryptoRevenue && APP.cryptoRevenue.length > 0);
    },
    body: () => `SARS taxes crypto assets — the key question is whether your activity is <strong>revenue</strong> or <strong>capital</strong> in nature:
    <ul>
      <li><strong>Revenue (trading/mining/staking):</strong> gains are ordinary income taxed at marginal rates. No annual exclusion or inclusion rate. Trading expenses are deductible.</li>
      <li><strong>Capital (long-term investment):</strong> disposals go through CGT — gains and losses pooled, the annual exclusion${getFact('cgt.annualExcl') != null ? ' (' + randText(getFact('cgt.annualExcl')) + ')' : ''} and the CGT inclusion rate apply.</li>
    </ul>
    Classification turns on intention and behaviour: frequency of trading, holding period, and purpose at time of acquisition. <strong>Every disposal is a taxable event</strong> — including crypto-to-crypto swaps.
    <br><br>Source: SARS crypto-asset guidance; s1 "gross income"; paragraph 11 Eighth Schedule.`
  },
  {
    id:'amounts_carried_forward',
    title:'Amounts Carried Forward — What Survives to Next Year',
    sectionRef:'s20, s11F, s10C, s18A, s6quat, Eighth Schedule',
    appliesWhen: () => true,
    body: () => `<table style="width:100%;border-collapse:collapse;font-size:0.8rem">
      <thead><tr style="border-bottom:2px solid var(--bd)"><th style="text-align:left;padding:5px 6px;color:var(--tx3)">Item</th><th style="text-align:left;padding:5px 6px;color:var(--tx3)">Treatment</th></tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Assessed loss (s20)</td><td style="padding:6px">Carried forward; set off in full against future income (no 80% cap for individuals).</td></tr>
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Capital loss</td><td style="padding:6px">Carried forward; offsets future capital gains only — never ordinary income.</td></tr>
        
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Excess RA / s11F</td><td style="padding:6px">Carried forward; deductible in future years or against retirement lump sums / annuities (s10C).</td></tr>
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Excess s18A donation</td><td style="padding:6px">Carried forward indefinitely as a deemed next-year donation, re-capped at 10% each year, until fully used.</td></tr>
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Lump-sum cumulative pool</td><td style="padding:6px">Lifetime running total since Oct 2007; consumes the lower lump-sum brackets in future withdrawals.</td></tr>
        <tr style="border-bottom:1px solid var(--bd)"><td style="padding:6px;font-weight:600">Excess s6quat (trade income)</td><td style="padding:6px">Carried forward up to 7 years; foreign income only.</td></tr>
        <tr><td style="padding:6px;font-weight:600;color:var(--er)">Forfeited (not carried)</td><td style="padding:6px">Travel deduction excess over the allowance; capital losses against ordinary income.</td></tr>
      </tbody>
    </table>
    <br>Source: s20, Eighth Schedule, s11F, s10C, s18A, s6quat.`
  }
];

/* Returns FAQ modules that apply to the current user, based on their profile/state. */
export function getApplicableFAQs() {
  return FAQ_MODULES.filter(m => {
    if (m.dormant && m.dormant()) return false;
    try { return m.appliesWhen ? m.appliesWhen() : true; }
    catch(e) { return false; }
  });
}

/* Returns the user-applicable subset of tax constants for the active year.
   Used to render the "Tax Facts" reference panel. */
export function getUserApplicableFacts() {
  const ty = getActiveTaxYear(); if(!ty) return [];
  const sel = getSelectedIncomeTypes ? getSelectedIncomeTypes() : [];
  const dc = APP.dedChecks || {};
  const facts = [];

  // Brackets — always shown (relevant to everyone)
  facts.push({group:'Tax Brackets', label:'Active tax year', value: ty.label});
  facts.push({group:'Tax Brackets', label:'Top marginal rate', value: '45% above ' + fmt(ty.brackets[ty.brackets.length-1].min)});

  // Rebates — always shown
  facts.push({group:'Rebates', label:'Primary rebate', value: fmt(ty.rebates.primary)});
  if(calcAgeAtYearEnd && calcAgeAtYearEnd() >= 65) facts.push({group:'Rebates', label:'Secondary rebate (65+)', value: fmt(ty.rebates.secondary)});
  if(calcAgeAtYearEnd && calcAgeAtYearEnd() >= 75) facts.push({group:'Rebates', label:'Tertiary rebate (75+)', value: fmt(ty.rebates.tertiary)});

  // Interest exemption — only if interest income
  if(sel.includes('investment_income') || (APP.it3bItems && APP.it3bItems.length > 0)) {
    facts.push({group:'Interest', label:'Exemption under 65', value: fmt(ty.interest.under65)});
    facts.push({group:'Interest', label:'Exemption age 65+', value: fmt(ty.interest.age65)});
  }
  // Retirement
  if(dc.retirement) {
    facts.push({group:'Retirement', label:'s11F cap', value: fmt(ty.retirement.cap) + ' / ' + ty.retirement.pct + '% of greater of remuneration or taxable income'});
  }
  // CGT
  if(sel.includes('cgt') || sel.includes('crypto_income') || (APP.cgtAssets && APP.cgtAssets.length>0)) {
    facts.push({group:'CGT', label:'Annual exclusion', value: fmt(ty.cgt.annualExcl)});
    facts.push({group:'CGT', label:'Inclusion rate', value: (ty.cgt.inclusion*100).toFixed(0) + '%'});
    facts.push({group:'CGT', label:'Primary residence exclusion', value: fmt(ty.cgt.primaryResExcl)});
  }
  // Medical
  if(dc.medical || APP.hasMedical === 'yes') {
    facts.push({group:'Medical', label:'MTC main + first dep', value: fmt(ty.medical.main) + '/month each'});
    facts.push({group:'Medical', label:'MTC additional dep', value: fmt(ty.medical.addDep) + '/month each'});
  }
  // Donations
  if(dc.donations || APP.hasDonations === 'yes' || (APP.donationItems && APP.donationItems.length>0)) {
    facts.push({group:'Donations', label:'s18A cap', value: ty.donationPct + '% of taxable income'});
  }
  // Foreign
  const anyForeignFlag = (APP.incomeItems||[]).some(i => FOREIGN_SERVICE_CODES.has(i.code))
    || (APP.rentalProperties||[]).some(p => p.foreign === 'yes')
    || (APP.businessItems||[]).some(b => b.foreign === 'yes')
    || (APP.cgtAssets||[]).some(a => a.foreign === 'yes');
  if(anyForeignFlag) {
    if(ty.foreignService) facts.push({group:'Foreign', label:'s10(1)(o)(ii) exemption cap', value: fmt(ty.foreignService.exemptionCap)});
    if(ty.foreignTaxCredit) facts.push({group:'Foreign', label:'s6quat carry-forward', value: ty.foreignTaxCredit.carryForwardYears + ' years (all foreign-sourced income, one overall limitation)'});
  }
  // Provisional
  /* BACKLOG 93 R-6: this function tested pre-taxonomy values no answer
     produces ('interest', 'crypto', 'foreign', 'retirement_lumpsum' and a
     provisional list), so those facts showed only through captured items.
     The tests now read the taxonomy's own values. */
  if(PROVISIONAL_INCOME_TYPES.some(v => sel.includes(v))) {
    facts.push({group:'Provisional', label:'Para 20 threshold', value: fmt(ty.para20Threshold)});
  }
  // TFSA — always shown if visible
  facts.push({group:'TFSA', label:'Annual contribution limit', value: fmt(ty.tfsa.annual)});
  facts.push({group:'TFSA', label:'Lifetime contribution limit', value: fmt(ty.tfsa.lifetime)});

  return facts;
}

/* ═══════════════════════════════════════════════════════════
   RENDER TAX FAQs PAGE — BATCH 5 SESSION 6
   Renders applicable tax facts table + applicable FAQ explainers.
   Called by navigateTo('taxfaqs','') side-effect.
   ═══════════════════════════════════════════════════════════ */

export function renderTaxFaqs() {
  renderTaxFaqsFacts();
  renderTaxFaqsExplainers();
}

export function renderTaxFaqsFacts() {
  const el = document.getElementById('taxfaqs-facts'); if(!el) return;
  let facts = [];
  try { facts = getUserApplicableFacts() || []; } catch(e) { facts = []; }
  if(!facts.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><i class="material-symbols-outlined msi-info"></i><p>No applicable tax facts yet — complete your Profile to populate this section.</p></div>';
    return;
  }
  // Group by .group
  const groups = {};
  facts.forEach(f => {
    if(!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });
  el.innerHTML = Object.entries(groups).map(([group, rows]) => {
    const rowsHtml = rows.map(r => `
      <tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:8px 6px;font-size:0.8125rem;color:var(--tx2)">${esc(r.label)}</td>
        <td style="padding:8px 6px;font-size:0.8125rem;font-weight:600;text-align:right">${esc(r.value)}</td>
      </tr>`).join('');
    return `<div style="margin-bottom:14px">
      <div style="font-size:0.6875rem;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">${esc(group)}</div>
      <table style="width:100%;border-collapse:collapse">${rowsHtml}</table>
    </div>`;
  }).join('');
}

export function renderTaxFaqsExplainers() {
  const el = document.getElementById('taxfaqs-explainers'); if(!el) return;
  let modules = [];
  try { modules = getApplicableFAQs() || []; } catch(e) { modules = []; }
  if(!modules.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><i class="material-symbols-outlined msi-info"></i><p>No applicable explainers yet — your selected income sources and deductions determine which topics show here.</p></div>';
    return;
  }
  el.innerHTML = modules.map((m, i) => {
    let bodyHtml = '';
    try {
      const b = (typeof m.body === 'function') ? m.body() : m.body;
      bodyHtml = String(b || '');
    } catch(e) {
      bodyHtml = '<em style="color:var(--tx3)">Content unavailable.</em>';
    }
    const id = 'faq-mod-' + (m.id || i);
    return `<div class="card" style="margin-bottom:8px;padding:0;overflow:hidden">
      <button type="button" onclick="toggleFaqModule('${id}')" style="all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:12px 14px;box-sizing:border-box">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.875rem;color:var(--tx)">${esc(m.title)}</div>
          ${m.sectionRef ? '<div style="font-size:0.6875rem;color:var(--tx3);margin-top:2px">'+esc(m.sectionRef)+'</div>' : ''}
        </div>
        <i class="material-symbols-outlined msi-expand-more" id="${id}-chev" style="color:var(--tx3);font-size:0.75rem;transition:transform .15s"></i>
      </button>
      <div id="${id}-body" style="display:none;padding:0 14px 14px;font-size:0.8125rem;line-height:1.7;color:var(--tx2);border-top:1px solid var(--bd)">
        <div style="padding-top:10px">${bodyHtml}</div>
      </div>
    </div>`;
  }).join('');
}

/* B3 (§7.2): deep-link from a capture page into one FAQ entry — navigates to
   the FAQ screen, then opens that entry and scrolls it into view. Used by the
   Medical page's "How is this worked out?" link, which replaced the explainer
   card that used to sit on the page itself. */
export function openFaqEntry(moduleId) {
  navigateTo('taxfaqs', '');
  /* renderTaxFaqs() runs as navigateTo's effect, so the node exists by the
     time this resolves — one frame is enough, and no polling loop. */
  requestAnimationFrame(function() {
    const id = 'faq-mod-' + moduleId;
    const body = document.getElementById(id + '-body');
    if (!body) return;
    if (body.style.display === 'none') toggleFaqModule(id);
    const card = body.closest('.card');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center' });
  });
}

export function toggleFaqModule(id) {
  const body = document.getElementById(id + '-body');
  const chev = document.getElementById(id + '-chev');
  if(!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(chev) chev.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

/* HIST_TAX top-bracket base for 2018/19 and 2019/20 is R532 041 (NOT 532 042,
   which was here until the bracket-base chain check in tests/invariants.js
   caught it): "1 500 001 and above — 532 041 + 45% of taxable income above
   1 500 000", Budget Tax Guide 2019 (National Treasury / SARS) p.1, and the
   SARS Archive Tax Rates page for the 2019 tax year. Both years share one
   bracket table; only the rebates differ. */
export const HIST_TAX = {
  '2025': {label:'2024/25',period:'1 Mar 2024–28 Feb 2025',brackets:[{min:0,max:237100,rate:.18,base:0},{min:237101,max:370500,rate:.26,base:42678},{min:370501,max:512800,rate:.31,base:77362},{min:512801,max:673000,rate:.36,base:121475},{min:673001,max:857900,rate:.39,base:179147},{min:857901,max:1817000,rate:.41,base:251258},{min:1817001,max:Infinity,rate:.45,base:644489}],rebates:{primary:17235,secondary:9444,tertiary:3145},thresholds:{under65:95750,age65:148217,age75:165689},medical:{main:364,firstDep:364,addDep:246},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2024': {label:'2023/24',period:'1 Mar 2023–29 Feb 2024',brackets:[{min:0,max:237100,rate:.18,base:0},{min:237101,max:370500,rate:.26,base:42678},{min:370501,max:512800,rate:.31,base:77362},{min:512801,max:673000,rate:.36,base:121475},{min:673001,max:857900,rate:.39,base:179147},{min:857901,max:1817000,rate:.41,base:251258},{min:1817001,max:Infinity,rate:.45,base:644489}],rebates:{primary:17235,secondary:9444,tertiary:3145},thresholds:{under65:95750,age65:148217,age75:165689},medical:{main:364,firstDep:364,addDep:246},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2023': {label:'2022/23',period:'1 Mar 2022–28 Feb 2023',brackets:[{min:0,max:226000,rate:.18,base:0},{min:226001,max:353100,rate:.26,base:40680},{min:353101,max:488700,rate:.31,base:73726},{min:488701,max:641400,rate:.36,base:115762},{min:641401,max:817600,rate:.39,base:170734},{min:817601,max:1731600,rate:.41,base:239452},{min:1731601,max:Infinity,rate:.45,base:614192}],rebates:{primary:16425,secondary:9000,tertiary:2997},thresholds:{under65:91250,age65:141250,age75:157900},medical:{main:347,firstDep:347,addDep:234},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2022': {label:'2021/22',period:'1 Mar 2021–28 Feb 2022',brackets:[{min:0,max:216200,rate:.18,base:0},{min:216201,max:337800,rate:.26,base:38916},{min:337801,max:467500,rate:.31,base:70532},{min:467501,max:613600,rate:.36,base:110739},{min:613601,max:782200,rate:.39,base:163335},{min:782201,max:1656600,rate:.41,base:229089},{min:1656601,max:Infinity,rate:.45,base:587593}],rebates:{primary:15714,secondary:8613,tertiary:2871},thresholds:{under65:87300,age65:135150,age75:151100},medical:{main:332,firstDep:332,addDep:224},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2021': {label:'2020/21',period:'1 Mar 2020–28 Feb 2021',brackets:[{min:0,max:205900,rate:.18,base:0},{min:205901,max:321600,rate:.26,base:37062},{min:321601,max:445100,rate:.31,base:67144},{min:445101,max:584200,rate:.36,base:105429},{min:584201,max:744800,rate:.39,base:155505},{min:744801,max:1577300,rate:.41,base:218139},{min:1577301,max:Infinity,rate:.45,base:559464}],rebates:{primary:14958,secondary:8199,tertiary:2736},thresholds:{under65:83100,age65:128650,age75:143850},medical:{main:319,firstDep:319,addDep:215},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2020': {label:'2019/20',period:'1 Mar 2019–29 Feb 2020',brackets:[{min:0,max:195850,rate:.18,base:0},{min:195851,max:305850,rate:.26,base:35253},{min:305851,max:423300,rate:.31,base:63853},{min:423301,max:555600,rate:.36,base:100263},{min:555601,max:708310,rate:.39,base:147891},{min:708311,max:1500000,rate:.41,base:207448},{min:1500001,max:Infinity,rate:.45,base:532041}],rebates:{primary:14220,secondary:7794,tertiary:2601},thresholds:{under65:79000,age65:122300,age75:136750},medical:{main:310,firstDep:310,addDep:209},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2019': {label:'2018/19',period:'1 Mar 2018–28 Feb 2019',brackets:[{min:0,max:195850,rate:.18,base:0},{min:195851,max:305850,rate:.26,base:35253},{min:305851,max:423300,rate:.31,base:63853},{min:423301,max:555600,rate:.36,base:100263},{min:555601,max:708310,rate:.39,base:147891},{min:708311,max:1500000,rate:.41,base:207448},{min:1500001,max:Infinity,rate:.45,base:532041}],rebates:{primary:14067,secondary:7713,tertiary:2574},thresholds:{under65:78150,age65:121000,age75:135300},medical:{main:310,firstDep:310,addDep:209},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  '2018': {label:'2017/18',period:'1 Mar 2017–28 Feb 2018',brackets:[{min:0,max:189880,rate:.18,base:0},{min:189881,max:296540,rate:.26,base:34178},{min:296541,max:410460,rate:.31,base:61910},{min:410461,max:555600,rate:.36,base:97225},{min:555601,max:708310,rate:.39,base:149475},{min:708311,max:1500000,rate:.41,base:209032},{min:1500001,max:Infinity,rate:.45,base:533625}],rebates:{primary:13635,secondary:7479,tertiary:2493},thresholds:{under65:75750,age65:117300,age75:131150},medical:{main:303,firstDep:303,addDep:204},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  // 2016/17: no 45% bracket existed pre-2017/18 — the top rate was 41% with no
  // ceiling. Previously carried a fictional 45% row above R1.5m; removed.
  '2017': {label:'2016/17',period:'1 Mar 2016–28 Feb 2017',brackets:[{min:0,max:188000,rate:.18,base:0},{min:188001,max:293600,rate:.26,base:33840},{min:293601,max:406400,rate:.31,base:61296},{min:406401,max:550100,rate:.36,base:96264},{min:550101,max:701300,rate:.39,base:147996},{min:701301,max:Infinity,rate:.41,base:206964}],rebates:{primary:13500,secondary:7407,tertiary:2466},thresholds:{under65:75000,age65:116150,age75:129850},medical:{main:286,firstDep:286,addDep:192},retirement:{pct:27.5,cap:350000},cgt:{inclusion:.40,annualExcl:40000},donationPct:10},
  // 2015/16: same fictional-45%-bracket correction; R40k CGT annual exclusion
  // was only effective from 1 Mar 2016 (2016/17) — 2015/16 exclusion was R30k.
  '2016': {label:'2015/16',period:'1 Mar 2015–29 Feb 2016',brackets:[{min:0,max:181900,rate:.18,base:0},{min:181901,max:284100,rate:.26,base:32742},{min:284101,max:393200,rate:.31,base:59314},{min:393201,max:550100,rate:.36,base:93135},{min:550101,max:701300,rate:.39,base:149619},{min:701301,max:Infinity,rate:.41,base:208587}],rebates:{primary:13257,secondary:7407,tertiary:2466},thresholds:{under65:73650,age65:114800,age75:128500},medical:{main:270,firstDep:270,addDep:181},retirement:{pct:27.5,cap:350000,note:'Pre-2016/17: Pension 7.5% pensionable remuneration; RAF 15% non-pensionable. Unified 27.5%/R350k effective 1 March 2016.'},cgt:{inclusion:.333,annualExcl:30000},donationPct:10}
};

/* ── s10C QUALIFYING ANNUITY/PENSION CODES ──
   s10C exempts income from a COMPULSORY annuity/pension sourced from a
   retirement fund, to the extent of the taxpayer's non-deducted
   contributions balance remaining after this year's Second Schedule
   para 5/6 lump-sum relief. Codes 3603 (Pension), 3610 (RAF Annuity),
   3618 (Annuity from Provident/Provident Preservation Fund) qualify.
   Code 3611 (Purchased Annuity, taxable portion) does NOT: that's a
   voluntary annuity under the separate s10A regime, already reported net
   of its own capital-element exclusion — applying s10C on top would
   double-relieve the same contributions. Shared by 02-core.js (the
   engine) and 05-list-modules.js (the pension/annuity list render) so
   the two can never disagree on which codes qualify. */
export const S10C_ANNUITY_CODES = { '3603': true, '3610': true, '3618': true };

/* ── PHYSICAL PRESENCE TEST (s1(1) "resident" definition, para (a)(ii)) ──
   A person who is not ordinarily resident is still a resident for a tax
   year if physically present in South Africa for more than currentYear
   days in that year, more than eachPriorYear days in EACH of the
   preceding fiveYears years, AND more than aggregatePriorYears days in
   total across those preceding years. Onboarding's tax-residency
   explainer (step 1) interpolates these rather than hardcoding them in
   copy, per CLAUDE.md rule 5 (tax law = data + citation). */
export const PHYSICAL_PRESENCE = { currentYear: 91, eachPriorYear: 91, fiveYears: 5, aggregatePriorYears: 915 };

/* ── SARS PRESCRIBED REIMBURSIVE RATE (rand per business kilometre) ──
   s8(1)(b)(iii): a reimbursement at or below this rate, with no other travel
   allowance, is not taxed (IRP5 code 3703). Held only for the years verified
   against the Gazette: 2026/27 from Government Gazette No. 54228 (27 Feb
   2026), Notice 7182 — the same notice as the table below. A year with no
   entry shows no figure (renderTravelValueTable); it is never guessed. */
export const SARS_REIMBURSIVE_RATE = {
  '2027': 4.95,
};

/* ── SARS DEEMED COST TRAVEL TABLE ──
   Verified 2026/27 against Government Gazette No. 54228 (27 Feb 2026)
   Notice 7182 — Section 8(1)(b)(ii) and (iii) Schedule. */
export const SARS_TRAVEL = {
  '2027': [
    {max:115000,  fixed:38344,  fuel:132.9, maint:49.1},
    {max:230000,  fixed:68487,  fuel:148.4, maint:61.4},
    {max:345000,  fixed:98689,  fuel:161.2, maint:67.8},
    {max:460000,  fixed:125393, fuel:173.4, maint:74.0},
    {max:575000,  fixed:152097, fuel:185.5, maint:86.9},
    {max:690000,  fixed:180078, fuel:212.8, maint:102.0},
    {max:805000,  fixed:208106, fuel:216.5, maint:114.5},
    {max:920000,  fixed:237679, fuel:220.1, maint:126.9},
    {max:Infinity,fixed:237679, fuel:220.1, maint:126.9}
  ],
  '2026': [
    {max:100000,  fixed:28992, fuel:129.3, maint:41.1},
    {max:200000,  fixed:51768, fuel:144.9, maint:47.0},
    {max:300000,  fixed:74904, fuel:162.0, maint:51.6},
    {max:400000,  fixed:92448, fuel:177.3, maint:57.4},
    {max:500000,  fixed:112284,fuel:192.6, maint:64.1},
    {max:600000,  fixed:133407,fuel:217.2, maint:71.4},
    {max:700000,  fixed:154893,fuel:231.3, maint:79.6},
    {max:Infinity,fixed:154893,fuel:231.3, maint:79.6}
  ],
  '2025': [
    {max:100000,  fixed:28352, fuel:120.6, maint:39.4},
    {max:200000,  fixed:50924, fuel:136.1, maint:44.2},
    {max:300000,  fixed:73767, fuel:152.2, maint:47.9},
    {max:400000,  fixed:90941, fuel:166.9, maint:53.5},
    {max:500000,  fixed:110323,fuel:180.2, maint:59.9},
    {max:600000,  fixed:131279,fuel:203.6, maint:66.9},
    {max:700000,  fixed:152369,fuel:216.9, maint:74.6},
    {max:Infinity,fixed:152369,fuel:216.9, maint:74.6}
  ]
};

// s8(1)(b) Schedule — vehicle-cost cap for the actual-cost travel method,
// effective 1 March 2020 (same gazetted value as the s11(e) W&T cost-basis
// cap, WANDT_CONST in 04-deductions.js).
export const TRAVEL_ACTUAL_COST_CAP = 665000;

// s6B(3) ITA — additional medical expenses tax credit. s6B(3)(a)/(b): taxpayer
// 65+ or a disabled taxpayer/spouse/child gets 33⅓% of (contributions above
// 3 × the s6A credit + qualifying expenses), no threshold. s6B(3)(c): everyone
// else gets 25% of (contributions above 4 × s6A + qualifying expenses) to the
// extent that sum exceeds 7.5% of taxable income. The 33⅓% rate is kept as a
// divisor so the engine's arithmetic (x / 3) is bit-identical to before.
export const MEDICAL_S6B = {
  contribMultiple: 4,
  contribMultipleSenior: 3,
  thresholdPct: 0.075,
  rate: 0.25,
  seniorRateDivisor: 3,
};

// Eighth Schedule para 45(1)(b) — the full primary-residence gain is
// disregarded (not just the annual primaryResExcl amount) when proceeds on
// disposal are R2m or less AND the taxpayer confirms sole domestic use for
// the whole period of ownership. This limit is a separate statutory figure
// from cgt.primaryResExcl and does not move with it year to year.
export const PARA45_PROCEEDS_LIMIT = 2000000;

/* ── TAX-FREE INVESTMENTS (s12T; QR9a, QD-12) ──
   s12T(7)(a): 40 % of contributions over the annual limit, and s12T(7)(b):
   40 % of "so much of [the excess over the R500 000 lifetime limit] as has
   not previously been taken into account in terms of this subsection", is
   deemed normal tax payable. SARS IT-AE-36-G05 rev 39 §6.11(d): "added to
   normal tax payable after rebates". The annual/lifetime limits are per year
   in TAX_YEARS[y].tfsa. s12T(6): transfers between a person's own tax-free
   investments, and amounts received in one, are not contributions. */
export const S12T_EXCESS_CHARGE_RATE = 0.40;
/* ITR12 §6.11(g) asks each investment's "Investment Type"; these are the
   instruments s12T(1) and its regulations allow. Labels only — no tax role. */
export const TFI_INVESTMENT_TYPES = [
  { value:'deposit',   label:'Savings or fixed-deposit account' },
  { value:'unit_trust', label:'Unit trust (collective investment scheme)' },
  { value:'etf',       label:'Exchange-traded fund (ETF)' },
  { value:'bond',      label:'RSA retail savings bond' },
  { value:'policy',    label:'Endowment or other insurance policy' },
  { value:'other',     label:'Other' }
];

/* ── FOREIGN DIVIDENDS TAXABLE PORTION ──
   s10B(3): natural persons — 25/45 of a qualifying foreign dividend is
   exempt, 20/45 is taxable (max effective rate 20% at the top marginal
   bracket). Not a DWT/CIT derivation — that framing (20/47, "27/47
   exempt") was a v8.21-era error; see IN93 p.40. */
export const FOREIGN_DIVIDEND_TAXABLE_RATIO = 20 / 45;

/* QR4.8 (QX-CPY-2): a rand figure for user-facing copy. A plain hoisted
   function on purpose — fmt() lives in 02-core.js, which imports this file, so
   calling it while a const below is being built would touch a binding that has
   not been initialised yet (hard rule 10). */
export function randText(n) {
  return 'R' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* DECISIONS C-E6 / RP-1: the one support address. About's *Contact us*
   link (src/body.html) and Report a problem's browser fallback both use it;
   tests/smoke.js holds the About link to this value. */
export const SUPPORT_EMAIL = 'inspiredfr@gmail.com';

/* BACKLOG 83 / DECISIONS SHARE-1: *Share InspiredTax* sends a friend this
   link, never a Google Play URL. The website owns where it leads — during
   closed testing inspiredtax.co.za/get explains the test and offers /join;
   at production it forwards to the Play listing (site repo, get/index.html,
   PLAY_LIVE). Installed copies of the app keep sharing whatever is here for
   as long as they stay installed, so the phase switch must not need an app
   update. tests/smoke.js holds this to the inspiredtax.co.za host. */
export const APP_SHARE_URL = 'https://inspiredtax.co.za/get';
/* The message WhatsApp opens with (copy C-88, QD-16). The link goes last so
   WhatsApp builds its preview card from it. */
export const APP_SHARE_MESSAGE = 'I use InspiredTax to work out my SARS income tax on my phone. My figures stay on my phone. Get it for Android: ' + APP_SHARE_URL;

/* C-53 (owner 2026-10-15): the count under the Income and Deductions
   section headings (Completed / Off) reads "3 items" — one wording for both
   pages, replacing "steps" (12a rev 3). */
export function itemCount(n) {
  return n + (n === 1 ? ' item' : ' items');
}

/* QR4.8 (Q-CPY-4): the s11(e) small-item concession — an asset costing this
   much OR LESS is written off in full in the year it is brought into use.
   QR9b (QD-29, owner 2026-10-01): the boundary follows the SARS ITR12 guide,
   IT-AE-36-G05 rev 39 §9.8.3(c) — "the cost thereof does not exceed R7 000".
   Interpretation Note 47 (Issue 5, 9 Feb 2021) §4.3.5 words the same
   concession as "a cost of less than R7 000 per item", so the two SARS
   documents differ for an item of exactly R7 000: written off in full here,
   depreciable under the Note. Both exclude an item that forms part of a set
   (the set is tested as a whole) and the Note excludes assets a lessor buys
   to let out. Every comparison is `cost <= WT_SMALL_ITEM_LIMIT` — TC-016
   pins the boundary. */
export const WT_SMALL_ITEM_LIMIT = 7000;

/* ── SARS WEAR & TEAR WRITE-OFF PERIODS ──
   `life` is years; the yearly allowance is cost / life (straight line).
   Source: Binding General Ruling (Income Tax) 7 (Issue 4), which is the
   Annexure to Interpretation Note 47 (Issue 5, 9 Feb 2021) — in
   docs/reference/sars-sources/LAPD-IntR-IN-2012-47-…pdf. Annexure rows, read
   2026-10-02: Cellular telephones 2 · Computers, personal 3 · Computer tablet
   and similar devices 2 · Furniture and fittings 6 · Passenger cars 5 (the
   Note's own Example 4 says "passenger cars must be written off over five
   years").
   The same rows read identically in BGR 7 (Issue 4) itself (sars.gov.za,
   fetched 2026-10-02).
   - QD-30, as re-answered by the owner on 2026-10-02: follow the ruling —
     furniture 6, passenger cars 5, tablets 2. The first answer (2026-10-01:
     furniture 5, cars 4, tablets 3) came from QR5's reading of this Annexure
     off a column-shifted text extraction and was never applied. So
     `furniture` is unchanged (TC-018 pins it) and
     `tablet` moved 3 → 2 (TC-019). Do not move any of them back to the
     first answer — 03-DECISIONS.md QD-30.
   - `other` is a fallback for an asset the list does not name; the Annexure
     has no such row (office equipment — electronic 3, mechanical 5; power
     tools 5).
   - No vehicle row (QD-31, BACKLOG 93): a vehicle's work use is claimed
     through the Travel deduction or with the business. */
export const SARS_WT_RATES = [
  {type:'computer',   label:'Computers / laptops', option:'Computer / Laptop',           life:3},
  {type:'tablet',     label:'Tablets',             option:'Tablet',                      life:2},
  {type:'phone',      label:'Cellphones',          option:'Cellphone',                   life:2},
  {type:'furniture',  label:'Office furniture',    option:'Furniture / Office fittings', life:6},
  {type:'small_tool', label:'Small tools (up to ' + randText(WT_SMALL_ITEM_LIMIT) + ')',
                      option:'Small tool / Equipment (up to ' + randText(WT_SMALL_ITEM_LIMIT) + ')', life:1},
  {type:'other',      label:'Other equipment',     option:'Other',                       life:5}
];
/* The write-off period for an asset type. One reader for the engine total, the
   list, the live echo and the copy (WR-8) — an unknown type takes `other`'s. */
export function wtLife(type) {
  const r = SARS_WT_RATES.find(x => x.type === type) || SARS_WT_RATES.find(x => x.type === 'other');
  return r.life;
}

/* QR4.3 (QD-17): the rental subtypes that are a LEASE of a movable asset rather
   than a let of property — equal engine treatment (wear & tear, no property
   costs, no s20A non-relative question). They differ only in copy: the
   deemed-travel-allowance rule (OPTION_NOTES['rental-type'].vehicle) applies to
   a motor vehicle let to the taxpayer's own employer and to nothing else. Every
   test of "is this a lease?" reads this set; a bare type === 'equipment' would
   silently give a Vehicle lease property-style treatment. Existing records keep
   the combined subtype as 'equipment' (never guessed from the name). */
export const RENTAL_LEASE_TYPES = ['equipment', 'vehicle'];

/* QR4.2 (Q-CPY-2): the line above a rental's expense rows, by rental type. The
   Airbnb sentence used to show for every type. s11(a), s23(b) — see the
   OPTION_NOTES['rental-type'].airbnb comment. */
export const RENTAL_EXPENSES_INTRO = {
  /* RENT-12 (owner, 2026-10-02): the generic "Add each expense by category."
     line is gone for every type — the row cards say it — and only the Airbnb
     sentence, which says something the cards do not, is kept. */
  /* UI-NOTE-1: one line + More (noteBody, 02-core.js). */
  airbnb: { short: 'Shared costs follow the share you let; letting-only costs count in full.', title: 'Airbnb expenses',
    detail: 'Fixed costs are apportioned by the % of your home you let; costs that belong only to the letting (agent, advertising, repairs and equipment used only for the Airbnb) are 100% deductible.' },
};

/* UI-CAP-1 (owner 2026-10-05, capture option B; shared rules 4 and 5 of
   _mockups/capture-flows.html, retired — git show 903a995:_mockups/capture-flows.html): every sheet that captures more
   than one kind of record OPENS on its chooser — the question and one tile
   per kind, before any field shows (kindSwitchHtml, 00-forms.js). Picking a
   tile moves into the form and the sheet's title names the kind ("Add
   Airbnb rental"); a Change button in the header brings the chooser back.
   A group with one tile left after the profile gates skips the chooser.

   Two shapes of group:
   - CROSS-SHEET (QR9b.3 / QR9b.4, QD-27 P3/P1): each option is its own
     makeCrudModule sheet (`modal`). Picking another kind closes this sheet
     and opens that one (switchCaptureKind, 05-list-modules.js); the first
     option's sheet is the one the page's Add button opens.
   - IN-SHEET: one sheet, and the kind is the value of one of its selects
     (`field`). The select stays in the form, hidden, so every reader of it
     (gs/gv, makeCrudModule's put/collect, applyScenarioGates) is unchanged;
     a tile is offered only while that select still offers its value, so the
     profile gates (QR7.3) and retired types need no second list here.
     `tile:false` names a value the select holds but the chooser does not
     offer (it still titles a saved record).

   Each option: `title` (the tile), `desc` (its second line), `noun` (the
   sheet title: "Add " + noun / "Edit " + noun). `layout`: 'cards' = one per
   row with a description; 'pair' = two side by side. No icon tiles — a
   chooser does not add a second tile colour to a page (D-19). Copy: copy
   deck C-58. */
export const CAPTURE_KINDS = {
  retirement: {
    label: 'What did you receive?', layout: 'cards', addTitle: 'Add retirement income',
    options: [
      { value:'pension', modal:'modal-pension-annuity',    title:'Pension or annuity payments', desc:'Paid monthly or yearly — on your IRP5 / IT3(a)', noun:'pension or annuity' },
      { value:'lumpsum', modal:'modal-retirement-lumpsum', title:'A lump sum',                  desc:'On retirement, withdrawal, severance or death',  noun:'retirement lump sum' },
      { value:'twopot',  modal:'modal-twopot',             title:'Two-pot savings withdrawal',  desc:'From your savings component',                    noun:'two-pot withdrawal' }
    ] },
  crypto: {
    label: 'What happened?', layout: 'pair', addTitle: 'Add crypto',
    options: [
      { value:'disposal', modal:'modal-crypto-disposal', title:'I sold, swapped or spent it', noun:'crypto sale' },
      { value:'revenue',  modal:'modal-crypto-revenue',  title:'I earned it',                 noun:'crypto income' }
    ] },
  /* Values: INCOME_TYPE_DEFS rental_income subtypes (the select's options). */
  rental: {
    label: 'What kind of rental is it?', layout: 'cards', addTitle: 'Add rental', field: 'rental-type',
    options: [
      { value:'property',  title:'Long-term rental',         desc:'A tenant pays you rent, usually monthly',  noun:'long-term rental' },
      { value:'airbnb',    title:'Airbnb or short-term let', desc:'Part or all of your home, let by the night', noun:'Airbnb rental' },
      { value:'equipment', title:'Equipment lease',          desc:'Machinery or tools you hire out',           noun:'equipment lease' },
      { value:'vehicle',   title:'Vehicle lease',            desc:'A car or bakkie you hire out',              noun:'vehicle lease' },
      { value:'foreign',   title:'Property abroad',          desc:'Rented out in another country',             noun:'property abroad' }
    ] },
  /* Values: INCOME_TYPE_DEFS business_income subtypes. */
  business: {
    label: 'What kind of work is it?', layout: 'cards', addTitle: 'Add business or trade', field: 'biz-type',
    options: [
      { value:'freelancer', title:'Freelancer or contractor',   desc:'You sell your own services to clients',       noun:'freelance or contract work' },
      { value:'commission', title:'Commission or fees',         desc:'Paid per sale or per job',                    noun:'commission or fees' },
      { value:'sole_prop',  title:'Sole proprietor or practice', desc:'A business or practice in your own name',    noun:'sole proprietorship' },
      { value:'trader',     title:'Trader or vendor',           desc:'You buy and sell goods',                      noun:'trading business' },
      { value:'foreign',    title:'Business abroad',            desc:'Carried on outside South Africa',             noun:'business abroad' }
    ] },
  /* Values: INCOME_TYPE_DEFS cgt subtypes. */
  cgt: {
    label: 'What did you sell?', layout: 'cards', addTitle: 'Add CGT disposal', field: 'cgt-type',
    options: [
      { value:'property', title:'Property',                  desc:'A house, flat, farm or plot',            noun:'property sale' },
      { value:'shares',   title:'Shares or unit trusts',     desc:'Listed shares, ETFs or unit trusts',     noun:'share sale' },
      { value:'vehicle',  title:'Vehicle, equipment or other movables', desc:'Taxed only if you used it mainly for work', noun:'sale of a movable asset' },
      { value:'foreign',  title:'An asset abroad',           desc:'Anything you owned outside South Africa', noun:'sale of an asset abroad' },
      { value:'other',    title:'Something else',            desc:'Any other capital asset',                noun:'CGT disposal' }
    ] },
  /* The or-category select is built from this list (CFG_OTHER_RECEIPT).
     `receiptType`: what picking the tile sets on or-receipt-type — a
     capital receipt goes to the CGT aggregate, everything else is income
     (alimony's exemption question stays on the form, s10(1)(u)). */
  otherReceipt: {
    label: 'What did you receive?', layout: 'cards', addTitle: 'Add other taxable receipt', field: 'or-category',
    options: [
      { value:'royalties',       title:'Royalties',           desc:'From books, music, patents or other IP',    noun:'royalty',             receiptType:'income' },
      { value:'alimony',         title:'Maintenance',         desc:'From a former spouse',                      noun:'maintenance received', receiptType:'income' },
      { value:'settlement',      title:'Settlement or award', desc:'From a court case or a dispute',            noun:'settlement or award', receiptType:'income' },
      { value:'recovery',        title:'Recovery or refund',  desc:'Of an expense you claimed before',          noun:'recovery or refund',  receiptType:'income' },
      { value:'capital_receipt', title:'Capital receipt',     desc:'Proceeds of an asset — goes to capital gains', noun:'capital receipt',  receiptType:'capital' },
      { value:'other',           title:'Something else',      desc:'Any other taxable receipt',                 noun:'other receipt',       receiptType:'income' }
    ] },
  /* Values: the ls-event-type select (CFG_LUMPSUM). */
  lumpsum: {
    label: 'Why was it paid?', layout: 'cards', addTitle: 'Add retirement lump sum', field: 'ls-event-type',
    options: [
      { value:'retirement', title:'Retirement',                    desc:'You retired from the fund',                noun:'retirement lump sum' },
      { value:'severance',  title:'Severance',                     desc:'From your employer when your job ended',   noun:'severance benefit' },
      { value:'withdrawal', title:'Withdrawal before retirement',  desc:'You resigned or left the fund early',       noun:'withdrawal benefit' },
      { value:'death',      title:'Death benefit',                 desc:'Paid from the fund of someone who died',   noun:'death benefit' },
      { value:'transfer',   title:'Transfer to another fund',      desc:'Moved to an approved fund — not taxed',    noun:'fund transfer' },
      { value:'divorce_nonmember', title:'Divorce order',          desc:'Your share of a former spouse’s fund',     noun:'divorce-order payment' }
    ] },
  /* Values: SARS_WT_RATES types. Small tool is the cost rule (≤
     WT_SMALL_ITEM_LIMIT, toolsCostEcho, 04-deductions.js), not a kind of
     thing, so it is not a tile. */
  tools: {
    label: 'What did you buy?', layout: 'cards', addTitle: 'Add asset', field: 'tools-wt-type',
    options: SARS_WT_RATES.map(r => ({
      value: r.type, tile: r.type !== 'small_tool',
      title: { computer:'Computer or laptop', tablet:'Tablet', phone:'Cellphone', furniture:'Furniture or office fittings',
               small_tool:'Small item', other:'Other equipment' }[r.type] || r.option,
      desc: r.type === 'other' ? 'Tools and anything else you use for work' : 'Written off over ' + r.life + ' year' + (r.life === 1 ? '' : 's'),
      noun: { computer:'computer', tablet:'tablet', phone:'cellphone', furniture:'furniture',
              small_tool:'small item', other:'equipment' }[r.type] || 'asset'
    })) },
  /* IT3(b): which halves of the certificate it carries. Not saved — derived
     from the amounts when a certificate is edited (it3bKindOf, 05). The two
     foreign kinds carry the foreign-investments gate (QR7.3) on the
     it3b-kind select's options, so with the gate closed only "South
     African" is left and the chooser is skipped. */
  it3b: {
    label: 'What is on the certificate?', layout: 'cards', addTitle: 'Add investment income', field: 'it3b-kind',
    options: [
      { value:'local',   title:'South African only', desc:'Interest and dividends from South Africa', noun:'South African IT3(b)' },
      { value:'foreign', title:'Foreign only',       desc:'Offshore interest, dividends or gains',     noun:'foreign IT3(b)',   showWhen:'foreign:investments' },
      { value:'both',    title:'Both',               desc:'South African and foreign lines',           noun:'local and foreign IT3(b)', showWhen:'foreign:investments' }
    ] }
};
/* Shared rule 6 (amounts as lines, QD-27 P4): the cost lines a new rental,
   business or crypto record starts with, by kind, and the next few offered as one-tap chips
   ("Add a cost"); every other category stays one tap further, on the row's
   own select. Ids: rentalCategoriesForType() / B4_EXPENSE_CATEGORIES
   (05-list-modules.js). A UX default, not law — no figure moves. */
export const USUAL_COSTS = {
  rental: {
    property:  { usual:['bond', 'rates', 'insurance'],      more:['levies', 'agent', 'repairs', 'advertising'] },
    airbnb:    { usual:['bond', 'rates', 'advertising'],    more:['insurance', 'levies', 'repairs_direct', 'agent'] },
    equipment: { usual:['wear_tear', 'repairs'],            more:['insurance', 'bond'] },
    vehicle:   { usual:['wear_tear', 'insurance'],          more:['repairs', 'bond'] },
    foreign:   { usual:['bond', 'rates', 'insurance'],      more:['agent', 'repairs', 'levies'] }
  },
  business: {
    freelancer: { usual:['telephone', 'subscriptions', 'office'],       more:['professional', 'travel', 'depreciation'] },
    commission: { usual:['travel', 'telephone', 'marketing'],          more:['subscriptions', 'professional', 'office'] },
    sole_prop:  { usual:['rent', 'salaries', 'professional'],          more:['telephone', 'utilities', 'insurance'] },
    trader:     { usual:['cost_sales', 'rent', 'bank'],                more:['salaries', 'marketing', 'travel'] },
    foreign:    { usual:['cost_sales', 'professional', 'bank'],        more:['travel', 'telephone', 'rent'] }
  },
  /* BACKLOG 63 (OI-C1d): the two other-receipt kinds that carry costs
     (OTHER_RECEIPT_COST_KINDS). Ids: OTHER_RECEIPT_COSTS. */
  otherReceipt: {
    royalties: { usual:['agent', 'professional'], more:['materials', 'travel', 'subscriptions'] },
    other:     { usual:[],                        more:['professional', 'materials', 'travel'] }
  },
  /* BACKLOG 44 (OI-B6a): both crypto cost lists. Ids: CRYPTO_DISP_EXP /
     CRYPTO_REV_EXP (06-crypto.js). A disposal held as an investment is
     offered only the fees on the buy or sell (Eighth Schedule para
     20(1)(c)) — the other categories are a trade's running costs and stay
     on the row's own select, where cryptoDisposalCosts() ignores them. */
  crypto: {
    disposal: {
      capital: { usual:['exchange_fees', 'gas_fees'],                    more:['withdrawal_fees'] },
      trading: { usual:['exchange_fees', 'gas_fees', 'trading_software'], more:['market_data', 'internet', 'accounting_fees', 'bank_charges'] }
    },
    revenue: {
      staking:  { usual:['validator', 'hosting'],                 more:['internet', 'monitoring', 'accounting_fees'] },
      mining:   { usual:['electricity', 'pool_fees', 'hardware'], more:['internet', 'hosting', 'accounting_fees'] },
      defi:     { usual:['accounting_fees'],                      more:['internet'] },
      airdrops: { usual:[],                                       more:['accounting_fees'] },
      other:    { usual:[],                                       more:['accounting_fees', 'internet'] }
    }
  }
};

/* BACKLOG 63 (OI-C1d, owner 2026-10-09): the other-receipt kinds that may
   carry costs. s11(a) allows expenditure actually incurred in the production
   of income, and s23(g) bars any not laid out for the purposes of a trade —
   so costs count only where the receipt comes from carrying on a trade: a
   writer's royalties, a trading "something else". A recovery or refund is
   itself a recoupment of a cost already claimed, maintenance is exempt or
   taxable without costs, a settlement is taxed as received. The costs on a
   receipt reduce it to nil at most: a trade making a loss is captured under
   Business, where the trade test and s20 assessed-loss rules apply. */
export const OTHER_RECEIPT_COST_KINDS = ['royalties', 'other'];
export const OTHER_RECEIPT_COSTS = {
  agent:'Agent or publisher fees', professional:'Professional fees', materials:'Materials and supplies',
  travel:'Travel', subscriptions:'Subscriptions', other:'Other'
};

/* QR9b.6 (Q-COD-3, QD-27 — pattern P3 on retirement contributions): the three
   funds a taxpayer can have paid into, each with the input that holds its
   total for the year and the IRP5 code that amount is found next to
   (IRP5_DEDUCTIONS: 4001, 4003, 4006 — s11F treats all three alike). The
   Deductions → Retirement page shows a fund's input only while it holds an
   amount or the user has chosen it (retSyncFundRows, 04-deductions.js); the
   inputs themselves, and everything that reads them, are unchanged. */
export const RETIREMENT_FUNDS = [
  { key:'pension',   field:'ded_pension',   code:'4001', title:'Pension fund' },
  { key:'provident', field:'ded_provident', code:'4003', title:'Provident fund' },
  { key:'ra',        field:'ded_ra',        code:'4006', title:'Retirement annuity' }
];

/* QR4.2 (QX-CPY-1, Q-CPY-1/2/3/4): guidance that depends on WHICH option of a
   select the user picked, as data. renderField() (00-forms.js) takes one of
   these maps as `optionNotes`, renders a single aria-live note container
   under the select and refreshOptionNotes()/optNoteUpdate() (02-core.js) show
   the entry for the current value ('*' = every option without its own entry).
   Values are { icon, html } — developer-authored HTML, never user text.
   Every sentence stating tax law names its primary source in the comment
   beside it (WR-10) and in 07-COPY-DECK.md. */
export const OPTION_NOTES = {
  'rental-type': {
    /* s11(a) production of income, s23(b) private/domestic expenses — apportion
       by let share. Wording re-drafted for RENT-7 (07-COPY-DECK C-14). */
    airbnb: { icon: 'lightbulb', short: 'Airbnb: shared home costs follow the share you let.', title: 'Airbnb or short-term let',
      html: '<strong>Airbnb or short-term let:</strong> costs of running the whole home (rates, bond interest, insurance, levies) are apportioned to the share of your home that you let — you enter that share below. Costs that belong only to the letting — agent fees, advertising, and repairs or equipment used only for the Airbnb — are 100% deductible.' },
    /* s11(e) wear and tear; s11(a) repairs, insurance, finance charges. */
    equipment: { icon: 'local_shipping', short: 'Deduct wear and tear, repairs, insurance and finance charges.', title: 'Equipment lease',
      html: '<strong>Equipment lease:</strong> deduct wear &amp; tear (s11(e)), repairs, insurance and finance charges. Property costs (rates, levies, agent, bond interest) do not apply. If what you lease out is a motor vehicle, choose <em>Vehicle lease</em> instead.' },
    /* PAYE-GEN-01-G03 §3.2 "Vehicle let to the employer" (reviewed 2026-08-28): where an
       employee (or their spouse or child) owns or leases a motor vehicle and lets it to
       their OWN employer, the rental plus any expenditure the employer bears on it is
       DEEMED a travel allowance under s8(1)(b), not rental income. The app cannot see who
       a vehicle is let to, so this is disclosure only. Motor vehicles only (QD-17). */
    vehicle: { icon: 'local_shipping', short: 'Letting it to your own employer? That is a travel allowance.', title: 'Vehicle lease',
      html: '<strong>Vehicle lease:</strong> deduct wear &amp; tear (s11(e)), repairs, insurance and finance charges. <strong>Letting it to your own employer?</strong> If you (or your spouse or child) let this vehicle to your OWN employer, the rental — plus anything the employer spends on it — is treated as a <strong>travel allowance</strong>, not rental income. Do not capture it here; add it as travel-allowance income instead, where you can also claim the matching travel deduction.' },
    /* s6quat foreign tax credit. */
    foreign: { icon: 'public', short: 'Foreign tax you paid on it may be credited here.', title: 'Foreign lease',
      html: '<strong>Foreign lease:</strong> income is included in your taxable income as foreign income. Foreign tax paid may qualify for a foreign tax credit (s6quat).' },
  },
  'cgt-type': {
    /* Eighth Schedule para 53 (personal-use assets), as summarised in SARS
       "ABC of Capital Gains Tax for Individuals" (CGT02, Issue 13) s5
       Exclusions: a personal-use asset is one used mainly (more than 50%) for a
       non-trade purpose — a motor vehicle (even one with a car allowance), a
       caravan, artwork, furniture, household appliances; it excludes immovable
       property and financial instruments (shares, unit trusts, crypto). Boats
       over 10 m and aircraft over 450 kg empty mass are not personal-use
       assets, so they are not excluded. */
    vehicle: { icon: 'info', short: 'A car or other personal-use asset is usually not taxed on sale.', title: 'Personal-use assets',
      html: '<strong>Personal-use assets are excluded from CGT.</strong> A car (even one you get a car allowance for), caravan, furniture, artwork or household appliance that you used mainly (more than 50%) for private purposes is a personal-use asset: a gain on selling it is not taxed and a loss cannot be claimed (Eighth Schedule para 53). Add a disposal here only if the asset was used mainly in a trade, or is a boat over 10&nbsp;m or an aircraft over 450&nbsp;kg (empty mass), which are not personal-use assets.' },
  },
  /* QR9b.4 (P1): the crypto disposal sheet's "How did you hold it?" choice.
     Capital or revenue is decided on the ordinary tests — s1 "gross income"
     excludes receipts of a capital nature; a capital gain is taxed through
     the Eighth Schedule (annual exclusion para 5, inclusion rate para 10);
     trading profit is ordinary income, with expenses under s11(a). SARS
     applies the normal income tax rules to crypto assets ("crypto asset" is
     a financial instrument, s1). */
  'cd-class': {
    capital: { icon: 'info', short: 'A capital gain: only part is taxed, after the yearly exclusion.', title: 'Held as an investment',
      html: '<strong>Held as an investment:</strong> the gain is a capital gain. Only part of it is taxed, after the yearly exclusion.' },
    trading: { icon: 'info', short: 'Ordinary income at your marginal rate, less trading costs.', title: 'Bought and sold to trade',
      html: '<strong>Bought and sold to trade:</strong> the profit is ordinary income, taxed at your marginal rate. You can deduct your trading expenses below.' },
  },
  /* QR9b.2 (QR5.5 R-7). s1 "gross income" (a resident is taxed on worldwide
     receipts); s6quat (rebate for foreign taxes on income). */
  'biz-type': {
    foreign: { icon: 'public', short: 'Still taxed here; tax paid abroad can reduce it.', title: 'Foreign business',
      html: '<strong>Foreign business:</strong> the profit is still taxed here if you live in South Africa. Tax you already paid abroad on it can reduce what you owe here (s6quat) — enter it below.' },
  },
  'tools-wt-type': {
    /* s11(e): wear and tear is allowed on assets used in the taxpayer's trade;
       s23(b)/(g) bar private or domestic expenditure. Mixed use is apportioned
       (IN47). The small-item limit is WT_SMALL_ITEM_LIMIT. */
    '*': { icon: 'info', short: 'Only the share you use for work is deductible.', title: 'Only work use counts',
      html: '<strong>Only work use counts.</strong> Wear &amp; tear (s11(e)) is allowed on assets you use in your trade or employment. An item you also use privately is deductible only for its work share; a purely private item is not deductible at all.' },
    /* QR9b (QD-29, QD-31). Limit and "or less": ITR12 guide IT-AE-36-G05
       §9.8.3(c). Set rule and lessor exclusion: Interpretation Note 47
       (Issue 5) §4.3.5 — "does not form part of a set"; "does not apply to
       assets acquired by lessors for the purpose of letting". */
    small_tool: { icon: 'info', short: 'Items up to ' + randText(WT_SMALL_ITEM_LIMIT) + ' are written off in the year you buy them.', title: 'Small items',
      html: '<strong>Small items:</strong> an asset costing ' + randText(WT_SMALL_ITEM_LIMIT) + ' or less is written off in full in the year you bring it into use (s11(e)). An item that is part of a set — a table and its chairs — counts at the cost of the whole set. An asset you bought to let out does not qualify; write it off over its useful life instead. It must still be used in your trade or employment — an item you also use privately is deductible only for its work share.' },
  },
};

/* ── SUBSISTENCE ALLOWANCE DEEMED RATES (s8(1)(c), local travel) ──
   Deemed daily amounts a taxpayer is regarded to have actually expended on
   meals/incidental costs (or incidentals only where accommodation is
   provided separately), published annually by government gazette.
   VERIFY-GATED (W6/W20 protocol): only years confirmed from a local source
   are populated. All three years below confirmed 2026-08-28 directly from
   SARS's own "Subsistence Allowances and Advances" rates page (docs/
   reference/sars-sources/SARS-Subsistence-Allowances-and-Advances.pdf) —
   its "Local" table lists every year back to 2022:
     2027: meals+incidentals 595 / incidentals-only 184
     2026: meals+incidentals 570 / incidentals-only 176
     2025: meals+incidentals 548 / incidentals-only 169
   This CORRECTS the previous 2026 figures (522/152), which had been
   sourced from a secondary compendium document and were simply wrong —
   522/152 turn out to be the 2024 year's rates (161 the 2024 incidentals
   figure is close but not exact either; the secondary source conflated
   two different years). No golden scenario exercises subsistence with tax
   year 2026, so this was live-and-wrong with zero test coverage; see the
   f7_subsistence_2026_rate_matches_sars_source engine check for the
   regression guard. 2027 also independently corroborated by SARS
   PAYE-GEN-01-G03 (2027 edition) §3.1, already cited here previously. */
export const SUBSISTENCE_RATES = {
  '2025': { localMealsIncidentals: 548, localIncidentals: 169 },
  '2026': { localMealsIncidentals: 570, localIncidentals: 176 },
  '2027': { localMealsIncidentals: 595, localIncidentals: 184 }
};

/* ── SUBSISTENCE ALLOWANCE — FOREIGN TRAVEL, PER-COUNTRY DEEMED RATES
   (s8(1)(c), same provision as SUBSISTENCE_RATES above, "outside the
   Republic" limb) ──
   Deemed daily amount per country, in that country's OWN currency (per
   SARS's own annexure — this is NOT a Rand figure). Source: SARS
   "PAYE-GEN-01-G03-A02 — Subsistence Allowance Foreign Travel — External
   Annexure", effective 1 March 2025 (docs/reference/sars-sources/
   PAYE-GEN-01-G03-A02-Subsistence-Allowance-Foreign-Travel-External-
   Annexure.pdf). Per SARS's own "Subsistence Allowances and Advances"
   rates page (SARS-Subsistence-Allowances-and-Advances.pdf), this exact
   table is confirmed "no changes" for tax years 2026 AND 2027 relative to
   2025 — so ONE flat table (not year-keyed) correctly covers all three
   live tax years; re-verify against the SARS page before assuming a
   fourth year.

   `code` is one of the four currencies FOREIGN_EXCHANGE_RATES (above) can
   convert to Rand (USD/GBP/EUR/AUD), or 'ZAR' where SARS denominates the
   deemed amount directly in Rand (Eswatini/Lesotho/Namibia — no
   conversion needed, rate is always 1) — or null where the country's
   currency isn't yet supported for conversion in-app (calcForeignSubsistence,
   04-deductions.js, discloses this rather than guessing a rate). `currency`
   is always the real currency name for display, regardless of whether
   `code` is populated. */
export const FOREIGN_SUBSISTENCE_RATES = {
  'Albania': { currency: 'Euro', code: 'EUR', amount: 97 },
  'Algeria': { currency: 'Euro', code: 'EUR', amount: 110 },
  'Angola': { currency: 'US Dollar', code: 'USD', amount: 303 },
  'Antigua and Barbuda': { currency: 'US Dollar', code: 'USD', amount: 163 },
  'Argentina': { currency: 'US Dollar', code: 'USD', amount: 106 },
  'Armenia': { currency: 'US Dollar', code: 'USD', amount: 220 },
  'Austria': { currency: 'Euro', code: 'EUR', amount: 136 },
  'Australia': { currency: 'Australian Dollar', code: 'AUD', amount: 230 },
  'Azerbaijan': { currency: 'US Dollar', code: 'USD', amount: 145 },
  'Bahamas': { currency: 'US Dollar', code: 'USD', amount: 228 },
  'Bahrain': { currency: 'Bahraini Dinar', code: null, amount: 36 },
  'Bangladesh': { currency: 'US Dollar', code: 'USD', amount: 79 },
  'Barbados': { currency: 'US Dollar', code: 'USD', amount: 202 },
  'Belarus': { currency: 'Euro', code: 'EUR', amount: 62 },
  'Belgium': { currency: 'Euro', code: 'EUR', amount: 146 },
  'Belize': { currency: 'US Dollar', code: 'USD', amount: 119 },
  'Benin': { currency: 'Euro', code: 'EUR', amount: 113 },
  'Bolivia': { currency: 'US Dollar', code: 'USD', amount: 78 },
  'Bosnia-Herzegovina': { currency: 'Convertible Mark', code: null, amount: 154 },
  'Botswana': { currency: 'Pula', code: null, amount: 883 },
  'Brazil': { currency: 'Brazilian Real', code: null, amount: 409 },
  'Brunei': { currency: 'US Dollar', code: 'USD', amount: 88 },
  'Bulgaria': { currency: 'Euro', code: 'EUR', amount: 91 },
  'Burkina Faso': { currency: 'CFA Franc', code: null, amount: 58790 },
  'Burundi': { currency: 'Euro', code: 'EUR', amount: 67 },
  'Cambodia': { currency: 'US Dollar', code: 'USD', amount: 99 },
  'Cameroon': { currency: 'Euro', code: 'EUR', amount: 120 },
  'Canada': { currency: 'Canadian Dollar', code: null, amount: 191 },
  'Cape Verde Islands': { currency: 'Euro', code: 'EUR', amount: 65 },
  'Central African Republic': { currency: 'Euro', code: 'EUR', amount: 94 },
  'Chad': { currency: 'Euro', code: 'EUR', amount: 134 },
  'Chile': { currency: 'US Dollar', code: 'USD', amount: 106 },
  'China (People\'s Republic)': { currency: 'Yuan', code: null, amount: 803 },
  'Colombia': { currency: 'US Dollar', code: 'USD', amount: 94 },
  'Comoro Island': { currency: 'Euro', code: 'EUR', amount: 122 },
  'Cook Islands': { currency: 'New Zealand Dollar', code: null, amount: 211 },
  'Cote d\'Ivoire': { currency: 'Euro', code: 'EUR', amount: 119 },
  'Costa Rica': { currency: 'US Dollar', code: 'USD', amount: 116 },
  'Croatia': { currency: 'Euro', code: 'EUR', amount: 81 },
  'Cuba': { currency: 'US Dollar', code: 'USD', amount: 114 },
  'Cyprus': { currency: 'Euro', code: 'EUR', amount: 125 },
  'Czech Republic': { currency: 'Euro', code: 'EUR', amount: 90 },
  'Democratic Republic of Congo': { currency: 'US Dollar', code: 'USD', amount: 164 },
  'Denmark': { currency: 'Danish Krone', code: null, amount: 2328 },
  'Djibouti': { currency: 'US Dollar', code: 'USD', amount: 99 },
  'Dominican Republic': { currency: 'US Dollar', code: 'USD', amount: 106 },
  'Ecuador': { currency: 'US Dollar', code: 'USD', amount: 163 },
  'Egypt': { currency: 'Egyptian Pound', code: null, amount: 873 },
  'El Salvador': { currency: 'US Dollar', code: 'USD', amount: 98 },
  'Equatorial Guinea': { currency: 'Euro', code: 'EUR', amount: 166 },
  'Eritrea': { currency: 'US Dollar', code: 'USD', amount: 112 },
  'Estonia': { currency: 'Euro', code: 'EUR', amount: 92 },
  'Eswatini': { currency: 'RSA Rand', code: 'ZAR', amount: 1367 },
  'Ethiopia': { currency: 'US Dollar', code: 'USD', amount: 95 },
  'Fiji': { currency: 'US Dollar', code: 'USD', amount: 124 },
  'Finland': { currency: 'Euro', code: 'EUR', amount: 171 },
  'France': { currency: 'Euro', code: 'EUR', amount: 128 },
  'Gabon': { currency: 'Euro', code: 'EUR', amount: 165 },
  'Gambia': { currency: 'Euro', code: 'EUR', amount: 74 },
  'Georgia': { currency: 'US Dollar', code: 'USD', amount: 95 },
  'Germany': { currency: 'Euro', code: 'EUR', amount: 132 },
  'Ghana': { currency: 'US Dollar', code: 'USD', amount: 130 },
  'Greece': { currency: 'Euro', code: 'EUR', amount: 131 },
  'Grenada': { currency: 'US Dollar', code: 'USD', amount: 151 },
  'Guatemala': { currency: 'US Dollar', code: 'USD', amount: 114 },
  'Guinea': { currency: 'Euro', code: 'EUR', amount: 78 },
  'Guinea Bissau': { currency: 'Euro', code: 'EUR', amount: 59 },
  'Guyana': { currency: 'US Dollar', code: 'USD', amount: 118 },
  'Haiti': { currency: 'US Dollar', code: 'USD', amount: 130 },
  'Honduras': { currency: 'US Dollar', code: 'USD', amount: 186 },
  'Hong Kong': { currency: 'Hong Kong Dollar', code: null, amount: 1505 },
  'Hungary': { currency: 'Euro', code: 'EUR', amount: 83 },
  'Iceland': { currency: 'Icelandic Krona', code: null, amount: 25466 },
  'India': { currency: 'Indian Rupee', code: null, amount: 6001 },
  'Indonesia': { currency: 'US Dollar', code: 'USD', amount: 86 },
  'Iran': { currency: 'US Dollar', code: 'USD', amount: 120 },
  'Iraq': { currency: 'US Dollar', code: 'USD', amount: 125 },
  'Ireland': { currency: 'Euro', code: 'EUR', amount: 139 },
  'Israel': { currency: 'US Dollar', code: 'USD', amount: 188 },
  'Italy': { currency: 'Euro', code: 'EUR', amount: 138 },
  'Jamaica': { currency: 'US Dollar', code: 'USD', amount: 116 },
  'Japan': { currency: 'Japanese Yen', code: null, amount: 16424 },
  'Jordan': { currency: 'US Dollar', code: 'USD', amount: 201 },
  'Kazakhstan': { currency: 'US Dollar', code: 'USD', amount: 100 },
  'Kenya': { currency: 'US Dollar', code: 'USD', amount: 138 },
  'Kiribati': { currency: 'Australian Dollar', code: 'AUD', amount: 233 },
  'Korea, Republic': { currency: 'Korean Won', code: null, amount: 183824 },
  'Kuwait (State of)': { currency: 'Kuwaiti Dinar', code: null, amount: 51 },
  'Kyrgyzstan': { currency: 'US Dollar', code: 'USD', amount: 172 },
  'Laos': { currency: 'US Dollar', code: 'USD', amount: 92 },
  'Latvia': { currency: 'US Dollar', code: 'USD', amount: 150 },
  'Lebanon': { currency: 'US Dollar', code: 'USD', amount: 158 },
  'Lesotho': { currency: 'RSA Rand', code: 'ZAR', amount: 750 },
  'Liberia': { currency: 'US Dollar', code: 'USD', amount: 112 },
  'Libya': { currency: 'US Dollar', code: 'USD', amount: 120 },
  'Lithuania': { currency: 'Euro', code: 'EUR', amount: 154 },
  'Macao': { currency: 'Hong Kong Dollar', code: null, amount: 1196 },
  'Macedonia (Former Yugoslav)': { currency: 'Euro', code: 'EUR', amount: 100 },
  'Madagascar': { currency: 'Euro', code: 'EUR', amount: 59 },
  'Madeira': { currency: 'Euro', code: 'EUR', amount: 290 },
  'Malawi': { currency: 'Malawian Kwacha', code: null, amount: 31254 },
  'Malaysia': { currency: 'Ringgit', code: null, amount: 382 },
  'Maldives': { currency: 'US Dollar', code: 'USD', amount: 202 },
  'Mali': { currency: 'Euro', code: 'EUR', amount: 178 },
  'Malta': { currency: 'Euro', code: 'EUR', amount: 132 },
  'Marshall Islands': { currency: 'US Dollar', code: 'USD', amount: 255 },
  'Mauritania': { currency: 'Euro', code: 'EUR', amount: 97 },
  'Mauritius': { currency: 'Mauritian Rupee', code: null, amount: 4808 },
  'Mexico': { currency: 'Mexican Peso', code: null, amount: 1313 },
  'Moldova': { currency: 'US Dollar', code: 'USD', amount: 117 },
  'Mongolia': { currency: 'US Dollar', code: 'USD', amount: 69 },
  'Montenegro': { currency: 'Euro', code: 'EUR', amount: 90 },
  'Morocco': { currency: 'Moroccan Dirham', code: null, amount: 1115 },
  'Mozambique': { currency: 'US Dollar', code: 'USD', amount: 66 },
  'Myanmar': { currency: 'US Dollar', code: 'USD', amount: 123 },
  'Namibia': { currency: 'RSA Rand', code: 'ZAR', amount: 950 },
  'Nauru': { currency: 'Australian Dollar', code: 'AUD', amount: 278 },
  'Nepal': { currency: 'US Dollar', code: 'USD', amount: 64 },
  'Netherlands': { currency: 'Euro', code: 'EUR', amount: 122 },
  'New Zealand': { currency: 'New Zealand Dollar', code: null, amount: 216 },
  'Nicaragua': { currency: 'US Dollar', code: 'USD', amount: 90 },
  'Niger': { currency: 'Euro', code: 'EUR', amount: 78 },
  'Nigeria': { currency: 'US Dollar', code: 'USD', amount: 242 },
  'Niue': { currency: 'New Zealand Dollar', code: null, amount: 252 },
  'Norway': { currency: 'Norwegian Krone', code: null, amount: 1753 },
  'Oman': { currency: 'Omani Rial', code: null, amount: 79 },
  'Pakistan': { currency: 'Pakistani Rupee', code: null, amount: 6235 },
  'Palau': { currency: 'US Dollar', code: 'USD', amount: 252 },
  'Palestine': { currency: 'US Dollar', code: 'USD', amount: 295 },
  'Panama': { currency: 'US Dollar', code: 'USD', amount: 105 },
  'Papua New Guinea': { currency: 'Kina', code: null, amount: 285 },
  'Paraguay': { currency: 'US Dollar', code: 'USD', amount: 76 },
  'Peru': { currency: 'US Dollar', code: 'USD', amount: 139 },
  'Philippines': { currency: 'US Dollar', code: 'USD', amount: 122 },
  'Poland': { currency: 'Euro', code: 'EUR', amount: 88 },
  'Portugal': { currency: 'Euro', code: 'EUR', amount: 87 },
  'Qatar': { currency: 'Qatari Riyal', code: null, amount: 677 },
  'Republic of Congo': { currency: 'Euro', code: 'EUR', amount: 149 },
  'Reunion': { currency: 'Euro', code: 'EUR', amount: 164 },
  'Romania': { currency: 'Euro', code: 'EUR', amount: 83 },
  'Russia': { currency: 'Euro', code: 'EUR', amount: 330 },
  'Rwanda': { currency: 'US Dollar', code: 'USD', amount: 78 },
  'Samoa': { currency: 'Tala', code: null, amount: 193 },
  'Sao Tome & Principe': { currency: 'Euro', code: 'EUR', amount: 160 },
  'Saudi Arabia': { currency: 'Saudi Riyal', code: null, amount: 538 },
  'Senegal': { currency: 'Euro', code: 'EUR', amount: 128 },
  'Serbia': { currency: 'Euro', code: 'EUR', amount: 70 },
  'Seychelles': { currency: 'Euro', code: 'EUR', amount: 132 },
  'Sierra Leone': { currency: 'US Dollar', code: 'USD', amount: 90 },
  'Singapore': { currency: 'Singapore Dollar', code: null, amount: 232 },
  'Slovakia': { currency: 'Euro', code: 'EUR', amount: 105 },
  'Slovenia': { currency: 'Euro', code: 'EUR', amount: 103 },
  'Solomon Islands': { currency: 'Solomon Islands Dollar', code: null, amount: 1107 },
  'South Sudan': { currency: 'US Dollar', code: 'USD', amount: 146 },
  'Spain': { currency: 'Euro', code: 'EUR', amount: 112 },
  'Sri Lanka': { currency: 'US Dollar', code: 'USD', amount: 75 },
  'St. Kitts & Nevis': { currency: 'US Dollar', code: 'USD', amount: 164 },
  'St. Lucia': { currency: 'US Dollar', code: 'USD', amount: 215 },
  'St. Vincent & The Grenadines': { currency: 'US Dollar', code: 'USD', amount: 187 },
  'Sudan': { currency: 'US Dollar', code: 'USD', amount: 200 },
  'Suriname': { currency: 'US Dollar', code: 'USD', amount: 107 },
  'Sweden': { currency: 'Swedish Krona', code: null, amount: 1440 },
  'Switzerland': { currency: 'Swiss Franc', code: null, amount: 201 },
  'Syria': { currency: 'US Dollar', code: 'USD', amount: 185 },
  'Taiwan': { currency: 'New Taiwan Dollar', code: null, amount: 3981 },
  'Tajikistan': { currency: 'US Dollar', code: 'USD', amount: 97 },
  'Tanzania': { currency: 'US Dollar', code: 'USD', amount: 129 },
  'Thailand': { currency: 'Thai Baht', code: null, amount: 3748 },
  'Togo': { currency: 'CFA Franc', code: null, amount: 64214 },
  'Tonga': { currency: 'Pa\'anga', code: null, amount: 251 },
  'Trinidad & Tobago': { currency: 'US Dollar', code: 'USD', amount: 153 },
  'Tunisia': { currency: 'Tunisian Dinar', code: null, amount: 198 },
  'Turkey': { currency: 'Euro', code: 'EUR', amount: 75 },
  'Turkmenistan': { currency: 'US Dollar', code: 'USD', amount: 125 },
  'Tuvalu': { currency: 'Australian Dollar', code: 'AUD', amount: 339 },
  'Uganda': { currency: 'US Dollar', code: 'USD', amount: 64 },
  'Ukraine': { currency: 'Euro', code: 'EUR', amount: 131 },
  'United Arab Emirates': { currency: 'UAE Dirham', code: null, amount: 699 },
  'United Kingdom': { currency: 'Pound Sterling', code: 'GBP', amount: 114 },
  'Uruguay': { currency: 'US Dollar', code: 'USD', amount: 133 },
  'USA': { currency: 'US Dollar', code: 'USD', amount: 168 },
  'Uzbekistan': { currency: 'Euro', code: 'EUR', amount: 80 },
  'Vanuatu': { currency: 'US Dollar', code: 'USD', amount: 166 },
  'Venezuela': { currency: 'US Dollar', code: 'USD', amount: 294 },
  'Vietnam': { currency: 'US Dollar', code: 'USD', amount: 79 },
  'Yemen': { currency: 'US Dollar', code: 'USD', amount: 94 },
  'Zambia': { currency: 'US Dollar', code: 'USD', amount: 119 },
  'Zimbabwe': { currency: 'US Dollar', code: 'USD', amount: 123 },
  'Other countries not listed': { currency: 'US Dollar', code: 'USD', amount: 215 }
};

/* ── SARS AVERAGE EXCHANGE RATES (C-3, coverage-gap-analysis) ──
   Rand per 1 unit of foreign currency — the s25D(3) election a natural
   person may apply to translate foreign-currency amounts (interest,
   dividends, foreign tax paid, rental, business income, capital gains,
   the B6 catch-all, foreign pension) to Rand, as an alternative to the
   spot rate on the date of accrual/expenditure. Source: SARS "Average
   exchange rates to be used in the translation of amounts in foreign
   currencies to South African Rand", Table A ("Average exchange rates for
   a year of assessment") — docs/reference/sars-sources/Legal-Pub-AER02-
   Average-Exchange-Rates-Table-A.pdf. Keyed by this app's tax-year
   convention (year labelled by its END — e.g. "2026" = 1 Mar 2025-29 Feb
   2026), taken from Table A's "February <year>" row, the average for the
   12 months ending that Feb month-end. Only USD/GBP/EUR/AUD populated —
   the currencies most relevant to this app's user base (owner-scoped,
   2026-08-28); Table A also carries CAD/HKD/INR/JPY/CHF if extended later.
   VERIFY-GATED (W6/W20 protocol): 2027's row does not exist in Table A yet
   (that tax year hasn't closed) — left unset rather than guessed, same
   convention as SUBSISTENCE_RATES above; the conversion widget (fxApply,
   02-core.js) treats a missing year/currency as unconfirmed and asks for
   the Rand amount directly instead of computing one. */
export const FOREIGN_EXCHANGE_RATES = {
  '2025': { USD: 18.2815, GBP: 23.2887, EUR: 19.6359, AUD: 11.9622 },
  '2026': { USD: 17.4761, GBP: 23.3473, EUR: 20.1267, AUD: 11.4425 }
};

/* QR3.3: display names for the currency codes FOREIGN_EXCHANGE_RATES carries;
   the FX widgets' option lists are built from the year's rate keys (never a
   typed list), and a code with no name here falls back to the bare code. */
export const FX_CURRENCY_NAMES = { USD: 'US Dollar', GBP: 'British Pound', EUR: 'Euro', AUD: 'Australian Dollar' };

/* ITR12 filing-season deadlines — gazetted annually by SARS, not the same
   every year; only owner-confirmed years are populated (same convention as
   SUBSISTENCE_RATES above — never guess an ungazetted future year). Key is
   the tax year the deadline belongs to (SARS labels a tax year by its END,
   e.g. tax year 2026 = 1 Mar 2025 - 28 Feb 2026; its filing season runs the
   following Jul-Oct/Jan). Non-provisional taxpayers file via eFiling by
   the October date; provisional taxpayers get the extended January date.
   Source: SARS filing season notice (owner-confirmed 2026-07-18). */
export const FILING_DEADLINES = {
  '2026': { nonProvisional: '2026-10-23', provisional: '2027-01-22' }
};

/* ── IRP5/IT3(a) INCOME SOURCE CODES (3xxx series) ──
   V8.5: Restructured per SARS PAYE-AE-06-G06 Rev 13 (19 Sep 2025) + InspiredTax
   final workbook (3000_codes_basic-final2.xls).
   Groups match workbook order: Main Income Codes first (quick-pick), then
   classification groups ascending by code number within each group.
   bucket: 1=Employment, 6=Foreign income, 7=Retirement income.
   remunerationBase: Fourth Schedule par 1 flag — drives s11F(2)(c)(i) base.
   tooltip: SARS official description shown as in-app tooltip. */
export const IRP5_INCOME = [
  // ── MAIN INCOME CODES (most common — shown first in dropdown) ────────────
  {group:'Main Income Codes', code:'3601', name:'Salary / Wages (Employment)',                         cat:'salary',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'An amount paid to an employee for services rendered, excluding Long Service Cash Award (3622). Includes salary, wages, backdated pay, migrant/seasonal/scholar remuneration. Use 3651 ONLY for foreign services income.'},
  {group:'Main Income Codes', code:'3605', name:'Annual Payment (Employment)',                          cat:'bonus',     doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Annual payment, excluding Long Service Cash Award (3622). Includes annual bonus, incentive bonus, leave pay on resignation, merit awards, retention bonuses.'},
  {group:'Main Income Codes', code:'3607', name:'Overtime (Employment)',                                cat:'salary',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Overtime paid for rendering services. Tax calculated as income taxable. For 2010–2019 YA, value included in 3601/3651.'},
  {group:'Main Income Codes', code:'3701', name:'Travel (Allowances)',                                  cat:'travel',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable allowance for travel.'},
  {group:'Main Income Codes', code:'3713', name:'Other (Allowances)',                                   cat:'allowance', doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'All other taxable allowances not otherwise coded — entertainment, tool, computer, telephone, housing, taxable uniform, taxable relocation. Also covers two subsistence-specific cases: a subsistence allowance deemed to become remuneration because the employee didn’t spend the night away or refund it by the following month, and the excess of a part-day meal reimbursement (s8(1)(a)(ii)) over the SARS daily limit. (A subsistence allowance exceeding the deemed daily rate on its own has its own code, 3704.) Incorporated codes 3706/3710/3711/3712 from 2010.'},
  {group:'Main Income Codes', code:'3801', name:'General (Fringe Benefits)',                            cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'General taxable fringe benefits.'},
  {group:'Main Income Codes', code:'3810', name:'Medical Aid by Employer (Fringe Benefits)',            cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Medical aid contributions paid on behalf of employee. Use only if nature of person is A, B, C, M, N or R.'},
  {group:'Main Income Codes', code:'3817', name:'Pension Fund by Employer (Fringe Benefits)',           cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Value of taxable benefit re employer\'s pension fund contributions paid for employee\'s benefit. Maps to deduction code 4001.'},
  {group:'Main Income Codes', code:'3825', name:'Provident Fund by Employer (Fringe Benefits)',         cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Value of taxable benefit re employer\'s provident fund contributions paid for employee\'s benefit. Maps to deduction code 4003.'},
  {group:'Main Income Codes', code:'3828', name:'Retirement Annuity by Employer (Fringe Benefits)',     cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Value of taxable benefit re employer\'s RA fund contributions paid on behalf of employee (payment of employee\'s debt). Maps to deduction code 4006.'},
  // ── EMPLOYMENT / REMUNERATION (ascending by code, excludes Main codes) ──
  {group:'Employment / Remuneration', code:'3602', name:'Non-Taxable Income',                          cat:'nontaxable',doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Non-taxable income excluding foreign service remuneration. Covers war pension, capital portion of arbitration award, capital element of s10A voluntary annuity, regular loss-of-income policy payments (from 2016 YA). Codes 3604/3654, 3609/3659 and 3612/3662 incorporated from 2010.'},
  {group:'Employment / Remuneration', code:'3606', name:'Commission',                                  cat:'commission',doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'An amount paid to an employee defined as an annual payment (commission).'},
  {group:'Employment / Remuneration', code:'3608', name:'Arbitration Award',                           cat:'other',     doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable portion of a settlement agreement (court-ordered or out-of-court) re labour disputes. Requires directive type "L".'},
  {group:'Employment / Remuneration', code:'3616', name:'Independent Contractors',                     cat:'contractor',doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Remuneration paid to an independent contractor (subject to PAYE).'},
  /* W6 (PAYE-AE-06-G06 p.9, code 3617/3667 "Labour Brokers (PAYE)"): amounts paid to a labour
     broker without an IRP30 exemption certificate are "remuneration" under Fourth Schedule par 1
     — remunerationBase corrected false → true. */
  {group:'Employment / Remuneration', code:'3617', name:'Labour Brokers',                              cat:'contractor',doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Remuneration including restraint of trade [par (cA) of gross income] paid to a labour broker WITHOUT exemption certificate (IRP30). Included in the Fourth Schedule par 1 "remuneration" definition.'},
  {group:'Employment / Remuneration', code:'3620', name:'NED Director / Audit Committee Fees — RSA Resident (IT)', cat:'director', doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Directors\' / Audit Committee Members fees received by RSA resident Non-Executive Director, with voluntary PAYE withholding (not \'remuneration\'). Per Binding General Ruling 40.'},
  {group:'Employment / Remuneration', code:'3622', name:'Long Service Cash Award',                     cat:'bonus',     doc:'IRP5', bucket:1, remunerationBase:true,  longServiceAward:true, tooltip:'Long Service Award given for unbroken 15 years initial service or subsequent 10-year periods. Enter the full amount from your IRP5 — the app takes off the tax-free part itself.'},  /* copy C-93, BACKLOG 80 */
  {group:'Employment / Remuneration', code:'3623', name:'Antedated Salary / Pension',                  cat:'other',     doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Employees\' tax accrued in previous YA(s) due to settlement agreement, arbitration award or court order. Replaces use of 3907 for these scenarios from 2025 YA. Employer must apply for tax directive.'},
  /* A1 (PAYE-AE-06-G06 p.14-16): s8C codes — vesting of equity instruments and dividends re
     restricted equity instruments. All four are "(PAYE)" — subject to employees' tax, so part of
     the Fourth Schedule par 1 "remuneration" definition; taxed at marginal via the existing income
     path, no new math. */
  {group:'Employment / Remuneration', code:'3718', name:'Vesting of Equity Instruments — s8C',         cat:'equity',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Vesting of any equity instrument, or return of capital in respect of restricted equity instruments on/after 8 January 2016 (section 8C).'},
  {group:'Employment / Remuneration', code:'3719', name:'Dividends re Restricted Equity Instruments — proviso (dd) to s10(1)(k)(i)', cat:'equity', doc:'IRP5', bucket:1, remunerationBase:true, tooltip:'Dividends on a restricted equity instrument (s8C) acquired in s8C circumstances, not falling within the s10(1)(k)(i) proviso (dd) exclusions. Applicable from the 2018 YA.'},
  {group:'Employment / Remuneration', code:'3720', name:'Dividends re Services/Employment — proviso (ii) to s10(1)(k)(i)', cat:'equity', doc:'IRP5', bucket:1, remunerationBase:true, tooltip:'Dividend received in respect of services rendered or employment/office held, other than one re a restricted equity instrument or share held by that person. Applicable from the 2018 YA.'},
  {group:'Employment / Remuneration', code:'3721', name:'Dividends re Restricted Equity Instruments — proviso (jj) to s10(1)(k)(i)', cat:'equity', doc:'IRP5', bucket:1, remunerationBase:true, tooltip:'Dividend on a restricted equity instrument (s8C) that derives from a share buy-back/redemption consideration, a winding-up/liquidation distribution, or an equity instrument that ceased to be restricted. Applicable from the 2018 YA.'},
  // ── PENSION & ANNUITY (Bucket 7 — Retirement income; IT3(a) fund-issued) ─
  {group:'Pension & Annuity',         code:'3610', name:'Annuity from RAF',                            cat:'pension',   doc:'IRP5', bucket:7, remunerationBase:true,  tooltip:'Annuity paid regularly by a retirement annuity fund and/or compulsory purchased annuity from a long-term insurer. Incorporated into 3601/3651 for YA 2010–2012.'},
  {group:'Pension & Annuity',         code:'3611', name:'Purchased Annuity',                           cat:'pension',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Taxable portion of a purchased annuity paid by a long-term insurer (not from a retirement fund). s10A capital portion of annuity excluded — that goes under 3602.'},
  {group:'Pension & Annuity',         code:'3618', name:'Annuity from Provident / Provident Preservation Fund', cat:'pension', doc:'IRP5', bucket:7, remunerationBase:true, tooltip:'Qualifying annuity paid regularly from a provident or provident preservation fund. Applicable from the 2021 YA.'},
  // ── ALLOWANCES (ascending by code, excludes Main codes 3701/3713) ────────
  {group:'Allowances',                code:'3702', name:'Reimbursive Travel — Taxable',                cat:'travel',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable reimbursive travel allowance: applies where the rate paid exceeds the SARS prescribed rate (R4.95/km for 2026/27; R4.76/km for 2025/26), OR where the employee also receives another travel allowance (3701). Amount feeds the s8(1)(b) deduction pool. See 3722 for the taxable-excess split, and 3703 for the non-taxable portion.'},
  {group:'Allowances',                code:'3703', name:'Reimbursive Travel — Non-Taxable',            cat:'nontaxable',doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Non-taxable reimbursive travel allowance: applies where the rate does not exceed the SARS prescribed rate (R4.95/km for 2026/27; R4.76/km for 2025/26) AND no other travel allowance is received. Excluded from the s8(1)(b) travel deduction pool. Capture for IRP5 completeness only.'},
  {group:'Allowances',                code:'3704', name:'Subsistence Allowance — Local Travel',        cat:'allowance', doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Subsistence allowance for meals/incidentals on local travel EXCEEDING SARS deemed amounts.'},
  /* PAYE-GEN-01-G03 review (2026-08-28): a genuine gap — this code was
     entirely absent from the code table, so a public-office holder
     (President, Ministers, MPs, provincial/municipal councillors,
     traditional leaders, certain national NPO chairs) had no way to
     capture it without being forced into a mismatched code. s8(1)(d)/(f):
     only 50% of the allowance is subject to PAYE withholding, but that is
     an employer payroll mechanic — the FULL amount is still ordinary
     taxable income on assessment (the guide's own worked examples compute
     "employees' tax deductible", not an exemption), so this needs no
     special split here — remunerationBase:true, full amount taxed, same
     as any other 'allowance' cat code. */
  {group:'Allowances',                code:'3708', name:'Public Office Allowance',                     cat:'allowance', doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Allowance to a holder of a public office (President, Ministers, MPs, provincial/municipal councillors, traditional leaders, certain national NPO chairs) to defray official expenditure — s8(1)(d)/(f). Only 50% of this is subject to PAYE withholding by the payer, but the full amount is ordinary taxable income on your annual assessment.'},
  {group:'Allowances',                code:'3722', name:'Reimbursive Travel — Taxable Excess',         cat:'travel',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable portion of a reimbursive travel allowance where the rate paid exceeds the SARS prescribed rate (R4.95/km for 2026/27; R4.76/km for 2025/26) — the excess above the prescribed rate. Often used alongside 3703 (non-taxable portion at/below the rate). Amount feeds the s8(1)(b) deduction pool.'},
  {group:'Allowances',                code:'3714', name:'Non-Taxable Allowance',                       cat:'nontaxable',doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'All other non-taxable allowances (non-taxable relocation, subsistence within limits, non-taxable uniform). Incorporated codes 3705/3709/3716 from 2010.'},
  /* PAYE-GEN-01-G03 review (2026-08-28): another genuine gap alongside
     3708 — 3715 (the foreign counterpart of 3704) was also entirely
     absent, so a foreign-subsistence allowance exceeding the deemed
     per-country amount had no correct code to capture it under. */
  {group:'Allowances',                code:'3715', name:'Subsistence Allowance — Foreign Travel',      cat:'allowance', doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Subsistence allowance for meals/incidentals on foreign travel EXCEEDING the SARS deemed per-country amount.'},
  {group:'Allowances',                code:'3717', name:'Broad-Based Employee Share Plan — s8B',       cat:'equity',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Amount from disposal of qualifying equity share or interest under s8B broad-based plan.'},
  // ── FRINGE BENEFITS (ascending by code, excludes Main codes 3801/3810/3817/3825/3828) ─
  {group:'Fringe Benefits',           code:'3802', name:'Use of Motor Vehicle',                        cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Right of use of motor vehicle acquired by employer NOT under operating lease.'},
  {group:'Fringe Benefits',           code:'3805', name:'Accommodation',                               cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Free or cheap accommodation, including holiday accommodation, provided by the employer.'},
  {group:'Fringe Benefits',           code:'3808', name:"Employee's Debt",                             cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Payment of employee\'s debt or release from obligation. Excludes 3828 (employer-paid RA). Included in 3801/3851 for YA 2010–2012.'},
  {group:'Fringe Benefits',           code:'3813', name:'Medical Services Costs',                      cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Medical costs incurred for employee re medical, dental, similar services, hospital/nursing services or medicine.'},
  {group:'Fringe Benefits',           code:'3816', name:'Use of Motor Vehicle — Operating Lease',      cat:'fringe',    doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable benefit re right of use of a motor vehicle acquired by the employer under an "operating lease." Valid from the 2014 YA.'},
  {group:'Fringe Benefits',           code:'3820', name:'Taxable Bursary — Non-Disabled — Further Education', cat:'fringe', doc:'IRP5', bucket:1, remunerationBase:true,  tooltip:'Taxable bursaries to non-disabled person re Further Education (NQF 5–10).'},
  {group:'Fringe Benefits',           code:'3821', name:'Non-Taxable Bursary — Non-Disabled — Further Education', cat:'nontaxable', doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Non-taxable bursaries/scholarships to non-disabled person re Further Education — s10(1)(q) exempt portion.'},
  {group:'Fringe Benefits',           code:'3822', name:'Non-Taxable Benefit — Acquisition of Immovable Property', cat:'nontaxable', doc:'IRP5', bucket:1, remunerationBase:false, tooltip:'Non-taxable benefit on acquisition of immovable property at less than actual value (specific s10 exemption).'},
  // ── LUMP SUMS (Bucket 7 — Retirement income; employer-issued but s5(10) tax tables) ─
  {group:'Lump Sums',                 code:'3901', name:'Gratuities / Severance Benefits',             cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Severance benefits if employee: ≥ 55 years, permanently incapable due to ill health, or services terminated due to retrenchment/employer ceased trading. Lump sums NOT meeting severance definition go under 3907.'},
  {group:'Lump Sums',                 code:'3915', name:'Retirement / Termination Lump Sum / Commutation of Annuities', cat:'lumpsum', doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Lump sum from pension/pension preservation/RA/provident/provident preservation fund re retirement/death (post 1 Oct 2007). Includes retrenchment lump sums per 2nd Sch par 2(1)(a)(ii)(AA) or (BB). Includes commutation of annuity post 1 March 2011.'},
  {group:'Lump Sums',                 code:'3920', name:'Lump Sum Withdrawal Benefits',                cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Lump sum from pension/PA/RA/provident/PP fund re withdrawal post 28 Feb 2009 (resignation, transfer, divorce, housing loan, immigration, visa expiry). Living-annuity-to-living-annuity transfers also here.'},
  {group:'Lump Sums',                 code:'3921', name:'Living Annuity & Surplus Apportionments',     cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Lump sum from withdrawal due to: s15C Pension Funds Act surplus apportionments; living annuity withdrawal pre-1 March 2011 (post 1 March 2011 use 3915).'},
  {group:'Lump Sums',                 code:'3924', name:'Transfer on Retirement',                      cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Transfer of retirement benefit on or after normal retirement age but before retirement date — Pension/Provident → RA Fund (per 2nd Sch par 2(1)(c)).'},
  /* A2 (PAYE-AE-06-G06 p.23, code 3907/3957 "Other lump sums (Subject to PAYE)"): normal-termination
     gratuities/lump sums NOT meeting the severance-benefit definition (3901), unapproved-fund lump
     sums, and untaxed employer-owned risk/other policy proceeds — cat:'lumpsum' excludes it from
     the marginal-income base; use the Retirement module's lump-sum calculator instead. */
  {group:'Lump Sums',                 code:'3907', name:'Other Lump Sums',                             cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Lump sum paid on normal termination of service (e.g. resignation, or retirement below age 55) that does NOT meet the severance-benefit definition (see 3901); lump sums from unapproved funds; proceeds from an employer-owned insurance policy where premiums were not taxed as a fringe benefit. Taxed on the SARS lump-sum tables — capture under Retirement → Lump sums, not here.'},
  /* A2 (PAYE-AE-06-G06 p.25, code 3922 "Compensation i.e., death during employment (Excl./PAYE)"):
     lump sum from a compensation fund on withdrawal after death, s10(1)(gB)(iii). PAYE deductible
     if the amount exceeds R300,000 — same lump-sum-table treatment as other retirement lump sums. */
  {group:'Lump Sums',                 code:'3922', name:'Compensation — Death During Employment',      cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Lump sum paid from a compensation fund on withdrawal after death during employment, s10(1)(gB)(iii). PAYE deductible only where the amount exceeds R300,000. Taxed on the SARS lump-sum tables — capture under Retirement → Lump sums, not here.'},
  {group:'Lump Sums',                 code:'3926', name:'Savings Withdrawal Benefit — Two-Pot',        cat:'lumpsum',   doc:'IRP5', bucket:7, remunerationBase:false, tooltip:'Withdrawal from Savings Component/Pot per "savings withdrawal benefit" definition (s1) and "gross income" par (eD), 2nd Sch par 6B, 4th Sch par 9(3)(a).'},
  // ── FOREIGN SERVICE (Bucket 6 — Foreign income; SA employer, services outside SA) ─
  {group:'Foreign Service',           code:'3651', name:'Salary / Wages (Foreign Service)',            cat:'salary',    doc:'IRP5', bucket:6, remunerationBase:true,  tooltip:'Salary or wages paid by a South African employer for services rendered outside South Africa. Use instead of 3601 for foreign-service remuneration. The s10(1)(o)(ii) exemption (R1.25m threshold, 183/60-day rule) may reduce or fully exempt this amount.'},
  /* W6/W20 (PAYE-AE-06-G06 p.7-8): 3652 is "Income (Non-taxable)" foreign-service equivalent of
     3602, NOT commission; 3653 is "Pension (Subject to PAYE)" foreign-service equivalent of 3603,
     NOT an annual payment. The foreign-service equivalents of 3606 (Commission) and 3605 (Annual
     Payment) are 3656 and 3655 respectively — replacing the two mislabeled entries below. */
  {group:'Foreign Service',           code:'3656', name:'Commission (Foreign Service)',                cat:'commission',doc:'IRP5', bucket:6, remunerationBase:true,  tooltip:'Commission paid by a South African employer for services rendered outside South Africa. Foreign-service equivalent of 3606. The s10(1)(o)(ii) exemption may apply.'},
  {group:'Foreign Service',           code:'3655', name:'Annual Payment (Foreign Service)',            cat:'bonus',     doc:'IRP5', bucket:6, remunerationBase:true,  tooltip:'Annual payment (bonus, incentive, leave pay) paid by a South African employer for services rendered outside South Africa. Foreign-service equivalent of 3605. The s10(1)(o)(ii) exemption may apply.'}
];

/* S3 Batch 8/13 (C10/D6/D7): canonical short name per IRP5 code — the ONE
   source both the source-code dropdown (D6, populateIncomeCodes()) and the
   captured-row list (D7, renderIncomeList(), 03-income.js) read, so they
   can never drift apart. IRP5_INCOME's own `name` field is the full SARS
   wording (needed for the tooltip and the audit trail) — often carrying a
   redundant "(Employment)"/"(Fringe Benefits)"/"(Allowances)" group suffix
   (the code's own `group` already says that), a taxability suffix
   ("— Taxable"/"— Non-Taxable"/"— Taxable Excess"), or an Act/section
   citation ("— s8C", "— proviso (dd) to s10(1)(k)(i)") — all things D6
   asks to drop from the compact, code-only, no-vertical-space UI these two
   surfaces need. Where dropping a taxability suffix or Act reference would
   make two DIFFERENT codes read identically (e.g. 3702/3703/3722, all
   "Reimbursive Travel"; 3719/3721, both "Restricted Equity Dividend"), that
   collision is accepted per D6's literal instruction — the code number
   still disambiguates them in the dropdown row (D6 keeps `code + ' - ' +
   short`), and simultaneously capturing more than one variant of the same
   allowance is the rare case, not the common one this compacting serves.
   ONE deliberate exception to "no bracketed text": the Foreign Service
   trio (3651/3655/3656) keeps "(Foreign)" — stripping it would make a
   foreign-employment row read identically to its LOCAL counterpart
   (3601/3605/3606) on the captured-row list where C10 hides the code
   entirely, which is a correctness-adjacent problem (S3 Batch 6 just
   added FX-currency capture specifically for these codes) that outweighs
   the "no brackets" rule for this one case. Covers every IRP5_INCOME
   code, not just the 5 groups the general picker curates — captured data
   can carry a Pension & Annuity or Lump Sum code from before those were
   split into their own dedicated modals (RR v8.9.1/task #17), and D7's
   list must still render those rows without falling back to the long
   SARS name. */
export const INCOME_CODE_SHORT = {
  '3601':'Salary/Wages', '3605':'Annual Payment', '3607':'Overtime',
  '3701':'Travel Allowance', '3713':'Other Allowance',
  '3801':'General Fringe Benefit', '3810':'Medical Aid Fringe Benefit',
  '3817':'Pension Fund Fringe Benefit', '3825':'Provident Fund Fringe Benefit',
  '3828':'RA Fringe Benefit',
  '3602':'Non-Taxable Income', '3606':'Commission', '3608':'Arbitration Award',
  '3616':'Independent Contractor', '3617':'Labour Broker',
  '3620':'Director/Audit Fees', '3622':'Long Service Award',
  '3623':'Antedated Salary/Pension', '3718':'Equity Instrument Vesting',
  '3719':'Restricted Equity Dividend', '3720':'Services/Employment Dividend',
  '3721':'Restricted Equity Dividend',
  '3702':'Reimbursive Travel', '3703':'Reimbursive Travel',
  '3704':'Subsistence Allowance (Local)', '3708':'Public Office Allowance',
  '3722':'Reimbursive Travel', '3714':'Non-Taxable Allowance',
  '3715':'Subsistence Allowance (Foreign)', '3717':'Employee Share Plan',
  '3802':'Motor Vehicle Use', '3805':'Accommodation', '3808':"Employee's Debt",
  '3813':'Medical Services', '3816':'Motor Vehicle (Lease)',
  '3820':'Taxable Bursary', '3821':'Non-Taxable Bursary',
  '3822':'Immovable Property Benefit',
  '3610':'RAF Annuity', '3611':'Purchased Annuity', '3618':'Provident Annuity',
  '3901':'Severance Benefit', '3915':'Retirement Lump Sum',
  '3920':'Withdrawal Lump Sum', '3921':'Living Annuity/Surplus',
  '3924':'Retirement Transfer', '3907':'Other Lump Sum',
  '3922':'Death Compensation', '3926':'Two-Pot Withdrawal',
  '3651':'Salary/Wages (Foreign)', '3656':'Commission (Foreign)',
  '3655':'Annual Payment (Foreign)'
};

/* ── QR8: IT3(b) certificate lines, for the code picker (QX-COD-1) ──
   One row per amount line an IT3(b) can carry. `row` is the id of the form
   row the line reveals (the field itself is the row id minus "-row"), `foreign`
   marks the lines of the certificate's foreign half (offered only for the
   foreign kinds, gated by `foreign:investments`, QR7; UI-CAP-1), `group` is the picker's category header, and
   `pair` is a second row the line always brings with it (the s6quat foreign
   tax withheld on that same income). Codes are the SARS source codes printed
   on the certificate (IT-AE-36-G05). Consumer: the IT3(b) modal's
   "Add an amount" pickers (QR9a, 00-forms.js CFG_IT3B + it3bSyncLines). */
export const IT3B_CODES = [
  { group:'Local investment income', code:'4201', name:'Local interest',                           row:'it3b-local-interest-row',      foreign:false },
  { group:'Local investment income', code:'4237', name:'SARS refund interest',                      row:'it3b-sars-interest-row',       foreign:false },
  { group:'Local investment income', code:'4214', name:'Other Receipts and Accruals \u2013 Profit', row:'it3b-reit-row',                foreign:false },
  { group:'Local investment income', code:'4215', name:'Other Receipts and Accruals \u2013 Loss',   row:'it3b-other-loss-row',          foreign:false },
  { group:'Local investment income', code:'4306', name:'Exempt local dividends',                    row:'it3b-local-div-exempt-row',    foreign:false },
  /* 4238 and 4292 per SARS IT-AE-36-G05 rev 39 (19 Aug 2025) §6.1.6 'Distribution
     from a REIT / Taxable Local Dividends' and §6.1.7 'Dividends deemed to be
     income in terms of s8E and s8EA'. The s8E/8EA line printed 4238 until
     2026-10-02 and the form had no REIT line at all (owner decision, same day:
     relabel to G05, add the 4238 line). WR-10. */
  { group:'Local investment income', code:'4238', name:'Distribution from a REIT / taxable local dividends', row:'it3b-reit-dividends-row', foreign:false },
  { group:'Local investment income', code:'4292', name:'Dividends deemed to be income (s8E/8EA)',   row:'it3b-local-div-taxable-row',   foreign:false },
  { group:'Foreign investment income', code:'4218', name:'Foreign interest',                        row:'it3b-foreign-interest-row',    foreign:true, pair:'it3b-foreign-tax-int-row' },
  { group:'Foreign investment income', code:'4216', name:'Foreign dividends',                       row:'it3b-foreign-dividends-row',   foreign:true, pair:'it3b-foreign-tax-div-row' },
  { group:'Foreign investment income', code:'4114', name:'Foreign capital gains',                   row:'it3b-foreign-cgt-row',         foreign:true  }
];

/* ── IRP5 CODE LOOKUP (built once, reused) ──
   Lives in the data layer beside the table it indexes: 01-data ↔ 02-core is
   an import cycle, so building this in 02-core would evaluate before
   IRP5_INCOME initializes (the one eval-time order hazard of the ESM split). */
export const IRP5_CODE_MAP = (() => {
  const m = new Map();
  IRP5_INCOME.forEach(c => m.set(c.code, c));
  return m;
})();

/* INC-17 (design-system-audit-2026-09 §L.4, item 0b-3): the "Still to add"
   checklist needs to answer "has this user captured ANY employment income?",
   not "has this user captured a 3601 salary?". `cat` cannot answer it — the
   values 'salary', 'bonus' and 'commission' each appear under BOTH bucket 1
   (local employment) and bucket 6 (foreign employment), so a cat-based test
   would count a foreign salary as local employment and clear the wrong flag.
   Bucket 1 is the taxonomy's own definition of employment income, so the
   index is keyed by source code, where the bucket is unambiguous.
   Owner decision 6.8 rides on this: a pure-IRP5 commission (3606) or
   independent-contractor (3616) earner counts as employment here, and —
   because getIncomeOutstanding()'s business check already accepts those two
   categories — a person who also runs an unincorporated business has either
   capture clear both flags, which is decision 6.8's branch C. */
export const EMPLOYMENT_INCOME_CODES = new Set(
  IRP5_INCOME.filter(c => c.bucket === 1).map(c => c.code));

/* BACKLOG 24 (ITR12 code audit, WR-8): the foreign-service remuneration codes
   — the ONE answer to "is this IRP5 line pay for services rendered outside
   SA?", read by the s10(1)(o)(ii) exemption, the foreign-employment tab, the
   local/foreign split, the source breakdown and the duplication check. Bucket
   6 of IRP5_INCOME is exactly the Foreign Service group (3651/3655/3656 —
   PAYE-AE-06-G06 rev 13 p.7-9, the bracketed "+50" codes). Before this, five
   hand-typed lists disagreed: two omitted 3655/3656, so a foreign bonus or
   commission alone never opened the exemption question; all five carried
   3652 (non-taxable income, not remuneration) and 3653 (pension), which the
   picker cannot capture and DATA-1 means no saved record holds. */
export const FOREIGN_SERVICE_CODES = new Set(
  IRP5_INCOME.filter(c => c.bucket === 6).map(c => c.code));

/* ── ITR12 OTHER INCOME SOURCE CODES (4xxx series) ──
   For income that NEVER appears on an IRP5 — declared by the taxpayer
   on their ITR12. Verified against SARS IT-AE-36-G05 Comprehensive Guide
   to the ITR12 Income Tax Return for Individuals. */
/* ── ITR12 OTHER INCOME SOURCE CODES (4xxx / 0xxx series) ──
   V8.5: Bucket tags added; 4220 corrected; CGT codes, foreign rental codes,
   SARS interest and additional codes added from IT-AE-36-G05 Rev 39.
   Bucket-specific sub-codes (royalties) will be added
   per bucket subpage implementation sessions (Batch 2+). */
export const ITR12_OTHER_INCOME = [
  // ── BUCKET 2: Investment income (IT3(b) certificate or self-declared) ────
  {group:'Investment',  code:'4201', name:'Local interest received',                              cat:'interest_local',         bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4214', name:'Other income (other receipts and accruals)',           cat:'reit',                   bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4216', name:'Foreign dividends — gross (s10B exemption applies)',   cat:'dividend_foreign',       bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4218', name:'Foreign interest',                                     cat:'interest_foreign',       bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4237', name:'SARS interest on refunds',                             cat:'interest_local',         bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4238', name:'Distribution from a REIT / taxable local dividends',   cat:'dividend_local_taxable', bucket:2, doc:'IT3(b)'},
  {group:'Investment',  code:'4292', name:'Dividends deemed to be income (s8E/s8EA)',             cat:'dividend_local_taxable', bucket:2, doc:'IT3(b)'},
  // ── BUCKET 3: Rental income ───────────────────────────────────────────────
  {group:'Rental',      code:'4210', name:'Local rental income — fixed property (net)',           cat:'rental_local',           bucket:3, doc:'ITR12'},
  {group:'Rental',      code:'4288', name:'Foreign rental income — profit',                       cat:'rental_foreign_profit',  bucket:3, doc:'ITR12'},
  {group:'Rental',      code:'4289', name:'Foreign rental income — loss',                         cat:'rental_foreign_loss',    bucket:3, doc:'ITR12'},
  // ── BUCKET 4: Business / Freelance (core codes; royalties/other added in Batch 3) ─
  {group:'Business',    code:'4222', name:'Local business / trading — profit (excl. rental)',     cat:'business_local',         bucket:4, doc:'ITR12'},
  {group:'Business',    code:'4223', name:'Local business / trading — loss (excl. rental)',       cat:'business_loss',          bucket:4, doc:'ITR12'},
  {group:'Business',    code:'4221', name:'Foreign business / trading — profit',                  cat:'business_foreign',       bucket:4, doc:'ITR12'}, // Verify code: may be superseded by 4222+foreign flag
  // ── BUCKET 5: Capital gains (CGT schedule) ───────────────────────────────
  {group:'CGT',         code:'4250', name:'Local capital gain',                                   cat:'cgt_local_gain',         bucket:5, doc:'ITR12'},
  {group:'CGT',         code:'4251', name:'Local capital loss',                                   cat:'cgt_local_loss',         bucket:5, doc:'ITR12'},
  {group:'CGT',         code:'4252', name:'Foreign capital gain',                                 cat:'cgt_foreign_gain',       bucket:5, doc:'ITR12'},
  {group:'CGT',         code:'4253', name:'Foreign capital loss',                                 cat:'cgt_foreign_loss',       bucket:5, doc:'ITR12'},
  // ── BUCKET 6: Foreign income ─────────────────────────────────────────────
  {group:'Foreign',     code:'4220', name:'Other foreign income — various',                       cat:'foreign_other',          bucket:6, doc:'ITR12'}, // Was incorrectly named "foreign rental" in V8.4
  {group:'Foreign',     code:'4298', name:'Foreign employment income (non-IRP5, s10(1)(o)(ii) n/a)', cat:'foreign_employment', bucket:6, doc:'ITR12'},
  {group:'Foreign',     code:'4304', name:'Foreign employment income (non-IRP5, s10(1)(o)(i) n/a)',  cat:'foreign_employment', bucket:6, doc:'ITR12'},
  // ── TAX CREDITS (informational — applied as credits, not income) ──────────
  {group:'Tax Credits', code:'4112', name:'Foreign tax credit on foreign dividends',              cat:'foreign_tax_credit',     bucket:2, doc:'IT3(b)'},
  {group:'Tax Credits', code:'4113', name:'Foreign tax credit on foreign interest',               cat:'foreign_tax_credit',     bucket:2, doc:'IT3(b)'},
  {group:'Tax Credits', code:'4114', name:'Foreign tax credit on foreign capital gains',          cat:'foreign_tax_credit',     bucket:5, doc:'ITR12'},
  {group:'Tax Credits', code:'4121', name:'Foreign tax credit on foreign rental income',          cat:'foreign_tax_credit',     bucket:3, doc:'ITR12'},
  {group:'Tax Credits', code:'4111', name:'Other foreign tax credits',                            cat:'foreign_tax_credit',     bucket:6, doc:'ITR12'}
];

/* ── IRP5/IT3(a) DEDUCTION CODES (4xxx employer-side series) ──
   Codes that appear on the EMPLOYER-issued IRP5 in the deductions section. */
export const IRP5_DEDUCTIONS = [
  {group:'Retirement (Employer)', code:'4001', name:'Pension fund — current contribution',                   type:'retirement_employer'},
  {group:'Retirement (Employer)', code:'4002', name:'Arrear pension fund contribution',                      type:'retirement_employer'},
  {group:'Retirement (Employer)', code:'4003', name:'Provident fund (incl. former 4004)',                    type:'retirement_employer'},
  {group:'Retirement (Employer)', code:'4006', name:'Retirement annuity fund (RAF) — current',               type:'retirement_employer'},
  {group:'Retirement (Employer)', code:'4007', name:'Arrear RAF contribution',                                type:'retirement_employer'},
  /* 4042 is not a retirement code: an s11(nA)/(nB) refund of remuneration
     (or a restraint-of-trade amount) to the employer, deducted under those
     sections (IT-AE-36-G05 rev 40, "Section 11(nA) and 11(nB)" — 4042 on the
     IRP5, claimed via 4588/4589 from the 2026 year). It is the one code here
     that is claimed on the Other claims sheet (BACKLOG 24). */
  {group:'Other claims',          code:'4042', name:'s11(nA)/(nB) refund to employer (recoupment of overpaid remuneration)', type:'other_claim'},
  {group:'Medical (Employer)',    code:'4005', name:'Medical scheme — employee contribution',                type:'medical_employer'},
  {group:'Medical (Employer)',    code:'4474', name:'Medical scheme — employer contribution',                type:'medical_employer'},
  {group:'Donations',             code:'4030', name:'Donations to PBOs deducted by employer (s18A)',         type:'donation_employer'},
  {group:'PAYE',                  code:'4101', name:'SITE (historical, pre-2014)',                            type:'paye_historical'},
  {group:'PAYE',                  code:'4102', name:'PAYE deducted',                                          type:'paye'},
  {group:'PAYE',                  code:'4115', name:'PAYE on lump sum',                                       type:'paye_lumpsum'},
  {group:'PAYE',                  code:'4116', name:'Medical scheme fees tax credit (per PAYE reconciliation, informational)', type:'mtc_paye_info'},
  {group:'Historical',            code:'4018', name:'Income protection premiums (deductible 2006–2015 only)', type:'historical'}
];

/* BACKLOG 24 (ITR12 code audit): the Other claims sheet (M_deductionCode)
   offers every IRP5_DEDUCTIONS code, and the engine used to deduct each one
   in full (only 4116 was skipped). A user copying the IRP5 deductions block
   would have deducted their PAYE (4102) from income, taken retirement
   contributions past the s11F cap, turned medical scheme contributions —
   a s6A credit, not a deduction — into a deduction, and bypassed the s18A
   10 % limit. Every type except 'other_claim' belongs elsewhere: the sheet
   refuses it with this message, and calcFullTax() ignores it (one test,
   deductionCodeRoute()). Law: s11F (retirement), s6A/s6B (medical), s18A
   (donations); PAYE/SITE is tax paid, credited against the liability, not
   deducted (Fourth Schedule par 28); 4018 is valid 2006–2015 only
   (PAYE-AE-06-G06 rev 13 p.4) — income protection premiums are not
   deductible from the 2016 year. */
export const DEDUCTION_CODE_ROUTES = {
  retirement_employer: 'Capture this under Deductions → Retirement Fund Contributions, where the yearly limit is applied.',
  medical_employer:    'Capture this under Deductions → Medical Expenses. Medical aid gives you a tax credit, not a deduction.',
  donation_employer:   'Capture this under Deductions → Donations to Approved PBOs, where the limit is applied.',
  paye:                'This is tax already paid, not a deduction. Capture it under Income → PAYE.',
  paye_historical:     'This is tax already paid, not a deduction. Capture it under Income → PAYE.',
  paye_lumpsum:        'This is tax already paid on a lump sum. Capture it with the lump sum under Retirement → Lump sums.',
  mtc_paye_info:       'Nothing to capture — this figure is for information. Your medical credit is worked out from Deductions → Medical Expenses.',
  historical:          'Income protection premiums can no longer be claimed.'
};
export function deductionCodeRoute(code) {
  const def = code ? IRP5_DEDUCTIONS.find(x => x.code === code) : null;
  return def ? (DEDUCTION_CODE_ROUTES[def.type] || null) : null;
}


/* QR3.2 (Q-INV-5) · one explanatory note for the s10(1)(i) interest exemption,
   shown in the IT3(b) local half and foreign half (UI-CAP-1). The thresholds are read
   from the year's TAX_YEARS entry (`ty.interest`) — never typed here.
   Law (WR-10): s10(1)(i) exempts interest from a source WITHIN the Republic
   only; foreign interest is fully taxable and never uses up the local
   allowance — do NOT pool the two (SARS, "Interest and dividends",
   sars.gov.za/tax-rates/income-tax/interest-and-dividends/; ITR12 guide
   IT-AE-36-G05 §6.1: foreign interest and dividends are not exempt under
   this section). `applied` is calcFullTax().intExempt — engine output, not
   recomputed here (hard rule 2). `fmtRand` is passed in (this module cannot
   import the formatter — hard rule 10). Returns plain text. */
export function interestExemptionNote(ty, age65Plus, scope, applied, fmtRand) {
  const limit = age65Plus ? ty.interest.age65 : ty.interest.under65;
  if (scope === 'foreign') {
    return 'Foreign interest is fully taxable and the exemption does not apply.';
  }
  const base = 'Local interest is exempt up to ' + fmtRand(limit) + ' a year.';
  return applied > 0
    ? base + ' So far ' + fmtRand(applied) + ' of your saved local interest is exempt this year.'
    : base;
}

/* ── TAX ACT REFERENCE SECTIONS ── */
export const ACT_REFERENCES = [
  {code:'s6',name:'Personal Tax Rebates',content:'A rand-for-rand reduction in tax liability (not a deduction from income).<br><strong>Primary Rebate:</strong> <span class="act-ref-highlight" id="ref-primary-rebate"></span> — All taxpayers.<br><strong>Secondary Rebate:</strong> <span class="act-ref-highlight" id="ref-secondary-rebate"></span> — Age 65 to 74.<br><strong>Tertiary Rebate:</strong> <span class="act-ref-highlight" id="ref-tertiary-rebate"></span> — Age 75+.<br><br>Applied after bracket tax calculation. Tax-free threshold = total applicable rebates \u00f7 18%.'},
  {code:'s6A',name:'Medical Scheme Fees Tax Credit',content:'A rand-for-rand credit against tax payable — not a deduction from income.<br><strong>Monthly credits:</strong> Main member: <span class="act-ref-highlight" id="ref-med-main"></span>/mo · First dependant: <span class="act-ref-highlight" id="ref-med-d1"></span>/mo · Additional: <span class="act-ref-highlight" id="ref-med-dn"></span>/mo each<br><br>Applies regardless of whether employer or employee pays.'},
  {code:'s6B',name:'Additional Medical Expenses Tax Credit',content:'Relief for qualifying medical expenses exceeding s6A threshold.<br><strong>Under 65, no disability:</strong> 25% \u00d7 Max(0, [Max(0, contributions \u2212 4 \u00d7 s6A credit) + out-of-pocket expenses] \u2212 7.5% \u00d7 taxable income)<br><strong>Age 65+ or disability:</strong> 33.3% \u00d7 [Max(0, contributions \u2212 3 \u00d7 s6A credit) + out-of-pocket expenses] \u2014 no 7.5%-of-taxable-income threshold<br><br><strong>Qualifying =</strong> all contributions (employee + employer) + unreimbursed OOP expenses.'},
  {code:'s10(1)(i)',name:'Interest Exemption',content:'Local interest exempt from normal tax:<br><strong>Under 65:</strong> <span class="act-ref-highlight" id="ref-int-u65"></span>/year · <strong>Age 65+:</strong> <span class="act-ref-highlight" id="ref-int-o65"></span>/year<br><br>Foreign interest is not exempt. TFSA interest is exempt under s12T.'},
  {code:'s10(1)(k)',name:'Dividends Exemption',content:'Local dividends received by individuals are exempt from normal tax. DWT of 20% is withheld at source. Foreign dividends are taxable but s6quat credit may apply.'},
  {code:'s11F',name:'Retirement Fund Contributions',content:'Allowable deduction: lesser of 27.5% of the greater of remuneration or taxable income, OR <span class="act-ref-highlight" id="ref-ret-cap"></span> per year.<br>Prior year excess increases current year capacity.<br>Excess carried forward indefinitely. Unified regime since 1 March 2016.'},
  {code:'s12T',name:'Tax-Free Investments',content:'All returns within a tax-free investment are fully exempt; transfers between your own tax-free investments are not contributions (s12T(6)).<br><strong>Annual:</strong> <span class="act-ref-highlight" id="ref-tfsa-annual"></span> · <strong>Lifetime:</strong> <span class="act-ref-highlight" id="ref-tfsa-life"></span><br>' + Math.round(S12T_EXCESS_CHARGE_RATE * 100) + '% of contributions over either limit is added to your tax (s12T(7)).'},
  {code:'s18A',name:'Donations to Approved PBOs',content:'Deductible up to <strong>10% of taxable income</strong> (before the donation deduction, after all other deductions).<br>Valid s18A receipt required. Excess carried forward indefinitely as a deemed next-year donation under the s18A(1) proviso, re-capped at 10% each year, until fully used.'},
  {code:'s23(b)',name:'Home Office Deduction',content:'Requirements: (1) Specifically equipped; (2) Regular and exclusive use; (3) Employees need employer confirmation; (4) >50% of duties performed there.<br><strong>Deduction =</strong> (office area \u00f7 total area) \u00d7 (WFH days \u00f7 working days) \u00d7 qualifying costs + 100% direct costs<br><strong>CGT:</strong> Office portion may not qualify for primary residence exclusion on sale.'},
  {code:'s8(1)(b)',name:'Travel Allowance Deduction',content:'If you receive a travel allowance (code 3701), the business portion is deductible:<br><strong>Deemed Cost:</strong> Fixed + fuel + maint from gazette table \u00d7 business km.<br><strong>Actual Cost:</strong> Total costs \u00d7 (business km \u00f7 total km). Requires all receipts.<br>Contemporaneous logbook is mandatory for both methods.'},
  {code:'Eighth Schedule',name:'Capital Gains Tax (CGT)',content:'Net capital gains included in taxable income at <span class="act-ref-highlight" id="ref-cgt-incl"></span> inclusion rate.<br><strong>Annual exclusion:</strong> <span class="act-ref-highlight" id="ref-cgt-excl"></span><br><strong>Primary residence:</strong> First <span class="act-ref-highlight" id="ref-cgt-primres"></span> of gain (conditions apply).<br>Crypto assets treated as assets for CGT. All disposals require base cost documentation.'}
];

/* ── DEDUCTIONS CHECKLIST ITEMS ── */
/* B3 Simplification (01-SPEC.md §6.2): `short` is the selector row's label —
   plain language, no statutory reference (decision-log B1). `code` is still
   the SARS code chip, kept per that same rule because it is how the user
   finds the figure on the document in front of them. `tip` is the row's
   press-and-hold ⓘ (item 38), written to P3: second person, what it is and
   what proof you need, no section numbers.

   `additional` ("Other claims") is new in B3: the page it gates already
   existed as the "Other 4000" tab, and is the ONLY capture path for
   APP.deductionItems → additionalDed in the engine. It becomes a selector
   row like everything else rather than a tab button (§6.3). */
export const DEDUCTION_CHECKLIST = [
  /* V8.6 I5: retirement codes corrected to 4001/4003/4006 (was 4001/4006/4042) */
  {id:'retirement', label:'Retirement Fund Contributions',  short:'Money you saved for retirement', icon:'savings',        code:'4001/4003/4006', recommended:true,
   tip:'What you paid into a pension fund, provident fund or retirement annuity this year. Your fund sends you a certificate.'},
  /* V8.6 I4: "Medical Scheme Credits" → "Medical Expenses" */
  {id:'medical',    label:'Medical Expenses',                short:'Medical',                       icon:'stethoscope',        code:'4005/4040',      recommended:true,
   tip:'Your medical aid contributions, plus medical costs you paid yourself that the scheme did not pay back.'},
  {id:'travel',     label:'Travel Allowance Deduction',      short:'Travel claims',                 icon:'directions_car',                code:'4015',           recommended:false,
   tip:'Business travel in your own car, if you get a travel allowance or are paid back for trips. You need a logbook.'},
  {id:'homeoffice', label:'Home Office Expenses',            short:'Working from home',             icon:'home_work',       code:'4028',           recommended:false,
   tip:'A share of what it costs to run your home, if you have a room used only for work.'},
  {id:'tools',      label:'Tools & Equipment',               short:'Tools and equipment',           icon:'construction', code:'4027',           recommended:false,
   tip:'Tools, equipment and computers you bought for your work. Keep the invoices.'},
  {id:'donations',  label:'Donations to Approved PBOs',      short:'Donations to charity',          icon:'volunteer_activism', code:'4011',           recommended:false,
   tip:'Money you gave to a registered charity. You need their official receipt — an ordinary one will not do.'},
  /* W6 (IT-AE-36-G05 ITR12 guide, "Commission Income Expenditure - Section 11(a)"): 4017 is the
     s8(1)(c) subsistence-expenses code, not subscriptions (already confirmed wrong). Professional
     subscriptions/other consolidated non-travel expenses for a commission earner are declared
     next to code 4016 ("Other" — s11(a)). */
  {id:'subscrip',    label:'Professional memberships',     short:'Professional memberships',      icon:'crown',           code:'4016',           recommended:false,
   tip:'Fees for a professional body you have to belong to for your work.'},
  /* A3 (s8(1)(c)): deemed daily subsistence expenditure against a local subsistence allowance. */
  {id:'subsistence', label:'Subsistence Allowance',          short:'Nights away for work',          icon:'restaurant',           code:'4017',           recommended:false,
   tip:'Meals and daily costs when work took you away overnight. There is a set daily amount you can claim.'},
  /* B3 §6.3 (items 29, 30): the former "Other 4000" tab. */
  {id:'additional',  label:'Other Deduction Codes',          short:'Other claims',                  icon:'order_approve',            code:'\u2014',           recommended:false,
   tip:'Anything you can claim that does not have its own page here. Add what it was and how much.'}
  // V8.5 Session 5: removed CGT (\u2192 B5), Rental (\u2192 B3), Interest (\u2192 B2). These are income buckets, not deductions.
];

/* \u2500\u2500 DECISION STUDIO STAGE 2: onboarding answer\u2192activation mapping \u2500\u2500\u2500\u2500\u2500\u2500
   The single source of truth for obComplete()'s (12-bootstrap-onboarding.js)
   boolean answer\u2192flag assignments \u2014 the ~13 "if OB.data.X === 'yes' then
   APP.dedChecks.Y = true" lines that used to be hand-written one at a time.

   Two groups, one convention each (deliberately not a per-row comparator \u2014
   every row in a group tests the same way, so a per-row function would be
   an abstraction with nothing to abstract):
     - deductions: APP.dedChecks[key] = OB.data[field] === 'yes'
     - carriedBalances: APP.expectedCarriedBalances[key] = OB.data[field] !== 'no'
       (binary yes/no, default 'no' \u2014 see the obComplete() comment this
       table's consumer carries forward)

   tools/check-decision-model.js parses this table (as text, not by
   importing 01-data.js \u2014 see hard rule 10 below) and cross-checks it
   against docs/reference/decision-model.json's edges in both directions,
   the same drift check every other edge gets. Adding a row here is now the
   ONLY way to add an onboarding-driven activation of this shape; obComplete
   no longer hardcodes them individually, so there is nothing left to drift
   silently out of sync with this table.

   Lives here rather than in 12-bootstrap-onboarding.js for the same reason
   CONDITIONAL_Q_TEXT below does \u2014 hard rule 10 (never access a foreign
   const at module-eval time; import cycles flip ESM evaluation order). */
export const ONBOARDING_ACTIVATION = {
  deductions: [
    { key: 'medical',     field: 'hasMedical' },
    { key: 'retirement',  field: 'hasRA' },
    { key: 'donations',   field: 'hasDonations' },
    { key: 'homeoffice',  field: 'workFromHome' },
    { key: 'travel',      field: 'travelAllowance' },
    { key: 'subsistence', field: 'subsistence' },
    { key: 'tools',       field: 'tools' },
    { key: 'subscrip',    field: 'subscriptions' },
    /* ONB-2 (design-system-audit-2026-09 §L.9): 'additional' ("Other
       Deduction Codes") had no onboarding question at all before this. */
    { key: 'additional',  field: 'otherClaims' },
  ],
  carriedBalances: [
    { key: 'loss',       field: 'carryLoss' },
    { key: 'capital',    field: 'carryCapital' },
    { key: 'retirement', field: 'carryRetirement' },
    { key: 'donations',  field: 'carryDonations' },
    { key: 'lumpsum',    field: 'carryLumpsum' },
    { key: 'ftc',        field: 'carryFtc' },
  ],
};

/* \u2500\u2500 PHASE 1 (G1/E1/E2): conditional question wording \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Two setup questions test a genuinely different rule depending on how the
   income is earned, so the wording swaps rather than asking one vague
   question of everyone:

   - A trader deducts tools and subscriptions under s11(a) as expenditure
     incurred in the production of income.
   - An EMPLOYEE is additionally restricted by s23(m), which disallows most
     s11 deductions against remuneration. The surviving cases are narrow:
     the asset or membership must be required for the duties, and the
     employer must neither supply it nor refund it.

   'trade' wins for a mixed profile, because the s11(a) claim is the broader
   of the two \u2014 showing the employee-restricted prompt to someone who also
   runs a business would understate what they may claim.

   Lives here (not in the onboarding or profile module) because onboarding
   AND the profile edit form must ask the identical question \u2014 CLAUDE.md's
   profile-onboarding parity rule \u2014 and 12-/13- already import cyclically
   from each other, so a shared const in either would be an eval-order
   hazard (hard rule 10). Every module imports from 01-data. */
export const CONDITIONAL_Q_TEXT = {
  tools: {
    trade: {
      text: 'Do you use tools or equipment \u2014 including phones, laptops and other electronic devices \u2014 directly in the work that earns your income?',
      tip:  'Tools, equipment and devices used in your trade. Anything costing ' + randText(WT_SMALL_ITEM_LIMIT) + ' or less is written off in full in the year you buy it; more expensive items are written off over their useful life (s11(e), Interpretation Note 47).'
    },
    employee: {
      text: 'Do you buy your own tools or equipment for your work duties, without your employer supplying them or paying you back?',
      tip:  'As an employee your claim is narrow: s23(m) disallows most expense claims against a salary. Tools and equipment survive only where they are required for your duties and your employer neither supplies them nor refunds you.'
    }
  },
  subs: {
    trade: {
      text: 'Do you pay subscriptions or professional memberships needed for your business or trade?',
      tip:  'Professional body fees, licences and trade memberships paid to earn your income are deductible under s11(a).'
    },
    employee: {
      text: 'Do you pay professional subscriptions or memberships that your work requires, which your employer does not pay for you?',
      tip:  'As an employee this is restricted by s23(m) \u2014 it must be a professional body you are required to belong to for your job, and your employer must not be paying the fee.'
    }
  }
};

/* QR7 (Q-ONB-1/2/3, QD-23 — 08-INVESTIGATIONS.md §1 items 1, 2, 3, 5): the
   low-frequency scenario questions, asked once in onboarding (Income Sources
   step) only when an income type they apply to is ticked, and mirrored in
   Profile. One table for both surfaces so the wording cannot drift. Each
   answer is stored in APP.profileScenarios[key]; an unanswered question
   means every field it gates is SHOWN (QD-24).
   - `appliesTo`  income-type values (INCOME_TYPE_DEFS) that make it relevant
   - `requires`   another question that must be answered Yes first (#2 is
                  the CGT follow-up to #1, asked only when #1 = Yes)
   - `gates`      what a No hides, for the Profile hint
   Law (WR-10): a co-owner is taxed only on the share of income or gain that
   accrues to them (s1 "gross income", the general accrual principle — the
   same basis rentalShare() and the CGT share already cite); income from an account a parent
   funds in a minor child's name is the parent's (s7(3)); TFSA returns are
   exempt (s12T). */
export const SCENARIO_QUESTIONS = [
  /* Onboarding step 2 requires an answer to every question that applies
     (QD-24 as amended, UI-CAP-0; obValidateCurrentStep), so a capture form
     never has to ask; QD-24's "unanswered = show" now matters only for
     users who joined before. `share` — a Yes is followed by ONE usual share
     for every joint item (owner: one figure, not one per category), stored
     as usualShare. */
  { key: 'jointOwnership', appliesTo: ['investment_income', 'rental_income', 'cgt'], share: true,
    text: 'Do you own any of these together with someone else \u2014 a joint account, or property with a spouse or partner?',
    hint: 'Your usual share is used for any account, property or sale you mark as held jointly. Say No and everything is taxed as fully yours.',
    profileLabel: 'Joint ownership', gates: 'Lets you mark an account, property or sale as held jointly' },
  { key: 'cgtJointOwnership', appliesTo: ['cgt'], requires: 'jointOwnership',
    text: 'Do you own any of the things you sold with someone else?',
    hint: 'Only your share of the gain or loss is yours to declare.',
    profileLabel: 'Sold something you owned jointly', gates: 'Asks for your share on each capital sale' },
  { key: 'minorChildAccount', appliesTo: ['investment_income'],
    text: 'Do you pay into an account in your minor child\u2019s name?',
    hint: 'Interest on money you gave your minor child is taxed in your hands (s7(3)).',
    profileLabel: 'Minor child\u2019s account', gates: 'Lets you mark an investment certificate as your minor child\u2019s account' },
  { key: 'tfsa', appliesTo: ['investment_income'],
    text: 'Do you have a tax-free savings account (TFSA)?',
    hint: 'Its interest, dividends and gains are tax-free (s12T), but contributions have yearly and lifetime limits.',
    profileLabel: 'Tax-free savings account', gates: 'Shows the Tax-free investments list' }
];

/* QR7 (Q-ONB-3, QD-10, 08-INVESTIGATIONS.md §2): foreign income, layer 2 —
   which categories MAY be foreign. Asked only when layer 1 (APP.foreignIncomeYN)
   is Yes. A category not ticked has its foreign option, foreign step and
   currency converter left out of its capture form, with a note naming it
   (`noun`, and `omitted` says what was left out); a record that is ALREADY
   foreign stays visible with a mismatch
   note instead — captured data is never hidden. Per-record domestic/foreign
   toggles still decide within an allowed category (IEM-1 stands).
   QD-23 items #9 (foreign-service days) and #11 (foreign pension) are the
   `employment` and `pension` rows here, not separate questions: asking both
   would put one fact in two places (WR-8). Law: residents are taxed on
   worldwide income (s1 "gross income"); foreign employment may be exempt
   under s10(1)(o)(ii). */
export const FOREIGN_SCENARIO_CATEGORIES = [
  { key: 'investments', label: 'Investments',              noun: 'foreign investment income',     omitted: 'foreign amounts are not asked for here' },
  { key: 'rental',      label: 'Rental property',          noun: 'foreign rental income',         omitted: 'the Foreign lease type is not offered' },
  { key: 'business',    label: 'Own business',             noun: 'a foreign business',            omitted: 'the Foreign business type is not offered' },
  { key: 'capital',     label: 'Selling something abroad', noun: 'foreign capital sales',         omitted: 'the Foreign asset type is not offered' },
  { key: 'pension',     label: 'A pension or annuity',     noun: 'a foreign pension or annuity',  omitted: 'the Foreign option is not offered' },
  { key: 'employment',  label: 'Working abroad',           noun: 'income from working abroad',    omitted: 'foreign-service codes are not listed' }
];

/* Income types that constitute a trade for the s11(a) reading above. Rental
   and crypto sit with business because each is a trade the taxpayer carries
   on in their own right, not remuneration. */
export const TRADE_INCOME_TYPES = ['business_income', 'rental_income', 'crypto_income'];

/* ── PHASE 9 (H4): SARS ACCOUNT "ADD A BALANCE" GUIDED ENTRY ────────────────
   Owner decision (2026-07-29): a guided entry flow over the EXISTING fixed
   set of carried-forward balances, not a new repeatable-list data model.
   Each of these types is legally a single scalar carry-forward figure (a
   loss set-off, an s11F excess, an s18A excess, …) — the statute has no
   concept of "multiple loss entries" the way a business's expense list
   does, so a true per-type CRUD list would just be record-keeping detail
   the engine can never use, on top of every field already existing.

   `field` is the id of the row's own "Prior year" input already on the
   SARS Account page (income-prioryear) — the ONLY thing this feature adds
   is a faster way to reach and fill that exact field; it fires that
   field's own existing oninput handler rather than writing tax state
   directly, so there is exactly one place each balance is actually
   applied (hard rule 2/3). `details` is the id of the row's own
   <details class="stmt-row"> to open when jumped to. */
/* QA 2026-08 (B2-AC-8/B2-AC-10): where each carried balance actually comes
   from. The SARS Account page MIRRORS figures that are captured elsewhere —
   the ledger rows already said so in prose ("Also editable on: Capital
   Gains"), but prose is not a control: the user still had to go and find the
   page. This turns the destination into data so the row can offer a real jump.

   `why` explains why a balance is on screen when it got there because an
   amount was captured on its source page, rather than because the user said
   in onboarding that they had one — the two routes are indistinguishable
   from the row itself.

   Balances with no entry: the s20A ring-fenced total, PAYE/provisional
   credits and the SARS statement balance are captured HERE, so there is
   nowhere to jump to. */
export const BALANCE_SOURCE = {
  loss:      { mode:'income',     tab:'main',          label:'Income main',              why:'Shown because a prior-year assessed loss is captured on Income main.' },
  capital:   { mode:'income',     tab:'b5cgt',         label:'Capital gains',            why:'Shown because a capital loss brought forward is captured on Capital gains.' },
  ftc:       { mode:'income',     tab:'b6foreign',     label:'Foreign income',           why:'Shown because an unused foreign tax credit is captured on Foreign income.' },
  retexcess: { mode:'deductions', tab:'retirement',    label:'Retirement deductions',    why:'Shown because non-deducted retirement contributions are captured on Retirement deductions.' },
  lumpsum:   { mode:'income',     tab:'b7retirement',  label:'Retirement income',        why:'Shown because a prior lump-sum total is captured on Retirement income.' },
  donations: { mode:'deductions', tab:'donations',     label:'Donations',                why:'Shown because donations above the 10% cap carried forward from this year.' },
};

/* ── s20A RING-FENCING: notices only (DECISIONS OI-D1b, BACKLOG 57) ────────
   The app does not apply s20A: every trade or rental loss is set off against
   other income in the year it arises (s20(1)(b)), and the user is told where
   SARS might ring-fence it instead. The dormant determination code that sat
   behind the old ring-fencing flag (off since QA 2026-08) was deleted on
   2026-10-15; the last tree that carries it is 3818366, for the parked
   calculation.
   s20A(1): applies to a natural person whose taxable income before the set-off
   reaches the income at which the maximum marginal rate applies;
   s20A(2)(a): a loss in at least three of the last five years;
   s20A(2)(b): the listed "suspect" trades — (iii) rental of residential
   accommodation unless at least 80 % is let to non-relatives for at least
   half the year; s20A(3): the reasonable-prospect-of-profit escape. */

/* Cloud backup kill-switch (qa-remediation-2026-09 QR10a, QX-DRV-5). OFF, and it
   STAYS off until the owner's switch-on checklist is done: the production OAuth
   consent screen (QD-02), the Play Data safety form and the privacy policy
   updated to say encrypted backups go to the user's own Google Drive, and the
   QR10b device protocol passed. While false, 17/18-cloud-backup*.js do nothing 
   no scheduler, no reminder, no UI, no plugin call (tests/cloud-backup.js pins
   both the value and that nothing surfaces). The native plugin does not exist
   until QR10b. */
export const CLOUD_BACKUP_ENABLED = false;

export const SARS_BALANCE_TYPES = [
  { id:'loss',       label:'Assessed loss',                         field:'py_loss_sars',          details:'carried-seg-loss' },
  { id:'capital',    label:'Capital losses',                        field:'cgt_loss_bf_sars',      details:'carried-seg-capital' },
  { id:'ftc',        label:'Foreign tax credits not used',          field:'ftc_bf_sars',           details:'carried-seg-ftc' },
  { id:'retexcess',  label:'Non-deducted retirement contributions', field:'py_ret_excess_sars',    details:'carried-seg-retexcess' },
  { id:'lumpsum',    label:'Cumulative retirement lump sums',       field:'prior_lumpsum_bf_sars', details:'carried-seg-lumpsum' },
  { id:'donations',  label:'Donations not deducted',                field:'py_s18a_excess',        details:'carried-seg-donations' },
];

/* ── PHASE 6 (F2): why a deduction is switched on ──────────────────────────
   The feedback asks for four things on every prepopulated selection: what
   was assumed, why it is on, what it means, and how to change it. Three of
   them are copy and live here; the fourth is a link the renderer adds.

   `assumed` completes "you told us ..." — it must read as the USER'S OWN
   answer being played back, not as something the app decided about them.
   `means` is the consequence in plain language: what turning this on
   actually causes to happen to their tax. Deliberately no statutory
   references — these notes sit on the selector, which is the least
   technical surface in the app. */
export const DED_ACTIVATION_NOTE = {
  medical:     { assumed: 'you have medical aid or medical costs',
                 means:   'we work out your medical tax credits and any extra qualifying spend' },
  retirement:  { assumed: 'you contribute to a retirement fund',
                 means:   'your contributions come off your income, up to the annual limit' },
  donations:   { assumed: 'you donated to a registered charity',
                 means:   'your s18A receipts come off your income, up to 10% of it' },
  homeoffice:  { assumed: 'you work from home',
                 means:   'a share of what it costs to run your home can come off your income' },
  travel:      { assumed: 'you get a travel allowance',
                 means:   'your business travel can come off the allowance you were taxed on' },
  subsistence: { assumed: 'you were paid a subsistence allowance',
                 means:   'a set daily amount for nights away comes off that allowance' },
  tools:       { assumed: 'you buy your own tools or equipment',
                 means:   'what you spent comes off your income, in full or over time' },
  subscrip:    { assumed: 'you pay professional subscriptions',
                 means:   'those fees come off your income' },
};

/* ── INCOME TYPE OPTIONS — 9-type flat taxonomy ──────────────────────────────
   5 Level-0 groups: Employment, Passive, Business & Trade, Capital & Alternative, Other
   9 Level-1 types shown in onboarding/profile selectors.
   Foreign income is absorbed into matching groups (not a separate selector).
   bucket: links to calculation layer (BUCKET_DEFS in 02-core).
   isProvisional: true = triggers provisional taxpayer assessment. */
/* G1: Canonical income type metadata — single source of truth shared by the
   onboarding flat-grid and the profile flat-grid. Both UIs render from this
   list via renderIncomeGrid() and both use name="income-type". */
export const INCOME_TYPE_DEFS = [
  // Level-0: Employment
  {value:'employment_income', group:'employment', label:'Employment',   icon:'badge',           color:'ico-bg-navy',   isProvisional:false, bucket:1,
   subtypes:[],  // L2 handled by IRP5 source codes in the IT3/IRP5 modal
   tip:'What your employer paid you — salary, overtime, bonus, allowances and benefits. It is all on your IRP5.'},
  // Level-0: Passive Income
  {value:'investment_income', group:'passive',    label:'Investments',   icon:'finance_mode',          color:'ico-bg-mint',   isProvisional:false, bucket:2,
   subtypes:[
     {value:'interest',          label:'Interest'},
     {value:'local_dividends',   label:'Local dividends'},
     {value:'foreign_dividends', label:'Foreign dividends'},
     {value:'reit',              label:'REIT / ETF distributions'},
   ],
   tip:'What your savings and investments earned you — interest, dividends, distributions. Your bank or investment manager sends you the certificate.'},
  {value:'rental_income',     group:'passive',    label:'Rentals',       icon:'home',               color:'ico-bg-green',  isProvisional:true,  bucket:3,
   subtypes:[
     {value:'property',  label:'Property'},
     {value:'airbnb',    label:'Airbnb'},
     {value:'equipment', label:'Equipment lease'},
     {value:'vehicle',   label:'Vehicle lease'},
     {value:'foreign',   label:'Foreign Lease',      showWhen:'foreign:rental'},   // QR7.3
   ],
   tip:'Rent you received from a property, an Airbnb, or equipment you lease out. Your running costs come off it.'},
  {value:'retirement_income', group:'passive',    label:'Retirement',   icon:'beach_access',          color:'ico-bg-pink',   isProvisional:false, bucket:7,
   subtypes:[
     {value:'pension_annuity', label:'Pension / RA receipts (IT3(a))'},
     {value:'lumpsum',         label:'Lump sums'},
   ],
   tip:'Money paid to you by a pension, provident or retirement annuity fund — monthly income or a lump sum.'},
  // Level-0: Business & Trade
  {value:'business_income',   group:'business',   label:'Own business',   icon:'storefront',           color:'ico-bg-purple', isProvisional:true,  bucket:4,
   subtypes:[
     {value:'freelancer', label:'Freelancer / Contractor / Consultant'},
     {value:'commission', label:'Commission / Fees'},
     {value:'sole_prop',  label:'Sole Proprietor / Practitioner'},
     {value:'trader',     label:'Trader / Vendor'},
     {value:'foreign',    label:'Foreign business', showWhen:'foreign:business'},   // QR7.3
   ],
   tip:'Work you do for yourself — freelancing, consulting, trading, or your own business. Your costs come off it.'},
  // Level-0: Capital & Alternative
  {value:'cgt',               group:'capital',    label:'Capital sales',     icon:'arrow_split',      color:'ico-bg-amber',  isProvisional:false, bucket:5,
   subtypes:[
     {value:'property', label:'Property'},
     {value:'shares',   label:'Shares'},
     {value:'vehicle',  label:'Vehicle / Equipment / Movables'},
     {value:'foreign',  label:'Foreign',  showWhen:'foreign:capital'},   // QR7.3
     {value:'other',    label:'Other'},
   ],
   tip:'Selling something you owned as an investment or asset — property, shares, a vehicle, a business. Not stock you buy and sell as your trade, which is ordinary business income. A loss counts here too.'},
  {value:'crypto_income',     group:'capital',    label:'Crypto',              icon:'currency_bitcoin',        color:'ico-bg-orange', isProvisional:true,  bucket:10,
   subtypes:[
     {value:'disposals', label:'Crypto sales (disposals)'},
     {value:'revenue',   label:'Other crypto income'},
   ],
   tip:'Crypto you sold, swapped or spent, plus anything crypto earned you like mining or staking rewards.'},
  // Level-0: Other
  {value:'other_income',      group:'other',      label:'Other receipts', icon:'money',             color:'ico-bg-grey',   isProvisional:true,  bucket:9,
   subtypes:[
     {value:'royalties',   label:'Royalties'},
     {value:'other',       label:'Other taxable receipts'},
   ],
   /* FARM-2 (owner 2026-10-17): the app does not handle farming income or
      trust distributions (R1, B-17: disclose only); the one place it says so. */
   tip:'Money that does not fit anywhere else — maintenance, royalties, a share of a partnership. Farming income and trust distributions are not covered by this app.'},
];

/* G1: 5 Level-0 group headers for the flat income-type grid in onboarding and profile.
   id must match the group field in INCOME_TYPE_DEFS entries. */
/* QR4.5 (Q-CPY-6, RET-11/12/13; QD-18): the ONE table saying which income code
   evidences which deduction. It replaces three hand-kept maps that had drifted
   apart — the Add-income tip (onIncomeCodeChange), the captured-row suggestion
   (CODE_SUGGESTIONS) and the pill triggers (recommendDeductionFor) — so the
   income side, the deduction side and the reason shown under each pill now
   read the same rows. Code descriptions were re-verified against IRP5_INCOME's
   own names (3813 is *Medical Services Costs*, 3821 is a non-taxable
   *bursary* — the old row that suggested a retirement deduction for 3821 was
   wrong; 3704 is subsistence, not travel).
     codes         IRP5 income codes that trigger the row
     deduction     DEDUCTION_CHECKLIST id
     strength      'strong' (Recommended pill) | 'consider' (Consider pill) |
                   'note' (income-side note only — evidence too weak for a pill)
     incomeNote    HTML shown on the income side; null = none
     deductionNote what follows "your income includes <code> (<name>) —" in the
                   reason under the pill
     cite          primary source for the statement (WR-10) */
export const INCOME_DEDUCTION_LINKS = [
  { codes:['3817','3825','3828'], deduction:'retirement', strength:'strong',
    incomeNote:'Retirement fund contribution — a <strong>retirement deduction (s11F)</strong> may apply.',
    deductionNote:'your employer contributes to a retirement fund for you',
    cite:'s11F ITA — deduction for contributions to pension, provident and retirement annuity funds' },
  { codes:['3810'], deduction:'medical', strength:'strong',
    incomeNote:'Medical aid fringe benefit — a <strong>medical expenses deduction</strong> may apply. See Deductions → Medical.',
    deductionNote:'your employer pays medical aid contributions for you',
    cite:'s6A, s6B ITA — medical scheme fees tax credit and additional medical expenses tax credit (not s18A, which is donations)' },
  { codes:['3813'], deduction:'medical', strength:'note',
    incomeNote:'Medical services costs — a <strong>medical expenses deduction</strong> may apply. See Deductions → Medical.',
    deductionNote:'your employer pays medical services costs for you',
    cite:'s6A, s6B ITA; IRP5 code 3813 = Medical Services Costs (IRP5_INCOME)' },
  { codes:['3701'], deduction:'travel', strength:'strong',
    incomeNote:'Travel allowance — a <strong>travel deduction</strong> may be claimable. See Deductions → Travel.',
    deductionNote:'you are paid a travel allowance',
    cite:'s8(1)(b) ITA — deduction against a travel allowance' },
  { codes:['3702','3722'], deduction:'travel', strength:'consider',
    incomeNote:'Taxable reimbursive travel — a <strong>travel deduction</strong> may be claimable. See Deductions → Travel.',
    deductionNote:'part of your travel reimbursement was taxed, so you may have business travel to claim',
    cite:'s8(1)(b) ITA; IRP5_INCOME descriptions of 3702 / 3722' },
  { codes:['3816','3802'], deduction:'travel', strength:'note',
    incomeNote:'Use of a company vehicle — a <strong>travel deduction</strong> may be claimable on business use. See Deductions → Travel.',
    deductionNote:'you have the use of a company vehicle',
    cite:'s8(1)(b) ITA; Seventh Schedule para 7 (right of use of a motor vehicle)' },
  { codes:['3704','3715'], deduction:'subsistence', strength:'strong',
    incomeNote:'Subsistence allowance — a <strong>subsistence deduction</strong> may be claimable. See Deductions → Subsistence.',
    deductionNote:'you are paid a subsistence allowance',
    cite:'s8(1)(c) ITA — deemed expenditure against a subsistence allowance; 3704 local / 3715 foreign per IRP5_INCOME' },
  { codes:['3714'], deduction:'subsistence', strength:'consider',
    incomeNote:null,
    deductionNote:'you were paid a non-taxable allowance, which may include a subsistence allowance',
    cite:'s8(1)(c) ITA; IRP5_INCOME description of 3714' },
  { codes:['3606','3616'], deduction:'homeoffice', strength:'note',
    incomeNote:'Independent contractor / commission income — <strong>home office</strong>, <strong>tools and equipment</strong>, and <strong>professional subscriptions</strong> may be deductible.',
    deductionNote:'you earn commission or contractor income, which carries its own expenses',
    cite:'s11(a), s11(e) ITA; SARS ITR12 guide (IT-AE-36-G05) — commission income expenditure' },
  { codes:['3606','3616'], deduction:'tools', strength:'note',
    incomeNote:'Independent contractor / commission income — <strong>home office</strong>, <strong>tools and equipment</strong>, and <strong>professional subscriptions</strong> may be deductible.',
    deductionNote:'you earn commission or contractor income, which carries its own expenses',
    cite:'s11(a), s11(e) ITA; SARS ITR12 guide (IT-AE-36-G05) — commission income expenditure' },
  { codes:['3606','3616'], deduction:'subscrip', strength:'note',
    incomeNote:'Independent contractor / commission income — <strong>home office</strong>, <strong>tools and equipment</strong>, and <strong>professional subscriptions</strong> may be deductible.',
    deductionNote:'you earn commission or contractor income, which carries its own expenses',
    cite:'s11(a) ITA; SARS ITR12 guide (IT-AE-36-G05) — commission income expenditure' },
];

/* On-blur field validation (owner interview 2026-10-07, BACKLOG 36): the
   field-level checks that are not a plain "required" or a min/max — an
   impossible value, or a plausibility rule shown and enforced at its field.
   The generic checks (required, min/max) live with the validator in 02-core.js
   (fieldProblem); this table holds only the field-specific ones.
     el            the field the problem belongs to (its border and message)
     check(num, str)  returns the message, or null — `num(id)`/`str(id)` read
                   other fields, so a cross-field rule needs no DOM code here
     plausibility  PLAUSIBILITY_RULES id(s) evaluated at this field instead;
                   `ctx(num, str, env)` builds their context (`env.remuneration()`
                   is the engine's remuneration base) and `note` names the
                   container that already shows the rule's text, so the field
                   gets the border and aria-describedby, not a second copy.
                   A rule's `blocksSave` decides error (blocks) vs warning.
     level         'warning' for a `check` that only asks the user to look again
                   (default 'error', which blocks Save). */

/* BACKLOG 42 (OI-B5): the tax year a date is being captured for. s1 ITA
   "year of assessment": for a natural person, the year ending on the last
   day of February — key Y runs 1 March (Y-1) to the end of February Y.
   ISO strings, so a date input's value compares as text. */
export function taxYearDates(key) {
  const y = parseInt(key, 10) || 0;
  const febEnd = new Date(Date.UTC(y, 2, 0)).getUTCDate();   // 28 or 29
  return { start: (y - 1) + '-03-01', end: y + '-02-' + febEnd };
}
/* Whole months of tax year `key` inside a write-off period that starts on a
   YYYY-MM-DD date and runs `years` years — the first and the last month of
   the period count in full. Wear and tear is apportioned for the part of the
   year the asset qualifies, from the month it is brought into use to the
   month its write-off period ends (IN47 §4.1.6, §4.3.8); the deemed fixed
   cost uses the same count (the gazetted table in SARS_TRAVEL). No date:
   12 (treated as in use all year). The period's last day is the day before
   the anniversary. Read as text, not new Date(), which parses YYYY-MM-DD as
   UTC midnight — 02:00 in South Africa, after a local-midnight year end
   (BACKLOG 90) — and the year runs March to February, 29 February included.
   One source for vehicle and tools wear and tear (BACKLOG 91, WR-8). */
export function writeOffMonthsInTaxYear(dateStr, years, key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return 12;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  const ty = parseInt(key, 10) || 0;
  let endY = y + years, endM = mo;
  if (d === 1) { endM -= 1; if (endM === 0) { endM = 12; endY -= 1; } }
  const from = Math.max(y * 12 + mo, (ty - 1) * 12 + 3);
  const to = Math.min(endY * 12 + endM, ty * 12 + 2);
  return Math.max(0, Math.min(12, to - from + 1));
}
/* BACKLOG 90: months from a start date with no end (the car's fixed cost). */
export function monthsInTaxYearFrom(dateStr, key) {
  return writeOffMonthsInTaxYear(dateStr, Infinity, key);
}
function _taxYearSpan(key) {
  const p = taxYearDates(key), y = parseInt(key, 10) || 0;
  return '1 ' + MONTH_NAMES_FULL[0] + ' ' + (y - 1) + ' to ' + p.end.slice(8) + ' ' + MONTH_NAMES_FULL[11] + ' ' + y;
}
function _outsideTaxYear(d, key) {
  if (!d) return null;
  const p = taxYearDates(key);
  return d < p.start ? 'before' : d > p.end ? 'after' : null;
}
export const FIELD_CHECKS = [
  /* BACKLOG 42 (OI-B5, owner 2026-10-09). A lump sum is taxed in the year it
     is received or accrues (Second Schedule par 2(1)); walkLumpsums orders
     the year's events by this date, so a wrong one moves the tax. Blocks. */
  { el:'ls-date',
    check: (num, str) => _outsideTaxYear(str('ls-date'), str('taxYear'))
      ? 'This date is outside the tax year you are capturing (' + _taxYearSpan(str('taxYear')) + '). A lump sum belongs to the year you received it.'
      : null },
  /* Wear and tear starts when the item is brought into use (IN47 §4.3.8, §4.3.9;
     calcToolItemWt apportions from this date). A date AFTER the year gives
     R 0 with no sign why — blocks. A date BEFORE the year is an item still
     being written off, which IN47 allows and calcToolItemWt computes, so it
     is not refused (owner asked to confirm, BACKLOG 89). */
  { el:'tools-wt-date',
    check: (num, str) => _outsideTaxYear(str('tools-wt-date'), str('taxYear')) === 'after'
      ? 'This date is after the tax year you are capturing ends (' + _taxYearSpan(str('taxYear')) + '). Wear and tear starts in the year you start using the item.'
      : null },
  /* BACKLOG 90: the car's date is read the same way (monthsInTaxYearFrom) —
     a date after the year gives nothing for this year. Blocks, as OI-B5 does
     for tools; a date before the year is a car already in use (12 months). */
  { el:'tv_date_acq',
    check: (num, str) => _outsideTaxYear(str('tv_date_acq'), str('taxYear')) === 'after'
      ? 'This date is after the tax year you are capturing ends (' + _taxYearSpan(str('taxYear')) + '). Leave it empty if you used the car all year.'
      : null },
  /* The two-pot date is not read by the engine (every call sums amount and
     taxWithheld) — a reference for the user, so a look-again warning only. */
  { el:'tp-date', level:'warning',
    check: (num, str) => _outsideTaxYear(str('tp-date'), str('taxYear'))
      ? 'This date is outside the tax year you are capturing (' + _taxYearSpan(str('taxYear')) + '). Check it — a withdrawal belongs to the year you received it.'
      : null },
  { el:'tools-wt-cost',
    /* s11(e) small-item write-off: cost must not exceed WT_SMALL_ITEM_LIMIT
       (ITR12 guide IT-AE-36-G05 §9.8.3(c); QD-29). */
    check: (num, str) => str('tools-wt-type') === 'small_tool' && num('tools-wt-cost') > WT_SMALL_ITEM_LIMIT
      ? 'Small tool is for items costing ' + randText(WT_SMALL_ITEM_LIMIT) + ' or less. Tap Change to pick another type, or check the cost.'
      : null },
  { el:'tv_odo_close',
    check: num => num('tv_odo_open') > 0 && num('tv_odo_close') > 0 && num('tv_odo_close') < num('tv_odo_open')
      ? 'The closing reading is lower than the opening reading.' : null },
  { el:'tv_bus_km', plausibility:['businessKmOverTotal'], note:'bus-km-warning',
    ctx: num => ({ businessKm: num('tv_bus_km'), totalKm: Math.max(0, num('tv_odo_close') - num('tv_odo_open')) }) },
  { el:'ho_area_office', plausibility:['officeAreaOverTotal'], note:'ho-area-warning',
    ctx: num => ({ officeArea: num('ho_area_office'), totalArea: num('ho_area_total') }) },
  { el:'add-emp-paye', plausibility:['payeOverRemuneration', 'payeOverTopRate'], note:'paye-plausibility',
    ctx: (num, str, env) => ({ paye: num('add-emp-paye'), remuneration: env.remuneration() }) },
];


/* QR4.6 (Q-CPY-7, QD-19): plausibility rules. One table, one
   evaluator (plausibilityNotes) and one note renderer (plausibilityHtml), both in
   02-core.js — a surface names the rules it wants and supplies a context. Every
   figure a rule compares against is data: the top marginal rate is read from the
   active TAX_YEARS entry, never typed here. A note blocks saving only when its
   rule carries `blocksSave` (owner, 2026-10-05: business km over total km, office
   area over home area — arithmetic impossibilities); the PAYE rules never block.
     level  'error'   the input cannot be right (an amount larger than the whole it
                      is part of) — red note
            'warning' unusual but possible — amber "please check" note
   The PAYE rules compare ONE entry against the remuneration captured in total:
   IRP5 lines and PAYE entries carry no shared employer, so "the same employer"
   (QD-19) is not knowable — comparing a single entry to the all-employers total
   can only under-report, never raise a false alarm.
   Medical dependants (QD-19 row 3) already has a tiered surface in
   04-deductions.js (7+ amber, 10+ red with acknowledgement) that predates this
   table and is stricter than QD-19 asks; it is left as is (01-FINDINGS Q-CPY-7
   correction). */
export const PLAUSIBILITY_RULES = [
  { id:'payeOverRemuneration', level:'error',
    applies: c => c.remuneration > 0 && c.paye > c.remuneration,
    text: c => 'The PAYE you entered (' + randText(c.paye) + ') is more than all the remuneration you have captured (' + randText(c.remuneration) + '). PAYE cannot be more than the pay it was taken from — please check both figures.' },
  { id:'payeOverTopRate', level:'warning',
    applies: c => c.remuneration > 0 && c.paye <= c.remuneration && c.paye > c.topRate * c.remuneration,
    text: c => randText(c.paye) + ' of PAYE is more than ' + Math.round(c.topRate * 100) + '% of the remuneration you have captured (' + randText(c.remuneration) + ') — the highest rate of income tax. Please check the amount.' },
  { id:'businessKmOverTotal', level:'error', blocksSave:true,
    applies: c => c.totalKm > 0 && c.businessKm > c.totalKm,
    text: c => 'Business kilometres (' + c.businessKm + ') are more than the total kilometres driven (' + c.totalKm + '). Please check the odometer readings and the business kilometres.' },
  { id:'officeAreaOverTotal', level:'error', blocksSave:true,
    applies: c => c.totalArea > 0 && c.officeArea > c.totalArea,
    text: c => 'The office area (' + c.officeArea + ') is larger than the total home area (' + c.totalArea + '). Please check both areas.' },
];

/* The income-side note for one IRP5 code (first matching row that has one). Pure —
   safe to call at any time. */
export function incomeDeductionNoteFor(code) {
  const row = INCOME_DEDUCTION_LINKS.find(r => r.incomeNote && r.codes.includes(code));
  return row ? row.incomeNote : null;
}

/* Evidence for one deduction from the captured income codes: the strongest pill
   level any row yields, and the reason to show under it. 'note' rows never make
   a pill. `codes` is the list of IRP5 codes on captured income. */
export function deductionEvidenceFromCodes(id, codes) {
  const rank = { strong: 2, consider: 1 };
  let best = null;
  INCOME_DEDUCTION_LINKS.forEach(r => {
    if (r.deduction !== id || !rank[r.strength]) return;
    const hit = r.codes.filter(c => codes.includes(c));
    if (!hit.length) return;
    if (best && rank[best.level] >= rank[r.strength]) return;
    best = { level: r.strength, codes: hit,
      reason: 'your income includes ' + hit.map(c => c + ' (' + (INCOME_CODE_SHORT[c] || c) + ')').join(' and ') + ' — ' + r.deductionNote };
  });
  return best;
}

/* QR2.1 (Q-NAV-1, QX-NAV-1; QD-09): the ONE table saying where each captured
   item lives. Every outstanding list (Income, Deductions, carried balances,
   the Dashboard's "Your return" steps) and every income-breakdown chip
   navigates through navigateToCapture(key) (02-core.js) rather than carrying
   its own `nav: [mode, tab]` pair — three hand-kept copies had already
   disagreed (PAYE went to Income main; the breakdown cells carried a `nav`
   nothing read).

   Key: an income-type value (INCOME_TYPE_DEFS), `paye`, a deduction id
   (DEDUCTION_CHECKLIST), or `carried_<flag>` (the six SARS carried balances).
   `mode`/`tab` feed navigateTo(). `arrive` is what happens on arrival:
     openAddIfEmpty    open the add modal when APP[list] is empty (`add` names
                       the export in 05-list-modules / 06a-rental / 06b-cgt)
     focusFirst        focus the page's first visible input
     expandBalanceRow:<id>  open that Tax-balances row and focus its opening
                       balance input (the row toggle's own behaviour)
     none              land on the tab (pages with several lists, e.g.
                       Retirement, where "the" add modal is ambiguous)
   Data only: no functions here (hard rule 10). */
export const CAPTURE_ROUTES = {
  paye:              { mode:'income', tab:'paye',         arrive:'openAddIfEmpty', list:'employerPaye',     add:'addEmployerPaye' },
  employment_income: { mode:'income', tab:'b1employment', arrive:'openAddIfEmpty', list:'incomeItems',      add:'addIncomeItem' },
  investment_income: { mode:'income', tab:'b2investment', arrive:'openAddIfEmpty', list:'it3bItems',        add:'addIt3bItem' },
  rental_income:     { mode:'income', tab:'b3rental',     arrive:'openAddIfEmpty', list:'rentalProperties', add:'addRentalProperty' },
  business_income:   { mode:'income', tab:'b4business',   arrive:'openAddIfEmpty', list:'businessItems',    add:'addBusinessItem' },
  cgt:               { mode:'income', tab:'b5cgt',        arrive:'openAddIfEmpty', list:'cgtAssets',        add:'addCgtAsset' },
  foreign_income:    { mode:'income', tab:'b6foreign',    arrive:'none' },
  retirement_income: { mode:'income', tab:'b7retirement', arrive:'none' },
  other_income:      { mode:'income', tab:'b9other',      arrive:'openAddIfEmpty', list:'otherReceipts',    add:'addOtherReceipt' },
  crypto_income:     { mode:'income', tab:'b10crypto',    arrive:'none' },
  retirement:        { mode:'deductions', tab:'retirement',  arrive:'focusFirst' },
  medical:           { mode:'deductions', tab:'medical',     arrive:'focusFirst' },
  travel:            { mode:'deductions', tab:'travel',      arrive:'focusFirst' },
  homeoffice:        { mode:'deductions', tab:'homeoffice',  arrive:'focusFirst' },
  tools:             { mode:'deductions', tab:'tools',       arrive:'focusFirst' },
  donations:         { mode:'deductions', tab:'donations',   arrive:'focusFirst' },
  subscrip:          { mode:'deductions', tab:'subscrip',    arrive:'focusFirst' },
  subsistence:       { mode:'deductions', tab:'subsistence', arrive:'focusFirst' },
  additional:        { mode:'deductions', tab:'additional',  arrive:'focusFirst' },
  carried_loss:       { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:loss' },
  carried_capital:    { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:capital' },
  carried_retirement: { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:retexcess' },
  carried_donations:  { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:donations' },
  carried_lumpsum:    { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:lumpsum' },
  carried_ftc:        { mode:'summary', tab:'prioryear', arrive:'expandBalanceRow:ftc' },
};

export const INCOME_TYPE_GROUPS = [
  {id:'employment', label:'Employment',           icon:'badge',        color:'ico-bg-blue'},
  {id:'passive',    label:'Passive Income',        icon:'paid',         color:'ico-bg-mint'},
  {id:'business',   label:'Business & Trade',      icon:'work',         color:'ico-bg-purple'},
  {id:'capital',    label:'Capital & Alternative', icon:'trending_up',  color:'ico-bg-amber'},
  {id:'other',      label:'Other',                 icon:'layers',       color:'ico-bg-grey'},
];


/* Legacy alias — maintained so existing engine refs keep compiling. */
export const INCOME_TYPES = INCOME_TYPE_DEFS.map(d => ({value:d.value, label:d.label, bucket:d.bucket, prov:d.isProvisional}));

/* Derived from INCOME_TYPE_DEFS — updating isProvisional on any item automatically
   adjusts provisional-taxpayer auto-detection. */
export const PROVISIONAL_INCOME_TYPES = INCOME_TYPE_DEFS.filter(d => d.isProvisional).map(d => d.value);

/* ── SA MEDICAL AID SCHEMES (~75 for autocomplete) ── */
export const SA_MEDICAL_AIDS = [
  'AECI Medical Aid Society','Alliance-Midmed','Anglo Medical Scheme','Anglovaal Group',
  'Bankmed','Barloworld Medical Scheme','Bestmed','BMW Employees Medical Aid',
  'Bonitas Medical Fund','BP Medical Aid Society',
  'Building & Construction Industry Medical Aid','CAMAF (Chartered Accountants)',
  'Cape Medical Plan','CompCare Wellness','Community Medical Aid (COMMED)',
  'De Beers Benefit Society','Discovery Health',
  'Engen Medical Benefit Fund','Fedhealth',
  'GEMS (Government Employees)','Genesis Medical Scheme','Glencore Medical Scheme',
  'Gold Fields Medical Scheme','Harmony Medical Scheme',
  'Hosmed','Implats Medical Scheme',
  'KeyHealth','LA Health','Liberty Medical Scheme',
  'Massmart Health Plan','Medihelp','Medshield','Mercedes-Benz Medical Fund',
  'Minemed','Momentum Health',
  'Netcare Medical Scheme','Old Mutual Staff Medical Scheme',
  'PG Group Medical Scheme','Pharos Medical Plan','Pick n Pay Medical Scheme',
  'Polmed (SA Police Service)','PPC Medical Aid','Profmed','Pro Sano',
  'Rand Mutual Medical Aid','Remedi (Sanlam)','Resolution Health',
  'SABC Medical Aid','Samwu Med','Sasol Med','Sedmed','Selfmed',
  'Shell Medical Aid','Sizwe Hosmed','South African Breweries Medical',
  'Spectramed','Telkom Medical Scheme','Tiger Brands Medical',
  'Transmed','Transnet Medical Fund','Tsogo Sun Medical','TuksHealth',
  'Umvuzo Health','Witbank Coalfields Medical','Wits Staff Medical Aid Fund',
  'Wooltru Healthcare Fund'
];

/* Smart-default ordering (UX #16): the largest SA open + closed schemes by
   membership float to the top of the autocomplete so most users pick without
   typing; the remainder stay alphabetical. Each name must match SA_MEDICAL_AIDS
   exactly. */
export const SA_MEDICAL_AIDS_COMMON = [
  'Discovery Health', 'GEMS (Government Employees)', 'Bonitas Medical Fund',
  'Momentum Health', 'Medshield', 'Fedhealth', 'Bestmed', 'Bankmed',
  'Profmed', 'KeyHealth', 'Medihelp', 'Polmed (SA Police Service)'
];

/* ── MONTH NAMES (SA tax year: March–February) ── */
export const MONTH_NAMES_SHORT = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
export const MONTH_NAMES_FULL  = ['March','April','May','June','July','August','September','October','November','December','January','February'];

/* ── AVATAR COLOURS ── */
export const AVATAR_COLOURS = [
  ['#7c3aed','#ede9fe'],['#0369a1','#e0f2fe'],['#065f46','#d1fae5'],
  ['#9a3412','#ffedd5'],['#1e40af','#dbeafe'],['#4d7c0f','#d9f99d'],
  ['#6b21a8','#f3e8ff'],['#be185d','#fce7f3']
];
export function getAvatarColours(username) {
  const h = (username||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
export function getInitials(name) {
  return (name||'?').split(' ').slice(0,2).map(w => w[0]||'').join('').toUpperCase() || '?';
}

/* B0 Simplification — tooltip content maps (P2, 01-SPEC.md).
   PAGE_HELP keyed by page key — the `.tab-section` id minus its `tab-`
   prefix, or a `mode-*` panel id minus `mode-` (e.g. 'income-main',
   'ded-medical', 'provtax'). Three-line what/who/how, shown in the help
   sheet. Empty until B6 writes the copy.
   FIELD_TIPS keyed by element id. attachTips() (13-patches.js) stamps these
   onto the DOM on every render, so this file is the ONE place a field's tip
   text lives — the inline data-tip attributes that used to carry them have
   been removed from body.html. The __missingTips audit counts a field as
   covered only when it appears here, which is what makes the number mean
   "reachable from the register" rather than "has some text somewhere".

   B6: every entry is now written to the P3 copy standard — second person,
   28 words or fewer, no statutory references, and answering what this is /
   where you find it / what to type. The register covers every field the
   coverage audit walks, so window.__missingTips is empty and the smoke
   assertion is a plain emptiness check rather than a ratchet.

   Three entries were retired rather than rewritten: med_deps, med_has_deps
   and ho_over50 are hidden derived inputs after B5 — the user never sees
   them, so a tip on them would describe a box that does not exist. */
/* ── THE CHARACTER — hybrid meerkat (Final Design Spec, Part 9) ──
   The species-recognition problem and the small-size-legibility problem pull
   in opposite directions, so the approved build takes one half from each of
   two prototypes:

     BODY  — the "literal" build: elongated sentinel torso, faint flank
             banding, visible digging claws, and (the part that actually
             carries recognition) the TAIL AS A PLANTED THIRD LEG, a tripod
             stance rather than a decorative curl. Silhouette alone now reads
             as a meerkat sentinel instead of "a small animal".
     FACE  — the "appealing-shape" build, byte-for-byte unchanged: oversized
             cranium, large low-set eyes, soft edges. Proven to hold up at
             46px, which is where the more literal face fell apart.

   Volume comes from radial gradients and a rim light, not outlines. The idle
   is four loops on deliberately co-prime-ish periods (breathe 4.6s, head sway
   6.4s, tail tremor 5.2s, ear twitch 7.8s) plus a 5.9s blink, so the
   character never reads as one looping object — the one documented exception
   to "nothing animates continuously at rest" (P3).

   The mascot is GROUNDED (P10): it never floats, never has its head cut off,
   never obscures a number or a control, and always carries a contact shadow —
   here spanning all three points of the tripod, feet and planted tail tip.

   Inlined as markup rather than referenced with <use href="#…">: <use> clones
   into a shadow tree that outer CSS selectors cannot reach, so every pose
   rendered identically. Found while building the original prototype.

   Poses drive the same class contract as before — greeting (dashboard),
   pointing (beside the top outstanding item), celebrating/dancing (everything
   done), resting (empty lists), thinking (while a long calculation renders) —
   so no call site changes. Never on the tax-return page, with ONE
   owner-approved exception (Phase 11 §4 Section 3, 2026-08): the reward
   card (renderReward(), 07-render-summary.js) — the one moment on that
   page framed as a celebration, not a figure someone is reading soberly.
   Everywhere else on that page, and every other figure on it, stays plain. */

/* One palette object for the whole character (spec §9.5). Fixed hues rather
   than theme tokens: the animal is the same animal in both themes, and its
   own rim light is what separates it from the ground. */
export const KAT_SCHEME = {
  hi: '#F0D3A6',      /* lit side of the fur      */
  fur: '#D6A86E',     /* mid fur                  */
  dark: '#A87A45',    /* shadow side, limbs, ears */
  tailTip: '#7A5730',
  belly: '#FBEEDA',
  bellyD: '#EAD3AE',
  inner: '#C98F86',   /* inner ear */
  paw: '#8F6536',
  patch: '#4A3520',
  iris: '#7A5228',
  irisHi: '#B98A4A',
  pupil: '#160F08',
  brow: '#6B4A26',
  blush: '#E8895F',
  nose: '#2E2013',
  rim: '#FFF3DF',
  ink: '#1A1209',
  stripe: '#6E4B23',
  claw: '#4A3520'
};

/* Gradient ids must be unique per instance or the first mascot on a page wins
   and every later one inherits its fills. */
let _katUid = 0;

export function katBody(s, uid) {
  const g = (n) => 'mk-' + uid + '-' + n;
  return ''
    /* ---- defs: the face's head/iris gradients + the body/belly gradients ---- */
    + '<defs>'
    + '<radialGradient id="' + g('head') + '" cx="34%" cy="24%" r="78%">'
      + '<stop offset="0%" stop-color="' + s.hi + '"/><stop offset="58%" stop-color="' + s.fur + '"/><stop offset="100%" stop-color="' + s.dark + '"/>'
    + '</radialGradient>'
    + '<linearGradient id="' + g('body') + '" x1="0" y1="0" x2="1" y2="0">'
      + '<stop offset="0%" stop-color="' + s.dark + '"/><stop offset="36%" stop-color="' + s.fur + '"/><stop offset="74%" stop-color="' + s.hi + '"/><stop offset="100%" stop-color="' + s.fur + '"/>'
    + '</linearGradient>'
    + '<linearGradient id="' + g('belly') + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + s.belly + '"/><stop offset="100%" stop-color="' + s.bellyD + '"/>'
    + '</linearGradient>'
    + '<radialGradient id="' + g('iris') + '" cx="38%" cy="32%" r="72%">'
      + '<stop offset="0%" stop-color="' + s.irisHi + '"/><stop offset="100%" stop-color="' + s.iris + '"/>'
    + '</radialGradient>'
    + '</defs>'

    /* ---- contact shadow: spans feet AND the planted tail tip — the tripod's three points ---- */
    + '<ellipse class="mk-shadow" cx="50" cy="117.5" rx="25" ry="4" fill="' + s.ink + '" opacity=".18"/>'

    + '<g class="mk-body">'

    /* ===== BODY: elongated sentinel torso, tail planted as the third leg ===== */
    /* tail: thick at the base, tapering, grounded rather than curling behind */
    + '<g class="mk-tail">'
      + '<path d="M44 103 C 53 109 60 113.5 68 117" stroke="' + s.dark + '" stroke-width="5.6" stroke-linecap="round" fill="none"/>'
      + '<path d="M62 114.4 C 65 115.8 66.6 116.4 68.4 117.2" stroke="' + s.tailTip + '" stroke-width="4.6" stroke-linecap="round" fill="none"/>'
    + '</g>'

    /* narrow shoulders, deeper haunch — the shape that carries the silhouette */
    + '<path d="M44 51 C 55 51 59.5 66 59.5 82 C 59.5 99 53.5 110.5 44 110.5 C 34.5 110.5 28.5 99 28.5 82 C 28.5 66 33 51 44 51 Z" fill="url(#' + g('body') + ')"/>'
    + '<ellipse cx="44" cy="87" rx="9.8" ry="16.6" fill="url(#' + g('belly') + ')" opacity=".9"/>'

    /* faint transverse flank banding — the field mark, kept subtle so it never reads as stripes */
    + '<path d="M30.2 71.5 Q34.6 73.4 38 73.2" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".17"/>'
    + '<path d="M57.8 71.5 Q53.4 73.4 50 73.2" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".17"/>'
    + '<path d="M29.4 80 Q34 82 37.6 81.8" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".15"/>'
    + '<path d="M58.6 80 Q54 82 50.4 81.8" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".15"/>'
    + '<path d="M29.8 88.5 Q34.2 90.4 37.6 90.2" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".13"/>'
    + '<path d="M58.2 88.5 Q53.8 90.4 50.4 90.2" stroke="' + s.stripe + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".13"/>'

    + '<path d="M55.6 62 C 59 69.5 60 78 59.4 87" stroke="' + s.rim + '" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".24"/>'

    /* forelimbs held close to the chest, with digging claws */
    + '<g class="mk-arm mk-arm-l">'
      + '<path d="M35 66 C 31.6 72 32.2 79 35.8 82.6" stroke="' + s.dark + '" stroke-width="5" stroke-linecap="round" fill="none"/>'
      + '<ellipse cx="36.4" cy="83.8" rx="3.5" ry="2.9" fill="' + s.paw + '" transform="rotate(-14 36.4 83.8)"/>'
      + '<path d="M34.2 86 l-1.3 3.4 M36.5 86.6 l-.2 3.6 M38.7 85.8 l1.1 3.2" stroke="' + s.claw + '" stroke-width="1.3" stroke-linecap="round" fill="none"/>'
    + '</g>'
    + '<g class="mk-arm mk-arm-r">'
      + '<path d="M53 66 C 56.4 72 55.8 79 52.2 82.6" stroke="' + s.dark + '" stroke-width="5" stroke-linecap="round" fill="none"/>'
      + '<ellipse cx="51.6" cy="83.8" rx="3.5" ry="2.9" fill="' + s.paw + '" transform="rotate(14 51.6 83.8)"/>'
      + '<path d="M53.8 86 l1.3 3.4 M51.5 86.6 l.2 3.6 M49.3 85.8 l-1.1 3.2" stroke="' + s.claw + '" stroke-width="1.3" stroke-linecap="round" fill="none"/>'
    + '</g>'

    + '<ellipse cx="37.4" cy="109.4" rx="6.4" ry="3.6" fill="' + s.paw + '"/>'
    + '<ellipse cx="50.6" cy="109.4" rx="6.4" ry="3.6" fill="' + s.paw + '"/>'

    /* ===== HEAD: unchanged from the appealing-shape build, kept for legibility at small sizes ===== */
    + '<g class="mk-head">'
      /* ears */
      + '<g class="mk-ear mk-ear-l"><circle cx="25.8" cy="21.5" r="7.4" fill="' + s.dark + '"/><circle cx="26.4" cy="22.2" r="4.2" fill="' + s.inner + '"/></g>'
      + '<g class="mk-ear mk-ear-r"><circle cx="62.2" cy="21.5" r="7.4" fill="' + s.dark + '"/><circle cx="61.6" cy="22.2" r="4.2" fill="' + s.inner + '"/></g>'

      /* cranium */
      + '<ellipse cx="44" cy="35.5" rx="21.8" ry="21.6" fill="url(#' + g('head') + ')"/>'
      + '<path d="M57.8 22.5 C 62.4 26.8 64 32 63.2 37.6" stroke="' + s.rim + '" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".28"/>'

      /* muzzle */
      + '<ellipse cx="44" cy="45.8" rx="11.4" ry="8.8" fill="url(#' + g('belly') + ')"/>'
      + '<ellipse cx="44" cy="43.4" rx="7.2" ry="5.4" fill="' + s.hi + '" opacity=".45"/>'

      /* eye patches — the meerkat signature, kept soft-edged */
      + '<ellipse cx="34" cy="33" rx="8.7" ry="7.6" fill="' + s.patch + '" opacity=".9" transform="rotate(-11 34 33)"/>'
      + '<ellipse cx="54" cy="33" rx="8.7" ry="7.6" fill="' + s.patch + '" opacity=".9" transform="rotate(11 54 33)"/>'

      /* eyes: large, low-set, two-point catchlight */
      + '<g>'
        + '<ellipse cx="34.6" cy="33.2" rx="6.3" ry="6.6" fill="#FFFFFF"/>'
        + '<circle cx="35.4" cy="33.9" r="4.3" fill="url(#' + g('iris') + ')"/>'
        + '<circle cx="35.6" cy="34.1" r="2.5" fill="' + s.pupil + '"/>'
        + '<circle cx="33.3" cy="31.5" r="1.75" fill="#fff"/>'
        + '<circle cx="37.2" cy="35.9" r=".95" fill="#fff" opacity=".72"/>'
        + '<ellipse class="mk-lid mk-lid-l" cx="34.6" cy="33.2" rx="6.4" ry="6.7" fill="' + s.patch + '"/>'
      + '</g>'
      + '<g>'
        + '<ellipse cx="53.4" cy="33.2" rx="6.3" ry="6.6" fill="#FFFFFF"/>'
        + '<circle cx="52.6" cy="33.9" r="4.3" fill="url(#' + g('iris') + ')"/>'
        + '<circle cx="52.4" cy="34.1" r="2.5" fill="' + s.pupil + '"/>'
        + '<circle cx="50.6" cy="31.5" r="1.75" fill="#fff"/>'
        + '<circle cx="54.4" cy="35.9" r=".95" fill="#fff" opacity=".72"/>'
        + '<ellipse class="mk-lid mk-lid-r" cx="53.4" cy="33.2" rx="6.4" ry="6.7" fill="' + s.patch + '"/>'
      + '</g>'

      /* brows carry the expression: neutral at rest, raised on cheer */
      + '<path class="mk-brow mk-brow-l" d="M28.4 23.6 Q34.4 21.2 40.2 23.4" stroke="' + s.brow + '" stroke-width="1.9" stroke-linecap="round" fill="none" opacity=".75"/>'
      + '<path class="mk-brow mk-brow-r" d="M47.8 23.4 Q53.6 21.2 59.6 23.6" stroke="' + s.brow + '" stroke-width="1.9" stroke-linecap="round" fill="none" opacity=".75"/>'

      /* cheeks */
      + '<ellipse cx="26.5" cy="42.5" rx="4.2" ry="2.7" fill="' + s.blush + '" opacity=".3"/>'
      + '<ellipse cx="61.5" cy="42.5" rx="4.2" ry="2.7" fill="' + s.blush + '" opacity=".3"/>'

      /* nose + mouth: closed smile at rest, open smile on cheer */
      + '<ellipse cx="44" cy="41.6" rx="3.3" ry="2.5" fill="' + s.nose + '"/>'
      + '<ellipse cx="42.9" cy="40.7" rx="1.1" ry=".75" fill="#fff" opacity=".38"/>'
      + '<path class="mk-mouth-rest" d="M44 44.2 v1.9 M39.9 47.4 Q44 50.6 48.1 47.4" stroke="' + s.nose + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>'
      + '<path class="mk-mouth-open" d="M44 44.2 v1.4 M39.2 46.9 Q44 53.4 48.8 46.9 Q44 48.6 39.2 46.9 Z" fill="' + s.nose + '" stroke="' + s.nose + '" stroke-width="1.4" stroke-linejoin="round" opacity="0"/>'
    + '</g>'   /* /head */

    /* thought bubbles — app-specific pose, hidden unless .thinking */
    + '<circle class="mk-think mk-t1" cx="68" cy="26" r="2.4" fill="' + s.dark + '"/>'
    + '<circle class="mk-think mk-t2" cx="74" cy="18" r="3.1" fill="' + s.dark + '"/>'
    + '<circle class="mk-think mk-t3" cx="81" cy="9" r="3.8" fill="' + s.dark + '"/>'

    + '</g>';  /* /body */
}

/* QR11 (Q-MOT-1, QD-21): which reaction each app event plays on a mascot that
   is already on the page. The owner chose the prototype's "expressive" column
   for every event (_mockups/qa-remediation-2026-09-motion.html); the classes
   are defined in main.css and each runs no longer than 1.2s. Consumer:
   katReact() (02-core.js). */
export const KAT_REACTIONS = {
  entry:       'x-wave2',    // arriving on a page — two waves
  saved:       'x-cheer1',   // an item was saved — one cheer
  step:        'x-tick',     // a step was completed — double nod, paw raised
  outstanding: 'x-point2',   // something is still to add — points at the list
  invalid:     'x-shake',    // an implausible value — concern and a head shake
  backup:      'x-attn2',    // the backup reminder — two arm pumps
};
/* Long idle (QD-21: idle has no intensity): the look-around after 20s without
   input, eyes shut after 60s; any input wakes it. */
export const KAT_IDLE_MS = { bored: 20000, resting: 60000 };
/* QD-22: wizard step → step plays 'A' (triangle tessellation). The owner's own
   gate is 60fps on a low-end Android WebView; if a device check fails it, set
   this to 'B' (the edge sweep) — nothing else changes. */
export const STEP_TRANSITION = 'A';

export function katHtml(pose, size) {
  const px = size || 40;
  /* The character is 88x122 in its own units — taller than wide, because the
     sentinel stance IS the silhouette. Height is derived from the caller's
     width so the tripod never gets squashed. */
  const h = Math.round(px * 122 / 88);
  return '<svg class="kat mk ' + esc_(pose || 'greeting') + '" viewBox="0 0 88 122" aria-hidden="true"'
    + ' style="width:' + px + 'px;height:' + h + 'px">'
    + katBody(KAT_SCHEME, 'k' + (++_katUid)) + '</svg>';
}
function esc_(v) { return String(v).replace(/[^a-z]/gi, ''); }

/* ── PHASE 3 (D1): SECTION ICON SET ─────────────────────────────────────────
   Purpose-drawn two-tone icons for the surfaces the owner named — dashboard
   areas, the income and "what you can claim" selector rows, launch chips and
   outstanding items.

   Why not keep the icon font everywhere: the font's glyphs are single-weight
   silhouettes drawn for body text. At the 28-34px badge sizes these surfaces
   use, on a saturated colour chip, a flat silhouette reads as generic — the
   "old clip art" note in the feedback. Each icon here is drawn as two layers:
   a soft mass (`ic-bk`, currentColor at low alpha) and the defining strokes
   on top (`ic-fg`, full currentColor), which gives depth and keeps the
   subject legible small. Everything is currentColor, so an icon inherits
   whatever the chip it sits in is already using and needs no per-theme work.

   24x24 viewBox throughout. Kept here (not in a render module) because it is
   a data table, and every module imports from 01-data (hard rule 5/10).

   The icon font is NOT removed — it still serves the long tail of one-off
   glyphs. This set covers the recurring, high-traffic subjects only. */
export const ICONS = {
  /* Income — money bag. */
  income: '<path class="ic-bk" d="M12 7c4.2 0 8 4.1 8 8.6 0 3.2-2.6 5.4-8 5.4s-8-2.2-8-5.4C4 11.1 7.8 7 12 7Z"/>'
    + '<path class="ic-fg" d="M8.6 3.3a.7.7 0 0 1 .6-1h5.6a.7.7 0 0 1 .6 1L14.2 6H9.8L8.6 3.3Z"/>'
    + '<path class="ic-fg" d="M10 11h2.6a1.9 1.9 0 0 1 0 3.8H10V11Zm0 3.8h1.4l1.7 2.6" '
    + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',

  /* Deductions and Retirement — piggy bank. */
  pig: '<path class="ic-bk" d="M2.6 12.4c0-3.6 3.6-6.2 8.2-6.2 1.5 0 2.9.3 4.1.8l2.5-1.6a.6.6 0 0 1 .9.6l-.4 2.6c1.2 1 1.9 2.3 1.9 3.8 0 .8.7.9.9 1.6.2.8-.4 1.6-1.2 1.6h-.9c-.5.8-1.2 1.5-2.1 2v1.7a.9.9 0 0 1-.9.9h-1.5a.9.9 0 0 1-.9-.9v-.8a12 12 0 0 1-4.8 0v.8a.9.9 0 0 1-.9.9H5.9a.9.9 0 0 1-.9-.9v-2C3.5 16.2 2.6 14.4 2.6 12.4Z"/>'
    + '<circle class="ic-fg" cx="7.2" cy="11.6" r="1.25"/>'
    + '<path class="ic-fg" d="M2.9 10.4a2.1 2.1 0 0 1-1.7-2.1.5.5 0 0 1 .8-.4l2 1.4-1.1 1.1Z"/>'
    + '<path class="ic-fg" d="M10.5 5.4a2.4 2.4 0 0 1 3 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',

  /* Tax — balance scale. */
  tax: '<path class="ic-bk" d="M2 12.4 5 6.6l3 5.8c0 1.5-1.3 2.5-3 2.5s-3-1-3-2.5Zm14 0 3-5.8 3 5.8c0 1.5-1.3 2.5-3 2.5s-3-1-3-2.5Z"/>'
    + '<path class="ic-fg" d="M12 3.4v16.2M7.4 20.6h9.2M5 6.6h14" fill="none" stroke="currentColor" '
    + 'stroke-width="1.7" stroke-linecap="round"/>'
    + '<circle class="ic-fg" cx="12" cy="5.2" r="1.5"/>',

  /* Dashboard - segmented dial. */
  dashboard: '<path class="ic-bk" d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4v1.2H3.6V12A8.4 8.4 0 0 1 12 3.6Z"/>'
    + '<path class="ic-fg" d="M12 13.2 16.9 7.7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'
    + '<circle class="ic-fg" cx="12" cy="13.4" r="2.1"/>'
    + '<path class="ic-fg" d="M3.4 17.5h17.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',

  /* Medical — cross in a rounded shield. */
  medical: '<path class="ic-bk" d="M12 2.4 20 5v7c0 4.4-3.3 8.1-8 9.6-4.7-1.5-8-5.2-8-9.6V5l8-2.6Z"/>'
    + '<path class="ic-fg" d="M10.6 7.6h2.8v2.9h2.9v2.8h-2.9v2.9h-2.8v-2.9H7.7v-2.8h2.9V7.6Z"/>',

  /* Contributions - stack of coins. */
  coins: '<ellipse class="ic-bk" cx="12" cy="16.4" rx="7.6" ry="3"/>'
    + '<ellipse class="ic-bk" cx="12" cy="12.3" rx="7.6" ry="3"/>'
    + '<ellipse class="ic-bk" cx="12" cy="8.2" rx="7.6" ry="3"/>'
    + '<ellipse class="ic-fg" cx="12" cy="8.2" rx="7.6" ry="3" fill="none" stroke="currentColor" stroke-width="1.5"/>'
    + '<path class="ic-fg" d="M4.4 8.2v8.2c0 1.7 3.4 3 7.6 3s7.6-1.3 7.6-3V8.2" fill="none" '
    + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '<path class="ic-fg" d="M4.4 12.3c0 1.7 3.4 3 7.6 3s7.6-1.3 7.6-3" fill="none" '
    + 'stroke="currentColor" stroke-width="1.3"/>',

  /* Travel - car. */
  travel: '<path class="ic-bk" d="M3 13.4 4.9 8A2.4 2.4 0 0 1 7.2 6.4h9.6A2.4 2.4 0 0 1 19.1 8l1.9 5.4v4.2a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-1H6.6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.2Z"/>'
    + '<path class="ic-fg" d="M4.6 13.1h14.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '<path class="ic-fg" d="M6.2 12.6 7.6 8.4h8.8l1.4 4.2" fill="none" stroke="currentColor" '
    + 'stroke-width="1.4" stroke-linejoin="round"/>'
    + '<circle class="ic-fg" cx="7.3" cy="15.9" r="1.35"/><circle class="ic-fg" cx="16.7" cy="15.9" r="1.35"/>',

  /* Home office - house with a desk screen. */
  homeoffice: '<path class="ic-bk" d="M12 3.2 21 10v9.6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10l9-6.8Z"/>'
    + '<path class="ic-fg" d="M2.5 10.5 12 3.2l9.5 7.3" fill="none" stroke="currentColor" '
    + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<rect class="ic-fg" x="8.3" y="12" width="7.4" height="5.1" rx="1"/>'
    + '<path class="ic-fg" d="M9.7 19.3h4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',

  /* Tools & equipment - spanner. */
  tools: '<path class="ic-bk" d="M21.1 4.3 18 7.4l-2.8-.6-.6-2.8 3.1-3.1a5.6 5.6 0 0 0-6.9 6.9l-8.1 8.1a2.4 2.4 0 1 0 3.4 3.4l8.1-8.1a5.6 5.6 0 0 0 6.9-6.9Z"/>'
    + '<path class="ic-fg" d="M21.1 4.3 18 7.4l-2.8-.6-.6-2.8 3.1-3.1a5.6 5.6 0 0 0-6.9 6.9l-8.1 8.1a2.4 2.4 0 1 0 3.4 3.4l8.1-8.1a5.6 5.6 0 0 0 6.9-6.9Z" '
    + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<circle class="ic-fg" cx="4.9" cy="19.1" r="1.25"/>',

  /* Donations — hand holding a heart. */
  donations: '<path class="ic-bk" d="M2.6 13.6a1.6 1.6 0 0 1 2.2-.5l3 1.8h4a1.5 1.5 0 0 1 0 3H9.4l4.2.6 6-2.7a1.6 1.6 0 0 1 1.4 2.9l-6.4 3.2a3 3 0 0 1-1.9.2l-8-1.7a1.6 1.6 0 0 1-1.2-1.1l-.9-5.7Z"/>'
    + '<path class="ic-fg" d="M12 10.8 8.6 7.6a2.5 2.5 0 0 1 3.4-3.6 2.5 2.5 0 0 1 3.4 3.6L12 10.8Z"/>',

  /* Professional subscriptions — ID badge. */
  subscrip: '<rect class="ic-bk" x="3.4" y="4.6" width="17.2" height="16" rx="2.4"/>'
    + '<path class="ic-fg" d="M9.6 2.2h4.8a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1H9.6a1 1 0 0 1-1-1V3.2a1 1 0 0 1 1-1Z"/>'
    + '<circle class="ic-fg" cx="12" cy="12" r="2.3"/>'
    + '<path class="ic-fg" d="M8.2 18a3.9 3.9 0 0 1 7.6 0" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"/>',

  /* Subsistence — suitcase. */
  subsistence: '<rect class="ic-bk" x="2.6" y="7" width="18.8" height="13" rx="2.2"/>'
    + '<path class="ic-fg" d="M9 7V4.8a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 4.8V7" fill="none" '
    + 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path class="ic-fg" d="M2.6 12.4h18.8" fill="none" stroke="currentColor" stroke-width="1.5"/>',

  /* Foreign - globe. */
  foreign: '<circle class="ic-bk" cx="12" cy="12" r="9.2"/>'
    + '<circle class="ic-fg" cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path class="ic-fg" d="M2.9 9.1h18.2M2.9 14.9h18.2" fill="none" stroke="currentColor" stroke-width="1.35"/>'
    + '<ellipse class="ic-fg" cx="12" cy="12" rx="4.1" ry="9.2" fill="none" stroke="currentColor" stroke-width="1.35"/>',

  /* Investment — rising bars with a trend line. */
  investment: '<rect class="ic-bk" x="3" y="12.4" width="4.2" height="8.2" rx="1.2"/>'
    + '<rect class="ic-bk" x="9.9" y="9" width="4.2" height="11.6" rx="1.2"/>'
    + '<rect class="ic-bk" x="16.8" y="5.2" width="4.2" height="15.4" rx="1.2"/>'
    + '<path class="ic-fg" d="m4 9.6 5.2-4 3.6 2.6 6-5.2" fill="none" stroke="currentColor" '
    + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',

  /* Rental - house with a key. */
  rental: '<path class="ic-bk" d="M12 3.2 21 10v9.6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10l9-6.8Z"/>'
    + '<path class="ic-fg" d="M2.5 10.5 12 3.2l9.5 7.3" fill="none" stroke="currentColor" '
    + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle class="ic-fg" cx="9.7" cy="13.9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
    + '<path class="ic-fg" d="m11.6 15.7 4.7 4.7m-2.1-2.1 1.4-1.4" fill="none" stroke="currentColor" '
    + 'stroke-width="1.8" stroke-linecap="round"/>',

  /* Business — briefcase. */
  business: '<rect class="ic-bk" x="2.6" y="7" width="18.8" height="13.4" rx="2.2"/>'
    + '<path class="ic-fg" d="M8.6 7V5.2a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6V7" fill="none" '
    + 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path class="ic-fg" d="M2.6 12.6c3 1.4 6.1 2.1 9.4 2.1s6.4-.7 9.4-2.1" fill="none" '
    + 'stroke="currentColor" stroke-width="1.5"/>'
    + '<rect class="ic-fg" x="10.5" y="13.2" width="3" height="2.6" rx=".8"/>',

  /* Capital gains — upward arrow out of a base. */
  cgt: '<path class="ic-bk" d="M3.4 20.4V15a1.3 1.3 0 0 1 1.3-1.3h3a1.3 1.3 0 0 1 1.3 1.3v5.4H3.4Zm6.9 0V11a1.3 1.3 0 0 1 1.3-1.3h1.4A1.3 1.3 0 0 1 14.3 11v9.4h-4Z"/>'
    + '<path class="ic-fg" d="M15.6 20.4V7.4a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v13h-5Z"/>'
    + '<path class="ic-fg" d="M2.6 9.4 8.8 4l3.4 2.8L19 2" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>',

  /* Crypto — coin with the rand-agnostic block glyph. */
  crypto: '<circle class="ic-bk" cx="12" cy="12" r="9.2"/>'
    + '<path class="ic-fg" d="M9.4 7.4h3.9a2.4 2.4 0 0 1 0 4.8H9.4V7.4Zm0 4.8h4.3a2.4 2.4 0 0 1 0 4.8H9.4v-4.8Z" '
    + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<path class="ic-fg" d="M11 5.6v1.8m2.4-1.8v1.8M11 16.9v1.8m2.4-1.8v1.8" fill="none" '
    + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

  /* PAYE — bank columns. */
  paye: '<path class="ic-bk" d="M12 2.6 21.4 8v1.6H2.6V8L12 2.6Z"/>'
    + '<path class="ic-fg" d="M5.4 11.2v6.4m4.4-6.4v6.4m4.4-6.4v6.4m4.4-6.4v6.4" fill="none" '
    + 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
    + '<path class="ic-fg" d="M3.2 20.2h17.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',

  /* Prior-year balances — clock with a return arrow. */
  prioryear: '<circle class="ic-bk" cx="12.6" cy="12.6" r="8.4"/>'
    + '<path class="ic-fg" d="M12.6 8v4.8l3.2 1.9" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path class="ic-fg" d="M4.4 8.2V3.8m0 4.4h4.4" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round"/>',

  /* Other receipts — till slip. */
  other: '<path class="ic-bk" d="M4.4 2.8h15.2v18.4l-2.5-1.4-2.5 1.4-2.6-1.4-2.6 1.4-2.5-1.4-2.5 1.4V2.8Z"/>'
    + '<path class="ic-fg" d="M8 8h8M8 11.6h8M8 15.2h5" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"/>',

  /* The return itself — document with a check. */
  ret: '<path class="ic-bk" d="M5.4 2.8h8L19.6 9v12.2a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z"/>'
    + '<path class="ic-fg" d="M13.2 2.8V8a1 1 0 0 0 1 1h5.2" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linejoin="round"/>'
    + '<path class="ic-fg" d="m8.2 15 2.6 2.6 5-5.2" fill="none" stroke="currentColor" '
    + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
};

/* Which drawn icon each DEDUCTION_DEFS id and income-selector tab uses.
   Kept beside ICONS so adding an icon and adopting it is one edit, and so a
   selector row that has no drawn icon simply falls back to the icon font. */

/* Renders one ICONS entry. `extraClass` lets a call site scale or tint it.
   Falls back to an empty string for an unknown name so a bad key degrades to
   "no icon" rather than throwing inside a render loop. */
export function iconHtml(name, extraClass) {
  const body = ICONS[name];
  if (!body) return '';
  /* Class-name sanitiser, not esc_ — esc_ strips hyphens, which every class
     in this codebase uses. Attribute-safe by construction: the result can
     only contain [A-Za-z0-9_- ]. */
  const cls = extraClass ? ' ' + String(extraClass).replace(/[^a-z0-9_ -]/gi, '') : '';
  return '<svg class="ic' + cls + '" viewBox="0 0 24 24"'
    + ' aria-hidden="true" focusable="false">' + body + '</svg>';
}

/* Set of Material Symbols glyph names vendored into vendor/material-symbols.css
   (npm run vendor) — see tools/vendor-assets.js's MS_ICON_NAMES. Kept in sync
   by hand; `msIconHtml()` falls back to '' for anything not in this set so a
   typo degrades to "no icon" rather than an unstyled/blank glyph box. */
export const MS_ICON_SET = new Set([
  'accessible', 'account_balance', 'account_balance_wallet', 'account_tree', 'add', 'adjust',
  'agriculture', 'analytics', 'archive', 'arrow_back', 'arrow_downward', 'arrow_forward',
  'arrow_split', 'arrow_upward', 'assignment_late', 'auto_fix_high', 'backspace', 'backup', 'badge',
  'balance', 'bar_chart', 'beach_access', 'bolt', 'bug_report', 'business',
  'calculate', 'calendar_month', 'check', 'check_circle', 'checklist', 'chevron_left',
  'chevron_right', 'circle', 'clock_arrow_down', 'close', 'cloud_alert', 'cloud_done',
  'cloud_off', 'compare', 'construction', 'content_copy', 'contrast', 'credit_card_off', 'credit_score',
  'crown', 'currency_bitcoin', 'currency_exchange', 'dashboard', 'data_exploration', 'delete',
  'delete_forever', 'description', 'directions_car', 'donut_small', 'download', 'edit',
  'encrypted', 'encrypted_off', 'enhanced_encryption', 'error', 'event', 'event_available',
  'event_repeat', 'event_upcoming', 'expand_more', 'fact_check', 'finance_mode', 'flag', 'flight',
  'folder', 'format_list_numbered', 'functions', 'gavel', 'grid_view', 'handshake',
  'handyman', 'help', 'help_center', 'help_clinic', 'history', 'history_2',
  'history_edu', 'home', 'home_work', 'inbox', 'info', 'inventory_2',
  'key', 'lan', 'layers', 'lightbulb', 'list', 'local_shipping',
  'lock', 'lock_open', 'login', 'logout', 'looks_3', 'looks_one',
  'looks_two', 'luggage', 'medical_services', 'meeting_room', 'memory', 'menu',
  'menu_book', 'menu_open', 'money', 'money_range', 'monitor_heart', 'music_note',
  'no_encryption', 'note_stack_add', 'open_in_new', 'order_approve', 'paid', 'pause_circle',
  'payments', 'pending_actions', 'percent', 'person', 'person_add', 'person_edit',
  'person_remove', 'photo_camera', 'picture_as_pdf', 'pie_chart', 'price_check', 'progress_activity',
  'public', 'question_exchange', 'quick_reference', 'quiz', 'radio_button_checked', 'radio_button_unchecked',
  'real_estate_agent', 'receipt_long', 'redeem', 'replay', 'request_quote', 'restart_alt',
  'restaurant', 'restore_page', 'rule', 'savings', 'schedule', 'sd_card_alert',
  'settings', 'shield_question', 'shopping_cart', 'show_chart', 'speed', 'square_foot',
  'star', 'stethoscope', 'storefront', 'swap_horiz', 'swap_horizontal_circle', 'sync',
  'table_view', 'task_alt', 'timer', 'toggle_off', 'toggle_on', 'tooltip_2',
  'trending_down', 'trending_up', 'tune', 'undo', 'unfold_more', 'upload_file',
  'verified', 'verified_user', 'volunteer_activism', 'warning', 'waterfall_chart', 'wifi',
  'wifi_off', 'work', 'workspace_premium',
]);

/* Monochrome Material Symbols Outlined glyph, per the design-handoff icon
   migration (docs/design-handoff-qa-2026-08 §4/§6): vendored offline as a
   codepoint-subset webfont (vendor/material-symbols.css), addressed here by
   a `.msi-<hyphenated-name>` class rather than injecting the raw PUA
   character into markup. `extraClass` works the same as iconHtml()'s. */
export function msIconHtml(name, extraClass) {
  if (!MS_ICON_SET.has(name)) return '';
  const cls = extraClass ? ' ' + String(extraClass).replace(/[^a-z0-9_ -]/gi, '') : '';
  return '<span class="material-symbols-outlined msi-' + name.replace(/_/g, '-')
    + cls + '" aria-hidden="true"></span>';
}

/* B1 Simplification — page help, keyed by the audit's page key (the
   `.tab-section` id minus `tab-`, or a standalone `.mode-panel` id minus
   `mode-`). Written to the P3 voice from the start: second person, no
   statutory references, and answering what this page is / who it is for /
   what to do on it. Surfaced by the page ⓘ that `pageHead()` renders into
   the back bar, via the long-tip help sheet.

   Every page key the audit walks has an entry, including the pages that do
   not yet show a back bar (summary, projection, historical, and the five
   standalone panels) — the copy is the deliverable, the surface that
   displays it follows when those pages are restructured. */
export const PAGE_HELP = {

  /* ── Income ── */
  'income-main': "Everything you earned this tax year, in one place. Turn on the kinds of income that apply to you and a page appears for each one. What you turn on here decides what the rest of the app asks you.",
  'income-b1employment': "Your salary and everything else your employer paid you. Add one entry per source code from your IRP5 or IT3(a) certificate. These are already filled in on eFiling — copy them across exactly.",
  'income-paye': "The tax your employer already took off your pay before you got it. Add one entry per employer. Leaving this out makes your bill look far bigger than it is.",
  'income-b2investment': "Interest, dividends and other returns on your savings and investments. Add one entry per IT3(b) certificate from your bank or investment manager.",
  'income-b3rental': "What you make renting out property, after what it cost you. Add each property on its own — running costs and bond interest come off the rent.",
  'income-b4business': "Income from your own business, trade or freelance work. Add each business separately, then what it brought in and what it cost to run.",
  'income-b5cgt': "Add disposals of capital assets such as immovable property, shares, unit trusts, and certain business assets. Personal-use assets like your private cars and household goods are generally excluded. Add each disposal with what you paid for it, improvement costs, sales costs and what you sold it for. Include the sale of your primary residence — the exemption is calculated automatically.",
  'income-b6foreign': "Income you earned outside South Africa. You are taxed here on what you earn anywhere, but tax you already paid abroad may count against your bill.",
  'income-b7retirement': "Money from a pension, an annuity, or a pay-out from a retirement fund. Add each certificate — lump sums are taxed on their own tables, not together with your salary.",
  'income-b9other': "Anything you received that does not fit the other pages — maintenance, royalties, prizes, one-off amounts.",
  'income-b10crypto': "Disposals of crypto assets and other crypto income. The question that matters is whether your activity counts as investing or as trading — it changes how you are taxed.",

  /* ── Deductions ── */
  'ded-selections': "What you can claim to bring your tax down. Turn on the ones that apply to you and a page appears for each. Only claim what you could show proof of.",
  'ded-retirement': "What you paid into a pension fund, provident fund or retirement annuity this year. There is a yearly limit — anything over it is carried to next year, not lost.",
  'ded-medical': "Your medical scheme contributions and the medical costs you paid yourself. Everyone on a scheme gets a set monthly credit; costs above that may add a little more.",
  'ded-travel': "For a travel allowance or reimbursement for business travel. You need a logbook either way. Not for contractors, commission earners or the self-employed — their vehicle costs go under business expenses.",
  'ded-homeoffice': "A share of what it costs to run your home, if you work from it. The rules are strict: you need a room used only for work, and your employer must require you to work from home.",
  'ded-tools': "Tools and equipment you bought for your work. Cheaper items come off in full this year; bigger ones are spread over several years.",
  'ded-donations': "Donations to registered public benefit organisations. You need a section 18A receipt — an ordinary receipt or a thank-you letter will not do.",
  'ded-subscrip': "Fees for a professional body you have to belong to for your work.",
  'ded-subsistence': "Meals and day-to-day costs when work took you away overnight. There is a set daily amount you can claim without keeping every receipt.",
  'ded-additional': "Other deduction codes not covered by the pages here. Add the code and amount exactly as they appear on your certificate or assessment.",

  /* ── Tax return & risk ── */
  'summary-return': "Your full calculation, line by line, and what you owe or get back, worked out on that year's SARS tables.",
  'summary-risk': "Where your return might raise questions with SARS, and what to have ready if it does.",

  /* ── OD-18 (2026-09): Provisional Tax and the SARS Account, now real
     Taxation tabs. Were 'provtax' (a standalone mode) and 'income-prioryear'
     (a tab faking membership of Income) respectively. QA 2026-08 (B2-AC-B2-16):
     the page-head ⓘ and the "About this page" accordion at the foot of the
     SARS Account page must say the SAME thing — this is the source,
     body.html mirrors it. */
  'summary-provtax': "For income that nobody taxes before it reaches you. Shows what to pay, by when, and whether you are heading for a penalty.",
  'summary-prioryear': "Balances carried from one tax year into the next. Only opening balances are entered manually. Opening balances are found on the prior year's SARS assessment letter (ITA34) or personal records. Current year movements and year end balances are calculated automatically from amounts captured this year. Opening balances can be entered on this page or the home page of the balance (for example retirement deductions, donations, etc.). Only balances that apply are shown as outstanding.",

  /* ── Projection ── */
  'proj-scenario': "Set how much you expect your income and costs to grow, then see what that does to your tax in the years ahead.",
  'proj-multiyear': "What your tax looks like over the next few years, on the growth you set.",
  'proj-optimise': "Ways to bring your bill down, worked out from your own figures — mostly around what you put into retirement.",

  /* ── Historical (NAV-4: now Taxation tabs, key prefix 'summary-') ── */
  'summary-calculator': "Work out tax for an earlier year, using that year's rates and rebates rather than this year's.",
  'summary-comparison': "Put two tax years side by side to see what changed, and what caused it.",

  /* ── Standalone panels ── */
  'dashboard': "Where you stand right now. Work down the steps to finish your return — the figure at the top updates as you go.",
  'actref': "The parts of the Income Tax Act behind these calculations, with the rate tables for each year.",
  'taxfaqs': "Straight answers to the questions that come up most often.",
  'subscribe': "What each plan includes, and what is unlocked on your account right now."
};

/* STD-IA-3 (design-system-audit-2026-09 §L.9): the single source for a help
   topic that appears BOTH as a page-level "About X" accordion (body.html,
   populated at boot by renderTopicHelpAccordions() in 00-forms.js) AND in
   that topic's add/edit modal (00-forms.js CFG_* `notes: [TOPIC_HELP.x]`).
   The two copies had drifted — each held true facts the other omitted,
   confirmed by reading both before merging rather than assuming either was
   current, per the audit's explicit warning. Every entry below is the
   union of both prior texts, not a pick of one side. HTML entities match
   how these values are used: renderModal() (00-forms.js) interpolates them
   straight into modal markup, so `&amp;` is authored here exactly as it
   would be in body.html. Not every modal `notes` topic has a page-level
   duplicate (e.g. two-pot, foreign-fund lump sums, tools & equipment) —
   those stay defined inline in 00-forms.js; only topics that genuinely
   existed in both places move here. */
export const TOPIC_HELP = {
  irp5: {
    summary: 'ⓘ About IRP5 &amp; IT3(a) certificates',
    body: 'IRP5 certificates are issued by your employer for employment income. An IT3(a) is the same certificate for remuneration where no employees’ tax was withheld — pension and annuity income is the most common case, but not the only one. Enter amounts exactly as they appear on your certificate — they are pre-filled on eFiling. Retirement amounts are not entered here — use the retirement section instead.'
  },
  paye: {
    summary: 'ⓘ About PAYE &amp; UIF',
    body: 'If you had multiple employers during the tax year, add each one separately. PAYE is the total tax withheld — used to calculate your refund or amount owing. UIF is for record-keeping only and does not affect your income tax calculation. Amounts are pre-filled on eFiling from your IRP5(s).'
  },
  rental: {
    summary: 'ⓘ About rental income &amp; deductions',
    /* QR4.2/4.7: the how-to for each type is the Type field's own note (OPTION_NOTES),
       so this page-level overview names the types without instructing for one of them. */
    body: 'Add each rental separately — property, Airbnb / short-term let, equipment lease, vehicle lease or foreign lease. Choose the type and a note under the field explains how it is treated. Capital improvements are NOT deductible — they add to base cost for CGT.'
  },
  business: {
    summary: 'ⓘ About business &amp; trade income',
    body: 'Add each business or self-employment activity separately. Capture gross income and expenses — net profit (s11 ITA) is calculated automatically and added to taxable income. Foreign business: income is taxed in SA, but foreign tax paid may qualify for a tax credit (s6quat). Keep invoices and receipts for all expenses claimed.'
  },
  cgt: {
    summary: 'ⓘ About Capital Gains Tax',
    body: 'Only part of each net gain — the inclusion rate, after the annual exclusion — is included in taxable income (s26A, 8th Schedule); the calculation shows both figures for your tax year. Primary residence: the first part of the gain is excluded (also shown in the calculation). Capital losses are carried forward to future years — no expiry. A capital gain or loss does not apply to personal-use assets, like a private motor vehicle, furniture or appliances.'
  },
  donations: {
    summary: 'ⓘ About s18A donations',
    body: 'Donations to SARS-approved Public Benefit Organisations (PBOs) are deductible up to a yearly limit, set as a share of taxable income (s18A) — the Donations page shows yours — and only with a valid s18A certificate. Excess above the limit is not forfeited — it carries forward as a deemed donation next year, limited again then (s18A(1) proviso).'
  }
};

/* B1 Simplification — back bar configuration per page (01-SPEC.md P4, §4.1,
   §5.1). Keyed the same way as PAGE_HELP. Consumed by mountPageHeads()
   (13-patches.js), which renders pageHead() into each page.

   The two selector pages go back to the Dashboard; every capture page goes
   back to its selector. `title` is the page's own name — deliberately not
   read from TAB_TITLES, because the back bar names the page you are ON
   while TAB_TITLES also feeds the header for whole modes. */
export const PAGE_HEADS = {
  /* Income — the selector, then its capture pages */
  'income-main':        { backMode:'dashboard', backLabel:'Dashboard',      title:'Income' },
  'income-b1employment':{ backMode:'income', backTab:'main', backLabel:'Income', title:'Employment income' },
  'income-paye':        { backMode:'income', backTab:'main', backLabel:'Income', title:'PAYE' },
  'income-b2investment':{ backMode:'income', backTab:'main', backLabel:'Income', title:'Investment income' },
  'income-b3rental':    { backMode:'income', backTab:'main', backLabel:'Income', title:'Rental income' },
  'income-b4business':  { backMode:'income', backTab:'main', backLabel:'Income', title:'Business & trade' },
  'income-b5cgt':       { backMode:'income', backTab:'main', backLabel:'Income', title:'Capital gains & losses' },
  'income-b6foreign':   { backMode:'income', backTab:'main', backLabel:'Income', title:'Foreign income' },
  'income-b7retirement':{ backMode:'income', backTab:'main', backLabel:'Income', title:'Retirement income' },
  'income-b9other':     { backMode:'income', backTab:'main', backLabel:'Income', title:'Other income' },
  'income-b10crypto':   { backMode:'income', backTab:'main', backLabel:'Income', title:'Crypto & digital assets' },
  /* B9.1 (TAX-1/D-11, EXT-CMT-1) — Taxation's own six entries, following
     the Income/Deductions convention exactly: main page back → Dashboard,
     sub-pages back → Taxation. This replaces the OD-18 comment that used to
     stand here, which argued Taxation's tabs needed no back bar at all
     "because their own tab rail is always visible" — the owner's D-11
     instruction (verified correct against this same convention) overrides
     that. `summary-calculator`/`summary-comparison` are titled by their
     actual shipped tab labels ("Prior years"/"Projection", set by NAV-4's
     rename) rather than the internal sub-tab keys the batch doc names them
     after — a sub-page's back-bar title is its own visible name, per D-11,
     and that name is what the tab rail right below it already says. */
  'summary-return':     { backMode:'dashboard', backLabel:'Dashboard', title:'Taxation' },
  'summary-prioryear':  { backMode:'summary', backTab:'return', backLabel:'Taxation', title:'Tax balances' },
  'summary-provtax':    { backMode:'summary', backTab:'return', backLabel:'Taxation', title:'Provisional tax' },
  'summary-risk':       { backMode:'summary', backTab:'return', backLabel:'Taxation', title:'Tax risk' },
  'summary-calculator': { backMode:'summary', backTab:'return', backLabel:'Taxation', title:'Prior years' },
  'summary-comparison': { backMode:'summary', backTab:'return', backLabel:'Taxation', title:'Projection' },

  /* Deductions — the selector, then its capture pages */
  'ded-selections':  { backMode:'dashboard', backLabel:'Dashboard', title:'Deductions' },
  'ded-retirement':  { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Retirement contributions' },
  'ded-medical':     { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Medical' },
  'ded-travel':      { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Travel' },
  'ded-homeoffice':  { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Working from home' },
  'ded-tools':       { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Tools & equipment' },
  'ded-donations':   { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Donations' },
  'ded-subscrip':    { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Professional memberships' },
  'ded-subsistence': { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Away-from-home costs' },
  'ded-additional':  { backMode:'deductions', backTab:'selections', backLabel:'Deductions', title:'Other claims' }
};

export const FIELD_TIPS = {

  /* Income — main page */
  'tfi-prior': "The total you paid into tax-free investments in all earlier tax years, across every provider. Only used to check the lifetime limit — transfers between your own tax-free investments don't count.",
  py_loss: "A loss from last year that SARS confirmed in writing. It lowers this year's tax. Leave it blank if you're not sure.",

  /* Income — foreign */
  fs_qualifies: "Did you work outside South Africa more than 183 days, including one unbroken stretch over 60 days? If yes, some of that pay may be tax-free.",
  fs_days_outside: "How many workdays in the qualifying period were spent outside South Africa. Leave blank if you worked the whole period abroad — the full amount (up to the cap) is treated as exempt.",
  fs_days_total: "Total workdays for this employer in the same qualifying period. Used with the days outside SA to work out what share of your foreign pay is exempt.",
  "b6-catchall-amount": "Foreign money that doesn't fit the boxes above — royalties, a foreign pension, anything else.",
  "b6-catchall-tax": "Tax you already paid overseas on that amount. It may count against your bill here.",
  "b6-catchall-note": "A short note so you remember what this was. Optional.",
  "fxb6a-cur": "The foreign currency you were paid in. We'll convert it to Rand using the SARS average rate for the tax year.",
  "fxb6a-amt": "The amount in that foreign currency, before conversion.",
  "fxb6t-cur": "The foreign currency the tax was paid in.",
  "fxb6t-amt": "The tax amount in that foreign currency, before conversion.",

  /* Income — retirement */
  "prior-lumpsum-taxable": "Lump sums you took from a retirement fund in earlier years. SARS adds them up over your lifetime, so earlier ones affect this one.",
  py_ret_excess_ret: "Money you put into retirement in earlier years that hasn't been used yet. It's on last year's SARS letter.",

  /* SARS account — carried-forward balances */
  py_loss_sars: "A loss from last year that SARS confirmed in writing. It lowers this year's tax. Leave it blank if you're not sure.",
  cgt_loss_bf: "A loss from something you sold in an earlier year. It comes off gains you make now.",
  cgt_loss_bf_sars: "A loss from something you sold in an earlier year. It comes off gains you make now.",
  ftc_bf: "Tax you paid overseas in earlier years that you couldn't use yet. It carries over to this year.",
  ftc_bf_sars: "Tax you paid overseas in earlier years that you couldn't use yet. It carries over to this year.",
  py_ret_excess: "Money you put into retirement in earlier years that hasn't been used yet. It's on last year's SARS letter.",
  py_ret_excess_sars: "Money you put into retirement in earlier years that hasn't been used yet. It's on last year's SARS letter.",
  py_s18a_excess: "Charity donations from earlier years that were over the limit. They carry over and can be used now.",
  prior_lumpsum_bf_sars: "The running total of every retirement lump sum you've ever received. It decides which tax bracket your next one falls into.",
  /* QA 2026-08 rev-1 (§6, Tax balances note 9): the B1-22 toggle model's
     per-row switch — declares whether this balance applies to you at all. */
  'bal-retexcess-toggle': "Turn this on if you have non-deducted retirement contributions to carry forward.",
  'bal-lumpsum-toggle':   "Turn this on if you've received a retirement lump sum before this tax year.",
  'bal-capital-toggle':   "Turn this on if you have capital losses carried forward.",
  'bal-donations-toggle': "Turn this on if you have donations not yet fully deducted.",
  'bal-ftc-toggle':       "Turn this on if you have unused foreign tax credits.",
  'bal-loss-toggle':      "Turn this on if you have a prior-year assessed loss.",

  /* Income — investments */
  int_age_cat: "Your age group at the end of the tax year. From 65 you get a bigger tax-free amount on interest.",
  int_gross: "Total interest your bank and investments paid you this year. It's on the certificate they send you.",

  /* Deductions — retirement */
  ded_pension: "What you paid into your pension fund this year. It's on your IRP5 next to 4001.",
  ded_provident: "What you paid into your provident fund this year. It's on your IRP5 next to 4003.",
  ded_ra: "What you paid into a retirement annuity this year. Your fund sends you a certificate.",

  /* Deductions — medical */
  med_members: "Count everyone your medical aid covers, including yourself. Two people means you and one other.",
  p_medscheme: "The name of your medical aid. Optional — it doesn't change your tax.",
  med_monthly: "What you paid into your medical aid over the year. Add the monthly amounts together.",
  med_employer: "What your employer paid into your medical aid. It's on your IRP5.",
  med_oop: "Medical costs you paid yourself and were never paid back for — doctors, dentists, prescriptions.",
  med_disability: "Tick this if you, your spouse, or your child has a disability confirmed by a doctor on the SARS form.",

  /* Deductions — travel */
  tv_vehicle_val: "What the car cost, including VAT. If you lease it, use the cash price on the agreement.",
  tv_date_acq: "When you started using the car. Only needed if that was partway through the year.",
  tv_odo_open: "What the odometer read at the start of the tax year, or the day you got the car.",
  tv_odo_close: "What the odometer read at the end of the tax year.",
  tv_bus_km: "Kilometres you drove for work, from your logbook. Home to office doesn't count.",
  tv_fuel: "What you spent on fuel for the year. Only fill this in if you're claiming actual costs.",
  tv_maint: "What you spent on services, repairs and tyres for the year.",
  tv_insure: "What you paid to insure and licence the car for the year.",
  tv_finance: "Interest on the loan you used to buy the car — just the interest, not the whole instalment.",
  tv_lease_pay: "What you paid to lease the car this year.",

  /* Deductions — company car (B-2, Seventh Schedule para 7) */
  cc_odo_open: "What the odometer read at the start of the tax year, or the day you got the car.",
  cc_odo_close: "What the odometer read at the end of the tax year.",
  cc_bus_km: "Kilometres you drove for work, from your logbook. Home to office doesn't count.",
  cc_fuel_borne: "Say yes only if you paid for ALL the fuel yourself — not if your employer covered any of it.",
  cc_fuel_cost: "What you spent on fuel for the year.",
  cc_maint_borne: "Say yes only if you paid for ALL the servicing, repairs and tyres yourself — not if your employer's maintenance plan covered any of it.",
  cc_maint_cost: "What you spent on servicing, repairs and tyres for the year.",
  cc_consideration: "Any amount you paid your employer for the right to use the car. Most people leave this at zero.",

  /* Deductions — working from home */
  ho_ownership: "Do you own this home or rent it? It changes which costs you can count.",
  ho_exclusive: "Is the room only for work, never for anything else? If it doubles as a guest room or a corner of a living room, it doesn't qualify.",
  ho_area_total: "The floor size of your whole home, in square metres.",
  ho_area_office: "The floor size of the room you work in. It has to be used only for work.",
  ho_months_used: "How many months of the year you used that room for work.",
  ho_rent: "What you paid in rent for the year.",
  ho_bond_int: "Interest on your home loan for the year — not the whole instalment. Your bank sends a statement.",
  ho_rates: "Rates and taxes on the property for the year.",
  ho_elec: "What you spent on electricity for the year.",
  ho_levies: "Body corporate or estate levies for the year.",
  ho_phone: "Phone and internet you used for work.",
  ho_other_direct: "Anything else that was only for the work room — repairs to it, for example.",

  /* Deductions — other */
  ded_subscrip: "Fees for a professional body you have to belong to for your work.",
  "subsistence-days": "Nights you slept away from home for work.",
  "subsistence-rate-type": "Was your accommodation paid for separately from your daily allowance? The deemed daily rate differs depending on the answer.",
  "fs-sub-country": "The country you travelled to. SARS publishes a different deemed daily rate for each one.",
  "fs-sub-days": "Nights you slept away from home on this trip.",

  /* Projection and planner */
  "sl-income": "How much you expect your income to grow each year, as a percentage.",
  "sl-inflation": "How much you expect prices to rise each year. Keeps future amounts realistic.",
  "sl-medical": "How much you expect medical costs to rise each year.",
  "sl-years": "How many years ahead to look.",
  "proj-ra-method": "Add a fixed rand amount to retirement each year, or a percentage of your pay.",
  "sl-ra": "Extra rand you'd put into retirement each year.",
  "sl-ra-pct": "Extra percentage of your pay you'd put into retirement each year.",
  "proj-add-income": "Extra income you expect on top of what you've already captured.",
  "proj-cmp-year": "Pick a future year to set beside this year. The table shows both, and how much each figure changes by then.",
  "ra-topup-input": "How much more you're thinking of putting into retirement. We'll show what it saves you.",
  "lump-month": "Which month you expect the lump sum.",
  "lump-type": "Whether this is money coming in or a deduction going out — pick the closest match so the forecast adds or subtracts it correctly.",
  "lump-desc": "A short note so you remember what this was.",
  "lump-amount": "How much the lump sum is, before tax.",
  cyr_fc_cgt: "Profit you expect from selling something later this year.",
  cyr_fc_foreign: "Foreign income you expect for the rest of the year.",
  cyr_fc_ftc: "Tax you expect to pay overseas on that foreign income.",

  /* Provisional tax */
  p_prov_p1: "What you paid on your first provisional return, due end of August.",
  p_prov_p2: "What you paid on your second provisional return, due end of February.",
  p_prov_topup: "Any extra payment you made after year-end to avoid interest.",
  provtax_basic: "The taxable income SARS last assessed you on. It's on your assessment, and it sets your minimum payment.",

  /* Earlier-year calculator */
  "hist-year": "Which past tax year you want to work out.",
  "hist-age": "Your age at the end of that tax year.",
  "hist-gross": "Total pay before tax for that year.",
  "hist-other-inc": "Any other income that year — interest, rent, and so on.",
  "hist-cgt": "Profit from things you sold that year.",
  "hist-ret": "What you put into retirement funds that year.",
  "hist-travel": "Travel you claimed that year.",
  "hist-donations": "Charity donations that year.",
  "hist-other-ded": "Anything else you claimed that year.",
  "hist-main": "Were you the main member on a medical aid that year?",
  "hist-deps": "How many dependants were on your medical aid that year.",
  "hist-med-contrib": "What was paid into the medical aid that year.",
  "hist-med-oop": "Medical costs you paid yourself that year.",
  "hist-disability": "Was there a disability confirmed by a doctor that year?",
  "hist-paye": "Tax already taken off your pay that year.",
  "hist-compare-gross": "Pay before tax, so the years can be compared.",
  "ratetable-year-inline": "Pick a year to see the tax rates that applied then."
};



