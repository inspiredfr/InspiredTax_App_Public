import { $, APP, esc, fmt, noteBody, gv, gs, heroBreakdownLink, renderBucketNav, showForeignRow, showFxWidgetFor, iconClassFor } from './02-core.js';
import { RENTAL_EXPENSES_INTRO, RENTAL_LEASE_TYPES } from './01-data.js';
import { makeCrudModule, rentalCategoriesForType, rentalAddExpenseRow, rentalCollectExpenses, rentalUpdateExpenseRowOptions, rentalSeedCosts, rentalRenderCostChips, tradeLossNote } from './05-list-modules.js';

/* ═══════════════════════════════════════════════════════════
   B3 RENTAL INCOME — multi-rental net calculator
   Dynamic expense rows (category + amount + note).
   Airbnb (s23(b)): fixed costs × area %; direct costs (agent, advertising,
   Airbnb-specific repairs, exclusively-Airbnb W&T) are 100% deductible.
   Losses: set off against other income; a notice says when SARS may
   ring-fence instead (s20A — tradeLossNote, notice only, OI-D1b).
   ═══════════════════════════════════════════════════════════ */

export const M_rental = makeCrudModule({
  array: 'rentalProperties', entKey: 'income.rental', applyType: 'rental', modalId: 'modal-rental-property', titleId: 'rental-modal-title',
  titles: { add: 'Add rental', edit: 'Edit rental' },
  fields: [
    { el:'rental-name',           key:'name',          kind:'str' },
    { el:'rental-type',           key:'type',          kind:'raw', def:'property' },
    { el:'rental-ownership',      key:'ownership',     kind:'raw', def:'owned' },
    { el:'rental-source-country', key:'sourceCountry', kind:'str' },
    { el:'rental-foreign-tax',    key:'foreignTax',    kind:'num' },
    { el:'rental-income',         key:'income',        kind:'num' },
  ],
  onClear: () => {
    const container = $('rental-expense-rows');
    if(container) container.innerHTML = '';
    rentalSeedCosts();   // UI-CAP-1 (rule 6): the usual lines for the kind; re-seeded when a kind is picked
    const ratio = $('rental-ratio'); if(ratio) ratio.value = '100';
    const share = $('rental-ownership-share'); if(share) share.value = '100';
  },
  onLoad: (p) => {
    const container = $('rental-expense-rows');
    if(container) container.innerHTML = '';
    if(p.expenses && p.expenses.length) p.expenses.forEach(exp => rentalAddExpenseRow(exp));
    else rentalSeedCosts();
    const ratio = $('rental-ratio'); if(ratio) ratio.value = (p.ratio != null ? p.ratio : '100');
    const share = $('rental-ownership-share'); if(share) share.value = (p.ownershipShare != null ? p.ownershipShare : '100');
  },
  onForm: () => { rentalToggleType(); rentalUpdateLiveCalc(); },
  onKind: () => { rentalSeedCosts(); rentalUpdateLiveCalc(); },   // UI-CAP-1 (rule 6): the usual cost lines for the kind
  validate: () => (gs('rental-name')||'').trim() ? null : { el:'rental-name', msg:'This is required.' },
  collect: () => {
    const name = (gs('rental-name')||'').trim();
    const type = gs('rental-type') || 'property';
    const income = gv('rental-income') || 0;
    const expenses = rentalCollectExpenses();
    const ownershipShare = Math.min(100, Math.max(0, gv('rental-ownership-share') != null ? gv('rental-ownership-share') : 100));
    return {
      name, type,
      ownership:     gs('rental-ownership') || 'owned',
      foreign:       type === 'foreign' ? 'yes' : 'no',
      sourceCountry: (gs('rental-source-country')||'').trim(),
      /* Batch I (#76): only meaningful on a foreign lease — zeroed otherwise
         so switching a property away from Foreign can't leave a stale credit
         feeding the s6quat pool. */
      foreignTax:    type === 'foreign' ? (gv('rental-foreign-tax') || 0) : 0,
      income,
      ratio:         Math.min(100, Math.max(0, gv('rental-ratio') != null ? gv('rental-ratio') : 100)),
      /* C-2a: beneficial ownership share. Income/expenses above are the FULL
         property's figures as entered; this taxpayer's own share is applied
         once, downstream, in calcRentalNet() (Hard Rule 2 — one calc path). */
      ownershipShare,
      expenses
    };
  },
  refresh: () => renderRentalResult(),
  confirm: { title: 'Remove Rental', msg: 'Delete this rental and all its data?' }
});
export function addRentalProperty()     { M_rental.add(); }
export function editRentalProperty(i)   { M_rental.edit(i); }
export function saveRentalProperty()    { M_rental.save(); }
export function removeRentalProperty(i) { M_rental.remove(i); }

