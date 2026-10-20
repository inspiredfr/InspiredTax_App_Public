import { MONTH_NAMES_SHORT } from './01-data.js';
import { noteHtml, cssColour, flagField, $, APP, calcAgeAtYearEnd, calcFullTax, calcMedicalCredits, calcTaxForYear, calcTaxableCapitalGain, debounceSave, esc, fmt, getActiveTaxYear, gs, gv, isMedicalSchemeMemberDom, maskAll, parseFmt, pct, showConfirm, showToast, sv, iconClassFor, barsHtml, donutHtml } from './02-core.js';
import { renderProvPenalty, renderProvRecommendation, renderProvTaxStatus } from './03-income.js';
import { refreshDerived, cardRow, cardTotal, paymentsCardSpec, taxCardsHtml } from './07-render-summary.js';

/* ============================================================
   InspiredTax v8.5 — CURRENT YEAR PLANNER
   Month-by-month tracker, lump sums, year-end projection
   ============================================================ */

export function monthYearLabel(idx) {
  const yr = parseInt(gs('taxYear') || '2027');
  return MONTH_NAMES_SHORT[idx] + ' ' + (idx <= 9 ? yr : yr + 1);
}

export function initMonthlyPlannerMonth() {
  const sel = $('lump-month'); if(!sel) return;
  const yr  = parseInt(gs('taxYear') || '2027');
  sel.innerHTML = MONTH_NAMES_SHORT.map((m, i) =>
    `<option value="${i}">${m} ${i <= 9 ? yr : yr + 1}</option>`
).join('');
}

export function elapsedMonths() {
  const now = new Date();
  const yr  = parseInt(gs('taxYear') || '2027');
  const start = new Date(yr, 2, 1);  // 1 March
  const end   = new Date(yr + 1, 2, 1);
  if(now < start) return 0;
  if(now >= end)  return 12;
  let m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if(now.getDate() >= 1) m += 1;
  return Math.min(12, Math.max(0, m));
}

export function renderMonthlyPlanner() {
  const el = $('monthly-planner-body'); if(!el) return;
  if(!APP.monthlyPlan || APP.monthlyPlan.length !== 12)
    APP.monthlyPlan = Array.from({length:12}, () => ({income:0, paye:0, retirement:0, otherDed:0, status:'estimated'}));

  // Build lump sum aggregates per month
  const lumpInc = Array(12).fill(0);
  const lumpDed = Array(12).fill(0);
  (APP.lumpSums || []).forEach(l => {
    if(l.type === 'bonus' || l.type === 'other_income') lumpInc[l.month] += l.amount;
    else lumpDed[l.month] += l.amount;
  });

  let cumGross = 0;
  let rows = '';
  for(let i = 0; i < 12; i++) {
    const m    = APP.monthlyPlan[i];
    const mInc = m.income + lumpInc[i];
    cumGross  += mInc;
    const hasLump = lumpInc[i] > 0 || lumpDed[i] > 0;
    const isActual = m.status === 'actual';
    rows += `<tr>
      <td class="planner-month-name">${monthYearLabel(i)}${hasLump ? ' <i class="material-symbols-outlined msi-bolt" style="color:var(--au);font-size:0.53125rem" title="Has lump sum"></i>' : ''}</td>
      <td>
        <button class="status-badge ${m.status}" onclick="toggleMonthStatus(${i})" title="Toggle Actual/Estimate">
          ${isActual ? 'Actual' : 'Estimate'}
        </button>
      </td>
      <td data-l="Gross income"><input type="text" inputmode="numeric" class="planner-input mask-rand" placeholder="0" value="${m.income || ''}" oninput="updateMonthField(${i},'income',this.value)"></td>
      <td data-l="PAYE"><input type="text" inputmode="numeric" class="planner-input mask-rand" placeholder="0" value="${m.paye || ''}" oninput="updateMonthField(${i},'paye',this.value)"></td>
      <td data-l="Retirement"><input type="text" inputmode="numeric" class="planner-input mask-rand" placeholder="0" value="${m.retirement || ''}" oninput="updateMonthField(${i},'retirement',this.value)"></td>
      <td data-l="Other ded"><input type="text" inputmode="numeric" class="planner-input mask-rand" placeholder="0" value="${m.otherDed || ''}" oninput="updateMonthField(${i},'otherDed',this.value)"></td>
      <td class="planner-cumulative" data-l="Cumulative">${fmt(cumGross)}</td>
    </tr>`;
  }

  // Totals row
  const totInc = APP.monthlyPlan.reduce((s,m) => s+m.income, 0) + lumpInc.reduce((a,b)=>a+b,0);
  const totPay = APP.monthlyPlan.reduce((s,m) => s+m.paye, 0);
  const totRet = APP.monthlyPlan.reduce((s,m) => s+m.retirement, 0);
  const totDed = APP.monthlyPlan.reduce((s,m) => s+m.otherDed, 0) + lumpDed.reduce((a,b)=>a+b,0);
  rows += `<tr class="planner-total-row">
    <td class="planner-month-name">TOTAL</td><td></td>
    <td class="planner-cumulative" data-l="Gross income">${fmt(totInc)}</td>
    <td class="planner-cumulative" data-l="PAYE">${fmt(totPay)}</td>
    <td class="planner-cumulative" data-l="Retirement">${fmt(totRet)}</td>
    <td class="planner-cumulative" data-l="Other ded">${fmt(totDed)}</td>
    <td class="planner-cumulative" data-l="Cumulative">${fmt(totInc)}</td>
  </tr>`;

  el.innerHTML = rows;
  if (typeof maskAll === 'function') maskAll(el);
}

