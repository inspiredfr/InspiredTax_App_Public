import { noteHtml, $, APP, calcFullTax, calcS6ACredit, calcTaxForYear, cssColour, esc, fmt, gs, gv, isMedicalSchemeMemberDom, pct, sv, iconClassFor } from './02-core.js';
import { calcProvisionalPenalty } from './03-income.js';

/* ============================================================
   InspiredTax v8.5 — PROJECTION ENGINE
   Multi-year forecast, RA analyser, optimisation tips
   ============================================================ */

export function onRAMethodChange() {
  const method = gs('proj-ra-method');
  $('proj-ra-growth-wrap').style.display  = method === 'growth'     ? 'block' : 'none';
  $('proj-ra-pct-wrap').style.display     = method === 'fixed_pct'  ? 'block' : 'none';
  updateProjection();
}

/* §5.8/H13: sliders are imprecise on touch — tapping the value chip swaps in
   a small numeric input; commit (Enter/blur) clamps to the slider's range,
   writes the slider and fires its input event so updateProjection refreshes
   everything (including the value text). Wired once at startApp. */
export function initSliderValueEdit() {
  document.querySelectorAll('.slider-header .slider-value').forEach(function (svEl) {
    if (svEl.dataset.editWired) return;
    svEl.dataset.editWired = '1';
    svEl.setAttribute('role', 'button');
    svEl.setAttribute('tabindex', '0');
    svEl.title = 'Tap to type a value';
    const begin = () => {
      const sl = document.getElementById(svEl.id.replace(/^sv-/, 'sl-'));
      if (!sl || svEl.style.display === 'none') return;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = 'decimal';
      inp.className = 'form-input mono';
      inp.style.cssText = 'width:72px;padding:4px 8px;font-size:inherit;text-align:right';
      inp.value = sl.value;
      inp.setAttribute('aria-label', 'Type a value');
      svEl.style.display = 'none';
      svEl.after(inp);
      inp.focus();
      inp.select();
      const commit = () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) {
          sl.value = Math.min(parseFloat(sl.max), Math.max(parseFloat(sl.min), v));
          sl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        inp.remove();
        svEl.style.display = '';
      };
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    };
    svEl.addEventListener('click', begin);
    svEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } });
  });
}