export function rentalToggleOwnership() {
  const type = gs('rental-type') || 'property';
  const ownership = gs('rental-ownership') || 'owned';
  rentalUpdateExpenseRowOptions(type, ownership);
  rentalUpdateLiveCalc();
}

/* Type-aware form: controls ratio row, country row, and contextual notices.
   Airbnb: area-ratio; fixed costs apportioned, direct costs 100% (s23(b)).
   Equipment: no ratio; s11(e) W&T + repairs/insurance/finance charges.
   Foreign: auto-sets foreign flag; shows source country field.
   Property: standard full-deduction rental. */
export function rentalToggleType() {
  const type = gs('rental-type') || 'property';
  const ownership = gs('rental-ownership') || 'owned';
  const isAirbnb = type === 'airbnb';
  const isForeign = type === 'foreign';

  const show = (id, on) => { const e = $(id); if(e) e.style.display = on ? '' : 'none'; };
  show('rental-ratio-row', isAirbnb);
  /* B7.7 (IEM-1): hide-and-clear together — see showForeignRow(), 02-core.js. */
  showForeignRow('rental-country-row', isForeign);
  showForeignRow('rental-foreign-tax-row', isForeign);   /* Batch I (#76) */
  showFxWidgetFor('rental-income', isForeign);

  /* rebuild expense row options to match the selected type + ownership */
  rentalUpdateExpenseRowOptions(type, ownership);

  /* QR4.2 (QX-CPY-1): the per-type guidance note that used to be written
     here now lives in OPTION_NOTES['rental-type'] (01-data.js) and is shown
     by the Type select's own optionNotes. RENT-6 (§L.8): its "Enter the
     source country." sentence stays gone — rental-country-row asks for it. */
  const intro = $('rental-exp-intro');
  /* RENT-12: only the types with something to say have a line; the element is
     hidden otherwise so it leaves no gap. */
  if(intro) {
    const n = RENTAL_EXPENSES_INTRO[type];
    intro.innerHTML = n ? noteBody(n.short, n.detail, n.title) : '';   // UI-NOTE-1: one line + More
    intro.classList.add('note-line');
    intro.hidden = !n;
  }

  rentalUpdateOverlapWarning();
}

/* Batch I (#72): this notice used to render for every property type on every
   visit, whether or not the property actually claimed anything that could
   double up. All three of its messages are about the same single overlap —
   wear and tear claimed here versus the same asset claimed under the Tools &
   Equipment deduction — so it now fires only when a row in THIS property
   actually selects the `wear_tear` category AND a Tools & Equipment deduction
   is actually being claimed, matching bizUpdateOverlapWarning()'s rule.
   Display-only; no amount here enters any calculation. */
export function rentalUpdateOverlapWarning() {
  const notice = $('rental-type-notice');
  if(!notice) return;
  const hasWearTearRow = Array.prototype.some.call(
    document.querySelectorAll('#rental-expense-rows .rental-exp-cat'),
    sel => sel.value === 'wear_tear'
  );
  const toolsClaimed = ((APP.appliedValues || {}).tools || 0) > 0;
  if(!hasWearTearRow || !toolsClaimed) { notice.innerHTML = ''; return; }

  const type = gs('rental-type') || 'property';
  let msg;
  if(RENTAL_LEASE_TYPES.includes(type)) {
    msg = 'Do not include W&amp;T claimed under <strong>Tools &amp; Equipment</strong> in Deductions for the same asset here.';
  } else if(type === 'airbnb') {
    msg = 'W&amp;T on appliances used exclusively in the Airbnb is claimed here (100% deductible). Do NOT also claim the same assets under <strong>Tools &amp; Equipment</strong> in Deductions.';
  } else {
    msg = 'You are claiming wear and tear on this property. Do not claim the same assets again under <strong>Tools &amp; Equipment</strong> in Deductions.';
  }
  notice.innerHTML = `<details class="info-acc" style="margin-top:10px" open><summary style="font-size:0.71875rem">⚠ Avoid double-counting <span class="chev">▾</span></summary><div class="body" style="font-size:0.71875rem">${msg}</div></details>`;
}

