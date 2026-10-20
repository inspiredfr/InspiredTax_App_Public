import { HIST_TAX, TAX_YEARS } from './01-data.js';
import { cssColour, noteHtml, $, APP, calcS6ACredit, calcTaxForYear, fmt, gs, gv, pct, sv, iconClassFor, donutHtml } from './02-core.js';
import { cardRow, cardTotal, paymentsCardSpec, taxCardsHtml } from './07-render-summary.js';

/* ============================================================
   InspiredTax v8.5 — HISTORICAL MODE
   Calculator, year comparison, rate tables
   ============================================================ */

export function onHistYearChange() {
  const yr = gs('hist-year');
  const ty = HIST_TAX[yr]; if(!ty) return;

  // Auto-pull age from profile DOB based on selected historical year
  const dob = gs('p_dob');
  if(dob) {
    const endYr  = parseInt(yr);
    const endDate = new Date(endYr + 1, 2, 0); // L-1 fix: last day of Feb of year after (handles leap years)
    const b = new Date(dob);
    let age = endDate.getFullYear() - b.getFullYear();
    if(endDate.getMonth()-b.getMonth()<0||(endDate.getMonth()===b.getMonth()&&endDate.getDate()<b.getDate())) age--;
    if(age > 0) sv('hist-age', age);
  }

  const noteEl = $('hist-year-note'); if(noteEl) {
    noteEl.innerHTML = `<div class="note lime">
      <strong>${ty.label}</strong> (${ty.period}) — 
      Primary rebate: ${fmt(ty.rebates.primary)} · 
      Medical credit: R${ty.medical.main}/month · 
      Ret. cap: ${fmt(ty.retirement.cap)}${ty.retirement.note ? '<br><strong>Note:</strong> '+ty.retirement.note : ''}
    </div>`;
  }

  const retNote = $('hist-ret-note'); if(retNote) {
    retNote.innerHTML = ty.retirement.note
      ? `<div class="note warning">${ty.retirement.note}</div>` : '';
  }

  calcHistorical();
}