export function updateProjection() {
  // Sync slider display values
  const sliders = {
    'sl-income':    'sv-income',
    'sl-inflation': 'sv-inflation',
    'sl-medical':   'sv-medical',
    'sl-years':     'sv-years',
    'sl-ra':        'sv-ra',
    'sl-ra-pct':    'sv-ra-pct',
  };
  Object.entries(sliders).forEach(([sl, svId]) => {
    const s = $(sl), d = $(svId);
    if(s && d) d.textContent = sl === 'sl-years' ? s.value : s.value + '%';
  });

  const actual   = calcFullTax();
  const ty       = actual.ty;
  const incRate  = parseFloat($('sl-income')?.value || 6) / 100;
  const inflRate = parseFloat($('sl-inflation')?.value || 5) / 100;
  // sl-medical escalates contributions only; the forecast claims s6A alone
  // (fixed credit, no s6B), so the rate does not enter the calculation.
  const years    = parseInt($('sl-years')?.value || 5);
  const raMethod = gs('proj-ra-method') || 'growth';
  const raGrowth = parseFloat($('sl-ra')?.value || 10) / 100;
  const raPct    = parseFloat($('sl-ra-pct')?.value || 15) / 100;
  const addInc   = gv('proj-add-income');

  // Base figures from Actual
  const baseGross  = actual.gross;
  const baseSal    = APP.incomeItems.filter(i => i.cat === 'salary' || i.cat === 'commission' || i.cat === 'contractor').reduce((s,i) => s+i.amount, 0);
  const baseOther  = baseGross - baseSal;
  const baseRA     = gv('ded_ra') + gv('ded_pension') + gv('ded_provident');
  // H-5 fix: travel/homeoffice/tools/donations live in APP.appliedValues, not in input fields.
  // V8.2 read non-existent IDs ded_travel, ded_homeoffice, ded_other (always returned 0).
  const _avb = APP.appliedValues || {};
  const baseOtherDed = (_avb.travel || 0) + (_avb.homeoffice || 0) + (_avb.tools || 0)
                     + gv('ded_subscrip');
  const isMain     = isMedicalSchemeMemberDom();  // membership derived from contributions
  const deps       = gv('med_deps');
  const baseAge    = actual.age;
  // Simplified medical (s6A only, no s6B — projection doesn't know OOP)
  const s6a        = calcS6ACredit(ty, isMain, deps);

  const fc = [];

  for(let y = 0; y <= years; y++) {
    const sal      = baseSal   * Math.pow(1 + incRate,  y);
    const other    = baseOther * Math.pow(1 + inflRate, y) + addInc * y;
    const gross    = sal + other;
    const otherDed = baseOtherDed * Math.pow(1 + inflRate, y);

    // RA calculation
    let raTotal;
    if(raMethod === 'fixed_pct' && raPct > 0) {
      // Fixed % of taxable income after other deductions, before RA
      const tbd = Math.max(0, gross - otherDed);
      raTotal = tbd * raPct;
    } else {
      raTotal = baseRA * Math.pow(1 + raGrowth, y);
    }

    const r = calcTaxForYear({ gross, retContrib: raTotal, otherDed, age: baseAge + y, credits: s6a }, ty);
    const eff      = gross > 0 ? r.taxPayable / gross : 0;
    const takeHome = gross - r.taxPayable;

    fc.push({
      yr:          parseInt(gs('taxYear') || '2027') + y,
      label:       y === 0 ? 'Base' : `Y${y}`,
      gross, taxable: r.taxable, taxPayable: r.taxPayable, eff, takeHome, raAllowed: r.retAllowed
    });
  }

  // Render base stats
  const pb = $('proj-base-stats');
  if(pb) {
    pb.innerHTML = `
      <div class="stat-card"><div class="stat-value">${fmt(actual.gross)}</div><div class="stat-label">Current Gross</div></div>
      <div class="stat-card"><div class="stat-value">${pct(actual.effectiveRate)}</div><div class="stat-label">Effective Rate</div></div>
      <div class="stat-card"><div class="stat-value">${fmt(actual.taxPayable)}</div><div class="stat-label">Tax Payable</div></div>
      <div class="stat-card"><div class="stat-value">${fmt(actual.gross - actual.taxPayable)}</div><div class="stat-label">Take-Home</div></div>`;
  }

  renderMultiYearTable(fc);
  renderMultiYearChart(fc);
  renderRateTrendChart(fc);
  renderOptimisation();
  analyseRA();
}

/* ── YEAR COMPARISON TABLE ──
   Base year beside ONE chosen forecast year, never every year at once: at
   360px a column per year (up to eleven) could only scroll sideways. The
   line chart above carries the year-by-year shape; this answers "what
   changes by year N". The chosen year is view state only, never saved. */
let _cmpYearIdx = null;
let _lastForecast = null;

export function setProjCompareYear(v) {
  _cmpYearIdx = parseInt(v, 10);
  if (_lastForecast) renderMultiYearTable(_lastForecast);
}

/* up: whether a rise is good for the taxpayer (null = neither). The sign
   and the word carry the meaning too, so colour is never the only cue. */
const CMP_METRICS = [
  { key: 'gross',      label: 'Gross income',   up: true },
  { key: 'taxable',    label: 'Taxable income', up: null },
  { key: 'taxPayable', label: 'Tax payable',    up: false },
  { key: 'eff',        label: 'Effective rate', up: false, isPct: true },
  { key: 'takeHome',   label: 'Take-home',      up: true },
  { key: 'raAllowed',  label: 'RA deducted',    up: true },
];