export function updateMonthField(idx, field, val) {
  if(!APP.monthlyPlan) return;
  APP.monthlyPlan[idx][field] = parseFmt(val);
  updateCumulativeColumn();
  const p = calcCurrentYear();
  renderCyrStats(p);
  renderCyrPosition(p);
  renderCyrChart(p);
  debounceSave();
}

export function updateCumulativeColumn() {
  const rows = document.querySelectorAll('#monthly-planner-body tr');
  const lumpInc = Array(12).fill(0);
  (APP.lumpSums || []).forEach(l => {
    if(l.type === 'bonus' || l.type === 'other_income') lumpInc[l.month] += l.amount;
  });
  let cum = 0;
  for(let i = 0; i < 12; i++) {
    cum += (APP.monthlyPlan[i]?.income || 0) + lumpInc[i];
    const row = rows[i]; if(!row) continue;
    const cv = row.querySelector('.planner-cumulative');
    if(cv) cv.textContent = fmt(cum);
  }
}

export function toggleMonthStatus(idx) {
  if(!APP.monthlyPlan) return;
  APP.monthlyPlan[idx].status = APP.monthlyPlan[idx].status === 'actual' ? 'estimated' : 'actual';
  renderMonthlyPlanner();
}

/* BACKLOG 87 (PROV-1, owner 2026-10-17): the year as captured, spread over
   the months — salary evenly, the bonus in month 9, PAYE, retirement and the
   travel / home-office / tools deductions evenly. One source for
   prefillFromActual() (which writes it) and effectivePlan() (which only
   reads it), so the two cannot disagree (WR-8). */