export function calcHistorical() {
  const yr  = gs('hist-year');
  const ty  = HIST_TAX[yr]; if(!ty) return;
  const age = parseInt(gs('hist-age')) || 35;

  const gross = gv('hist-gross') + gv('hist-other-inc');

  /* Shared engine (v8.23): the inline copy this replaces had drifted — its
     s6B for under-65 lacked the 7.5%-of-taxable-income threshold (applicable
     to all years in HIST_TAX, i.e. 2015/16 onward), overstating the credit. */
  const r = calcTaxForYear({
    gross, cgtRaw: gv('hist-cgt'), retContrib: gv('hist-ret'),
    otherDed: gv('hist-travel') + gv('hist-other-ded'),
    donations: gv('hist-donations'), age,
    medical: { isMain: gs('hist-main') === '1', deps: parseInt(gs('hist-deps')) || 0,
               contrib: gv('hist-med-contrib'), oop: gv('hist-med-oop'),
               disability: gs('hist-disability') === '1' }
  }, ty);
  const {cgtNetGain: netGain, cgtTaxable: inclGain, retMax, retAllowed: retA, retExcess: retEx,
         donAllowed: donD, taxable, toi, rebates: reb, med, taxPayable} = r;
  const oD = gv('hist-travel') + gv('hist-other-ded');

  const paye    = gv('hist-paye');
  const balance = taxPayable - paye;
  const eff     = gross > 0 ? taxPayable / gross : 0;

  const el = $('hist-result'); if(!el) return;
  const isR = balance < 0, isO = balance > 0;

  /* UI-CARD-1 (BACKLOG 28): the Tax-screen card, option B, with the same
     lines the detail below lists — every figure is this year's
     calcTaxForYear() output above, or the user's own inputs. A chain marks
     itself as casting only when its rows really do sum to the figure. */
  const deds = retA + oD + donD;
  const tiCasts = Math.abs(gross + inclGain - deds - taxable) < 1;
  const taxCasts = Math.abs(toi - reb - med.total - taxPayable) < 1;
  const cards = taxCardsHtml([
    { lbl: 'Gross income', key: 'hist-gross', c: 'var(--emerald)', val: fmt(gross), raw: gross,
      body: gross > 0 ? cardRow('Employment income', gv('hist-gross'), 1, 'var(--emerald)') + cardRow('Other taxable income', gv('hist-other-inc'), 1, 'var(--cyan)') + cardTotal('Gross income', fmt(gross), gross) : '',
      chart: donutHtml([{ label: 'Employment income', val: gv('hist-gross'), color: 'var(--emerald)' }, { label: 'Other taxable income', val: gv('hist-other-inc'), color: 'var(--cyan)' }], { size: 64 }) },
    { lbl: 'Taxable income', key: 'hist-taxable', c: 'var(--navy)', val: fmt(taxable), raw: taxable,
      ring: donutHtml([{ val: taxable, color: 'var(--navy)' }], { compact: true, whole: gross + inclGain }),
      body: taxable > 0 ? cardRow('Gross income', gross, 1) + cardRow('Plus taxable capital gain', inclGain, 1) + cardRow('Less retirement contributions', retA, -1)
        + cardRow('Less travel and other deductions', oD, -1) + cardRow('Less donations', donD, -1) + cardTotal('Taxable income', fmt(taxable), tiCasts ? taxable : null) : '',
      chart: donutHtml([{ label: 'Taxable income', val: taxable, color: 'var(--navy)' }, { label: 'Deductions', val: deds, color: 'var(--violet)' }], { size: 64 }) },
    { lbl: 'Tax payable', key: 'hist-tax', c: 'var(--navy)', val: fmt(taxPayable), raw: taxPayable,
      ring: donutHtml([{ val: taxPayable, color: 'var(--navy)' }], { compact: true, whole: toi }),
      body: taxPayable > 0 ? cardRow('Tax on taxable income', toi, 1) + cardRow('Less rebates', reb, -1) + cardRow('Less medical tax credits', med.total, -1) + cardTotal('Tax payable', fmt(taxPayable), taxCasts ? taxPayable : null) : '',
      chart: donutHtml([{ label: 'Tax payable', val: taxPayable, color: 'var(--navy)' }, { label: 'Rebates and credits used', val: Math.max(0, toi - taxPayable), color: 'var(--neutral)' }], { size: 64 }) },
    Object.assign(paymentsCardSpec({ lbl: isR ? 'Refund Due' : isO ? 'Amount Owing' : 'Tax Position Is Balanced', key: 'hist-balance', figure: Math.abs(balance), paye, tax: taxPayable, taxLabel: 'Tax payable', balance }),
      (taxPayable > 0 || paye > 0) ? {} : { body: '' })
  ], 'tax-prior-years');

  el.innerHTML = `
    <div class="mini-grid tax-cards">${cards}</div>
    <div class="card">
      <div class="card-title"><i class="material-symbols-outlined msi-calculate"></i> ${ty.label} — Tax Calculation Detail</div>
      <div class="sum-line"><span class="lbl">Employment Income</span><span class="val">${fmt(gv('hist-gross'))}</span></div>
      <div class="sum-line"><span class="lbl">Other Taxable Income</span><span class="val">${fmt(gv('hist-other-inc'))}</span></div>
      ${inclGain > 0 ? `<div class="sum-line"><span class="lbl">Net Capital Gain Included (${(ty.cgt.inclusion*100).toFixed(0)}% × ${fmt(netGain)})</span><span class="val">${fmt(inclGain)}</span></div>` : ''}
      <div class="sum-line"><span class="lbl">Less: Retirement (${fmt(retA)} of ${fmt(retMax)} cap)</span><span class="val">− ${fmt(retA)}</span></div>
      ${retEx > 0 ? `<div class="sum-line"><span class="lbl u-c-warning">⚠ Excess retirement c/f</span><span class="val u-c-warning">${fmt(retEx)}</span></div>` : ''}
      <div class="sum-line"><span class="lbl">Less: Travel + Other Deductions</span><span class="val">− ${fmt(oD)}</span></div>
      <div class="sum-line"><span class="lbl">Less: Donations (s18A)</span><span class="val">− ${fmt(donD)}</span></div>
      <div class="sum-line divider total"><span class="lbl">Taxable Income</span><span class="val">${fmt(taxable)}</span></div>
      <div class="sum-line"><span class="lbl">Tax on Income</span><span class="val">${fmt(toi)}</span></div>
      <div class="sum-line"><span class="lbl">Less: Rebates</span><span class="val">− ${fmt(reb)}</span></div>
      <div class="sum-line"><span class="lbl">Less: Medical Credits (s6A ${fmt(med.s6a)} + s6B ${fmt(med.s6b)})</span><span class="val">− ${fmt(med.total)}</span></div>
      <div class="sum-line divider total"><span class="lbl">Tax Payable</span><span class="val">${fmt(taxPayable)}</span></div>
      <div class="sum-line"><span class="lbl">Less: PAYE Paid</span><span class="val">− ${fmt(paye)}</span></div>
      <div class="sum-line divider total ${isR?'refund':isO?'owing':''}">
        <span class="lbl">${isR?'REFUND DUE':isO?'AMOUNT OWING':'TAX POSITION IS BALANCED'}</span>
        <span class="val">${isR?'('+fmt(Math.abs(balance))+')':fmt(balance)}</span>
      </div>
      <div class="u-text-center-mt-12">
        <div class="result-badge ${isR?'refund':isO?'owing':'balanced'}">
          <i class="${iconClassFor(isR?'arrow_downward':isO?'arrow_upward':'check')}"></i>
          ${isR?'Refund: '+fmt(Math.abs(balance)):isO?'Owing: '+fmt(balance):'Tax position is balanced'}
        </div>
      </div>
      <div style="text-align:center;font-size:0.6875rem;color:var(--tx3);margin-top:8px">
        Effective Rate: <strong>${pct(eff)}</strong> &nbsp;·&nbsp;
        CGT Inclusion: <strong>${(ty.cgt.inclusion*100).toFixed(0)}%</strong> &nbsp;·&nbsp;
        Annual Exclusion: <strong>${fmt(ty.cgt.annualExcl)}</strong>
      </div>
    </div>`;
}