export function renderMultiYearTable(fc) {
  const thead = $('multiyear-table-head');
  const tbody = $('multiyear-table-body');
  if (!thead || !tbody || !fc.length) return;
  _lastForecast = fc;
  const last = fc.length - 1;
  if (_cmpYearIdx == null || !(_cmpYearIdx >= 1 && _cmpYearIdx <= last)) _cmpYearIdx = last;
  const yrLbl = d => d.yr + '/' + String(d.yr + 1).slice(-2);

  const sel = $('proj-cmp-year');
  if (sel) {
    sel.innerHTML = fc.slice(1).map((d, k) =>
      `<option value="${k + 1}"${k + 1 === _cmpYearIdx ? ' selected' : ''}>${yrLbl(d)} — year ${k + 1}</option>`).join('');
    sel.disabled = last < 1;
  }

  const base = fc[0], cmp = last >= 1 ? fc[_cmpYearIdx] : null;
  thead.innerHTML = '<tr><th scope="col">Metric</th>'
    + `<th scope="col">${yrLbl(base)}<span class="proj-cmp-tag">Base</span></th>`
    + (cmp ? `<th scope="col">${yrLbl(cmp)}<span class="proj-cmp-tag">Year ${_cmpYearIdx}</span></th>` : '')
    + '</tr>';

  tbody.innerHTML = CMP_METRICS.map(m => {
    const show = v => m.isPct ? pct(v) : fmt(v);
    let cmpCell = '';
    if (cmp) {
      const diff = cmp[m.key] - base[m.key];
      const flat = m.isPct ? Math.abs(diff) < 0.0005 : Math.abs(diff) < 0.5;
      const tone = flat || m.up === null ? 'flat' : ((diff > 0) === m.up ? 'good' : 'bad');
      const sign = flat ? '' : diff > 0 ? '+' : '−';
      const mag = m.isPct ? (Math.abs(diff) * 100).toFixed(1) + ' pts' : fmt(Math.abs(diff));
      cmpCell = `<td><div>${show(cmp[m.key])}</div><div class="proj-cmp-delta ${tone}">${flat ? 'no change' : sign + mag}</div></td>`;
    }
    return `<tr><th scope="row">${m.label}</th><td>${show(base[m.key])}</td>${cmpCell}</tr>`;
  }).join('');
}

/* ── MULTI-YEAR CHART ── */
export function renderMultiYearChart(fc) {
  const ctx = $('multiyear-chart'); if(!ctx) return;
  if(APP.charts.multiyear) APP.charts.multiyear.destroy();
  const cc = {grid:'rgba(255,255,255,0.05)', text:cssColour('--dim','#7aaad4')};
  /* §G: "projections show the counterfactual" — a dashed line holding the
     base year's take-home flat behind the solid projected take-home line,
     so the forecast is read against "if nothing changed" rather than in
     isolation. Take-home is the figure a taxpayer actually feels. */
  const baseTakeHome = fc[0] ? fc[0].takeHome : 0;
  APP.charts.multiyear = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fc.map(d => d.yr + '/' + (d.yr+1).toString().slice(-2)),
      datasets: [
        {label:'Gross Income',    data:fc.map(d=>d.gross),      borderColor:cssColour('--cyan','#00aaf0'), backgroundColor:'rgba(0,170,240,0.06)', fill:true, tension:.3, pointRadius:4, borderWidth:2},
        {label:'Taxable Income',  data:fc.map(d=>d.taxable),    borderColor:'#b4dc00', backgroundColor:'rgba(180,220,0,0.06)', fill:true, tension:.3, pointRadius:4, borderWidth:2},
        {label:'Tax Payable',     data:fc.map(d=>d.taxPayable), borderColor:cssColour('--red', '#FF5C7A'), backgroundColor:'rgba(255,92,122,0.06)', fill:true, tension:.3, pointRadius:4, borderWidth:2},
        {label:'Take-Home',       data:fc.map(d=>d.takeHome),   borderColor:cssColour('--mint', '#5DF2B8'), backgroundColor:'rgba(93,242,184,0.06)', fill:true, tension:.3, pointRadius:4, borderWidth:2},
        {label:'Take-Home (if unchanged)', data:fc.map(() => baseTakeHome), borderColor:cssColour('--mint', '#5DF2B8'), borderDash:[5,4], borderWidth:1.5, pointRadius:0, fill:false, tension:0},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'", size:11}}},
        y: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'", size:11}, callback: v => 'R'+(v/1000).toFixed(0)+'k'}}
      },
      plugins: {
        legend: {labels:{color:cc.text, font:{family:"'Inter'"}}},
        tooltip: {callbacks:{label: c => c.dataset.label + ': ' + fmt(c.raw)}}
      }
    }
  });
}