function capturedPlan() {
  const gross = APP.incomeItems.reduce((s,i) => s+i.amount, 0);
  const bonus = APP.incomeItems.filter(i=>i.cat==='bonus').reduce((s,i)=>s+i.amount,0);
  const salOther = gross - bonus;
  /* T-6(b): read PAYE the same way calcFullTax() does (sum of employer
     entries, falling back to the legacy single field only if empty) — the
     multi-employer PAYE UI is the standard entry path, so reading only the
     legacy field here silently zeroed the prefill for any such user. */
  const paye = calcFullTax().payeDeducted;
  const ret  = gv('ded_pension') + gv('ded_provident') + gv('ded_ra');
  // H-5 fix: travel/homeoffice/tools live in APP.appliedValues
  const _avp = APP.appliedValues || {};
  const ded  = (_avp.travel || 0) + (_avp.homeoffice || 0) + (_avp.tools || 0);
  const r2 = v => Math.round(v / 12 * 100) / 100;
  const months = Array.from({length:12}, () => ({income: r2(salOther), paye: r2(paye), retirement: r2(ret), otherDed: r2(ded), status:'estimated'}));
  /* NB: on lumpSums, `description` is the human label; `desc` is a SENTINEL
     flag ('_auto_bonus') used to find/replace this auto-generated row — the
     two fields are intentionally distinct, do not merge/rename them. */
  const lumps = bonus > 0 ? [{id:Date.now(), month:9, type:'bonus', description:'Annual Bonus (from Actual)', amount:bonus, desc:'_auto_bonus'}] : [];
  return { months, lumps, any: salOther > 0 || bonus > 0 || paye > 0 || ret > 0 || ded > 0 };
}
/* PROV-1: while the user has entered nothing — every month blank and no lump
   sum — the projection runs on the captured year instead of on nothing,
   read-only (no state change on render, hard rule 3). The moment a month or
   a lump sum is entered, the plan is the user's. */
export function effectivePlan() {
  const empty = (APP.monthlyPlan || []).every(m => !(m && (m.income || m.paye || m.retirement || m.otherDed)))
    && !(APP.lumpSums || []).length;
  if (empty) {
    const c = capturedPlan();
    if (c.any) return { months: c.months, lumps: c.lumps, fromCaptured: true };
  }
  return { months: APP.monthlyPlan, lumps: APP.lumpSums || [], fromCaptured: false };
}

export function prefillFromActual() {
  const c = capturedPlan();
  APP.monthlyPlan = c.months;
  APP.lumpSums = (APP.lumpSums||[]).filter(l => l.desc !== '_auto_bonus').concat(c.lumps);
  updateCurrentYear(); showToast('Pre-filled from Actual data');
}

export function autoFillRemaining() {
  const actual = (APP.monthlyPlan||[]).filter(m => m.status==='actual' && m.income>0);
  if(!actual.length) { showToast('Mark at least one month as Actual first','warning'); return; }
  const ai = actual.reduce((s,m)=>s+m.income,0)/actual.length;
  const ap = actual.reduce((s,m)=>s+m.paye,0)/actual.length;
  const ar = actual.reduce((s,m)=>s+m.retirement,0)/actual.length;
  const ad = actual.reduce((s,m)=>s+m.otherDed,0)/actual.length;
  for(let i = 0; i < 12; i++) {
    if(APP.monthlyPlan[i].status !== 'actual') {
      APP.monthlyPlan[i] = {income:Math.round(ai*100)/100, paye:Math.round(ap*100)/100, retirement:Math.round(ar*100)/100, otherDed:Math.round(ad*100)/100, status:'estimated'};
    }
  }
  updateCurrentYear(); showToast('Remaining months auto-filled');
}

export function clearMonthlyPlan() {
  showConfirm('Clear Plan', 'Reset all monthly figures and lump sums?', () => {
    APP.monthlyPlan = Array.from({length:12}, () => ({income:0, paye:0, retirement:0, otherDed:0, status:'estimated'}));
    APP.lumpSums = [];
    updateCurrentYear(); showToast('Plan cleared');
  }, { tier: 'del', okLabel: 'Reset all months', cancelLabel: 'Keep my plan',
       consequence: 'Twelve months of captured income, PAYE and retirement figures are deleted. Your filed return is not affected.' });
}

export function addLumpSum() {
  const month  = parseInt(gs('lump-month') || '0');
  const type   = gs('lump-type');
  const desc   = gs('lump-desc');
  const amount = gv('lump-amount');
  if(amount <= 0) { flagField('lump-amount', 'Enter an amount.'); return; }  // on-blur validation, BACKLOG 36
  const labels = {ra_topup:'RA Top-Up', bonus:'Bonus / Income', donation:'Donation (s18A)', other_income:'Other Income', other_ded:'Other Deduction'};
  if(!APP.lumpSums) APP.lumpSums = [];
  APP.lumpSums.push({id: Date.now() + Math.random(), month, type, description: desc || labels[type], amount});
  sv('lump-amount',''); sv('lump-desc','');
  updateCurrentYear();
  refreshDerived(); showToast('Lump sum added');
}

