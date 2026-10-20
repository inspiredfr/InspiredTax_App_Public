/* ═══════════════════════════════════════════════════════════════════════════════
   S1 Batch 8: In-file audit test harness skeleton

   Debug-only module exposing runAuditTests() callable from console. Tests are
   cross-screen equality checks comparing rendered DOM values against engine
   fields. Each test passes only if DOM and engine agree exactly.

   Enabled via: localStorage.setItem('iss_debug','1') before first page load.

   Runs TEST-1..TEST-11; as each stage (S1–S4) fixes its cards, it adds
   assertions. This stage (S1) implements TEST-1 and TEST-2 (A1 lump-sum fix).
   ═══════════════════════════════════════════════════════════════════════════════ */

import { _debugEnabled } from './12-bootstrap-onboarding.js';
import { calcFullTax, fmt } from './02-core.js';
import { dedTaxBenefit } from './04-deductions.js';

/* Harness runner: execute all TEST-n assertions against current APP state and DOM.
   Returns {pass: count, fail: count, tests: [{name, passed, actual, expected}]} */
export function runAuditTests() {
  if (!_debugEnabled()) {
    console.log('Audit tests disabled. Enable with: localStorage.setItem("iss_debug","1")');
    return null;
  }

  const results = {
    pass: 0,
    fail: 0,
    tests: []
  };

  // TEST-1: Lump-sum cumulation — rendered Tax-balances row must match the
  // engine, not just be internally self-consistent. Reads the row's own
  // data-val attributes (set by renderCarriedBalances in 03-income.js) so a
  // DOM regression (e.g. row bound back to the wrong field) fails this test
  // even though the engine identity always holds algebraically.
  {
    const name = 'TEST-1: Lump-sum cumulation — DOM row matches calcFullTax()';
    const r = calcFullTax();
    const rowEl = document.querySelector('[data-fixture-row="lumpsum"]');

    let passed = false, actual = null, expected = null;
    if (rowEl && r) {
      const vals = Array.from(rowEl.querySelectorAll('[data-val]')).map(el => Number(el.dataset.val));
      const [domOpening, domClosing] = vals;
      const engineOpening = r.cumPoolOpening || 0, engineClosing = r.cumPoolClosing || 0;
      // No captured lump sums this year: row stays collapsed (bucket 'out'),
      // no data-val spans render — that is correct, not a failure.
      if (vals.length === 0) {
        passed = engineOpening === 0 && engineClosing === 0;
        actual = 'row collapsed (nothing captured)';
        expected = 'engine opening/closing both 0';
      } else {
        passed = domOpening === engineOpening && domClosing === engineClosing;
        actual = `DOM opening=${domOpening} closing=${domClosing}`;
        expected = `engine opening=${engineOpening} closing=${engineClosing}`;
      }
    } else {
      actual = 'row not found in DOM';
      expected = '[data-fixture-row="lumpsum"] present';
    }

    results.tests.push({ name, passed, actual, expected });
    results[passed ? 'pass' : 'fail']++;
  }

  // TEST-2: S10a lump-sum tax is verified by the promoted audit fixture
  // runner (docs/programmes/calc-audit-2026-09/run-audit-fixtures.js), which
  // asserts against calcFullTax() directly for a scenario this harness has
  // no way to load (it only sees whatever the live page's APP state is) —
  // duplicating that check here would be a second re-derivation of the same
  // assertion, which is exactly what this stage's golden rule forbids.
  {
    const name = 'TEST-2: S10a lump-sum tax (fixture verification)';
    results.tests.push({ name, passed: null, actual: 'covered by run-audit-fixtures.js', expected: 'N/A — see docs/programmes/calc-audit-2026-09/run-audit-fixtures.js' });
  }

  // TEST-3: A3 (revised 2026-09-28, Q-NEW-1) — the Deductions-hero "N
  // active" count must equal the number of rendered rows actually showing
  // a rand amount: checklist rows carrying .ded-tile-amt (buildDedRow only
  // renders that element when checked && val>0 — i.e. a real calculated
  // figure, not merely a toggled-on switch) plus "Other" IRP5-code claims
  // rendered in the deduction-code list (each requires amount>0 to have
  // been saved at all). A row switched on with nothing captured yet is
  // .ded-on but has no .ded-tile-amt, and must not count here — that was
  // the "8 deductions" vs. one actual captured deduction mismatch this
  // test now guards against.
  {
    const name = 'TEST-3: Deductions-hero active count matches rendered rows with an amount';
    const countEl = document.querySelector('#deductions-hero [data-active-count]');
    let passed = false, actual = null, expected = null;
    if (countEl) {
      const heroCount = Number(countEl.dataset.activeCount);
      const checklistActive = Array.from(document.querySelectorAll('#deductions-checklist .ded-tile.ded-on .ded-tile-amt'))
        .filter(function(el){ var tile = el.closest('.ded-tile'); var lbl = tile && tile.querySelector('.ded-tile-lbl'); return !lbl || !lbl.textContent.includes('Other claims'); }).length;
      const otherClaims = document.querySelectorAll('#deduction-code-list .item-row').length;
      const domCount = checklistActive + otherClaims;
      passed = heroCount === domCount;
      actual = `hero=${heroCount}`;
      expected = `checklist .ded-tile-amt=${checklistActive} + other claims=${otherClaims} = ${domCount}`;
    } else {
      actual = 'hero count element not found';
      expected = '#deductions-hero [data-active-count] present';
    }
    results.tests.push({ name, passed, actual, expected });
    results[passed ? 'pass' : 'fail']++;
  }

  // TEST-4: A4/Batch 4 — the Dashboard reward card's headline total must
  // equal dedTaxBenefit().taxSaving + rebates + medical + FTC, i.e. Allan's
  // Tax-saved definition. Only checked when nothing was wasted (no rebate/
  // credit exceeded what was left to reduce) — the card's own
  // data-nothing-wasted flag says so; when a credit WAS wasted, the card
  // correctly shows less than the nominal sum (creditsConsumed, not
  // rebate+medical+ftc), and that is not a bug for this test to catch.
  {
    const name = 'TEST-4: Dashboard reward total = Saved-ded + rebates + medical + FTC';
    const figEl = document.querySelector('#tax-reward .reward-fig');
    let passed = false, actual = null, expected = null;
    if (!figEl) {
      // total <= 0 hides the card entirely (renderReward's own early return)
      // — nothing to assert.
      passed = null;
      actual = 'card not shown (total <= 0)';
      expected = 'N/A';
    } else if (figEl.dataset.nothingWasted !== 'true') {
      passed = null;
      actual = 'a rebate/credit exceeded what was left to reduce';
      expected = 'N/A — see nothingWasted branch in renderReward()';
    } else {
      const r = calcFullTax();
      const domTotal = Number(figEl.dataset.total);
      const identity = (dedTaxBenefit().taxSaving || 0) + (r.rebates || 0) + (r.med && r.med.total || 0) + (r.ftc || 0);
      /* R1 tolerance, matching every other cross-check in this repo
         (tests/differential.js, tests/run-legislative.js's default) — a
         mask-rand field re-reads its own displayed (whole-rand-rounded)
         value on every calcFullTax() call after the first render, so a
         captured amount with cents legitimately differs by well under a
         rand between "value used at initial render" and "value read back
         afterward". That is the masking design's intended precision, not
         a bug this test exists to catch (S1 Batch 1's F6 note covers the
         analogous cent-residue case). */
      passed = Math.abs(domTotal - identity) < 1;
      actual = `DOM total=${domTotal}`;
      expected = `taxSaving+rebates+medical+ftc=${identity}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-5: A5 — the Income hero's breakdown chips must sum to its own
  // headline total (r.adjGross). The six divergences (01-AUDIT.md §2) were
  // all instances of this one failure mode — chips computed from a raw
  // APP.incomeItems category sweep instead of the fields adjGross is
  // actually built from — so one generic casting check catches all six
  // (and any future one of the same shape) rather than asserting each
  // divergence by name.
  {
    const name = 'TEST-5: Income hero breakdown chips sum to adjGross';
    const numEl = document.querySelector('#income-hero .dhero-num');
    let passed = false, actual = null, expected = null;
    if (!numEl) {
      passed = null; actual = 'hero not shown (adjGross <= 0)'; expected = 'N/A';
    } else {
      const headline = Number(numEl.dataset.count);
      const chips = Array.from(document.querySelectorAll('#income-hero .src-chip'));
      const chipTotal = chips.reduce((s, el) => s + Number(el.dataset.val), 0);
      passed = Math.abs(chipTotal - headline) < 1;
      actual = `chips sum=${chipTotal} (${chips.length} chips)`;
      expected = `hero total (adjGross)=${headline}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-6: B1 — the Dashboard Refund/Owing waterfall must cast: its
  // add/sub steps must land on its own closing row, and that row must equal
  // |r.balance|. The old bar dropped lumpSumTax/lumpSumWithheld entirely, so
  // it could never cast whenever either existed (fixture S10c exercises this
  // directly: two-pot withdrawal, lumpSumWithheld=9,000).
  {
    const name = 'TEST-6: Dashboard Refund/Owing waterfall steps land on r.balance';
    const wf = document.querySelector('#dash-balance .waterfall');
    let passed = false, actual = null, expected = null;
    if (!wf) {
      passed = null; actual = 'waterfall not shown (balance = 0 or nothing captured)'; expected = 'N/A';
    } else {
      const rows = Array.from(wf.querySelectorAll('.wf-row'));
      const run = rows.filter(el => el.dataset.kind !== 'total')
        .reduce((s, el) => s + (el.dataset.kind === 'sub' ? -1 : 1) * Number(el.dataset.val), 0);
      const closing = rows.length ? Number(rows[rows.length - 1].dataset.val) : NaN;
      const balance = Math.abs(calcFullTax().balance || 0);
      passed = Math.abs(run - closing) < 1 && Math.abs(closing - balance) < 1;
      actual = `steps sum=${run}, closing row=${closing}`;
      expected = `|r.balance|=${balance}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }
  // TEST-7: B2 — Dashboard "Gross taxable income" card casts: its own
  // donut total must equal the card's raw value, and the card's raw value
  // must equal calcFullTax().adjGross (the field it's supposed to display).
  {
    const name = 'TEST-7: Dashboard GTI card + donut cast to calcFullTax().adjGross';
    const card = document.querySelector('.dash-mini-grid [data-card="Gross taxable income"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (adjGross <= 0)'; expected = 'N/A';
    } else {
      const r = calcFullTax();
      const cardRaw = Number(card.dataset.raw);
      const donutEl = card.querySelector('.donut-wrap');
      const donutTotal = donutEl ? Number(donutEl.dataset.donutTotal) : null;
      const cardOk = Math.abs(cardRaw - r.adjGross) < 1;
      const donutOk = donutEl ? Math.abs(donutTotal - cardRaw) < 1 : true; // no donut when every source is 0 (nothing to chart)
      passed = cardOk && donutOk;
      actual = `card.raw=${cardRaw} donut.total=${donutTotal}`;
      expected = `calcFullTax().adjGross=${r.adjGross}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-8: B3 — Dashboard "Taxable income" card casts: raw value equals
  // calcFullTax().taxableIncome, and (cross-screen duplicate class per the
  // brief's §5) equals the "Tax payable" card's own TI-base breakdown line.
  {
    const name = 'TEST-8: Dashboard TI card = calcFullTax().taxableIncome = Tax payable card\'s TI base';
    const tiCard = document.querySelector('.dash-mini-grid [data-card="Taxable income"]');
    let passed = false, actual = null, expected = null;
    if (!tiCard) {
      passed = null; actual = 'card not shown (taxableIncome <= 0)'; expected = 'N/A';
    } else {
      const r = calcFullTax();
      const tiRaw = Number(tiCard.dataset.raw);
      const taxCard = document.querySelector('.dash-mini-grid [data-card="Tax payable"]');
      const taxCardMentionsTi = taxCard ? taxCard.textContent.includes(fmt(tiRaw)) : true;
      passed = Math.abs(tiRaw - r.taxableIncome) < 1 && taxCardMentionsTi;
      actual = `TI card raw=${tiRaw}, Tax payable card mentions TI base=${taxCardMentionsTi}`;
      expected = `calcFullTax().taxableIncome=${r.taxableIncome}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }
  // TODO(S3): TEST-9 — Layout/UX verification (defer to S3 with visual regression suite)
  // TEST-10: income-page Taxable income card (card 3) = Dashboard Taxable
  // income card (S2 Batch 5) — both must read r.taxableIncome, so this
  // mainly guards against a future edit making either card compute its
  // own figure again.
  {
    const name = 'TEST-10: Income page TI card = Dashboard TI card';
    const incomeCard = document.querySelector('#income-mini-cards [data-card="Taxable income"]');
    const dashCard = document.querySelector('.dash-mini-grid [data-card="Taxable income"]');
    let passed = false, actual = null, expected = null;
    if (!incomeCard || !dashCard) {
      passed = null; actual = `income card=${!!incomeCard} dash card=${!!dashCard}`; expected = 'N/A — one or both not shown';
    } else {
      const incomeRaw = Number(incomeCard.dataset.raw), dashRaw = Number(dashCard.dataset.raw);
      passed = Math.abs(incomeRaw - dashRaw) < 1;
      actual = `income page=${incomeRaw}`;
      expected = `dashboard=${dashRaw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 11): Income page "Gross income" card + donut cast to
  // calcFullTax().gi — same casting pattern as TEST-7 (Dashboard GTI card).
  {
    const name = 'TEST: Income page Gross income card + donut cast to calcFullTax().gi';
    const card = document.querySelector('#income-mini-cards [data-card="Gross income"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (adjGross <= 0)'; expected = 'N/A';
    } else {
      const r = calcFullTax();
      const cardRaw = Number(card.dataset.raw);
      const donutEl = card.querySelector('.donut-wrap');
      const donutTotal = donutEl ? Number(donutEl.dataset.donutTotal) : null;
      const cardOk = Math.abs(cardRaw - r.gi) < 1;
      const donutOk = donutEl ? Math.abs(donutTotal - cardRaw) < 1 : true; // no donut when a loss is present (chart rule) or nothing to chart
      passed = cardOk && donutOk;
      actual = `card.raw=${cardRaw} donut.total=${donutTotal}`;
      expected = `calcFullTax().gi=${r.gi}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 11): Exempt income card's expanded list sums to its own
  // collapsed TEI total — same casting-failure class as every other card
  // in this stage.
  {
    const name = 'TEST: Exempt income card expanded list sums to collapsed TEI';
    const card = document.querySelector('#income-mini-cards [data-card="Exempt income"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (tei <= 0)'; expected = 'N/A';
    } else {
      const cardRaw = Number(card.dataset.raw);
      const rowTotal = Array.from(card.querySelectorAll('.mini-row[data-val]')).reduce((s, el) => s + Number(el.dataset.val), 0);
      passed = Math.abs(rowTotal - cardRaw) < 1;
      actual = `rows sum=${rowTotal}`;
      expected = `card total (tei)=${cardRaw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-15: INC-20 — the Exempt income card's memo lines are the engine's own
  // figures (the exempt 25/45 of foreign dividends, the primary-residence
  // exclusion), they are NOT part of the card total (the test above sums only
  // data-val rows), and each is shown exactly when the engine reports it.
  {
    const name = 'TEST-15: Exempt income card memo lines cast to calcFullTax() and stay outside its total';
    const r = calcFullTax();
    const want = { 'Foreign dividends, exempt 25/45': r.foreignDividendsExempt || 0,
                   'Primary residence exclusion': r.primaryResExcluded || 0 };
    const card = document.querySelector('#income-mini-cards [data-card="Exempt income"]');
    let passed = false, actual = null, expected = null;
    if (!card && !Object.values(want).some((v) => v > 0)) {
      passed = null; actual = 'card not shown and no memo exemption'; expected = 'N/A';
    } else if (!card) {
      actual = 'engine reports a memo exemption but no card'; expected = 'card with memo lines';
    } else {
      const problems = [];
      Object.keys(want).forEach((label) => {
        const row = Array.from(card.querySelectorAll('.mini-memo')).find((el) => el.dataset.memo === label);
        if (want[label] > 0 && !row) problems.push(label + ': missing (engine ' + want[label] + ')');
        else if (want[label] > 0 && Math.abs(Number(row.dataset.memoVal) - want[label]) >= 1) problems.push(label + ': ' + row.dataset.memoVal + ' ≠ ' + want[label]);
        else if (!(want[label] > 0) && row) problems.push(label + ': shown although the engine reports none');
      });
      if (card.querySelectorAll('.mini-memo[data-val]').length) problems.push('a memo row carries data-val and would be summed into the total');
      passed = problems.length === 0;
      actual = problems.length ? problems.join('; ') : 'memo lines match the engine';
      expected = 'foreignDividendsExempt=' + (r.foreignDividendsExempt || 0) + ', primaryResExcluded=' + (r.primaryResExcluded || 0);
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 11): Foreign income donut total equals its own
  // collapsed figure (a cross-category overlay, not a GI/GTI component —
  // it only needs to sum to itself, not to adjGross/gi).
  {
    const name = 'TEST: Foreign income card donut total = its own collapsed figure';
    const card = document.querySelector('#income-mini-cards [data-card="Foreign income"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (no foreign income)'; expected = 'N/A';
    } else {
      const cardRaw = Number(card.dataset.raw);
      const donutEl = card.querySelector('.donut-wrap');
      const donutTotal = donutEl ? Number(donutEl.dataset.donutTotal) : null;
      passed = donutEl != null && Math.abs(donutTotal - cardRaw) < 1;
      actual = `donut.total=${donutTotal}`;
      expected = `card total=${cardRaw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }
  // TEST-11: A7 — the Income hero's collapsed "Income captured" summary
  // shows PAYE paid and foreign income alongside the total (S2 Batch 10).
  // Both figures must agree with the same values shown in the expanded
  // breakdown (the PAYE note, and the Foreign Income chip) — they're the
  // same variables in renderIncomeGlance(), so this mainly guards against
  // a future edit reading a different one for the collapsed vs expanded
  // copy.
  {
    const name = 'TEST-11: Income captured collapsed substats = expanded breakdown';
    const heroEl = document.getElementById('income-hero');
    const payeStat = heroEl ? heroEl.querySelector('[data-stat="paye"]') : null;
    const foreignStat = heroEl ? heroEl.querySelector('[data-stat="foreign"]') : null;
    let passed = false, actual = null, expected = null;
    if (!payeStat && !foreignStat) {
      passed = null; actual = 'no substats shown (no PAYE or foreign income captured)'; expected = 'N/A';
    } else {
      const checks = [];
      if (payeStat) {
        const payeNote = heroEl.querySelector('.paye-withheld-note');
        const noteVal = payeNote ? Number(payeNote.dataset.val) : null;
        const statVal = Number(payeStat.dataset.val);
        checks.push({ ok: payeNote != null && Math.abs(noteVal - statVal) < 1, label: `paye note=${noteVal} substat=${statVal}` });
      }
      if (foreignStat) {
        const foreignChip = heroEl.querySelector('.src-chip[data-src="Foreign income"]');
        const chipVal = foreignChip ? Number(foreignChip.dataset.val) : null;
        const statVal = Number(foreignStat.dataset.val);
        checks.push({ ok: foreignChip != null && Math.abs(chipVal - statVal) < 1, label: `foreign chip=${chipVal} substat=${statVal}` });
      }
      passed = checks.every(c => c.ok);
      actual = checks.map(c => `${c.label}=${c.ok}`).join(', ');
      expected = 'all checks true';
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 12, B9): Retirement cap card's chain casts — cap −
  // current-year contributions − brought-forward = carried forward (or
  // unused cap) — and "Allowed this year" matches r.retAllowed exactly
  // (verified by hand against S7/S8 when this card was built; this guards
  // against a future edit breaking the arithmetic).
  {
    const name = 'TEST: Retirement cap card chain casts to r.retAllowed/retExcess';
    const el = document.getElementById('ret-cap-acc');
    let passed = false, actual = null, expected = null;
    if (!el) {
      passed = null; actual = 'card not shown (no retirement contributions)'; expected = 'N/A';
    } else {
      const r = calcFullTax();
      const val = (role) => { const row = el.querySelector('.mini-row[data-role="' + role + '"]'); return row ? Number(row.dataset.val) : 0; };
      const cap = val('cap'), current = val('current'), broughtForward = val('broughtforward'), carried = val('carried'), allowed = val('allowed');
      const allowedOk = Math.abs(allowed - r.retAllowed) < 1;
      // When retExcess > 0 the card shows "Balance carried forward" (must
      // equal r.retExcess); when it's 0, the card shows "Unused cap"
      // (cap − combined, a different concept — headroom, not an excess) —
      // these are two distinct branches of the SAME card, not one figure.
      const expectedCarried = r.retExcess > 0 ? r.retExcess : Math.max(0, cap - current - broughtForward);
      const carriedOk = Math.abs(carried - expectedCarried) < 1;
      passed = allowedOk && carriedOk;
      actual = `card allowed=${allowed} carried=${carried}`;
      expected = `r.retAllowed=${r.retAllowed}, expected carried/unused=${expectedCarried}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 12, B8): Deductions "Tax Saving" card's apportioned
  // rows sum to Saved-ded (dedTaxBenefit().taxSaving) — each row is
  // deduction/totalDeds × taxSaving, so they must add back up exactly.
  {
    const name = 'TEST: Deductions Tax Saving card apportioned rows sum to taxSaving';
    const card = document.querySelector('#deductions-glance-bottom [data-card="Tax Saving"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (no active deductions)'; expected = 'N/A';
    } else {
      const cardRaw = Number(card.dataset.raw);
      const rowTotal = Array.from(card.querySelectorAll('.mini-row[data-val]')).reduce((s, el) => s + Number(el.dataset.val), 0);
      passed = Math.abs(rowTotal - cardRaw) < 1;
      actual = `apportioned rows sum=${rowTotal}`;
      expected = `card total (taxSaving)=${cardRaw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST (S2 Batch 12, B9 medical): Medical credits card's s6A + s6B rows
  // sum to the card's own total, and each shows on its own line (S14).
  {
    const name = 'TEST: Medical credits card s6A + s6B = card total, each its own line';
    const card = document.querySelector('#deductions-glance-bottom [data-card="Medical credits"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (medical not active or credit is 0)'; expected = 'N/A';
    } else {
      const cardRaw = Number(card.dataset.raw);
      const vals = Array.from(card.querySelectorAll('.mini-row[data-val]')).map(el => Number(el.dataset.val));
      const rowTotal = vals.reduce((s, v) => s + v, 0);
      passed = vals.length === 2 && Math.abs(rowTotal - cardRaw) < 1;
      actual = `rows=${vals.length}, sum=${rowTotal}`;
      expected = `2 rows summing to card total=${cardRaw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-12: S3 Batch 14 — the "Completed" group's own total
  // (.sel-sec-total, renderIncomeSelector()) must cast to calcFullTax()
  // .adjGross exactly, on any fixture (foreign income included). Guards
  // against a re-introduction of either the original double-count (S2,
  // fixed by excluding the b6foreign row) or the residual gross-vs-net
  // gap found in the S3 follow-up sweep (Employment row summed the
  // foreign-employment codes GROSS; adjGross subtracts the s10(1)(o)(ii)
  // exemption — fixed by subtracting foreignEmpExempt from the total).
  {
    const name = 'TEST-12: Income selector Completed total casts to adjGross';
    const el = document.querySelector('#income-selector .sel-sec-total');
    let passed = false, actual = null, expected = null;
    if (!el) {
      passed = null; actual = 'no Completed items (nothing captured)'; expected = 'N/A';
    } else {
      const r = calcFullTax();
      const total = Number(el.dataset.val);
      passed = Math.abs(total - r.adjGross) < 1;
      actual = `.sel-sec-total=${total}`;
      expected = `calcFullTax().adjGross=${r.adjGross}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-13: HERO-2 — the Dashboard "Taxable income" card's own rows must
  // cast: what it adds, less what it subtracts, is the total it shows. The
  // card listed r.lossUnabsorbed (the part of an assessed loss NOT used) as
  // "less assessed loss", so a loss that was fully set off showed no row at
  // all and the chain was out by the whole loss (fixture S12c).
  {
    const name = 'TEST-13: Dashboard TI card rows cast (GTI − deductions − assessed loss = TI)';
    const card = document.querySelector('.dash-mini-grid [data-card="Taxable income"]');
    let passed = false, actual = null, expected = null;
    if (!card) {
      passed = null; actual = 'card not shown (taxableIncome <= 0)'; expected = 'N/A';
    } else {
      const sum = (kind) => Array.from(card.querySelectorAll('.mini-row[data-chain="' + kind + '"]'))
        .reduce((s, el) => s + Number(el.dataset.val), 0);
      const total = sum('total'), chain = sum('add') - sum('sub');
      passed = card.querySelectorAll('.mini-row[data-chain="total"]').length === 1
        && Math.abs(chain - total) < 1 && Math.abs(total - Number(card.dataset.raw)) < 1;
      actual = `add − sub = ${chain}, total row = ${total}`;
      expected = `card.raw=${card.dataset.raw}`;
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // TEST-14: HERO-2 — every Dashboard at-a-glance card carries a ring in its
  // collapsed head, and each ring is drawn from engine figures: the whole it
  // is measured against and the part it fills are the calcFullTax() fields
  // named here, never a figure worked out for the chart. A card whose ring
  // would not add up (a loss among the income sources, deductions larger
  // than the income) draws none, and that is allowed.
  {
    const name = 'TEST-14: Dashboard card rings cast to calcFullTax()';
    const r = calcFullTax();
    const totalDed = (r.retAllowed || 0) + (r.otherDed || 0) + (r.donAllowed || 0) + (r.additionalDed || 0);
    const want = {
      'Gross taxable income': { whole: r.adjGross, sum: r.adjGross, optional: true },
      'Deductions':           { whole: totalDed, sum: totalDed },
      'Taxable income':       { whole: r.adjGross, sum: r.taxableIncome, optional: true },
      'Tax payable':          { whole: r.taxOnIncome, sum: r.taxPayable, optional: true },
    };
    const cards = Array.from(document.querySelectorAll('.dash-mini-grid .mini-card'));
    let passed = false, actual = null, expected = null;
    if (!cards.length) {
      passed = null; actual = 'no at-a-glance cards shown'; expected = 'N/A';
    } else {
      const problems = [];
      cards.forEach((card) => {
        const lbl = card.dataset.card, w = want[lbl];
        const ring = card.querySelector('summary .mini-ring');
        if (!w) { problems.push(lbl + ': unexpected card'); return; }
        if (!ring) { if (!w.optional) problems.push(lbl + ': no ring'); return; }
        const whole = Number(ring.dataset.ringWhole), sum = Number(ring.dataset.ringSum);
        if (Math.abs(whole - w.whole) >= 1) problems.push(lbl + ': ring whole ' + whole + ' ≠ ' + w.whole);
        if (Math.abs(sum - w.sum) >= 1) problems.push(lbl + ': ring fill ' + sum + ' ≠ ' + w.sum);
        if (card.querySelector('summary .donut-wrap, summary [data-i]')) problems.push(lbl + ': ring is interactive inside <summary>');
      });
      /* The three single-figure rings always add up when their card shows. */
      ['Deductions', 'Taxable income', 'Tax payable'].forEach((lbl) => {
        const card = cards.find((c) => c.dataset.card === lbl);
        const w = want[lbl];
        if (card && w.sum <= w.whole + 0.5 && !card.querySelector('summary .mini-ring')) problems.push(lbl + ': ring missing although it adds up');
      });
      passed = problems.length === 0;
      actual = problems.length ? problems.join('; ') : cards.length + ' card(s), rings cast';
      expected = 'each ring: whole and fill equal the engine figures';
    }
    results.tests.push({ name, passed, actual, expected });
    if (passed !== null) results[passed ? 'pass' : 'fail']++;
  }

  // Report results
  console.log(`Audit tests: ${results.pass} pass, ${results.fail} fail`);
  results.tests.forEach(t => {
    const status = t.passed === null ? '⊘ SKIP' : (t.passed ? '✓ PASS' : '✗ FAIL');
    console.log(`  ${status} ${t.name}`);
    if (t.actual !== null) console.log(`    → actual: ${t.actual}`);
    if (t.expected !== null) console.log(`    → expected: ${t.expected}`);
  });

  return results;
}

// Expose to console — called by 12-bootstrap-onboarding.js when debug is
// enabled, in builds that include the harness (BACKLOG 73: not the release
// bundle — see __DEBUG_HARNESS__ in build.js).
export function installDebugHarness() {
  window.__auditTests = { runAuditTests };
  console.log('Audit test harness loaded. Run: window.__auditTests.runAuditTests()');
}