/* §G: projected years (everything past the base/current year) render as a
   hatched bar rather than a solid one — a diagonal-stripe CanvasPattern
   drawn once per distinct colour, since Chart.js accepts a CanvasPattern
   anywhere it accepts a fill colour. No canvas library added — this is a
   handful of 2D-context draw calls. */
const _hatchCache = {};
function hatchPattern(colour) {
  if (_hatchCache[colour]) return _hatchCache[colour];
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = colour.replace(/,\s*[\d.]+\)$/, ',0.18)');
  g.fillRect(0, 0, 8, 8);
  g.strokeStyle = colour;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 8); g.lineTo(8, 0);
  g.moveTo(-2, 2); g.lineTo(2, -2);
  g.moveTo(6, 10); g.lineTo(10, 6);
  g.stroke();
  const pat = g.createPattern(c, 'repeat');
  _hatchCache[colour] = pat;
  return pat;
}

/* ── RATE TREND CHART ── */
export function renderRateTrendChart(fc) {
  const ctx = $('rate-trend-chart'); if(!ctx) return;
  if(APP.charts.rateTrend) APP.charts.rateTrend.destroy();
  const cc = {grid:'rgba(255,255,255,0.05)', text:cssColour('--dim','#7aaad4')};
  APP.charts.rateTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: fc.map(d => d.yr + '/' + (d.yr+1).toString().slice(-2)),
      datasets: [{
        label: 'Effective Rate',
        /* §G: base (actual, y=0) is solid; every projected year is hatched —
           a forecast should never look as certain as a recorded figure. */
        data: fc.map(d => d.eff * 100),
        backgroundColor: fc.map((_,i) => i===0 ? 'rgba(0,170,240,0.6)' : hatchPattern('rgba(180,220,0,0.85)')),
        borderColor:     fc.map((_,i) => i===0 ? cssColour('--cyan','#00aaf0') : '#b4dc00'), /* STD-COL-3: '#b4dc00' has no existing token match — see design-system-audit-2026-09 Batch 1 note */
        borderWidth: 1, borderRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {grid:{display:false}, ticks:{color:cc.text, font:{family:"'Inter'", size:11}}},
        y: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'", size:11}, callback: v => v.toFixed(0)+'%'}, beginAtZero:true}
      },
      plugins: {
        legend: {display:false},
        tooltip: {callbacks:{label: c => 'Effective Rate: ' + c.raw.toFixed(1)+'%'}}
      }
    }
  });
}

/* Normal tax at this year's figures with `addDed` more retirement
   deduction: taxable income before donations falls, the donations cap
   (s18A) re-applies to it, and the medical credit is redone at the new
   taxable income (s6B). Use it as a DIFFERENCE from addDed = 0, so terms a
   top-up does not touch (foreign tax credit, lump sums, the s12T charge,
   PAYE, provisional tax) cancel instead of being rebuilt. One source for
   the RA analyser and the RA-room tip (BACKLOG 88, WR-8). */