export function removeLumpSum(id) {
  showConfirm('Remove Entry', 'Delete this lump sum?', () => {
    APP.lumpSums = (APP.lumpSums||[]).filter(l => l.id !== id);
    updateCurrentYear();
    refreshDerived();
  }, { tier: 'del', okLabel: 'Delete lump sum', cancelLabel: 'Keep it' });
}

export function renderLumpSumList() {
  const el = $('lump-sum-list'); if(!el) return;
  if(!APP.lumpSums || !APP.lumpSums.length) {
    el.innerHTML = '<div class="empty-state"><i class="material-symbols-outlined msi-payments"></i><p>A lump sum this year won\'t be reflected in your monthly PAYE plan until it\'s added.</p><button class="btn btn-primary btn-sm empty-cta" onclick="addLumpSum()">Add lump sum</button></div>'; return;
  }
  el.innerHTML = (APP.lumpSums||[]).map(l => {
    const isIncome = l.type === 'bonus' || l.type === 'other_income';
    return `<div class="lump-item">
      <span class="lump-type-badge ${isIncome?'income':'deduction'}">${isIncome?'Income':'Deduction'}</span>
      <span style="font-size:0.6875rem;color:var(--tx2);min-width:55px">${monthYearLabel(l.month)}</span>
      <span style="flex:1;font-size:0.71875rem">${esc(l.description||'')}</span>
      <span style="font-family:var(--mono);font-weight:600;font-size:0.71875rem">${fmt(l.amount)}</span>
      <button class="item-remove del" onclick="removeLumpSum(${l.id})" aria-label="Remove lump sum"><i class="material-symbols-outlined msi-delete"></i></button>
    </div>`;
  }).join('');
}

