/* Phase 1 audit runner — scenarios S1–S18 from docs/programmes/calc-audit-2026-09/test-fixtures.md.
 *
 * READ-ONLY against src/: boots the shipped artifact in Chromium (reusing
 * tests/harness.js, the same boot path every gate uses), hydrates APP from a
 * persona, and asserts calcFullTax() against the FIXED results Allan supplied.
 *
 * Only "fixed results" (plain arithmetic: sums, the s10(1)(i) interest
 * exemption, the 27.5%/R350k retirement cap, the CGT exclusion+inclusion) are
 * asserted here. Rate-dependent results (tax on income, rebates, medical
 * credits, lump-sum tax) are deliberately NOT asserted — per the brief they
 * must come from Allan's QA answer key, never from the app's own output.
 *
 * Usage (Windows, global playwright):
 *   NODE_PATH="C:/Users/User/AppData/Roaming/npm/node_modules" \
 *     node docs/programmes/calc-audit-2026-09/run-audit-fixtures.js
 *
 * This is Phase-1 audit tooling. The in-file debug harness the brief asks for
 * is built in Phase 3 and supersedes it.
 */
const path = require('path');
const { chromium, LAUNCH_OPTS, withPage, dobForAge: harnessDob } = require(path.resolve(__dirname, '../../../tests/harness.js'));

/* Extends tests/run-legislative.js's APPLY_PERSONA with the arrays these
   scenarios need that the legislative runner hard-zeroes (pensionAnnuityItems)
   and the sub-calculator results it injects via appliedValues. */
const APPLY = (p) => {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };

  set('taxYear', p.taxYear || '2026');
  /* S2 Batch 8: default cat from IRP5_CODE_MAP when a scenario doesn't
     specify one, matching what M_income.collect() (05-list-modules.js) sets
     for every real captured item — calcFullTax() never reads item.cat (it
     classifies by code), so most scenarios below never bothered passing it,
     but the Income hero display layer does read it, and a fixture missing
     it doesn't represent real captured data. */
  APP.incomeItems = (p.incomeItems || []).map((it, i) => {
    const def = (typeof IRP5_CODE_MAP !== 'undefined') ? IRP5_CODE_MAP.get(it.code) : null;
    return { id: i + 1, code: it.code, amount: it.amount, desc: it.name || '', cat: it.cat || (def ? def.cat : undefined) };
  });
  APP.deductionItems = (p.deductionItems || []).map((it, i) => ({ id: i + 1, amount: it.amount, code: it.code, desc: it.desc || '' }));
  /* S3 Batch 9 (C11) find: was writing the persona's name into `.employer`,
     a key M_employerPaye.collect() (05-list-modules.js) never produces —
     the real app stores `.name`, and renderEmployerPaye() reads `.name`,
     so every fixture-driven scenario has silently rendered an empty
     employer name on this list (numeric PAYE/UIF assertions never
     checked the name, so nothing caught it until this batch's own
     verification needed a real name to render). */
  APP.employerPaye = (p.employerPaye || []).map((it, i) => ({ id: i + 1, name: it.name || '', paye: it.paye || 0, uif: it.uif || 0 }));
  APP.it3bItems = (p.it3bItems || []).map((it, i) => Object.assign({ id: i + 1 }, it));
  APP.otherReceipts = (p.otherReceipts || []).map((it, i) => Object.assign({ id: i + 1 }, it));
  APP.retirementLumpsums = (p.retirementLumpsums || []).map((it, i) => Object.assign({ id: i + 1 }, it));
  APP.twopotWithdrawals = (p.twopotWithdrawals || []).map((it, i) => Object.assign({ id: i + 1 }, it));
  APP.pensionAnnuityItems = (p.pensionAnnuityItems || []).map((it, i) => Object.assign({ id: i + 1 }, it));
  APP.cgtAssets = (p.cgtAssets || []).map((it, i) => Object.assign({ id: i + 1 }, it)); APP.rentalProperties = []; APP.businessItems = []; APP.cryptoDisposals = []; APP.cryptoRevenue = [];
  APP.priorLumpsumTaxable = p.priorLumpsumTaxable || 0;
  APP.dedChecks = Object.assign({}, p.dedChecks || {});
  APP.appliedValues = Object.assign({}, p.appliedValues || {});
  APP.pendingValues = {};

  ['paye_deducted','ded_pension','ded_provident','ded_ra','ded_incprot','py_loss',
   'py_ret_excess','med_deps','med_monthly','med_employer','med_oop','med_disability',
   'prov_paid_1','prov_paid_2'].forEach(k => set(k, p[k] || 0));
  if (p.fs_qualifies) set('fs_qualifies', p.fs_qualifies);

  /* S2 Batch 11: r.intExempt/r.tei read APP.appliedValues.interest, which
     only a real IT3(b) save (M_it3b's applyType:'interest', via
     commitPending()) ever populates — this fixture harness sets
     it3bItems directly, bypassing that save flow, exactly like the
     M_income.collect()/item.cat gap S2 Batch 8 found. calcInterest()
     computes the pending exemption from it3bItems; commitPending promotes
     it, matching what a real save does. No scenario asserted intExempt
     before Batch 11 (it was returned but never checked), so this went
     undetected until a display card started consuming tei/intExempt. */
  if (APP.it3bItems.length && typeof calcInterest === 'function') {
    calcInterest();
    commitPending('interest');
  }

  const r = calcFullTax();
  return {
    gross: r.gross, adjGross: r.adjGross, taxableIncome: r.taxableIncome,
    retAllowed: r.retAllowed, retExcess: r.retExcess, retMax: r.retMax,
    additionalDed: r.additionalDed, otherDed: r.otherDed,
    intExempt: r.intExempt, cgtTaxableGain: r.cgtTaxableGain,
    lumpSumTax: r.lumpSumTax, lumpSumGross: r.lumpSumGross,
    cumPoolOpening: r.cumPoolOpening, cumPoolClosing: r.cumPoolClosing,
    taxOnIncome: r.taxOnIncome, rebates: r.rebates, taxPayable: r.taxPayable,
    totalTaxYear: r.totalTaxYear, balance: r.balance,
    payeDeducted: r.payeDeducted, provisionalPaid: r.provisionalPaid,
    lumpSumWithheld: r.lumpSumWithheld, lossUnabsorbed: r.lossUnabsorbed
  };
};