/* RENT-13/RENT-14 (§L.8): contextual info per expense row, keyed off its own
   category — replaces the two general accordion notes that used to sit at
   the bottom of the whole modal ("ⓘ Bond interest vs bond instalment",
   "ⓘ Repairs vs improvements — what belongs where"), disconnected from the
   row a user was actually filling in. Same copy, relocated rather than
   duplicated: both entries are removed from CFG_RENTAL's `notes` array
   (00-forms.js) now that this is where they live. 'rent_paid' (the
   leased-property equivalent of 'bond') gets no note — RENT-13 names Bond
   Interest specifically, and there is no interest/capital split to explain
   on a rent payment. */
/* UI-NOTE-1: each entry is one short line + More (the full text). */
const RENTAL_ROW_INFO = {
  bond: { short: 'Enter only the interest part of your bond payments.', title: 'Bond interest', detail: 'Only the <strong>interest</strong> portion of a bond repayment is deductible (s11(a)/s24J) — the capital repayment portion is not an expense at all, it reduces what you owe. Your bank statement or bond amortisation schedule shows interest and capital separately; enter only the interest component here.' },
  repairs: { short: 'Repairs count here; improvements do not.', title: 'Repairs or improvements', detail: 'A <strong>repair</strong> restores something to its original condition (fixing a leaking roof, repainting, replacing broken tiles) and is deductible here. An <strong>improvement</strong> makes something better or different than it was and is <strong>not</strong> deductible against rental income — use the Improvements category below instead; it adds to your base cost for Capital Gains Tax when you sell.' },
  repairs_direct: { short: 'Repairs count here; improvements do not.', title: 'Repairs or improvements', detail: 'A <strong>repair</strong> restores something to its original condition and is deductible here. An <strong>improvement</strong> makes something better or different than it was and is <strong>not</strong> deductible against rental income — use the Improvements category instead; it adds to your base cost for Capital Gains Tax when you sell.' },
  improvements: { short: 'Not deducted now — it adds to your base cost when you sell.', title: 'Improvements', detail: 'An improvement (a new kitchen, adding a room, replacing a geyser with a better one) is capital expenditure, not deductible against rental income — it increases your base cost for Capital Gains Tax when you eventually sell the property, so it is recorded here, not lost, just not deducted now.' },
};
export function rentalUpdateExpenseRowInfo() {
  document.querySelectorAll('#rental-expense-rows > div').forEach(function(row) {
    const catId = row.querySelector('.rental-exp-cat')?.value;
    const info = row.querySelector('.rental-exp-info');
    if (!info) return;
    const n = RENTAL_ROW_INFO[catId];
    info.innerHTML = n ? '<i class="material-symbols-outlined msi-info" aria-hidden="true"></i>' + noteBody(n.short, n.detail, n.title) : '';
    info.classList.toggle('note-line', !!n);
    info.classList.toggle('u-hidden', !n);
  });
}