export function calcCurrentYear() {
  const ty  = getActiveTaxYear();
  const age = calcAgeAtYearEnd();
  if(!APP.monthlyPlan || APP.monthlyPlan.length !== 12)
    APP.monthlyPlan = Array.from({length:12}, () => ({income:0,paye:0,retirement:0,otherDed:0,status:'estimated'}));

  let totIncome=0, totPaye=0, totRet=0, totOtherDed=0, totRA=0, totDon=0;
  const plan = effectivePlan();   // BACKLOG 87: the captured year while the plan is empty
  plan.months.forEach(m => { totIncome+=m.income; totPaye+=m.paye; totRet+=m.retirement; totOtherDed+=m.otherDed; });
  plan.lumps.forEach(l => {
    if(l.type==='bonus'||l.type==='other_income') totIncome  += l.amount;
    else if(l.type==='ra_topup')                  totRA      += l.amount;
    else if(l.type==='donation')                  totDon     += l.amount;
    else                                          totOtherDed+= l.amount;
  });
  /* Carry over actual donations from the Deductions page (s18A items) into the projection */
  totDon += (APP.appliedValues && APP.appliedValues.donations) ? APP.appliedValues.donations : 0;

  /* T-6(a): auto-aggregate already-entered "other" income (rental, business,
     other receipts, crypto, taxable investment) into the projection, same
     pattern as the donations carry-over above — read from calcFullTax()'s
     return so there is one source of truth for these figures (Hard Rule 2),
     not a parallel computation. Foreign income and capital gains keep their
     existing manual forecast fields (cyr_fc_foreign/cyr_fc_cgt) below since
     those specifically forecast amounts not yet entered anywhere else in the
     app (this planner has no CGT/foreign sub-pages of its own). */
  const _fullTax = calcFullTax();
  const otherIncomeAuto = (_fullTax.rentalIncome || 0) + (_fullTax.businessIncome || 0) +
    (_fullTax.otherReceiptsIncome || 0) + (_fullTax.cryptoRevenue || 0) + (_fullTax.investmentIncome || 0);

  const gross    = totIncome + otherIncomeAuto;
  /* v8.8 D10: optional forecast extras — capital gain (after annual exclusion × inclusion),
     foreign income, and an approximate s6quat foreign tax credit. Default 0 → no change.
     They enter AFTER the donation cap (addTaxable) — original conservative ordering. */
  const fcCgtRaw   = gv('cyr_fc_cgt') || 0;
  const fcForeign  = Math.max(0, gv('cyr_fc_foreign') || 0);
  const fcFtcPaid  = gv('cyr_fc_ftc') || 0;
  const fcCgtTaxable = calcTaxableCapitalGain(fcCgtRaw, ty);
  const _medInput = { isMain: isMedicalSchemeMemberDom(), deps: gv('med_deps'), contrib: gv('med_monthly'),
                       employer: gv('med_employer'), oop: gv('med_oop'), disability: gv('med_disability')===1 };
  /* engine-remediation W9: same single overall s6quat(1B) limitation formula
     as calcFullTax (limit = foreign TI / taxable income × tax on income,
     guarded by remaining tax after rebates & medical) — this projector has
     no it3b/rental/business/CGT sub-pages of its own, so fcForeign (the one
     manual "expected foreign income" forecast input) IS the foreign TI here.
     Two calcTaxForYear passes: the first to get toi/taxable/rebates/medical
     before the credit exists, the second passing the credit via `credits`
     (calcTaxForYear's existing input) so there is one formula, not a
     re-implementation. */
  const r0 = calcTaxForYear({
    gross, retContrib: totRet + totRA, otherDed: totOtherDed, donations: totDon,
    addTaxable: fcCgtTaxable + fcForeign, age, medical: _medInput
  }, ty);
  const ftcLimit = r0.taxable > 0 ? (fcForeign / r0.taxable) * r0.toi : 0;
  const fcFtCredit = Math.min(fcFtcPaid, ftcLimit, Math.max(0, r0.toi - r0.rebates - r0.med.total));
  const r = calcTaxForYear({
    gross, retContrib: totRet + totRA, otherDed: totOtherDed, donations: totDon,
    addTaxable: fcCgtTaxable + fcForeign, age, medical: _medInput,
    credits: fcFtCredit
  }, ty);
  const taxPayable = r.taxPayable;
  const balance  = taxPayable - totPaye;
  const eff      = gross > 0 ? taxPayable / gross : 0;
  const elapsed  = elapsedMonths();
  const actualCount   = plan.months.filter(m => m.status==='actual').length;
  const estimateCount = 12 - actualCount;

  return {gross, planIncome: totIncome, totPaye, retMax: r.retAllowed, retExcess: r.retExcess, totOtherDed, donAllowed: r.donAllowed,
          taxable: r.taxable, toi: r.toi, reb: r.rebates, med: r.med, taxPayable, balance, eff,
          elapsed, actualCount, estimateCount, fcCgtTaxable, fcForeign, fcFtCredit, otherIncomeAuto, fromCaptured: plan.fromCaptured};
}