function taxWithMoreRetirement(actual, addDed) {
  const ty = actual.ty;
  const tbd = Math.max(0, (actual.tbd || 0) - addDed);
  const don = Math.min(actual.donTotal || 0, tbd * (ty.donationPct / 100));
  return calcTaxForYear({ taxable: Math.max(0, tbd - don), age: actual.age, medical: actual.medInputs }, ty).taxPayable;
}

/* ── OPTIMISATION TIPS ── */
export function renderOptimisation() {
  const el = $('optimise-tips'); if(!el) return;
  const r   = calcFullTax();
  const ty  = r.ty;
  const tips = [];

  // RA room
  /* BACKLOG 25: the engine's s11F cap and contributions (see analyseRA). */
  const maxRA   = r.retMax || 0;
  const curRA   = (r.retTotal || 0) + (r.pyRetExcess || 0);
  const raRoom  = Math.max(0, maxRA - curRA);
  /* BACKLOG 88: the saving is the engine's tax before minus after — the
     room can cross a bracket, so room × marginal rate overstated it. */
  if(raRoom > 1000) {
    const raSaving = Math.max(0, taxWithMoreRetirement(r, 0) - taxWithMoreRetirement(r, Math.max(0, maxRA - (r.retAllowed || 0))));
    tips.push({i:'savings', t:'RA Top-Up Capacity Available', d:`Unused retirement deduction room: ${fmt(raRoom)}. Contributing that much more to an RA would reduce your tax by about ${fmt(raSaving)}.`});
  }

  // No medical entered
  if(gv('med_monthly') === 0)
    tips.push({i:'medical_services', t:'Medical Credits Not Claimed', d:'No medical scheme contributions entered. If you have medical aid, enter your contributions on the Medical tab to claim your s6A credit — worth at least ' + fmt(r.ty.medical.main * 12) + ' per year for a single member.'});  /* BACKLOG 25: was a typed R4,368 (2024/25-26 figure) */

  // Donations room (H-5 fix: donations live in APP.appliedValues)
  const _donations = (APP.appliedValues || {}).donations || 0;
  if(_donations === 0 && r.taxableIncome > 200000)
    tips.push({i:'volunteer_activism', t:'Section 18A Donations', d:`Qualifying donations are deductible up to ${fmt(r.donMax)} (${r.ty.donationPct}% of your taxable income before donations). Retain all s18A receipts from SARS-approved PBOs.`});  /* BACKLOG 25: the engine's own s18A cap (r.donMax), not taxableIncome × 0.10 */

  // Travel allowance not claimed
  const _travel = (APP.appliedValues || {}).travel || 0;
  var _hasTravelIncome = APP.incomeItems.some(function(i){ return i.code==='3701'||i.code==='3702'||i.code==='3722'; });
  if(_hasTravelIncome && _travel === 0)
    tips.push({i:'directions_car', t:'Travel — Deduction Not Claimed', d:'You have travel income (codes 3701/3702/3722) but no travel deduction has been applied. Use the Deductions \u2192 Travel tab to compute your logbook-based s8(1)(b) deduction.'});

  // Year-end deadline
  tips.push({i:'event_available', t:'Year-End Deadline: 28 February', d:'RA contributions made before 28 February count toward the current tax year deduction limit. Plan additional contributions before year-end to maximise your deduction.'});

  // Provisional taxpayer under-payment (§5 H-4 fix: para 20 logic with safe-harbour)
  if(gs('p_provisional') === 'yes') {
    const provTotal = gv('p_prov_p1') + gv('p_prov_p2') + gv('p_prov_topup');
    if (r.taxPayable > 0 && provTotal > 0) {
      const pp = calcProvisionalPenalty(r);
      if (pp.triggered) {
        const thresholdLabel = pp.isHighIncome ? '80%' : '90%';
        // Dynamic threshold formatting (R1m / R1.8m)
        const thresholdM = pp.para20Threshold / 1e6;
        const thresholdLong = thresholdM === Math.floor(thresholdM)
          ? `R${thresholdM.toFixed(0)} million` : `R${thresholdM.toFixed(1)} million`;
        const bucket = pp.isHighIncome ? `taxable income above ${thresholdLong}` : `taxable income ${thresholdLong} or less`;
        const safeNote = pp.isHighIncome ? '' : ' If your second-period estimate is at or above your basic amount of prior assessment, the safe harbour applies regardless of percentage.';
        tips.push({
          i: 'warning',
          t: 'Provisional Tax Underestimation Penalty Risk',
          d: `Para 20 of the Fourth Schedule: for ${bucket}, your total payments (PAYE + Provisional) must cover at least the tax on ${thresholdLabel} of actual taxable income. Total paid (${fmt(pp.totalPaid)}) is below the required (${fmt(pp.requiredPayment)}). Estimated 20% penalty: ${fmt(pp.penalty)}.${safeNote} This is modelled on amounts PAID — the statutory trigger is your second-period IRP6 ESTIMATE, which may differ. Top up before 28 February.`
        });
      }
    }
  }

  el.innerHTML = tips.length
    ? tips.map(t => `<div class="tip-card"><i class="${iconClassFor(t.i)}"></i><div><div class="tip-title">${esc(t.t)}</div><div class="tip-desc">${esc(t.d)}</div></div></div>`).join('')
    : '<div class="empty-state"><i class="material-symbols-outlined msi-check-circle u-c-ok"></i><p>No optimisation opportunities identified based on current data.</p></div>';
}