/* ── YEAR COMPARISON ── */
export function renderHistoricalComparison() {
  const overrideGross = gv('hist-compare-gross');
  const baseGross = overrideGross > 0 ? overrideGross : gv('hist-gross') || 500000;
  const age = parseInt(gs('hist-age')) || 35;

  const data = Object.entries(HIST_TAX).map(([yr, ty]) => {
    // retContrib = baseGross ⇒ the s11F cap binds (full 27.5%/rand-cap utilisation assumed)
    const r = calcTaxForYear({ gross: baseGross, retContrib: baseGross, age,
                               credits: calcS6ACredit(ty, true, 1) /* 1 dep simplified */ }, ty);
    return {yr, ty, taxPayable: r.taxPayable, eff: baseGross > 0 ? r.taxPayable/baseGross : 0};
  }).reverse(); // oldest to newest

  /* §G (07-surfaces-and-motion.md): "one chart, one question" — history
     answers "is my effective rate rising?", so the bar metric is the
     effective rate, not the rand amount (still available via tap/tooltip).
     Tapping a bar selects that year (drives hist-year + recalculates)
     instead of plotting several series at once. */
  const ctx = $('hist-compare-chart'); if(ctx) {
    if(APP.charts.histCompare) APP.charts.histCompare.destroy();
    const selectedYr = gs('hist-year');
    const cc = {grid:'rgba(255,255,255,0.05)', text:cssColour('--dim','#7aaad4')};
    APP.charts.histCompare = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.ty.label),
        datasets: [{
          label: 'Effective Rate',
          data:  data.map(d => d.eff * 100),
          backgroundColor: data.map(d => d.yr === selectedYr ? 'rgba(180,220,0,0.7)' : 'rgba(0,170,240,0.5)'),
          borderColor:     data.map(d => d.yr === selectedYr ? '#b4dc00' : cssColour('--cyan','#00aaf0')), /* STD-COL-3: '#b4dc00' has no existing token match — see design-system-audit-2026-09 Batch 1 note */
          borderWidth: 1, borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (evt, els) => {
          if (!els.length) return;
          const yr = data[els[0].index].yr;
          sv('hist-year', yr);
          onHistYearChange();
          renderHistoricalComparison();
        },
        scales: {
          x: {grid:{display:false}, ticks:{color:cc.text, font:{family:"'Inter'",size:10.5}, maxRotation:30}},
          y: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'",size:11}, callback:v=>v.toFixed(0)+'%'}, beginAtZero:true}
        },
        plugins: {
          legend: {display:false},
          tooltip: {callbacks:{label:c=>'Effective rate: '+c.raw.toFixed(1)+'% · Tax: '+fmt(data[c.dataIndex].taxPayable)}}
        }
      }
    });
  }

  // Summary table
  const tbody = $('hist-compare-body'); if(!tbody) return;
  tbody.innerHTML = data.map(d => `
    <tr>
      <td style="font-weight:700">${d.ty.label}</td>
      <td style="font-size:0.65625rem">${d.ty.period}</td>
      <td>${fmt(d.taxPayable)}</td>
      <td>${pct(d.eff)}</td>
      <td>${fmt(d.ty.rebates.primary)}</td>
      <td>R${d.ty.medical.main}</td>
      <td>${(d.ty.cgt.inclusion*100).toFixed(0)}%</td>
      <td>${fmt(d.ty.retirement.cap)}</td>
    </tr>`).join('');
}