export function renderCyrStats(p) {
  const el = $('cyr-stats'); if(!el) return;
  const isR = p.balance < 0, isO = p.balance > 0;
  /* UI-CARD-1 (BACKLOG 28): the Tax-screen card, option B. Every figure is
     this projection's own calcTaxForYear() output (calcCurrentYear above) or
     a plain sum of the plan's own months; nothing is re-derived here. */
  const credits = (p.reb || 0) + ((p.med && p.med.total) || 0) + (p.fcFtCredit || 0);
  const chainCasts = Math.abs((p.toi || 0) - credits - (p.taxPayable || 0)) < 1;
  const payeActual = (APP.monthlyPlan || []).reduce(function(s, m){ return s + (m.status === 'actual' ? (m.paye || 0) : 0); }, 0);
  const specs = [
    { lbl: 'Projected gross', key: 'cyr-gross', c: 'var(--emerald)', val: fmt(p.gross), raw: p.gross,
      body: p.gross > 0 ? cardRow('Planned income (months and lump sums)', p.planIncome, 1, 'var(--emerald)') + cardRow('Other income already captured', p.otherIncomeAuto, 1, 'var(--cyan)') + cardTotal('Projected gross', fmt(p.gross), p.gross) : '',
      chart: donutHtml([{ label: 'Planned income', val: p.planIncome || 0, color: 'var(--emerald)' }, { label: 'Other income already captured', val: p.otherIncomeAuto || 0, color: 'var(--cyan)' }], { size: 64 }) },
    { lbl: 'Est. tax liability', key: 'cyr-tax', c: 'var(--navy)', val: fmt(p.taxPayable), raw: p.taxPayable,
      ring: donutHtml([{ val: p.taxPayable, color: 'var(--navy)' }], { compact: true, whole: p.toi }),
      body: p.taxPayable > 0 ? cardRow('Tax on taxable income', p.toi, 1) + cardRow('Less rebates', p.reb, -1) + cardRow('Less medical tax credits', p.med && p.med.total, -1)
        + cardRow('Less foreign tax credit', p.fcFtCredit, -1) + cardTotal('Est. tax liability', fmt(p.taxPayable), chainCasts ? p.taxPayable : null) : '',
      chart: donutHtml([{ label: 'Tax payable', val: p.taxPayable || 0, color: 'var(--navy)' }, { label: 'Rebates and credits used', val: Math.max(0, (p.toi || 0) - (p.taxPayable || 0)), color: 'var(--neutral)' }], { size: 64 }) },
    { lbl: 'Total PAYE', key: 'cyr-paye', c: 'var(--blue)', val: fmt(p.totPaye), raw: p.totPaye,
      body: p.totPaye > 0 ? cardRow('Months entered as actual', payeActual, 1) + cardRow('Months still estimated', p.totPaye - payeActual, 1) + cardTotal('Total PAYE', fmt(p.totPaye), p.totPaye) : '',
      chart: barsHtml([{ label: 'Actual', val: payeActual, color: 'var(--blue)' }, { label: 'Estimated', val: p.totPaye - payeActual, color: 'color-mix(in srgb, var(--blue) 50%, var(--sf3))' }], { max: p.totPaye, label: 'PAYE by month type' }) },
    paymentsCardSpec({ lbl: isR ? 'Proj. Refund' : isO ? 'Proj. Owing' : 'Balanced', key: 'cyr-balance', figure: Math.abs(p.balance), paye: p.totPaye, tax: p.taxPayable, taxLabel: 'Est. tax liability', balance: p.balance })
  ];
  if (!(p.taxPayable > 0 || p.totPaye > 0)) specs[3].body = '';
  /* BACKLOG 87 (PROV-1): say where the figures come from while the plan is
     empty — above the card grid, which holds cards only. */
  const cap = $('cyr-captured-note');
  if (cap) cap.innerHTML = p.fromCaptured ? noteHtml('info', 'Based on the income you captured.',
      '<strong>Where these figures come from</strong>You have not planned any months yet, so this uses the salary, PAYE, retirement contributions and deductions you captured, spread evenly over the year, with a bonus in December. Enter a month or a lump sum below and the plan becomes yours.',
      { title: 'Based on what you captured' }) : '';
  el.innerHTML = taxCardsHtml(specs, 'tax-provisional');
}