/* ── RA CONTRIBUTION ANALYSER ── */
export function analyseRA() {
  const el     = $('ra-analysis-result'); if(!el) return;
  const topup  = gv('ra-topup-input');
  const actual = calcFullTax();
  const ty     = actual.ty;

  /* BACKLOG 25 (hard rule 2): the cap and the contributions are the
     engine's own — retMax is s11F(2)'s lowest of the percentage test on the
     greater of remuneration or taxable income, the rand cap and the final
     taxable-income cap; retTotal + pyRetExcess is what s11F(3) tests against
     it. This used to be min(gross × pct, cap): gross is IRP5 income only
     (no rental, business, CGT, investment income; lump sums and non-taxable
     codes in), so the cap and every saving below were wrong for most users. */
  const curRA  = (actual.retTotal || 0) + (actual.pyRetExcess || 0);
  const maxDed = actual.retMax || 0;
  const capRoom = Math.max(0, maxDed - curRA);
  /* Every result below is a DIFFERENCE from simTax(0) (see
     taxWithMoreRetirement). */
  const simTax = (addDed) => taxWithMoreRetirement(actual, addDed);
  const baseTP = simTax(0);

  // Amount to zero refund (only relevant if currently in refund)
  let zeroRefundAmt = null;
  if(actual.balance < 0) {
    // Binary search: find RA top-up that makes balance = 0
    let lo = 0, hi = capRoom, mid;
    for(let i = 0; i < 40; i++) {
      mid = (lo + hi) / 2;
      const newRA    = Math.min(curRA + mid, maxDed);
      const addDed   = Math.max(0, newRA - actual.retAllowed);
      /* A top-up only moves normal tax; the balance moves by the same
         amount (S2 Batch 7's lump-sum and s12T terms cancel). */
      const newBal   = actual.balance - (baseTP - simTax(addDed));
      if(newBal < 0) lo = mid; else hi = mid;
    }
    zeroRefundAmt = Math.min(mid, capRoom);
  }

  /* §G: the s11F cap is a live message, not a footnote — states remaining
     headroom while under the cap, turns amber and names the limit at this
     income the moment the entered top-up would cross it. */
  const capNoteMsg = topup > capRoom
    ? `<strong>Over the s11F cap.</strong> At your income, the deduction limit is ${fmt(maxDed)} (the yearly limit at your income). You've used ${fmt(curRA)} + ${fmt(topup)} top-up — only ${fmt(capRoom)} more is deductible this year.`
    : `<strong>Current RA deduction used:</strong> ${fmt(curRA)} of ${fmt(maxDed)} cap — ${fmt(capRoom)} headroom remaining.`;
  /* UI-NOTE-1: one line; the cap arithmetic behind More. */
  const capShort = topup > capRoom ? `Over the cap: only ${fmt(capRoom)} more is deductible.` : `${fmt(capRoom)} of RA cap room left this year.`;
  const capTone = topup > capRoom ? 'warning' : 'lime';

  if(topup <= 0) {
    el.innerHTML = `
      ${noteHtml(capTone, capShort, capNoteMsg + (actual.balance < 0 ? `<br><br><strong>Amount to zero your refund:</strong> ${fmt(zeroRefundAmt)} additional RA contribution.` : '') + '<br><br>Enter an additional RA amount above to see the tax impact.', { title: 'Retirement annuity cap' })}`;
    return;
  }

  // Calculate with topup
  const newRA     = Math.min(curRA + topup, maxDed);
  const actualRaAllowed = actual.retAllowed;
  const newAllowed = Math.min(newRA, maxDed);
  const addedDed  = Math.max(0, newAllowed - actualRaAllowed);

  const taxSaving = Math.max(0, baseTP - simTax(addedDed));
  const isExcess  = topup > capRoom;

  /* §G: "scenarios state net cost beside tax saved" — the top-up itself is
     money out of pocket now; the saving is smaller than that up-front cost,
     so both are shown side by side rather than the saving alone. */
  const netCost = Math.max(0, topup - taxSaving);

  el.innerHTML = `
    ${noteHtml(capTone, capShort, capNoteMsg, { style: 'margin-bottom:9px', title: 'Retirement annuity cap' })}
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-value u-c-teal">${fmt(addedDed)}</div>
        <div class="stat-label">Additional Deduction</div>
      </div>
      <div class="stat-card">
        <div class="stat-value u-c-ok">${fmt(taxSaving)}</div>
        <div class="stat-label">Reduction in Tax Payable</div>
      </div>
      <div class="stat-card">
        <div class="stat-value u-c-warning">${fmt(netCost)}</div>
        <div class="stat-label">Net Cost Out of Pocket</div>
      </div>
      ${zeroRefundAmt !== null ? `
      <div class="stat-card">
        <div class="stat-value u-c-warning">${fmt(zeroRefundAmt)}</div>
        <div class="stat-label">Amount to Zero Refund</div>
      </div>` : ''}
    </div>
    <div style="font-size:0.75rem;color:var(--tx2);margin-top:8px">
      <strong>Tax saving</strong> = reduction in your actual tax payable (not a reduction in taxable income).<br>
      <strong>Net cost out of pocket</strong> = your ${fmt(topup)} top-up minus the ${fmt(taxSaving)} tax saving — what actually leaves your pocket net of the saving.<br>
      ${zeroRefundAmt !== null ? `<strong>Amount to zero refund</strong> = additional RA that would reduce your refund to exactly R0 (${fmt(Math.abs(actual.balance))} current refund).<br>` : ''}
    </div>
    ${isExcess ? noteHtml('warning', `Only ${fmt(capRoom)} of the top-up is deductible this year.`, `Your top-up of ${fmt(topup)} exceeds the available cap room of ${fmt(capRoom)}. Only ${fmt(capRoom)} is deductible this year — the excess of ${fmt(topup - capRoom)} is carried forward to next year.`, { cls: 'u-mt-9', title: 'Over the cap' }) : ''}
    ${taxSaving <= 0 ? noteHtml('info', 'No extra saving — you are already at the cap.', null, { cls: 'u-mt-9' }) : ''}`;
}