/* ── RATE TABLES ── */

/* ── RATE TABLE (inline for Tax Act References mode) ── */
export function renderRateTableInline() {
  const yr = gs('ratetable-year-inline');
  const ty = TAX_YEARS[yr] || HIST_TAX[yr];
  const el = $('rate-table-output-inline');
  if(!ty || !el) return;
  renderRateTableTo(ty, el, yr);
}
export function renderRateTableTo(ty, el, yr) {
  const provisional2027 = yr === '2027' ? noteHtml('warning', 'One 2027 threshold is still provisional.', 'The para 20 threshold (R1.8m) is provisional, pending TLAB 2026 enactment but already used by SARS for IRP6 estimates.', { style: 'margin-bottom:12px', title: '2026/27 rates' }) : '';
  /* UI-FS-1: each table sits in its own scroll box — a table may be wider
     than the screen only there (CLAUDE.md mobile rules), and at large
     Android text sizes the band table is. */
  el.innerHTML = `
    ${provisional2027}
    <div class="note lime note-data" style="margin-bottom:12px">
      <strong>${ty.label}</strong> (${ty.period})<br>
      Rebates: Primary ${fmt(ty.rebates.primary)} \u00b7 Secondary ${fmt(ty.rebates.secondary)} \u00b7 Tertiary ${fmt(ty.rebates.tertiary)}<br>
      Retirement cap: ${fmt(ty.retirement.cap)} \u00b7 CGT: ${(ty.cgt.inclusion*100).toFixed(0)}% \u00b7 Med/month: R${ty.medical.main}
    </div>
    <div class="u-overflow-x"><table class="data-table" style="margin-bottom:14px">
      <thead><tr><th scope="col">Taxable Income Band</th><th scope="col">Rate</th><th scope="col">Base Tax</th></tr></thead>
      <tbody>
        ${ty.brackets.map((b,i) => {
          const next = ty.brackets[i+1];
          const band = next ? fmt(b.min)+' \u2014 '+fmt(b.max) : 'Above '+fmt(b.min);
          return '<tr><td>'+band+'</td><td style="color:var(--au);font-weight:600">'+(b.rate*100).toFixed(0)+'%</td><td>'+fmt(b.base)+'</td></tr>';
        }).join('')}
      </tbody>
    </table></div>
    <div class="u-overflow-x"><table class="data-table">
      <thead><tr><th scope="col">Threshold</th><th scope="col">Amount</th></tr></thead>
      <tbody>
        <tr><td>Under 65</td><td>${fmt(ty.thresholds.under65)}</td></tr>
        <tr><td>Age 65\u201374</td><td>${fmt(ty.thresholds.age65)}</td></tr>
        <tr><td>Age 75+</td><td>${fmt(ty.thresholds.age75)}</td></tr>
      </tbody>
    </table></div>`;
}