const S = (code, amount, cat) => ({ code, amount, cat });

/* Reuses the harness's own dobForAge, which already pins the birthday so the
   "birthday not yet reached by the Feb year-end" branch is unambiguous. */
const dobForAge = (age) => harnessDob('2026', age);

const SCENARIOS = [
  { id: 'S1', desc: 'Below the tax threshold — age 30, salary R90,000',
    dob: dobForAge(30),
    persona: { incomeItems: [S('3601', 90000)] },
    expect: { gross: 90000, adjGross: 90000, taxableIncome: 90000 } },

  { id: 'S2', desc: 'One employer, refund — RA within cap, medical main+spouse',
    dob: dobForAge(40),
    persona: { incomeItems: [S('3601', 420000)], paye_deducted: 85000,
               ded_ra: 30000, dedChecks: { retirement: true, medical: true },
               med_deps: 1, med_monthly: 48000 },
    expect: { gross: 420000, retMax: 115500, retAllowed: 30000, retExcess: 0, taxableIncome: 390000 } },

  { id: 'S3', desc: 'Two employers, amount owing',
    dob: dobForAge(35),
    persona: { incomeItems: [S('3601', 300000), S('3601', 250000)],
               employerPaye: [{ name: 'A', paye: 50000 }, { name: 'B', paye: 37000 }] },
    expect: { gross: 550000, taxableIncome: 550000, payeDeducted: 87000 } },

  /* S3 Batch 6 (C8): docs/programmes/calc-audit-2026-09/test-fixtures.md's own S9, the
     fixture Batch 6's brief points to. Scoped to the exemption arithmetic
     C8 actually touches (foreign-currency entry + s10(1)(o)(ii)) — the
     source doc's fuller S9 also exercises foreign tax credit and foreign
     dividends, which are separate, already-existing capture flows outside
     this batch's job. USD 90,000 × the app's own 2026 rate (17.4761,
     FOREIGN_EXCHANGE_RATES) = R1,572,849 (verified via a live UI probe of
     the FX widget itself — this fixture starts from that rand figure
     since APPLY() sets APP.incomeItems directly, the same engine-only
     shortcut every other scenario here uses, not a UI interaction). */
  { id: 'S9', desc: 'Foreign employment — FX entry, exemption over the R1.25m cap',
    dob: dobForAge(38),
    persona: { incomeItems: [S('3651', 1572849)], fs_qualifies: 'yes' },
    /* Exempt = min(1,572,849, 1,250,000) = 1,250,000 (cap binds).
       adjGross = 1,572,849 − 1,250,000 = 322,849; no deductions captured. */
    expect: { adjGross: 322849, taxableIncome: 322849 } },

  { id: 'S4', desc: 'Mixed sources — employment, pension, foreign emp, interest',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 480000), S('3651', 60000)],
               pensionAnnuityItems: [{ code: '3603', amount: 90000 }],
               it3bItems: [{ localInterest: 30000 }],
               ded_ra: 60000, dedChecks: { retirement: true, medical: true },
               deductionItems: [{ amount: 5000, desc: 'Other' }],
               fs_qualifies: 'no', med_monthly: 0 },
    /* Gross R660,000; exempt interest R23,800 → gross taxable R636,200;
       deductions R65,000 → taxable R571,200. */
    expect: { adjGross: 636200, taxableIncome: 571200, retAllowed: 60000, additionalDed: 5000 } },

  { id: 'S5', desc: 'Age 68 — annuity plus investments',
    dob: dobForAge(68),
    persona: { pensionAnnuityItems: [{ code: '3610', amount: 240000 }],
               it3bItems: [{ localInterest: 60000 }],
               dedChecks: { medical: true }, med_monthly: 60000, med_oop: 15000 },
    /* Interest exemption at 65+ is R34,500 → taxable interest R25,500.
       Local dividends R20,000 have NO capture field (audit finding F5), so
       the R20,000 leg of the fixture's R54,500 exempt total is unmodellable. */
    expect: { adjGross: 265500, taxableIncome: 265500 } },

  { id: 'S6', desc: 'Age 78 — just above the threshold',
    dob: dobForAge(78),
    persona: { pensionAnnuityItems: [{ code: '3610', amount: 180000 }],
               it3bItems: [{ localInterest: 40000 }] },
    expect: { adjGross: 185500, taxableIncome: 185500 } },

  { id: 'S7', desc: 'Retirement contributions above the 27.5% cap',
    dob: dobForAge(50),
    persona: { incomeItems: [S('3601', 800000)], ded_pension: 100000, ded_ra: 150000,
               py_ret_excess: 40000, dedChecks: { retirement: true } },
    expect: { retMax: 220000, retAllowed: 220000, retExcess: 70000, taxableIncome: 580000 } },

  { id: 'S8', desc: 'High earner above the R350,000 rand cap',
    dob: dobForAge(55),
    persona: { incomeItems: [S('3601', 1500000), S('3701', 120000), S('3802', 60000)],
               ded_ra: 400000, dedChecks: { retirement: true }, paye_deducted: 520000 },
    expect: { gross: 1680000, retMax: 350000, retAllowed: 350000, retExcess: 50000, taxableIncome: 1330000 } },

  { id: 'S10a', desc: 'Lump sums — prior R100,000, this year R9,000 (fixture F2)',
    dob: dobForAge(60),
    persona: { priorLumpsumTaxable: 100000,
               retirementLumpsums: [{ amount: 9000, eventType: 'retirement', date: '2025-06-01' }] },
    expect: { cumPoolOpening: 100000, cumPoolClosing: 109000, lumpSumTax: 0 } },

  { id: 'S10b', desc: 'Lump sums crossing into the taxed band',
    dob: dobForAge(60),
    persona: { priorLumpsumTaxable: 500000,
               retirementLumpsums: [{ amount: 200000, eventType: 'retirement', date: '2025-06-01' }] },
    expect: { cumPoolOpening: 500000, cumPoolClosing: 700000 } },

  { id: 'S10c', desc: 'Two-pot savings withdrawal taxed at marginal rates',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 400000)],
               twopotWithdrawals: [{ amount: 30000, taxWithheld: 9000 }] },
    expect: { taxableIncome: 430000, lumpSumWithheld: 9000 } },

  { id: 'S11', desc: 'Sole proprietor paying provisional tax',
    dob: dobForAge(42),
    persona: { appliedValues: { business: 550000 }, ded_ra: 80000,
               dedChecks: { retirement: true }, prov_paid_1: 60000, prov_paid_2: 70000 },
    expect: { retMax: 151250, retAllowed: 80000, taxableIncome: 470000 } },

  { id: 'S12a', desc: 'Current-year business loss set off against salary',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 400000)], paye_deducted: 70000,
               appliedValues: { business: -120000 } },
    expect: { taxableIncome: 280000 } },

  { id: 'S12b', desc: 'Assessed loss brought forward exceeds this year profit',
    dob: dobForAge(45),
    persona: { appliedValues: { business: 30000 }, py_loss: 50000 },
    expect: { taxableIncome: 0, lossUnabsorbed: 20000 } },

  /* HERO-2: a loss the year's income absorbs in full — the case the
     Dashboard "Taxable income" card got wrong (debug-harness TEST-13). */
  { id: 'S12c', desc: 'Assessed loss brought forward fully set off against salary',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 400000)], paye_deducted: 70000, py_loss: 50000 },
    expect: { taxableIncome: 350000, lossUnabsorbed: 0 } },

  /* INC-20: the two exemptions that are in neither gi nor tei  the exempt
     25/45 of a foreign dividend and a primary-residence exclusion. The Income
     page's Exempt income card lists them under its total (debug-harness
     TEST-15). 90,000 x 25/45 = 50,000 exempt; the 1.8m gain on the home is
     inside the 2026 R2m exclusion, so all of it is excluded. */
  { id: 'S12d', desc: 'Foreign dividend and a primary residence  exemptions outside gi/tei',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 400000)],
               it3bItems: [{ foreignDividends: 90000 }],
               cgtAssets: [{ desc: 'Family home', type: 'property', proceeds: 3000000, baseCost: 1200000, sellingCosts: 0, improvements: 0, primaryRes: true }] },
    expect: { taxableIncome: 440000, foreignDividendsExempt: 50000, primaryResExcluded: 1800000 } },

  { id: 'S13a', desc: 'Rental income and a capital gain',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 350000)],
               appliedValues: { rental: 120000, cgt: 44000 } },
    /* (150,000 − 40,000) × 40% = 44,000 */
    expect: { taxableIncome: 514000 } },

  { id: 'S13b', desc: 'Capital loss smaller than the annual exclusion',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 350000)],
               appliedValues: { rental: 120000, cgt: 0 } },
    expect: { taxableIncome: 470000 } },

  /* S2 Batch 12: promoted from docs/programmes/calc-audit-2026-09/test-fixtures.md — was
     never migrated into this runner when S1 Batch 8 promoted the others,
     so it went unverified until the Medical credits card (this batch)
     needed it. */
  { id: 'S14', desc: 'Disability and medical expenses',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 500000)],
               med_deps: 1, med_monthly: 72000, med_oop: 40000, med_disability: 1 },
    expect: { taxableIncome: 500000 } },

  { id: 'S15', desc: 'Only an "Other" deduction',
    dob: dobForAge(40),
    persona: { incomeItems: [S('3601', 250000)],
               deductionItems: [{ amount: 5000, desc: 'Professional course' }] },
    expect: { taxableIncome: 245000, additionalDed: 5000 } },

  /* Audit-only scenario verifying findings F2/F3: does the engine's otherDed
     really include companycar + foreignSubsistence (which dedTaxBenefit's
     totalDeds and the dashboard Deductions card's rows both omit)? */
  { id: 'F-CC', desc: 'AUDIT F2/F3 — company car + foreign subsistence in otherDed',
    dob: dobForAge(45),
    persona: { incomeItems: [S('3601', 600000)],
               appliedValues: { travel: 10000, companycar: 25000, foreignSubsistence: 15000 },
               dedChecks: { travel: true } },
    /* otherDed should be 10,000 + 25,000 + 15,000 = 50,000 */
    expect: { otherDed: 50000, taxableIncome: 550000 } },

  { id: 'S16', desc: 'Nothing captured',
    dob: dobForAge(40),
    persona: {},
    expect: { gross: 0, adjGross: 0, taxableIncome: 0, taxPayable: 0, balance: 0 } },

  { id: 'S18', desc: 'Amounts with cents',
    dob: dobForAge(40),
    persona: { incomeItems: [S('3601', 412345.67)], paye_deducted: 88123.45,
               ded_ra: 12345.55, dedChecks: { retirement: true },
               it3bItems: [{ localInterest: 1234.49 }] },
    /* Interest R1,234.49 is fully inside the R23,800 exemption → nil taxable.
       Taxable income = 412,345.67 − 12,345.55 = 400,000.12 */
    expect: { taxableIncome: 400000.12 } },

  /* S3 Batch 14 residual: no existing scenario exercises fs_qualifies='yes'
     (the s10(1)(o)(ii) foreign-employment exemption actually applying) —
     S4 sets fs_qualifies:'no'. Added while fixing the income-selector
     ".sel-sec-total" overcounting bug found in this batch's sweep (it
     summed the foreign salary GROSS, same as Employment's row, without
     subtracting the exemption adjGross itself subtracts) — without this
     scenario, TEST-12 (16-debug-harness.js) would never hit the exempt>0
     branch and the regression could return unnoticed. */
  { id: 'S19', desc: 'Foreign employment exemption qualifies (s10(1)(o)(ii))',
    dob: dobForAge(35),
    persona: { incomeItems: [S('3601', 400000), S('3651', 200000)], fs_qualifies: 'yes' },
    /* Foreign salary 200,000 is fully under the R1.25m cap → fully exempt.
       adjGross = 400,000 (local salary only); taxableIncome = 400,000
       (no deductions captured). */
    expect: { adjGross: 400000, taxableIncome: 400000 } }
];