export function renderCyrPosition(p) {
  const el = $('cyr-position'); if(!el) return;
  const isR = p.balance < 0, isO = p.balance > 0;
  const progPct = Math.round(p.elapsed / 12 * 100);
  el.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--tx2);margin-bottom:3px">
        <span>Tax Year Progress</span>
        <span style="color:var(--au);font-weight:600">${p.elapsed}/12 months (${progPct}%)</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${progPct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:0.65625rem;color:var(--tx3);margin-top:3px">
        <span>${p.actualCount} Actual, ${p.estimateCount} Estimated</span>
      </div>
    </div>
    <div class="sum-line"><span class="lbl">Projected Gross Income</span><span class="val">${fmt(p.gross)}</span></div>
    ${p.otherIncomeAuto > 0 ? `<div class="sum-line"><span class="lbl" style="color:var(--tx3)">— incl. other income (rental/business/other/crypto/investment)</span><span class="val" style="color:var(--tx3)">${fmt(p.otherIncomeAuto)}</span></div>` : ''}
    <div class="sum-line"><span class="lbl">Less: Retirement (capped)</span><span class="val">− ${fmt(p.retMax)}</span></div>
    ${p.retExcess > 0 ? `<div class="sum-line"><span class="lbl u-c-warning">⚠ Excess retirement c/f</span><span class="val u-c-warning">${fmt(p.retExcess)}</span></div>` : ''}
    <div class="sum-line"><span class="lbl">Less: Other Deductions</span><span class="val">− ${fmt(p.totOtherDed)}</span></div>
    <div class="sum-line"><span class="lbl">Less: Donations</span><span class="val">− ${fmt(p.donAllowed)}</span></div>
    ${p.fcCgtTaxable > 0 ? `<div class="sum-line"><span class="lbl">Add: Taxable capital gain (forecast)</span><span class="val">+ ${fmt(p.fcCgtTaxable)}</span></div>` : ''}
    ${p.fcForeign > 0 ? `<div class="sum-line"><span class="lbl">Add: Foreign income (forecast)</span><span class="val">+ ${fmt(p.fcForeign)}</span></div>` : ''}
    <div class="sum-line divider total"><span class="lbl">Projected Taxable Income</span><span class="val">${fmt(p.taxable)}</span></div>
    <div class="sum-line"><span class="lbl">Tax on Income</span><span class="val">${fmt(p.toi)}</span></div>
    <div class="sum-line"><span class="lbl">Less: Rebates + Medical Credits</span><span class="val">− ${fmt(p.reb + p.med.total)}</span></div>
    ${p.fcFtCredit > 0 ? `<div class="sum-line"><span class="lbl">Less: Foreign tax credit (s6quat, approx.)</span><span class="val">− ${fmt(p.fcFtCredit)}</span></div>` : ''}
    <div class="sum-line divider total"><span class="lbl">Projected Tax Payable</span><span class="val">${fmt(p.taxPayable)}</span></div>
    <div class="sum-line"><span class="lbl">Less: Total PAYE Deducted</span><span class="val">− ${fmt(p.totPaye)}</span></div>
    <div class="sum-line divider total ${isR?'refund':isO?'owing':''}">
      <span class="lbl">${isR?'PROJECTED REFUND':isO?'PROJECTED OWING':'BALANCED'}</span>
      <span class="val">${isR?'('+fmt(Math.abs(p.balance))+')':fmt(p.balance)}</span>
    </div>
    <div class="u-text-center-mt-12">
      <div class="result-badge ${isR?'refund':isO?'owing':'balanced'}">
        <i class="${iconClassFor(isR?'arrow_downward':isO?'arrow_upward':'balance')}"></i>
        ${isR?'Projected Refund: '+fmt(Math.abs(p.balance)):isO?'Projected Owing: '+fmt(p.balance):'On Track'}
      </div>
    </div>
    <p style="text-align:center;font-size:0.71875rem;color:var(--tx3);margin-top:8px">
      Effective Rate: <strong>${pct(p.eff)}</strong> &nbsp;·&nbsp; Monthly PAYE target: <strong>${fmt(p.taxPayable/12)}</strong>
    </p>`;
}

export function renderCyrChart(p) {
  const ctx = $('cyr-chart'); if(!ctx) return;
  if(APP.charts.cyr) APP.charts.cyr.destroy();
  /* Tie "Est. Tax Due" to the REAL projected position (calcCurrentYear) instead of
     a crude flat 75%-of-gross assumption, which ignored retirement, donations,
     other deductions, rebates and medical credits and so was visibly wrong.
     The cumulative tax-due line accrues that annual tax pro-rata with the gross
     earned to date, so it lands exactly on the projected Tax Payable at year end. */
  if(!p) p = calcCurrentYear();
  const effRate = p.gross > 0 ? p.taxPayable / p.gross : 0;

  const plan = effectivePlan();   // BACKLOG 87
  const lumpInc = Array(12).fill(0);
  plan.lumps.forEach(l => { if(l.type==='bonus'||l.type==='other_income') lumpInc[l.month]+=l.amount; });
  /* T-6(a): otherIncomeAuto (rental/business/other/crypto/investment) has no
     month of its own, so spread it evenly across the 12 months so the curve
     still lands exactly on p.gross at year end, preserving the invariant above. */
  const otherMonthly = (p.otherIncomeAuto || 0) / 12;

  const yr = parseInt(gs('taxYear') || '2027');
  let cumGross=0, cumPaye=0;
  const cGross=[], cPaye=[], cTaxDue=[];

  for(let i=0; i<12; i++) {
    cumGross += (plan.months[i]?.income||0) + lumpInc[i] + otherMonthly;
    cumPaye  += (plan.months[i]?.paye||0);
    cGross.push(cumGross); cPaye.push(cumPaye);
    cTaxDue.push(Math.round(cumGross * effRate));
  }

  const labels = MONTH_NAMES_SHORT.map((m,i) => m+' '+(i<=9?yr:yr+1));
  const cc = {grid:'rgba(255,255,255,0.05)', text:cssColour('--dim','#7aaad4')};
  APP.charts.cyr = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {label:'Cumulative Gross',   data:cGross,   borderColor:cssColour('--cyan','#00aaf0'), backgroundColor:'rgba(0,170,240,0.07)', fill:true, tension:.3, pointRadius:3, borderWidth:2},
        {label:'Cumulative PAYE',    data:cPaye,    borderColor:cssColour('--blue','#b4dc00'), backgroundColor:'rgba(180,220,0,0.07)',  fill:true, tension:.3, pointRadius:3, borderWidth:2}, /* STD-COL-3: PAYE's own category colour, unlike the other b4dc00 occurrences (no existing token match) */
        {label:'Est. Tax Due',       data:cTaxDue,  borderColor:'var(--er)', fill:false,        tension:.3, pointRadius:3, borderWidth:2, borderDash:[6,3]},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'",size:10}, maxRotation:45}},
        y: {grid:{color:cc.grid}, ticks:{color:cc.text, font:{family:"'Inter'",size:11}, callback:v=>'R'+(v/1000).toFixed(0)+'k'}}
      },
      plugins: {
        legend: {labels:{color:cc.text, font:{family:"'Inter'",size:11}}},
        tooltip: {callbacks:{label:c=>c.dataset.label+': '+fmt(c.raw)}}
      }
    }
  });
}

export function updateCurrentYear() {
  const ty = getActiveTaxYear();
  const badge = $('cyr-year-badge'); if(badge) badge.textContent = ty.label;
  initMonthlyPlannerMonth();
  renderMonthlyPlanner();
  renderLumpSumList();
  const p = calcCurrentYear();
  /* v8.8 D4: expose the PLANNER forecast for the provisional engine (full-year tax +
     first-half PAYE split for P1). This is the single source of the provisional forecast. */
  var _payeToAug = effectivePlan().months.slice(0, 6).reduce(function (s, m) { return s + (Number(m && m.paye) || 0); }, 0);
  APP.provForecast = { annualTI: p.taxable, annualTax: p.taxPayable, payeFull: p.totPaye, payeToAug: _payeToAug, rebates: p.reb, medTotal: p.med.total };
  if (typeof renderProvRecommendation === 'function') renderProvRecommendation();
  if (typeof renderProvPenalty === 'function') renderProvPenalty();
  if (typeof renderProvTaxStatus === 'function') renderProvTaxStatus();
  renderCyrStats(p);
  renderCyrPosition(p);
  renderCyrChart(p);
  debounceSave();
}