export function rentalUpdateLiveCalc() {
  const type = gs('rental-type') || 'property';
  const ownership = gs('rental-ownership') || 'owned';
  const isAirbnb = type === 'airbnb';
  const income = gv('rental-income') || 0;

  /* Batch I (#72): the overlap notice depends on which categories the rows
     have selected, so it has to re-evaluate here too — a category change
     fires this, not rentalToggleType(). */
  rentalUpdateOverlapWarning();
  rentalUpdateExpenseRowInfo();

  /* clamp ratio to 0–100 */
  const ratioEl = $('rental-ratio');
  if(ratioEl && isAirbnb) {
    const v = parseFloat(ratioEl.value) || 0;
    if(v > 100) ratioEl.value = '100';
    if(v < 0)   ratioEl.value = '0';
  }
  const ratio = isAirbnb
    ? Math.min(100, Math.max(0, gv('rental-ratio') != null ? gv('rental-ratio') : 100)) / 100
    : 1;
  const share = Math.min(100, Math.max(0, gv('rental-ownership-share') != null ? gv('rental-ownership-share') : 100)) / 100;

  const cats = rentalCategoriesForType(type, ownership);
  let fixedExp = 0, directExp = 0;
  document.querySelectorAll('#rental-expense-rows > div').forEach(r => {
    const catId = r.querySelector('.rental-exp-cat')?.value;
    if(catId === 'improvements') return; /* capital, not a s11(a)/s23(b) deduction */
    const amt = parseFloat(r.querySelector('.rental-exp-amt')?.value?.replace(/[^\d.]/g, '')) || 0;
    const cat = cats.find(c => c.id === catId);
    if(isAirbnb && cat && cat.direct) { directExp += amt; }
    else { fixedExp += amt; }
  });
  const prorated = isAirbnb ? fixedExp * ratio : fixedExp;
  const totalExpenses = prorated + directExp;
  const net = income - totalExpenses;
  const netShare = net * share;

  rentalRenderCostChips();   // UI-CAP-1: the "Add a cost" chips follow the lines (05)

  /* C-2a: ring-fencing (and the displayed net) look at THIS taxpayer's own
     share of the loss — it is their own income the loss would otherwise
     offset. */
  const isLoss = netShare < 0;

  const liveEl = $('rental-live-calc');
  if(!liveEl) return;
  if(income === 0 && totalExpenses === 0) { liveEl.innerHTML = ''; return; }

  liveEl.innerHTML = `
    <div style="background:var(--sf3);border-radius:6px;padding:10px 12px;margin-top:12px;font-size:0.75rem">
      <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Gross income</span><span>${fmt(income)}</span></div>
      ${isAirbnb && fixedExp > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Fixed costs (× ${(ratio*100).toFixed(0)}% area)</span><span>− ${fmt(prorated)}</span></div>` : ''}
      ${isAirbnb && directExp > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Direct costs (100%)</span><span>− ${fmt(directExp)}</span></div>` : ''}
      ${!isAirbnb ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Total expenses</span><span>− ${fmt(totalExpenses)}</span></div>` : ''}
      ${share < 1 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--tx2)"><span>Your share (${(share*100).toFixed(0)}%)</span><span>${fmt(Math.abs(netShare))}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;border-top:1px solid var(--bd);font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">
        <span>Net ${isLoss?'Loss':'Income'}${share < 1 ? ' (your share)' : ''}</span><span>${fmt(Math.abs(netShare))}</span>
      </div>
      ${isLoss ? '<div class="note warning" style="margin-top:8px;font-size:0.71875rem;padding:6px 10px"><i class="material-symbols-outlined msi-warning u-mr-5"></i>' + '<strong>Loss noted.</strong> It is included in your total and set against your other income.' + '</div>' : ''}
    </div>`;
}

/* C-2a: beneficial-ownership share (0–1) — a co-owned property's income and
   gain accrue only to the extent of this taxpayer's own share (general
   accrual principle, s1 "gross income"; the amount is never received by or
   accrued to a co-owner beyond their share). Defaults to 1 (sole owner). */
export function rentalShare(p) {
  return Math.min(100, Math.max(0, p.ownershipShare != null ? p.ownershipShare : 100)) / 100;
}

export function calcRentalNet(p) {
  const type = p.type || 'property';
  const isAirbnb = type === 'airbnb';
  const ratio = isAirbnb ? ((p.ratio != null ? p.ratio : 100) / 100) : 1;
  const share = rentalShare(p);

  let fixedExp = 0, directExp = 0, wearTearAmt = 0;

  if(p.expenses && p.expenses.length) {
    const cats = rentalCategoriesForType(type, p.ownership || 'owned');
    p.expenses.forEach(exp => {
      if(exp.category === 'improvements') return; /* capital, not a s11(a)/s23(b) deduction — recorded on the row but not summed */
      const cat = cats.find(c => c.id === exp.category);
      const amt = exp.amount || 0;
      if(exp.category === 'wear_tear') wearTearAmt += amt;
      if(isAirbnb && cat && cat.direct) { directExp += amt; }
      else { fixedExp += amt; }
    });
  }

  const prorated = isAirbnb ? fixedExp * ratio : fixedExp;
  const totalExpenses = prorated + directExp;
  return { net: (p.income - totalExpenses) * share, totalExpenses: totalExpenses * share, income: p.income * share, ratio, wearTearAmt: wearTearAmt * share };
}

export function renderRentalResult() {
  const listEl  = $('rental-property-list');
  const aggEl   = $('rental-aggregate');
  const glanceEl = $('glance-b3rental');

  if(listEl) {
    if(!APP.rentalProperties.length) {
      /* QA 2026-09: persistent "+ Add rental" button at the top of this page
         is the only add-CTA now — this duplicated it. */
      listEl.innerHTML = '';
    } else {
      const typeColors  = { property:'teal', airbnb:'ok', equipment:'', foreign:'blue', other:'' };
      const typeLabels  = { property:'Property', airbnb:'Airbnb', equipment:'Equipment lease', foreign:'Foreign lease', other:'Other' };
      const ownerIcons  = { owned:'home', leased:'key' };
      listEl.innerHTML = APP.rentalProperties.map((p, i) => {
        const { net, totalExpenses, income } = calcRentalNet(p);
        const isLoss = net < 0;
        const lossNote = tradeLossNote('Rental', net);
        return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <i class="${iconClassFor(ownerIcons[p.ownership]||'home')}" style="color:var(--tx3);font-size:0.75rem"></i>
                <strong style="font-size:0.875rem">${esc(p.name)}</strong>
                <span class="pill ${typeColors[p.type]||''}" style="font-size:0.625rem">${esc(typeLabels[p.type]||p.type)}</span>
                ${p.foreign === 'yes' ? '<span class="pill" style="font-size:0.625rem;background:rgba(31,95,175,0.18);color:var(--tel)">Foreign' + (p.sourceCountry?' · '+esc(p.sourceCountry):'') + '</span>' : ''}
                ${rentalShare(p) < 1 ? `<span class="pill" style="font-size:0.625rem">${(rentalShare(p)*100).toFixed(0)}% share</span>` : ''}
              </div>
              <div style="display:flex;gap:14px;margin-top:7px;font-size:0.75rem;color:var(--tx2);flex-wrap:wrap">
                <span><i class="material-symbols-outlined msi-arrow-upward" style="color:var(--ok);font-size:0.625rem"></i> ${fmt(income)}</span>
                <span><i class="material-symbols-outlined msi-arrow-downward" style="color:var(--er);font-size:0.625rem"></i> ${fmt(totalExpenses)}</span>
                <span style="font-weight:700;color:${isLoss?'var(--er)':'var(--ok)'}">Net: ${isLoss?'('+fmt(Math.abs(net))+') Loss':fmt(net)}</span>
              </div>
              ${lossNote}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-xs" onclick="editRentalProperty(${i})" aria-label="Edit rental"><i class="material-symbols-outlined msi-edit"></i></button>
              <button class="btn btn-danger btn-xs" onclick="removeRentalProperty(${i})" aria-label="Remove rental"><i class="material-symbols-outlined msi-delete"></i></button>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  if(!aggEl) return;
  if(!APP.rentalProperties.length) {
    aggEl.innerHTML = '';
    if(glanceEl) glanceEl.innerHTML = '';
    { const heroElR = $('hero-b3rental'); if(heroElR) heroElR.innerHTML = '<div class="dhero bl u-empty u-cursor-pointer" onclick="navigateTo(\'income\',\'main\')"><div class="dhero-top"><div class="dhero-lbl">Total rental income</div></div><div class="dhero-num" data-count="' + (0) + '" data-count-key="income-b3rental">' + fmt(0) + '</div><div class="dhero-break"><i class="material-symbols-outlined msi-info" style="color:var(--tx3)"></i> No rental properties yet — add your first below to track income, expenses and net position.</div></div>'; }
    APP.pendingValues.rental = 0;
    return;
  }

  let totalIncome = 0, totalExpenses = 0, totalWearTear = 0;
  /* s20(1)(b): every property's net flows (OI-D1b — no ring-fencing; a
     `ringfenced` key saved before QA 2026-08 is ignored). */
  let flowingNet = 0;
  const byType = { property:{income:0,net:0}, airbnb:{income:0,net:0}, equipment:{income:0,net:0}, foreign:{income:0,net:0}, other:{income:0,net:0} };

  APP.rentalProperties.forEach(p => {
    const r = calcRentalNet(p);
    totalIncome += r.income;
    totalExpenses += r.totalExpenses;
    totalWearTear += r.wearTearAmt || 0;
    const bucket = byType[p.type] || byType.other;
    bucket.income += r.income;
    bucket.net += r.net;
    flowingNet += r.net;
  });
  const netRental = flowingNet;
  const isLoss = netRental < 0;

  APP.pendingValues.rental = netRental;
  APP.rentalLoss = isLoss ? Math.abs(netRental) : 0;

  /* Batch I (#74): the aggregate loss banners that used to sit here are gone
     — a red "consult a tax professional" one on any net loss, and an amber
     s20A total. Each property's own card already carries an amber note
     stating that property's determined outcome (ring-fenced, or flowing
     against other income), so these restated the same facts one level up,
     and the red one did it in a more alarming colour than the per-property
     note it duplicated. Nothing is lost: the per-property notes name every
     amount these summed. */
  aggEl.innerHTML = '<div class="sum-line"><span class="lbl">Total gross rental income</span><span class="val">' + fmt(totalIncome) + '</span></div>'
    + '<div class="sum-line"><span class="lbl">Total deductible expenses (pro-rated)</span><span class="val">&minus; ' + fmt(totalExpenses) + '</span></div>';

  /* at-a-glance: card layout with progressive disclosure */
  if(glanceEl) {
    const typeLabels = { property:'Property', airbnb:'Airbnb', equipment:'Equipment', foreign:'Foreign', other:'Other' };
    const breakdownRows = Object.entries(byType)
      .filter(([, v]) => v.income > 0)
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.6875rem">
        <span style="color:var(--tx2)">${typeLabels[k]}</span>
        <span style="font-family:var(--mono);color:${v.net<0?'var(--er)':'var(--ok)'}">${v.net<0?'('+fmt(Math.abs(v.net))+')':fmt(v.net)}</span>
      </div>`)
      .join('');

    const heroElR = $('hero-b3rental');
    if(heroElR) {
      heroElR.innerHTML = '<div class="dhero bl u-cursor-pointer" onclick="navigateTo(\'summary\',\'return\')" title="Open Tax Return">'
        + '<div class="dhero-top"><div class="dhero-lbl">Gross rental income</div>'
        + '<span class="dhero-count" style="color:var(--accent-hl);background:rgba(31,95,175,.16)">' + APP.rentalProperties.length + (APP.rentalProperties.length===1?' property':' properties') + '</span></div>'
        + '<div class="dhero-num" data-count="' + (totalIncome) + '" data-count-key="income-b3rental">' + fmt(totalIncome) + '</div>'
        + '<div class="dhero-break">Net ' + (isLoss?'loss':'income') + ' <span class="mono" style="color:' + (isLoss?'var(--er)':'var(--au)') + '">' + (isLoss?'('+fmt(Math.abs(netRental))+')':fmt(netRental)) + '</span>' + heroBreakdownLink('rental') + '</div>'
        + '</div>';
    }
    const cards = [
      `<div class="card" style="padding:0;margin-bottom:8px;overflow:hidden">
        <details>
          <summary style="padding:12px 14px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Net Rental ${isLoss?'Loss':'Income'} <i class="material-symbols-outlined msi-expand-more" style="font-size:0.5625rem;opacity:.5;margin-left:4px"></i></div>
              <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:${isLoss?'var(--er)':'var(--ok)'}">${isLoss?'('+fmt(Math.abs(netRental))+')':fmt(netRental)}</div>
            </div>
          </summary>
          <div style="padding:0 14px 12px;border-top:1px solid var(--bd)">
            <div style="font-size:0.6875rem;color:var(--tx3);margin:8px 0 4px">By type</div>
            ${breakdownRows}
          </div>
        </details>
      </div>`,
    ];
    if(totalWearTear > 0) {
      cards.push(`<div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:0.6875rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Equipment W&amp;T</div>
        <div class="glance-amt" style="font-weight:700;font-family:var(--mono);color:var(--tx2)">${fmt(totalWearTear)}</div>
      </div>`);
    }
    glanceEl.innerHTML = cards.join('');
  }

  if(typeof renderBucketNav === 'function') renderBucketNav();
}