/* Exported (not just run as a script) so tests/run-debug-harness.js can
   drive the exact same personas through the in-file debug harness without a
   second, drifting copy of this fixture data. */
module.exports = { SCENARIOS, APPLY };

if (require.main === module) (async () => {
  const browser = await chromium.launch(LAUNCH_OPTS);
  let fails = 0, checks = 0;
  const rows = [];

  const only = process.argv[2];
  for (const sc of SCENARIOS) {
    if (only && sc.id !== only) continue;
    const persona = Object.assign({ taxYear: '2026' }, sc.persona);
    let result, pageErrors;
    try {
      ({ result, pageErrors } = await withPage(browser, (page) => page.evaluate(APPLY, persona), { dob: sc.dob }));
    } catch (e) {
      console.error(`❌ ${sc.id} — boot/eval failed: ${e.message}`);
      fails++; continue;
    }
    if (pageErrors && pageErrors.length) {
      console.error(`❌ ${sc.id} — PAGE ERRORS ${JSON.stringify(pageErrors)}`);
      fails++; continue;
    }
    const diffs = [];
    for (const [field, exp] of Object.entries(sc.expect)) {
      checks++;
      const act = result[field];
      const delta = Math.abs((act || 0) - exp);
      rows.push({ id: sc.id, field, expected: exp, actual: act, ok: delta <= 0.5 });
      if (delta > 0.5) diffs.push(`    ${field}: expected=${exp} actual=${act} (Δ${delta.toFixed(2)})`);
    }
    // NaN / undefined sweep across every returned figure
    for (const [k, v] of Object.entries(result)) {
      if (v === undefined || (typeof v === 'number' && !isFinite(v))) {
        diffs.push(`    ${k}: NON-FINITE (${v})`);
      }
    }
    if (diffs.length) { console.error(`❌ ${sc.id} — ${sc.desc}\n` + diffs.join('\n')); fails++; }
    else console.log(`✅ ${sc.id} — ${sc.desc} (${Object.keys(sc.expect).length} fields)`);
  }

  await browser.close();
  console.log(`\n${checks} assertions across ${SCENARIOS.length} scenarios — ${fails} scenario(s) with diffs.`);
  console.log('\n--- expected vs actual (full) ---');
  for (const r of rows) {
    console.log(`${r.ok ? ' ' : '!'} ${r.id.padEnd(6)} ${r.field.padEnd(18)} expected=${String(r.expected).padStart(12)} actual=${String(r.actual).padStart(12)}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
